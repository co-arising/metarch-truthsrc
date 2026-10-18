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
    const { seq, commands: _c, events: _e, ...payload } = a;
    const commands = a.commands || [];
    const events = a.events || [];
    // Event ownership: first command (in commands order) that produces the event.
    const owner = new Map();
    for (const e of events) {
      const cmd = commands.find((c) => producesNames(c).includes(e.name));
      owner.set(e.name, cmd ? cmd.name : null);
    }
    const ownedBy = (cmdName) => events.filter((e) => owner.get(e.name) === cmdName);
    const extraEvents = events.filter((e) => owner.get(e.name) === null);
    mkdirSync(dir, { recursive: true });
    const scalars = [['kind', 'aggregate'], ['name', a.name]];
    if (seq !== undefined) scalars.push(['seq', seq]);
    writeFileSync(join(dir, 'aggregate.yaml'), emitDoc({
      scalars,
      nested: {
        order: {
          commands: commands.map((c) => c.name),
          events: events.map((e) => e.name),
        },
      },
      blocks: { payload, ...(extraEvents.length ? { extraEvents } : {}) },
    }));
    count++;
    for (const cmd of commands) {
      if (!cmd.name) throw new Error(`aggregate ${a.name}: command without name in commands[]`);
      const owned = ownedBy(cmd.name);
      const evBlock = {};
      for (const e of owned) evBlock[e.name] = e;
      mkdirSync(join(dir, 'slices'), { recursive: true });
      writeFileSync(join(dir, 'slices', `${slug(cmd.name)}.slice.yaml`), emitDoc({
        scalars: [['kind', 'slice'], ['aggregate', a.name], ['command', cmd.name]],
        blocks: { payload: cmd, ...(owned.length ? { events: evBlock } : {}) },
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
      (sc.notes || []).forEach((payload, seq) => {
        const type = payload.type;
        const name = payload.name;
        if (!type || !name) throw new Error(`note #${seq} in ${stage}/${sc.scope}: payload.type/.name required`);
        let file;
        let atom;
        if (type === 'policy') {
          const triggers = payload.info?.triggers || [];
          const invokes = payload.info?.invokes || [];
          if (!triggers.length || !invokes.length)
            throw new Error(`policy "${name}": payload.info.triggers/invokes required (structured causal contract)`);
          atom = emitDoc({
            scalars: [['kind', 'policy'], ['type', type], ['name', name]],
            nested: { origin: { stage, board: sc.scope, seq } },
            objLists: { triggers, invokes },
            blocks: { payload },
          });
          file = join(treeDir, 'policies', `policy-${code}-${slug(name)}-${seq}.policy.yaml`);
        } else {
          atom = emitDoc({
            scalars: [['kind', 'note'], ['type', type], ['name', name]],
            nested: { origin: { stage, board: sc.scope, seq } },
            blocks: { payload },
          });
          // Ownership distribution: command/event notes named in an aggregate's
          // contract live under that aggregate; everything else stays in inbox.
          // v0.4: the inbox directory comes from canonical.inboxLayout when the
          // tree used v0.4 product dirs (01-event-flow/…); otherwise the v0.3
          // stage-code dir. Key is stage|board|seq (V2-unique).
          const owned = (type === 'command' && commandNames.has(name))
            || (type === 'event' && eventNames.has(name));
          const layoutKey = `${stage}|${sc.scope}|${seq}`;
          const inboxDir = (canonical.inboxLayout || {})[layoutKey] || stage;
          const dir = owned
            ? join(treeDir, 'aggregates', slug(owningAggregate(canonical, type, name)), 'notes')
            : join(treeDir, 'inbox', inboxDir);
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
  for (const [key, kind, dirName, ext] of [
    ['valueObjects', 'value-object', 'value-objects', '.vo.yaml'],
    ['readModels', 'read-model', 'read-models', '.rm.yaml'],
    ['stories', 'story', 'stories', '.story.yaml'],
  ]) {
    (canonical[key] || []).forEach((entry) => {
      const { seq, ...payload } = entry;
      if (!payload.name) throw new Error(`${key}: payload.name required`);
      const file = join(treeDir, dirName, `${slug(payload.name)}${ext}`);
      mkdirSync(join(file, '..'), { recursive: true });
      const scalars = [['kind', kind], ['name', payload.name]];
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
  return [
    '# ═══ truthsrc workshop root — hand-editable; contract: SCHEMA.md ═══',
    '',
    `schemaVersion: ${canonical.schemaVersion || 'truthsrc/v1'}`,
    `name: ${canonical.workshop}`,
    'sessionOrder:',
    ...stages.map((s) => `  - ${s}`),
    '',
  ].join('\n');
}
