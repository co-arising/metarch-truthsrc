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
// as live — the generator template consumes the scan output verbatim.
const vectorViews = [];
{
  const fieldsByParent = new Map();
  for (const sess of Object.values(metarch.sessions ?? {})) {
    for (const sc of Object.values(sess?.scopes ?? {})) {
      for (const n of sc?.notes ?? []) {
        const i = n?.info ?? {};
        if (i.kind === 'readModelField' && i.parent) {
          if (!fieldsByParent.has(i.parent)) fieldsByParent.set(i.parent, []);
          fieldsByParent.get(i.parent).push({ name: n.name, dataType: String(i.dataType || 'String'), isKey: !!i.isKey });
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

fs.writeFileSync(canonicalPath, JSON.stringify(canonical, null, 2) + '\n');
console.log(`[augment-api] roleLinkNotes=${roleLinkNotes.length} readModels=${canonical.readModels.length} viewFieldNotes=${viewFieldNotes.length} viewKeyRenames=${canonical.viewKeyRenames.length} paramOrigins=${Object.keys(paramOrigins).length} viewNoteIds=${Object.keys(viewNoteIds).length} mongoViewNames=${mongoViewNames.length} vectorViews=${vectorViews.length} → ${canonicalPath}`);
