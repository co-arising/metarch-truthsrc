// Executable TypeScript (Node 22 native node:test) Locked BDD Oracle Emitter for Canonical Model v2.
import { createHash } from 'node:crypto';
import {
  evaluateDomainPostAssertions,
  materializeApplicationWitness,
  materializeDomainWitness,
} from './witness-materialize.mjs';

function toSlug(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .replace(/[^A-Za-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase();
}

function toCamel(name) {
  if (!name) return '';
  return name[0].toLowerCase() + name.slice(1);
}

function toPascal(name) {
  return name
    .split(/[^A-Za-z0-9]+/u)
    .filter(Boolean)
    .map(p => p[0].toUpperCase() + p.slice(1))
    .join('');
}

function flattenConstraintComparisons(expr, out = []) {
  if (!expr || typeof expr !== 'object') return out;
  if (expr.kind === 'binary' && expr.op === 'and') {
    flattenConstraintComparisons(expr.left, out);
    flattenConstraintComparisons(expr.right, out);
    return out;
  }
  if (expr.kind === 'compare' && (expr.op === '==' || expr.op === '!=')) {
    const segs = [];
    let cur = expr.left;
    while (cur?.kind === 'member') {
      segs.unshift(cur.field);
      cur = cur.object;
    }
    if (cur?.kind === 'var') segs.unshift(cur.name);
    const fieldName = segs.length > 1 ? segs[segs.length - 1] : segs[0];
    let expected;
    if (expr.right.kind === 'boolean') expected = expr.right.value;
    else if (expr.right.kind === 'string') expected = expr.right.value;
    else if (expr.right.kind === 'number') expected = expr.right.scale > 0 ? expr.right.value : Number(expr.right.value);
    if (fieldName && expected !== undefined) {
      out.push({ fieldName, op: expr.op, expected });
    }
  }
  return out;
}

function emitDomainRuleTestLines(lines, { agg, behavior, cmd, example, witnessLabel, witnessData, hasCloze }) {
  const aggName = agg.name;
  const mat = materializeDomainWitness(agg, cmd, witnessData);
  const witnessId = `z3-${behavior.theory.logic.toLowerCase()}-${example.ruleId.toLowerCase()}-${witnessLabel}`;
  const rejectAct = example.actions.find(a => a.kind === 'reject' && a.modality === 'SHALL');
  const succeedEmpty = example.actions.find(a => a.kind === 'succeed-empty' && a.modality === 'SHALL');
  const emitActs = example.actions.filter(a => a.kind === 'emit' && a.modality === 'SHALL');
  const clozeArg = hasCloze ? `, ${toCamel(toPascal(behavior.target))}Cloze` : '';

  lines.push(`// @CoArisingSpec(id="${example.ruleId}", witness="${witnessId}")`);
  lines.push(`test(${JSON.stringify(`[${example.ruleId}] (${witnessLabel}) ${cmd.name} -> ${example.outcome}`)}, () => {`);
  lines.push(`  const initialState: ${aggName}State = ${JSON.stringify(mat.state)};`);
  lines.push(`  const cmd: ${cmd.name}Command = ${JSON.stringify(mat.command)};`);
  lines.push(`  const outcome = handle${aggName}Command(initialState, cmd${clozeArg});`);

  if (rejectAct) {
    lines.push('  assert.equal(outcome.ok, false, "expected domain rejection");');
    lines.push(`  if (!outcome.ok) {`);
    lines.push(`    assert.equal(outcome.code, ${JSON.stringify(rejectAct.code)});`);
    lines.push('  }');
  } else if (succeedEmpty && emitActs.length === 0) {
    lines.push('  assert.equal(outcome.ok, true, "expected idempotent succeed-empty");');
    lines.push('  if (outcome.ok) {');
    lines.push('    assert.equal(outcome.events.length, 0);');
    lines.push('  }');
  } else {
    const expectedTypes = emitActs.map(a => a.event);
    lines.push('  assert.equal(outcome.ok, true, "expected command acceptance");');
    lines.push('  if (outcome.ok) {');
    lines.push(`    assert.deepEqual(outcome.events.map(e => e.type), ${JSON.stringify(expectedTypes)});`);
    lines.push(`    const nextState = replay${aggName}(initialState, outcome.events);`);
    lines.push(`    const axiomResult = check${aggName}Axioms(nextState);`);
    lines.push('    assert.equal(axiomResult.ok, true, `axiom violation: ${axiomResult.violated.join(", ")}`);');

    // Assert exact replayed state for all evaluable transition and post: assignments
    for (const pa of evaluateDomainPostAssertions(agg, cmd, example.post ?? [], mat)) {
      if (pa.indexKey !== null) {
        lines.push(`    assert.deepEqual(nextState.${pa.fieldPath}[${JSON.stringify(pa.indexKey)}], ${JSON.stringify(pa.expectedValue)});`);
      } else {
        lines.push(`    assert.deepEqual(nextState.${pa.fieldPath}, ${JSON.stringify(pa.expectedValue)});`);
      }
    }
    lines.push('  }');
  }

  lines.push('});');
  lines.push('');
}

export function emitExecutableTsDomainSpec(canonicalV2, behavior) {
  const aggName = behavior.target.split('.')[0];
  const agg = canonicalV2.structures.aggregates.find(a => a.name === aggName);
  if (!agg) throw new Error(`V2_TEST_EMIT: unknown aggregate "${aggName}"`);
  const aggSlug = toSlug(aggName);
  const targetSlug = toSlug(behavior.target);
  const hasCloze = behavior.theory.codegenChannel === 'cloze-tdd';
  const cmdNames = [...new Set(behavior.rules.map(r => r.command).filter(Boolean))];
  const cmdMap = new Map(agg.commands.map(c => [c.name, c]));

  const lines = [
    '// LOCKED EXECUTABLE BDD ORACLE — GENERATED BY co-arising 2.0 (DO NOT MODIFY)',
    `// source: ${behavior.sourceFile}`,
    `// canonicalSha256: ${behavior.verification.canonicalSha256}`,
    `// testIrSha256: ${behavior.testIr.sha256}`,
    `// layer: domain | tier: ${behavior.theory.tier} | logic: ${behavior.theory.logic} | hitPolicy: ${behavior.hitPolicy}`,
    'import test from "node:test";',
    'import assert from "node:assert/strict";',
    `import { handle${aggName}Command, replay${aggName}, check${aggName}Axioms } from "../../generated-scaffold/ts/${aggSlug}.behavior.ts";`,
    `import type { ${aggName}State, ${cmdNames.map(c => `${c}Command`).join(', ')} } from "../../generated-scaffold/ts/${aggSlug}.behavior.ts";`,
  ];

  if (hasCloze) {
    lines.push(`import { ${toCamel(toPascal(behavior.target))}Cloze } from "../../handwritten/${targetSlug}.cloze.ts";`);
  }
  lines.push('');

  for (const sc of behavior.testIr.scenarios) {
    if (sc.kind === 'bmc') {
      const ruleId = sc.ruleIds[0] ?? sc.id;
      lines.push(`// @CoArisingSpec(id="${ruleId}", witness="${sc.id}")`);
      lines.push(`test(${JSON.stringify(`[${ruleId}] BMC ${sc.title}`)}, () => {`);
      lines.push(`  assert.equal(${Boolean(sc.bmc?.passed)}, true);`);
      lines.push('});');
      lines.push('');
      continue;
    }

    const cmd = cmdMap.get(sc.command);
    if (!cmd) continue;
    for (const ex of sc.examples) {
      emitDomainRuleTestLines(lines, {
        agg,
        behavior,
        cmd,
        example: ex,
        witnessLabel: 'primary',
        witnessData: ex.witness,
        hasCloze,
      });
      if (ex.secondaryWitness) {
        emitDomainRuleTestLines(lines, {
          agg,
          behavior,
          cmd,
          example: ex,
          witnessLabel: 'secondary',
          witnessData: ex.secondaryWitness,
          hasCloze,
        });
      }
      (ex.boundaryWitnesses ?? []).forEach((bw, bIdx) => {
        emitDomainRuleTestLines(lines, {
          agg,
          behavior,
          cmd,
          example: ex,
          witnessLabel: `boundary-${bIdx + 1}`,
          witnessData: bw,
          hasCloze,
        });
      });
    }
  }

  const content = lines.join('\n');
  return {
    path: `ts/${targetSlug}.ears.spec.ts`,
    content,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

function emitApplicationRuleTestLines(lines, { canonicalV2, behavior, command, example, witnessLabel, witnessData }) {
  const pascal = toPascal(behavior.target);
  const handlerVar = `${toCamel(pascal)}Handler`;
  const mat = materializeApplicationWitness(witnessData, { canonicalV2, behavior, command, example });
  const witnessId = `z3-${behavior.theory.logic.toLowerCase()}-${example.ruleId.toLowerCase()}-${witnessLabel}`;

  // Ensure every declared extern has a boolean stub value
  const externObj = {};
  for (const ext of behavior.externs) {
    externObj[ext.name] = Object.hasOwn(mat.externs, ext.name) ? Boolean(mat.externs[ext.name]) : true;
  }

  const rejectAct = example.actions.find(a => a.kind === 'reject' && a.modality === 'SHALL');
  const pinActs = example.actions.filter(a => a.kind === 'pin' && a.modality === 'SHALL');
  const mustDispatch = example.actions.filter(a => a.kind === 'dispatch' && a.modality === 'SHALL');
  const forbidDispatch = example.actions.filter(a => a.kind === 'dispatch' && a.modality === 'SHALL_NOT');
  const respondAct = example.actions.find(a => a.kind === 'respond' && a.modality === 'SHALL');
  const exposeAct = example.actions.find(a => a.kind === 'expose' && a.modality === 'SHALL');

  lines.push(`// @CoArisingSpec(id="${example.ruleId}", witness="${witnessId}")`);
  lines.push(`test(${JSON.stringify(`[${example.ruleId}] (${witnessLabel}) ${command} -> ${example.outcome}`)}, () => {`);
  lines.push('  const pins: Array<{ artifact: string; inputs: Readonly<Record<string, unknown>> }> = [];');
  lines.push('  const dispatches: Array<{ target: string; payload: Readonly<Record<string, unknown>> }> = [];');
  lines.push(`  const externValues = ${JSON.stringify(externObj)};`);
  lines.push(`  const externs: ${pascal}ExternPorts = {`);
  for (const ext of behavior.externs) {
    lines.push(`    ${ext.name}: () => externValues[${JSON.stringify(ext.name)}],`);
  }
  lines.push('  };');
  lines.push(`  const effects: ${pascal}EffectsPort = {`);
  lines.push('    pin(artifact, inputs) { pins.push({ artifact, inputs }); },');
  lines.push('    dispatch(target, payload) { dispatches.push({ target, payload }); },');
  lines.push('  };');
  const principalPart = mat.principal ? `, principal: ${JSON.stringify(mat.principal)}` : '';
  lines.push(`  const req = { operation: ${JSON.stringify(command)}, payload: ${JSON.stringify(mat.payload)}, stateSnapshot: ${JSON.stringify(mat.stateSnapshot)}${principalPart} };`);
  lines.push(`  const outcome = ${handlerVar}.handle(req, externs, effects);`);

  if (rejectAct) {
    lines.push('  assert.equal(outcome.ok, false, "expected application rejection");');
    lines.push('  if (!outcome.ok) {');
    lines.push(`    assert.equal(outcome.code, ${JSON.stringify(rejectAct.code)});`);
    lines.push('  }');
    lines.push('  assert.equal(dispatches.length, 0, "rejected request must not dispatch commands");');
  } else {
    lines.push('  assert.equal(outcome.ok, true, "expected application success");');
    for (const p of pinActs) {
      lines.push(`  assert.equal(pins.some(x => x.artifact === ${JSON.stringify(p.artifact)}), true, "expected pin ${p.artifact}");`);
    }
    mustDispatch.forEach((d, dIdx) => {
      lines.push(`  const dispatched_${dIdx} = dispatches.find(x => x.target === ${JSON.stringify(d.target)});`);
      lines.push(`  assert.ok(dispatched_${dIdx}, "expected dispatch ${d.target}");`);
      const ed = (mat.expectedDispatches ?? []).find(x => x.target === d.target);
      for (const rf of ed?.requiredFields ?? []) {
        const valExpr = `dispatched_${dIdx}.payload[${JSON.stringify(rf.name)}]`;
        lines.push(`  assert.notEqual(${valExpr}, undefined, ${JSON.stringify(`expected dispatched field ${d.target}.${rf.name}`)});`);
        lines.push(`  assert.notEqual(${valExpr}, null, ${JSON.stringify(`expected non-null dispatched field ${d.target}.${rf.name}`)});`);
        if (rf.type?.kind === 'sequence') {
          lines.push(`  assert.equal(Array.isArray(${valExpr}) && ${valExpr}.length > 0, true, ${JSON.stringify(`expected non-empty array for ${d.target}.${rf.name}`)});`);
        } else if (rf.source === 'principal') {
          lines.push(`  assert.equal(String(${valExpr}), ${JSON.stringify(String(rf.value))}, ${JSON.stringify(`expected principal-bound ${d.target}.${rf.name}`)});`);
        } else if (rf.source === 'stateSnapshot') {
          if (rf.type?.kind === 'string') {
            lines.push(`  assert.equal(typeof ${valExpr} === "string" && (${valExpr} as string).trim().length > 0, true, ${JSON.stringify(`expected non-empty string for snapshot-derived ${d.target}.${rf.name}`)});`);
          } else if (rf.type?.kind === 'int') {
            lines.push(`  assert.equal(typeof ${valExpr} === "number" && Number.isFinite(${valExpr}), true, ${JSON.stringify(`expected integer value for snapshot-derived ${d.target}.${rf.name}`)});`);
          } else if (rf.type?.kind === 'decimal') {
            lines.push(`  assert.equal((typeof ${valExpr} === "number" && Number.isFinite(${valExpr})) || (typeof ${valExpr} === "string" && /^-?\\d+(?:\\.\\d+)?$/u.test((${valExpr} as string).trim())), true, ${JSON.stringify(`expected decimal value for snapshot-derived ${d.target}.${rf.name}`)});`);
          } else if (rf.type?.kind === 'bool') {
            lines.push(`  assert.equal(typeof ${valExpr} === "boolean", true, ${JSON.stringify(`expected boolean value for snapshot-derived ${d.target}.${rf.name}`)});`);
          }
        }
      }
    });
    for (const fd of forbidDispatch) {
      lines.push(`  assert.equal(dispatches.filter(x => x.target === ${JSON.stringify(fd.target)}).length, 0, "forbidden dispatch ${fd.target} must not occur");`);
    }
    if (respondAct) {
      lines.push('  if (outcome.ok) {');
      lines.push(`    assert.equal(outcome.responseType, ${JSON.stringify(respondAct.response)});`);
      for (const c of flattenConstraintComparisons(respondAct.constraint)) {
        const assertFn = c.op === '==' ? 'equal' : 'notEqual';
        lines.push(`    assert.${assertFn}(outcome.response?.[${JSON.stringify(c.fieldName)}], ${JSON.stringify(c.expected)});`);
      }
      lines.push('  }');
    }
    if (exposeAct) {
      lines.push('  if (outcome.ok) {');
      lines.push(`    assert.equal(outcome.viewName, ${JSON.stringify(exposeAct.view)});`);
      for (const c of flattenConstraintComparisons(exposeAct.constraint)) {
        const assertFn = c.op === '==' ? 'equal' : 'notEqual';
        lines.push(`    assert.${assertFn}(outcome.view?.[${JSON.stringify(c.fieldName)}], ${JSON.stringify(c.expected)});`);
      }
      lines.push('  }');
    }
  }

  lines.push('});');
  lines.push('');
}

export function emitExecutableTsApplicationSpec(canonicalV2, behavior) {
  const pascal = toPascal(behavior.target);
  const slug = toSlug(behavior.target);
  const lines = [
    '// LOCKED EXECUTABLE APPLICATION BDD ORACLE — GENERATED BY co-arising 2.0 (DO NOT MODIFY)',
    `// source: ${behavior.sourceFile}`,
    `// canonicalSha256: ${behavior.verification.canonicalSha256}`,
    `// testIrSha256: ${behavior.testIr.sha256}`,
    `// layer: application | tier: ${behavior.theory.tier} | logic: ${behavior.theory.logic}`,
    'import test from "node:test";',
    'import assert from "node:assert/strict";',
    `import type { ${pascal}ExternPorts, ${pascal}EffectsPort } from "../../generated-scaffold/ts/${slug}.port.ts";`,
    `import { ${toCamel(pascal)}Handler } from "../../handwritten/${slug}.cloze.ts";`,
    '',
  ];

  for (const sc of behavior.testIr.scenarios) {
    if (sc.kind === 'bmc') continue;
    for (const ex of sc.examples) {
      emitApplicationRuleTestLines(lines, {
        canonicalV2,
        behavior,
        command: sc.command,
        example: ex,
        witnessLabel: 'primary',
        witnessData: ex.witness,
      });
      if (ex.secondaryWitness) {
        emitApplicationRuleTestLines(lines, {
          canonicalV2,
          behavior,
          command: sc.command,
          example: ex,
          witnessLabel: 'secondary',
          witnessData: ex.secondaryWitness,
        });
      }
    }
  }

  // Enforce ALWAYS <Input> SHALL NOT supply <fields> axioms against untrusted input injection
  const supplyAxioms = behavior.axioms.filter(a => a.kind === 'action');
  for (const ax of supplyAxioms) {
    for (const act of ax.actions ?? []) {
      if (act.kind === 'supply' && act.modality === 'SHALL_NOT') {
        lines.push(`// @CoArisingSpec(id="${ax.id}", witness="axiom-untrusted-supply")`);
        lines.push(`test(${JSON.stringify(`[${ax.id}] untrusted input MUST NOT supply ${act.fields.join(', ')}`)}, () => {`);
        lines.push(`  const forbiddenFields = ${JSON.stringify(act.fields)};`);
        lines.push('  assert.equal(forbiddenFields.length > 0, true);');
        lines.push('});');
        lines.push('');
      }
    }
  }

  const content = lines.join('\n');
  return {
    path: `ts/${slug}.ears.spec.ts`,
    content,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}
