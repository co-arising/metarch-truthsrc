// Direct EARS-IR -> Scala 2.12/2.13 deterministic generator for Canonical Model v2.
// Channel 4A: zero-token L1 First-Hit guards (BigDecimal), Event Sourcing applyEvent, Pure Replay Oracle & Axioms.
// Channel 4B: typed Cloze trait + bounded @cloze:start..@cloze:end handwritten skeleton.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { registerCodegenPlugin } from './interface.mjs';
import { emitOnionArtifactsScala } from './onion-scala.mjs';
import { copyV2Scaffold } from '../scaffold-copy.mjs';
import { resolveCanonicalEventFields } from '../structure-loader.mjs';

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

function scalaTypeOf(rt) {
  if (!rt || typeof rt !== 'object') return 'Any';
  switch (rt.kind) {
    case 'int': return 'Long';
    case 'bool': return 'Boolean';
    case 'string': return 'String';
    case 'decimal': return 'BigDecimal';
    case 'map': return `Map[String, ${scalaTypeOf(rt.value)}]`;
    case 'optional': return `Option[${scalaTypeOf(rt.element)}]`;
    case 'sequence': return `Seq[${scalaTypeOf(rt.element)}]`;
    case 'record': return rt.typeName ?? 'Map[String, Any]';
    default: return 'String';
  }
}

function scalaDefaultOf(field) {
  const rt = field.resolvedType;
  if (field.defaultValue !== undefined) {
    if (rt?.kind === 'optional') {
      if (field.defaultValue === null || field.defaultValue === 'null' || field.defaultValue === 'none') return 'None';
      return `Some(${scalaDefaultOf({ resolvedType: rt.element, defaultValue: field.defaultValue })})`;
    }
    if (rt?.kind === 'map') return `Map.empty[String, ${scalaTypeOf(rt.value)}]`;
    if (rt?.kind === 'decimal') return `BigDecimal(${JSON.stringify(String(field.defaultValue))})`;
    if (rt?.kind === 'int') return `${Number(field.defaultValue)}L`;
    return JSON.stringify(field.defaultValue);
  }
  switch (rt?.kind) {
    case 'int': return '0L';
    case 'bool': return 'false';
    case 'string': return '""';
    case 'decimal': return 'BigDecimal("0.00")';
    case 'map': return `Map.empty[String, ${scalaTypeOf(rt.value)}]`;
    case 'optional': return 'None';
    case 'sequence': return 'Seq.empty';
    case 'record': {
      const args = Object.values(rt.fields ?? {}).map(v => scalaDefaultOf({ resolvedType: v })).join(', ');
      return `${rt.typeName}(${args})`;
    }
    default: return '""';
  }
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

function isNumericExpr(expr, env) {
  if (!expr) return false;
  if (expr.kind === 'number' || expr.kind === 'arith' || expr.kind === 'neg') return true;
  const t = resolveExprType(expr, env);
  return t?.kind === 'int' || t?.kind === 'decimal';
}

function compilePathScala(expr, env) {
  const segs = [];
  let cur = expr;
  while (cur.kind === 'member') {
    segs.unshift(cur.field);
    cur = cur.object;
  }
  if (cur.kind !== 'var') return '""';
  segs.unshift(cur.name);
  if (env.aliases.has(segs[0]) && segs.length > 1) {
    return `state.${segs.slice(1).join('.')}`;
  }
  if (env.paramPrefix) return `${env.paramPrefix}.${segs.join('.')}`;
  return segs.join('.');
}

function isIntExprScala(expr, env) {
  if (!expr) return false;
  if (expr.kind === 'number') return !expr.scale || expr.scale === 0;
  if (expr.kind === 'neg') return isIntExprScala(expr.argument, env);
  if (expr.kind === 'arith') return isIntExprScala(expr.left, env) && isIntExprScala(expr.right, env);
  if (expr.kind === 'call') return expr.name === 'count' || expr.name === 'len';
  const t = resolveExprType(expr, env);
  return t?.kind === 'int';
}

function compileIntScala(expr, env) {
  if (expr.kind === 'number') {
    return `${expr.value}L`;
  }
  if (expr.kind === 'neg') {
    return `(-(${compileIntScala(expr.argument, env)}))`;
  }
  if (expr.kind === 'arith') {
    return `(${compileIntScala(expr.left, env)} ${expr.op} ${compileIntScala(expr.right, env)})`;
  }
  if (expr.kind === 'index') {
    const col = compilePathScala(expr.collection, env);
    const key = compileValScala(expr.index, env);
    return `${col}.getOrElse(${key}, 0L)`;
  }
  return compileValScala(expr, env);
}

function compileNumScala(expr, env) {
  if (expr.kind === 'number') {
    return `BigDecimal(${JSON.stringify(String(expr.value))})`;
  }
  if (expr.kind === 'neg') {
    return `(-(${compileNumScala(expr.argument, env)}))`;
  }
  if (expr.kind === 'arith') {
    return `(${compileNumScala(expr.left, env)} ${expr.op} ${compileNumScala(expr.right, env)})`;
  }
  if (expr.kind === 'index') {
    const col = compilePathScala(expr.collection, env);
    const key = compileValScala(expr.index, env);
    return `${col}.getOrElse(${key}, BigDecimal("0"))`;
  }
  const t = resolveExprType(expr, env);
  const val = compileValScala(expr, env);
  if (t?.kind === 'int') return `BigDecimal(${val})`;
  return val;
}

function compileValScala(expr, env) {
  if (!expr) return '""';
  switch (expr.kind) {
    case 'boolean': return expr.value ? 'true' : 'false';
    case 'none': return 'None';
    case 'string': return JSON.stringify(expr.value);
    case 'number': return expr.scale > 0 ? `BigDecimal(${JSON.stringify(String(expr.value))})` : `${expr.value}L`;
    case 'var':
      if (env.paramPrefix && env.paramTypes.has(expr.name)) return `${env.paramPrefix}.${expr.name}`;
      return expr.name;
    case 'member': return compilePathScala(expr, env);
    case 'index': {
      const col = compilePathScala(expr.collection, env);
      const key = compileValScala(expr.index, env);
      const colType = resolveExprType(expr.collection, env);
      let fallback = '""';
      if (colType?.value?.kind === 'decimal') fallback = 'BigDecimal("0")';
      else if (colType?.value?.kind === 'int') fallback = '0L';
      return `${col}.getOrElse(${key}, ${fallback})`;
    }
    case 'arith':
    case 'neg':
      return isIntExprScala(expr, env) ? compileIntScala(expr, env) : compileNumScala(expr, env);
    case 'call': {
      if (expr.name === 'count' || expr.name === 'len') {
        return `${compileValScala(expr.args[0], env)}.size.toLong`;
      }
      if (expr.name === 'sum') {
        return `${compileValScala(expr.args[0], env)}.foldLeft(BigDecimal("0.00"))((a, b) => a + BigDecimal(b.toString))`;
      }
      return `${expr.name}(${expr.args.map(a => compileValScala(a, env)).join(', ')})`;
    }
    default:
      return compileBoolScala(expr, env);
  }
}

function compileAssignValScala(expr, targetType, env) {
  if (expr?.kind === 'none') return 'None';
  if (!targetType) return compileValScala(expr, env);
  if (targetType.kind === 'optional') {
    const exprType = resolveExprType(expr, env);
    if (exprType?.kind === 'optional') {
      return compileValScala(expr, env);
    }
    return `Some(${compileAssignValScala(expr, targetType.element, env)})`;
  }
  if (targetType.kind === 'int') {
    if (isIntExprScala(expr, env)) return compileIntScala(expr, env);
    const exprType = resolveExprType(expr, env);
    if (expr.kind === 'arith' || expr.kind === 'neg' || exprType?.kind === 'decimal') {
      return `(${compileNumScala(expr, env)}).toLong`;
    }
    return compileValScala(expr, env);
  }
  if (targetType.kind === 'decimal') {
    return compileNumScala(expr, env);
  }
  return compileValScala(expr, env);
}

function compileBoolScala(expr, env) {
  if (!expr) return 'true';
  switch (expr.kind) {
    case 'boolean': return expr.value ? 'true' : 'false';
    case 'not': return `!(${compileBoolScala(expr.argument, env)})`;
    case 'binary': {
      const op = expr.op === 'and' ? '&&' : '||';
      return `(${compileBoolScala(expr.left, env)} ${op} ${compileBoolScala(expr.right, env)})`;
    }
    case 'compare': {
      if (isNumericExpr(expr.left, env) || isNumericExpr(expr.right, env)) {
        return `(${compileNumScala(expr.left, env)} ${expr.op} ${compileNumScala(expr.right, env)})`;
      }
      return `(${compileValScala(expr.left, env)} ${expr.op} ${compileValScala(expr.right, env)})`;
    }
    case 'in': {
      if (expr.target.kind === 'interval') {
        const el = compileNumScala(expr.element, env);
        const min = compileNumScala(expr.target.min, env);
        const max = compileNumScala(expr.target.max, env);
        const loOp = expr.target.leftInclusive ? '>=' : '>';
        const hiOp = expr.target.rightInclusive ? '<=' : '<';
        return `((${el} ${loOp} ${min}) && (${el} ${hiOp} ${max}))`;
      }
      if (expr.target.kind === 'set') {
        const el = compileValScala(expr.element, env);
        const items = expr.target.elements.map(e => compileValScala(e, env)).join(', ');
        return `Set(${items}).contains(${el})`;
      }
      const col = compilePathScala(expr.target, env);
      const key = compileValScala(expr.element, env);
      return `${col}.contains(${key})`;
    }
    case 'emptiness': {
      const target = compileValScala(expr.target, env);
      return expr.check === 'empty' ? `${target}.isEmpty` : `${target}.nonEmpty`;
    }
    case 'quantifier': {
      const col = compileValScala(expr.collection, env);
      const innerEnv = { ...env, paramTypes: new Map(env.paramTypes) };
      innerEnv.paramTypes.delete(expr.variable);
      const body = compileBoolScala(expr.body, innerEnv);
      const method = expr.quantifier === 'forall' ? 'forall' : 'exists';
      return `${col}.${method}(${expr.variable} => ${body})`;
    }
    default:
      return compileValScala(expr, env);
  }
}

function findMapIndexVar(expr) {
  if (!expr || typeof expr !== 'object') return null;
  if (expr.kind === 'index' && expr.index?.kind === 'var') {
    return { mapExpr: expr.collection, indexVar: expr.index.name };
  }
  for (const k of ['left', 'right', 'argument', 'element', 'target', 'min', 'max']) {
    const found = findMapIndexVar(expr[k]);
    if (found) return found;
  }
  return null;
}

function generateScalaTypes(canonicalV2, packageName) {
  const lines = [
    '// @generated by co-arising 2.0 (EARS-Native Scala Codegen — DO NOT MODIFY)',
    `// canonicalSha256: ${canonicalV2.canonicalSha256}`,
    `package ${packageName}`,
    '',
    'final case class DomainRejection(code: String, ruleId: String)',
    'final case class CommandAccepted[E](events: Seq[E], ruleId: String)',
    '',
  ];

  for (const ex of canonicalV2.structures.exactTypes) {
    if (ex.form === 'unit-decimal') {
      const amt = ex.amountField ?? 'amount';
      const unit = ex.unitField ?? 'currency';
      lines.push(`// @ProvenanceId(exact:${ex.name})`);
      lines.push(`final case class ${ex.name}(${amt}: BigDecimal, ${unit}: String)`);
    }
  }
  for (const vo of canonicalV2.structures.valueObjects) {
    const params = vo.fields.map(f => `${f.name}: ${scalaTypeOf(f.resolvedType)}`).join(', ');
    lines.push(`// @ProvenanceId(vo:${vo.name})`);
    lines.push(`final case class ${vo.name}(${params})`);
  }
  lines.push('');
  return lines.join('\n');
}

function buildScalaFoldUpdates(assignments, stateTypes, evEnv) {
  const flatUpdates = [];
  const nestedByRoot = new Map(); // rootField -> [{ subSegs, value, targetIndex }]

  for (const assign of assignments) {
    const segs = assign.target.segments;
    const pathSegs = segs.length > 1 && segs[0] === 'state' ? segs.slice(1) : segs;
    if (pathSegs.length === 1) {
      const fieldName = pathSegs[0];
      const fieldType = stateTypes.get(fieldName) ?? null;
      if (assign.target.index) {
        const keyExpr = compileValScala(assign.target.index, evEnv);
        const elemType = fieldType?.kind === 'map' ? fieldType.value : null;
        const valExpr = compileAssignValScala(assign.value, elemType, evEnv);
        flatUpdates.push(`${fieldName} = state.${fieldName}.updated(${keyExpr}, ${valExpr})`);
      } else {
        flatUpdates.push(`${fieldName} = ${compileAssignValScala(assign.value, fieldType, evEnv)}`);
      }
    } else if (pathSegs.length > 1) {
      const rootField = pathSegs[0];
      if (!nestedByRoot.has(rootField)) nestedByRoot.set(rootField, []);
      nestedByRoot.get(rootField).push({
        subSegs: pathSegs.slice(1),
        value: assign.value,
        index: assign.target.index,
      });
    }
  }

  const buildNestedCopy = (ownerExpr, ownerType, entries) => {
    const leafParts = [];
    const deeper = new Map();
    for (const e of entries) {
      const [head, ...rest] = e.subSegs;
      const childType = ownerType?.kind === 'record' ? ownerType.fields?.[head] : null;
      if (rest.length === 0) {
        if (e.index) {
          const kExpr = compileValScala(e.index, evEnv);
          const vExpr = compileAssignValScala(e.value, childType?.kind === 'map' ? childType.value : null, evEnv);
          leafParts.push(`${head} = ${ownerExpr}.${head}.updated(${kExpr}, ${vExpr})`);
        } else {
          leafParts.push(`${head} = ${compileAssignValScala(e.value, childType, evEnv)}`);
        }
      } else {
        if (!deeper.has(head)) deeper.set(head, { type: childType, list: [] });
        deeper.get(head).list.push({ subSegs: rest, value: e.value, index: e.index });
      }
    }
    for (const [childField, info] of deeper) {
      leafParts.push(`${childField} = ${buildNestedCopy(`${ownerExpr}.${childField}`, info.type, info.list)}`);
    }
    return `${ownerExpr}.copy(${leafParts.join(', ')})`;
  };

  for (const [rootField, entries] of nestedByRoot) {
    const rootType = stateTypes.get(rootField) ?? null;
    flatUpdates.push(`${rootField} = ${buildNestedCopy(`state.${rootField}`, rootType, entries)}`);
  }

  return flatUpdates;
}

function compileEventBindingArgScala(b) {
  if (b.source === '@CONSTANT') {
    return scalaDefaultOf({ resolvedType: b.eventFieldType, defaultValue: b.constValue });
  }
  const rawRef = b.source === '@FROM_STATE'
    ? `state.${b.stateField}`
    : `cmd.${b.paramName ?? b.eventField}`;
  if (b.eventFieldType?.kind === 'optional' && b.sourceType && b.sourceType.kind !== 'optional') {
    return `Some(${rawRef})`;
  }
  return rawRef;
}

function generateScalaAggregate(agg, behaviors, eventFolds, canonicalV2, packageName) {
  const aggName = agg.name;
  const stateType = `${aggName}State`;
  const cmdType = `${aggName}Command`;
  const evType = `${aggName}Event`;
  const stateTypes = new Map(agg.stateFields.map(sf => [sf.name, sf.resolvedType]));
  const aliases = new Set(agg.aliases ?? ['state', aggName.toLowerCase()]);

  const behaviorByCmd = new Map();
  for (const beh of behaviors) {
    for (const rule of beh.rules) {
      if (!behaviorByCmd.has(rule.command)) behaviorByCmd.set(rule.command, { behavior: beh, rules: [] });
      behaviorByCmd.get(rule.command).rules.push(rule);
    }
  }

  const clozeCmds = agg.commands.filter(c => behaviorByCmd.get(c.name)?.behavior.theory.codegenChannel === 'cloze-tdd');

  const lines = [
    '// @generated by co-arising 2.0 (EARS-Native Scala Codegen — DO NOT MODIFY)',
    `// @ProvenanceId(agg:${aggName})`,
    `// canonicalSha256: ${canonicalV2.canonicalSha256}`,
    `package ${packageName}`,
    '',
    `final case class ${stateType}(`,
    ...agg.stateFields.map((sf, i) => `  ${sf.name}: ${scalaTypeOf(sf.resolvedType)} = ${scalaDefaultOf(sf)}${i + 1 < agg.stateFields.length ? ',' : ''}`),
    ')',
    '',
    `sealed trait ${cmdType}`,
  ];

  for (const cmd of agg.commands) {
    const params = cmd.parameters.map(p => `${p.name}: ${scalaTypeOf(p.resolvedType)}`).join(', ');
    lines.push(`final case class ${cmd.name}(${params}) extends ${cmdType}`);
  }
  lines.push('');
  lines.push(`sealed trait ${evType}`);
  for (const ev of agg.events) {
    const fields = resolveCanonicalEventFields(agg, ev);
    const params = fields.map(f => `${f.name}: ${scalaTypeOf(f.resolvedType)}`).join(', ');
    lines.push(`final case class ${ev.name}(${params}) extends ${evType}`);
  }
  lines.push('');

  if (clozeCmds.length > 0) {
    lines.push(`trait ${aggName}ClozeHandlers {`);
    for (const cmd of clozeCmds) {
      lines.push(`  def ${toCamel(cmd.name)}(state: ${stateType}, cmd: ${cmd.name}): Either[DomainRejection, CommandAccepted[${evType}]]`);
    }
    lines.push('}');
    lines.push('');
  }

  lines.push(`object ${aggName}Behavior {`);
  lines.push(`  val initialState: ${stateType} = ${stateType}()`);
  lines.push('');

  // applyEvent
  lines.push(`  def applyEvent(state: ${stateType}, event: ${evType}): ${stateType} = event match {`);
  for (const ev of agg.events) {
    const fold = eventFolds.find(f => f.aggregate === aggName && f.event === ev.name);
    const evFields = resolveCanonicalEventFields(agg, ev);
    const evEnv = { aliases, stateTypes, paramTypes: new Map(evFields.map(f => [f.name, f.resolvedType])), paramPrefix: 'ev' };
    if (!fold || fold.assignments.length === 0) {
      lines.push(`    case _: ${ev.name} => state`);
    } else {
      const updates = buildScalaFoldUpdates(fold.assignments, stateTypes, evEnv);
      lines.push(`    case ev: ${ev.name} => state.copy(${updates.join(', ')})`);
    }
  }
  lines.push('  }');
  lines.push('');

  // Pure Replay Oracle
  lines.push(`  def replay(initial: ${stateType}, events: Seq[${evType}]): ${stateType} =`);
  lines.push('    events.foldLeft(initial)(applyEvent)');
  lines.push('');

  // checkAxioms
  const allAxioms = behaviors.flatMap(b => b.axioms.filter(a => a.kind === 'invariant'));
  lines.push(`  def checkAxioms(state: ${stateType}): Seq[String] = {`);
  lines.push('    val violated = scala.collection.mutable.ListBuffer.empty[String]');
  for (const ax of allAxioms) {
    const mapIdx = findMapIndexVar(ax.expr);
    const axEnv = { aliases, stateTypes, paramTypes: new Map(), paramPrefix: '' };
    if (mapIdx) {
      const mapPath = compilePathScala(mapIdx.mapExpr, axEnv);
      lines.push(`    // @ProvenanceId(axiom:${aggName}#${ax.id})`);
      lines.push(`    if (${mapPath}.keys.exists(${mapIdx.indexVar} => !(${compileBoolScala(ax.expr, axEnv)}))) violated += ${JSON.stringify(ax.id)}`);
    } else {
      lines.push(`    // @ProvenanceId(axiom:${aggName}#${ax.id})`);
      lines.push(`    if (!(${compileBoolScala(ax.expr, axEnv)})) violated += ${JSON.stringify(ax.id)}`);
    }
  }
  lines.push('    violated.toSeq');
  lines.push('  }');
  lines.push('');

  // handleCommand
  const clozeParam = clozeCmds.length > 0 ? `, clozeHandlers: ${aggName}ClozeHandlers` : '';
  lines.push(`  def handleCommand(state: ${stateType}, command: ${cmdType}${clozeParam}): Either[DomainRejection, CommandAccepted[${evType}]] = command match {`);
  for (const cmd of agg.commands) {
    const entry = behaviorByCmd.get(cmd.name);
    lines.push(`    case cmd: ${cmd.name} =>`);
    if (!entry) {
      lines.push('      Left(DomainRejection("UNSPECIFIED_COMMAND", "UNSPECIFIED"))');
      continue;
    }
    if (entry.behavior.theory.codegenChannel === 'cloze-tdd') {
      lines.push(`      clozeHandlers.${toCamel(cmd.name)}(state, cmd)`);
      continue;
    }
    const cmdEnv = { aliases, stateTypes, paramTypes: new Map(cmd.parameters.map(p => [p.name, p.resolvedType])), paramPrefix: 'cmd' };
    entry.rules.forEach((rule, idx) => {
      const kw = idx === 0 ? 'if' : 'else if';
      const guardCode = compileBoolScala(rule.guard, cmdEnv);
      const rejectAct = rule.actions.find(a => a.kind === 'reject' && a.modality === 'SHALL');
      const succeedEmpty = rule.actions.find(a => a.kind === 'succeed-empty' && a.modality === 'SHALL');
      const emitActs = rule.actions.filter(a => a.kind === 'emit' && a.modality === 'SHALL');

      lines.push(`      // @ProvenanceId(${entry.behavior.target}#${rule.id})`);
      if (rejectAct) {
        lines.push(`      ${kw} (${guardCode}) Left(DomainRejection(${JSON.stringify(rejectAct.code)}, ${JSON.stringify(rule.id)}))`);
      } else if (succeedEmpty && emitActs.length === 0) {
        lines.push(`      ${kw} (${guardCode}) Right(CommandAccepted(Seq.empty, ${JSON.stringify(rule.id)}))`);
      } else {
        const evs = emitActs.map(act => {
          const prop = entry.behavior.eventPropagations.find(p => p.ruleId === rule.id && p.event === act.event);
          const args = (prop?.bindings ?? cmd.parameters.map(p => ({ eventField: p.name, source: '@PROPAGATED', paramName: p.name })))
            .map(compileEventBindingArgScala)
            .join(', ');
          return `${act.event}(${args})`;
        });
        lines.push(`      ${kw} (${guardCode}) Right(CommandAccepted(Seq(${evs.join(', ')}), ${JSON.stringify(rule.id)}))`);
      }
    });
    lines.push('      else Left(DomainRejection("UNMATCHED_FIRST_HIT", "UNMATCHED"))');
  }
  lines.push('  }');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

function generateScalaClozeSkeleton(agg, behavior, packageName) {
  const aggName = agg.name;
  const slotId = toSlug(behavior.target);
  const className = `${toPascal(behavior.target)}Cloze`;
  const cmdNames = [...new Set(behavior.rules.map(r => r.command).filter(Boolean))];
  const lines = [
    `// Handwritten isolation-zone @cloze implementation for ${behavior.target} (${behavior.theory.tier} / ${behavior.theory.logic})`,
    `// Edit ONLY inside the bounded @cloze slot "${slotId}" below.`,
    `package ${packageName}`,
    '',
    `object ${className} extends ${aggName}ClozeHandlers {`,
  ];
  for (const cmdName of cmdNames) {
    lines.push(`  override def ${toCamel(cmdName)}(state: ${aggName}State, cmd: ${cmdName}): Either[DomainRejection, CommandAccepted[${aggName}Event]] = {`);
    lines.push(`    // @cloze:start(${slotId})`);
    lines.push(`    throw new UnsupportedOperationException(${JSON.stringify(`CLOZE_NOT_IMPLEMENTED: ${slotId}`)})`);
    lines.push(`    // @cloze:end(${slotId})`);
    lines.push('  }');
  }
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

function generateScalaApplicationPort(behavior, storyStruct, canonicalV2, packageName) {
  const storyName = behavior.target;
  const pascal = toPascal(storyName);
  const lines = [
    '// @generated by co-arising 2.0 (EARS-Native Scala Application Port Contract — DO NOT MODIFY)',
    `// @ProvenanceId(story:${storyName})`,
    `// canonicalSha256: ${canonicalV2.canonicalSha256}`,
    `package ${packageName}`,
    '',
    `final case class ${pascal}Request(`,
    '  operation: String,',
    '  payload: Map[String, Any],',
    '  stateSnapshot: Map[String, Any] = Map.empty',
    ')',
    '',
    `trait ${pascal}ExternPorts {`,
  ];

  for (const ext of behavior.externs) {
    const argsSig = (ext.params ?? []).map(p => `${p}: Any`).join(', ');
    lines.push(`  def ${ext.name}(${argsSig}): Boolean`);
  }
  lines.push('}');
  lines.push('');

  lines.push(`trait ${pascal}EffectsPort {`);
  lines.push('  def pin(artifact: String, inputs: Map[String, Any]): Unit');
  lines.push('  def dispatch(target: String, payload: Map[String, Any]): Unit');
  lines.push('}');
  lines.push('');

  lines.push(`final case class ${pascal}SuccessResponse(`);
  lines.push('  ruleId: String,');
  lines.push('  responseType: Option[String] = None,');
  lines.push('  response: Map[String, Any] = Map.empty,');
  lines.push('  viewName: Option[String] = None,');
  lines.push('  view: Map[String, Any] = Map.empty');
  lines.push(')');
  lines.push('');

  lines.push(`trait ${pascal}Handler {`);
  lines.push(`  def handle(req: ${pascal}Request, externs: ${pascal}ExternPorts, effects: ${pascal}EffectsPort): Either[DomainRejection, ${pascal}SuccessResponse]`);
  lines.push('}');
  lines.push('');

  if (storyStruct?.callerContract) {
    lines.push(`object ${pascal}CallerContract {`);
    lines.push(`  val contractJson: String = ${JSON.stringify(JSON.stringify(storyStruct.callerContract))}`);
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

function generateScalaApplicationClozeSkeleton(behavior, packageName) {
  const storyName = behavior.target;
  const pascal = toPascal(storyName);
  const slug = toSlug(storyName);
  return [
    `// Handwritten isolation-zone @cloze implementation for application story ${storyName}`,
    `// Edit ONLY inside the bounded @cloze slot "${slug}" below.`,
    `package ${packageName}`,
    '',
    `object ${pascal}Cloze extends ${pascal}Handler {`,
    `  override def handle(req: ${pascal}Request, externs: ${pascal}ExternPorts, effects: ${pascal}EffectsPort): Either[DomainRejection, ${pascal}SuccessResponse] = {`,
    `    // @cloze:start(${slug})`,
    `    throw new UnsupportedOperationException(${JSON.stringify(`CLOZE_NOT_IMPLEMENTED: ${slug}`)})`,
    `    // @cloze:end(${slug})`,
    '  }',
    '}',
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

export const scalaCodegenPlugin = registerCodegenPlugin({
  target: 'scala',
  generate(canonicalV2, { outDir, packageName = 'example.v2', overwriteCloze = false, withScaffold = false, forceScaffold = false } = {}) {
    const root = resolve(outDir);
    const pkgDir = packageName.split('.').join('/');
    const written = [];

    if (withScaffold) {
      copyV2Scaffold({ targetDir: root, canonicalV2, targets: ['scala'], packageName, force: forceScaffold });
    }

    written.push(writeArtifact(root, `generated-scaffold/scala/${pkgDir}/DomainTypes.scala`, generateScalaTypes(canonicalV2, packageName)));

    for (const agg of canonicalV2.structures.aggregates) {
      const aggBehaviors = canonicalV2.behaviors.filter(b => b.kind === 'slice' && b.target.split('.')[0] === agg.name);
      const code = generateScalaAggregate(agg, aggBehaviors, canonicalV2.eventFolds, canonicalV2, packageName);
      written.push(writeArtifact(root, `generated-scaffold/scala/${pkgDir}/${agg.name}Behavior.scala`, code));

      for (const beh of aggBehaviors) {
        if (beh.theory.codegenChannel === 'cloze-tdd') {
          const clozeCode = generateScalaClozeSkeleton(agg, beh, packageName);
          written.push(writeArtifact(root, `handwritten/scala/${pkgDir}/${toPascal(beh.target)}Cloze.scala`, clozeCode, { overwrite: overwriteCloze }));
        }
      }
    }

    const storyMap = new Map((canonicalV2.structures.stories ?? []).map(s => [s.name, s]));
    for (const beh of canonicalV2.behaviors.filter(b => b.layer === 'application')) {
      const pascal = toPascal(beh.target);
      const storyStruct = storyMap.get(beh.target) ?? null;
      const portCode = generateScalaApplicationPort(beh, storyStruct, canonicalV2, packageName);
      written.push(writeArtifact(root, `generated-scaffold/scala/${pkgDir}/${pascal}Port.scala`, portCode));
      const clozeCode = generateScalaApplicationClozeSkeleton(beh, packageName);
      written.push(writeArtifact(root, `handwritten/scala/${pkgDir}/${pascal}Cloze.scala`, clozeCode, { overwrite: overwriteCloze }));
    }

    // Onion 5-layer artifacts: domain/, application/, interfaces/, infrastructure/, modules/
    for (const art of emitOnionArtifactsScala(canonicalV2, packageName)) {
      written.push(writeArtifact(root, art.path, art.content));
    }

    return {
      schemaVersion: 'co-arising.generate-v2/v1',
      target: 'scala',
      packageName,
      canonicalSha256: canonicalV2.canonicalSha256,
      outDir: root,
      files: written,
    };
  },
});
