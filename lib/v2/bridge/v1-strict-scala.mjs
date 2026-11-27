// Bridge: co-arising 2.0 Canonical Model v2 (EARS + Z3 PASS) -> 1.0 Strict-Governance Scala Architecture.
// Directly invokes the curated 1.0 unified emitters (emitter/families/*) so v2 Z3-verified truth
// produces the exact 1.0 strict-governance Onion/DDD layout:
//   domain/values/*.scala                         <- emitter/families/value-object.mjs (#1)
//   domain/entities/<Agg>Entity.scala             <- emitter/families/domain-entity.mjs (#2)
//   domain/entities/<Agg>Axioms.scala             <- 2.0 Z3-verified checkAxioms + pure replay
//   domain/entities/behaviors/<Agg>EventHandler.scala <- emitter/families/event-handler.mjs (#3)
//   domain/invariants/<Agg>Rules.scala            <- emitter/families/aggregate-invariant-rules.mjs (#45)
//   domain/invariants/params/<Agg>RuleParams.scala<- emitter/families/aggregate-invariant-rules.mjs (#45)
//   domain/services/<Agg>Computations.scala       <- pure domain computation port (1.0 ABI)
//   application/services/<Story>Port.scala        <- application story inbound/outbound ports + typed CallerContractSpec
//   handwritten/scala/<pkg>/domain/services/impl/<Target>Impl.scala     <- L2 @cloze isolation zone
//   handwritten/scala/<pkg>/application/services/<Story>Impl.scala      <- L3 @cloze isolation zone
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { registerCodegenPlugin } from '../codegen/interface.mjs';
import { resolveCanonicalEventFields } from '../structure-loader.mjs';
import { resolveRuntimeProfile } from '../../runtime-profile.mjs';
import { family as valueObjectFamily } from '../../../emitter/families/value-object.mjs';
import { family as domainEntityFamily } from '../../../emitter/families/domain-entity.mjs';
import { family as aggregateInvariantRulesFamily } from '../../../emitter/families/aggregate-invariant-rules.mjs';
import { family as eventHandlerFamily } from '../../../emitter/families/event-handler.mjs';
import {
  renderAssignValScala,
  renderCleanBoolScala,
  renderPathScala,
  renderValScala,
} from './ears-simplify.mjs';

function toSlug(name) {
  return String(name ?? '')
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .replace(/[^A-Za-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase();
}

function toPascal(name) {
  return String(name ?? '')
    .split(/[^A-Za-z0-9]+/u)
    .filter(Boolean)
    .map(p => p[0].toUpperCase() + p.slice(1))
    .join('');
}

function toUpperSnake(name) {
  return String(name ?? '')
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_|_$/gu, '')
    .toUpperCase();
}

/**
 * Render an idiomatic Scala string literal.
 * Uses triple-quoted `"""...""".stripMargin` whenever a string is multiline or contains
 * quotes/backslashes (avoiding ugly `\"` escapes).
 */
export function scalaTripleQuoted(text, indent = '    ') {
  const raw = String(text ?? '');
  if (!raw.includes('\n') && !raw.includes('"') && !raw.includes('\\')) {
    return JSON.stringify(raw);
  }
  const safe = raw.replaceAll('"""', '"\\""');
  const lines = safe.split('\n');
  if (lines.length === 1) {
    return `"""${lines[0]}"""`;
  }
  return ['"""|' + lines[0], ...lines.slice(1).map(l => `${indent}   |${l}`)].join('\n') + '""".stripMargin';
}

function stripAppPrefix(relPath) {
  return relPath.startsWith('app/') ? relPath.slice(4) : relPath;
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

function buildNominalIndex(canonicalV2) {
  const exactByName = new Map();
  for (const ex of canonicalV2.structures?.exactTypes ?? []) {
    exactByName.set(ex.name, ex);
  }
  const voByName = new Map();
  for (const vo of canonicalV2.structures?.valueObjects ?? []) {
    voByName.set(vo.name, vo);
  }
  return { exactByName, voByName };
}

function toV1TypeTree(rt, context, nominalIdx) {
  if (!rt || typeof rt !== 'object') return { form: 'primitive', name: 'string' };
  switch (rt.kind) {
    case 'int': return { form: 'primitive', name: 'integer' };
    case 'bool': return { form: 'primitive', name: 'boolean' };
    case 'string': return { form: 'primitive', name: 'string' };
    case 'decimal': return { form: 'primitive', name: 'decimal' };
    case 'optional': return { form: 'optional', element: toV1TypeTree(rt.element, context, nominalIdx) };
    case 'sequence': return { form: 'sequence', element: toV1TypeTree(rt.element, context, nominalIdx) };
    case 'map':
      return {
        form: 'map',
        key: { form: 'primitive', name: 'string' },
        value: toV1TypeTree(rt.value, context, nominalIdx),
      };
    case 'record': {
      if (rt.typeName && (nominalIdx.exactByName.has(rt.typeName) || nominalIdx.voByName.has(rt.typeName))) {
        return { form: 'nominal', context, name: rt.typeName };
      }
      return { form: 'primitive', name: 'string' };
    }
    default:
      return { form: 'primitive', name: 'string' };
  }
}

function toV1DefaultLiteral(field, context, nominalIdx) {
  const rt = field.resolvedType;
  const def = field.defaultValue;
  if (!rt || typeof rt !== 'object') return { kind: 'string', value: '' };
  switch (rt.kind) {
    case 'int': {
      const n = def !== undefined ? Math.trunc(Number(def)) : 0;
      return { kind: 'integer', value: String(Number.isFinite(n) ? n : 0) };
    }
    case 'bool':
      return { kind: 'boolean', value: def !== undefined ? Boolean(def) : false };
    case 'string':
      return { kind: 'string', value: def !== undefined ? String(def) : '' };
    case 'decimal': {
      const scale = rt.scale ?? 2;
      const fallback = scale > 0 ? `0.${'0'.repeat(scale)}` : '0';
      const raw = def !== undefined ? String(def) : fallback;
      return { kind: 'decimal', value: /^-?\d+(?:\.\d+)?$/u.test(raw) ? raw : fallback };
    }
    case 'optional': {
      if (def === undefined || def === null || def === 'null' || def === 'none') {
        return { kind: 'optional', present: false };
      }
      return {
        kind: 'optional',
        present: true,
        value: toV1DefaultLiteral({ resolvedType: rt.element, defaultValue: def }, context, nominalIdx),
      };
    }
    case 'sequence':
      return { kind: 'sequence', elements: [] };
    case 'map':
      return { kind: 'map', entries: [] };
    case 'record': {
      const ex = nominalIdx.exactByName.get(rt.typeName);
      if (ex) {
        const scale = ex.scale ?? 2;
        const zeroStr = scale > 0 ? `0.${'0'.repeat(scale)}` : '0';
        if (ex.form === 'unit-decimal') {
          const unit = (ex.units && ex.units[0]) ? String(ex.units[0]) : 'CNY';
          return { kind: 'nominal-exact-unit-decimal', context, name: ex.name, amount: zeroStr, unit };
        }
        return { kind: 'nominal-exact-decimal', context, name: ex.name, amount: zeroStr };
      }
      const vo = nominalIdx.voByName.get(rt.typeName);
      if (vo) {
        const args = (vo.fields ?? []).map(f => toV1DefaultLiteral(f, context, nominalIdx));
        return { kind: 'nominal-record', context, name: vo.name, args };
      }
      return { kind: 'string', value: '' };
    }
    default:
      return { kind: 'string', value: '' };
  }
}

function v1ScalaTypeString(rt, pkg, nominalIdx) {
  if (!rt || typeof rt !== 'object') return 'String';
  switch (rt.kind) {
    case 'int': return 'Long';
    case 'bool': return 'Boolean';
    case 'string': return 'String';
    case 'decimal': return 'BigDecimal';
    case 'optional': return `Option[${v1ScalaTypeString(rt.element, pkg, nominalIdx)}]`;
    case 'sequence': return `Vector[${v1ScalaTypeString(rt.element, pkg, nominalIdx)}]`;
    case 'map': return `Map[String, ${v1ScalaTypeString(rt.value, pkg, nominalIdx)}]`;
    case 'record':
      if (rt.typeName && (nominalIdx.exactByName.has(rt.typeName) || nominalIdx.voByName.has(rt.typeName))) {
        return `${pkg}.domain.values.${rt.typeName}`;
      }
      return 'String';
    default: return 'String';
  }
}

/**
 * Derive truthsrc.value-object-input/v1 from canonical-v2.json.
 */
export function deriveV1ValueObjectInput(canonicalV2, { packageName = 'example.v2', runtimeProfile = null } = {}) {
  const context = canonicalV2.context || canonicalV2.subdomain || 'core';
  const docId = `${canonicalV2.system || 'v2'}/${context}`;
  const nominalIdx = buildNominalIndex(canonicalV2);
  const values = [];

  (canonicalV2.structures?.exactTypes ?? []).forEach((ex) => {
    const scale = Number.isInteger(ex.scale) && ex.scale > 0 ? ex.scale : 2;
    const precision = Number.isInteger(ex.precision) && ex.precision > 0 ? ex.precision : 38;
    const shape = ex.form === 'unit-decimal'
      ? {
          kind: 'exact',
          amountMember: ex.amountField ?? 'amount',
          unitMember: ex.unitField ?? 'currency',
          units: Array.isArray(ex.units) && ex.units.length > 0 ? ex.units.map(String) : ['CNY'],
          scale,
          precision,
        }
      : {
          kind: 'exact',
          amountMember: ex.amountField ?? 'value',
          scale,
          precision,
        };
    values.push({
      context,
      name: ex.name,
      source: { document: docId, pointer: `/exactTypes/${ex.name}` },
      shape,
    });
  });

  (canonicalV2.structures?.valueObjects ?? []).forEach((vo) => {
    const members = (vo.fields ?? []).map(f => ({
      name: f.name,
      type: toV1TypeTree(f.resolvedType, context, nominalIdx),
    }));
    if (members.length === 0) {
      members.push({ name: 'value', type: { form: 'primitive', name: 'string' } });
    }
    values.push({
      context,
      name: vo.name,
      source: { document: docId, pointer: `/valueObjects/${vo.name}` },
      shape: { kind: 'record', members },
    });
  });

  if (values.length === 0) return null;
  return {
    schemaVersion: 'truthsrc.value-object-input/v1',
    ...(runtimeProfile ? { runtimeProfile } : {}),
    packages: [{ context, package: packageName }],
    values,
  };
}

/**
 * Derive truthsrc.domain-entity-input/v1 from canonical-v2.json.
 */
export function deriveV1DomainEntityInput(canonicalV2, { packageName = 'example.v2', runtimeProfile = null } = {}) {
  const context = canonicalV2.context || canonicalV2.subdomain || 'core';
  const docId = `${canonicalV2.system || 'v2'}/${context}`;
  const nominalIdx = buildNominalIndex(canonicalV2);
  const aggregates = [];

  (canonicalV2.structures?.aggregates ?? []).forEach((agg) => {
    const rawFields = agg.stateFields ?? [];
    const fields = rawFields.length > 0
      ? rawFields.map((sf) => ({
          name: sf.name,
          type: toV1TypeTree(sf.resolvedType, context, nominalIdx),
          default: toV1DefaultLiteral(sf, context, nominalIdx),
          source: { document: docId, pointer: `/aggregates/${agg.name}/stateFields/${sf.name}` },
        }))
      : [{
          name: agg.idField || 'id',
          type: { form: 'primitive', name: 'string' },
          default: { kind: 'string', value: '' },
          source: { document: docId, pointer: `/aggregates/${agg.name}/idField` },
        }];

    const events = (agg.events ?? []).map((ev) => {
      const resolvedFields = resolveCanonicalEventFields(agg, ev);
      return {
        name: ev.name,
        source: { document: docId, pointer: `/aggregates/${agg.name}/events/${ev.name}` },
        slots: resolvedFields.map(f => ({
          name: f.name,
          valueType: toV1TypeTree(f.resolvedType, context, nominalIdx),
        })),
      };
    });

    aggregates.push({
      context,
      name: agg.name,
      source: { document: docId, pointer: `/aggregates/${agg.name}` },
      fields,
      events,
    });
  });

  if (aggregates.length === 0) return null;
  return {
    schemaVersion: 'truthsrc.domain-entity-input/v1',
    ...(runtimeProfile ? { runtimeProfile } : {}),
    packages: [{ context, package: packageName }],
    aggregates,
  };
}

function buildV1EventSlotProducer(binding, context, nominalIdx) {
  if (binding.source === '@FROM_STATE') {
    return { op: 'ref', scope: 'state-field', name: binding.stateField };
  }
  if (binding.source === '@CONSTANT') {
    const valueType = toV1TypeTree(binding.eventFieldType, context, nominalIdx);
    let value = binding.constValue;
    if (valueType.form === 'primitive') {
      if (valueType.name === 'integer') value = Math.trunc(Number(value ?? 0));
      else if (valueType.name === 'boolean') value = Boolean(value);
      else if (valueType.name === 'decimal') value = String(value ?? '0.00');
      else value = String(value ?? '');
    }
    return { op: 'literal', value, valueType };
  }
  return { op: 'ref', scope: 'parameter', name: binding.paramName ?? binding.eventField };
}

/**
 * Derive truthsrc.aggregate-invariant-rules-input/v1 from Z3-verified EARS behaviors
 * using algebraic NNF simplification so emitted guards are clean and double-negation-free.
 */
export function deriveV1AggregateRulesInput(canonicalV2, { packageName = 'example.v2', runtimeProfile = null } = {}) {
  const context = canonicalV2.context || canonicalV2.subdomain || 'core';
  const docId = `${canonicalV2.system || 'v2'}/${context}`;
  const nominalIdx = buildNominalIndex(canonicalV2);
  const aggregates = [];
  const l2ClozeCommandsByAgg = new Map();

  (canonicalV2.structures?.aggregates ?? []).forEach((agg) => {
    const aggBehaviors = (canonicalV2.behaviors ?? []).filter(
      b => b.kind === 'slice' && b.target.split('.')[0] === agg.name,
    );
    const behaviorByCmd = new Map();
    for (const beh of aggBehaviors) {
      for (const rule of beh.rules) {
        if (!behaviorByCmd.has(rule.command)) behaviorByCmd.set(rule.command, { behavior: beh, rules: [] });
        behaviorByCmd.get(rule.command).rules.push(rule);
      }
    }

    const stateTypes = new Map((agg.stateFields ?? []).map(sf => [sf.name, sf.resolvedType]));
    const aliases = new Set(agg.aliases ?? ['state', agg.name.toLowerCase()]);
    const l1Commands = [];
    const l2Commands = [];

    (agg.commands ?? []).forEach((cmd, cIdx) => {
      const entry = behaviorByCmd.get(cmd.name);
      if (!entry) return;
      if (entry.behavior.theory.codegenChannel === 'cloze-tdd') {
        l2Commands.push({ cmd, behavior: entry.behavior, cIdx });
        return;
      }

      const cmdEnv = {
        aliases,
        stateTypes,
        paramTypes: new Map((cmd.parameters ?? []).map(p => [p.name, p.resolvedType])),
        paramPrefix: 'p',
      };

      const guards = [];
      let emittedEvents = [];

      entry.rules.forEach((rule) => {
        const rejectAct = rule.actions.find(a => a.kind === 'reject' && a.modality === 'SHALL');
        const succeedEmpty = rule.actions.find(a => a.kind === 'succeed-empty' && a.modality === 'SHALL');
        const emitActs = rule.actions.filter(a => a.kind === 'emit' && a.modality === 'SHALL');

        if (rejectAct || (succeedEmpty && emitActs.length === 0)) {
          const cleanCond = renderCleanBoolScala(rule.guard, cmdEnv);
          // Wrap in outer `!(...)` because v1 aggregate-invariant-rules.mjs unwraps a single
          // balanced `!(inner)` directly to `inner`, yielding clean double-negation-free Scala!
          guards.push({
            source: { document: docId, pointer: `/behaviors/${entry.behavior.target}/rules/${rule.id}` },
            text: `!(${cleanCond})`,
            outcome: rejectAct
              ? { kind: 'reject', code: rejectAct.code, message: rejectAct.code }
              : { kind: 'succeed-empty' },
          });
        } else if (emitActs.length > 0 && emittedEvents.length === 0) {
          emittedEvents = emitActs.map(act => {
            const prop = (entry.behavior.eventPropagations ?? []).find(
              p => p.ruleId === rule.id && p.event === act.event,
            );
            const bindings = prop?.bindings ?? (cmd.parameters ?? []).map(p => ({
              eventField: p.name,
              source: '@PROPAGATED',
              paramName: p.name,
              eventFieldType: p.resolvedType,
            }));
            return {
              name: act.event,
              slots: bindings.map(b => ({ producer: buildV1EventSlotProducer(b, context, nominalIdx) })),
            };
          });
        }
      });

      if (emittedEvents.length > 0) {
        l1Commands.push({
          command: cmd.name,
          source: { document: docId, pointer: `/aggregates/${agg.name}/commands/${cmd.name}` },
          parameters: (cmd.parameters ?? []).map(p => ({
            name: p.name,
            valueType: toV1TypeTree(p.resolvedType, context, nominalIdx),
          })),
          guards,
          events: emittedEvents,
        });
      }
    });

    if (l2Commands.length > 0) {
      l2ClozeCommandsByAgg.set(agg.name, l2Commands);
    }

    if (l1Commands.length > 0) {
      // Derive real eventPostconditions for emitted/declared aggregate events
      const eventPostconditions = [];
      for (const ev of agg.events ?? []) {
        const evFields = resolveCanonicalEventFields(agg, ev);
        const checks = [];
        for (const f of evFields) {
          if (f.resolvedType?.kind === 'string') {
            checks.push({
              slot: f.name,
              kind: 'non-empty-text',
              code: `${toUpperSnake(agg.name)}_${toUpperSnake(ev.name)}_${toUpperSnake(f.name)}_EMPTY`,
              message: `${ev.name}.${f.name} must not be empty`,
            });
          } else if (f.resolvedType?.kind === 'record' && (nominalIdx.exactByName.has(f.resolvedType.typeName) || nominalIdx.voByName.has(f.resolvedType.typeName))) {
            checks.push({
              slot: f.name,
              kind: 'non-null',
              code: `${toUpperSnake(agg.name)}_${toUpperSnake(ev.name)}_${toUpperSnake(f.name)}_MISSING`,
              message: `${ev.name}.${f.name} must not be null`,
            });
          }
        }
        if (checks.length > 0) {
          eventPostconditions.push({ event: ev.name, checks });
        }
      }

      aggregates.push({
        context,
        aggregate: agg.name,
        package: packageName,
        name: agg.name,
        source: { document: docId, pointer: `/aggregates/${agg.name}` },
        commands: l1Commands,
        ...(eventPostconditions.length > 0 ? { eventPostconditions } : {}),
      });
    }
  });

  return {
    rulesInput: aggregates.length > 0
      ? {
          schemaVersion: 'truthsrc.aggregate-invariant-rules-input/v1',
          ...(runtimeProfile ? { runtimeProfile } : {}),
          packages: [{ context, package: packageName }],
          aggregates,
        }
      : null,
    l2ClozeCommandsByAgg,
  };
}

function buildV1FoldAssignmentEntries(assignments, stateTypes, evEnv, pkg, nominalIdx, docId, pointerBase) {
  const flat = [];
  const nestedByRoot = new Map();

  for (const assign of assignments) {
    const segs = assign.target?.segments ?? [];
    const pathSegs = segs.length > 1 && evEnv.aliases.has(segs[0]) ? segs.slice(1) : segs;
    if (pathSegs.length === 1) {
      const fieldName = pathSegs[0];
      const fieldType = stateTypes.get(fieldName) ?? null;
      let exprStr;
      if (assign.target.index) {
        const keyExpr = renderValScala(assign.target.index, evEnv);
        const elemType = fieldType?.kind === 'map' ? fieldType.value : null;
        const valExpr = renderAssignValScala(assign.value, elemType, evEnv);
        exprStr = `state.${fieldName}.updated(${keyExpr}, ${valExpr})`;
      } else {
        exprStr = renderAssignValScala(assign.value, fieldType, evEnv);
      }
      flat.push({
        target: fieldName,
        valueType: v1ScalaTypeString(fieldType, pkg, nominalIdx),
        expression: exprStr,
        source: { document: docId, pointer: `${pointerBase}/${fieldName}` },
      });
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
          const kExpr = renderValScala(e.index, evEnv);
          const vExpr = renderAssignValScala(e.value, childType?.kind === 'map' ? childType.value : null, evEnv);
          leafParts.push(`${head} = ${ownerExpr}.${head}.updated(${kExpr}, ${vExpr})`);
        } else {
          leafParts.push(`${head} = ${renderAssignValScala(e.value, childType, evEnv)}`);
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
    flat.push({
      target: rootField,
      valueType: v1ScalaTypeString(rootType, pkg, nominalIdx),
      expression: buildNestedCopy(`state.${rootField}`, rootType, entries),
      source: { document: docId, pointer: `${pointerBase}/${rootField}` },
    });
  }

  return flat;
}

/**
 * Derive truthsrc.event-handler-input/v1 from canonical-v2.json eventFolds.
 */
export function deriveV1EventHandlerInput(canonicalV2, { packageName = 'example.v2' } = {}) {
  const context = canonicalV2.context || canonicalV2.subdomain || 'core';
  const docId = `${canonicalV2.system || 'v2'}/${context}`;
  const nominalIdx = buildNominalIndex(canonicalV2);
  const handlers = [];

  (canonicalV2.structures?.aggregates ?? []).forEach((agg) => {
    const stateTypes = new Map((agg.stateFields ?? []).map(sf => [sf.name, sf.resolvedType]));
    const aliases = new Set(agg.aliases ?? ['state', agg.name.toLowerCase()]);

    const events = (agg.events ?? []).map((ev) => {
      const fold = (canonicalV2.eventFolds ?? []).find(f => f.aggregate === agg.name && f.event === ev.name);
      const evFields = resolveCanonicalEventFields(agg, ev);
      // Note: 1.0 event-handler.mjs binds the pattern variable as `event`!
      const evEnv = {
        aliases,
        stateTypes,
        paramTypes: new Map(evFields.map(f => [f.name, f.resolvedType])),
        paramPrefix: 'event',
      };
      const assignments = fold?.assignments?.length
        ? buildV1FoldAssignmentEntries(
            fold.assignments,
            stateTypes,
            evEnv,
            packageName,
            nominalIdx,
            docId,
            `/aggregates/${agg.name}/events/${ev.name}/fold`,
          )
        : [];
      return {
        name: ev.name,
        source: { document: docId, pointer: `/aggregates/${agg.name}/events/${ev.name}` },
        assignments,
      };
    });

    handlers.push({
      context,
      name: agg.name,
      source: { document: docId, pointer: `/aggregates/${agg.name}` },
      events,
    });
  });

  if (handlers.length === 0) return null;
  return {
    schemaVersion: 'truthsrc.event-handler-input/v1',
    packages: [{ context, package: packageName }],
    handlers,
  };
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

function toCamel(name) {
  const p = toPascal(name);
  return p ? p[0].toLowerCase() + p.slice(1) : '';
}

function deriveEventPostconditions(agg, nominalIdx) {
  const eventPostconditions = [];
  for (const ev of agg.events ?? []) {
    const evFields = resolveCanonicalEventFields(agg, ev);
    const checks = [];
    for (const f of evFields) {
      if (f.resolvedType?.kind === 'string') {
        checks.push({
          slot: f.name,
          kind: 'non-empty-text',
          code: `${toUpperSnake(agg.name)}_${toUpperSnake(ev.name)}_${toUpperSnake(f.name)}_EMPTY`,
          message: `${ev.name}.${f.name} must not be empty`,
        });
      } else if (f.resolvedType?.kind === 'record' && (nominalIdx.exactByName.has(f.resolvedType.typeName) || nominalIdx.voByName.has(f.resolvedType.typeName))) {
        checks.push({
          slot: f.name,
          kind: 'non-null',
          code: `${toUpperSnake(agg.name)}_${toUpperSnake(ev.name)}_${toUpperSnake(f.name)}_MISSING`,
          message: `${ev.name}.${f.name} must not be null`,
        });
      }
    }
    if (checks.length > 0) {
      eventPostconditions.push({ event: ev.name, checks });
    }
  }
  return eventPostconditions;
}

function renderPostconditionsScala(eventPostconditions) {
  if (!eventPostconditions || eventPostconditions.length === 0) {
    return ['  def checkEventPostconditions(events: List[Event]): Option[iMadzError] = None'];
  }
  const lines = [
    '  def checkEventPostconditions(events: List[Event]): Option[iMadzError] =',
    '    events.iterator.map(checkEventPostcondition).collectFirst { case Some(error) => error }',
    '',
    '  private def checkEventPostcondition(event: Event): Option[iMadzError] = event match {',
  ];
  for (const ep of eventPostconditions) {
    lines.push(`    case e: ${ep.event} =>`);
    ep.checks.forEach((chk, ci) => {
      const branch = ci === 0 ? 'if' : 'else if';
      const cond = chk.kind === 'non-empty-text'
        ? `Option(e.${chk.slot}).forall(_.trim.isEmpty)`
        : `Option(e.${chk.slot}).isEmpty`;
      lines.push(`      ${branch} (${cond}) Some(iMadzError(${JSON.stringify(chk.code)}, ${JSON.stringify(chk.message)}))`);
    });
    lines.push('      else None');
  }
  lines.push('    case _ => None', '  }');
  return lines;
}

function generateComputationsTrait(agg, hostCommands, packageName, commonPackage) {
  if (!hostCommands || hostCommands.length === 0) {
    return [
      `package ${packageName}.domain.services`,
      '',
      `import ${commonPackage}.CommonTypes.DomainService`,
      '',
      `// L1-only aggregate: 0 abstract domain computation methods (all rules generated deterministically in ${agg.name}Rules).`,
      `trait ${agg.name}Computations extends DomainService`,
      `object ${agg.name}Computations {`,
      `  val Noop: ${agg.name}Computations = new ${agg.name}Computations {}`,
      '}',
      '',
    ].join('\n');
  }
  return [
    `package ${packageName}.domain.services`,
    '',
    `import ${packageName}.domain.entities.${agg.name}Entity.{Event, State}`,
    `import ${packageName}.domain.invariants.params.${agg.name}RuleParams._`,
    `import ${commonPackage}.CommonTypes.{DomainService, iMadzError}`,
    '',
    `// Non-deterministic / L2 domain computation port (bound to ${agg.name}ComputationsImpl in DI).`,
    `trait ${agg.name}Computations extends DomainService {`,
    ...hostCommands.map(hc => `  def ${toCamel(hc.cmd.name)}(state: State, p: ${hc.cmd.name}Params): Either[iMadzError, List[Event]]`),
    '}',
    '',
  ].join('\n');
}

function generateComputationsImplSkeleton(agg, hostCommands, packageName, commonPackage) {
  const lines = [
    `// Handwritten domain computations isolation zone for ${agg.name}.`,
    '// Delegates L2 @cloze behaviors to their dedicated *Impl objects; customize any remaining non-L1 command handlers below.',
    `package ${packageName}.domain.services.impl`,
    '',
    `import ${packageName}.domain.entities.${agg.name}Entity._`,
    `import ${packageName}.domain.invariants.params.${agg.name}RuleParams._`,
    `import ${packageName}.domain.services.${agg.name}Computations`,
    `import ${commonPackage}.CommonTypes.iMadzError`,
    '',
    `final class ${agg.name}ComputationsImpl extends ${agg.name}Computations {`,
  ];
  for (const hc of hostCommands) {
    const methodName = toCamel(hc.cmd.name);
    if (hc.l2Target) {
      const implObj = `${toPascal(hc.l2Target)}Impl`;
      lines.push(`  override def ${methodName}(state: State, p: ${hc.cmd.name}Params): Either[iMadzError, List[Event]] =`);
      lines.push(`    ${implObj}.apply(state, p)`);
    } else {
      const producedName = hc.cmd.produces?.[0];
      const producedEv = producedName ? (agg.events ?? []).find(e => e.name === producedName) : null;
      const paramNames = new Set((hc.cmd.parameters ?? []).map(p => p.name));
      const evFields = producedEv ? resolveCanonicalEventFields(agg, producedEv) : [];
      const canConstruct = producedEv && evFields.every(f => paramNames.has(f.name));
      lines.push(`  override def ${methodName}(state: State, p: ${hc.cmd.name}Params): Either[iMadzError, List[Event]] = {`);
      if (canConstruct) {
        const args = evFields.map(f => `p.${f.name}`).join(', ');
        lines.push(`    Right(List(${producedEv.name}(${args})))`);
      } else {
        lines.push(`    Left(iMadzError("DOMAIN_COMPUTATION_NOT_IMPLEMENTED", ${JSON.stringify(`${agg.name}.${hc.cmd.name}`)}))`);
      }
      lines.push('  }');
    }
    lines.push('');
  }
  lines.push('}', '');
  return lines.join('\n');
}

function generateDelegatedAggregateRules(agg, hostCommands, docId, packageName, commonPackage, nominalIdx) {
  const postconditions = deriveEventPostconditions(agg, nominalIdx);
  const lines = [
    `package ${packageName}.domain.invariants`,
    '',
    `import ${packageName}.domain.entities.${agg.name}Entity._`,
    `import ${packageName}.domain.invariants.params.${agg.name}RuleParams._`,
    `import ${packageName}.domain.services.${agg.name}Computations`,
    `import ${commonPackage}.CommonTypes.{InvariantRule, iMadzError}`,
    '',
    `object ${agg.name}Rules {`,
  ];
  for (const hc of hostCommands) {
    lines.push(`  // @knowledge source:${docId}#/aggregates/${agg.name}/commands/${hc.cmd.name}`);
    lines.push(`  final class ${hc.cmd.name}Rule(hosts: ${agg.name}Computations)`);
    lines.push(`      extends InvariantRule[Event, State, ${hc.cmd.name}Params] {`);
    lines.push(`    override def apply(state: State, p: ${hc.cmd.name}Params): Either[iMadzError, List[Event]] =`);
    lines.push(`      hosts.${toCamel(hc.cmd.name)}(state, p)`);
    lines.push('  }');
    lines.push('');
  }
  lines.push(...renderPostconditionsScala(postconditions));
  lines.push('}', '');
  return lines.join('\n');
}

function generateAllCommandRuleParams(agg, commands, packageName, nominalIdx) {
  const usesValues = commands.some(cmd =>
    (cmd.parameters ?? []).some(p => {
      const rt = p.resolvedType;
      return rt?.kind === 'record' && (nominalIdx.exactByName.has(rt.typeName) || nominalIdx.voByName.has(rt.typeName));
    }),
  );
  const lines = [
    `package ${packageName}.domain.invariants.params`,
    '',
    ...(usesValues ? [`import ${packageName}.domain.values._`, ''] : []),
    `object ${agg.name}RuleParams {`,
  ];
  for (const cmd of commands) {
    const fields = (cmd.parameters ?? [])
      .map(p => `${p.name}: ${v1ScalaTypeString(p.resolvedType, packageName, nominalIdx)}`)
      .join(', ');
    lines.push(`  final case class ${cmd.name}Params(${fields})`);
  }
  lines.push('}', '');
  return lines.join('\n');
}

function generateAggregateAxioms(agg, behaviors, packageName) {
  const aggName = agg.name;
  const stateTypes = new Map((agg.stateFields ?? []).map(sf => [sf.name, sf.resolvedType]));
  const aliases = new Set(agg.aliases ?? ['state', aggName.toLowerCase()]);
  const allAxioms = behaviors.flatMap(b => (b.axioms ?? []).filter(a => a.kind === 'invariant'));

  const lines = [
    `package ${packageName}.domain.entities`,
    '',
    `import ${packageName}.domain.entities.${aggName}Entity._`,
    `import ${packageName}.domain.entities.behaviors.${aggName}EventHandler`,
    '',
    `object ${aggName}Axioms {`,
    '  def replay(initial: State, events: Seq[Event]): State =',
    `    events.foldLeft(initial)(${aggName}EventHandler.apply)`,
    '',
    '  def checkAxioms(state: State): Seq[String] = {',
    '    val violated = scala.collection.mutable.ListBuffer.empty[String]',
  ];

  for (const ax of allAxioms) {
    const mapIdx = findMapIndexVar(ax.expr);
    const axEnv = { aliases, stateTypes, paramTypes: new Map(), paramPrefix: '' };
    if (mapIdx) {
      const mapPath = renderPathScala(mapIdx.mapExpr, axEnv);
      lines.push(`    // @ProvenanceId(axiom:${aggName}#${ax.id})`);
      lines.push(`    if (${mapPath}.keys.exists(${mapIdx.indexVar} => !(${renderCleanBoolScala(ax.expr, axEnv)}))) violated += ${JSON.stringify(ax.id)}`);
    } else {
      lines.push(`    // @ProvenanceId(axiom:${aggName}#${ax.id})`);
      lines.push(`    if (!(${renderCleanBoolScala(ax.expr, axEnv)})) violated += ${JSON.stringify(ax.id)}`);
    }
  }
  lines.push('    violated.toSeq');
  lines.push('  }');
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

function generateL2ClozeParamsAndSkeleton(agg, l2Entries, packageName, commonPackage, nominalIdx, hasL1Rules) {
  const pkgDir = packageName.split('.').join('/');
  const out = [];
  const paramsObjName = hasL1Rules ? `${agg.name}DomainServiceRuleParams` : `${agg.name}RuleParams`;
  const usesValues = l2Entries.some(({ cmd }) =>
    (cmd.parameters ?? []).some(p => {
      const rt = p.resolvedType;
      return rt?.kind === 'record' && (nominalIdx.exactByName.has(rt.typeName) || nominalIdx.voByName.has(rt.typeName));
    }),
  );
  const paramLines = [
    `package ${packageName}.domain.invariants.params`,
    '',
    ...(usesValues ? [`import ${packageName}.domain.values._`, ''] : []),
    `object ${paramsObjName} {`,
  ];
  for (const { cmd } of l2Entries) {
    const fields = (cmd.parameters ?? [])
      .map(p => `${p.name}: ${v1ScalaTypeString(p.resolvedType, packageName, nominalIdx)}`)
      .join(', ');
    paramLines.push(`  final case class ${cmd.name}Params(${fields})`);
  }
  paramLines.push('}', '');
  out.push({
    path: `generated-scaffold/scala/${pkgDir}/domain/invariants/params/${paramsObjName}.scala`,
    content: paramLines.join('\n'),
    isCloze: false,
  });

  const byBehavior = new Map();
  for (const entry of l2Entries) {
    if (!byBehavior.has(entry.behavior.target)) byBehavior.set(entry.behavior.target, { behavior: entry.behavior, cmds: [] });
    byBehavior.get(entry.behavior.target).cmds.push(entry.cmd);
  }
  for (const [target, { behavior, cmds }] of byBehavior) {
    const slotId = toSlug(target);
    const objName = `${toPascal(target)}Impl`;
    const lines = [
      `// Handwritten L2 domain isolation-zone implementation for ${target} (${behavior.theory.tier} / ${behavior.theory.logic})`,
      `// Edit ONLY inside the bounded @cloze slot "${slotId}" below.`,
      `package ${packageName}.domain.services.impl`,
      '',
      `import ${packageName}.domain.entities.${agg.name}Entity._`,
      `import ${packageName}.domain.invariants.params.${paramsObjName}._`,
      `import ${commonPackage}.CommonTypes.{InvariantRule, iMadzError}`,
      '',
    ];
    if (cmds.length === 1) {
      const cmd = cmds[0];
      lines.push(`object ${objName} extends InvariantRule[Event, State, ${cmd.name}Params] {`);
      lines.push(`  override def apply(state: State, p: ${cmd.name}Params): Either[iMadzError, List[Event]] = {`);
      lines.push(`    // @cloze:start(${slotId})`);
      lines.push(`    throw new UnsupportedOperationException(${JSON.stringify(`CLOZE_NOT_IMPLEMENTED: ${slotId}`)})`);
      lines.push(`    // @cloze:end(${slotId})`);
      lines.push('  }');
      lines.push('}');
    } else {
      lines.push(`object ${objName} {`);
      for (const cmd of cmds) {
        lines.push(`  def apply(state: State, p: ${cmd.name}Params): Either[iMadzError, List[Event]] = {`);
        lines.push(`    // @cloze:start(${slotId})`);
        lines.push(`    throw new UnsupportedOperationException(${JSON.stringify(`CLOZE_NOT_IMPLEMENTED: ${slotId}`)})`);
        lines.push(`    // @cloze:end(${slotId})`);
        lines.push('  }');
      }
      lines.push('}');
    }
    lines.push('');
    out.push({
      path: `handwritten/scala/${pkgDir}/domain/services/impl/${objName}.scala`,
      content: lines.join('\n'),
      isCloze: true,
    });
  }
  return out;
}

function generateStrictApplicationPort(behavior, storyStruct, canonicalV2, packageName, commonPackage) {
  const storyName = behavior.target;
  const pascal = toPascal(storyName);
  const docId = `${canonicalV2.system || 'v2'}/${canonicalV2.context || canonicalV2.subdomain || 'core'}`;
  const coveredUcs = Array.isArray(storyStruct?.coversUseCases) ? storyStruct.coversUseCases : [];
  const lines = [
    '// @generated by co-arising 2.0 strict-governance bridge (DO NOT MODIFY)',
    `// @ProvenanceId(story:${storyName})`,
    ...coveredUcs.map(ucId => `// @knowledge source:${docId}#/useCases/${ucId}`),
    `// canonicalSha256: ${canonicalV2.canonicalSha256}`,
    `package ${packageName}.application.services`,
    '',
    `import ${commonPackage}.CommonTypes.{ApplicationService, iMadzError}`,
    '',
    `final case class ${pascal}Request(`,
    '  operation: String,',
    '  payload: Map[String, Any],',
    '  stateSnapshot: Map[String, Any] = Map.empty,',
    '  principal: Option[Map[String, Any]] = None',
    ')',
    '',
    `trait ${pascal}ExternPorts {`,
  ];
  for (const ext of behavior.externs ?? []) {
    const argsSig = (ext.params ?? []).map(p => `${p}: Any`).join(', ');
    lines.push(`  def ${ext.name}(${argsSig}): Boolean`);
  }
  lines.push('}', '');
  lines.push(`trait ${pascal}EffectsPort {`);
  lines.push('  def pin(artifact: String, inputs: Map[String, Any]): Unit');
  lines.push('  def dispatch(target: String, payload: Map[String, Any]): Unit');
  lines.push('}', '');
  lines.push(`final case class ${pascal}SuccessResponse(`);
  lines.push('  ruleId: String,');
  lines.push('  responseType: Option[String] = None,');
  lines.push('  response: Map[String, Any] = Map.empty,');
  lines.push('  viewName: Option[String] = None,');
  lines.push('  view: Map[String, Any] = Map.empty');
  lines.push(')', '');
  lines.push(`trait ${pascal}Handler extends ApplicationService {`);
  lines.push(`  def handle(req: ${pascal}Request, externs: ${pascal}ExternPorts, effects: ${pascal}EffectsPort): Either[iMadzError, ${pascal}SuccessResponse]`);
  lines.push('}', '');
  if (storyStruct?.callerContract) {
    const cc = storyStruct.callerContract;
    const forbidden = Array.isArray(cc.forbiddenUntrustedFields) ? cc.forbiddenUntrustedFields : [];
    for (const ax of behavior.axioms ?? []) {
      lines.push(`// @ProvenanceId(axiom:${storyName}#${ax.id})`);
      lines.push(`// @knowledge source:${storyName}#/axioms/${ax.id}`);
    }
    lines.push(`object ${pascal}CallerContract {`);
    lines.push('  val spec: CallerContractSpec = CallerContractSpec(');
    lines.push(`    idempotencyKey = ${scalaTripleQuoted(cc.idempotencyKey ?? '', '    ')},`);
    lines.push(`    retryPolicy = ${scalaTripleQuoted(cc.retryPolicy ?? '', '    ')},`);
    if (forbidden.length === 0) {
      lines.push('    forbiddenUntrustedFields = Seq.empty');
    } else {
      lines.push('    forbiddenUntrustedFields = Seq(');
      forbidden.forEach((f, idx) => {
        lines.push(`      ${scalaTripleQuoted(f, '      ')}${idx + 1 < forbidden.length ? ',' : ''}`);
      });
      lines.push('    )');
    }
    lines.push('  )');
    lines.push('}', '');
  }
  return lines.join('\n');
}

function generateCallerContractSpec(packageName) {
  return [
    `package ${packageName}.application.services`,
    '',
    '/** Strongly-typed caller idempotency & trust-boundary contract (replaces escaped JSON strings). */',
    'final case class CallerContractSpec(',
    '  idempotencyKey: String,',
    '  retryPolicy: String,',
    '  forbiddenUntrustedFields: Seq[String] = Seq.empty',
    ')',
    '',
  ].join('\n');
}

function generateStrictApplicationImpl(behavior, packageName, commonPackage) {
  const storyName = behavior.target;
  const pascal = toPascal(storyName);
  const slug = toSlug(storyName);
  return [
    `// Handwritten L3 application isolation-zone implementation for ${storyName}`,
    `// Edit ONLY inside the bounded @cloze slot "${slug}" below.`,
    `package ${packageName}.application.services`,
    '',
    `import ${commonPackage}.CommonTypes.iMadzError`,
    '',
    `object ${pascal}Impl extends ${pascal}Handler {`,
    `  override def handle(req: ${pascal}Request, externs: ${pascal}ExternPorts, effects: ${pascal}EffectsPort): Either[iMadzError, ${pascal}SuccessResponse] = {`,
    `    // @cloze:start(${slug})`,
    `    throw new UnsupportedOperationException(${JSON.stringify(`CLOZE_NOT_IMPLEMENTED: ${slug}`)})`,
    `    // @cloze:end(${slug})`,
    '  }',
    '}',
    '',
  ].join('\n');
}

function generateStandaloneCommonKernel(commonPackage) {
  const pkgDir = commonPackage.split('.').join('/');
  const cbor = [
    `package ${commonPackage}`,
    '',
    'trait CborSerializable',
    '',
  ].join('\n');
  const commonTypes = [
    `package ${commonPackage}`,
    '',
    'object CommonTypes {',
    '  final case class iMadzError(code: String, message: String) extends Throwable with CborSerializable',
    '  trait ReadModel',
    '  trait InvariantRule[Event, State, Param] {',
    '    def apply(state: State, param: Param): Either[iMadzError, List[Event]]',
    '  }',
    '  trait DomainService',
    '  trait ApplicationService',
    '}',
    '',
  ].join('\n');
  return [
    { path: `generated-scaffold/scala/${pkgDir}/CborSerializable.scala`, content: cbor },
    { path: `generated-scaffold/scala/${pkgDir}/CommonTypes.scala`, content: commonTypes },
  ];
}

export const scalaStrictCodegenPlugin = registerCodegenPlugin({
  target: 'scala-strict',
  generate(canonicalV2, {
    outDir,
    packageName = 'example.v2',
    overwriteCloze = false,
    runtimeProfile = null,
    includeCommonKernel = true,
  } = {}) {
    const root = resolve(outDir);
    const pkgDir = packageName.split('.').join('/');
    const commonPackage = resolveRuntimeProfile({ runtimeProfile }).commonPackage;
    const nominalIdx = buildNominalIndex(canonicalV2);
    const written = [];

    if (includeCommonKernel) {
      for (const k of generateStandaloneCommonKernel(commonPackage)) {
        written.push(writeArtifact(root, k.path, k.content));
      }
    }

    // 1. Family #1: value-object -> domain/values/*.scala
    const voInput = deriveV1ValueObjectInput(canonicalV2, { packageName, runtimeProfile });
    if (voInput) {
      for (const [relPath, content] of Object.entries(valueObjectFamily.renderAll(voInput))) {
        written.push(writeArtifact(root, `generated-scaffold/scala/${stripAppPrefix(relPath)}`, content));
      }
    }

    // 2. Family #2: domain-entity -> domain/entities/<Agg>Entity.scala
    const deInput = deriveV1DomainEntityInput(canonicalV2, { packageName, runtimeProfile });
    if (deInput) {
      for (const [relPath, content] of Object.entries(domainEntityFamily.renderAll(deInput))) {
        written.push(writeArtifact(root, `generated-scaffold/scala/${stripAppPrefix(relPath)}`, content));
      }
    }

    // 3. Family #3: event-handler -> domain/entities/behaviors/<Agg>EventHandler.scala
    const ehInput = deriveV1EventHandlerInput(canonicalV2, { packageName });
    if (ehInput) {
      for (const [relPath, content] of Object.entries(eventHandlerFamily.renderAll(ehInput))) {
        written.push(writeArtifact(root, `generated-scaffold/scala/${stripAppPrefix(relPath)}`, content));
      }
    }

    // 4. Family #45: aggregate-invariant-rules -> domain/invariants/<Agg>Rules.scala + params/<Agg>RuleParams.scala
    const context = canonicalV2.context || canonicalV2.subdomain || 'core';
    const docId = `${canonicalV2.system || 'v2'}/${context}`;
    const { rulesInput, l2ClozeCommandsByAgg } = deriveV1AggregateRulesInput(canonicalV2, { packageName, runtimeProfile });
    const l1AggNames = new Set((rulesInput?.aggregates ?? []).map(a => a.aggregate));
    const l1CmdNamesByAgg = new Map(
      (rulesInput?.aggregates ?? []).map(a => [a.aggregate, new Set((a.commands ?? []).map(c => c.command))]),
    );
    const renderedRulesByPath = rulesInput ? aggregateInvariantRulesFamily.renderAll(rulesInput) : {};
    const nonEmptyComputationsAggs = [];

    // 5. Domain services Computations traits, Z3 checkAxioms/replay, complete Rules/RuleParams (including L2/host-delegated commands), and L2 @cloze isolation skeletons
    for (const agg of canonicalV2.structures?.aggregates ?? []) {
      const aggBehaviors = (canonicalV2.behaviors ?? []).filter(
        b => b.kind === 'slice' && b.target.split('.')[0] === agg.name,
      );
      const l1CmdSet = l1CmdNamesByAgg.get(agg.name) ?? new Set();
      const l2Entries = l2ClozeCommandsByAgg.get(agg.name) ?? [];
      const l2ByCmd = new Map(l2Entries.map(e => [e.cmd.name, e]));
      const hostCommands = (agg.commands ?? [])
        .filter(cmd => !l1CmdSet.has(cmd.name))
        .map(cmd => ({
          cmd,
          l2Target: l2ByCmd.get(cmd.name)?.behavior?.target ?? null,
        }));

      if (hostCommands.length > 0) {
        nonEmptyComputationsAggs.push(agg.name);
      }

      // Emit/patch <Agg>Rules.scala + <Agg>RuleParams.scala so EVERY declared command on the aggregate has a matching *Rule and *Params!
      const rulesRel = `app/${pkgDir}/domain/invariants/${agg.name}Rules.scala`;
      const paramsRel = `app/${pkgDir}/domain/invariants/params/${agg.name}RuleParams.scala`;
      if (l1AggNames.has(agg.name)) {
        // Hybrid aggregate: append any non-L1 host-delegated rules/params cleanly to the 1.0 emitter output
        if (hostCommands.length > 0 && renderedRulesByPath[rulesRel]) {
          const extraRules = hostCommands.map(hc => [
            `  // @knowledge source:${docId}#/aggregates/${agg.name}/commands/${hc.cmd.name}`,
            `  final class ${hc.cmd.name}Rule(hosts: ${agg.name}Computations)`,
            `      extends InvariantRule[Event, State, ${hc.cmd.name}Params] {`,
            `    override def apply(state: State, p: ${hc.cmd.name}Params): Either[iMadzError, List[Event]] =`,
            `      hosts.${toCamel(hc.cmd.name)}(state, p)`,
            '  }',
          ].join('\n')).join('\n\n');
          renderedRulesByPath[rulesRel] = renderedRulesByPath[rulesRel].replace(
            /\n\s*def checkEventPostconditions/u,
            `\n\n${extraRules}\n\n  def checkEventPostconditions`,
          );
        }
        if (hostCommands.length > 0 && renderedRulesByPath[paramsRel]) {
          const extraParams = hostCommands.map(hc => {
            const fields = (hc.cmd.parameters ?? [])
              .map(p => `${p.name}: ${v1ScalaTypeString(p.resolvedType, packageName, nominalIdx)}`)
              .join(', ');
            return `  final case class ${hc.cmd.name}Params(${fields})`;
          }).join('\n');
          renderedRulesByPath[paramsRel] = renderedRulesByPath[paramsRel].replace(
            /\n\}\s*$/u,
            `\n${extraParams}\n}\n`,
          );
        }
      } else if ((agg.commands ?? []).length > 0) {
        // L2-only / host-delegated aggregate (e.g. FundOrder): emit complete <Agg>Rules.scala + <Agg>RuleParams.scala
        written.push(writeArtifact(
          root,
          `generated-scaffold/scala/${pkgDir}/domain/invariants/${agg.name}Rules.scala`,
          generateDelegatedAggregateRules(agg, hostCommands, docId, packageName, commonPackage, nominalIdx),
        ));
        written.push(writeArtifact(
          root,
          `generated-scaffold/scala/${pkgDir}/domain/invariants/params/${agg.name}RuleParams.scala`,
          generateAllCommandRuleParams(agg, agg.commands, packageName, nominalIdx),
        ));
      }

      written.push(writeArtifact(
        root,
        `generated-scaffold/scala/${pkgDir}/domain/services/${agg.name}Computations.scala`,
        generateComputationsTrait(agg, hostCommands, packageName, commonPackage),
      ));
      if (hostCommands.length > 0) {
        written.push(writeArtifact(
          root,
          `handwritten/scala/${pkgDir}/domain/services/impl/${agg.name}ComputationsImpl.scala`,
          generateComputationsImplSkeleton(agg, hostCommands, packageName, commonPackage),
          { overwrite: overwriteCloze },
        ));
      }
      written.push(writeArtifact(
        root,
        `generated-scaffold/scala/${pkgDir}/domain/entities/${agg.name}Axioms.scala`,
        generateAggregateAxioms(agg, aggBehaviors, packageName),
      ));
      if (l2Entries.length > 0) {
        const l2Artifacts = generateL2ClozeParamsAndSkeleton(
          agg,
          l2Entries,
          packageName,
          commonPackage,
          nominalIdx,
          l1AggNames.has(agg.name),
        );
        for (const art of l2Artifacts) {
          // Avoid overwriting the full <Agg>RuleParams.scala already emitted for L2-only aggregates
          if (!art.isCloze && art.path.endsWith(`/${agg.name}RuleParams.scala`) && !l1AggNames.has(agg.name)) {
            continue;
          }
          written.push(writeArtifact(root, art.path, art.content, { overwrite: art.isCloze ? overwriteCloze : true }));
        }
      }
    }

    for (const [relPath, content] of Object.entries(renderedRulesByPath)) {
      written.push(writeArtifact(root, `generated-scaffold/scala/${stripAppPrefix(relPath)}`, content));
    }

    // 6. Application layer: application/services/<Story>Port.scala + CallerContractSpec.scala + handwritten/scala/<pkg>/application/services/<Story>Impl.scala
    const storyMap = new Map((canonicalV2.structures?.stories ?? []).map(s => [s.name, s]));
    const appBehaviors = (canonicalV2.behaviors ?? []).filter(b => b.layer === 'application');
    const anyCallerContract = appBehaviors.some(b => Boolean(storyMap.get(b.target)?.callerContract));
    if (anyCallerContract) {
      written.push(writeArtifact(
        root,
        `generated-scaffold/scala/${pkgDir}/application/services/CallerContractSpec.scala`,
        generateCallerContractSpec(packageName),
      ));
    }
    for (const beh of appBehaviors) {
      const pascal = toPascal(beh.target);
      const storyStruct = storyMap.get(beh.target) ?? null;
      written.push(writeArtifact(
        root,
        `generated-scaffold/scala/${pkgDir}/application/services/${pascal}Port.scala`,
        generateStrictApplicationPort(beh, storyStruct, canonicalV2, packageName, commonPackage),
      ));
      written.push(writeArtifact(
        root,
        `handwritten/scala/${pkgDir}/application/services/${pascal}Impl.scala`,
        generateStrictApplicationImpl(beh, packageName, commonPackage),
        { overwrite: overwriteCloze },
      ));
    }

    return {
      schemaVersion: 'co-arising.generate-v2/v1',
      target: 'scala-strict',
      architecture: '1.0-strict-governance',
      familiesUsed: ['value-object', 'domain-entity', 'event-handler', 'aggregate-invariant-rules'],
      nonEmptyComputationsAggs,
      packageName,
      canonicalSha256: canonicalV2.canonicalSha256,
      outDir: root,
      files: written,
    };
  },
});
