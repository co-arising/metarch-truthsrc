// decompose.mjs — canonical.json → tree atoms (the inverse projection).
//
// Deterministic by construction: filenames are (type, stage-code, slug(name), seq),
// byte layout comes from emitDoc, and ordering is the canonical's own order.
// decompose(compile(tree)) ≡ tree is the roundtrip gate (invariant I2).
//
// Split rules (schema v0.3):
//   aggregate   {...payload, commands, events} → aggregate.yaml (payload + order
//               lists + seq) + one slice per command; events are owned by the
//               FIRST command whose `produces` names them; events no command
//               produces go to the aggregate-level `extraEvents` block.
//   policy note → policies/<file>.policy.yaml with structured triggers/invokes
//               blocks derived from payload.info (payload stays verbatim).
//   note        command/event notes named in an aggregate's command/event set
//               live under aggregates/<slug>/notes/ (ownership distribution);
//               everything else lands in inbox/<stage>/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { emitDoc, STAGE_CODE, slug } from './shared.mjs';

const producesNames = (cmd) => (cmd.produces || []).map((p) => (typeof p === 'string' ? p : p.name));

export function decomposeCanonical(canonicalText, treeDir) {
  const canonical = JSON.parse(canonicalText);
  mkdirSync(treeDir, { recursive: true });
  writeFileSync(join(treeDir, 'workshop.yaml'), emitWorkshop(canonical));
  let count = 1; // workshop.yaml

  // ── aggregates + slices ──
  // v0.4: `seq` is written back verbatim iff the canonical entry carries one
  // (compiler-reserved sibling key); otherwise omitted — the tree stays
  // seq-free and the roundtrip gate stays byte-identical either way.
  (canonical.aggregates || []).forEach((a) => {
    if (!a.name) throw new Error(`aggregate: payload.name required`);
    const dir = join(treeDir, 'aggregates', slug(a.name));
    // v0.5.1: compiler-reserved surface siblings are written back to their
    // atom positions, never into the payload block.
    const { seq, commands: _c, events: _e, context, bmExtra, orderDecisions,
      orderFolds, extraFolds, eventResidence, ...payload } = a;
    const commands = a.commands || [];
    const events = a.events || [];
    // Event-definition residence: canonical eventResidence wins; default is
    // the first command (in commands order) that produces the event, else
    // the aggregate-level extraEvents block.
    const owner = new Map();
    for (const e of events) {
      if (eventResidence && e.name in eventResidence) { owner.set(e.name, eventResidence[e.name]); continue; }
      const cmd = commands.find((c) => producesNames(c).includes(e.name));
      owner.set(e.name, cmd ? cmd.name : null);
    }
    const ownedBy = (cmdName) => events.filter((e) => owner.get(e.name) === cmdName);
    const extraEvents = events.filter((e) => owner.get(e.name) === null);
    mkdirSync(dir, { recursive: true });
    const scalars = [['kind', 'aggregate'], ['name', a.name]];
    if (context !== undefined) scalars.push(['context', context]);
    if (seq !== undefined) scalars.push(['seq', seq]);
    const orderBlock = {
      commands: commands.map((c) => c.name),
      events: events.map((e) => e.name),
    };
    if (orderDecisions !== undefined) orderBlock.decisions = orderDecisions;
    if (orderFolds !== undefined) orderBlock.folds = orderFolds;
    writeFileSync(join(dir, 'aggregate.yaml'), emitDoc({
      scalars,
      nested: { order: orderBlock },
      blocks: {
        payload,
        ...(bmExtra !== undefined ? { bmExtra } : {}),
        ...(extraEvents.length ? { extraEvents } : {}),
        ...(extraFolds !== undefined ? { extraFolds } : {}),
      },
    }));
    count++;
    for (const cmd of commands) {
      if (!cmd.name) throw new Error(`aggregate ${a.name}: command without name in commands[]`);
      const owned = ownedBy(cmd.name);
      const evBlock = {};
      for (const e of owned) evBlock[e.name] = e;
      // An authored-empty `events: {}` survives compile as an own empty-map key —
      // emit it back so the atom round-trips byte-identically (I2).
      const authoredEmptyEvents = owned.length === 0 && cmd.events !== undefined
        && typeof cmd.events === 'object' && !Array.isArray(cmd.events)
        && Object.keys(cmd.events).length === 0;
      // Slice surface siblings (decision/fold) become blocks again; the
      // payload block drops them — and drops emissionBindings too when a
      // decision block carries it (compile re-derives it from the decision).
      // The authored-empty `events: {}` marker is surface-carried too: it is
      // a top-level slice block, never payload content.
      const { decision, fold, events: _surfaceEvents, ...cmdRest } = cmd;
      const slicePayload = decision !== undefined
        ? Object.fromEntries(Object.entries(cmdRest).filter(([k]) => k !== 'emissionBindings'))
        : cmdRest;
      mkdirSync(join(dir, 'slices'), { recursive: true });
      writeFileSync(join(dir, 'slices', `${slug(cmd.name)}.slice.yaml`), emitDoc({
        scalars: [['kind', 'slice'], ['aggregate', a.name], ['command', cmd.name]],
        blocks: {
          payload: slicePayload,
          ...(owned.length ? { events: evBlock } : authoredEmptyEvents ? { events: {} } : {}),
          ...(fold !== undefined ? { fold } : {}),
          ...(decision !== undefined ? { decision } : {}),
        },
      }));
      count++;
    }
  });

  // ── notes: inbox / aggregate-owned / policies ──
  const commandNames = new Set((canonical.aggregates || [])
    .flatMap((a) => (a.commands || []).map((c) => c.name)));
  const eventNames = new Set((canonical.aggregates || [])
    .flatMap((a) => (a.events || []).map((e) => e.name)));
  for (const sess of canonical.sessions || []) {
    const stage = sess.session;
    const code = STAGE_CODE[stage];
    if (!code) throw new Error(`unknown stage: ${stage}`);
    for (const sc of sess.scopes || []) {
      (sc.notes || []).forEach((payload, rank) => {
        const type = payload.type;
        const name = payload.name;
        if (!type || !name) throw new Error(`note #${rank} in ${stage}/${sc.scope}: payload.type/.name required`);
        // v0.5.1 surface carry: header id, origin author/createdAt and a
        // non-positional origin.seq ride in canonical.noteSurface; physical
        // residence rides in canonical.noteResidence (same key as inboxLayout).
        const layoutKey = `${stage}|${sc.scope}|${rank}`;
        const surface = (canonical.noteSurface || {})[layoutKey];
        const seq = surface?.seq ?? rank;
        const origin = { stage, board: sc.scope, seq };
        if (surface && 'author' in surface) origin.author = surface.author;
        if (surface && 'createdAt' in surface) origin.createdAt = surface.createdAt;
        const headerId = surface && 'id' in surface ? surface.id : payload.noteId;
        const idScalars = headerId !== undefined && headerId !== null ? [['id', headerId]] : [];
        let file;
        let atom;
        if (type === 'policy') {
          const triggers = payload.info?.triggers || [];
          const invokes = payload.info?.invokes || [];
          if (!triggers.length || !invokes.length)
            throw new Error(`policy "${name}": payload.info.triggers/invokes required (structured causal contract)`);
          const bindings = payload.info?.bindings;
          atom = emitDoc({
            scalars: [...idScalars, ['kind', 'policy'], ['type', type], ['name', name]],
            nested: { origin, ...(bindings !== undefined ? { bindings } : {}) },
            objLists: { triggers, invokes },
            blocks: { payload },
          });
          file = join(treeDir, 'policies', `policy-${code}-${slug(name)}-${seq}.policy.yaml`);
        } else {
          atom = emitDoc({
            scalars: [...idScalars, ['kind', 'note'], ['type', type], ['name', name]],
            nested: { origin },
            blocks: { payload },
          });
          // Residence (v0.5.1) wins; else ownership distribution: command/
          // event notes named in an aggregate's contract live under that
          // aggregate; everything else stays in inbox. v0.4: the inbox
          // directory comes from canonical.inboxLayout when the tree used
          // v0.4 product dirs (01-event-flow/…); otherwise the stage dir.
          const residence = (canonical.noteResidence || {})[layoutKey];
          let dir;
          if (residence) {
            dir = join(treeDir, ...residence.split('/'));
          } else {
            const owned = (type === 'command' && commandNames.has(name))
              || (type === 'event' && eventNames.has(name));
            const inboxDir = (canonical.inboxLayout || {})[layoutKey] || stage;
            dir = owned
              ? join(treeDir, 'aggregates', slug(owningAggregate(canonical, type, name)), 'notes')
              : join(treeDir, 'inbox', inboxDir);
          }
          file = join(dir, `${type}-${code}-${slug(name)}-${seq}.yaml`);
        }
        mkdirSync(join(file, '..'), { recursive: true });
        writeFileSync(file, atom);
        count++;
      });
    }
  }

  // ── catalogs ──
  // v0.4: seq written back verbatim iff present (else the atom stays seq-free).
  for (const [key, kind, dirName, ext, prefix] of [
    ['valueObjects', 'value-object', 'value-objects', '.vo.yaml', ''],
    ['readModels', 'read-model', 'read-models', '.rm.yaml', 'read-model-'],
    ['stories', 'story', 'stories', '.story.yaml', 'story-'],
    ['domainServices', 'domain-service', 'domain-services', '.port.yaml', ''],
  ]) {
    (canonical[key] || []).forEach((entry) => {
      const { seq, ...payload } = entry;
      if (!payload.name) throw new Error(`${key}: payload.name required`);
      // Read-model filenames drop the DecisionView suffix (reference naming:
      // CaptureNoteDecisionView → read-model-capture-note.rm.yaml).
      const baseName = key === 'readModels' ? payload.name.replace(/DecisionView$/, '') : payload.name;
      const file = join(treeDir, dirName, `${prefix}${slug(baseName)}${ext}`);
      mkdirSync(join(file, '..'), { recursive: true });
      // Header id: the payload's own id, else its noteId (value objects carry
      // their identity in noteId). Absent both, no id line is emitted.
      const headerId = payload.id ?? payload.noteId;
      const scalars = [['kind', kind], ['name', payload.name]];
      if (headerId !== undefined && headerId !== null) scalars.push(['id', headerId]);
      if (seq !== undefined) scalars.push(['seq', seq]);
      writeFileSync(file, emitDoc({
        scalars,
        blocks: { payload },
      }));
      count++;
    });
  }
  // ── v0.4 (scenario A): pipelines + scenarios ──
  // Scalar headers (in canonical key order) first, then the one rich block.
  // Filenames derive from id (fallback: name).
  const emitHeaded = (entry, kind, blockKey) => {
    const scalars = [['kind', kind]];
    const blocks = {};
    for (const [k, v] of Object.entries(entry)) {
      if (v !== null && typeof v === 'object') blocks[k] = v;
      else scalars.push([k, v]);
    }
    // `steps`/`script` last even if the canonical order was disturbed.
    const orderedBlocks = {};
    if (blocks[blockKey] !== undefined) orderedBlocks[blockKey] = blocks[blockKey];
    for (const [k, v] of Object.entries(blocks)) if (k !== blockKey) orderedBlocks[k] = v;
    return emitDoc({ scalars, blocks: orderedBlocks });
  };
  for (const p of canonical.pipelines || []) {
    if (!p.id && !p.name) throw new Error('pipeline: id or name required');
    if (!Array.isArray(p.steps) || !p.steps.length)
      throw new Error(`pipeline "${p.id || p.name}": steps must be a non-empty array`);
    const file = join(treeDir, 'pipelines', `${slug(p.id || p.name)}.pipeline.yaml`);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, emitHeaded(p, 'pipeline', 'steps'));
    count++;
  }
  for (const s of canonical.scenarios || []) {
    if (!s.name) throw new Error('scenario: name required');
    const file = join(treeDir, 'scenarios', `${slug(s.id || s.name)}.scenario.yaml`);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, emitHeaded(s, 'scenario', 'script'));
    count++;
  }
  // ── Saga products: restore authored headers + payload, never payload-only ──
  // No entries means no sagas/ directory or invented product/history. Reuse
  // emitDoc; do not infer identity, order, versions or workshop notes.
  const sagaFiles = new Set();
  for (const s of canonical.sagas || []) {
    if (!s || typeof s.id !== 'string' || !s.id.trim()) throw new Error('saga: id must be a non-empty string');
    if (typeof s.name !== 'string' || !s.name.trim()) throw new Error(`saga "${s.id}": name must be a non-empty string`);
    if (!((typeof s.version === 'string' && s.version.trim())
      || (Number.isSafeInteger(s.version) && s.version > 0)))
      throw new Error(`saga "${s.id}": version must be a non-empty string or a positive safe integer`);
    if (!s.payload || typeof s.payload !== 'object' || Array.isArray(s.payload))
      throw new Error(`saga "${s.id}": payload must be a JSON object`);
    const scalars = [['kind', 'saga']];
    for (const [key, value] of Object.entries(s)) {
      if (key === 'payload') continue;
      if (key === 'kind' || (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))))
        throw new Error(`saga "${s.id}": "${key}" must be a scalar header (rich content belongs in payload; kind is not canonical)`);
      scalars.push([key, value]);
    }
    const name = `${slug(s.id)}.saga.yaml`;
    if (sagaFiles.has(name)) throw new Error(`saga: duplicate output filename "${name}"`);
    sagaFiles.add(name);
    const file = join(treeDir, 'sagas', name);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, emitDoc({ scalars, blocks: { payload: s.payload } }));
    count++;
  }
  if (canonical.useCases !== undefined) {
    writeFileSync(join(treeDir, 'use-cases.yaml'), emitDoc({
      scalars: [['kind', 'use-cases']],
      blocks: { payload: canonical.useCases },
    }));
    count++;
  }
  return count;
}

function owningAggregate(canonical, type, name) {
  for (const a of canonical.aggregates || []) {
    const bag = type === 'command' ? (a.commands || []) : (a.events || []);
    if (bag.some((x) => x.name === name)) return a.name;
  }
  return null;
}

function emitWorkshop(canonical) {
  const stages = (canonical.sessions || []).map((s) => s.session);
  // The name key is spelled `workshop:` when the source tree used that form
  // (canonical.workshopKey, recorded by compile); `name:` otherwise.
  const nameKey = canonical.workshopKey || 'name';
  return [
    '# ═══ truthsrc workshop root — hand-editable; contract: SCHEMA.md ═══',
    '',
    `schemaVersion: ${canonical.schemaVersion || 'truthsrc/v1'}`,
    `${nameKey}: ${canonical.workshop}`,
    'sessionOrder:',
    ...stages.map((s) => `  - ${s}`),
    '',
  ].join('\n');
}
