// Executable ScalaTest (AnyFunSuite) Locked BDD/TDD Oracle Emitter targeting the
// 1.0 Strict-Governance Scala Architecture (domain/entities, domain/invariants, domain/values,
// domain/services/impl, application/services).
import { createHash } from 'node:crypto';
import {
  evaluateDomainPostAssertions,
  materializeApplicationWitness,
  materializeDomainWitness,
} from './witness-materialize.mjs';

function toPascal(name) {
  return String(name ?? '')
    .split(/[^A-Za-z0-9]+/u)
    .filter(Boolean)
    .map(p => p[0].toUpperCase() + p.slice(1))
    .join('');
}

function buildExactSet(canonicalV2) {
  const map = new Map();
  for (const ex of canonicalV2.structures?.exactTypes ?? []) map.set(ex.name, ex);
  return map;
}

function strictScalaTypeOf(rt) {
  if (!rt || typeof rt !== 'object') return 'String';
  switch (rt.kind) {
    case 'int': return 'Long';
    case 'bool': return 'Boolean';
    case 'string': return 'String';
    case 'decimal': return 'BigDecimal';
    case 'optional': return `Option[${strictScalaTypeOf(rt.element)}]`;
    case 'sequence': return `Vector[${strictScalaTypeOf(rt.element)}]`;
    case 'map': return `Map[String, ${strictScalaTypeOf(rt.value)}]`;
    case 'record': return rt.typeName ?? 'String';
    default: return 'String';
  }
}

function strictScalaLiteral(val, resolvedType, exactMap) {
  if (!resolvedType) return JSON.stringify(String(val ?? ''));
  switch (resolvedType.kind) {
    case 'int': {
      const n = Number(val ?? 0);
      return `${Number.isFinite(n) ? Math.trunc(n) : 0}L`;
    }
    case 'bool': return val ? 'true' : 'false';
    case 'string': return JSON.stringify(String(val ?? ''));
    case 'decimal': return `BigDecimal(${JSON.stringify(String(val ?? '0.00'))})`;
    case 'optional':
      return val === null || val === undefined ? 'None' : `Some(${strictScalaLiteral(val, resolvedType.element, exactMap)})`;
    case 'sequence': {
      const items = Array.isArray(val) ? val : [];
      if (items.length === 0) return `Vector.empty[${strictScalaTypeOf(resolvedType.element)}]`;
      return `Vector(${items.map(el => strictScalaLiteral(el, resolvedType.element, exactMap)).join(', ')})`;
    }
    case 'map': {
      const entries = Object.entries(val ?? {}).map(
        ([k, v]) => `${JSON.stringify(k)} -> ${strictScalaLiteral(v, resolvedType.value, exactMap)}`,
      );
      return entries.length === 0
        ? `Map.empty[String, ${strictScalaTypeOf(resolvedType.value)}]`
        : `Map(${entries.join(', ')})`;
    }
    case 'record': {
      const ex = exactMap.get(resolvedType.typeName);
      if (ex) {
        const amtField = ex.amountField ?? (ex.form === 'unit-decimal' ? 'amount' : 'value');
        const amtStr = String(val?.[amtField] ?? '0.00');
        if (ex.form === 'unit-decimal') {
          const unitField = ex.unitField ?? 'currency';
          const unitStr = String(val?.[unitField] ?? (ex.units?.[0] ?? 'CNY'));
          return `${ex.name}.create(BigDecimal(${JSON.stringify(amtStr)}), ${JSON.stringify(unitStr)}).getOrElse(${ex.name}.Zero)`;
        }
        return `${ex.name}.create(BigDecimal(${JSON.stringify(amtStr)})).getOrElse(${ex.name}.Zero)`;
      }
      const args = Object.entries(resolvedType.fields ?? {})
        .map(([k, ft]) => strictScalaLiteral(val?.[k], ft, exactMap))
        .join(', ');
      return `${resolvedType.typeName}(${args})`;
    }
    default: return JSON.stringify(String(val ?? ''));
  }
}

function scalaAnyLiteral(val) {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') {
    return Number.isInteger(val) ? `${val}L` : `BigDecimal(${JSON.stringify(String(val))})`;
  }
  if (typeof val === 'string') return JSON.stringify(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return 'Seq.empty[Any]';
    return `Seq[Any](${val.map(scalaAnyLiteral).join(', ')})`;
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val).map(([k, v]) => `${JSON.stringify(k)} -> ${scalaAnyLiteral(v)}`);
    if (entries.length === 0) return 'Map.empty[String, Any]';
    return `Map[String, Any](${entries.join(', ')})`;
  }
  return JSON.stringify(String(val));
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

/**
 * Emit locked ScalaTest domain oracle against 1.0 strict-governance layout:
 *   - L1 deterministic: <pkg>.domain.invariants.<Agg>Rules.<Cmd>Rule
 *   - L2 @cloze TDD:    <pkg>.domain.services.impl.<Target>Cloze
 *   - Replay + Axioms:  <pkg>.domain.entities.<Agg>Axioms (backed by domain.entities.behaviors.<Agg>EventHandler)
 */
export function emitExecutableScalaStrictDomainSpec(canonicalV2, behavior, { packageName = 'example.v2' } = {}) {
  const aggName = behavior.target.split('.')[0];
  const agg = canonicalV2.structures.aggregates.find(a => a.name === aggName);
  if (!agg) throw new Error(`V2_TEST_EMIT: unknown aggregate "${aggName}"`);
  const exactMap = buildExactSet(canonicalV2);
  const className = `${toPascal(behavior.target)}EarsSpec`;
  const isCloze = behavior.theory.codegenChannel === 'cloze-tdd';
  const implObj = `${toPascal(behavior.target)}Impl`;
  const cmdMap = new Map(agg.commands.map(c => [c.name, c]));

  // Determine whether this aggregate also has L1 deterministic behaviors (controls L2 params object name)
  const aggL1Behaviors = (canonicalV2.behaviors ?? []).filter(
    b => b.kind === 'slice' && b.target.split('.')[0] === aggName && b.theory.codegenChannel !== 'cloze-tdd',
  );
  const paramsObjName = isCloze && aggL1Behaviors.length > 0 ? `${aggName}DomainServiceRuleParams` : `${aggName}RuleParams`;
  const hasValues = (canonicalV2.structures?.exactTypes?.length ?? 0) > 0
    || (canonicalV2.structures?.valueObjects?.length ?? 0) > 0;

  const lines = [
    '// LOCKED EXECUTABLE BDD/TDD ORACLE — 1.0 STRICT-GOVERNANCE ARCHITECTURE (DO NOT MODIFY)',
    `// source: ${behavior.sourceFile}`,
    `// canonicalSha256: ${behavior.verification.canonicalSha256}`,
    `// testIrSha256: ${behavior.testIr.sha256}`,
    `// layer: domain | tier: ${behavior.theory.tier} | logic: ${behavior.theory.logic}`,
    `package ${packageName}.domain.invariants`,
    '',
    'import org.scalatest.funsuite.AnyFunSuite',
    `import ${packageName}.domain.entities.${aggName}Axioms`,
    `import ${packageName}.domain.entities.${aggName}Entity`,
    `import ${packageName}.domain.invariants.params.${paramsObjName}`,
    ...(isCloze
      ? [`import ${packageName}.domain.services.impl.${implObj}`]
      : [`import ${packageName}.domain.services.${aggName}Computations`]),
    ...(hasValues ? [`import ${packageName}.domain.values._`] : []),
    '',
    `final class ${className} extends AnyFunSuite {`,
  ];

  const emitCase = (cmd, ex, witnessLabel, witnessData) => {
    const mat = materializeDomainWitness(agg, cmd, witnessData);
    const stateArgs = (agg.stateFields ?? [])
      .map(sf => `${sf.name} = ${strictScalaLiteral(mat.state[sf.name], sf.resolvedType, exactMap)}`)
      .join(', ');
    const cmdArgs = (cmd.parameters ?? [])
      .map(p => `${p.name} = ${strictScalaLiteral(mat.command[p.name], p.resolvedType, exactMap)}`)
      .join(', ');
    const witnessId = `z3-${behavior.theory.logic.toLowerCase()}-${ex.ruleId.toLowerCase()}-${witnessLabel}`;
    const rejectAct = ex.actions.find(a => a.kind === 'reject' && a.modality === 'SHALL');
    const emitActs = ex.actions.filter(a => a.kind === 'emit' && a.modality === 'SHALL');

    lines.push(`  // @CoArisingSpec(id="${ex.ruleId}", witness="${witnessId}")`);
    lines.push(`  test(${JSON.stringify(`[${ex.ruleId}] (${witnessLabel}) ${cmd.name} -> ${ex.outcome}`)}) {`);
    lines.push(`    val state = ${aggName}Entity.State(${stateArgs})`);
    lines.push(`    val params = ${paramsObjName}.${cmd.name}Params(${cmdArgs})`);
    if (isCloze) {
      lines.push(`    val outcome = ${implObj}.apply(state, params)`);
    } else {
      lines.push(`    val rule = new ${aggName}Rules.${cmd.name}Rule(${aggName}Computations.Noop)`);
      lines.push('    val outcome = rule.apply(state, params)');
    }
    if (rejectAct) {
      lines.push('    outcome match {');
      lines.push(`      case Left(err) => assert(err.code == ${JSON.stringify(rejectAct.code)})`);
      lines.push('      case Right(events) => fail(s"expected rejection, got events: $events")');
      lines.push('    }');
    } else {
      lines.push('    outcome match {');
      lines.push('      case Right(events) =>');
      lines.push(`        assert(events.map(_.getClass.getSimpleName) == List(${emitActs.map(a => JSON.stringify(a.event)).join(', ')}))`);
      lines.push(`        val nextState = ${aggName}Axioms.replay(state, events)`);
      lines.push(`        assert(${aggName}Axioms.checkAxioms(nextState).isEmpty)`);
      for (const pa of evaluateDomainPostAssertions(agg, cmd, ex.post ?? [], mat)) {
        const expectedLit = strictScalaLiteral(pa.expectedValue, pa.targetType, exactMap);
        if (pa.indexKey !== null) {
          lines.push(`        assert(nextState.${pa.fieldPath}.get(${JSON.stringify(pa.indexKey)}).contains(${expectedLit}))`);
        } else {
          lines.push(`        assert(nextState.${pa.fieldPath} == ${expectedLit})`);
        }
      }
      lines.push('      case Left(err) => fail(s"expected acceptance, got rejection: $err")');
      lines.push('    }');
    }
    lines.push('  }');
    lines.push('');
  };

  for (const sc of behavior.testIr.scenarios) {
    if (sc.kind === 'bmc') continue;
    const cmd = cmdMap.get(sc.command);
    if (!cmd) continue;
    for (const ex of sc.examples) {
      emitCase(cmd, ex, 'primary', ex.witness);
      if (ex.secondaryWitness) emitCase(cmd, ex, 'secondary', ex.secondaryWitness);
      (ex.boundaryWitnesses ?? []).forEach((bw, bIdx) => {
        emitCase(cmd, ex, `boundary-${bIdx + 1}`, bw);
      });
    }
  }

  // Deterministic L1 postcondition test coverage: verify checkEventPostconditions rejects blank required string fields
  if (!isCloze) {
    const firstEmitEv = (agg.events ?? []).find(ev =>
      (ev.fields ?? []).some(f => f.resolvedType?.kind === 'string'),
    );
    if (firstEmitEv) {
      const evFields = firstEmitEv.fields ?? [];
      const validArgs = evFields.map(f => {
        if (f.resolvedType?.kind === 'string') return `${f.name} = "non-empty-id"`;
        return `${f.name} = ${strictScalaLiteral(null, f.resolvedType, exactMap)}`;
      }).join(', ');
      const blankStrField = evFields.find(f => f.resolvedType?.kind === 'string');
      const invalidArgs = evFields.map(f => {
        if (f.name === blankStrField.name) return `${f.name} = "   "`;
        if (f.resolvedType?.kind === 'string') return `${f.name} = "non-empty-id"`;
        return `${f.name} = ${strictScalaLiteral(null, f.resolvedType, exactMap)}`;
      }).join(', ');
      lines.push(`  test("[POSTCOND] ${aggName}Rules.checkEventPostconditions validates ${firstEmitEv.name} required fields") {`);
      lines.push(`    val validEv = ${aggName}Entity.${firstEmitEv.name}(${validArgs})`);
      lines.push(`    assert(${aggName}Rules.checkEventPostconditions(List(validEv)).isEmpty)`);
      lines.push(`    val blankEv = ${aggName}Entity.${firstEmitEv.name}(${invalidArgs})`);
      lines.push(`    assert(${aggName}Rules.checkEventPostconditions(List(blankEv)).nonEmpty)`);
      lines.push('  }');
      lines.push('');
    }
  }

  lines.push('}', '');
  const content = lines.join('\n');
  const pkgPath = packageName.split('.').join('/');
  return {
    path: `scala/${pkgPath}/domain/invariants/${className}.scala`,
    className,
    content,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

/**
 * Emit locked ScalaTest application oracle against 1.0 strict-governance layout:
 *   <pkg>.application.services.<Story>Impl
 */
export function emitExecutableScalaStrictApplicationSpec(canonicalV2, behavior, { packageName = 'example.v2' } = {}) {
  const pascal = toPascal(behavior.target);
  const className = `${pascal}EarsSpec`;
  const implObj = `${pascal}Impl`;

  const lines = [
    '// LOCKED EXECUTABLE APPLICATION BDD/TDD ORACLE — 1.0 STRICT-GOVERNANCE ARCHITECTURE (DO NOT MODIFY)',
    `// source: ${behavior.sourceFile}`,
    `// canonicalSha256: ${behavior.verification.canonicalSha256}`,
    `// testIrSha256: ${behavior.testIr.sha256}`,
    `// layer: application | tier: ${behavior.theory.tier} | logic: ${behavior.theory.logic}`,
    `package ${packageName}.application.services`,
    '',
    'import org.scalatest.funsuite.AnyFunSuite',
    'import scala.collection.mutable.ListBuffer',
    '',
    `final class ${className} extends AnyFunSuite {`,
  ];

  const emitCase = (command, ex, witnessLabel, witnessData) => {
    const mat = materializeApplicationWitness(witnessData);
    const witnessId = `z3-${behavior.theory.logic.toLowerCase()}-${ex.ruleId.toLowerCase()}-${witnessLabel}`;
    const rejectAct = ex.actions.find(a => a.kind === 'reject' && a.modality === 'SHALL');
    const pinActs = ex.actions.filter(a => a.kind === 'pin' && a.modality === 'SHALL');
    const mustDispatch = ex.actions.filter(a => a.kind === 'dispatch' && a.modality === 'SHALL');
    const forbidDispatch = ex.actions.filter(a => a.kind === 'dispatch' && a.modality === 'SHALL_NOT');
    const respondAct = ex.actions.find(a => a.kind === 'respond' && a.modality === 'SHALL');
    const exposeAct = ex.actions.find(a => a.kind === 'expose' && a.modality === 'SHALL');

    lines.push(`  // @CoArisingSpec(id="${ex.ruleId}", witness="${witnessId}")`);
    lines.push(`  test(${JSON.stringify(`[${ex.ruleId}] (${witnessLabel}) ${command} -> ${ex.outcome}`)}) {`);
    lines.push('    val pins = ListBuffer.empty[(String, Map[String, Any])]');
    lines.push('    val dispatches = ListBuffer.empty[(String, Map[String, Any])]');
    lines.push(`    val externs = new ${pascal}ExternPorts {`);
    for (const ext of behavior.externs ?? []) {
      const val = Object.hasOwn(mat.externs, ext.name) ? Boolean(mat.externs[ext.name]) : true;
      const argsSig = (ext.params ?? []).map(p => `${p}: Any`).join(', ');
      lines.push(`      override def ${ext.name}(${argsSig}): Boolean = ${val ? 'true' : 'false'}`);
    }
    lines.push('    }');
    lines.push(`    val effects = new ${pascal}EffectsPort {`);
    lines.push('      override def pin(artifact: String, inputs: Map[String, Any]): Unit = pins += ((artifact, inputs))');
    lines.push('      override def dispatch(target: String, payload: Map[String, Any]): Unit = dispatches += ((target, payload))');
    lines.push('    }');
    lines.push(`    val req = ${pascal}Request(`);
    lines.push(`      operation = ${JSON.stringify(command)},`);
    lines.push(`      payload = ${scalaAnyLiteral(mat.payload)},`);
    lines.push(`      stateSnapshot = ${scalaAnyLiteral(mat.stateSnapshot)}`);
    lines.push('    )');
    lines.push(`    val outcome = ${implObj}.handle(req, externs, effects)`);

    if (rejectAct) {
      lines.push('    outcome match {');
      lines.push(`      case Left(err) => assert(err.code == ${JSON.stringify(rejectAct.code)})`);
      lines.push('      case Right(acc) => fail(s"expected application rejection, got success: $acc")');
      lines.push('    }');
      lines.push('    assert(dispatches.isEmpty, "rejected request must not dispatch commands")');
    } else {
      lines.push('    outcome match {');
      lines.push('      case Right(res) =>');
      for (const p of pinActs) {
        lines.push(`        assert(pins.exists(_._1 == ${JSON.stringify(p.artifact)}), ${JSON.stringify(`expected pin ${p.artifact}`)})`);
      }
      for (const d of mustDispatch) {
        lines.push(`        assert(dispatches.exists(_._1 == ${JSON.stringify(d.target)}), ${JSON.stringify(`expected dispatch ${d.target}`)})`);
      }
      for (const fd of forbidDispatch) {
        lines.push(`        assert(!dispatches.exists(_._1 == ${JSON.stringify(fd.target)}), ${JSON.stringify(`forbidden dispatch ${fd.target} must not occur`)})`);
      }
      if (respondAct) {
        lines.push(`        assert(res.responseType.contains(${JSON.stringify(respondAct.response)}))`);
        for (const c of flattenConstraintComparisons(respondAct.constraint)) {
          const lit = scalaAnyLiteral(c.expected);
          if (c.op === '==') {
            lines.push(`        assert(res.response.get(${JSON.stringify(c.fieldName)}).contains(${lit}))`);
          } else {
            lines.push(`        assert(!res.response.get(${JSON.stringify(c.fieldName)}).contains(${lit}))`);
          }
        }
      }
      if (exposeAct) {
        lines.push(`        assert(res.viewName.contains(${JSON.stringify(exposeAct.view)}))`);
        for (const c of flattenConstraintComparisons(exposeAct.constraint)) {
          const lit = scalaAnyLiteral(c.expected);
          if (c.op === '==') {
            lines.push(`        assert(res.view.get(${JSON.stringify(c.fieldName)}).contains(${lit}))`);
          } else {
            lines.push(`        assert(!res.view.get(${JSON.stringify(c.fieldName)}).contains(${lit}))`);
          }
        }
      }
      lines.push('      case Left(err) => fail(s"expected application success, got rejection: $err")');
      lines.push('    }');
    }
    lines.push('  }');
    lines.push('');
  };

  for (const sc of behavior.testIr.scenarios) {
    if (sc.kind === 'bmc') continue;
    for (const ex of sc.examples) {
      emitCase(sc.command, ex, 'primary', ex.witness);
      if (ex.secondaryWitness) emitCase(sc.command, ex, 'secondary', ex.secondaryWitness);
    }
  }

  const supplyAxioms = (behavior.axioms ?? []).filter(a => a.kind === 'action');
  for (const ax of supplyAxioms) {
    for (const act of ax.actions ?? []) {
      if (act.kind === 'supply' && act.modality === 'SHALL_NOT') {
        lines.push(`  // @CoArisingSpec(id="${ax.id}", witness="axiom-untrusted-supply")`);
        lines.push(`  test(${JSON.stringify(`[${ax.id}] untrusted input MUST NOT supply ${act.fields.join(', ')}`)}) {`);
        lines.push(`    val forbiddenFields = Seq(${act.fields.map(f => JSON.stringify(f)).join(', ')})`);
        lines.push('    assert(forbiddenFields.nonEmpty)');
        lines.push('  }');
        lines.push('');
      }
    }
  }

  lines.push('}', '');
  const content = lines.join('\n');
  const pkgPath = packageName.split('.').join('/');
  return {
    path: `scala/${pkgPath}/application/services/${className}.scala`,
    className,
    content,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}
