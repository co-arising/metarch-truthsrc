// query.mjs — DESCRIBE-model query library over compiled canonical.json.
//
// Operates on the canonical projection (not raw trees): buildGraph() turns a
// canonical.json into a typed node/edge graph using the v0.5 relation
// registry's carrier mapping (see SCHEMA.md "Relation carriers"). Verbs are
// the fixed API surface (design §4.1); registry-derived named verbs (§4.2)
// are thin wrappers over expand().
//
// Node addressing: "<kind>:<id>" — e.g. `event:run-completed`,
// `slice:replay-exception`, `policy:Batch Business Closure`,
// `read-model:chain-stats`, `role:Operator`, `pipeline:batch-chain`,
// `step:batch-chain.file-gen`, `field:run-started.runId`,
// `saga:money-transfer`, `saga-participant:money-transfer.source`,
// `saga-phase:money-transfer.reserve-source.prepare`.
// Saga-owned refs use `command:Account.prepare-source` / `event:Account.TransferRequested`.
// These qualified nodes are materialized only for explicit Saga references;
// legacy global command/event IDs and the shared relation registry stay unchanged.
//
// Honest gaps (v0.5): relations without a machine-readable carrier in current
// trees (R2/R8/R15/R16/R17/R18/R19/R20/R21/R22 — see RELATION_REGISTRY
// carriers) yield empty results, never invented ones. anchors() reports
// `unanchored` until the back-anchor work lands in canonical.json.
import { readFileSync } from 'node:fs';
import { queryAnchorsIndex } from './anchor-query.mjs';
import { RELATION_REGISTRY, relationByName, propagatingRelations } from './shared.mjs';

export function loadCanonical(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const nid = (kind, id) => `${kind}:${id}`;

// ── graph construction ───────────────────────────────────────────────────────
export function buildGraph(c) {
  const nodes = new Map();
  const edges = [];
  const addNode = (id, kind, name, atom) => {
    if (!nodes.has(id)) nodes.set(id, { id, kind, name, atom });
    return nodes.get(id);
  };
  const addEdge = (from, relation, to) => {
    if (nodes.has(from) && nodes.has(to)) edges.push({ from, relation, to });
  };
  const pushEdge = (from, relation, to) => edges.push({ from, relation, to }); // target may not exist yet

  const sliceCommands = new Set();
  const poolEvents = new Set();

  // aggregates → slices / commands / events (R1, R3, R4, R5, R6)
  for (const a of c.aggregates || []) {
    const aggId = nid('aggregate', a.name);
    addNode(aggId, 'aggregate', a.name, a);
    for (const cmd of a.commands || []) {
      if (!cmd || !cmd.name) continue;
      const sliceId = nid('slice', cmd.name), cmdId = nid('command', cmd.name);
      addNode(sliceId, 'slice', cmd.name, cmd);
      addNode(cmdId, 'command', cmd.name, cmd);
      sliceCommands.add(cmd.name);
      addEdge(aggId, 'owns', sliceId);     // R1
      addEdge(sliceId, 'issues', cmdId);   // R4 (degenerate 1:1 per V4/V5)
      for (const e of cmd.produces || []) pushEdge(cmdId, 'produces', nid('event', e)); // R6
    }
    for (const e of a.events || []) {
      if (!e || !e.name) continue;
      const evId = nid('event', e.name);
      addNode(evId, 'event', e.name, e);
      poolEvents.add(e.name);
      addEdge(aggId, 'emits', evId);      // R3
    }
  }
  // R5 (slice emits event): definitions live in the aggregate pool per V6, so
  // the edge is produces ∩ pool — a slice "emits" what it produces and defines.
  for (const e of edges.filter((x) => x.relation === 'produces' && nodes.has(x.to))) {
    const sliceId = nid('slice', e.from.slice('command:'.length));
    if (nodes.has(sliceId)) edges.push({ from: sliceId, relation: 'emits', to: e.to });
  }

  // sessions: L1 notes (roles, policies, events, stories, lineage arrows)
  const noteEvents = new Set(), noteCommands = new Set();
  for (const s of c.sessions || []) for (const sc of s.scopes || []) for (const n of sc.notes || []) {
    if (!n || !n.name) continue;
    const t = n.type;
    if (t === 'role') {
      const rId = nid('role', n.name);
      addNode(rId, 'role', n.name, n);
      for (const cmd of n.can_issue || []) pushEdge(rId, 'can-issue', nid('command', cmd)); // R12
      // R13 normalized: the registry direction is read-model→role; the v0.4
      // carrier is the inverse (role can_view), so we invert it here.
      for (const rm of n.can_view || []) pushEdge(nid('read-model', rm), 'visible-to', rId); // R13
    } else if (t === 'policy') {
      const pId = nid('policy', n.name);
      addNode(pId, 'policy', n.name, n);
      const trig = n.info?.triggers || n.triggers || [];
      const inv = n.info?.invokes || n.invokes || [];
      for (const x of trig) pushEdge(nid('event', x.event), 'triggers', pId);   // R7
      for (const x of inv) pushEdge(pId, 'invokes', nid('command', x.command)); // R9
    } else if (t === 'event') {
      noteEvents.add(n.name);
      addNode(nid('event', n.name), 'event', n.name, n);
    } else if (t === 'command') {
      noteCommands.add(n.name);
      addNode(nid('command', n.name), 'command', n.name, n);
    } else if (t === 'story') {
      addNode(nid('story', n.name), 'story', n.name, n);
    }
    // explicit v0.5 object-form links on any note
    const selfId = t === 'role' ? nid('role', n.name)
      : t === 'policy' ? nid('policy', n.name)
      : t === 'event' ? nid('event', n.name)
      : t === 'command' ? nid('command', n.name)
      : t === 'story' ? nid('story', n.name) : null;
    for (const l of n.links || []) {
      if (!l || typeof l !== 'object' || Array.isArray(l)) {
        // R11: 09-lineage "A → B" arrows (chains split pairwise).
        if (t === 'relation' && typeof l === 'string' && l.includes('→')) {
          const parts = String(l).split('→').map((x) => x.trim()).filter(Boolean);
          for (let i = 0; i + 1 < parts.length; i++) {
            const aId = nid('field', parts[i]), bId = nid('field', parts[i + 1]);
            addNode(aId, 'field', parts[i], null);
            addNode(bId, 'field', parts[i + 1], null);
            edges.push({ from: aId, relation: 'lineage', to: bId });
          }
        }
        continue;
      }
      if (selfId && relationByName(l.relation)) pushEdge(selfId, l.relation, String(l.target));
    }
  }

  // read-models (R10, R13)
  for (const rm of c.readModels || []) {
    const rmId = nid('read-model', rm.id || rm.name);
    addNode(rmId, 'read-model', rm.name, rm);
    for (const f of rm.fields || []) {
      if (!f.source) continue;
      const fld = nid('field', String(f.source).replace(/^eventField:/, ''));
      addNode(fld, 'field', f.source, f);
      addEdge(rmId, 'derives-from', fld);                       // R10
    }
    for (const r of rm.visible_to || []) addEdge(rmId, 'visible-to', nid('role', r)); // R13
    for (const l of rm.links || [])
      if (l && typeof l === 'object' && !Array.isArray(l) && relationByName(l.relation))
        pushEdge(rmId, l.relation, String(l.target));
  }

  // pipelines + steps (R14, R15, R16)
  for (const p of c.pipelines || []) {
    if (!p.id) continue;
    const pId = nid('pipeline', p.id);
    addNode(pId, 'pipeline', p.name || p.id, p);
    for (const s of p.steps || []) {
      if (!s || !s.id) continue;
      const sId = nid('step', `${p.id}.${s.id}`);
      addNode(sId, 'step', s.name || s.id, s);
      addEdge(pId, 'has-step', sId);                            // R14
      if (s.actor) addEdge(sId, 'performed-by', nid('role', s.actor)); // R15
      if (s.slice) addEdge(sId, 'executes', nid('slice', s.slice));    // R16
    }
    for (const l of p.links || [])
      if (l && typeof l === 'object' && !Array.isArray(l) && relationByName(l.relation))
        pushEdge(pId, l.relation, String(l.target));
  }

  for (const s of c.scenarios || []) {
    if (!s.id && !s.name) continue;
    addNode(nid('scenario', s.id || s.name), 'scenario', s.name || s.id, s);
  }
  for (const v of c.valueObjects || []) addNode(nid('value-object', v.id || v.name), 'value-object', v.name, v);
  for (const s of c.stories || []) addNode(nid('story', s.name), 'story', s.name, s);
  for (const u of c.useCases?.useCases || [])
    addNode(nid('use-case', u.useCase || u.name), 'use-case', u.useCase || u.name, u);

  // Saga products use the canonical business payload, not execution IR or
  // technical bindings. Local relations deliberately do not extend the shared
  // registry (in particular, no new blast-radius propagation contract).
  const diagnostics = [];
  const sagas = c.sagas || [];
  if (sagas.length) {
    const text = (v) => typeof v === 'string' && v.trim().length > 0;
    const aggregates = new Map(), owned = new Map();
    const ownedKey = (kind, aggregate, name) => JSON.stringify([kind, aggregate, name]);
    const countIds = (rows) => {
      const counts = new Map();
      for (const row of rows) if (text(row?.id))
        counts.set(row.id, (counts.get(row.id) || 0) + 1);
      return counts;
    };
    for (const a of c.aggregates || []) {
      if (!text(a?.name)) continue;
      aggregates.set(a.name, (aggregates.get(a.name) || 0) + 1);
      for (const [kind, rows] of [['command', a.commands], ['event', a.events]])
        for (const atom of rows || []) {
          if (!text(atom?.name)) continue;
          const key = ownedKey(kind, a.name, atom.name);
          if (!owned.has(key)) owned.set(key, []);
          owned.get(key).push(atom);
        }
    }
    const unmapped = (context, target, ref, reason) => {
      diagnostics.push({ code: 'saga-ref-unmapped', ...context, target, ref: ref ?? null, reason });
      return null;
    };
    const resolveOwned = (kind, ref, context, participantAggregate = null) => {
      if (!text(ref?.aggregate) || !text(ref?.name))
        return unmapped(context, null, ref, 'aggregate-qualified-ref-required');
      const target = nid(kind, `${ref.aggregate}.${ref.name}`);
      const owners = aggregates.get(ref.aggregate) || 0;
      const matches = owned.get(ownedKey(kind, ref.aggregate, ref.name)) || [];
      if (owners !== 1 || matches.length !== 1)
        return unmapped(context, target, ref, owners === 0 ? 'unknown-aggregate'
          : owners > 1 || matches.length > 1 ? 'ambiguous-owned-ref' : 'unknown-owned-ref');
      if (participantAggregate !== null && ref.aggregate !== participantAggregate)
        return unmapped(context, target, ref, 'participant-aggregate-mismatch');
      const existing = nodes.get(target);
      if (existing && (existing.qualifiedRef?.aggregate !== ref.aggregate || existing.qualifiedRef?.name !== ref.name))
        return unmapped(context, target, ref, 'qualified-id-collision');
      const node = addNode(target, kind, ref.name, matches[0]);
      node.qualifiedRef = { aggregate: ref.aggregate, name: ref.name };
      return target;
    };
    for (const [ordinal, saga] of sagas.entries()) {
      if (!text(saga?.id)) continue;
      const sagaId = nid('saga', saga.id), pp = `/sagas/${ordinal}/payload`;
      addNode(sagaId, 'saga', saga.name || saga.id, saga);
      const payload = saga.payload;
      if (payload?.schemaVersion !== 'truthsrc.saga/v1') {
        diagnostics.push({ code: 'saga-payload-unmapped', sagaId: saga.id, from: sagaId,
          pointer: pp, schemaVersion: payload?.schemaVersion ?? null });
        continue;
      }
      const context = (from, relation, pointer) => ({ sagaId: saga.id, from, relation, pointer });
      const participants = new Map();
      const participantCounts = countIds(payload.participants || []);
      const stepCounts = countIds(payload.steps || []);
      for (const [i, p] of (payload.participants || []).entries()) {
        if (!text(p?.id)) continue;
        const id = nid('saga-participant', `${saga.id}.${p.id}`);
        if (participantCounts.get(p.id) !== 1) {
          unmapped(context(sagaId, 'owns', `${pp}/participants/${i}/id`), id, p.id, 'duplicate-participant-id');
          continue; // no first-wins atom combined with last-wins ownership
        }
        addNode(id, 'saga-participant', p.id, p).sagaId = saga.id;
        addEdge(sagaId, 'owns', id);
        participants.set(p.id, p);
        const target = nid('aggregate', p.aggregate);
        if (aggregates.get(p.aggregate) === 1) addEdge(id, 'participates', target);
        else unmapped(context(id, 'participates', `${pp}/participants/${i}/aggregate`), target,
          p.aggregate, aggregates.has(p.aggregate) ? 'ambiguous-aggregate' : 'unknown-aggregate');
      }
      for (const [i, step] of (payload.steps || []).entries()) {
        if (!text(step?.id)) continue;
        const stepId = nid('saga-step', `${saga.id}.${step.id}`), sp = `${pp}/steps/${i}`;
        if (stepCounts.get(step.id) !== 1) {
          unmapped(context(sagaId, 'owns', `${sp}/id`), stepId, step.id, 'duplicate-step-id');
          continue; // do not union distinct steps' participants and phases
        }
        addNode(stepId, 'saga-step', step.id, step).sagaId = saga.id;
        addEdge(sagaId, 'owns', stepId);
        const participantId = nid('saga-participant', `${saga.id}.${step.participant}`);
        const participant = participants.get(step.participant);
        const participantProblem = participantCounts.get(step.participant) > 1 ? 'ambiguous-participant' : 'unknown-participant';
        if (participant) addEdge(stepId, 'participates', participantId);
        else unmapped(context(stepId, 'participates', `${sp}/participant`), participantId,
          step.participant, participantProblem);
        for (const phase of ['prepare', 'commit', 'compensate']) {
          const declaration = step.phases?.[phase];
          if (!declaration) continue; // absent phases are not manufactured
          const phaseId = nid('saga-phase', `${saga.id}.${step.id}.${phase}`);
          addNode(phaseId, 'saga-phase', phase, { ...declaration, sagaId: saga.id,
            stepId: step.id, participant: step.participant, phase }).sagaId = saga.id;
          addEdge(stepId, 'owns', phaseId);
          if (participant) addEdge(phaseId, 'participates', participantId);
          if (declaration.kind === 'command') {
            const ref = declaration.commandRef;
            const ctx = context(phaseId, 'phase-commands', `${sp}/phases/${phase}/commandRef`);
            if (!participant || !text(participant.aggregate)) {
              unmapped(ctx, text(ref?.aggregate) && text(ref?.name) ? nid('command', `${ref.aggregate}.${ref.name}`) : null,
                ref, participant ? 'participant-aggregate-required' : participantProblem);
              continue;
            }
            const target = resolveOwned('command', ref, ctx, participant.aggregate);
            if (target) addEdge(phaseId, 'phase-commands', target);
          }
        }
      }
      for (const [i, trigger] of (payload.triggers || []).entries()) {
        if (!['command', 'event'].includes(trigger?.kind)) continue;
        const source = resolveOwned(trigger.kind, trigger.sourceRef,
          context(sagaId, 'triggers', `${pp}/triggers/${i}/sourceRef`));
        if (source) addEdge(source, 'triggers', sagaId);
      }
      for (const [i, completion] of (payload.completions || []).entries()) {
        const target = resolveOwned('event', completion?.eventRef,
          context(sagaId, 'result', `${pp}/completions/${i}/eventRef`));
        if (target) addEdge(sagaId, 'result', target);
      }
    }
  }
  // Ports and narrative step names are NOT Saga references. invokeSaga is not
  // on the execution schema yet; do not infer a Monarch→Saga integration.

  // drop edges whose target never materialized (dangling references stay
  // visible to validate's R2/CS7 — the query graph only walks what exists)
  const live = edges.filter((e) => nodes.has(e.from) && nodes.has(e.to));
  return { nodes, edges: live, canonical: c, sliceCommands, poolEvents, noteEvents, noteCommands, diagnostics };
}

function adjacency(graph) {
  const out = new Map(), inn = new Map();
  for (const e of graph.edges) {
    if (!out.has(e.from)) out.set(e.from, []);
    if (!inn.has(e.to)) inn.set(e.to, []);
    out.get(e.from).push(e);
    inn.get(e.to).push(e);
  }
  return { out, inn };
}

const envelope = (summary, result, next_actions = [], budget = { depth_used: 0, nodes_visited: 0 }) =>
  ({ summary, result, next_actions, budget });

const sortedNodes = (ids, graph) =>
  [...ids].sort().map((id) => { const n = graph.nodes.get(id); return { id, kind: n.kind, name: n.name }; });

// Keep legacy hints unchanged, but never lose the owner/step address for new
// Saga and qualified nodes whose display name is not their query identity.
const queryId = (node) => node.kind.startsWith('saga') || node.qualifiedRef
  ? node.id.slice(node.kind.length + 1) : node.name;
const describeAction = (graph, node) => `describe('${node.kind}', '${queryId(graph.nodes.get(node.id))}')`;

function withSagaDiagnostics(graph, env, ids) {
  const sagaIds = new Set([...ids].map((id) => graph.nodes.get(id)?.sagaId
    || (id.startsWith('saga:') ? id.slice(5) : null)).filter(Boolean));
  const findings = (graph.diagnostics || []).filter((d) => ids.has(d.from) || ids.has(d.target) || sagaIds.has(d.sagaId));
  if (findings.length) env.diagnostics = findings;
  return env;
}

// one-line per-kind summary, computed from the graph (never invented)
function summarize(graph, node, adj) {
  const outs = adj.out.get(node.id) || [], ins = adj.inn.get(node.id) || [];
  const grp = (es) => {
    const m = new Map();
    for (const e of es) m.set(e.relation, (m.get(e.relation) || 0) + 1);
    return [...m.entries()].map(([r, n]) => `${r} ${n}`).join(', ');
  };
  const bits = [`${node.kind} "${node.name}"`];
  if (outs.length) bits.push(`out: ${grp(outs)}`);
  if (ins.length) bits.push(`in: ${grp(ins)}`);
  return bits.join(' — ');
}

function suggestNext(graph, node, adj) {
  const acts = [];
  const outs = adj.out.get(node.id) || [], ins = adj.inn.get(node.id) || [];
  const has = (rel, dir) => (dir === 'out' ? outs : ins).some((e) => e.relation === rel);
  if (node.kind === 'saga') {
    acts.push(`sagaParticipantsOf('${queryId(node)}')`);
    acts.push(`sagaPhasesOf('${queryId(node)}')`);
    acts.push(`expand('${node.id}', {relations:['triggers','result']})`);
  } else if (node.kind.startsWith('saga-')) {
    acts.push(`expand('${node.id}')`);
    acts.push(`describe('${node.kind}', '${queryId(node)}', true)`);
  } else if (node.kind === 'event') {
    if (node.qualifiedRef) {
      acts.push(`expand('${node.id}', {relations:['triggers','result']})`);
      acts.push(`describe('event', '${queryId(node)}', true)`);
    } else {
      acts.push(`policies_triggered_by('${node.name}')`);
      acts.push(`trigger_source_of('${node.name}')`);
      acts.push(`blast_radius('${node.id}')`);
    }
  } else if (node.kind === 'policy') {
    acts.push(`expand('${node.id}', {relations:['invokes']})`);
    acts.push(`blast_radius('${node.id}')`);
  } else if (node.kind === 'role') {
    acts.push(`commands_of('${node.name}')`);
    acts.push(`read_models_of('${node.name}')`);
  } else if (node.kind === 'aggregate') {
    acts.push(`slices_of('${node.name}')`);
    acts.push(`describe('aggregate', '${node.name}', true)`);
  } else if (node.kind === 'read-model') {
    acts.push(`consumed_by('${node.name}')`);
  } else if (node.kind === 'pipeline') {
    acts.push(`steps_of('${node.id.slice('pipeline:'.length)}')`);
  }
  if (has('derives-from', 'out') || has('lineage', 'out') || has('lineage', 'in'))
    acts.push(`lineage('${node.name}')`);
  return [...new Set(acts)].slice(0, 4);
}

// ── verbs ────────────────────────────────────────────────────────────────────

export function describe(graph, kind, id, full = false) {
  const node = graph.nodes.get(nid(kind, id));
  if (!node) return withSagaDiagnostics(graph,
    envelope(`no such ${kind}: "${id}"`, null, [`search('${id}')`]), new Set([nid(kind, id)]));
  const adj = adjacency(graph);
  const summary = summarize(graph, node, adj);
  const result = full ? node.atom : { id: node.id, kind: node.kind, name: node.name, summary };
  return withSagaDiagnostics(graph,
    envelope(summary, result, suggestNext(graph, node, adj), { depth_used: 0, nodes_visited: 1 }),
    new Set([node.id]));
}

export function expand(graph, id, { depth = 1, direction = 'both', relations = null, limit = 100 } = {}) {
  const adj = adjacency(graph);
  if (!graph.nodes.has(id)) return withSagaDiagnostics(graph,
    envelope(`no such node: "${id}"`, null, [`search('${id}')`]), new Set([id]));
  const relSet = relations ? new Set(relations) : null;
  const follow = (e) => !relSet || relSet.has(e.relation);
  const visited = new Set([id]);
  const foundEdges = [];
  let frontier = [{ id, d: 0 }];
  let depthUsed = 0;
  while (frontier.length && visited.size < limit) {
    const next = [];
    for (const { id: cur, d } of frontier) {
      if (d >= depth) continue;
      const cand = [];
      if (direction === 'out' || direction === 'both') cand.push(...(adj.out.get(cur) || []).map((e) => [e, e.to]));
      if (direction === 'in' || direction === 'both') cand.push(...(adj.inn.get(cur) || []).map((e) => [e, e.from]));
      for (const [e, other] of cand) {
        if (!follow(e)) continue;
        foundEdges.push(e);
        if (!visited.has(other) && visited.size < limit) {
          visited.add(other);
          next.push({ id: other, d: d + 1 });
          depthUsed = Math.max(depthUsed, d + 1);
        }
      }
    }
    frontier = next;
  }
  const nodes = sortedNodes(visited, graph);
  const edges = foundEdges
    .filter((e) => visited.has(e.from) && visited.has(e.to))
    .map((e) => ({ from: e.from, relation: e.relation, to: e.to }))
    .sort((a, b) => (a.from + a.relation + a.to < b.from + b.relation + b.to ? -1 : 1));
  return withSagaDiagnostics(graph, envelope(
    `expand ${id}: ${nodes.length} nodes, ${edges.length} edges (depth ≤ ${depthUsed})`,
    { nodes, edges },
    (graph.nodes.get(id).kind.startsWith('saga') || graph.nodes.get(id).qualifiedRef
      ? nodes.filter((n) => n.id !== id).slice(0, 3) : nodes.slice(1, 4)).map((n) => describeAction(graph, n)),
    { depth_used: depthUsed, nodes_visited: visited.size },
  ), visited);
}

export function blast_radius(graph, id, { depth = 3 } = {}) {
  // "可能影响" (over-approximate): walk exactly the human-adjudicated
  // propagates=true edges.宁多报，不漏报.
  const r = expand(graph, id, { depth, direction: 'both', relations: propagatingRelations() });
  return envelope(
    `blast radius of ${id} (may-impact, over-approximate): ${r.result ? r.result.nodes.length : 0} nodes`,
    r.result, r.next_actions, r.budget,
  );
}

const normField = (f) => (String(f).startsWith('field:') ? String(f) : nid('field', f));

export function lineage(graph, field, { direction = 'both', depth = 3 } = {}) {
  const id = normField(field);
  const r = expand(graph, id, { depth, direction, relations: ['derives-from', 'lineage'] });
  if (!r.result) return r;
  return envelope(`lineage of ${field}: ${r.result.nodes.length} nodes`, r.result, r.next_actions, r.budget);
}

export function anchors(graph, kind, id, options = {}) {
  if (options.indexFile) {
    const knowledgeKey = nid(kind, id);
    const locations = queryAnchorsIndex(knowledgeKey, options);
    const status = locations.some(location => location.status === 'source-verified') ? 'source-verified'
      : locations.some(location => location.status === 'stale') ? 'stale' : 'unanchored';
    return envelope(`anchors('${kind}', '${id}'): ${locations.length} recorded locations (${status})`,
      { status, result: locations }, [`describe('${kind}', '${id}')`],
      { depth_used: 0, nodes_visited: locations.length });
  }
  // Without a derived index, do not invent locations from names or templates.
  return envelope(
    `anchors('${kind}', '${id}'): back-anchors not yet landed — canonical.json carries no code anchors`,
    { status: 'unanchored', result: [] },
    [`describe('${kind}', '${id}')`],
    { depth_used: 0, nodes_visited: 0 },
  );
}

export function search(graph, q, kind = null) {
  const needle = String(q).toLowerCase();
  const hits = [];
  for (const n of graph.nodes.values()) {
    if (kind && n.kind !== kind) continue;
    if (n.name.toLowerCase().includes(needle) || n.id.toLowerCase().includes(needle))
      hits.push({ id: n.id, kind: n.kind, name: n.name });
  }
  hits.sort((a, b) => (a.id < b.id ? -1 : 1));
  return withSagaDiagnostics(graph, envelope(`search "${q}"${kind ? ` in ${kind}` : ''}: ${hits.length} hits`, hits,
    hits.slice(0, 3).map((h) => describeAction(graph, h)),
    { depth_used: 0, nodes_visited: hits.length }), new Set(hits.map((h) => h.id)));
}

export function conditions(graph, command) {
  const node = graph.nodes.get(nid('command', command)) || graph.nodes.get(nid('slice', command));
  if (!node) return envelope(`no such command: "${command}"`, null, [`search('${command}')`]);
  const atom = node.atom || {};
  const result = { command: node.name, guards: atom.guards || [], produces: atom.produces || [] };
  return envelope(
    `conditions for "${command}": ${result.guards.length} guard(s) → produces [${result.produces.join(', ')}]`,
    result,
    node.qualifiedRef ? [`describe('command', '${queryId(node)}', true)`, `expand('${node.id}', {relations:['phase-commands','triggers']})`]
      : [`trigger_source_of('${command}')`, `describe('slice', '${command}', true)`],
    { depth_used: 0, nodes_visited: 1 },
  );
}

export function diff(a, b) {
  const ga = a.nodes ? a : buildGraph(a);
  const gb = b.nodes ? b : buildGraph(b);
  const added = [...gb.nodes.keys()].filter((k) => !ga.nodes.has(k)).sort();
  const removed = [...ga.nodes.keys()].filter((k) => !gb.nodes.has(k)).sort();
  const changed = [...ga.nodes.keys()]
    .filter((k) => gb.nodes.has(k) && JSON.stringify(ga.nodes.get(k).atom) !== JSON.stringify(gb.nodes.get(k).atom))
    .sort();
  return envelope(
    `diff: +${added.length} −${removed.length} ~${changed.length}`,
    { added, removed, changed },
    [], { depth_used: 0, nodes_visited: 0 },
  );
}

export function orphans(graph) {
  // Mirrors the validator's AG1/AG2 (unclaimed L1 cards) + CS1 (events with no
  // trigger source): knowledge-graph edition.
  const unclaimedCommands = [...graph.noteCommands].filter((c) => !graph.sliceCommands.has(c)).sort();
  const unclaimedEvents = [...graph.noteEvents].filter((e) => !graph.poolEvents.has(e)).sort();
  const produced = new Set(graph.edges.filter((e) => e.relation === 'produces').map((e) => e.to));
  const eventsWithoutSource = [...graph.poolEvents].filter((e) => !produced.has(nid('event', e))).sort();
  const result = { unclaimed_commands: unclaimedCommands, unclaimed_events: unclaimedEvents, events_without_source: eventsWithoutSource };
  const total = unclaimedCommands.length + unclaimedEvents.length + eventsWithoutSource.length;
  return envelope(`orphans: ${total} (${unclaimedCommands.length} commands, ${unclaimedEvents.length} events unclaimed; ${eventsWithoutSource.length} pool events sourceless)`,
    result, [], { depth_used: 0, nodes_visited: total });
}

export function consistency_check(graph) {
  // What the tree can actually say today: policies with identical
  // (triggers, invokes) signatures are duplicates. Condition-level conflict
  // checking needs R8 constrains carriers — reported, not invented.
  const findings = [];
  const sig = new Map();
  for (const n of graph.nodes.values()) {
    if (n.kind !== 'policy' || !n.atom) continue;
    const trig = (n.atom.info?.triggers || []).map((t) => t.event).sort().join(',');
    const inv = (n.atom.info?.invokes || []).map((c) => c.command).sort().join(',');
    const key = `${trig} ⇒ ${inv}`;
    if (!sig.has(key)) sig.set(key, []);
    sig.get(key).push(n.id);
  }
  for (const [key, ids] of sig) if (ids.length > 1)
    findings.push({ type: 'duplicate-policy', signature: key, policies: [...ids].sort() });
  const nPolicies = [...graph.nodes.values()].filter((n) => n.kind === 'policy').length;
  return envelope(
    `consistency_check: ${findings.length} finding(s) across ${nPolicies} policies` +
    (findings.length ? '' : ' (condition-conflict checking needs R8 constrains carriers — none in this tree)'),
    { findings, checked: { policies: nPolicies } }, [], { depth_used: 0, nodes_visited: nPolicies });
}

// ── Saga-specific verbs (not pipeline roles or shared registry verbs) ────────
export function sagaParticipantsOf(graph, sagaId) {
  const env = expand(graph, nid('saga', sagaId), { relations: ['owns'], direction: 'out', depth: 1 });
  if (!env.result) return env;
  env.result.nodes = env.result.nodes.filter((n) => n.kind === 'saga-participant');
  const ids = new Set(env.result.nodes.map((n) => n.id));
  env.result.edges = env.result.edges.filter((e) => ids.has(e.to));
  env.summary = `participants of Saga "${sagaId}": ${ids.size} participants`;
  env.next_actions = env.result.nodes.slice(0, 3).map((n) => describeAction(graph, n));
  return env;
}

export function sagaPhasesOf(graph, sagaId, stepId = null) {
  const id = stepId === null ? nid('saga', sagaId) : nid('saga-step', `${sagaId}.${stepId}`);
  const env = expand(graph, id, { relations: ['owns'], direction: 'out', depth: stepId === null ? 2 : 1 });
  if (!env.result) return env;
  env.result.nodes = env.result.nodes.filter((n) => n.kind === 'saga-phase');
  const ids = new Set(env.result.nodes.map((n) => n.id));
  env.result.edges = env.result.edges.filter((e) => ids.has(e.to));
  env.summary = `phases of Saga "${sagaId}"${stepId === null ? '' : ` step "${stepId}"`}: ${ids.size} phases`;
  env.next_actions = env.result.nodes.slice(0, 3).map((n) => describeAction(graph, n));
  return env;
}

// ── registry-derived named verbs (§4.2) ──────────────────────────────────────
// Each is a thin wrapper over expand()/describe() — new registry relations
// automatically grow this surface (verbs are grown, not designed).
// Named verbs drop the seed node: the answer is the *related* nodes.
const trimSeed = (env, seedId) => {
  if (env.result && Array.isArray(env.result.nodes))
    env.result.nodes = env.result.nodes.filter((n) => n.id !== seedId);
  return env;
};

export const slices_of = (g, aggregate) => {
  const id = nid('aggregate', aggregate);
  return trimSeed(expand(g, id, { relations: ['owns'], depth: 1 }), id);
};
export const events_of = (g, aggregate) => {
  const id = nid('aggregate', aggregate);
  return trimSeed(expand(g, id, { relations: ['emits'], depth: 1 }), id);
};
export const commands_of = (g, role) => {
  const id = nid('role', role);
  return trimSeed(expand(g, id, { relations: ['can-issue'], depth: 1, direction: 'out' }), id);
};
export const read_models_of = (g, role) => {
  const id = nid('role', role);
  return trimSeed(expand(g, id, { relations: ['visible-to'], depth: 1, direction: 'in' }), id);
};
export const policies_triggered_by = (g, event) => {
  const id = nid('event', event);
  return trimSeed(expand(g, id, { relations: ['triggers'], depth: 1, direction: 'out' }), id);
};
export const policies_constraining = (g, slice) => {
  const id = nid('slice', slice);
  return trimSeed(expand(g, id, { relations: ['constrains'], depth: 1, direction: 'in' }), id);
};
export const steps_of = (g, pipeline) => {
  const id = nid('pipeline', pipeline);
  return trimSeed(expand(g, id, { relations: ['has-step'], depth: 1 }), id);
};
export const participants_of = (g, pipeline) => {
  const adj = adjacency(g);
  const steps = (adj.out.get(nid('pipeline', pipeline)) || []).filter((e) => e.relation === 'has-step');
  const roles = new Set();
  const stepIds = [];
  for (const e of steps) {
    stepIds.push(e.to);
    for (const e2 of adj.out.get(e.to) || [])
      if (e2.relation === 'performed-by') roles.add(e2.to);
  }
  const result = {
    steps: stepIds.sort().map((id) => { const n = g.nodes.get(id); return { id, kind: n.kind, name: n.name }; }),
    participants: [...roles].sort().map((id) => { const n = g.nodes.get(id); return { id, kind: n.kind, name: n.name }; }),
  };
  return envelope(
    `participants of pipeline "${pipeline}": ${result.steps.length} steps, ${result.participants.length} roles` +
    (result.participants.length ? '' : ' (no performed-by carriers in this tree)'),
    result, [], { depth_used: 2, nodes_visited: stepIds.length + roles.size },
  );
};
export const consumed_by = (g, field) => {
  const id = normField(field);
  return trimSeed(expand(g, id, { relations: ['derives-from'], depth: 1, direction: 'in' }), id);
};
export const trigger_source_of = (g, event) => {
  const id = nid('event', event);
  return trimSeed(expand(g, id, { relations: ['produces'], depth: 1, direction: 'in' }), id);
};
export const aggregates_referencing = (g, aggregate) => {
  const id = nid('aggregate', aggregate);
  return trimSeed(expand(g, id, { relations: ['references'], depth: 1, direction: 'in' }), id);
};
export const contexts_depending_on = (g, context) => {
  const id = nid('context', context);
  return trimSeed(expand(g, id, { relations: ['depends-on'], depth: 1, direction: 'in' }), id);
};
