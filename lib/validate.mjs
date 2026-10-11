// validate.mjs — structural rules (V*) + stage vocabulary rules (ES/CS/AG/RF/SM).
//
// Philosophy carried over from the reference implementation: the tool REPORTS,
// humans decide. Hard failures block (structural breakage — they would corrupt
// the canonical projection or a generator consuming it); notices only annotate
// (modeling quality — a stage checklist for the workshop to close).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseDoc, STAGE_ORDER, STAGE_CODE, NOTE_TYPES } from './shared.mjs';

const SOLUTION_VERBS = ['create', 'save', 'update', 'delete', 'click', 'insert', 'remove', 'fetch', 'load', 'persist', 'write', 'read'];

const readAtoms = (dir, filter = () => true) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.yaml') && filter(f))
    .map((f) => ({ file: f, doc: parseDoc(readFileSync(join(dir, f), 'utf8'), f) }));
};
const producesNames = (cmd) => (cmd.produces || []).map((p) => (typeof p === 'string' ? p : p.name));

export function validateTree(treeDir) {
  const hard = [], notices = [];
  const err = (rule, msg) => hard.push(`[${rule}] ${msg}`);
  const note_ = (rule, msg) => notices.push(`[${rule}] ${msg}`);

  // ── root ──
  const root = existsSync(join(treeDir, 'workshop.yaml'))
    ? parseDoc(readFileSync(join(treeDir, 'workshop.yaml'), 'utf8'), 'workshop.yaml') : {};
  const sessionOrder = Array.isArray(root.sessionOrder) && root.sessionOrder.length
    ? root.sessionOrder : STAGE_ORDER;
  const orderSet = new Set(sessionOrder);

  // ── aggregates: header/order/event-pool closure (V4–V6, V12) + RF1–RF5 ──
  const aggDirs = existsSync(join(treeDir, 'aggregates'))
    ? readdirSync(join(treeDir, 'aggregates'), { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
  const aggNames = new Map(); // name → first dir
  const aggSeqs = new Map();
  const aggregateInfo = []; // { name, commands:Set, events:Set } for cross-atom resolution
  const sliceCommands = new Set();  // L1 resolution universe (commands)
  const poolEvents = new Set();     // L1 resolution universe (events)
  for (const d of aggDirs) {
    const dir = join(treeDir, 'aggregates', d);
    const aggFile = join(dir, 'aggregate.yaml');
    if (!existsSync(aggFile)) { err('V1', `${d}/aggregate.yaml missing`); continue; }
    let A;
    try { A = parseDoc(readFileSync(aggFile, 'utf8'), `${d}/aggregate.yaml`); }
    catch (e) { err('V1', e.message); continue; }
    if (A.kind !== 'aggregate') err('V1', `${d}: kind must be "aggregate"`);
    if (!A.name) err('V1', `${d}: name required`);
    else if (aggNames.has(A.name)) note_('AG6', `duplicate aggregate name "${A.name}" (${aggNames.get(A.name)} vs ${d})`);
    else aggNames.set(A.name, d);
    if (!Number.isInteger(Number(A.seq))) err('V12', `${d}/aggregate.yaml: seq must be an integer`);
    else if (aggSeqs.has(A.seq)) err('V12', `aggregate seq ${A.seq} collision: ${aggSeqs.get(A.seq)} vs ${d}`);
    else aggSeqs.set(A.seq, d);
    // RF1/RF2 — every aggregate carries an entity and an identifier (generator floor)
    if (!A.payload?.entity) err('RF1', `${d}: aggregate payload.entity missing (one aggregate, one entity)`);
    if (!A.payload?.identifier?.name) err('RF2', `${d}: aggregate payload.identifier missing`);
    // RF3 — fields carry a dataType
    for (const f of A.payload?.stateFields || [])
      if (!f.dataType) err('RF3', `${d}: state field "${f.name}" has no dataType`);
    const slices = readAtoms(join(dir, 'slices'), (f) => f.endsWith('.slice.yaml'));
    const sliceByCmd = new Map();
    for (const { file, doc } of slices) {
      if (doc.kind !== 'slice') { err('V1', `${file}: kind must be "slice"`); continue; }
      if (doc.aggregate !== A.name) err('V4', `${file}: header aggregate "${doc.aggregate}" ≠ "${A.name}"`);
      if (!doc.command) { err('V4', `${file}: command required`); continue; }
      if (sliceByCmd.has(doc.command)) err('V5', `${d}: duplicate slice command "${doc.command}"`);
      if (doc.payload?.name && doc.payload.name !== doc.command)
        err('V4', `${file}: payload.name "${doc.payload.name}" ≠ header command "${doc.command}"`);
      for (const p of doc.payload?.parameters || [])
        if (!p.dataType) err('RF3', `${file}: parameter "${p.name}" has no dataType`);
      if (!doc.payload?.parameters?.length)
        note_('RF5', `command "${doc.command}" declares no parameters (explicit parameterless? confirm)`);
      for (const [k, ev] of Object.entries(doc.events || {})) {
        if (ev.name !== k) err('V4', `${file}: event key "${k}" ≠ payload name "${ev.name}"`);
        if (!ev.payloads?.length) note_('RF4', `event "${k}" has an empty payload (confirm intentional)`);
        for (const pl of ev.payloads || [])
          if (!pl.dataType) err('RF3', `${file}: event "${k}" payload field "${pl.name}" has no dataType`);
      }
      sliceByCmd.set(doc.command, doc);
      sliceCommands.add(doc.command);
    }
    // V5 — order.commands ≡ slice set (both directions)
    const order = A.order || {};
    const cmdOrder = order.commands || [];
    for (const c of cmdOrder) if (!sliceByCmd.has(c)) err('V5', `${d}: order.commands lists "${c}" but no slice defines it`);
    for (const c of sliceByCmd.keys()) if (!cmdOrder.includes(c)) err('V5', `${d}: slice "${c}" is missing from order.commands`);
    // V6 — event pool closure: order.events ≡ pool (slices' events + extraEvents)
    const pool = new Map();
    for (const s of sliceByCmd.values()) for (const [k, v] of Object.entries(s.events || {})) {
      if (pool.has(k)) err('V6', `${d}: event "${k}" defined in two slices (${pool.get(k)} and ${s.command}) — full definition must live in exactly one`);
      else pool.set(k, s.command);
    }
    for (const e of A.extraEvents || []) {
      if (pool.has(e.name)) err('V6', `${d}: event "${e.name}" both in a slice and in extraEvents`);
      else pool.set(e.name, 'extraEvents');
    }
    const evOrder = order.events || [];
    for (const e of evOrder) if (!pool.has(e)) err('V6', `${d}: order.events lists "${e}" but the pool has no definition`);
    for (const e of pool.keys()) if (!evOrder.includes(e)) err('V6', `${d}: event "${e}" is defined but missing from order.events (orphan)`);
    // V6b — every produced event resolves into the pool
    for (const [c, s] of sliceByCmd)
      for (const p of producesNames(s.payload))
        if (!pool.has(p)) err('V6', `${d}: command "${c}" produces "${p}" but no event definition exists in the pool`);
    for (const e of pool.keys()) poolEvents.add(e);
    aggregateInfo.push({ name: A.name, commands: new Set(sliceByCmd.keys()), events: new Set(pool.keys()) });
  }

  // ── L1 notes: header/addressing (V1/V2/V3) + CS rules ──
  const noteAtoms = [];
  for (const stage of sessionOrder) {
    for (const { file, doc } of readAtoms(join(treeDir, 'inbox', stage))) noteAtoms.push({ file, doc, stage });
  }
  for (const d of aggDirs)
    for (const { file, doc } of readAtoms(join(treeDir, 'aggregates', d, 'notes')))
      noteAtoms.push({ file, doc, stage: doc.origin?.stage });
  for (const { file, doc } of readAtoms(join(treeDir, 'policies'), (f) => f.endsWith('.policy.yaml')))
    noteAtoms.push({ file, doc, stage: doc.origin?.stage });

  const byStageBoard = new Map();
  const tuples = new Map();
  const events = [], questions = [], commands = [], roles = [], policies = [], timers = [];
  const linkIndex = { event: new Map(), command: new Map() }; // target name → sources
  for (const { file, doc: a, stage } of noteAtoms) {
    const f = file;
    if (a.kind === 'policy') {
      if (!a.name) err('V1', `${f}: name required`);
      // V7 — structured causal contract present
      const trig = a.triggers || [], inv = a.invokes || [];
      if (!trig.length) err('V7', `${f}: triggers missing/empty (policy must declare its triggering events)`);
      if (!inv.length) err('V7', `${f}: invokes missing/empty (policy must declare the commands it calls)`);
      // V8 — dual-track agreement: payload.links ≡ triggers/invokes projection
      const want = new Set([...trig.map((t) => `event:${t.event}`), ...inv.map((c) => `command:${c.command}`)]);
      const got = new Set((a.payload?.links || []).filter((l) => /^(event|command):/.test(String(l))));
      for (const w of want) if (!got.has(w)) err('V8', `${f}: structured ${w} has no payload.links counterpart`);
      for (const g of got) if (!want.has(g)) err('V8', `${f}: payload.links ${g} has no structured counterpart (dual-track drift)`);
      if (a.payload?.info?.triggers && JSON.stringify(a.payload.info.triggers.map(({ event, aggregate }) => ({ event, aggregate }))) !== JSON.stringify(trig))
        err('V8', `${f}: payload.info.triggers ≠ triggers block`);
      if (a.payload?.info?.invokes && JSON.stringify(a.payload.info.invokes.map(({ command, aggregate }) => ({ command, aggregate }))) !== JSON.stringify(inv))
        err('V8', `${f}: payload.info.invokes ≠ invokes block`);
      policies.push({ f, a });
      continue;
    }
    if (a.kind !== 'note') { err('V1', `${f}: kind must be "note"`); continue; }
    if (!NOTE_TYPES.includes(a.type)) { err('V1', `${f}: unknown type "${a.type}"`); continue; }
    if (!a.name || a.name === '') err('V1', `${f}: name required`);
    if (!orderSet.has(a.origin?.stage)) { err('V1', `${f}: unknown stage "${a.origin?.stage}"`); continue; }
    if (file.startsWith(join(treeDir, 'inbox')) && a.origin?.stage !== stage)
      err('V2', `${f}: header stage ${a.origin?.stage} ≠ directory ${stage}`);
    const seq = Number(a.origin?.seq);
    if (!Number.isInteger(seq) || seq < 0) err('V2', `${f}: origin.seq must be a non-negative integer`);
    const board = a.origin?.board || 'board1';
    const sbKey = `${a.origin?.stage}|${board}`;
    if (!byStageBoard.has(sbKey)) byStageBoard.set(sbKey, new Map());
    const bySeq = byStageBoard.get(sbKey);
    if (bySeq.has(seq)) err('V2', `${sbKey}: seq ${seq} collision — ${bySeq.get(seq)} vs ${f}`);
    else bySeq.set(seq, f);
    const tuple = `${a.origin?.stage}|${a.type}|${a.name}|${seq}`;
    if (tuples.has(tuple)) err('V2', `duplicate atom tuple: ${tuple} (${tuples.get(tuple)} vs ${f})`);
    tuples.set(tuple, f);
    // V3 — payload/header identity
    if (a.payload?.type && a.payload.type !== a.type) err('V3', `${f}: payload.type ${a.payload.type} ≠ header ${a.type}`);
    if (a.payload?.name && a.payload.name !== a.name) err('V3', `${f}: payload.name ≠ header name`);
    if (a.payload?.stage && a.payload.stage !== a.origin?.stage) err('V3', `${f}: payload.stage ≠ origin.stage`);
    // link index (for CS1/CS3/CS7)
    for (const l of a.payload?.links || []) {
      const m = String(l).match(/^(event|command):([^@]+)/);
      if (m) {
        if (!linkIndex[m[1]].has(m[2])) linkIndex[m[1]].set(m[2], []);
        linkIndex[m[1]].get(m[2]).push(f);
      }
    }
    if (a.type === 'event') events.push({ f, a });
    if (a.type === 'question') questions.push({ f, a });
    if (a.type === 'command') commands.push({ f, a });
    if (a.type === 'role') roles.push({ f, a });
    if (a.type === 'timer' || a.type === 'externalSystem') timers.push({ f, a });
  }
  // V2 — per (stage, board) seq contiguity 0..n-1
  for (const [sbKey, bySeq] of byStageBoard) {
    const seqs = [...bySeq.keys()].sort((x, y) => x - y);
    seqs.forEach((s, idx) => { if (s !== idx) err('V2', `${sbKey}: seq must be contiguous 0..n-1 (got ${s} at position ${idx})`); });
  }

  // V9 — policy references resolve (L1 universe = notes ∪ aggregate pools)
  for (const { f, a } of policies) {
    for (const t of a.triggers || [])
      if (!events.some((e) => e.a.name === t.event) && !poolEvents.has(t.event))
        err('V9', `${f}: trigger event "${t.event}" resolves to nothing (no note, no aggregate pool)`);
    for (const c of a.invokes || [])
      if (!commands.some((x) => x.a.name === c.command) && !sliceCommands.has(c.command))
        err('V9', `${f}: invoked command "${c.command}" resolves to nothing (no note, no slice)`);
  }
  // CS7 — dangling links (report; targets must resolve to ingested notes)
  for (const { file, doc: a } of noteAtoms) {
    for (const l of a.payload?.links || []) {
      const m = String(l).match(/^(event|command|role|aggregate|readModel|question):([^@]+)/);
      if (!m) continue;
      const wantType = m[1], wantName = m[2];
      const found = noteAtoms.some(({ doc: d }) => d.kind === 'note' && d.type === wantType && d.name === wantName)
        || (wantType === 'command' && sliceCommands.has(wantName))
        || (wantType === 'event' && poolEvents.has(wantName))
        || (wantType === 'aggregate' && aggNames.has(wantName));
      if (!found) note_('CS7', `${file}: dangling link "${l}" — no ingested note with type ${wantType} name "${wantName}"`);
    }
  }

  // V3 — payload/header agreement for catalog atoms
  for (const [dirName, kind, key] of [['value-objects', 'value-object', 'valueObjects'], ['read-models', 'read-model', 'readModels'], ['stories', 'story', 'stories']]) {
    const seqs = new Map();
    for (const { file, doc } of readAtoms(join(treeDir, dirName), (f) => f.endsWith('.yaml'))) {
      if (doc.kind !== kind) { err('V1', `${file}: kind must be "${kind}"`); continue; }
      if (!doc.name) err('V1', `${file}: name required`);
      if (doc.payload?.name && doc.payload.name !== doc.name) err('V3', `${file}: payload.name ≠ header name`);
      if (!Number.isInteger(Number(doc.seq))) err('V12', `${file}: seq must be an integer`);
      else if (seqs.has(doc.seq)) err('V12', `${dirName}: seq ${doc.seq} collision — ${seqs.get(doc.seq)} vs ${file}`);
      else seqs.set(doc.seq, file);
      if (kind === 'value-object' && !Array.isArray(doc.payload?.fields))
        err('V10', `${file}: value-object payload.fields must be an array`);
      if (kind === 'read-model') {
        if (!Array.isArray(doc.payload?.fields)) err('V11', `${file}: read-model payload.fields must be an array`);
        if (doc.payload?.sourceAggregate && !aggNames.has(doc.payload.sourceAggregate))
          err('V11', `${file}: sourceAggregate "${doc.payload.sourceAggregate}" does not resolve to an aggregate`);
        for (const fl of doc.payload?.fields || [])
          if (!fl.source) err('V11', `${file}: read-model field "${fl.name}" has no source derivation`);
      }
      if (kind === 'story') {
        if (!doc.payload?.role) note_('SM2', `story "${doc.name}" has no role`);
        if (!doc.payload?.goal) note_('SM2', `story "${doc.name}" has no goal`);
      }
    }
  }
  // use-cases.yaml — single flow-model file
  for (const { file, doc } of readAtoms(treeDir, (f) => f === 'use-cases.yaml'))
    if (doc.kind !== 'use-cases') err('V1', `${file}: kind must be "use-cases"`);

  // ── stage rules: eventStorming (ES1–ES5) ──
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

  // ── stage rules: commandStorming (CS1–CS8) ──
  for (const { f, a } of events) {
    if (!linkIndex.event.has(a.name) && !linkIndex.command.has(a.name))
      note_('CS1', `event "${a.name}" has no trigger source (command/timer/externalSystem/event link): ${f}`);
    for (const l of a.payload?.links || [])
      if (String(l).startsWith('event:') && !/^event:[^@]+@(strong|eventual)$/.test(String(l)))
        note_('CS2', `event→event link "${l}" lacks @strong/@eventual annotation: ${f}`);
  }
  for (const { f, a } of commands) {
    const roleLinked = roles.some(({ a: r }) => (r.payload?.links || []).some((l) => String(l) === `command:${a.name}`));
    const policyInvoked = policies.some(({ a: p }) => (p.invokes || []).some((c) => c.command === a.name));
    if (!roleLinked && !policyInvoked)
      note_('CS3', `command "${a.name}" has no initiating role and no policy invocation: ${f}`);
  }
  for (const { f, a } of roles) {
    const triggers = (a.payload?.links || []).some((l) => String(l).startsWith('command:'));
    if (!triggers) note_('CS4', `role "${a.name}" triggers no command (dangling role): ${f}`);
  }
  for (const { a } of policies) {
    const links = a.payload?.links || [];
    if (!links.some((l) => String(l).startsWith('event:')) || !links.some((l) => String(l).startsWith('command:')))
      note_('CS5', `policy "${a.name}" links incomplete (needs ≥1 event + ≥1 command): ${a.payload?.name || ''}`);
  }
  for (const { f, a } of timers) {
    if (!(a.payload?.links || []).some((l) => String(l).startsWith('event:')))
      note_('CS6', `${a.type} "${a.name}" triggers no event (dangling): ${f}`);
  }
  // CS8 — name uniqueness per type (role exempt: same-name multi-card is the convention)
  {
    const seen = {};
    for (const { doc: a } of noteAtoms.filter(({ doc }) => doc.kind === 'note' && doc.type !== 'role')) {
      const k = `${a.type}|${a.name}`;
      seen[k] = (seen[k] || 0) + 1;
    }
    for (const [k, c] of Object.entries(seen)) if (c > 1) {
      const [t, n] = k.split('|');
      note_('CS8', `${t} "${n}" appears ${c}× — confirm merge or rename (the tool only reports)`);
    }
  }

  // ── stage rules: aggregateDiscovery coverage (AG1/AG2 — notices) ──
  const ownedCommands = new Set([...aggregateInfo.flatMap((a) => a.commands), ...sliceCommands]);
  const ownedEvents = new Set([...aggregateInfo.flatMap((a) => a.events), ...poolEvents]);
  for (const { f, a } of commands)
    if (!ownedCommands.has(a.name)) note_('AG1', `command "${a.name}" belongs to no aggregate: ${f}`);
  for (const { f, a } of events)
    if (!ownedEvents.has(a.name)) note_('AG2', `event "${a.name}" belongs to no aggregate: ${f}`);

  return { hard, notices };
}
