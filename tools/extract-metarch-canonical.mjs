#!/usr/bin/env node
// extract-metarch-canonical.mjs — project ONE metarch aggregate from a backend-codegen
// IngestedSystem knowledge export (out/kn-system-metadata-v<N>.json) into the truthsrc
// scala-cqrs-es canonical schema + an elementHashes sidecar.
//
// This is a porting/fixture aid, NOT part of the shipped generator. It reads the assembled
// `fieldTree.aggregates[<name>]` (the generator's authoritative fieldModel consumption layer)
// and the `elementHashes` map, applying ONLY structural projection — all code-shaping decisions
// (naming, imports, neutral values, anchor layout) stay in the generator. The byte-identity gate
// against live CodegenMain output validates the extractor + generator jointly.
//
// Mapping rules (derived from the proven Subdomain canonical + live CodegenMain goldens):
//   • dataType normalize: "String (UUID)" → "string (uuid)" (scalaSig→Id); inside collections
//     UUID→"Id"; "List<X>"→"List[norm(X)]"; "Map<K,V>"→"Map[norm(K), norm(V)]"; "JSON"→"String".
//   • identifier is prepended as stateFields[0] (its noteId = fieldTree.identifier.noteId).
//   • commands: write commands sorted alphabetically, then a synthesized Get<Name>State query last.
//     write reply = <Cmd>Reply(error: Option[iMadzError]); query reply = Get<Name>StateReply(state).
//   • command params carry name/dataType/noteId only (NO description — Protocol/Factory @param
//     render no description); state fields & event payloads carry description too.
//   • events sorted alphabetically; payloads/folds in fieldTree order; foldAssignments verbatim.
//   • VO-typed fields/payloads get typeImport = <pkg>.<ctx>.domain.values.<VO>.
//   • aggregate-level noteId (concept anchor) = the `type:aggregate` note's noteId.
//
// Usage:
//   node tools/extract-metarch-canonical.mjs \
//     --export /path/to/kn-system-metadata-v55.json --aggregate ModelCatalog \
//     --out golden/scala-cqrs-es-metarch/model-catalog.canonical.json \
//     --hashes golden/scala-cqrs-es-metarch/model-catalog.elementHashes.json \
//     [--pkg net.imadz] [--ctx metarch] [--release 1.0.0]

import fs from 'node:fs';

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt;
}

const exportPath = arg('export');
const aggName = arg('aggregate');
const outPath = arg('out');
const hashesPath = arg('hashes');
const pkg = arg('pkg', 'net.imadz');
const ctx = arg('ctx', 'metarch');
const release = arg('release', '1.0.0');

if (!exportPath || !aggName || !outPath || !hashesPath) {
  console.error('missing required args: --export --aggregate --out --hashes');
  process.exit(2);
}

const exp = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
const ft = exp.fieldTree;
const agg = ft?.aggregates?.find((a) => a.name === aggName);
if (!agg) {
  console.error(`aggregate ${aggName} not found in fieldTree.aggregates`);
  process.exit(2);
}
const voNames = new Set((ft.valueObjects ?? []).map((v) => v.name));
const aggNote = (exp.notes ?? []).find((n) => n.type === 'aggregate' && n.name === aggName);
const voFqn = (vo) => `${pkg}.${ctx}.domain.values.${vo}`;

// --- dataType normalization (fieldTree raw → canonical) -------------------------------------
const isUuid = (s) => /^string\s*\(uuid\)$/i.test(String(s).trim());
// inner (inside a collection): UUID→Id, JSON→String, else verbatim
function normInner(dt) {
  const s = String(dt).trim();
  if (isUuid(s)) return 'Id';
  if (s === 'JSON') return 'String';
  return normalize(s);
}
// top-level scalar: UUID→"string (uuid)" (scalaSig maps to Id), JSON→String, else verbatim
function normScalar(dt) {
  const s = String(dt).trim();
  if (isUuid(s)) return 'string (uuid)';
  if (s === 'JSON') return 'String';
  return s;
}
function normalize(dt) {
  const s = String(dt).trim();
  let m = s.match(/^List<(.+)>$/);
  if (m) return `List[${normInner(m[1])}]`;
  m = s.match(/^(Seq|Set|Vector)<(.+)>$/);
  if (m) return `${m[1]}[${normInner(m[2])}]`;
  m = s.match(/^Map<(.+),(.+)>$/);
  if (m) return `Map[${normInner(m[1])}, ${normInner(m[2])}]`;
  return normScalar(s);
}

// VO FQN referenced by a canonical type signature (first VO name present), else null.
function voImportFor(sig) {
  const tokens = String(sig).split(/[\[\],\s]+/).filter(Boolean);
  for (const t of tokens) if (voNames.has(t)) return voFqn(t);
  return null;
}

// --- projections ----------------------------------------------------------------------------
function stateField(f) {
  const sig = normalize(f.dataType);
  const o = { name: f.name, dataType: sig };
  if (f.description) o.description = f.description;
  if (f.noteId) o.noteId = f.noteId;
  const imp = voImportFor(sig);
  if (imp) o.typeImport = imp;
  return o;
}
function payloadField(p) {
  const sig = normalize(p.dataType);
  const o = { name: p.name, dataType: sig };
  if (p.description) o.description = p.description;
  if (p.noteId) o.noteId = p.noteId;
  const imp = voImportFor(sig);
  if (imp) o.typeImport = imp;
  return o;
}
// command params carry NO description (Protocol/Factory @param render no description)
function commandParam(p) {
  const sig = normalize(p.dataType);
  const o = { name: p.name, dataType: sig };
  if (p.noteId) o.noteId = p.noteId;
  const imp = voImportFor(sig);
  if (imp) o.typeImport = imp;
  return o;
}

// --- assemble canonical aggregate -----------------------------------------------------------
const idName = agg.identifier.name;
const idType = isUuid(agg.identifier.dataType) ? 'string (uuid)' : normScalar(agg.identifier.dataType);

// state fields: identifier prepended, then fieldTree.stateFields in order
const idStateField = { name: idName, dataType: idType };
if (agg.identifier.noteId) idStateField.noteId = agg.identifier.noteId;
const stateFields = [idStateField, ...(agg.stateFields ?? []).map(stateField)];

// write commands sorted alphabetically; then a synthesized Get<Name>State query command
const writeCommands = (agg.commands ?? [])
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((c) => ({
    name: c.name,
    parameters: (c.parameters ?? []).map(commandParam),
    reply: { name: `${c.name}Reply`, fields: [{ name: 'error', type: 'Option[iMadzError]' }] },
  }));
const queryCommand = {
  name: `Get${aggName}State`,
  readOnly: true,
  parameters: [{ name: idName, dataType: idType }],
  reply: { name: `Get${aggName}StateReply`, fields: [{ name: 'state', type: `${aggName}State` }] },
};
const commands = [...writeCommands, queryCommand];

// events sorted alphabetically; payloads/folds in fieldTree order
const events = (agg.events ?? [])
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((e) => ({
    name: e.name,
    payloads: (e.payloads ?? []).map(payloadField),
    foldAssignments: (e.foldAssignments ?? []).map((f) => ({ slot: f.slot, expr: f.expr })),
  }));

// factory: name defaults to create<Name>WithInitialValue; params = the init command's params
// (first non-readOnly with params, i.e. the alphabetically-first write command) minus replyTo.
const initCmd = writeCommands.find((c) => (c.parameters ?? []).length > 0);
const factoryMethods = initCmd
  ? [{
      name: `create${aggName}WithInitialValue`,
      params: initCmd.parameters.map((p) => ({ name: p.name, dataType: p.dataType })),
    }]
  : [];

const canonical = {
  schemaVersion: 'truthsrc/v1',
  workshop: ctx,
  knowledgeRelease: release,
  framework: { base: `${pkg}.common` },
  sessions: [],
  aggregates: [
    {
      name: aggName,
      pkg,
      ctxPackage: ctx,
      entity: agg.entity ?? `${aggName}Entity`,
      identifier: idName,
      identifierType: idType,
      noteId: aggNote?.noteId,
      commandFamily: `${aggName}CommandFamily`,
      persistence: { typeKey: aggName, tagCount: 1, tagPrefix: `${aggName}Tag` },
      commands,
      behaviors: [],
      factoryMethods,
      events,
      stateFields,
      stateHelpers: [],
      repository: { finders: [] },
    },
  ],
  valueObjects: [],
  readModels: [],
  stories: [],
};

// --- elementHashes sidecar: subset of the export map for every noteId this aggregate uses ----
const noteIds = new Set();
const collect = (o) => {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach(collect); return; }
  for (const [k, v] of Object.entries(o)) {
    if (k === 'noteId' && typeof v === 'string') noteIds.add(v);
    else collect(v);
  }
};
collect(canonical);
const hashes = {};
for (const id of [...noteIds].sort()) {
  if (exp.elementHashes?.[id]) hashes[id] = exp.elementHashes[id];
}

fs.writeFileSync(outPath, JSON.stringify(canonical, null, 2) + '\n');
fs.writeFileSync(hashesPath, JSON.stringify(hashes, null, 2) + '\n');
console.log(`wrote ${outPath} (${commands.length} commands, ${events.length} events, ${stateFields.length} state fields)`);
console.log(`wrote ${hashesPath} (${Object.keys(hashes).length} / ${noteIds.size} noteIds resolved to hashes)`);

