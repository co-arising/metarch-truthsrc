// Orthogonal structure loader for co-arising 2.0 (structures in YAML/JSON; zero @guard allowed).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseStructuredDoc } from './yaml-parser.mjs';
import { formatType, isTypeCompatible, validateDefaultValue } from '../ears/type-compat.mjs';

const FORBIDDEN_LEGACY_KEYS = new Set([
  '@guard',
  'guard',
  'guards',
  'guardExpr',
  'expressions',
  'domainDecision',
]);

// Common misspelled/unsupported type names that must NOT silently fall back to nominal String
const INVALID_TYPE_TYPOS = new Set([
  'int', 'integer', 'long', 'str', 'string', 'bool', 'boolean', 'decimal',
  'float', 'double', 'number', 'num', 'any', 'object', 'void', 'null', 'none',
  'Lng', 'Str', 'Int32', 'Int64', 'Float', 'Double', 'Number', 'BigDecimal', 'BigInt',
  'Date', 'DateTime', 'Timestamp', 'Any', 'Object', 'Void', 'Unknown',
  'Option', 'List', 'Array', 'Set', 'Dict', 'Map', 'Optional', 'Seq', 'Dec',
]);

function scanForbiddenLegacyKeys(node, file, pathParts = [], errors = []) {
  if (!node || typeof node !== 'object') return errors;
  if (Array.isArray(node)) {
    node.forEach((item, idx) => scanForbiddenLegacyKeys(item, file, [...pathParts, `[${idx}]`], errors));
    return errors;
  }
  for (const [key, val] of Object.entries(node)) {
    const nextPath = [...pathParts, key];
    if (FORBIDDEN_LEGACY_KEYS.has(key)) {
      errors.push({
        severity: 'error',
        code: 'V2_LEGACY_GUARD_FORBIDDEN',
        file,
        message: `legacy behavioral field "${nextPath.join('.')}" is forbidden in co-arising 2.0 structure files; declare all behavior in *.ears`,
      });
    }
    if (typeof val === 'string' && /domain-decision@4|domain-guards-v[34]/u.test(val)) {
      errors.push({
        severity: 'error',
        code: 'V2_LEGACY_GUARD_FORBIDDEN',
        file,
        message: `legacy expression schema reference "${val}" at "${nextPath.join('.')}" is forbidden in co-arising 2.0`,
      });
    }
    scanForbiddenLegacyKeys(val, file, nextPath, errors);
  }
  return errors;
}

function collectStructureFiles(inputPath) {
  const abs = resolve(inputPath);
  const st = statSync(abs);
  if (st.isFile()) return [abs];
  const files = [];
  const walk = dir => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /\.(?:yaml|yml|json)$/u.test(entry.name)) files.push(full);
    }
  };
  walk(abs);
  return files;
}

function normalizeAliases(name) {
  const lower = name.toLowerCase();
  const parts = name.replace(/([a-z0-9])([A-Z])/gu, '$1 $2').split(' ').map(s => s.toLowerCase());
  const aliases = new Set(['state', lower]);
  if (parts.length > 0) aliases.add(parts[parts.length - 1]);
  return [...aliases];
}

function splitTopLevelComma(inner) {
  let depth = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === '[' || ch === '(') depth += 1;
    else if (ch === ']' || ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) {
      return [inner.slice(0, i).trim(), inner.slice(i + 1).trim()];
    }
  }
  return null;
}

function reportUnknownType(opts, text, hint = '') {
  if (!opts?.diagnostics) return;
  const where = opts.contextLabel ? ` at ${opts.contextLabel}` : '';
  const suffix = hint ? ` (${hint})` : '';
  opts.diagnostics.push({
    severity: 'error',
    code: 'V2_UNKNOWN_TYPE',
    ...(opts.file ? { file: opts.file } : {}),
    message: `invalid or undeclared type "${text}"${where}${suffix}`,
  });
}

// Parse concise type expressions: "Int", "String", "Bool", "Decimal(2)", "Money",
// "Map[AccountId, AmountDecimal]", "Optional[String]", "Seq[Item]"
export function parseTypeExpr(rawType, exactMap, voMap, opts = {}) {
  if (rawType && typeof rawType === 'object' && rawType.kind) return rawType;
  const text = String(rawType ?? '').trim();
  if (!text) {
    reportUnknownType(opts, '', 'type expression cannot be empty');
    return { kind: 'unknown' };
  }

  if (text.startsWith('Map[') && text.endsWith(']')) {
    const inner = text.slice(4, -1).trim();
    const parts = splitTopLevelComma(inner);
    if (!parts || !parts[0] || !parts[1]) {
      reportUnknownType(opts, text, 'expected Map[KeyType, ValueType]');
      return { kind: 'unknown' };
    }
    return {
      kind: 'map',
      key: parseTypeExpr(parts[0], exactMap, voMap, opts),
      value: parseTypeExpr(parts[1], exactMap, voMap, opts),
    };
  }
  if (text.startsWith('Optional[') && text.endsWith(']')) {
    const inner = text.slice(9, -1).trim();
    if (!inner) {
      reportUnknownType(opts, text, 'expected Optional[ElementType]');
      return { kind: 'unknown' };
    }
    return { kind: 'optional', element: parseTypeExpr(inner, exactMap, voMap, opts) };
  }
  if (text.startsWith('Seq[') && text.endsWith(']')) {
    const inner = text.slice(4, -1).trim();
    if (!inner) {
      reportUnknownType(opts, text, 'expected Seq[ElementType]');
      return { kind: 'unknown' };
    }
    return { kind: 'sequence', element: parseTypeExpr(inner, exactMap, voMap, opts) };
  }
  const decMatch = text.match(/^Decimal\((\d+)\)$/u);
  if (decMatch) {
    return { kind: 'decimal', scale: Number(decMatch[1]) };
  }

  if (text === 'Unit' && opts.allowUnit) return { kind: 'unit', typeName: 'Unit' };
  if (text === 'Int' || text === 'Integer' || text === 'Long') return { kind: 'int', typeName: text };
  if (text === 'Bool' || text === 'Boolean') return { kind: 'bool', typeName: text };
  if (text === 'String') return { kind: 'string', typeName: text };
  if (text === 'Decimal') return { kind: 'decimal', scale: 2, typeName: text };

  if (exactMap.has(text)) {
    const ex = exactMap.get(text);
    if (ex.form === 'unit-decimal') {
      return {
        kind: 'record',
        typeName: text,
        exactForm: 'unit-decimal',
        fields: {
          [ex.amountField ?? 'amount']: { kind: 'decimal', scale: ex.scale },
          [ex.unitField ?? 'currency']: { kind: 'string', units: ex.units ?? [] },
        },
      };
    }
    return { kind: 'decimal', typeName: text, scale: ex.scale };
  }

  if (voMap.has(text)) {
    const vo = voMap.get(text);
    const fields = {};
    for (const f of vo.fields ?? []) {
      fields[f.name] = f.resolvedType ?? parseTypeExpr(f.type, exactMap, voMap, opts);
    }
    return { kind: 'record', typeName: text, fields };
  }

  if (opts.readModelMap?.has(text)) {
    return { kind: 'read-model', typeName: text };
  }

  // Reject malformed generic/parameterized types, whitespace, invalid symbols, or common typos
  if (/[[\]()?<>\s,;:]/u.test(text)) {
    let suggestion = 'expected Int, Long, Bool, String, Decimal(N), Optional[T], Seq[T], Map[K, V], or declared type';
    if (/^Option\[/u.test(text)) suggestion = 'use Optional[T] instead of Option[T]';
    else if (/^(?:List|Array)\[/u.test(text)) suggestion = 'use Seq[T] instead of List[T]/Array[T]';
    reportUnknownType(opts, text, suggestion);
    return { kind: 'unknown' };
  }

  if (INVALID_TYPE_TYPOS.has(text) || (text === 'Unit' && !opts.allowUnit)) {
    reportUnknownType(opts, text, 'use canonical v2 types: Int, Long, Bool, String, Decimal(N), Optional[T], Seq[T], Map[K, V]');
    return { kind: 'unknown' };
  }

  if (!/^[A-Z][A-Za-z0-9_]*$/u.test(text)) {
    reportUnknownType(opts, text, 'nominal ID types must be PascalCase identifiers (e.g. AccountId, OrderId)');
    return { kind: 'unknown' };
  }

  // If project explicitly declares a closed `nominalTypes:` list, enforce membership
  if (opts.nominalTypes && opts.nominalTypes.size > 0 && !opts.nominalTypes.has(text)) {
    reportUnknownType(opts, text, 'not registered in nominalTypes, exactTypes, or valueObjects');
    return { kind: 'unknown' };
  }

  // Nominal string/ID type (e.g. AccountId, OrderId)
  return { kind: 'string', typeName: text, nominal: true };
}

function parseFieldSpec(entry) {
  if (entry && typeof entry === 'object' && !Array.isArray(entry) && !Object.hasOwn(entry, 'name')) {
    const entries = Object.entries(entry);
    if (entries.length === 1) {
      const [fieldName, rawTypeSpec] = entries[0];
      return parseFieldSpec(`${fieldName}: ${String(rawTypeSpec ?? '').trim()}`);
    }
  }
  if (typeof entry === 'string') {
    // Support concise syntax: "minPurchase: AmountDecimal = \"0.00\""
    const m = entry.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^=]+?)(?:\s*=\s*(.+))?$/u);
    if (!m) throw new Error(`V2_STRUCTURE_ERROR: invalid field declaration "${entry}"`);
    const name = m[1].trim();
    const type = m[2].trim();
    let defaultValue;
    if (m[3] !== undefined) {
      const rawDef = m[3].trim();
      if (rawDef === '[]') defaultValue = [];
      else if (rawDef === '{}') defaultValue = {};
      else if (rawDef === 'true') defaultValue = true;
      else if (rawDef === 'false') defaultValue = false;
      else if (rawDef === 'null' || rawDef === 'none') defaultValue = null;
      else if (rawDef.startsWith('"') && rawDef.endsWith('"')) defaultValue = JSON.parse(rawDef);
      else if (/^-?\d+$/u.test(rawDef)) defaultValue = Number(rawDef);
      else defaultValue = rawDef;
    }
    return { name, type, defaultValue, enumValues: null, source: null };
  }
  return {
    name: entry.name,
    type: entry.type,
    defaultValue: entry.default ?? entry.defaultValue,
    enumValues: Array.isArray(entry.enum) ? entry.enum.map(String) : null,
    source: entry.source ? String(entry.source) : null,
  };
}

function attachEnumValues(resolvedType, enumValues) {
  if (!enumValues || enumValues.length === 0) return resolvedType;
  return { ...resolvedType, enumValues };
}

function checkDuplicates(items, getName, kindLabel, file, diagnostics) {
  const seen = new Set();
  for (const item of items ?? []) {
    const name = getName(item);
    if (!name) continue;
    if (seen.has(name)) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_DUPLICATE_DECLARATION',
        ...(item.sourceFile || file ? { file: item.sourceFile || file } : {}),
        message: `duplicate ${kindLabel} "${name}"`,
      });
    } else {
      seen.add(name);
    }
  }
}

/**
 * Unified event field resolver shared across structure-loader, binder, compiler, and TS/Scala codegen.
 * Eliminates fallback divergence when an event omits explicit `fields:`.
 */
export function resolveCanonicalEventFields(agg, ev) {
  if (!ev) return [];
  if (Array.isArray(ev.fields) && ev.fields.length > 0) return ev.fields;
  const producers = (agg?.commands ?? []).filter(c => Array.isArray(c.produces) && c.produces.includes(ev.name));
  if (producers.length > 0) return producers[0].parameters ?? [];
  return [];
}

function validateReadModelLineage(readModels, aggByName, diagnostics) {
  for (const rm of readModels) {
    const file = rm.sourceFile ?? null;
    let sourceAgg = null;
    if (rm.sourceAggregate) {
      sourceAgg = aggByName.get(rm.sourceAggregate) ?? null;
      if (!sourceAgg) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_READMODEL_UNKNOWN_SOURCE_AGGREGATE',
          ...(file ? { file } : {}),
          message: `read model "${rm.name}" references undeclared sourceAggregate "${rm.sourceAggregate}"`,
        });
      }
    }

    const findEvent = (eventRef) => {
      if (eventRef.includes('.')) {
        const [aName, eName] = eventRef.split('.');
        const agg = aggByName.get(aName);
        const ev = agg?.events.find(e => e.name === eName) ?? null;
        return agg && ev ? { agg, ev } : null;
      }
      if (sourceAgg) {
        const ev = sourceAgg.events.find(e => e.name === eventRef) ?? null;
        return ev ? { agg: sourceAgg, ev } : null;
      }
      for (const agg of aggByName.values()) {
        const ev = agg.events.find(e => e.name === eventRef);
        if (ev) return { agg, ev };
      }
      return null;
    };

    for (const evRef of rm.sourceEvents ?? []) {
      if (!findEvent(evRef)) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_READMODEL_UNKNOWN_SOURCE_EVENT',
          ...(file ? { file } : {}),
          message: `read model "${rm.name}" references undeclared sourceEvent "${evRef}"`,
        });
      }
    }

    for (const field of rm.fields ?? []) {
      if (!field.source) continue;
      const src = field.source.trim();
      if (src === 'aggregateIdentity' || src === 'derived') continue;

      if (src.startsWith('eventField:')) {
        const ref = src.slice('eventField:'.length).trim();
        const parts = ref.split('.');
        if (parts.length < 2 || parts.length > 3) {
          diagnostics.push({
            severity: 'error',
            code: 'V2_READMODEL_INVALID_SOURCE',
            ...(file ? { file } : {}),
            message: `read model "${rm.name}" field "${field.name}" has invalid eventField source "${src}" (expected eventField:<Event>.<field> or eventField:<Agg>.<Event>.<field>)`,
          });
          continue;
        }
        const evRef = parts.length === 3 ? `${parts[0]}.${parts[1]}` : parts[0];
        const fieldName = parts[parts.length - 1];
        const found = findEvent(evRef);
        if (!found) {
          diagnostics.push({
            severity: 'error',
            code: 'V2_READMODEL_UNKNOWN_SOURCE_EVENT',
            ...(file ? { file } : {}),
            message: `read model "${rm.name}" field "${field.name}" derives from undeclared event "${evRef}"`,
          });
          continue;
        }
        const evFields = resolveCanonicalEventFields(found.agg, found.ev);
        const evField = evFields.find(f => f.name === fieldName);
        if (!evField) {
          diagnostics.push({
            severity: 'error',
            code: 'V2_READMODEL_UNKNOWN_SOURCE_FIELD',
            ...(file ? { file } : {}),
            message: `read model "${rm.name}" field "${field.name}" derives from missing field "${fieldName}" on event "${found.agg.name}.${found.ev.name}"`,
          });
          continue;
        }
        if (!isTypeCompatible(evField.resolvedType, field.resolvedType, { allowOptionalWrap: true, allowNumericPromotion: false })) {
          diagnostics.push({
            severity: 'error',
            code: 'V2_READMODEL_FIELD_TYPE_MISMATCH',
            ...(file ? { file } : {}),
            message: `read model "${rm.name}" field "${field.name}" (${formatType(field.resolvedType)}) is incompatible with source "${found.agg.name}.${found.ev.name}.${fieldName}" (${formatType(evField.resolvedType)})`,
          });
        }
        continue;
      }

      if (src.startsWith('stateField:')) {
        const ref = src.slice('stateField:'.length).trim();
        const parts = ref.split('.');
        let agg = sourceAgg;
        let fieldName = ref;
        if (parts.length === 2) {
          agg = aggByName.get(parts[0]) ?? null;
          fieldName = parts[1];
        } else if (parts.length !== 1) {
          diagnostics.push({
            severity: 'error',
            code: 'V2_READMODEL_INVALID_SOURCE',
            ...(file ? { file } : {}),
            message: `read model "${rm.name}" field "${field.name}" has invalid stateField source "${src}"`,
          });
          continue;
        }
        if (!agg) {
          diagnostics.push({
            severity: 'error',
            code: 'V2_READMODEL_UNKNOWN_SOURCE_AGGREGATE',
            ...(file ? { file } : {}),
            message: `read model "${rm.name}" field "${field.name}" references stateField "${src}" without a resolved aggregate`,
          });
          continue;
        }
        const sf = agg.stateFields.find(f => f.name === fieldName);
        if (!sf) {
          diagnostics.push({
            severity: 'error',
            code: 'V2_READMODEL_UNKNOWN_SOURCE_FIELD',
            ...(file ? { file } : {}),
            message: `read model "${rm.name}" field "${field.name}" derives from missing stateField "${fieldName}" on aggregate "${agg.name}"`,
          });
          continue;
        }
        if (!isTypeCompatible(sf.resolvedType, field.resolvedType, { allowOptionalWrap: true, allowNumericPromotion: false })) {
          diagnostics.push({
            severity: 'error',
            code: 'V2_READMODEL_FIELD_TYPE_MISMATCH',
            ...(file ? { file } : {}),
            message: `read model "${rm.name}" field "${field.name}" (${formatType(field.resolvedType)}) is incompatible with source "${agg.name}.${fieldName}" (${formatType(sf.resolvedType)})`,
          });
        }
        continue;
      }

      diagnostics.push({
        severity: 'error',
        code: 'V2_READMODEL_INVALID_SOURCE',
        ...(file ? { file } : {}),
        message: `read model "${rm.name}" field "${field.name}" has unrecognized source "${src}" (use eventField:<Ev>.<f>, stateField:<Agg>.<f>, aggregateIdentity, or derived)`,
      });
    }
  }
}

function validateSagas(sagas, aggByName, exactMap, voMap, nominalTypes, diagnostics) {
  const normalized = [];
  for (const saga of sagas) {
    const file = saga.sourceFile ?? null;
    const stateFields = (saga.stateFields ?? []).map(raw => {
      const parsed = parseFieldSpec(raw);
      const rt = attachEnumValues(
        parseTypeExpr(parsed.type, exactMap, voMap, {
          diagnostics,
          file,
          contextLabel: `saga ${saga.name}.stateFields.${parsed.name}`,
          nominalTypes,
        }),
        parsed.enumValues,
      );
      const defErr = validateDefaultValue(parsed.defaultValue, rt);
      if (defErr) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_INVALID_DEFAULT_VALUE',
          ...(file ? { file } : {}),
          message: `saga "${saga.name}" state field "${parsed.name}": ${defErr}`,
        });
      }
      return { ...parsed, resolvedType: rt };
    });

    const resolveEvent = (ref) => {
      let aggName = ref?.aggregate ?? null;
      let evName = typeof ref === 'string' ? ref : ref?.event ?? null;
      if (typeof evName === 'string' && evName.includes('.')) {
        [aggName, evName] = evName.split('.');
      }
      if (!evName) return false;
      if (aggName) {
        const agg = aggByName.get(aggName);
        return Boolean(agg?.events.some(e => e.name === evName));
      }
      for (const agg of aggByName.values()) {
        if (agg.events.some(e => e.name === evName)) return true;
      }
      return false;
    };

    const resolveCommand = (ref) => {
      let aggName = ref?.aggregate ?? null;
      let cmdName = typeof ref === 'string' ? ref : ref?.command ?? null;
      if (typeof cmdName === 'string' && cmdName.includes('.')) {
        [aggName, cmdName] = cmdName.split('.');
      }
      if (!cmdName) return false;
      if (aggName) {
        const agg = aggByName.get(aggName);
        return Boolean(agg?.commands.some(c => c.name === cmdName));
      }
      for (const agg of aggByName.values()) {
        if (agg.commands.some(c => c.name === cmdName)) return true;
      }
      return false;
    };

    for (const trig of saga.triggers ?? []) {
      if (!resolveEvent(trig)) {
        const label = typeof trig === 'string' ? trig : `${trig?.aggregate ? `${trig.aggregate}.` : ''}${trig?.event ?? ''}`;
        diagnostics.push({
          severity: 'error',
          code: 'V2_SAGA_UNKNOWN_EVENT',
          ...(file ? { file } : {}),
          message: `saga "${saga.name}" triggers on undeclared event "${label}"`,
        });
      }
    }

    for (const inv of [...(saga.invokes ?? []), ...(saga.dispatches ?? [])]) {
      if (!resolveCommand(inv)) {
        const label = typeof inv === 'string' ? inv : `${inv?.aggregate ? `${inv.aggregate}.` : ''}${inv?.command ?? ''}`;
        diagnostics.push({
          severity: 'error',
          code: 'V2_SAGA_UNKNOWN_COMMAND',
          ...(file ? { file } : {}),
          message: `saga "${saga.name}" invokes undeclared command "${label}"`,
        });
      }
    }

    const { sourceFile: _sf, ...rest } = saga;
    normalized.push({
      ...rest,
      stateFields,
    });
  }
  return normalized;
}

export function loadV2Structures(structuresDir) {
  const files = collectStructureFiles(structuresDir);
  const diagnostics = [];
  const rawDocs = [];

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const doc = parseStructuredDoc(text, file);
    scanForbiddenLegacyKeys(doc, file, [], diagnostics);
    rawDocs.push({ file, doc });
  }

  let system = 'default-system';
  let context = 'default';
  const nominalTypesList = [];
  const exactTypes = [];
  const valueObjects = [];
  const aggregates = [];
  const sagas = [];
  const readModels = [];
  const ports = [];
  const stories = [];
  const externContracts = [];

  for (const { file, doc } of rawDocs) {
    if (doc.system) system = String(doc.system);
    if (doc.context) context = String(doc.context);
    if (Array.isArray(doc.nominalTypes)) {
      for (const nt of doc.nominalTypes) nominalTypesList.push(typeof nt === 'string' ? nt : String(nt?.name ?? ''));
    }
    if (Array.isArray(doc.exactTypes)) exactTypes.push(...doc.exactTypes.map(x => ({ ...x, sourceFile: file })));
    if (Array.isArray(doc.valueObjects)) valueObjects.push(...doc.valueObjects.map(x => ({ ...x, sourceFile: file })));
    if (Array.isArray(doc.aggregates)) aggregates.push(...doc.aggregates.map(x => ({ ...x, sourceFile: file })));
    if (Array.isArray(doc.sagas)) sagas.push(...doc.sagas.map(x => ({ ...x, sourceFile: file })));
    if (Array.isArray(doc.readModels)) readModels.push(...doc.readModels.map(x => ({ ...x, sourceFile: file })));
    if (Array.isArray(doc.ports)) ports.push(...doc.ports.map(x => ({ ...x, sourceFile: file })));
    if (Array.isArray(doc.stories)) stories.push(...doc.stories.map(x => ({ ...x, sourceFile: file })));
    if (Array.isArray(doc.externContracts)) externContracts.push(...doc.externContracts.map(x => ({ ...x, sourceFile: file })));

    if (doc.kind === 'context' || doc.kind === 'system') {
      if (doc.name && doc.kind === 'context') context = String(doc.name);
      if (doc.name && doc.kind === 'system') system = String(doc.name);
    } else if (doc.kind === 'exact-type') {
      exactTypes.push({ ...doc, sourceFile: file });
    } else if (doc.kind === 'value-object') {
      valueObjects.push({ ...doc, sourceFile: file });
    } else if (doc.kind === 'aggregate') {
      aggregates.push({ ...doc, sourceFile: file });
    } else if (doc.kind === 'saga') {
      sagas.push({ ...doc, sourceFile: file });
    } else if (doc.kind === 'read-model') {
      readModels.push({ ...doc, sourceFile: file });
    } else if (doc.kind === 'port') {
      ports.push({ ...doc, sourceFile: file });
    } else if (doc.kind === 'story') {
      stories.push({ ...doc, sourceFile: file });
    }
  }

  // Check top-level duplicates
  checkDuplicates(exactTypes, x => x.name, 'exactType', null, diagnostics);
  checkDuplicates(valueObjects, x => x.name, 'valueObject', null, diagnostics);
  checkDuplicates(aggregates, x => x.name, 'aggregate', null, diagnostics);
  checkDuplicates(readModels, x => x.name, 'readModel', null, diagnostics);
  checkDuplicates(ports, x => x.name, 'port', null, diagnostics);
  checkDuplicates(stories, x => x.name, 'story', null, diagnostics);
  checkDuplicates(externContracts, x => x.name, 'externContract', null, diagnostics);
  checkDuplicates(sagas, x => x.name, 'saga', null, diagnostics);

  const nominalTypes = new Set(nominalTypesList.filter(Boolean));
  const exactMap = new Map(exactTypes.map(e => [e.name, e]));
  const voMap = new Map();
  const normalizedVos = valueObjects.map(vo => {
    const fields = (vo.fields ?? []).map(parseFieldSpec);
    checkDuplicates(fields, f => f.name, `valueObject "${vo.name}" field`, vo.sourceFile, diagnostics);
    const entry = { name: vo.name, fields, sourceFile: vo.sourceFile };
    voMap.set(vo.name, entry);
    return entry;
  });

  // Resolve value object field types & validate defaults
  for (const vo of normalizedVos) {
    for (const f of vo.fields) {
      f.resolvedType = attachEnumValues(
        parseTypeExpr(f.type, exactMap, voMap, {
          diagnostics,
          file: vo.sourceFile,
          contextLabel: `valueObject ${vo.name}.${f.name}`,
          nominalTypes,
        }),
        f.enumValues,
      );
      const defErr = validateDefaultValue(f.defaultValue, f.resolvedType);
      if (defErr) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_INVALID_DEFAULT_VALUE',
          ...(vo.sourceFile ? { file: vo.sourceFile } : {}),
          message: `valueObject "${vo.name}" field "${f.name}": ${defErr}`,
        });
      }
    }
  }

  const normalizedAggregates = aggregates.map(agg => {
    const file = agg.sourceFile;
    const stateFields = (agg.stateFields ?? []).map(raw => {
      const parsed = parseFieldSpec(raw);
      const rt = attachEnumValues(
        parseTypeExpr(parsed.type, exactMap, voMap, {
          diagnostics,
          file,
          contextLabel: `aggregate ${agg.name}.stateFields.${parsed.name}`,
          nominalTypes,
        }),
        parsed.enumValues,
      );
      const defErr = validateDefaultValue(parsed.defaultValue, rt);
      if (defErr) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_INVALID_DEFAULT_VALUE',
          ...(file ? { file } : {}),
          message: `aggregate "${agg.name}" stateField "${parsed.name}": ${defErr}`,
        });
      }
      return { ...parsed, resolvedType: rt };
    });
    checkDuplicates(stateFields, f => f.name, `aggregate "${agg.name}" stateField`, file, diagnostics);

    const commands = (agg.commands ?? []).map(cmd => {
      const parameters = (cmd.parameters ?? []).map(raw => {
        const parsed = parseFieldSpec(raw);
        const rt = attachEnumValues(
          parseTypeExpr(parsed.type, exactMap, voMap, {
            diagnostics,
            file,
            contextLabel: `command ${agg.name}.${cmd.name}.${parsed.name}`,
            nominalTypes,
          }),
          parsed.enumValues,
        );
        const defErr = validateDefaultValue(parsed.defaultValue, rt);
        if (defErr) {
          diagnostics.push({
            severity: 'error',
            code: 'V2_INVALID_DEFAULT_VALUE',
            ...(file ? { file } : {}),
            message: `command "${agg.name}.${cmd.name}" parameter "${parsed.name}": ${defErr}`,
          });
        }
        return { ...parsed, resolvedType: rt };
      });
      checkDuplicates(parameters, p => p.name, `command "${agg.name}.${cmd.name}" parameter`, file, diagnostics);
      return {
        name: cmd.name,
        parameters,
        produces: cmd.produces ?? [],
      };
    });
    checkDuplicates(commands, c => c.name, `aggregate "${agg.name}" command`, file, diagnostics);

    const events = (agg.events ?? []).map(ev => {
      if (typeof ev === 'string') return { name: ev, fields: [] };
      const fields = (ev.fields ?? []).map(raw => {
        const parsed = parseFieldSpec(raw);
        const rt = attachEnumValues(
          parseTypeExpr(parsed.type, exactMap, voMap, {
            diagnostics,
            file,
            contextLabel: `event ${agg.name}.${ev.name}.${parsed.name}`,
            nominalTypes,
          }),
          parsed.enumValues,
        );
        const defErr = validateDefaultValue(parsed.defaultValue, rt);
        if (defErr) {
          diagnostics.push({
            severity: 'error',
            code: 'V2_INVALID_DEFAULT_VALUE',
            ...(file ? { file } : {}),
            message: `event "${agg.name}.${ev.name}" field "${parsed.name}": ${defErr}`,
          });
        }
        return { ...parsed, resolvedType: rt };
      });
      checkDuplicates(fields, f => f.name, `event "${agg.name}.${ev.name}" field`, file, diagnostics);
      return { name: ev.name, fields };
    });
    checkDuplicates(events, e => e.name, `aggregate "${agg.name}" event`, file, diagnostics);

    // Validate command.produces references exist in aggregate.events
    const eventNameSet = new Set(events.map(e => e.name));
    for (const cmd of commands) {
      for (const prodEv of cmd.produces ?? []) {
        if (!eventNameSet.has(prodEv)) {
          diagnostics.push({
            severity: 'error',
            code: 'V2_UNKNOWN_PRODUCED_EVENT',
            ...(file ? { file } : {}),
            message: `command "${agg.name}.${cmd.name}" lists undeclared event "${prodEv}" in produces`,
          });
        }
      }
    }

    // Warn/error if an event omits explicit `fields:` and multiple producer commands disagree on parameters
    for (const ev of events) {
      if (ev.fields.length === 0) {
        const producers = commands.filter(c => c.produces.includes(ev.name));
        if (producers.length > 1) {
          const sigs = new Set(producers.map(c => JSON.stringify(c.parameters.map(p => [p.name, formatType(p.resolvedType)]))));
          if (sigs.size > 1) {
            diagnostics.push({
              severity: 'error',
              code: 'V2_AMBIGUOUS_IMPLICIT_EVENT_FIELDS',
              ...(file ? { file } : {}),
              message: `event "${agg.name}.${ev.name}" omits explicit fields: but is produced by multiple commands with different parameter schemas (${producers.map(c => c.name).join(', ')}); declare explicit fields: on "${ev.name}"`,
            });
          }
        }
      }
    }

    const aliases = Array.isArray(agg.aliases) && agg.aliases.length > 0
      ? agg.aliases
      : normalizeAliases(agg.name);

    return {
      name: agg.name,
      aliases,
      idField: agg.idField ?? 'id',
      stateFields,
      commands,
      events,
      ruleRefs: agg.ruleRefs ?? {},
    };
  });

  const normalizedReadModels = readModels.map(rm => {
    const file = rm.sourceFile;
    const fields = (rm.fields ?? []).map(raw => {
      const parsed = parseFieldSpec(raw);
      const rt = attachEnumValues(
        parseTypeExpr(parsed.type, exactMap, voMap, {
          diagnostics,
          file,
          contextLabel: `readModel ${rm.name}.${parsed.name}`,
          nominalTypes,
        }),
        parsed.enumValues,
      );
      return { ...parsed, resolvedType: rt };
    });
    checkDuplicates(fields, f => f.name, `readModel "${rm.name}" field`, file, diagnostics);
    return {
      name: rm.name,
      ...(rm.sourceAggregate ? { sourceAggregate: String(rm.sourceAggregate) } : {}),
      ...(Array.isArray(rm.sourceEvents) && rm.sourceEvents.length > 0 ? { sourceEvents: rm.sourceEvents.map(String) } : {}),
      fields,
      sourceFile: file,
    };
  });

  const readModelMap = new Map(normalizedReadModels.map(r => [r.name, r]));

  const normalizedPorts = ports.map(p => {
    const file = p.sourceFile;
    const operations = (p.operations ?? []).map(op => {
      const parameters = (op.parameters ?? []).map(raw => {
        const parsed = parseFieldSpec(raw);
        const rt = attachEnumValues(
          parseTypeExpr(parsed.type, exactMap, voMap, {
            diagnostics,
            file,
            contextLabel: `port ${p.name}.${op.name}.${parsed.name}`,
            nominalTypes,
          }),
          parsed.enumValues,
        );
        return { ...parsed, resolvedType: rt };
      });
      checkDuplicates(parameters, param => param.name, `port "${p.name}.${op.name}" parameter`, file, diagnostics);
      const returns = op.returns ?? 'Unit';
      const returnsResolvedType = parseTypeExpr(returns, exactMap, voMap, {
        diagnostics,
        file,
        contextLabel: `port ${p.name}.${op.name}.returns`,
        allowUnit: true,
        readModelMap,
        nominalTypes,
      });
      return {
        name: op.name,
        parameters,
        returns,
        returnsResolvedType,
      };
    });
    checkDuplicates(operations, op => op.name, `port "${p.name}" operation`, file, diagnostics);
    return {
      name: p.name,
      operations,
      callerContract: p.callerContract ?? null,
    };
  });

  const portDefs = new Map(normalizedPorts.map(p => [p.name, p]));

  const normalizedStories = stories.map(st => {
    const file = st.sourceFile;
    const parameters = (st.parameters ?? []).map(raw => {
      const parsed = parseFieldSpec(raw);
      const rt = attachEnumValues(
        parseTypeExpr(parsed.type, exactMap, voMap, {
          diagnostics,
          file,
          contextLabel: `story ${st.name}.${parsed.name}`,
          nominalTypes,
        }),
        parsed.enumValues,
      );
      return { ...parsed, resolvedType: rt };
    });
    checkDuplicates(parameters, param => param.name, `story "${st.name}" parameter`, file, diagnostics);
    return {
      name: st.name,
      description: st.description ?? '',
      entryPort: st.entryPort ?? null,
      entryOperation: st.entryOperation ?? null,
      queryPort: st.queryPort ?? null,
      dispatches: st.dispatches ?? [],
      pins: st.pins ?? [],
      responses: st.responses ?? [],
      views: st.views ?? [],
      callerContract: st.callerContract ?? null,
      parameters,
    };
  });

  const normalizedExterns = externContracts.map(ext => {
    const file = ext.sourceFile;
    const params = (ext.params ?? []).map(raw => {
      const parsed = parseFieldSpec(raw);
      const rt = attachEnumValues(
        parseTypeExpr(parsed.type, exactMap, voMap, {
          diagnostics,
          file,
          contextLabel: `extern ${ext.name}.${parsed.name}`,
          nominalTypes,
        }),
        parsed.enumValues,
      );
      return { ...parsed, resolvedType: rt };
    });
    const returns = ext.returns ?? 'Bool';
    const returnsResolvedType = parseTypeExpr(returns, exactMap, voMap, {
      diagnostics,
      file,
      contextLabel: `extern ${ext.name}.returns`,
      nominalTypes,
    });
    const ownerPort = ext.ownerPort ?? null;
    if (ownerPort && !portDefs.has(ownerPort)) {
      diagnostics.push({
        severity: 'error',
        code: 'V2_UNKNOWN_OWNER_PORT',
        ...(file ? { file } : {}),
        message: `extern contract "${ext.name}" references undeclared ownerPort "${ownerPort}"`,
      });
    }
    return {
      name: ext.name,
      params,
      returns,
      returnsResolvedType,
      ownerPort,
    };
  });

  const aggByName = new Map(normalizedAggregates.map(a => [a.name, a]));
  validateReadModelLineage(normalizedReadModels, aggByName, diagnostics);
  const normalizedSagas = validateSagas(sagas, aggByName, exactMap, voMap, nominalTypes, diagnostics);

  const cleanVos = normalizedVos.map(({ sourceFile: _sf, ...rest }) => rest);
  const cleanReadModels = normalizedReadModels.map(({ sourceFile: _sf, ...rest }) => rest);

  const structures = {
    ...(nominalTypes.size > 0 ? { nominalTypes: [...nominalTypes] } : {}),
    exactTypes: exactTypes.map(({ sourceFile: _sf, ...rest }) => rest),
    valueObjects: cleanVos,
    aggregates: normalizedAggregates,
    sagas: normalizedSagas,
    readModels: cleanReadModels,
    ports: normalizedPorts,
    stories: normalizedStories,
    externContracts: normalizedExterns,
  };

  // Build symbol table directly consumable by lib/ears/binder.mjs (zero translation bridge)
  const symbolAggs = new Map();
  for (const agg of normalizedAggregates) {
    const stateFields = {};
    for (const sf of agg.stateFields) stateFields[sf.name] = sf.resolvedType;
    const commands = new Map();
    for (const cmd of agg.commands) {
      const params = {};
      for (const p of cmd.parameters) params[p.name] = p.resolvedType;
      commands.set(cmd.name, { name: cmd.name, params, produces: cmd.produces });
    }
    const events = new Set(agg.events.map(e => e.name));
    const eventFields = new Map();
    for (const ev of agg.events) {
      const fMap = {};
      for (const f of resolveCanonicalEventFields(agg, ev)) fMap[f.name] = f.resolvedType;
      eventFields.set(ev.name, fMap);
    }
    const ruleRefs = new Map(Object.entries(agg.ruleRefs ?? {}));
    symbolAggs.set(agg.name, {
      name: agg.name,
      aliases: agg.aliases,
      stateFields,
      commands,
      events,
      eventFields,
      ruleRefs,
    });
  }

  const symbolStories = new Map(normalizedStories.map(s => [s.name, s]));
  const symbolReadModels = new Set(cleanReadModels.map(r => r.name));
  const readModelDefs = new Map(cleanReadModels.map(r => [r.name, r]));
  const valueObjectDefs = new Map(cleanVos.map(v => [v.name, v]));
  const externDefs = new Map(normalizedExterns.map(e => [e.name, e]));

  const symbolTable = {
    aggregates: symbolAggs,
    stories: symbolStories,
    readModels: symbolReadModels,
    readModelDefs,
    valueObjectDefs,
    portDefs,
    externDefs,
    exactMap,
    nominalTypes,
  };

  return {
    system,
    context,
    files,
    structures,
    symbolTable,
    diagnostics,
  };
}
