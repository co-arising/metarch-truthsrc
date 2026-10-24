// graphstore.mjs — SQLite-class local embedded graph store (node:sqlite, zero npm deps).
//
// The store is a pure cache projection of exactly one canonical.json: rebuild = delete
// the file and run `truthsrc graph` again (I4 no hidden state; no timestamps, no source
// of truth). Content sets are deterministic for a given canonical (sorted inserts, seq-
// numbered edges); the db file's byte layout belongs to SQLite and is not a contract.
//
// graphFromStore() reconstructs the full buildGraph() shape — {nodes, edges, canonical,
// sliceCommands, poolEvents, noteEvents, noteCommands, diagnostics} — so every query
// verb runs against the reopened store unchanged (parity is asserted in the tests).
import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildGraph } from './query.mjs';

// node:sqlite is a built-in only from Node 22.5; the rest of truthsrc still runs on
// Node >= 18. Import lazily so the toolchain baseline is untouched and the failure
// names the requirement instead of surfacing a bare unknown-builtin error.
let DatabaseSync;
try { ({ DatabaseSync } = await import('node:sqlite')); }
catch { throw new Error('lib/graphstore.mjs requires Node >= 22.5 (built-in node:sqlite)'); }

export const GRAPHSTORE_VERSION = 'truthsrc.graphstore/v1';

const SCHEMA = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE nodes (id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL,
  atom TEXT NOT NULL, extra TEXT);
CREATE TABLE edges (seq INTEGER PRIMARY KEY, from_id TEXT NOT NULL, relation TEXT NOT NULL, to_id TEXT NOT NULL);
CREATE INDEX edges_from ON edges(from_id);
CREATE INDEX edges_to ON edges(to_id);
`;

const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;

const canonicalSha256 = canonical =>
  `sha256:${createHash('sha256').update(JSON.stringify(stable(canonical))).digest('hex')}`;

const METAS = [
  'schemaVersion', 'workshop', 'canonicalSha256', 'nodeCount', 'edgeCount',
  'canonical', 'sliceCommands', 'poolEvents', 'noteEvents', 'noteCommands', 'diagnostics',
];

function assertPlainObject(canonical) {
  if (!canonical || typeof canonical !== 'object' || Array.isArray(canonical)
    || Object.getPrototypeOf(canonical) !== Object.prototype) {
    throw new Error('graphstore requires a plain canonical object (truthsrc/v1 projection)');
  }
}

/** Build (or rebuild) the single-file store for one canonical projection. */
export function buildGraphStore(canonical, { file } = {}) {
  assertPlainObject(canonical);
  if (typeof file !== 'string' || !file.trim()) throw new Error('graphstore requires an output file path');
  const graph = buildGraph(canonical);
  const tmp = `${file}.building`;
  mkdirSync(dirname(file), { recursive: true });
  rmSync(tmp, { force: true });
  const db = new DatabaseSync(tmp);
  try {
    db.exec(SCHEMA);
    db.exec('BEGIN');
    const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    const node = db.prepare('INSERT INTO nodes (id, kind, name, atom, extra) VALUES (?, ?, ?, ?, ?)');
    const edge = db.prepare('INSERT INTO edges (seq, from_id, relation, to_id) VALUES (?, ?, ?, ?)');
    const json = value => JSON.stringify([...value].sort());
    meta.run('schemaVersion', GRAPHSTORE_VERSION);
    meta.run('workshop', String(canonical.workshop ?? ''));
    meta.run('canonicalSha256', canonicalSha256(canonical));
    meta.run('nodeCount', String(graph.nodes.size));
    meta.run('edgeCount', String(graph.edges.length));
    meta.run('canonical', JSON.stringify(canonical));
    meta.run('sliceCommands', json(graph.sliceCommands));
    meta.run('poolEvents', json(graph.poolEvents));
    meta.run('noteEvents', json(graph.noteEvents));
    meta.run('noteCommands', json(graph.noteCommands));
    meta.run('diagnostics', JSON.stringify(graph.diagnostics ?? []));
    for (const id of [...graph.nodes.keys()].sort()) {
      const { id: _id, kind, name, atom, ...extra } = graph.nodes.get(id);
      node.run(id, kind, name, JSON.stringify(atom),
        Object.keys(extra).length ? JSON.stringify(extra) : null);
    }
    const ordered = graph.edges.map((e, seq) => ({ seq, ...e }))
      .sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1
        : a.relation < b.relation ? -1 : a.relation > b.relation ? 1
        : a.to < b.to ? -1 : a.to > b.to ? 1 : a.seq - b.seq);
    ordered.forEach(({ seq, from, relation, to }) => edge.run(seq, from, relation, to));
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* close wins */ }
    throw error;
  } finally {
    db.close();
  }
  rmSync(file, { force: true });
  renameSync(tmp, file);
  return { file, schemaVersion: GRAPHSTORE_VERSION, workshop: String(canonical.workshop ?? ''),
    nodeCount: graph.nodes.size, edgeCount: graph.edges.length, canonicalSha256: canonicalSha256(canonical) };
}

function metaMap(db) {
  const meta = new Map(db.prepare('SELECT key, value FROM meta').all().map(row => [row.key, row.value]));
  for (const key of METAS) if (!meta.has(key)) throw new Error(`graphstore meta missing ${key}`);
  if (meta.get('schemaVersion') !== GRAPHSTORE_VERSION) {
    throw new Error(`graphstore schema mismatch: file=${meta.get('schemaVersion')} expected=${GRAPHSTORE_VERSION}`);
  }
  return meta;
}

/** Store summary without materializing the graph. */
export function readStoreMeta(file) {
  const db = new DatabaseSync(file);
  try { return Object.fromEntries(metaMap(db)); } finally { db.close(); }
}

/** Reopen a store as a full buildGraph()-shaped graph object (all verbs apply unchanged). */
export function graphFromStore(file) {
  const db = new DatabaseSync(file);
  try {
    const meta = metaMap(db);
    const nodes = new Map(db.prepare('SELECT id, kind, name, atom, extra FROM nodes ORDER BY id').all()
      .map(row => [row.id, {
        id: row.id, kind: row.kind, name: row.name, atom: JSON.parse(row.atom),
        ...(row.extra != null ? JSON.parse(row.extra) : {}),
      }]));
    const edges = db.prepare('SELECT from_id, relation, to_id FROM edges ORDER BY seq').all()
      .map(row => ({ from: row.from_id, relation: row.relation, to: row.to_id }));
    const set = key => new Set(JSON.parse(meta.get(key)));
    return {
      nodes, edges,
      canonical: JSON.parse(meta.get('canonical')),
      sliceCommands: set('sliceCommands'), poolEvents: set('poolEvents'),
      noteEvents: set('noteEvents'), noteCommands: set('noteCommands'),
      diagnostics: JSON.parse(meta.get('diagnostics')),
    };
  } finally { db.close(); }
}
