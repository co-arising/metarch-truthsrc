// Direct EARS-IR -> TypeScript (Node 22 native TS ESM) deterministic generator for Canonical Model v2.
// Channel 4A: zero-token L1 First-Hit guards, Event Sourcing folds, Pure Replay Oracle, and Axiom checker.
// Channel 4B: typed Port interfaces + bounded @cloze:start..@cloze:end handwritten skeletons.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { registerCodegenPlugin } from './interface.mjs';

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

function tsTypeOf(rt) {
  if (!rt || typeof rt !== 'object') return 'unknown';
  switch (rt.kind) {
    case 'int': return 'number';
    case 'bool': return 'boolean';
    case 'string': return 'string';
    case 'decimal': return 'string';
    case 'map': return `Record<string, ${tsTypeOf(rt.value)}>`;
    case 'optional': return `${tsTypeOf(rt.element)} | null`;
    case 'sequence': return `${tsTypeOf(rt.element)}[]`;
    case 'record': return rt.typeName ?? 'Record<string, unknown>';
    default: return 'unknown';
  }
}

function defaultLiteralOf(field) {
  const rt = field.resolvedType;
  if (field.defaultValue !== undefined) {
    if (rt?.kind === 'map') return '{}';
    return JSON.stringify(field.defaultValue);
  }
  switch (rt?.kind) {
    case 'int': return '0';
    case 'bool': return 'false';
    case 'string': return '""';
    case 'decimal': {
      const s = rt.scale ?? 2;
      return JSON.stringify(s > 0 ? `0.${'0'.repeat(s)}` : '0');
    }
    case 'map': return '{}';
    case 'optional': return 'null';
    case 'sequence': return '[]';
    case 'record': {
      const entries = Object.entries(rt.fields ?? {}).map(([k, v]) => `${k}: ${defaultLiteralOf({ resolvedType: v })}`);
      return `{ ${entries.join(', ')} }`;
    }
    default: return '""';
  }
}

function scaleOfType(rt) {
  if (!rt) return 0;
  if (rt.kind === 'decimal') return rt.scale ?? 2;
  if (rt.kind === 'map' && rt.value?.kind === 'decimal') return rt.value.scale ?? 2;
  return 0;
}

function isNumericExpr(expr, env) {
  if (!expr) return false;
  if (expr.kind === 'number' || expr.kind === 'arith' || expr.kind === 'neg') return true;
  if (expr.kind === 'var') {
    const t = env.paramTypes.get(expr.name);
    return t?.kind === 'int' || t?.kind === 'decimal';
  }
  if (expr.kind === 'member') {
    const t = resolveExprType(expr, env);
    return t?.kind === 'int' || t?.kind === 'decimal';
  }
  if (expr.kind === 'index') {
    const t = resolveExprType(expr, env);
    return t?.kind === 'int' || t?.kind === 'decimal';
  }
  return false;
}

function resolveExprType(expr, env) {
  if (!expr) return null;
  if (expr.kind === 'var') return env.paramTypes.get(expr.name) ?? null;
  if (expr.kind === 'member') {
    const segs = [];
    let cur = expr;
    while (cur.kind === 'member') {
      segs.unshift(cur.field);
      cur = cur.object;
    }
    if (cur.kind !== 'var') return null;
    segs.unshift(cur.name);
    if (env.aliases.has(segs[0]) && segs.length > 1) {
      let t = env.stateTypes.get(segs[1]) ?? null;
      for (const f of segs.slice(2)) t = t?.fields?.[f] ?? null;
      return t;
    }
    let t = env.paramTypes.get(segs[0]) ?? null;
    for (const f of segs.slice(1)) t = t?.fields?.[f] ?? null;
    return t;
  }
  if (expr.kind === 'index') {
    const colType = resolveExprType(expr.collection, env);
    return colType?.kind === 'map' ? colType.value : null;
  }
  return null;
}

function compilePathTs(expr, env) {
  const segs = [];
  let cur = expr;
  while (cur.kind === 'member') {
    segs.unshift(cur.field);
    cur = cur.object;
  }
  if (cur.kind !== 'var') return 'undefined';
  segs.unshift(cur.name);

  if (env.aliases.has(segs[0]) && segs.length > 1) {
    return `state.${segs.slice(1).join('.')}`;
  }
  if (env.paramPrefix) {
    return `${env.paramPrefix}.${segs.join('.')}`;
  }
  return segs.join('.');
}

function compileNumTs(expr, env) {
  if (expr.kind === 'number') {
    return `dec(${JSON.stringify(String(expr.value))}, ${expr.scale ?? 0})`;
  }
  if (expr.kind === 'neg') {
    return `decNeg(${compileNumTs(expr.argument, env)})`;
  }
  if (expr.kind === 'arith') {
    const l = compileNumTs(expr.left, env);
    const r = compileNumTs(expr.right, env);
    if (expr.op === '+') return `decAdd(${l}, ${r})`;
    if (expr.op === '-') return `decSub(${l}, ${r})`;
    if (expr.op === '*') return `decMul(${l}, ${r})`;
  }
  if (expr.kind === 'index') {
    const col = compilePathTs(expr.collection, env);
    const key = compileValTs(expr.index, env);
    const colType = resolveExprType(expr.collection, env);
    const s = scaleOfType(colType);
    return `dec(${col}[String(${key})] ?? ${JSON.stringify(s > 0 ? `0.${'0'.repeat(s)}` : '0')}, ${s})`;
  }
  const t = resolveExprType(expr, env);
  const raw = compileValTs(expr, env);
  return `dec(${raw}, ${scaleOfType(t)})`;
}

function compileValTs(expr, env) {
  if (!expr) return 'undefined';
  switch (expr.kind) {
    case 'boolean': return expr.value ? 'true' : 'false';
    case 'string': return JSON.stringify(expr.value);
    case 'number': return expr.scale > 0 ? JSON.stringify(String(expr.value)) : String(expr.value);
    case 'var':
      if (env.paramPrefix && env.paramTypes.has(expr.name)) return `${env.paramPrefix}.${expr.name}`;
      return expr.name;
    case 'member': return compilePathTs(expr, env);
    case 'index': {
      const col = compilePathTs(expr.collection, env);
      const key = compileValTs(expr.index, env);
      const colType = resolveExprType(expr.collection, env);
      const fallback = colType?.value?.kind === 'decimal'
        ? JSON.stringify(`0.${'0'.repeat(colType.value.scale ?? 2)}`)
        : '""';
      return `(${col}[String(${key})] ?? ${fallback})`;
    }
    case 'arith':
    case 'neg': {
      const t = resolveExprType(expr, env);
      const s = scaleOfType(t) || 2;
      return `decFormat(${compileNumTs(expr, env)}, ${s})`;
    }
    case 'call': {
      if (expr.name === 'count' || expr.name === 'len') {
        const col = compileValTs(expr.args[0], env);
        return `Array.isArray(${col}) ? ${col}.length : Object.keys(${col} ?? {}).length`;
      }
      if (expr.name === 'sum') {
        const col = compileValTs(expr.args[0], env);
        return `(${col}.reduce((acc, x) => decAdd(acc, dec(x, 2)), dec("0.00", 2)))`;
      }
      return `${expr.name}(${expr.args.map(a => compileValTs(a, env)).join(', ')})`;
    }
    default:
      return compileBoolTs(expr, env);
  }
}

function compileBoolTs(expr, env) {
  if (!expr) return 'true';
  switch (expr.kind) {
    case 'boolean': return expr.value ? 'true' : 'false';
    case 'not': return `!(${compileBoolTs(expr.argument, env)})`;
    case 'binary': {
      const op = expr.op === 'and' ? '&&' : '||';
      return `(${compileBoolTs(expr.left, env)} ${op} ${compileBoolTs(expr.right, env)})`;
    }
    case 'compare': {
      if (isNumericExpr(expr.left, env) || isNumericExpr(expr.right, env)) {
        const cmp = `decCmp(${compileNumTs(expr.left, env)}, ${compileNumTs(expr.right, env)})`;
        if (expr.op === '==') return `(${cmp} === 0)`;
        if (expr.op === '!=') return `(${cmp} !== 0)`;
        return `(${cmp} ${expr.op} 0)`;
      }
      const l = compileValTs(expr.left, env);
      const r = compileValTs(expr.right, env);
      const op = expr.op === '==' ? '===' : '!==';
      return `(${l} ${op} ${r})`;
    }
    case 'in': {
      if (expr.target.kind === 'interval') {
        const el = compileNumTs(expr.element, env);
        const min = compileNumTs(expr.target.min, env);
        const max = compileNumTs(expr.target.max, env);
        return `decInInterval(${el}, ${min}, ${max}, ${expr.target.leftInclusive}, ${expr.target.rightInclusive})`;
      }
      if (expr.target.kind === 'set') {
        const el = compileValTs(expr.element, env);
        const items = expr.target.elements.map(e => compileValTs(e, env)).join(', ');
        return `[${items}].includes(${el})`;
      }
      const col = compilePathTs(expr.target, env);
      const key = compileValTs(expr.element, env);
      return `Object.hasOwn(${col}, String(${key}))`;
    }
    case 'emptiness': {
      const target = compileValTs(expr.target, env);
      if (expr.check === 'empty') return `(${target} === null || ${target} === undefined || ${target} === "")`;
      return `(${target} !== null && ${target} !== undefined && ${target} !== "")`;
    }
    case 'quantifier': {
      const col = compileValTs(expr.collection, env);
      const innerEnv = { ...env, paramTypes: new Map(env.paramTypes) };
      innerEnv.paramTypes.delete(expr.variable);
      const body = compileBoolTs(expr.body, innerEnv);
      const method = expr.quantifier === 'forall' ? 'every' : 'some';
      return `(${col}.${method}((${expr.variable}) => (${body})))`;
    }
    default:
      return `Boolean(${compileValTs(expr, env)})`;
  }
}

function generateExactRuntimeTs() {
  return [
    '// @generated by co-arising 2.0 (EARS-Native TypeScript Codegen — DO NOT MODIFY)',
    '// Zero-dependency BigInt exact fixed-point decimal arithmetic matching SMT-LIB 2 scale alignment.',
    '',
    'export interface ExactDecimal {',
    '  readonly raw: bigint;',
    '  readonly scale: number;',
    '}',
    '',
    'function pow10(n: number): bigint {',
    '  return 10n ** BigInt(n);',
    '}',
    '',
    'export function dec(value: string | number | bigint | ExactDecimal, defaultScale = 0): ExactDecimal {',
    '  if (typeof value === "object" && value !== null && "raw" in value && "scale" in value) {',
    '    return value;',
    '  }',
    '  if (typeof value === "bigint") {',
    '    return { raw: value * pow10(defaultScale), scale: defaultScale };',
    '  }',
    '  const rawText = String(value).trim();',
    '  const neg = rawText.startsWith("-");',
    '  const unsigned = neg ? rawText.slice(1) : rawText;',
    '  const parts = unsigned.split(".");',
    '  const intPart = parts[0] || "0";',
    '  const fracPart = parts[1] ?? "";',
    '  const scale = Math.max(defaultScale, fracPart.length);',
    '  const padded = fracPart.padEnd(scale, "0");',
    '  const combined = BigInt(intPart + padded);',
    '  return { raw: neg ? -combined : combined, scale };',
    '}',
    '',
    'export function decNeg(a: ExactDecimal): ExactDecimal {',
    '  return { raw: -a.raw, scale: a.scale };',
    '}',
    '',
    'export function decAdd(a: ExactDecimal, b: ExactDecimal): ExactDecimal {',
    '  const scale = Math.max(a.scale, b.scale);',
    '  const ar = a.raw * pow10(scale - a.scale);',
    '  const br = b.raw * pow10(scale - b.scale);',
    '  return { raw: ar + br, scale };',
    '}',
    '',
    'export function decSub(a: ExactDecimal, b: ExactDecimal): ExactDecimal {',
    '  const scale = Math.max(a.scale, b.scale);',
    '  const ar = a.raw * pow10(scale - a.scale);',
    '  const br = b.raw * pow10(scale - b.scale);',
    '  return { raw: ar - br, scale };',
    '}',
    '',
    'export function decMul(a: ExactDecimal, b: ExactDecimal): ExactDecimal {',
    '  return { raw: a.raw * b.raw, scale: a.scale + b.scale };',
    '}',
    '',
    'export function decCmp(a: ExactDecimal, b: ExactDecimal): -1 | 0 | 1 {',
    '  const scale = Math.max(a.scale, b.scale);',
    '  const ar = a.raw * pow10(scale - a.scale);',
    '  const br = b.raw * pow10(scale - b.scale);',
    '  if (ar < br) return -1;',
    '  if (ar > br) return 1;',
    '  return 0;',
    '}',
    '',
    'export function decInInterval(',
    '  x: ExactDecimal,',
    '  min: ExactDecimal,',
    '  max: ExactDecimal,',
    '  leftInclusive: boolean,',
    '  rightInclusive: boolean,',
    '): boolean {',
    '  const lo = decCmp(x, min);',
    '  const hi = decCmp(x, max);',
    '  const loOk = leftInclusive ? lo >= 0 : lo > 0;',
    '  const hiOk = rightInclusive ? hi <= 0 : hi < 0;',
    '  return loOk && hiOk;',
    '}',
    '',
    'export function decFormat(x: ExactDecimal, targetScale = x.scale): string {',
    '  const diff = targetScale - x.scale;',
    '  let scaledRaw = x.raw;',
    '  if (diff > 0) scaledRaw = x.raw * pow10(diff);',
    '  else if (diff < 0) scaledRaw = x.raw / pow10(-diff);',
    '  if (targetScale <= 0) return scaledRaw.toString();',
    '  const neg = scaledRaw < 0n;',
    '  const abs = neg ? -scaledRaw : scaledRaw;',
    '  const digits = abs.toString().padStart(targetScale + 1, "0");',
    '  const whole = digits.slice(0, digits.length - targetScale);',
    '  const frac = digits.slice(digits.length - targetScale);',
    '  return `${neg ? "-" : ""}${whole}.${frac}`;',
    '}',
    '',
  ].join('\n');
}

function generateTypesTs(canonicalV2) {
  const lines = [
    '// @generated by co-arising 2.0 (EARS-Native TypeScript Codegen — DO NOT MODIFY)',
    `// system: ${canonicalV2.system} | context: ${canonicalV2.context}`,
    `// canonicalSha256: ${canonicalV2.canonicalSha256}`,
    '',
    'export interface DomainRejection {',
    '  readonly ok: false;',
    '  readonly code: string;',
    '  readonly ruleId: string;',
    '}',
    '',
    'export interface CommandAccepted<E> {',
    '  readonly ok: true;',
    '  readonly events: readonly E[];',
    '  readonly ruleId: string;',
    '}',
    '',
    'export type CommandOutcome<E> = CommandAccepted<E> | DomainRejection;',
    '',
  ];

  for (const ex of canonicalV2.structures.exactTypes) {
    if (ex.form === 'unit-decimal') {
      const amtField = ex.amountField ?? 'amount';
      const unitField = ex.unitField ?? 'currency';
      lines.push(`// @ProvenanceId(exact:${ex.name})`);
      lines.push(`export interface ${ex.name} {`);
      lines.push(`  readonly ${amtField}: string;`);
      lines.push(`  readonly ${unitField}: string;`);
      lines.push('}');
      lines.push('');
    } else {
      lines.push(`// @ProvenanceId(exact:${ex.name})`);
      lines.push(`export type ${ex.name} = string;`);
      lines.push('');
    }
  }

  for (const vo of canonicalV2.structures.valueObjects) {
    lines.push(`// @ProvenanceId(vo:${vo.name})`);
    lines.push(`export interface ${vo.name} {`);
    for (const f of vo.fields) {
      lines.push(`  readonly ${f.name}: ${tsTypeOf(f.resolvedType)};`);
    }
    lines.push('}');
    lines.push('');
  }

  for (const rm of canonicalV2.structures.readModels) {
    const ifaceName = toPascal(rm.name);
    lines.push(`// @ProvenanceId(readmodel:${rm.name})`);
    lines.push(`export interface ${ifaceName}View {`);
    for (const f of rm.fields) {
      lines.push(`  readonly ${f.name}: ${tsTypeOf(f.resolvedType)};`);
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

function findMapIndexVarInExpr(expr) {
  if (!expr || typeof expr !== 'object') return null;
  if (expr.kind === 'index' && expr.index?.kind === 'var') {
    return { mapExpr: expr.collection, indexVar: expr.index.name };
  }
  for (const k of ['left', 'right', 'argument', 'element', 'target', 'min', 'max']) {
    const found = findMapIndexVarInExpr(expr[k]);
    if (found) return found;
  }
  return null;
}

function generateAggregateBehaviorTs(agg, behaviors, eventFolds, canonicalV2) {
  const aggName = agg.name;
  const stateType = `${aggName}State`;
  const cmdType = `${aggName}Command`;
  const evType = `${aggName}Event`;
  const stateTypes = new Map(agg.stateFields.map(sf => [sf.name, sf.resolvedType]));
  const aliases = new Set(agg.aliases ?? ['state', aggName.toLowerCase()]);

  // Group behaviors by command
  const behaviorByCmd = new Map();
  for (const beh of behaviors) {
    for (const rule of beh.rules) {
      const cmdName = rule.command;
      if (!behaviorByCmd.has(cmdName)) {
        behaviorByCmd.set(cmdName, { behavior: beh, rules: [] });
      }
      behaviorByCmd.get(cmdName).rules.push(rule);
    }
  }

  const clozeCmds = [];
  for (const cmd of agg.commands) {
    const entry = behaviorByCmd.get(cmd.name);
    if (entry && entry.behavior.theory.codegenChannel === 'cloze-tdd') {
      clozeCmds.push({ cmd, behavior: entry.behavior });
    }
  }

  const lines = [
    '// @generated by co-arising 2.0 (EARS-Native TypeScript Codegen — DO NOT MODIFY)',
    `// @ProvenanceId(agg:${aggName})`,
    `// canonicalSha256: ${canonicalV2.canonicalSha256}`,
    'import { dec, decAdd, decSub, decMul, decCmp, decInInterval, decFormat, decNeg } from "./exact.ts";',
    'import type { CommandOutcome, DomainRejection } from "./types.ts";',
    '',
    `export interface ${stateType} {`,
  ];

  for (const sf of agg.stateFields) {
    lines.push(`  readonly ${sf.name}: ${tsTypeOf(sf.resolvedType)};`);
  }
  lines.push('}');
  lines.push('');

  lines.push(`export function initial${aggName}State(): ${stateType} {`);
  lines.push('  return {');
  for (const sf of agg.stateFields) {
    lines.push(`    ${sf.name}: ${defaultLiteralOf(sf)},`);
  }
  lines.push('  };');
  lines.push('}');
  lines.push('');

  // Commands
  const cmdUnion = [];
  for (const cmd of agg.commands) {
    const iface = `${cmd.name}Command`;
    cmdUnion.push(iface);
    lines.push(`export interface ${iface} {`);
    lines.push(`  readonly type: ${JSON.stringify(cmd.name)};`);
    for (const p of cmd.parameters) {
      lines.push(`  readonly ${p.name}: ${tsTypeOf(p.resolvedType)};`);
    }
    lines.push('}');
    lines.push('');
  }
  lines.push(`export type ${cmdType} = ${cmdUnion.length > 0 ? cmdUnion.join(' | ') : 'never'};`);
  lines.push('');

  // Events
  const evUnion = [];
  for (const ev of agg.events) {
    const iface = `${ev.name}Event`;
    evUnion.push(iface);
    const matchingCmd = agg.commands.find(c => c.produces.includes(ev.name));
    const fields = ev.fields.length > 0 ? ev.fields : (matchingCmd?.parameters ?? []);
    lines.push(`export interface ${iface} {`);
    lines.push(`  readonly type: ${JSON.stringify(ev.name)};`);
    for (const f of fields) {
      lines.push(`  readonly ${f.name}: ${tsTypeOf(f.resolvedType)};`);
    }
    lines.push('}');
    lines.push('');
  }
  lines.push(`export type ${evType} = ${evUnion.length > 0 ? evUnion.join(' | ') : 'never'};`);
  lines.push('');

  // Cloze handler interface if any command routes to Channel 4B
  if (clozeCmds.length > 0) {
    lines.push(`export interface ${aggName}ClozeHandlers {`);
    for (const { cmd } of clozeCmds) {
      lines.push(`  readonly ${toCamel(cmd.name)}: (state: ${stateType}, cmd: ${cmd.name}Command) => CommandOutcome<${evType}>;`);
    }
    lines.push('}');
    lines.push('');
  }

  // Event Sourcing applyEvent (Contract 3)
  lines.push(`// Contract 3: Pure Event Sourcing state fold derived directly from verified EARS post:/transition`);
  lines.push(`export function apply${aggName}Event(state: ${stateType}, event: ${evType}): ${stateType} {`);
  lines.push('  switch (event.type) {');
  for (const ev of agg.events) {
    const fold = eventFolds.find(f => f.aggregate === aggName && f.event === ev.name);
    const matchingCmd = agg.commands.find(c => c.produces.includes(ev.name));
    const evFields = ev.fields.length > 0 ? ev.fields : (matchingCmd?.parameters ?? []);
    const evParamTypes = new Map(evFields.map(f => [f.name, f.resolvedType]));
    const evEnv = { aliases, stateTypes, paramTypes: evParamTypes, paramPrefix: 'event' };

    lines.push(`    case ${JSON.stringify(ev.name)}: {`);
    if (!fold || fold.assignments.length === 0) {
      lines.push('      return state;');
    } else {
      const updates = [];
      for (const assign of fold.assignments) {
        const fieldName = assign.target.segments[assign.target.segments.length - 1];
        const fieldType = stateTypes.get(fieldName);
        if (assign.target.index) {
          const keyExpr = compileValTs(assign.target.index, evEnv);
          const valScale = scaleOfType(fieldType);
          const valExpr = fieldType?.value?.kind === 'decimal'
            ? `decFormat(${compileNumTs(assign.value, evEnv)}, ${valScale})`
            : compileValTs(assign.value, evEnv);
          updates.push(`        ${fieldName}: { ...state.${fieldName}, [String(${keyExpr})]: ${valExpr} },`);
        } else {
          const valExpr = fieldType?.kind === 'decimal'
            ? `decFormat(${compileNumTs(assign.value, evEnv)}, ${scaleOfType(fieldType)})`
            : compileValTs(assign.value, evEnv);
          updates.push(`        ${fieldName}: ${valExpr},`);
        }
      }
      lines.push('      return {');
      lines.push('        ...state,');
      lines.push(...updates);
      lines.push('      };');
    }
    lines.push('    }');
  }
  lines.push('    default: return state;');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  // Pure Replay Oracle
  lines.push(`// Pure Replay Oracle for ${aggName}`);
  lines.push(`export function replay${aggName}(initial: ${stateType}, events: readonly ${evType}[]): ${stateType} {`);
  lines.push(`  return events.reduce(apply${aggName}Event, initial);`);
  lines.push('}');
  lines.push('');

  // Runtime Axiom Checker
  const allAxioms = behaviors.flatMap(b => b.axioms.filter(a => a.kind === 'invariant'));
  lines.push(`export function check${aggName}Axioms(state: ${stateType}): { readonly ok: boolean; readonly violated: readonly string[] } {`);
  lines.push('  const violated: string[] = [];');
  for (const ax of allAxioms) {
    const mapIdx = findMapIndexVarInExpr(ax.expr);
    const axEnv = { aliases, stateTypes, paramTypes: new Map(), paramPrefix: '' };
    if (mapIdx) {
      const mapPath = compilePathTs(mapIdx.mapExpr, axEnv);
      lines.push(`  // @ProvenanceId(axiom:${aggName}#${ax.id})`);
      lines.push(`  for (const ${mapIdx.indexVar} of Object.keys(${mapPath})) {`);
      lines.push(`    if (!(${compileBoolTs(ax.expr, axEnv)})) {`);
      lines.push(`      violated.push(${JSON.stringify(ax.id)});`);
      lines.push('      break;');
      lines.push('    }');
      lines.push('  }');
    } else {
      lines.push(`  // @ProvenanceId(axiom:${aggName}#${ax.id})`);
      lines.push(`  if (!(${compileBoolTs(ax.expr, axEnv)})) {`);
      lines.push(`    violated.push(${JSON.stringify(ax.id)});`);
      lines.push('  }');
    }
  }
  lines.push('  return { ok: violated.length === 0, violated };');
  lines.push('}');
  lines.push('');

  // handleCommand (DMN First-Hit for L1; Cloze delegation for L2/L3)
  const clozeParam = clozeCmds.length > 0 ? `, clozeHandlers: ${aggName}ClozeHandlers` : '';
  lines.push(`// Contract 2: DMN First-Hit deterministic command handler for ${aggName}`);
  lines.push(`export function handle${aggName}Command(state: ${stateType}, cmd: ${cmdType}${clozeParam}): CommandOutcome<${evType}> {`);
  lines.push('  switch (cmd.type) {');

  for (const cmd of agg.commands) {
    const entry = behaviorByCmd.get(cmd.name);
    lines.push(`    case ${JSON.stringify(cmd.name)}: {`);
    if (!entry) {
      lines.push(`      return { ok: false, code: "UNSPECIFIED_COMMAND", ruleId: "UNSPECIFIED" };`);
      lines.push('    }');
      continue;
    }

    if (entry.behavior.theory.codegenChannel === 'cloze-tdd') {
      lines.push(`      // Channel 4B (${entry.behavior.theory.tier} / ${entry.behavior.theory.logic}): delegated to @cloze TDD handler`);
      lines.push(`      return clozeHandlers.${toCamel(cmd.name)}(state, cmd);`);
      lines.push('    }');
      continue;
    }

    const cmdParamTypes = new Map(cmd.parameters.map(p => [p.name, p.resolvedType]));
    const cmdEnv = { aliases, stateTypes, paramTypes: cmdParamTypes, paramPrefix: 'cmd' };

    for (const rule of entry.rules) {
      const guardCode = compileBoolTs(rule.guard, cmdEnv);
      lines.push(`      // @ProvenanceId(${entry.behavior.target}#${rule.id})`);
      lines.push(`      if (${guardCode}) {`);
      const rejectAct = rule.actions.find(a => a.kind === 'reject' && a.modality === 'SHALL');
      const succeedEmpty = rule.actions.find(a => a.kind === 'succeed-empty' && a.modality === 'SHALL');
      const emitActs = rule.actions.filter(a => a.kind === 'emit' && a.modality === 'SHALL');

      if (rejectAct) {
        lines.push(`        return { ok: false, code: ${JSON.stringify(rejectAct.code)}, ruleId: ${JSON.stringify(rule.id)} };`);
      } else if (succeedEmpty && emitActs.length === 0) {
        lines.push(`        return { ok: true, events: [], ruleId: ${JSON.stringify(rule.id)} };`);
      } else {
        const eventLiterals = emitActs.map(act => {
          const prop = entry.behavior.eventPropagations.find(p => p.ruleId === rule.id && p.event === act.event);
          const fields = (prop?.bindings ?? cmd.parameters.map(p => ({ eventField: p.name, source: '@PROPAGATED', paramName: p.name })))
            .map(b => `${b.eventField}: cmd.${b.paramName ?? b.eventField}`);
          return `{ type: ${JSON.stringify(act.event)}${fields.length > 0 ? `, ${fields.join(', ')}` : ''} }`;
        });
        lines.push(`        return { ok: true, events: [${eventLiterals.join(', ')}], ruleId: ${JSON.stringify(rule.id)} };`);
      }
      lines.push('      }');
    }
    lines.push(`      return { ok: false, code: "UNMATCHED_FIRST_HIT", ruleId: "UNMATCHED" } as DomainRejection;`);
    lines.push('    }');
  }

  lines.push('  }');
  lines.push('}');
  lines.push('');

  // Keep unused-import lint happy even if an aggregate has only cloze commands
  lines.push('export const __exactRuntimeRef = { dec, decAdd, decSub, decMul, decCmp, decInInterval, decFormat, decNeg };');
  lines.push('');

  return lines.join('\n');
}

function generateAggregateClozeSkeletonTs(agg, behavior) {
  const aggName = agg.name;
  const aggSlug = toSlug(aggName);
  const slotId = toSlug(behavior.target);
  const cmdNames = [...new Set(behavior.rules.map(r => r.command).filter(Boolean))];
  const lines = [
    `// Handwritten isolation-zone @cloze implementation for ${behavior.target} (${behavior.theory.tier} / ${behavior.theory.logic})`,
    `// Edit ONLY inside the bounded @cloze slot "${slotId}" below.`,
    `import { dec, decAdd, decSub, decMul, decCmp, decInInterval, decFormat } from "../generated-scaffold/ts/${aggSlug}.behavior.ts".replace("${aggSlug}.behavior.ts", "exact.ts");`,
  ];
  // Clean direct import (avoid replace expression in import)
  lines.pop();
  lines.push('import { dec, decAdd, decSub, decMul, decCmp, decInInterval, decFormat } from "../generated-scaffold/ts/exact.ts";');
  lines.push(`import type { ${aggName}State, ${aggName}Event, ${aggName}ClozeHandlers, ${cmdNames.map(c => `${c}Command`).join(', ')} } from "../generated-scaffold/ts/${aggSlug}.behavior.ts";`);
  lines.push('import type { CommandOutcome } from "../generated-scaffold/ts/types.ts";');
  lines.push('');
  lines.push('export const __exactHelpers = { dec, decAdd, decSub, decMul, decCmp, decInInterval, decFormat };');
  lines.push('');
  lines.push(`export const ${toCamel(toPascal(behavior.target))}Cloze: ${aggName}ClozeHandlers = {`);
  for (const cmdName of cmdNames) {
    lines.push(`  ${toCamel(cmdName)}(state: ${aggName}State, cmd: ${cmdName}Command): CommandOutcome<${aggName}Event> {`);
    lines.push(`    // @cloze:start(${slotId})`);
    lines.push(`    void state;`);
    lines.push(`    void cmd;`);
    lines.push(`    throw new Error(${JSON.stringify(`CLOZE_NOT_IMPLEMENTED: ${slotId}`)});`);
    lines.push(`    // @cloze:end(${slotId})`);
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

function generateApplicationPortTs(behavior, storyStruct, canonicalV2) {
  const storyName = behavior.target;
  const pascal = toPascal(storyName);
  const lines = [
    '// @generated by co-arising 2.0 (EARS-Native Application Layer Port Contract — DO NOT MODIFY)',
    `// @ProvenanceId(story:${storyName})`,
    `// canonicalSha256: ${canonicalV2.canonicalSha256}`,
    'import type { DomainRejection } from "./types.ts";',
    '',
    `export interface ${pascal}Request {`,
    '  readonly operation: string;',
    '  readonly payload: Readonly<Record<string, unknown>>;',
    '  readonly stateSnapshot?: Readonly<Record<string, unknown>>;',
    '}',
    '',
    `export interface ${pascal}ExternPorts {`,
  ];

  for (const ext of behavior.externs) {
    const argsSig = ext.params.map(p => `${p}: unknown`).join(', ');
    lines.push(`  readonly ${ext.name}: (${argsSig}) => boolean;`);
  }
  lines.push('}');
  lines.push('');

  lines.push(`export interface ${pascal}EffectsPort {`);
  lines.push('  readonly pin: (artifact: string, inputs: Readonly<Record<string, unknown>>) => void;');
  lines.push('  readonly dispatch: (target: string, payload: Readonly<Record<string, unknown>>) => void;');
  lines.push('}');
  lines.push('');

  lines.push(`export interface ${pascal}SuccessResponse {`);
  lines.push('  readonly ok: true;');
  lines.push('  readonly ruleId: string;');
  lines.push('  readonly responseType?: string;');
  lines.push('  readonly response?: Readonly<Record<string, unknown>>;');
  lines.push('  readonly viewName?: string;');
  lines.push('  readonly view?: Readonly<Record<string, unknown>>;');
  lines.push('}');
  lines.push('');

  lines.push(`export type ${pascal}Outcome = ${pascal}SuccessResponse | DomainRejection;`);
  lines.push('');

  lines.push(`export interface ${pascal}Handler {`);
  lines.push(`  readonly handle: (req: ${pascal}Request, externs: ${pascal}ExternPorts, effects: ${pascal}EffectsPort) => ${pascal}Outcome;`);
  lines.push('}');
  lines.push('');

  if (storyStruct?.callerContract) {
    lines.push(`export const ${toCamel(pascal)}CallerContract = ${JSON.stringify(storyStruct.callerContract)} as const;`);
    lines.push('');
  }

  return lines.join('\n');
}

function generateApplicationClozeSkeletonTs(behavior) {
  const storyName = behavior.target;
  const pascal = toPascal(storyName);
  const slug = toSlug(storyName);
  return [
    `// Handwritten isolation-zone @cloze implementation for application story ${storyName}`,
    `// Edit ONLY inside the bounded @cloze slot "${slug}" below.`,
    'import { dec, decCmp } from "../generated-scaffold/ts/exact.ts";',
    `import type { ${pascal}Handler, ${pascal}Request, ${pascal}ExternPorts, ${pascal}EffectsPort, ${pascal}Outcome } from "../generated-scaffold/ts/${slug}.port.ts";`,
    '',
    'export const __appExactHelpers = { dec, decCmp };',
    '',
    `export const ${toCamel(pascal)}Handler: ${pascal}Handler = {`,
    `  handle(req: ${pascal}Request, externs: ${pascal}ExternPorts, effects: ${pascal}EffectsPort): ${pascal}Outcome {`,
    `    // @cloze:start(${slug})`,
    '    void req;',
    '    void externs;',
    '    void effects;',
    `    throw new Error(${JSON.stringify(`CLOZE_NOT_IMPLEMENTED: ${slug}`)});`,
    `    // @cloze:end(${slug})`,
    '  },',
    '};',
    '',
  ].join('\n');
}

function writeArtifact(outDir, relPath, content, { overwrite = true } = {}) {
  const dest = join(outDir, relPath);
  if (!overwrite && existsSync(dest)) {
    return { path: relPath, absPath: dest, skippedExisting: true, sha256: null };
  }
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content, 'utf8');
  return {
    path: relPath,
    absPath: dest,
    skippedExisting: false,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

export const typescriptCodegenPlugin = registerCodegenPlugin({
  target: 'typescript',
  generate(canonicalV2, { outDir, overwriteCloze = false } = {}) {
    const root = resolve(outDir);
    const written = [];

    written.push(writeArtifact(root, 'generated-scaffold/ts/exact.ts', generateExactRuntimeTs()));
    written.push(writeArtifact(root, 'generated-scaffold/ts/types.ts', generateTypesTs(canonicalV2)));

    for (const agg of canonicalV2.structures.aggregates) {
      const aggBehaviors = canonicalV2.behaviors.filter(b => b.kind === 'slice' && b.target.split('.')[0] === agg.name);
      const slug = toSlug(agg.name);
      const code = generateAggregateBehaviorTs(agg, aggBehaviors, canonicalV2.eventFolds, canonicalV2);
      written.push(writeArtifact(root, `generated-scaffold/ts/${slug}.behavior.ts`, code));

      for (const beh of aggBehaviors) {
        if (beh.theory.codegenChannel === 'cloze-tdd') {
          const slotSlug = toSlug(beh.target);
          const clozeCode = generateAggregateClozeSkeletonTs(agg, beh);
          written.push(writeArtifact(root, `handwritten/${slotSlug}.cloze.ts`, clozeCode, { overwrite: overwriteCloze }));
        }
      }
    }

    const storyMap = new Map((canonicalV2.structures.stories ?? []).map(s => [s.name, s]));
    for (const beh of canonicalV2.behaviors) {
      if (beh.layer !== 'application') continue;
      const slug = toSlug(beh.target);
      const portCode = generateApplicationPortTs(beh, storyMap.get(beh.target) ?? null, canonicalV2);
      written.push(writeArtifact(root, `generated-scaffold/ts/${slug}.port.ts`, portCode));

      const clozeCode = generateApplicationClozeSkeletonTs(beh);
      written.push(writeArtifact(root, `handwritten/${slug}.cloze.ts`, clozeCode, { overwrite: overwriteCloze }));
    }

    return {
      schemaVersion: 'co-arising.generate-v2/v1',
      target: 'typescript',
      canonicalSha256: canonicalV2.canonicalSha256,
      outDir: root,
      files: written,
    };
  },
});
