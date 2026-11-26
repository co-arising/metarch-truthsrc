// Orthogonal structure loader for co-arising 2.0 (structures in YAML/JSON; zero @guard allowed).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseStructuredDoc } from './yaml-parser.mjs';

const FORBIDDEN_LEGACY_KEYS = new Set([
  '@guard',
  'guard',
  'guards',
  'guardExpr',
  'expressions',
  'domainDecision',
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

// Parse concise type expressions: "Int", "String", "Bool", "Decimal(2)", "Money",
// "Map[AccountId, AmountDecimal]", "Optional[String]", "Seq[Item]"
export function parseTypeExpr(rawType, exactMap, voMap) {
  if (rawType && typeof rawType === 'object' && rawType.kind) return rawType;
  const text = String(rawType ?? '').trim();
  if (!text) return { kind: 'unknown' };

  const mapMatch = text.match(/^Map\[([^,]+),\s*(.+)\]$/u);
  if (mapMatch) {
    return {
      kind: 'map',
      key: parseTypeExpr(mapMatch[1].trim(), exactMap, voMap),
      value: parseTypeExpr(mapMatch[2].trim(), exactMap, voMap),
    };
  }
  const optMatch = text.match(/^Optional\[(.+)\]$/u);
  if (optMatch) {
    return { kind: 'optional', element: parseTypeExpr(optMatch[1].trim(), exactMap, voMap) };
  }
  const seqMatch = text.match(/^Seq\[(.+)\]$/u);
  if (seqMatch) {
    return { kind: 'sequence', element: parseTypeExpr(seqMatch[1].trim(), exactMap, voMap) };
  }
  const decMatch = text.match(/^Decimal\((\d+)\)$/u);
  if (decMatch) {
    return { kind: 'decimal', scale: Number(decMatch[1]) };
  }

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
      fields[f.name] = parseTypeExpr(f.type, exactMap, voMap);
    }
    return { kind: 'record', typeName: text, fields };
  }

  // Nominal string/ID type (e.g. AccountId, OrderId)
  return { kind: 'string', typeName: text };
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
      else if (rawDef.startsWith('"') && rawDef.endsWith('"')) defaultValue = JSON.parse(rawDef);
      else if (/^-?\d+$/u.test(rawDef)) defaultValue = Number(rawDef);
      else defaultValue = rawDef;
    }
    return { name, type, defaultValue };
  }
  return {
    name: entry.name,
    type: entry.type,
    defaultValue: entry.default ?? entry.defaultValue,
    enumValues: Array.isArray(entry.enum) ? entry.enum.map(String) : null,
  };
}

function attachEnumValues(resolvedType, enumValues) {
  if (!enumValues || enumValues.length === 0) return resolvedType;
  return { ...resolvedType, enumValues };
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

  const exactMap = new Map(exactTypes.map(e => [e.name, e]));
  const voMap = new Map();
  const normalizedVos = valueObjects.map(vo => {
    const fields = (vo.fields ?? []).map(parseFieldSpec);
    const entry = { name: vo.name, fields };
    voMap.set(vo.name, entry);
    return entry;
  });

  // Resolve value object field types
  for (const vo of normalizedVos) {
    for (const f of vo.fields) {
      f.resolvedType = attachEnumValues(parseTypeExpr(f.type, exactMap, voMap), f.enumValues);
    }
  }

  const normalizedAggregates = aggregates.map(agg => {
    const stateFields = (agg.stateFields ?? []).map(raw => {
      const parsed = parseFieldSpec(raw);
      return { ...parsed, resolvedType: attachEnumValues(parseTypeExpr(parsed.type, exactMap, voMap), parsed.enumValues) };
    });
    const commands = (agg.commands ?? []).map(cmd => ({
      name: cmd.name,
      parameters: (cmd.parameters ?? []).map(raw => {
        const parsed = parseFieldSpec(raw);
        return { ...parsed, resolvedType: attachEnumValues(parseTypeExpr(parsed.type, exactMap, voMap), parsed.enumValues) };
      }),
      produces: cmd.produces ?? [],
    }));
    const events = (agg.events ?? []).map(ev => {
      if (typeof ev === 'string') return { name: ev, fields: [] };
      return {
        name: ev.name,
        fields: (ev.fields ?? []).map(raw => {
          const parsed = parseFieldSpec(raw);
          return { ...parsed, resolvedType: attachEnumValues(parseTypeExpr(parsed.type, exactMap, voMap), parsed.enumValues) };
        }),
      };
    });
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

  const normalizedPorts = ports.map(p => ({
    name: p.name,
    operations: (p.operations ?? []).map(op => ({
      name: op.name,
      parameters: (op.parameters ?? []).map(raw => {
        const parsed = parseFieldSpec(raw);
        return { ...parsed, resolvedType: attachEnumValues(parseTypeExpr(parsed.type, exactMap, voMap), parsed.enumValues) };
      }),
      returns: op.returns ?? 'Unit',
    })),
    callerContract: p.callerContract ?? null,
  }));

  const normalizedReadModels = readModels.map(rm => ({
    name: rm.name,
    fields: (rm.fields ?? []).map(raw => {
      const parsed = parseFieldSpec(raw);
      return { ...parsed, resolvedType: attachEnumValues(parseTypeExpr(parsed.type, exactMap, voMap), parsed.enumValues) };
    }),
  }));

  const normalizedStories = stories.map(st => ({
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
    parameters: (st.parameters ?? []).map(raw => {
      const parsed = parseFieldSpec(raw);
      return { ...parsed, resolvedType: attachEnumValues(parseTypeExpr(parsed.type, exactMap, voMap), parsed.enumValues) };
    }),
  }));

  const normalizedExterns = externContracts.map(ext => ({
    name: ext.name,
    params: (ext.params ?? []).map(raw => {
      const parsed = parseFieldSpec(raw);
      return { ...parsed, resolvedType: attachEnumValues(parseTypeExpr(parsed.type, exactMap, voMap), parsed.enumValues) };
    }),
    returns: ext.returns ?? 'Bool',
    ownerPort: ext.ownerPort ?? null,
  }));

  const structures = {
    exactTypes: exactTypes.map(({ sourceFile: _sf, ...rest }) => rest),
    valueObjects: normalizedVos,
    aggregates: normalizedAggregates,
    sagas: sagas.map(({ sourceFile: _sf, ...rest }) => rest),
    readModels: normalizedReadModels,
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
      for (const f of ev.fields ?? []) fMap[f.name] = f.resolvedType;
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
  const symbolReadModels = new Set(normalizedReadModels.map(r => r.name));
  const readModelDefs = new Map(normalizedReadModels.map(r => [r.name, r]));
  const valueObjectDefs = new Map(normalizedVos.map(v => [v.name, v]));
  const portDefs = new Map(normalizedPorts.map(p => [p.name, p]));
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
