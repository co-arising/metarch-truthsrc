// Full-chain Data Lineage & Type-Consistency Engine for co-arising 2.0:
//   1. (State, Command) -> List[Event]: field source classification (@PROPAGATED, @FROM_STATE, @CONSTANT, derived/context) + type check across ALL tiers
//   2. (State, Event) -> State: event-typed post:/transition fold verification + multi-event disambiguation
//   3. Application Story -> Domain Command (dispatch): cross-layer parameter lineage & type verification
//   4. System-wide lineage coverage audit (unspecified commands, unemitted events, unused produces, unconsumed event fields, dead state fields)
import { createHash } from 'node:crypto';
import { formatType, isTypeCompatible, validateDefaultValue } from '../ears/type-compat.mjs';
import { inferExprType } from '../ears/binder.mjs';
import { resolveCanonicalEventFields } from './structure-loader.mjs';

export function collectExprPathRoots(expr, out = [], boundVars = new Set()) {
  if (!expr || typeof expr !== 'object') return out;
  if (expr.kind === 'var') {
    if (!boundVars.has(expr.name)) out.push([expr.name]);
    return out;
  }
  if (expr.kind === 'member') {
    const chain = [];
    let cur = expr;
    while (cur.kind === 'member') {
      chain.unshift(cur.field);
      cur = cur.object;
    }
    if (cur.kind === 'var') {
      if (!boundVars.has(cur.name)) {
        chain.unshift(cur.name);
        out.push(chain);
      }
    } else {
      collectExprPathRoots(cur, out, boundVars);
    }
    return out;
  }
  if (expr.kind === 'index') {
    collectExprPathRoots(expr.collection, out, boundVars);
    collectExprPathRoots(expr.index, out, boundVars);
    return out;
  }
  if (expr.kind === 'quantifier') {
    collectExprPathRoots(expr.collection, out, boundVars);
    const innerBound = new Set(boundVars);
    innerBound.add(expr.variable);
    collectExprPathRoots(expr.body, out, innerBound);
    return out;
  }
  for (const key of ['left', 'right', 'argument', 'element', 'target', 'min', 'max']) {
    if (expr[key]) collectExprPathRoots(expr[key], out, boundVars);
  }
  for (const key of ['elements', 'args']) {
    if (Array.isArray(expr[key])) {
      for (const item of expr[key]) collectExprPathRoots(item, out, boundVars);
    }
  }
  return out;
}

function parseExplicitConstValue(raw) {
  const trimmed = raw.trim();
  if (trimmed === 'none' || trimmed === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (/^-?\d+$/u.test(trimmed)) return Number(trimmed);
  return trimmed;
}

export function buildEventPropagations(spec, aggregateStruct) {
  if (!aggregateStruct) return [];
  const cmdMap = new Map(aggregateStruct.commands.map(c => [c.name, c]));
  const evMap = new Map(aggregateStruct.events.map(e => [e.name, e]));
  const stateMap = new Map(aggregateStruct.stateFields.map(s => [s.name, s]));
  const propagations = [];

  for (const rule of spec.rules) {
    const cmd = cmdMap.get(rule.command);
    if (!cmd) continue;
    const paramMap = new Map(cmd.parameters.map(p => [p.name, p]));
    for (const act of rule.actions) {
      if (act.kind !== 'emit' || act.modality !== 'SHALL') continue;
      const ev = evMap.get(act.event);
      const fields = resolveCanonicalEventFields(aggregateStruct, ev);
      const bindings = fields.map(f => {
        if (f.source) {
          const src = f.source.trim();
          if (src.startsWith('cmd.')) {
            const pName = src.slice(4).trim();
            const param = paramMap.get(pName);
            return {
              eventField: f.name,
              source: '@PROPAGATED',
              paramName: pName,
              stateField: null,
              explicitSource: src,
              sourceType: param?.resolvedType ?? null,
              eventFieldType: f.resolvedType,
              type: f.type,
            };
          }
          if (src.startsWith('state.')) {
            const sName = src.slice(6).trim();
            const sf = stateMap.get(sName);
            return {
              eventField: f.name,
              source: '@FROM_STATE',
              paramName: null,
              stateField: sName,
              explicitSource: src,
              sourceType: sf?.resolvedType ?? null,
              eventFieldType: f.resolvedType,
              type: f.type,
            };
          }
          if (src.startsWith('const:')) {
            const constValue = parseExplicitConstValue(src.slice(6));
            return {
              eventField: f.name,
              source: '@CONSTANT',
              paramName: null,
              stateField: null,
              constValue,
              explicitSource: src,
              sourceType: null,
              eventFieldType: f.resolvedType,
              type: f.type,
            };
          }
          if (src === 'derived' || src === 'context') {
            return {
              eventField: f.name,
              source: src === 'context' ? '@CONTEXT' : 'derived',
              paramName: null,
              stateField: null,
              explicitSource: src,
              sourceType: null,
              eventFieldType: f.resolvedType,
              type: f.type,
            };
          }
          return {
            eventField: f.name,
            source: '@INVALID_SOURCE',
            paramName: null,
            stateField: null,
            explicitSource: src,
            sourceType: null,
            eventFieldType: f.resolvedType,
            type: f.type,
          };
        }

        if (paramMap.has(f.name)) {
          return {
            eventField: f.name,
            source: '@PROPAGATED',
            paramName: f.name,
            stateField: null,
            sourceType: paramMap.get(f.name).resolvedType,
            eventFieldType: f.resolvedType,
            type: f.type,
          };
        }
        if (stateMap.has(f.name)) {
          return {
            eventField: f.name,
            source: '@FROM_STATE',
            paramName: null,
            stateField: f.name,
            sourceType: stateMap.get(f.name).resolvedType,
            eventFieldType: f.resolvedType,
            type: f.type,
          };
        }
        return {
          eventField: f.name,
          source: 'derived',
          paramName: null,
          stateField: null,
          sourceType: null,
          eventFieldType: f.resolvedType,
          type: f.type,
        };
      });

      propagations.push({
        ruleId: rule.id,
        command: cmd.name,
        event: act.event,
        bindings,
      });
    }
  }
  return propagations;
}

function traverseType(startType, segs) {
  let cur = startType;
  for (const seg of segs) {
    if (cur?.kind === 'record' && cur.fields?.[seg]) {
      cur = cur.fields[seg];
    } else if (cur?.kind === 'optional' && cur.element?.kind === 'record' && cur.element.fields?.[seg]) {
      cur = cur.element.fields[seg];
    } else {
      return { ok: false, missingSeg: seg, type: { kind: 'unknown' } };
    }
  }
  return { ok: true, type: cur };
}

function resolveStateFieldTargetType(targetSegments, agg, aliases) {
  if (!agg || !Array.isArray(targetSegments) || targetSegments.length === 0) return null;
  const startIdx = aliases.has(targetSegments[0]) && targetSegments.length > 1 ? 1 : 0;
  const rootName = targetSegments[startIdx];
  const sf = agg.stateFields.find(f => f.name === rootName);
  if (!sf) return null;
  const trav = traverseType(sf.resolvedType, targetSegments.slice(startIdx + 1));
  return trav.ok ? trav.type : null;
}

function isFoldAssignmentCompatible(valType, targetType) {
  if (!valType || !targetType || valType.kind === 'unknown' || targetType.kind === 'unknown') return true;
  if (isTypeCompatible(valType, targetType, { allowOptionalWrap: true, allowNumericPromotion: false, exactScale: false })) {
    return true;
  }
  const unwrapped = targetType.kind === 'optional' ? targetType.element : targetType;
  return valType.kind === 'int' && unwrapped?.kind === 'decimal';
}

function verifyAssignmentAgainstEvent({
  assign,
  agg,
  aliases,
  evName,
  evFieldMap,
  ruleId,
  behTarget,
  loc,
  diagnostics,
  consumedEventFields,
}) {
  const roots = [];
  if (assign.target?.index) collectExprPathRoots(assign.target.index, roots);
  collectExprPathRoots(assign.value, roots);

  const reportedMissing = new Set();
  for (const chain of roots) {
    if (chain.length === 0) continue;
    if (chain.length > 1 && aliases.has(chain[0])) continue;
    const rootName = chain[0];
    if (!evFieldMap.has(rootName)) {
      if (!reportedMissing.has(rootName)) {
        reportedMissing.add(rootName);
        diagnostics.push({
          severity: 'error',
          code: 'V2_POST_EVENT_FIELD_MISSING',
          ...(loc.file ? { file: loc.file } : {}),
          ...(loc.span ? { span: loc.span } : {}),
          target: behTarget,
          message: `post: assignment in rule [${ruleId}] references "${rootName}", which is not carried by emitted event "${agg.name}.${evName}" (add "${rootName}" to event "${evName}" fields so applyEvent can replay it)`,
        });
      }
      continue;
    }

    consumedEventFields.add(`${agg.name}.${evName}.${rootName}`);

    if (chain.length > 1) {
      const trav = traverseType(evFieldMap.get(rootName), chain.slice(1));
      if (!trav.ok) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_POST_EVENT_TYPE_MISMATCH',
          ...(loc.file ? { file: loc.file } : {}),
          ...(loc.span ? { span: loc.span } : {}),
          target: behTarget,
          message: `post: assignment in rule [${ruleId}] accesses "${chain.join('.')}", but event "${agg.name}.${evName}" field "${rootName}" (${formatType(evFieldMap.get(rootName))}) has no member "${trav.missingSeg}"`,
        });
      }
    }
  }

  // Re-evaluate RHS type under the EMITTED EVENT's field types (catching cmd vs event type divergence!)
  const eventLookup = chain => {
    if (chain.length === 0) return null;
    if (chain.length > 1 && aliases.has(chain[0])) {
      return resolveStateFieldTargetType(chain, agg, aliases);
    }
    if (evFieldMap.has(chain[0])) {
      const trav = traverseType(evFieldMap.get(chain[0]), chain.slice(1));
      return trav.ok ? trav.type : null;
    }
    return null;
  };

  let targetType = resolveStateFieldTargetType(assign.target?.segments, agg, aliases);
  if (assign.target?.index && targetType?.kind === 'map') {
    const idxType = inferExprType(assign.target.index, eventLookup);
    if (idxType.kind !== 'unknown' && !isTypeCompatible(idxType, targetType.key, { allowNumericPromotion: false })) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_POST_EVENT_TYPE_MISMATCH',
        ...(loc.file ? { file: loc.file } : {}),
        ...(loc.span ? { span: loc.span } : {}),
        target: behTarget,
        message: `post: map index in rule [${ruleId}] evaluates to ${formatType(idxType)} under event "${agg.name}.${evName}", incompatible with key type ${formatType(targetType.key)}`,
      });
    }
    targetType = targetType.value;
  }

  const rhsType = inferExprType(assign.value, eventLookup);
  if (targetType && rhsType.kind !== 'unknown' && !isFoldAssignmentCompatible(rhsType, targetType)) {
    diagnostics.push({
      severity: 'error',
      code: 'V2_POST_EVENT_TYPE_MISMATCH',
      ...(loc.file ? { file: loc.file } : {}),
      ...(loc.span ? { span: loc.span } : {}),
      target: behTarget,
      message: `post: assignment to "${assign.target.segments.join('.')}" (${formatType(targetType)}) in rule [${ruleId}] evaluates to ${formatType(rhsType)} under event "${agg.name}.${evName}"`,
    });
  }
}

function verifyDispatchLineage(behaviors, structures, ruleLocMap, diagnostics, coverageSeverity) {
  const aggMap = new Map((structures.aggregates ?? []).map(a => [a.name, a]));
  const storyMap = new Map((structures.stories ?? []).map(s => [s.name, s]));
  const portOpParams = new Map();
  for (const port of structures.ports ?? []) {
    for (const op of port.operations ?? []) {
      const pMap = new Map();
      for (const p of op.parameters ?? []) pMap.set(p.name, p.resolvedType);
      portOpParams.set(`${port.name}.${op.name}`, pMap);
    }
  }

  const dispatches = [];
  for (const beh of behaviors) {
    if (beh.layer !== 'application') continue;
    const story = storyMap.get(beh.target);
    const storyOwnParams = new Map((story?.parameters ?? []).map(p => [p.name, p.resolvedType]));

    for (const rule of beh.rules ?? []) {
      const loc = ruleLocMap.get(`${beh.target}#${rule.id}`) ?? {};
      const inputMap = new Map(storyOwnParams);

      if (rule.triggerKind === 'event' && rule.command) {
        const [evAggName, evName] = rule.command.split('.');
        const evAgg = aggMap.get(evAggName);
        const ev = evAgg?.events.find(e => e.name === evName);
        for (const f of resolveCanonicalEventFields(evAgg, ev)) {
          inputMap.set(f.name, f.resolvedType);
        }
      } else if (rule.command && portOpParams.has(rule.command)) {
        for (const [k, v] of portOpParams.get(rule.command)) {
          inputMap.set(k, v);
        }
      }

      for (const act of rule.actions ?? []) {
        if (act.kind !== 'dispatch' || act.modality !== 'SHALL' || !act.target) continue;
        const [aggName, cmdName] = act.target.split('.');
        const agg = aggMap.get(aggName);
        const cmd = agg?.commands.find(c => c.name === cmdName);
        if (!cmd) continue;

        const bindings = [];
        for (const param of cmd.parameters ?? []) {
          if (inputMap.has(param.name)) {
            const srcType = inputMap.get(param.name);
            const compat = isTypeCompatible(srcType, param.resolvedType, {
              allowOptionalWrap: true,
              allowNumericPromotion: false,
              exactScale: true,
              allowUnitDecimalUnwrap: true,
            });
            if (!compat) {
              diagnostics.push({
                severity: 'error',
                code: 'V2_DISPATCH_PARAM_TYPE_MISMATCH',
                ...(loc.file ? { file: loc.file } : {}),
                ...(loc.span ? { span: loc.span } : {}),
                target: beh.target,
                message: `story "${beh.target}" rule [${rule.id}] dispatches "${act.target}" whose parameter "${param.name}" expects ${formatType(param.resolvedType)}, but rule input "${param.name}" has incompatible type ${formatType(srcType)}`,
              });
            }
            bindings.push({
              param: param.name,
              source: '@PROPAGATED',
              sourceType: formatType(srcType),
              targetType: formatType(param.resolvedType),
            });
          } else {
            bindings.push({
              param: param.name,
              source: 'unbound',
              targetType: formatType(param.resolvedType),
            });
            diagnostics.push({
              severity: coverageSeverity,
              code: 'V2_LINEAGE_DISPATCH_UNBOUND_PARAM',
              ...(loc.file ? { file: loc.file } : {}),
              ...(loc.span ? { span: loc.span } : {}),
              target: beh.target,
              message: `story "${beh.target}" rule [${rule.id}] dispatches "${act.target}" requiring parameter "${param.name}: ${formatType(param.resolvedType)}", which is not directly present in trigger "${rule.command}" inputs (must be synthesized in @cloze or added to port/event schema)`,
            });
          }
        }
        dispatches.push({
          story: beh.target,
          ruleId: rule.id,
          trigger: rule.command,
          target: act.target,
          bindings,
        });
      }
    }
  }
  return dispatches;
}

export function verifyV2DataLineage(behaviors, structures, ruleLocMap = new Map(), { strictLineage = false } = {}) {
  const foldMap = new Map();
  const diagnostics = [];
  const coverageSeverity = strictLineage ? 'error' : 'warning';
  const aggMap = new Map((structures.aggregates ?? []).map(a => [a.name, a]));

  const specifiedCommands = new Set(); // "Agg.Cmd"
  const emittedEvents = new Set(); // "Agg.Event"
  const commandEmittedEvents = new Map(); // "Agg.Cmd" -> Set(EventName)
  const consumedEventFields = new Set(); // "Agg.Event.field"
  const readStateFields = new Set(); // "Agg.field"
  const writtenStateFields = new Set(); // "Agg.field"

  // Track readModel & application-event consumers for coverage completeness
  for (const rm of structures.readModels ?? []) {
    for (const f of rm.fields ?? []) {
      if (!f.source) continue;
      const src = f.source.trim();
      if (src.startsWith('eventField:')) {
        const parts = src.slice('eventField:'.length).trim().split('.');
        if (parts.length === 3) {
          consumedEventFields.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
        } else if (parts.length === 2 && rm.sourceAggregate) {
          consumedEventFields.add(`${rm.sourceAggregate}.${parts[0]}.${parts[1]}`);
        } else if (parts.length === 2) {
          for (const agg of structures.aggregates ?? []) {
            if (agg.events.some(e => e.name === parts[0])) {
              consumedEventFields.add(`${agg.name}.${parts[0]}.${parts[1]}`);
            }
          }
        }
      } else if (src.startsWith('stateField:')) {
        const parts = src.slice('stateField:'.length).trim().split('.');
        if (parts.length === 2) readStateFields.add(`${parts[0]}.${parts[1]}`);
        else if (parts.length === 1 && rm.sourceAggregate) readStateFields.add(`${rm.sourceAggregate}.${parts[0]}`);
      }
    }
  }

  for (const beh of behaviors) {
    if (beh.layer === 'application') {
      for (const rule of beh.rules ?? []) {
        const guardRoots = collectExprPathRoots(rule.guard);
        if (rule.triggerKind === 'event' && rule.command) {
          const [evAggName, evName] = rule.command.split('.');
          for (const chain of guardRoots) {
            if (chain.length > 0) consumedEventFields.add(`${evAggName}.${evName}.${chain[0]}`);
          }
        }
        for (const chain of guardRoots) {
          if (chain.length < 2) continue;
          for (const agg of structures.aggregates ?? []) {
            if ((agg.aliases ?? []).includes(chain[0]) && chain[0] !== 'state') {
              readStateFields.add(`${agg.name}.${chain[1]}`);
            }
          }
        }
      }
      continue;
    }

    if (beh.kind !== 'slice') continue;
    const aggName = beh.target.split('.')[0];
    const agg = aggMap.get(aggName);
    if (!agg) continue;
    const aliases = new Set(agg.aliases ?? ['state']);
    const cmdMap = new Map((agg.commands ?? []).map(c => [c.name, c]));
    const evMap = new Map((agg.events ?? []).map(e => [e.name, e]));

    // Track state reads in axioms
    for (const ax of beh.axioms ?? []) {
      if (ax.kind === 'invariant') {
        for (const chain of collectExprPathRoots(ax.expr)) {
          if (chain.length > 1 && aliases.has(chain[0])) readStateFields.add(`${aggName}.${chain[1]}`);
        }
      }
    }

    // Check 1: (State, Command) -> Event field lineage & type check across ALL channels
    for (const prop of beh.eventPropagations ?? []) {
      const loc = ruleLocMap.get(`${beh.target}#${prop.ruleId}`) ?? {};
      const cmd = cmdMap.get(prop.command);
      if (cmd && Array.isArray(cmd.produces) && cmd.produces.length > 0 && !cmd.produces.includes(prop.event)) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_UNDECLARED_EMIT_IN_PRODUCES',
          ...(loc.file ? { file: loc.file } : {}),
          ...(loc.span ? { span: loc.span } : {}),
          target: beh.target,
          message: `rule [${prop.ruleId}] on command "${aggName}.${prop.command}" emits "${prop.event}", which is not listed in command.produces [${cmd.produces.join(', ')}]`,
        });
      }

      for (const binding of prop.bindings ?? []) {
        if (binding.source === '@INVALID_SOURCE') {
          diagnostics.push({
            severity: 'error',
            code: 'V2_INVALID_EVENT_FIELD_SOURCE',
            ...(loc.file ? { file: loc.file } : {}),
            ...(loc.span ? { span: loc.span } : {}),
            target: beh.target,
            message: `event "${aggName}.${prop.event}" field "${binding.eventField}" has invalid source "${binding.explicitSource}" (use cmd.<p>, state.<s>, const:<v>, derived, or context)`,
          });
          continue;
        }

        if (binding.source === '@PROPAGATED') {
          if (!binding.sourceType) {
            diagnostics.push({
              severity: 'error',
              code: 'V2_UNPROPAGATED_EVENT_FIELD',
              ...(loc.file ? { file: loc.file } : {}),
              ...(loc.span ? { span: loc.span } : {}),
              target: beh.target,
              message: `event "${aggName}.${prop.event}" field "${binding.eventField}" references missing command parameter "${binding.paramName}" on "${prop.command}"`,
            });
          } else if (!isTypeCompatible(binding.sourceType, binding.eventFieldType, { allowOptionalWrap: true, allowNumericPromotion: false, exactScale: true })) {
            diagnostics.push({
              severity: 'error',
              code: 'V2_EVENT_FIELD_TYPE_MISMATCH',
              ...(loc.file ? { file: loc.file } : {}),
              ...(loc.span ? { span: loc.span } : {}),
              target: beh.target,
              message: `event "${aggName}.${prop.event}" field "${binding.eventField}" (${formatType(binding.eventFieldType)}) is incompatible with command "${prop.command}" parameter "${binding.paramName}" (${formatType(binding.sourceType)})`,
            });
          }
          continue;
        }

        if (binding.source === '@FROM_STATE') {
          if (!binding.sourceType) {
            diagnostics.push({
              severity: 'error',
              code: 'V2_UNPROPAGATED_EVENT_FIELD',
              ...(loc.file ? { file: loc.file } : {}),
              ...(loc.span ? { span: loc.span } : {}),
              target: beh.target,
              message: `event "${aggName}.${prop.event}" field "${binding.eventField}" references missing state field "${binding.stateField}" on "${aggName}"`,
            });
          } else {
            readStateFields.add(`${aggName}.${binding.stateField}`);
            if (!isTypeCompatible(binding.sourceType, binding.eventFieldType, { allowOptionalWrap: true, allowNumericPromotion: false, exactScale: true })) {
              diagnostics.push({
                severity: 'error',
                code: 'V2_EVENT_FIELD_TYPE_MISMATCH',
                ...(loc.file ? { file: loc.file } : {}),
                ...(loc.span ? { span: loc.span } : {}),
                target: beh.target,
                message: `event "${aggName}.${prop.event}" field "${binding.eventField}" (${formatType(binding.eventFieldType)}) is incompatible with state field "${aggName}.${binding.stateField}" (${formatType(binding.sourceType)})`,
              });
            }
          }
          continue;
        }

        if (binding.source === '@CONSTANT') {
          const err = validateDefaultValue(binding.constValue, binding.eventFieldType);
          if (err) {
            diagnostics.push({
              severity: 'error',
              code: 'V2_EVENT_FIELD_TYPE_MISMATCH',
              ...(loc.file ? { file: loc.file } : {}),
              ...(loc.span ? { span: loc.span } : {}),
              target: beh.target,
              message: `event "${aggName}.${prop.event}" field "${binding.eventField}" constant source "${binding.explicitSource}": ${err}`,
            });
          }
          continue;
        }

        // Unpropagated / derived / context field in L1 deterministic channel cannot be synthesized automatically
        if (beh.theory.codegenChannel === 'deterministic') {
          diagnostics.push({
            severity: 'error',
            code: 'V2_UNPROPAGATED_EVENT_FIELD',
            ...(loc.file ? { file: loc.file } : {}),
            ...(loc.span ? { span: loc.span } : {}),
            target: beh.target,
            message: `event "${aggName}.${prop.event}" emitted by rule [${prop.ruleId}] on command "${prop.command}" requires field "${binding.eventField}", which is not declared in "${prop.command}" parameters or "${aggName}" stateFields (add "${binding.eventField}" to command parameters, declare source: state.<f>/const:<v>, or align field names)`,
          });
        }
      }
    }

    // Check 2: (State, Event) -> State fold verification
    for (const rule of beh.rules) {
      const loc = ruleLocMap.get(`${beh.target}#${rule.id}`) ?? {};
      if (rule.command) {
        specifiedCommands.add(`${aggName}.${rule.command}`);
      }
      for (const chain of collectExprPathRoots(rule.guard)) {
        if (chain.length > 1 && aliases.has(chain[0])) readStateFields.add(`${aggName}.${chain[1]}`);
      }

      const emitted = rule.actions.filter(a => a.kind === 'emit' && a.modality === 'SHALL');
      const hasReject = rule.actions.some(a => a.kind === 'reject' && a.modality === 'SHALL');
      const rawAssignments = rule.post ?? [];

      for (const assign of rawAssignments) {
        const segs = assign.target?.segments ?? [];
        const targetRoot = segs.length > 1 && aliases.has(segs[0]) ? segs[1] : segs[0];
        if (targetRoot) writtenStateFields.add(`${aggName}.${targetRoot}`);
        for (const chain of collectExprPathRoots(assign.value)) {
          if (chain.length > 1 && aliases.has(chain[0])) readStateFields.add(`${aggName}.${chain[1]}`);
        }
        if (assign.target?.index) {
          for (const chain of collectExprPathRoots(assign.target.index)) {
            if (chain.length > 1 && aliases.has(chain[0])) readStateFields.add(`${aggName}.${chain[1]}`);
          }
        }
      }

      if (!hasReject && rawAssignments.length > 0 && emitted.length === 0) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_STATE_CHANGE_WITHOUT_EVENT',
          ...(loc.file ? { file: loc.file } : {}),
          ...(loc.span ? { span: loc.span } : {}),
          target: beh.target,
          message: `domain rule [${rule.id}] on "${beh.target}" mutates state via transition/post: without emitting an event; in Event Sourcing every state change must SHALL emit <Event>`,
        });
        continue;
      }
      if (emitted.length === 0) continue;

      for (const act of emitted) {
        emittedEvents.add(`${aggName}.${act.event}`);
        if (rule.command) {
          const cmdKey = `${aggName}.${rule.command}`;
          if (!commandEmittedEvents.has(cmdKey)) commandEmittedEvents.set(cmdKey, new Set());
          commandEmittedEvents.get(cmdKey).add(act.event);
        }
      }

      const canonicalize = assigns => assigns.map(a => {
        const segs = [...a.target.segments];
        if (segs.length > 1 && aliases.has(segs[0])) segs[0] = 'state';
        return { target: { segments: segs, index: a.target.index }, value: a.value, source: a.source };
      });

      // Resolve event field maps for all emitted events in this rule
      const emittedInfos = emitted.map(act => {
        const ev = evMap.get(act.event);
        const evFields = resolveCanonicalEventFields(agg, ev);
        return {
          event: act.event,
          evFieldMap: new Map(evFields.map(f => [f.name, f.resolvedType])),
          assignments: [],
        };
      });

      if (emittedInfos.length === 1) {
        emittedInfos[0].assignments = rawAssignments;
      } else if (rawAssignments.length > 0) {
        // Multi-event rule: disambiguate each post: assignment by which emitted event carries its referenced fields
        for (const assign of rawAssignments) {
          const roots = [];
          if (assign.target?.index) collectExprPathRoots(assign.target.index, roots);
          collectExprPathRoots(assign.value, roots);
          const nonStateRoots = [...new Set(roots.filter(c => c.length > 0 && !(c.length > 1 && aliases.has(c[0]))).map(c => c[0]))];
          const matching = emittedInfos.filter(info => nonStateRoots.every(r => info.evFieldMap.has(r)));
          if (matching.length === 1) {
            matching[0].assignments.push(assign);
          } else if (matching.length > 1) {
            diagnostics.push({
              severity: 'error',
              code: 'V2_AMBIGUOUS_MULTI_EVENT_FOLD',
              ...(loc.file ? { file: loc.file } : {}),
              ...(loc.span ? { span: loc.span } : {}),
              target: beh.target,
              message: `rule [${rule.id}] emits multiple events (${emitted.map(e => e.event).join(', ')}) with ambiguous post: assignment to "${assign.target.segments.join('.')}" that cannot be uniquely attributed to a single event (split into separate events/rules or bind distinct event fields to avoid double-replay)`,
            });
          } else {
            // Matches none: report missing field against first event
            emittedInfos[0].assignments.push(assign);
          }
        }
      }

      for (const info of emittedInfos) {
        for (const assign of info.assignments) {
          verifyAssignmentAgainstEvent({
            assign,
            agg,
            aliases,
            evName: info.event,
            evFieldMap: info.evFieldMap,
            ruleId: rule.id,
            behTarget: beh.target,
            loc,
            diagnostics,
            consumedEventFields,
          });
        }

        const canonicalAssignments = canonicalize(info.assignments);
        const foldSha256 = createHash('sha256').update(JSON.stringify(canonicalAssignments)).digest('hex');
        const key = `${aggName}.${info.event}`;
        if (!foldMap.has(key)) {
          foldMap.set(key, {
            aggregate: aggName,
            event: info.event,
            assignments: canonicalAssignments,
            foldSha256,
            sourceRuleIds: [rule.id],
          });
        } else {
          const existing = foldMap.get(key);
          if (existing.foldSha256 !== foldSha256) {
            diagnostics.push({
              severity: 'error',
              code: 'V2_INCONSISTENT_EVENT_FOLD',
              ...(loc.file ? { file: loc.file } : {}),
              ...(loc.span ? { span: loc.span } : {}),
              target: beh.target,
              message: `event "${key}" has conflicting post:/transition folds across rules [${existing.sourceRuleIds.join(', ')}] and [${rule.id}]`,
            });
          } else {
            existing.sourceRuleIds.push(rule.id);
          }
        }
      }
    }
  }

  // Check 3: Application Story -> Domain Command (dispatch) lineage
  const dispatches = verifyDispatchLineage(behaviors, structures, ruleLocMap, diagnostics, coverageSeverity);

  // Check 4: System-wide lineage coverage completeness
  const unspecifiedCommands = [];
  const unemittedEvents = [];
  const unusedProduces = [];
  const unconsumedEventFields = [];
  const deadStateFields = [];

  for (const agg of structures.aggregates ?? []) {
    for (const cmd of agg.commands ?? []) {
      const cmdKey = `${agg.name}.${cmd.name}`;
      if (!specifiedCommands.has(cmdKey)) {
        unspecifiedCommands.push(cmdKey);
        diagnostics.push({
          severity: coverageSeverity,
          code: 'V2_LINEAGE_UNSPECIFIED_COMMAND',
          target: cmdKey,
          message: `declared command "${cmdKey}" has no behavioral rules in any *.ears file`,
        });
      } else {
        const emittedByCmd = commandEmittedEvents.get(cmdKey) ?? new Set();
        for (const prodEv of cmd.produces ?? []) {
          if (!emittedByCmd.has(prodEv)) {
            unusedProduces.push(`${cmdKey}->${prodEv}`);
            diagnostics.push({
              severity: coverageSeverity,
              code: 'V2_LINEAGE_UNUSED_PRODUCES',
              target: cmdKey,
              message: `command "${cmdKey}" declares produces "${prodEv}", but no rule on "${cmd.name}" emits it`,
            });
          }
        }
      }
    }

    for (const ev of agg.events ?? []) {
      const evKey = `${agg.name}.${ev.name}`;
      if (!emittedEvents.has(evKey)) {
        unemittedEvents.push(evKey);
        diagnostics.push({
          severity: coverageSeverity,
          code: 'V2_LINEAGE_UNEMITTED_EVENT',
          target: evKey,
          message: `declared event "${evKey}" is never emitted by any behavioral rule`,
        });
      }
      for (const f of ev.fields ?? []) {
        const fKey = `${evKey}.${f.name}`;
        if (!consumedEventFields.has(fKey)) {
          unconsumedEventFields.push(fKey);
          diagnostics.push({
            severity: coverageSeverity,
            code: 'V2_LINEAGE_UNCONSUMED_EVENT_FIELD',
            target: evKey,
            message: `event field "${fKey}" is never consumed by any post:/applyEvent fold, event-triggered story, or readModel projection`,
          });
        }
      }
    }

    for (const sf of agg.stateFields ?? []) {
      const sfKey = `${agg.name}.${sf.name}`;
      if (!readStateFields.has(sfKey) && !writtenStateFields.has(sfKey)) {
        deadStateFields.push(sfKey);
        diagnostics.push({
          severity: coverageSeverity,
          code: 'V2_LINEAGE_DEAD_STATE_FIELD',
          target: agg.name,
          message: `state field "${sfKey}" is neither read nor written by any behavioral rule, axiom, or readModel`,
        });
      }
    }
  }

  const readModelLineage = (structures.readModels ?? []).map(rm => ({
    name: rm.name,
    sourceAggregate: rm.sourceAggregate ?? null,
    sourceEvents: rm.sourceEvents ?? [],
    fields: (rm.fields ?? []).map(f => ({
      name: f.name,
      type: formatType(f.resolvedType),
      source: f.source ?? 'unspecified',
    })),
  }));

  const lineage = {
    schemaVersion: 'co-arising.lineage/v2',
    dispatches,
    readModels: readModelLineage,
    coverage: {
      unspecifiedCommands,
      unemittedEvents,
      unusedProduces,
      unconsumedEventFields,
      deadStateFields,
    },
  };

  return {
    eventFolds: [...foldMap.values()],
    lineage,
    diagnostics,
  };
}
