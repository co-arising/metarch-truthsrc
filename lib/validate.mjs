// validate.mjs — structural rules (V*) + stage vocabulary rules (ES/CS/AG/RF/SM).
//
// Philosophy carried over from the reference implementation: the tool REPORTS,
// humans decide. Hard failures block (structural breakage — they would corrupt
// the canonical projection or a generator consuming it); notices only annotate
// (modeling quality — a stage checklist for the workshop to close).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { validateExecutionDeclarations } from './execution/compile.mjs';
import { parseDoc, STAGE_ORDER, STAGE_CODE, NOTE_TYPES, listInboxStages, slug,
         RELATION_REGISTRY, relationByName } from './shared.mjs';

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

  // ── v0.5 pre-pass: read-model id index (R2 needs it before the notes loop) ──
  const readModelIds = new Map(); // id → file
  for (const { file, doc } of readAtoms(join(treeDir, 'read-models'), (f) => f.endsWith('.yaml'))) {
    const id = doc.payload?.id || doc.name;
    if (id) readModelIds.set(String(id), file);
  }

  // ── aggregates: header/order/event-pool closure (V4–V6, V12) + RF1–RF5 ──
  const aggDirs = existsSync(join(treeDir, 'aggregates'))
    ? readdirSync(join(treeDir, 'aggregates'), { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
  const aggNames = new Map(); // name → first dir
  const aggSeqs = new Map();
  const aggWithSeq = []; // dirs whose aggregate.yaml carries seq (for SEQ1)
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
    // V12 (v0.4): `seq` is OPTIONAL — "which aggregate is #n" is compiler-derived,
    // not tree content. When present it must be an integer and collision-free;
    // the compiler orders by seq only when every aggregate carries one,
    // otherwise by directory name.
    if (A.seq !== undefined && A.seq !== null) {
      if (!Number.isInteger(Number(A.seq))) err('V12', `${d}/aggregate.yaml: seq must be an integer`);
      else if (aggSeqs.has(A.seq)) err('V12', `aggregate seq ${A.seq} collision: ${aggSeqs.get(A.seq)} vs ${d}`);
      else aggSeqs.set(A.seq, d);
      aggWithSeq.push(d);
    }
    // RF1/RF2 — every aggregate carries an entity and an identifier (generator floor)
    if (!A.payload?.entity) err('RF1', `${d}: aggregate payload.entity missing (one aggregate, one entity)`);
    if (!A.payload?.identifier?.name) err('RF2', `${d}: aggregate payload.identifier missing`);
    // RF3 — fields carry a dataType; Map-typed state (P4 state deepening) must be Map[K, V]
    for (const f of A.payload?.stateFields || []) {
      if (!f.dataType) { err('RF3', `${d}: state field "${f.name}" has no dataType`); continue; }
      if (/^Map\s*\[/.test(f.dataType)) {
        const inner = f.dataType.slice(f.dataType.indexOf('[') + 1, f.dataType.lastIndexOf(']'));
        const parts = inner.split(',').map((s) => s.trim());
        if (parts.length !== 2 || parts.some((p) => !p))
          err('RF3', `${d}: state field "${f.name}" Map dataType must be "Map[K, V]" with exactly two member types`);
      }
    }
    const slices = readAtoms(join(dir, 'slices'), (f) => f.endsWith('.slice.yaml'));
    const sliceByCmd = new Map();
    // V13 resolution universes: command parameters and the aggregate state
    // (stateFields + identifier — the identifier folds into generated state).
    const stateNames = new Set([
      ...(A.payload?.stateFields || []).map((f) => f.name),
      A.payload?.identifier?.name,
    ].filter(Boolean));
    // mode: 'binding' (emission rows), 'fold' (foldAssignments), 'guard' (command guard expressions).
    // event.<slot> and state.<field>[<key>] are fold-only (folds are pure (state, event) replays);
    // receipt.<slot> is binding-only (P1). Guards read the command-side universe (param/state/literal).
    const checkExpr = (expr, params, where, owned, payloadNames, mode = 'binding') => {
      if (typeof expr !== 'string') { err('V13', `${where}: expr must be a string`); return; }
      if (expr.startsWith('literal:')) return;
      const idx = /^state\.([A-Za-z0-9_-]+)\[(param|event)\.([A-Za-z0-9_-]+)\]$/.exec(expr);
      if (idx) {
        if (mode !== 'fold') { err('V13', `${where}: indexed "state.<field>[...]" is fold-only`); return; }
        if (!stateNames.has(idx[1])) { err('V13', `${where}: "${expr}" does not resolve to aggregate state (stateFields/identifier)`); return; }
        if (idx[2] === 'param') {
          if (!owned) { note_('V13', `${where}: "${expr}" has no owning command in extraEvents`); return; }
          if (!params.has(idx[3])) err('V13', `${where}: "${expr}" does not resolve to command parameters`);
        } else if (payloadNames == null || !payloadNames.has(idx[3])) {
          err('V13', `${where}: "${expr}" does not resolve to this event's payload slots`);
        }
        return;
      }
      const m = /^(param|state|receipt|event)\.([A-Za-z0-9_-]+)$/.exec(expr);
      if (!m) { err('V13', `${where}: unknown expression form "${expr}" (expected state.<field>, param.<parameter>, receipt.<slot>, event.<slot>, state.<field>[<key>], literal:<value>)`); return; }
      if (m[1] === 'event') {
        // event.<slot>: the folded event's own payload — fold-only by construction
        // (a binding emitting from the event being emitted would be circular).
        if (mode !== 'fold') { err('V13', `${where}: "event." is fold-only (bindings emit from command-side values)`); return; }
        if (payloadNames == null || !payloadNames.has(m[2])) err('V13', `${where}: "${expr}" does not resolve to this event's payload slots`); return;
      }
      if (m[1] === 'state') {
        if (!stateNames.has(m[2])) err('V13', `${where}: "${expr}" does not resolve to aggregate state (stateFields/identifier)`); return;
      }
      if (m[1] === 'receipt') {
        // receipt.<slot>: the producing operation's durable receipt value,
        // recorded in this event's own payload slot. Bindings only — a fold
        // assignment reads into state and has no receipt source.
        if (mode !== 'binding') { err('V13', `${where}: "receipt." is bindings-only`); return; }
        if (payloadNames == null) { err('V13', `${where}: "${expr}" is not allowed in foldAssignments (bindings only)`); return; }
        if (!payloadNames.has(m[2])) err('V13', `${where}: "${expr}" does not resolve to this event's payload slots`); return;
      }
      // param.<parameter>: resolvable only where an owning command exists.
      // extraEvents (saga-completion facts like result-* bindings) have no
      // owning command — annotate, never guess a resolution universe.
      if (!owned) { note_('V13', `${where}: "${expr}" has no owning command in extraEvents (saga-completion? confirm intentional)`); return; }
      if (!params.has(m[2])) err('V13', `${where}: "${expr}" does not resolve to command parameters`);
    };
    const FOLD_OPS = new Set(['set', 'put', 'remove', 'money-apply']);
    const checkRows = (rows, params, where, owned, payloadNames, mode = 'binding') =>
      (rows || []).forEach((r) => {
        if (mode !== 'fold' || (r.op === undefined && r.expr !== undefined)) {
          if (r.op !== undefined) { err('V13', `${where} slot "${r.slot}": structured op rows are foldAssignments-only`); return; }
          checkExpr(r.expr, params, `${where} slot "${r.slot}"`, owned, payloadNames, mode);
          return;
        }
        // Structured fold row (P4 state deepening): {slot, op, key?, value?, delta?, sign?}
        const op = r.op;
        const slot = r.slot;
        if (typeof slot !== 'string' || !slot) { err('V13', `${where}: structured fold row requires a string slot`); return; }
        if (!FOLD_OPS.has(op)) { err('V13', `${where} fold slot "${slot}": unknown op "${op}" (set|put|remove|money-apply)`); return; }
        const field = (name, kind) => {
          const v = r[name];
          if (v === undefined) { err('V13', `${where} fold slot "${slot}": op "${op}" requires "${name}"`); return; }
          if (kind === 'expr') checkExpr(v, params, `${where} fold slot "${slot}" ${name}`, owned, payloadNames, 'fold');
          else if (kind === 'sign' && v !== 1 && v !== -1) err('V13', `${where} fold slot "${slot}": sign must be 1 or -1`);
        };
        if (op === 'set') field('expr', 'expr');
        else if (op === 'put') { field('key', 'expr'); field('value', 'expr'); }
        else if (op === 'remove') field('key', 'expr');
        else if (op === 'money-apply') { field('delta', 'expr'); field('sign', 'sign'); }
      });
    // Structured command guards (P4): closed condition forms over the command-side
    // universe. Declaration order is the evaluation order (golden-master semantics).
    // Legacy SCHEMA guard kinds (statusTransition / invariantRef / initialized /
    // expression — the loan trees predate P4) remain authoring-surface passthrough:
    // only guards carrying the structured `when` form are closed-form validated.
    const GUARD_FORMS = new Set(['money-positive', 'money-sufficient', 'map-contains', 'map-absent']);
    const checkGuards = (guards, params, where) => (guards || []).forEach((g, gi) => {
      if (g.kind !== undefined || g.when === undefined) return;
      const w = `${where} guard[${gi}]`;
      if (typeof g.ruleId !== 'string' || !g.ruleId) err('V13', `${w}: ruleId required`);
      if (typeof g.errCode !== 'string' || !g.errCode) err('V13', `${w}: errCode required`);
      const onFail = g.onFail === undefined ? 'reject' : g.onFail;
      if (onFail !== 'reject' && onFail !== 'succeed-empty') err('V13', `${w}: onFail must be "reject" or "succeed-empty"`);
      const when = g.when;
      if (!GUARD_FORMS.has(when.form)) { err('V13', `${w}: unknown guard form "${when.form}"`); return; }
      const guardExpr = (name) => checkExpr(when[name], params, `${w} ${name}`, true, null, 'guard');
      if (when.form === 'money-positive') guardExpr('amount');
      else if (when.form === 'money-sufficient') {
        guardExpr('amount');
        if (!stateNames.has(when.in)) err('V13', `${w}: "in" does not resolve to aggregate state (stateFields/identifier)`);
      } else {
        if (!stateNames.has(when.map)) err('V13', `${w}: "map" does not resolve to aggregate state (stateFields/identifier)`);
        guardExpr('key');
      }
    });
    for (const { file, doc } of slices) {
      if (doc.kind !== 'slice') { err('V1', `${file}: kind must be "slice"`); continue; }
      if (doc.aggregate !== A.name) err('V4', `${file}: header aggregate "${doc.aggregate}" ≠ "${A.name}"`);
      if (!doc.command) { err('V4', `${file}: command required`); continue; }
      if (sliceByCmd.has(doc.command)) err('V5', `${d}: duplicate slice command "${doc.command}"`);
      if (doc.payload?.name && doc.payload.name !== doc.command)
        err('V4', `${file}: payload.name "${doc.payload.name}" ≠ header command "${doc.command}"`);
      const paramNames = new Set((doc.payload?.parameters || []).map((p) => p.name));
      for (const p of doc.payload?.parameters || [])
        if (!p.dataType) err('RF3', `${file}: parameter "${p.name}" has no dataType`);
      if (!doc.payload?.parameters?.length)
        note_('RF5', `command "${doc.command}" declares no parameters (explicit parameterless? confirm)`);
      for (const [k, ev] of Object.entries(doc.events || {})) {
        if (ev.name !== k) err('V4', `${file}: event key "${k}" ≠ payload name "${ev.name}"`);
        if (!ev.payloads?.length) note_('RF4', `event "${k}" has an empty payload (confirm intentional)`);
        for (const pl of ev.payloads || [])
          if (!pl.dataType) err('RF3', `${file}: event "${k}" payload field "${pl.name}" has no dataType`);
        const payloadSet = new Set((ev.payloads || []).map((p) => p.name));
        // V13: slice-owned events resolve exprs against the owning command;
        // bindings may also use receipt.<slot>; folds may use event.<slot> and
        // indexed state reads (P4 state deepening).
        checkRows(ev.bindings, paramNames, `${file}: event "${k}"`, true, payloadSet, 'binding');
        checkRows(ev.foldAssignments, paramNames, `${file}: event "${k}"`, true, payloadSet, 'fold');
      }
      checkGuards(doc.payload?.guards, paramNames, file);
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
      // V13: extraEvents have no owning command — state/literal resolve hard,
      // param.<parameter> can only be annotated (saga-completion semantics).
      const extraPayloadSet = new Set((e.payloads || []).map((p) => p.name));
      checkRows(e.bindings, new Set(), `${d}: extraEvent "${e.name}"`, false, extraPayloadSet, 'binding');
      checkRows(e.foldAssignments, new Set(), `${d}: extraEvent "${e.name}"`, false, extraPayloadSet, 'fold');
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
  // SEQ1 (v0.4 notice): seq is all-or-nothing per family for ordering purposes.
  // Mixed usage compiles fine (compiler falls back to directory order) but the
  // present seqs are then ignored — usually a sign of a half-finished edit.
  if (aggWithSeq.length > 0 && aggWithSeq.length < aggDirs.length)
    note_('SEQ1', `${aggWithSeq.length}/${aggDirs.length} aggregates carry seq — compiler orders by directory name when seq is not uniform; the present seqs are ignored for ordering`);

  // ── L1 notes: header/addressing (V1/V2/V3) + CS rules ──
  // v0.4: inbox may use v0.3 stage-code dirs or v0.4 product dirs (01-event-flow/…);
  // listInboxStages resolves each to its stage code. `stage` below is always the
  // resolved stage code, so the V2 header≡directory check works for both layouts.
  const noteAtoms = [];
  for (const { dir, stage } of listInboxStages(treeDir)) {
    for (const { file, doc } of readAtoms(join(treeDir, 'inbox', dir)))
      noteAtoms.push({ file: `inbox/${dir}/${file}`, doc, stage });
  }
  for (const d of aggDirs)
    for (const { file, doc } of readAtoms(join(treeDir, 'aggregates', d, 'notes')))
      noteAtoms.push({ file, doc, stage: doc.origin?.stage });
  for (const { file, doc } of readAtoms(join(treeDir, 'policies'), (f) => f.endsWith('.policy.yaml')))
    noteAtoms.push({ file, doc, stage: doc.origin?.stage });

  const byStageBoard = new Map();
  const tuples = new Map();
  const events = [], questions = [], commands = [], roles = [], policies = [], timers = [];
  const noteNamesByType = new Map(); // v0.5 R2: type → Set(names)
  const fieldStrings = new Set();    // v0.5 R2: known field qualifiers (R10/R11 carriers)
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
    if (!noteNamesByType.has(a.type)) noteNamesByType.set(a.type, new Set());
    noteNamesByType.get(a.type).add(a.name);
    // v0.5 R2: 09-lineage "A → B" arrows contribute known field qualifiers.
    if (a.type === 'relation')
      for (const l of a.payload?.links || [])
        if (typeof l === 'string' && l.includes('→'))
          for (const part of String(l).split('→')) fieldStrings.add(part.trim());
    if (!orderSet.has(a.origin?.stage)) { err('V1', `${f}: unknown stage "${a.origin?.stage}"`); continue; }
    if (f.startsWith('inbox/') && a.origin?.stage !== stage)
      err('V2', `${f}: header stage ${a.origin?.stage} ≠ directory stage ${stage}`);
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
    if (a.type === 'role') {
      roles.push({ f, a });
      // R2 (v0.5): relation targets must resolve — role can_issue → slice
      // commands (R12), can_view → read-model ids (R13 inverse carrier).
      for (const c of a.payload?.can_issue || [])
        if (!sliceCommands.has(c)) err('R2', `${f}: role can_issue "${c}" resolves to no slice command`);
      for (const m of a.payload?.can_view || [])
        if (!readModelIds.has(String(m))) err('R2', `${f}: role can_view "${m}" resolves to no read-model`);
    }
    if (a.type === 'timer' || a.type === 'externalSystem') timers.push({ f, a });
  }
  // V2 — per (stage, board) seq contiguity 0..n-1.
  // v0.4: DOWNGRADED to notice. An event's position in the business flow is
  // problem-space content (the event-storming sequence matrix) and stays;
  // but the *mechanics* of contiguous renumbering are the compiler's job —
  // humans must never renumber a board by hand. The compiler densifies on
  // projection (decompose already emits 0..n-1 by construction).
  // Collisions (two notes claiming the same position) remain hard errors.
  for (const [sbKey, bySeq] of byStageBoard) {
    const seqs = [...bySeq.keys()].sort((x, y) => x - y);
    seqs.forEach((s, idx) => { if (s !== idx) note_('V2', `${sbKey}: origin.seq not contiguous 0..n-1 (got ${s} at position ${idx}) — compiler densifies; do not renumber by hand`); });
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
  const voNames = new Set(), storyNames = new Set(); // v0.5 R2 index
  for (const [dirName, kind, key] of [['value-objects', 'value-object', 'valueObjects'], ['read-models', 'read-model', 'readModels'], ['stories', 'story', 'stories'], ['domain-services', 'domain-service', 'domainServices']]) {
    const seqs = new Map();
    let total = 0, withSeq = 0;
    for (const { file, doc } of readAtoms(join(treeDir, dirName), (f) => f.endsWith('.yaml'))) {
      if (doc.kind !== kind) { err('V1', `${file}: kind must be "${kind}"`); continue; }
      if (!doc.name) err('V1', `${file}: name required`);
      if (kind === 'value-object') voNames.add(doc.payload?.id || doc.name);
      if (kind === 'story') storyNames.add(doc.name);
      if (doc.payload?.name && doc.payload.name !== doc.name) err('V3', `${file}: payload.name ≠ header name`);
      total++;
      // V12 (v0.4): seq optional — "which entry is #n" is compiler-derived.
      // Present seqs must be integers and collision-free.
      if (doc.seq !== undefined && doc.seq !== null) {
        if (!Number.isInteger(Number(doc.seq))) err('V12', `${file}: seq must be an integer`);
        else if (seqs.has(doc.seq)) err('V12', `${dirName}: seq ${doc.seq} collision — ${seqs.get(doc.seq)} vs ${file}`);
        else seqs.set(doc.seq, file);
        withSeq++;
      }
      if (kind === 'value-object' && !Array.isArray(doc.payload?.fields))
        err('V10', `${file}: value-object payload.fields must be an array`);
      if (kind === 'read-model') {
        if (!Array.isArray(doc.payload?.fields)) err('V11', `${file}: read-model payload.fields must be an array`);
        if (doc.payload?.sourceAggregate && !aggNames.has(doc.payload.sourceAggregate))
          err('V11', `${file}: sourceAggregate "${doc.payload.sourceAggregate}" does not resolve to an aggregate`);
        for (const fl of doc.payload?.fields || []) {
          if (!fl.source) err('V11', `${file}: read-model field "${fl.name}" has no source derivation`);
          // R2 (v0.5): derives-from targets must resolve (R10). "aggregateIdentity"
          // is the self carrier; "eventField:E.f" must name a known event.
          const m = /^eventField:([^.]+)\./.exec(String(fl.source || ''));
          if (m && !poolEvents.has(m[1]) && !events.some((e) => e.a.name === m[1]))
            err('R2', `${file}: read-model field "${fl.name}" derives from unknown event "${m[1]}"`);
          if (typeof fl.source === 'string' && fl.source) fieldStrings.add(fl.source.replace(/^eventField:/, ''));
        }
      }
      if (kind === 'story') {
        if (!doc.payload?.role) note_('SM2', `story "${doc.name}" has no role`);
        if (!doc.payload?.goal) note_('SM2', `story "${doc.name}" has no goal`);
      }
      if (kind === 'domain-service') {
        // V13: a port declaration must name its trait and its method face —
        // service-dsl emits the trait verbatim from these two keys.
        if (!doc.payload?.fq) err('V13', `${file}: domain-service payload.fq required`);
        if (!Array.isArray(doc.payload?.methods) || !doc.payload.methods.length)
          err('V13', `${file}: domain-service payload.methods must be a non-empty array`);
        for (const m of doc.payload?.methods || [])
          if (!m.sig) err('V13', `${file}: domain-service method without sig`);
      }
    }
    // SEQ1 (v0.4 notice): seq is all-or-nothing per family for ordering.
    if (withSeq > 0 && withSeq < total)
      note_('SEQ1', `${dirName}: ${withSeq}/${total} atoms carry seq — compiler orders by file name when seq is not uniform; the present seqs are ignored for ordering`);
  }
  // use-cases.yaml — single flow-model file
  for (const { file, doc } of readAtoms(treeDir, (f) => f === 'use-cases.yaml'))
    if (doc.kind !== 'use-cases') err('V1', `${file}: kind must be "use-cases"`);

  // ── v0.4 (scenario A): pipelines + scenarios ──
  // Header discipline shared by both: scalar headers first, then at most the
  // one rich block (`steps` / `script`). Anything else object-typed is a hard
  // error — the compiler cannot roundtrip what it cannot place.
  const checkBlocksLast = (file, doc, allowBlock, rule) => {
    let seenBlock = false;
    for (const k of Object.keys(doc)) {
      const v = doc[k];
      const isBlock = v !== null && typeof v === 'object';
      if (isBlock && !(Array.isArray(allowBlock) ? allowBlock.includes(k) : k === allowBlock))
        err(rule, `${file}: "${k}" must be a scalar header — rich content belongs in the ${allowBlock} block`);
      if (isBlock) seenBlock = true;
      else if (seenBlock)
        err(rule, `${file}: scalar header "${k}" follows a block section — headers must come first (roundtrip fidelity)`);
    }
  };
  for (const { file, doc } of readAtoms(join(treeDir, 'pipelines'), (f) => f.endsWith('.pipeline.yaml'))) {
    if (doc.kind !== 'pipeline') { err('V1', `${file}: kind must be "pipeline"`); continue; }
    if (!doc.id) err('PL1', `${file}: id required`);
    if (!doc.name) err('PL1', `${file}: name required`);
    // PL2 — steps: non-empty array; each step an object with id+name; ids unique.
    // Vocabulary note: `steps`, never `stages` ("stage" is overloaded).
    const steps = doc.steps;
    if (!Array.isArray(steps) || !steps.length) err('PL2', `${file}: steps must be a non-empty array`);
    else {
      const seen = new Set();
      steps.forEach((s, i) => {
        if (!s || typeof s !== 'object' || Array.isArray(s)) { err('PL2', `${file}: step #${i} must be an object`); return; }
        if (!s.id) err('PL2', `${file}: step #${i} missing id`);
        else if (seen.has(s.id)) err('PL2', `${file}: duplicate step id "${s.id}"`);
        else seen.add(s.id);
        if (!s.name) err('PL2', `${file}: step "${s.id || '#' + i}" missing name`);
      });
    }
    checkBlocksLast(file, doc, ['steps', 'execution'], 'PL3');
    if (Array.isArray(steps)) {
      for (const diagnostic of validateExecutionDeclarations(doc)) {
        err('PL4', `${file}${diagnostic.pointer}: ${diagnostic.message}`);
      }
    }
  }
  for (const { file, doc } of readAtoms(join(treeDir, 'scenarios'), (f) => f.endsWith('.scenario.yaml'))) {
    if (doc.kind !== 'scenario') { err('V1', `${file}: kind must be "scenario"`); continue; }
    if (!doc.name) err('SC1', `${file}: name required`);
    if (!doc.description) err('SC1', `${file}: description required`);
    checkBlocksLast(file, doc, 'script', 'SC2');
  }

  // ── Saga products: basic identity + surface fidelity ONLY ──
  // Read every YAML file in the family, including misnamed files, so a typo
  // cannot pass validate and then disappear from compile's .saga.yaml input.
  // Payload internals (including unknown execution keys) are not certified here.
  const sagaDir = join(treeDir, 'sagas');
  const sagaIds = new Map(), sagaSeqs = new Map();
  let sagaTotal = 0, sagaWithSeq = 0;
  for (const file of existsSync(sagaDir) ? readdirSync(sagaDir).filter((f) => f.endsWith('.yaml')).sort() : []) {
    const path = `sagas/${file}`;
    let doc;
    try { doc = parseDoc(readFileSync(join(sagaDir, file), 'utf8'), path); }
    catch (e) { err('V1', `${path}: malformed Saga atom — ${e.message}`); continue; }
    if (doc.kind !== 'saga') err('V1', `${path}: kind must be "saga"`);
    const hasId = typeof doc.id === 'string' && doc.id.trim().length > 0;
    if (!hasId) err('SA1', `${path}: id must be a non-empty string`);
    else {
      if (file !== `${slug(doc.id)}.saga.yaml`)
        err('SA1', `${path}: filename must be "${slug(doc.id)}.saga.yaml" (derived from header id)`);
      if (sagaIds.has(doc.id)) err('SA1', `${path}: duplicate Saga id "${doc.id}" — ${sagaIds.get(doc.id)} vs ${path}`);
      else sagaIds.set(doc.id, path);
    }
    if (!file.endsWith('.saga.yaml')) err('SA1', `${path}: filename must end in .saga.yaml`);
    if (typeof doc.name !== 'string' || !doc.name.trim()) err('SA1', `${path}: name must be a non-empty string`);
    if (!((typeof doc.version === 'string' && doc.version.trim())
      || (Number.isSafeInteger(doc.version) && doc.version > 0)))
      err('SA1', `${path}: version must be a non-empty string or a positive safe integer`);
    sagaTotal++;
    if (doc.seq !== undefined) {
      sagaWithSeq++;
      if (!Number.isSafeInteger(doc.seq) || doc.seq < 0) err('V12', `${path}: seq must be a non-negative safe integer`);
      else if (sagaSeqs.has(doc.seq)) err('V12', `sagas: seq ${doc.seq} collision — ${sagaSeqs.get(doc.seq)} vs ${path}`);
      else sagaSeqs.set(doc.seq, path);
    }
    if (!doc.payload || typeof doc.payload !== 'object' || Array.isArray(doc.payload))
      err('SA2', `${path}: payload must be a JSON object`);
    // If identity is repeated in the payload it must agree, not override the
    // header. Neither compiler nor decompose invents missing payload identity.
    for (const key of ['id', 'name', 'version'])
      if (doc.payload && Object.hasOwn(doc.payload, key) && doc.payload[key] !== doc[key])
        err('V3', `${path}: payload.${key} ≠ header ${key}`);
    checkBlocksLast(path, doc, 'payload', 'SA3');
    for (const [key, value] of Object.entries(doc)) {
      if (key === 'payload' || (value !== null && typeof value === 'object')) continue;
      if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value)))
        err('SA3', `${path}: "${key}" must be a string or finite number header (roundtrip fidelity)`);
    }
    note_('SA0', `${path}: basic tree fidelity only; payload and additional headers are preserved, not execution-validated — unknown Saga execution keys/capabilities require the strict Saga semantic gate; this is not runnable certification`);
  }
  if (sagaWithSeq > 0 && sagaWithSeq < sagaTotal)
    note_('SEQ1', `sagas: ${sagaWithSeq}/${sagaTotal} atoms carry seq — compiler orders by file name when seq is not uniform; the present seqs are ignored for ordering`);

  // ── v0.5: relation registry rules (R1/R2) ──
  // R1 (hard): every explicit payload.links {relation, target} object must name
  //   a declared registry relation, and the (atom-kind, relation, target-kind)
  //   triple must match a registry entry. Legacy string-form links ("event:X",
  //   "A → B" lineage arrows) are NOT R1's business — V8/CS7/ES5 already govern
  //   those carriers; R1 judges only the object form introduced in v0.5.
  // R2 (hard): every explicit-link target ("kind:id") must resolve to an
  //   existing node. (Kind-specific carriers are checked inline: role
  //   can_issue/can_view above, read-model field sources above, policy
  //   triggers/invokes by V9, slice produces by V6b.)
  const nodeKindOf = (kind, doc) => {
    if (kind !== 'note')
      return { aggregate: 'aggregate', slice: 'slice', policy: 'policy', 'read-model': 'read-model',
               'value-object': 'value-object', story: 'story', pipeline: 'pipeline',
               scenario: 'scenario', 'use-cases': 'use-case', 'domain-service': 'domain-service' }[kind] || null;
    // note: relation notes reify a relation rather than originating one —
    // null exempts them from the from-kind match (target-kind still checked).
    return { role: 'role', event: 'event', command: 'command', story: 'story',
             readModel: 'read-model', aggregate: 'aggregate' }[doc.type] || null;
  };
  const nodeIndex = new Map(); // "kind:id" → true
  const addNode = (kind, id) => { if (id !== undefined && id !== null && id !== '') nodeIndex.set(`${kind}:${id}`, true); };
  for (const n of aggNames.keys()) addNode('aggregate', n);
  for (const c of sliceCommands) { addNode('slice', c); addNode('command', c); }
  for (const e of poolEvents) addNode('event', e);
  for (const { doc: a } of noteAtoms) {
    if (a.kind !== 'note') continue;
    if (a.type === 'event') addNode('event', a.name);
    if (a.type === 'command') addNode('command', a.name);
    if (a.type === 'role') addNode('role', a.name);
    if (a.type === 'story') addNode('story', a.name);
  }
  for (const { a } of policies) addNode('policy', a.name);
  for (const id of readModelIds.keys()) addNode('read-model', id);
  for (const v of voNames) addNode('value-object', v);
  for (const s of storyNames) addNode('story', s);
  for (const q of fieldStrings) addNode('field', q);
  for (const { doc } of readAtoms(join(treeDir, 'domain-services'), (f) => f.endsWith('.port.yaml'))) {
    if (doc.kind !== 'domain-service') continue;
    addNode('domain-service', doc.name);
    if (doc.payload?.fq) addNode('domain-service', doc.payload.fq);
  }
  for (const { doc } of readAtoms(join(treeDir, 'pipelines'), (f) => f.endsWith('.pipeline.yaml'))) {
    if (doc.id) {
      addNode('pipeline', doc.id);
      for (const s of doc.steps || []) if (s && s.id) addNode('step', `${doc.id}.${s.id}`);
    }
  }
  for (const { doc } of readAtoms(join(treeDir, 'scenarios'), (f) => f.endsWith('.scenario.yaml')))
    addNode('scenario', doc.id);
  for (const { doc } of readAtoms(treeDir, (f) => f === 'use-cases.yaml'))
    for (const u of doc.payload?.useCases || []) addNode('use-case', u.useCase || u.name);

  const checkExplicitLinks = (file, kind, doc) => {
    const links = doc.payload?.links;
    if (!Array.isArray(links)) return;
    const fromKind = nodeKindOf(kind, doc);
    for (const l of links) {
      if (!l || typeof l !== 'object' || Array.isArray(l)) continue; // legacy string carrier
      const entry = relationByName(l.relation);
      if (!entry) { err('R1', `${file}: undeclared relation "${l.relation}" — must be one of the registry's ${RELATION_REGISTRY.length} relations`); continue; }
      const tm = /^([^:]+):(.+)$/.exec(String(l.target || ''));
      if (!tm || tm[1] !== entry.to) { err('R1', `${file}: link target "${l.target}" must be "${entry.to}:<id>" for relation "${l.relation}"`); continue; }
      if (fromKind && fromKind !== entry.from)
        err('R1', `${file}: relation "${l.relation}" cannot originate from ${kind} (registry: ${entry.from} → ${entry.to})`);
      else if (!nodeIndex.has(String(l.target)))
        err('R2', `${file}: link target "${l.target}" resolves to nothing`);
    }
  };
  for (const { file, doc } of noteAtoms) checkExplicitLinks(file, doc.kind, doc);
  for (const [dirName, kind] of [['value-objects', 'value-object'], ['read-models', 'read-model'], ['stories', 'story'], ['domain-services', 'domain-service']])
    for (const { file, doc } of readAtoms(join(treeDir, dirName), (f) => f.endsWith('.yaml')))
      checkExplicitLinks(`${dirName}/${file}`, kind, doc);
  for (const { file, doc } of readAtoms(join(treeDir, 'pipelines'), (f) => f.endsWith('.pipeline.yaml')))
    checkExplicitLinks(`pipelines/${file}`, 'pipeline', doc);
  for (const { file, doc } of readAtoms(join(treeDir, 'scenarios'), (f) => f.endsWith('.scenario.yaml')))
    checkExplicitLinks(`scenarios/${file}`, 'scenario', doc);

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
