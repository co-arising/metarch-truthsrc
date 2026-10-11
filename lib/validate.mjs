// validate.mjs — structural rules (V*) + stage vocabulary rules (ES1–ES5 first).
//
// Philosophy carried over from the reference implementation: the tool REPORTS,
// humans decide. Hard failures block; notices only annotate.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseAtom, STAGE_ORDER, NOTE_TYPES } from './shared.mjs';

const SOLUTION_VERBS = ['create', 'save', 'update', 'delete', 'click', 'insert', 'remove', 'fetch', 'load', 'persist', 'write', 'read'];

export function validateTree(treeDir) {
  const hard = [], notices = [];
  const err = (rule, msg) => hard.push(`[${rule}] ${msg}`);
  const note_ = (rule, msg) => notices.push(`[${rule}] ${msg}`);

  // V1/V2 — atoms: header shape, known stage/type, seq contiguity, filename tuple
  const tuples = new Map();
  const events = [], questions = [];
  for (const stage of STAGE_ORDER) {
    const dir = join(treeDir, 'inbox', stage);
    if (!existsSync(dir)) continue;
    const bySeq = new Map();
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.yaml'))) {
      let a;
      try { a = parseAtom(readFileSync(join(dir, f), 'utf8'), f); }
      catch (e) { err('V1', e.message); continue; }
      if (a.kind !== 'note') err('V1', `${f}: kind must be "note" (v0)`);
      if (!NOTE_TYPES.includes(a.type)) err('V1', `${f}: unknown type "${a.type}"`);
      if (!a.name || a.name === '""') err('V1', `${f}: name required`);
      if (!STAGE_ORDER.includes(a.origin?.stage)) err('V1', `${f}: unknown stage "${a.origin?.stage}"`);
      if (a.origin?.stage !== stage) err('V2', `${f}: header stage ${a.origin?.stage} ≠ directory ${stage}`);
      const seq = Number(a.origin?.seq);
      if (!Number.isInteger(seq) || seq < 0) err('V2', `${f}: origin.seq must be a non-negative integer`);
      else {
        if (bySeq.has(seq)) err('V2', `${stage}: seq ${seq} collision — ${bySeq.get(seq)} vs ${f}`);
        bySeq.set(seq, f);
      }
      const tuple = `${stage}|${a.type}|${a.name}|${seq}`;
      if (tuples.has(tuple)) err('V2', `duplicate atom tuple: ${tuple} (${tuples.get(tuple)} vs ${f})`);
      tuples.set(tuple, f);
      if (a.type === 'event') events.push({ f, a });
      if (a.type === 'question') questions.push({ f, a });
    }
    const seqs = [...bySeq.keys()].sort((x, y) => x - y);
    seqs.forEach((s, idx) => { if (s !== idx) err('V2', `${stage}: seq must be contiguous 0..n-1 (got ${s} at position ${idx})`); });
  }

  // V3 — payload/header agreement (payload is verbatim, but its identity keys must match)
  const all = [...events, ...questions];
  for (const { f, a } of all) {
    if (a.payload?.type && a.payload.type !== a.type) err('V3', `${f}: payload.type ${a.payload.type} ≠ header ${a.type}`);
    if (a.payload?.name && a.payload.name !== JSON.parse(a.name)) err('V3', `${f}: payload.name ≠ header name`);
    if (a.payload?.stage && a.payload.stage !== a.origin.stage) err('V3', `${f}: payload.stage ${a.payload.stage} ≠ origin.stage ${a.origin.stage}`);
  }

  // Stage rules — eventStorming (ES1–ES5); further stages land with their schemas.
  const hasEvents = events.length > 0 || questions.length > 0;
  if (hasEvents) {
    for (const { f, a } of events) {
      if (!a.payload?.description || !String(a.payload.description).trim())
        err('ES1', `event lacks a business description: ${f}`);
      if (!a.payload?.info?.timeline)
        err('ES2', `event lacks timeline position (cannot enter the sparse matrix): ${f}`);
    }
    const byName = {};
    for (const { a } of events) byName[a.name] = (byName[a.name] || 0) + 1;
    for (const [n, c] of Object.entries(byName)) if (c > 1)
      note_('ES3', `same event name appears ${c}×: "${n}" — confirm merge or rename (the tool only reports)`);
    for (const { a } of events)
      if (SOLUTION_VERBS.some((v) => a.name.toLowerCase().includes(v)))
        note_('ES4', `possible solution language: "${a.name}" — confirm this is a business fact, not an implementation`);
    for (const { f, a } of questions) {
      const links = a.payload?.links || [];
      if (links.length && !links.some((l) => String(l).startsWith('event:')))
        err('ES5', `dangling hotspot (no event link): ${f}`);
    }
  }
  return { hard, notices };
}
