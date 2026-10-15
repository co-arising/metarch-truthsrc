#!/usr/bin/env node
// augment-api-canonical.mjs — attach the api-face raw inputs (V4-4 inc11 / Fork A) to an
// already-extracted scala-cqrs-es canonical, in place. Porting/fixture aid, NOT shipped.
//
// The api face (gen_api_layer family) is a GLOBAL face: ViewKeys / CommandRoleMap / CommandDsl
// cover the whole workshop corpus, not one aggregate. Its semantic discoveries (role co-links,
// view read-roles, the ③-layer field-note gate, kebab view-key renaming) belong to the generator;
// the fixtures carry the RAW inputs it derives them from:
//   • roleLinkNotes: [{type, name, links}] — every note that can participate in the roles(c)
//     co-link derivation (any role:/command: link, or type role/command/readModel). Mechanical
//     filter only; the generator ports the three co-link forms + the S2-88 read/write split.
//   • readModels: the ③-layer readModels face, as-is (story.readmodels.json entries: name,
//     fields, decisionSupport, sourceAggregates, …). The generator gates it (S2-56 field-note
//     gate) before any view-key / role-map derivation.
//   • viewFieldNotes: [{name, info:{parent, dataType}}] — type:'field' notes carrying
//     info.parent (the S2-56 gate's annotated-view registry + dataType 富化 source).
//   • viewKeyRenames: [{old, new}] — the viewkey rename map entries (project-level config;
//     generator resolves old kebab keys through it, unmapped keys pass through idempotently).
//   • paramOrigins: {"<Agg>.<Cmd>.<param>": origin} — the ④-layer template origin registry
//     (fields.template.json), only entries with a truthy origin. Drives the B2 origin lane
//     (SYSTEM_GENERATED r1 minting / SYSTEM_QUERIED enricher assembly) in the controller face.
//   • viewNoteIds: {viewName: noteId} — the ①-layer metarch readModel note ids (live's
//     noteIdOfKey.get(`readModel:<name>`), first-wins in session→scope→note order). S7 #1b
//     anchor source for the read side (ViewApi endpoints + ViewWrites OWrites); views without
//     a metarch readModel note (PauseProjectDecisionView) resolve to null → bare, matching live.
//   • mongoViewNames: [viewName] — readModel notes declaring info.storage.kind === 'mongo'
//     (视图存储重设计 2026-10-08). Drives the list-endpoint engine axis (findByTenantPaged vs
//     findAll helper) in the ViewApi face.
//   • vectorViews: [{name, noteId, storage, refCodes, fields, sourceTypes}] — the M3 vector
//     read-model scan (V4-13), the truthsrc analogue of live's shared collectVectorViews
//     (vector_truth_source.mjs): readModel notes declaring info.storage.kind === 'vector',
//     scanned DIRECTLY from the ①-layer metarch notes (不经 readmodels.json ③层门 — the
//     27-decision-view face and the vector corpus stay unmixed). fields = child notes with
//     info.kind === 'readModelField' && info.parent; sourceTypes = the literals assigned to
//     sourceType in the note's projectionRefCodes (mechanical extraction, not hardcoded).
//   • projectionViews: [{name, noteId, events, aggregates, refCodes, updateOnlyEvents,
//     storage?, fields}] — the projection face's ①-layer inputs (V4-14): EVERY ①-layer
//     readModel note (43 = 44 live defs − the handwritten KnInstanceProjection, which has no
//     note). events = the note's `event:` links in LINK ORDER (the composite-dispatcher wiring
//     order — NOT the projectionRefCodes key order: CollisionResolved rides the links but has
//     no refCode and its handler stays handwritten); aggregates = the `aggregate:` links
//     (first-appearance unique — index 0 is the primary/source aggregate); storage rides raw
//     when info.storage is declared (mongo/graph/vector dispatch). fields = child
//     readModelField notes in declaration order with {name, dataType, isKey, noteId,
//     description} — the engine's rmFields (AssemblyEngine readStores source; UNGATED — the
//     ③-layer gate is a readmodels.json concern, not the ①-layer face).
//   • graphViews: [{name, noteId, storage, fields, refCodes}] — the S2-65 graph-card scan
//     (the truthsrc analogue of live's graph_truth_source.mjs): readModel notes declaring
//     info.storage.kind === 'graph'. fields = child readModelField names (the nodeProps set).
//   • eventAgg: {eventName: aggregateBase} — event → owning aggregate base, derived from the
//     canonical's own aggregates[].events roster (drives the projection defs' per-event entity
//     FQN / proto package / multi-aggregate grouping).
//
// Usage:
//   node tools/augment-api-canonical.mjs \
//     --canonical  golden/scala-cqrs-es-metarch/model-catalog.canonical.json \
//     --metarch    /path/to/metarch.json \
//     --readmodels /path/to/story.readmodels.json \
//     --rename-map /path/to/viewkey_rename_map.json \
//     [--template  /path/to/metarch.fields.template.json]

import fs from 'node:fs';

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt;
}

const canonicalPath = arg('canonical');
const metarchPath = arg('metarch');
const readmodelsPath = arg('readmodels');
const renameMapPath = arg('rename-map');

if (!canonicalPath || !metarchPath || !readmodelsPath || !renameMapPath) {
  console.error('missing required args: --canonical --metarch --readmodels --rename-map');
  process.exit(2);
}

const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
const metarch = JSON.parse(fs.readFileSync(metarchPath, 'utf8'));
const readmodels = JSON.parse(fs.readFileSync(readmodelsPath, 'utf8'));
const renameMap = JSON.parse(fs.readFileSync(renameMapPath, 'utf8'));
const templatePath = arg('template');
const template = templatePath ? JSON.parse(fs.readFileSync(templatePath, 'utf8')) : null;

// --- roleLinkNotes: mechanical participant filter (compact co-link raw material) ------------
// Mirrors rolemap_export.collectNotes' traversal (type string + links array), keeping only
// derivation participants: any role:/command: link, or type role/command/readModel.
const roleLinkNotes = [];
{
  const visit = (node) => {
    if (Array.isArray(node)) { for (const x of node) visit(x); return; }
    if (node && typeof node === 'object') {
      if (typeof node.type === 'string' && Array.isArray(node.links)) {
        const participates = node.links.some((l) => typeof l === 'string' && (/^role:/.test(l) || /^command:/.test(l)))
          || node.type === 'role' || node.type === 'command' || node.type === 'readModel';
        if (participates) roleLinkNotes.push({ type: node.type, name: node.name ?? null, links: node.links });
      }
      for (const v of Object.values(node)) if (v && typeof v === 'object') visit(v);
    }
  };
  visit(metarch);
}

// --- viewFieldNotes: the S2-56 gate's raw registry (type:'field' notes with info.parent) ----
const viewFieldNotes = [];
for (const sess of Object.values(metarch.sessions ?? {})) {
  for (const sc of Object.values(sess.scopes ?? {})) {
    for (const n of sc.notes ?? []) {
      if (n?.type === 'field' && n.info && typeof n.info.parent === 'string') {
        viewFieldNotes.push({ name: n.name, info: { parent: n.info.parent, ...(n.info.dataType != null ? { dataType: n.info.dataType } : {}) } });
      }
    }
  }
}

canonical.roleLinkNotes = roleLinkNotes;
canonical.readModels = readmodels.readModels ?? [];
// gatedReadModels: the ③-layer gate + dataType enrichment RESULT (V4-14) — the table-channel
// handler rewriter's input face (gen_projection_handlers consumes gated views; declaration
// order preserved). Same gate port the api face uses (S2-56 field-note gate).
const { gateViews } = await import('../generators/scala-cqrs-es-api/builders/rolemap.mjs');
canonical.gatedReadModels = gateViews(canonical.readModels, viewFieldNotes, { tool: 'augment-api-canonical' });
canonical.viewFieldNotes = viewFieldNotes;
canonical.viewKeyRenames = (renameMap.entries ?? []).map((e) => ({ old: e.old, new: e.new }));

// paramOrigins: ④-layer template origin registry (B2 origin lane input) — keyed
// "<Agg>.<Cmd>.<param>", only truthy origins travel.
const paramOrigins = {};
if (template) {
  for (const a of template.aggregates ?? []) {
    for (const c of a.commands ?? []) {
      for (const p of c.parameters ?? []) {
        if (p.origin) paramOrigins[`${a.name}.${c.name}.${p.name}`] = p.origin;
      }
    }
  }
}
canonical.paramOrigins = paramOrigins;

// --- viewNoteIds + mongoViewNames: the read side's ①-layer metarch inputs -------------------
// Same traversal shape as the live gen_api_layer index (sessions → scopes → notes, in order);
// Object.values over the file-shaped sessions/scopes preserves array order, so first-wins
// resolves identically to live's noteIdOfKey.
const viewNoteIds = {};
const mongoViewNames = [];
for (const sess of Object.values(metarch.sessions ?? {})) {
  for (const sc of Object.values(sess?.scopes ?? {})) {
    for (const n of sc?.notes ?? []) {
      if (!n || typeof n !== 'object') continue;
      if (n.type === 'readModel') {
        if (n.noteId && !(n.name in viewNoteIds)) viewNoteIds[n.name] = n.noteId;
        if (n.info?.storage?.kind === 'mongo' && !mongoViewNames.includes(n.name)) mongoViewNames.push(n.name);
      }
    }
  }
}
canonical.viewNoteIds = viewNoteIds;
canonical.mongoViewNames = mongoViewNames;

// --- vectorViews: the M3 vector read-model scan (V4-13) -------------------------------------
// Mirrors live vector_truth_source.collectVectorViews over the same file-shaped traversal
// (sessions → scopes → notes, document order). refCodes ride along RAW (the DDL face needs
// them later); sourceTypes extraction stays mechanical (regex over refCodes literals), same
// as live — the generator template consumes the scan output verbatim. V4-14: fields gain
// noteId + description (the vector repo Table companion's @param anchors).
const vectorViews = [];
{
  const fieldsByParent = new Map();
  for (const sess of Object.values(metarch.sessions ?? {})) {
    for (const sc of Object.values(sess?.scopes ?? {})) {
      for (const n of sc?.notes ?? []) {
        const i = n?.info ?? {};
        if (i.kind === 'readModelField' && i.parent) {
          if (!fieldsByParent.has(i.parent)) fieldsByParent.set(i.parent, []);
          fieldsByParent.get(i.parent).push({
            name: n.name,
            dataType: String(i.dataType || 'String'),
            isKey: !!i.isKey,
            ...(n.noteId ? { noteId: n.noteId } : {}),
            ...(n.description ? { description: n.description } : {}),
          });
        }
      }
    }
  }
  for (const sess of Object.values(metarch.sessions ?? {})) {
    for (const sc of Object.values(sess?.scopes ?? {})) {
      for (const n of sc?.notes ?? []) {
        const i = n?.info ?? {};
        if (n?.type !== 'readModel' || !i.storage || i.storage.kind !== 'vector') continue;
        vectorViews.push({
          name: n.name,
          ...(n.noteId ? { noteId: n.noteId } : {}),
          storage: i.storage,
          refCodes: i.projectionRefCodes ?? {},
          fields: fieldsByParent.get(n.name) ?? [],
          sourceTypes: [...new Set([...Object.values(i.projectionRefCodes ?? {})]
            .flatMap((expr) => [...String(expr).matchAll(/sourceType\s*=\s*"([^"]+)"/g)].map((m) => m[1])))],
        });
      }
    }
  }
}
canonical.vectorViews = vectorViews;

// --- projection face inputs (V4-14): projectionViews + graphViews + eventAgg -----------------
// Traversal mirrors the live engine's note order (sessions → scopes → notes, document order).
const childFieldsByParent = new Map(); // parent view name → child readModelField notes (in order)
const allReadModelNotes = [];
for (const sess of Object.values(metarch.sessions ?? {})) {
  for (const sc of Object.values(sess?.scopes ?? {})) {
    for (const n of sc?.notes ?? []) {
      if (!n || typeof n !== 'object') continue;
      const i = n?.info ?? {};
      if (i.kind === 'readModelField' && typeof i.parent === 'string') {
        if (!childFieldsByParent.has(i.parent)) childFieldsByParent.set(i.parent, []);
        childFieldsByParent.get(i.parent).push({
          name: n.name,
          dataType: String(i.dataType || 'String'),
          isKey: !!i.isKey,
          ...(n.noteId ? { noteId: n.noteId } : {}),
          ...(n.description ? { description: n.description } : {}),
        });
      }
      if (n.type === 'readModel') allReadModelNotes.push(n);
    }
  }
}
const projectionViews = allReadModelNotes.map((n) => {
  const events = (n.links ?? []).filter((l) => typeof l === 'string' && l.startsWith('event:')).map((l) => l.slice('event:'.length));
  const aggregates = [...new Set((n.links ?? []).filter((l) => typeof l === 'string' && l.startsWith('aggregate:')).map((l) => l.slice('aggregate:'.length)))];
  return {
    name: n.name,
    ...(n.noteId ? { noteId: n.noteId } : {}),
    events,
    aggregates,
    refCodes: n.info?.projectionRefCodes ?? {},
    updateOnlyEvents: n.info?.updateOnlyEvents ?? [],
    ...(n.info?.storage ? { storage: n.info.storage } : {}),
    fields: childFieldsByParent.get(n.name) ?? [],
  };
});
canonical.projectionViews = projectionViews;

const graphViews = projectionViews
  .filter((v) => v.storage?.kind === 'graph')
  .map((v) => ({ name: v.name, ...(v.noteId ? { noteId: v.noteId } : {}), storage: v.storage, fields: v.fields.map((f) => f.name), refCodes: v.refCodes }));
canonical.graphViews = graphViews;

// eventAgg: event → owning aggregate base. Three sources, later wins: the ①-layer event
// notes' `aggregate:` links, the --event-agg sidecar (workshop-subset fixtures: their roster
// is partial while the projection face is global), and the canonical's own aggregates[].events
// (complete for the corpus canonical — 136/136).
const eventAgg = {};
{
  const seen = new Set();
  for (const sess of Object.values(metarch.sessions ?? {})) {
    for (const sc of Object.values(sess?.scopes ?? {})) {
      for (const n of sc?.notes ?? []) {
        if (n?.type !== 'event' || !n.name || seen.has(n.name)) continue;
        seen.add(n.name);
        const agg = (n.links ?? []).find((l) => typeof l === 'string' && l.startsWith('aggregate:'));
        if (agg) eventAgg[n.name] = agg.slice('aggregate:'.length);
      }
    }
  }
}
const eventAggPath = arg('event-agg');
if (eventAggPath) Object.assign(eventAgg, JSON.parse(fs.readFileSync(eventAggPath, 'utf8')));
// stateRoster: the corpus aggregate roster snapshot ({name, identifier, noteId, stateFields})
// — workshop-subset fixtures carry a 1-aggregate roster while the S1 state face is global.
const stateRosterPath = arg('state-roster');
const stateRoster = stateRosterPath ? JSON.parse(fs.readFileSync(stateRosterPath, 'utf8')) : null;
for (const a of canonical.aggregates ?? []) {
  for (const e of a.events ?? []) {
    if (e.name) eventAgg[e.name] = a.name;
  }
}
canonical.eventAgg = eventAgg;

// eventNoteIds: event → ①-layer note id (first-wins in document order). The handler rows'
// knowledge identity = their consuming EVENT's id (S7 #1c — handler = 「该事件在此视图上的投影」).
const eventNoteIds = {};
{
  const seen = new Set();
  for (const sess of Object.values(metarch.sessions ?? {})) {
    for (const sc of Object.values(sess?.scopes ?? {})) {
      for (const n of sc?.notes ?? []) {
        if (n?.type !== 'event' || !n.name || seen.has(n.name)) continue;
        seen.add(n.name);
        if (n.noteId) eventNoteIds[n.name] = n.noteId;
      }
    }
  }
}
for (const a of canonical.aggregates ?? []) {
  for (const e of a.events ?? []) {
    if (e.name && e.noteId) eventNoteIds[e.name] = e.noteId;
  }
}
canonical.eventNoteIds = eventNoteIds;
if (stateRoster) canonical.stateRoster = stateRoster;

fs.writeFileSync(canonicalPath, JSON.stringify(canonical, null, 2) + '\n');
console.log(`[augment-api] roleLinkNotes=${roleLinkNotes.length} readModels=${canonical.readModels.length} viewFieldNotes=${viewFieldNotes.length} viewKeyRenames=${canonical.viewKeyRenames.length} paramOrigins=${Object.keys(paramOrigins).length} viewNoteIds=${Object.keys(viewNoteIds).length} mongoViewNames=${mongoViewNames.length} vectorViews=${vectorViews.length} projectionViews=${projectionViews.length} graphViews=${graphViews.length} eventAgg=${Object.keys(eventAgg).length} → ${canonicalPath}`);
