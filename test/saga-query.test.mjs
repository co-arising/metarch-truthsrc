import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import {
  buildGraph, loadCanonical, describe, expand, search, conditions, diff,
  anchors, slices_of, events_of, steps_of, participants_of,
  sagaParticipantsOf, sagaPhasesOf,
} from '../lib/query.mjs';
import { RESULT_KINDS, sagaContract } from './fixtures/saga-contract.mjs';

const nodeIds = (env) => env.result.nodes.map((n) => n.id).sort();
const outgoing = (g, id, relation) => g.edges.filter((e) => e.from === id && e.relation === relation).map((e) => e.to).sort();
const incoming = (g, id, relation) => g.edges.filter((e) => e.to === id && e.relation === relation).map((e) => e.from).sort();
const phaseNames = ['prepare', 'commit', 'compensate'];
const money = () => sagaContract().canonical;

for (const domain of ['MoneyTransfer', 'Fab']) {
  const canonical = sagaContract(domain).canonical;
  const saga = canonical.sagas[0], sagaId = `saga:${saga.id}`;
  const aggregate = canonical.aggregates[0];
  const graph = buildGraph(canonical);
  const phaseIds = saga.payload.steps.flatMap((step) => phaseNames.map((phase) => `saga-phase:${saga.id}.${step.id}.${phase}`)).sort();

  test(`${domain}: Saga identity is the header id, full describe preserves the whole product`, () => {
    assert.equal(describe(graph, 'saga', saga.id).result.id, sagaId);
    assert.deepEqual(describe(graph, 'saga', saga.id, true).result, saga);
    assert.equal(describe(graph, 'saga', saga.name).result, null);
    assert.deepEqual(search(graph, saga.name, 'saga').result.map((n) => n.id), [sagaId]);
    assert.deepEqual(graph.diagnostics, []);
    assert.equal(graph.nodes.size, 51);
    assert.equal(graph.edges.length, 73);
    assert.ok(graph.edges.every((e) => graph.nodes.has(e.from) && graph.nodes.has(e.to)));
  });

  test(`${domain}: owns and participates connect actual participants, resources and steps`, () => {
    const participants = sagaParticipantsOf(graph, saga.id);
    assert.deepEqual(nodeIds(participants), ['source', 'target'].map((p) => `saga-participant:${saga.id}.${p}`));
    for (const participant of saga.payload.participants) {
      const id = `saga-participant:${saga.id}.${participant.id}`;
      assert.deepEqual(describe(graph, 'saga-participant', `${saga.id}.${participant.id}`, true).result, participant);
      assert.deepEqual(outgoing(graph, id, 'participates'), [`aggregate:${aggregate.name}`]);
      assert.ok(outgoing(graph, sagaId, 'owns').includes(id));
    }
    for (const step of saga.payload.steps) {
      const id = `saga-step:${saga.id}.${step.id}`;
      assert.ok(outgoing(graph, sagaId, 'owns').includes(id));
      assert.deepEqual(outgoing(graph, id, 'participates'), [`saga-participant:${saga.id}.${step.participant}`]);
    }
  });

  test(`${domain}: sagaPhasesOf lists six phases, or only the selected step's three`, () => {
    assert.deepEqual(nodeIds(sagaPhasesOf(graph, saga.id)), phaseIds);
    for (const step of saga.payload.steps) {
      const wanted = phaseNames.map((phase) => `saga-phase:${saga.id}.${step.id}.${phase}`).sort();
      assert.deepEqual(nodeIds(sagaPhasesOf(graph, saga.id, step.id)), wanted);
      assert.deepEqual(outgoing(graph, `saga-step:${saga.id}.${step.id}`, 'owns'), wanted);
    }
  });

  test(`${domain}: phase-commands targets only aggregate-qualified commands`, () => {
    for (const step of saga.payload.steps) for (const phase of phaseNames) {
      const id = `saga-phase:${saga.id}.${step.id}.${phase}`;
      const declaration = step.phases[phase];
      const target = `command:${aggregate.name}.${declaration.commandRef.name}`;
      assert.deepEqual(outgoing(graph, id, 'phase-commands'), [target]);
      assert.deepEqual(outgoing(graph, id, 'participates'), [`saga-participant:${saga.id}.${step.participant}`]);
      const full = describe(graph, 'saga-phase', `${saga.id}.${step.id}.${phase}`, true).result;
      assert.deepEqual(full.commandRef, declaration.commandRef);
      assert.deepEqual(full.bindings, declaration.bindings);
      assert.deepEqual(full.outputs, declaration.outputs);
      assert.equal(full.phase, phase);
      assert.equal(full.stepId, step.id);
      assert.deepEqual(describe(graph, 'command', `${aggregate.name}.${declaration.commandRef.name}`, true).result,
        aggregate.commands.find((c) => c.name === declaration.commandRef.name));
    }
  });

  test(`${domain}: result edges expose all five outcomes, never infer receipt confirmations`, () => {
    assert.deepEqual(outgoing(graph, sagaId, 'result'), RESULT_KINDS.map((kind) => `event:${aggregate.name}.result-${kind}`).sort());
    assert.equal(search(graph, '', 'event').result.length, aggregate.events.length + RESULT_KINDS.length + 1);
    assert.equal([...graph.nodes.keys()].filter((id) => id.includes(`${aggregate.name}.`) && id.endsWith('-confirmed')).length, 0);
    for (const kind of RESULT_KINDS) {
      assert.deepEqual(describe(graph, 'event', `${aggregate.name}.result-${kind}`, true).result,
        aggregate.events.find((e) => e.name === `result-${kind}`));
    }
  });

  test(`${domain}: independent command and event sources trigger the Saga, with correct direction`, () => {
    assert.deepEqual(incoming(graph, sagaId, 'triggers'), [
      `command:${aggregate.name}.StartTransfer`, `event:${aggregate.name}.TransferRequested`,
    ]);
    const sources = expand(graph, sagaId, { relations: ['triggers'], direction: 'in' });
    assert.deepEqual(nodeIds(sources), [`command:${aggregate.name}.StartTransfer`, `event:${aggregate.name}.TransferRequested`, sagaId].sort());
    assert.deepEqual(expand(graph, sagaId, { relations: ['triggers'], direction: 'out' }).result.edges, []);
    assert.deepEqual(outgoing(graph, 'command:StartTransfer', 'triggers'), []);
    assert.deepEqual(outgoing(graph, 'event:TransferRequested', 'triggers'), []);
  });

  test(`${domain}: new verbs share the envelope and generic expansion budgets`, () => {
    const envs = [sagaParticipantsOf(graph, saga.id), sagaPhasesOf(graph, saga.id), sagaPhasesOf(graph, saga.id, 'reserve-source')];
    for (const env of envs) {
      assert.equal(typeof env.summary, 'string');
      assert.ok(Array.isArray(env.result.nodes) && Array.isArray(env.result.edges));
      assert.ok(Array.isArray(env.next_actions));
      assert.equal(typeof env.budget.depth_used, 'number');
      assert.equal(typeof env.budget.nodes_visited, 'number');
    }
    const expanded = expand(graph, sagaId, { direction: 'out', depth: 3, relations: ['owns', 'phase-commands'] });
    assert.ok(phaseIds.every((id) => nodeIds(expanded).includes(id)));
    assert.ok(nodeIds(expanded).includes(`command:${aggregate.name}.prepare-source`));
    assert.equal(expanded.budget.depth_used, 3);
    assert.ok(expand(graph, sagaId, { depth: 5, limit: 4 }).result.nodes.length <= 4);
  });

  test(`${domain}: search/describe/expand next actions retain Saga and owner-qualified identities`, () => {
    const envs = [search(graph, 'reserve-source.prepare'), search(graph, 'prepare-source', 'command'),
      search(graph, saga.name, 'saga'), sagaParticipantsOf(graph, saga.id), sagaPhasesOf(graph, saga.id),
      conditions(graph, `${aggregate.name}.prepare-source`),
      describe(graph, 'saga-phase', `${saga.id}.reserve-source.prepare`),
      describe(graph, 'event', `${aggregate.name}.TransferRequested`),
      expand(graph, `saga-phase:${saga.id}.reserve-source.prepare`)];
    for (const env of envs) for (const action of env.next_actions) {
      const match = /^describe\('([^']+)', '([^']+)'(?:, true)?\)$/.exec(action);
      if (match) assert.notEqual(describe(graph, match[1], match[2]).result, null, action);
    }
    assert.ok(search(graph, 'reserve-source.prepare').next_actions.includes(`describe('saga-phase', '${saga.id}.reserve-source.prepare')`));
    assert.ok(search(graph, `${aggregate.name}.prepare-source`).next_actions.includes(`describe('command', '${aggregate.name}.prepare-source')`));
    assert.ok(describe(graph, 'saga', saga.id).next_actions.includes(`sagaParticipantsOf('${saga.id}')`));
    assert.deepEqual(conditions(graph, `${aggregate.name}.prepare-source`).next_actions, [
      `describe('command', '${aggregate.name}.prepare-source', true)`,
      `expand('command:${aggregate.name}.prepare-source', {relations:['phase-commands','triggers']})`,
    ]);
  });

  test(`${domain}: legacy command ids and aggregate slices/events retain their existing answers`, () => {
    assert.deepEqual(describe(graph, 'command', 'prepare-source', true).result, aggregate.commands[0]);
    assert.deepEqual(conditions(graph, 'prepare-source').result.produces, ['prepare-source-confirmed']);
    assert.equal(nodeIds(slices_of(graph, aggregate.name)).length, aggregate.commands.length);
    assert.equal(nodeIds(events_of(graph, aggregate.name)).length, aggregate.events.length);
    assert.equal(search(graph, '', 'command').result.length, aggregate.commands.length * 2);
  });

  test(`${domain}: adding Saga products preserves the complete legacy subgraph`, () => {
    const { sagas, ...legacy } = canonical;
    const before = buildGraph(legacy);
    assert.deepEqual([...graph.nodes].filter(([id]) => before.nodes.has(id)), [...before.nodes]);
    assert.deepEqual(graph.edges.filter((e) => before.nodes.has(e.from) && before.nodes.has(e.to)), before.edges);
    for (const key of ['sliceCommands', 'poolEvents', 'noteEvents', 'noteCommands'])
      assert.deepEqual(graph[key], before[key]);
    for (const command of aggregate.commands) {
      assert.deepEqual(describe(graph, 'command', command.name), describe(before, 'command', command.name));
      assert.deepEqual(conditions(graph, command.name), conditions(before, command.name));
    }
    for (const event of aggregate.events)
      assert.deepEqual(describe(graph, 'event', event.name), describe(before, 'event', event.name));
    assert.deepEqual(events_of(graph, aggregate.name), events_of(before, aggregate.name));
    assert.deepEqual(slices_of(graph, aggregate.name), slices_of(before, aggregate.name));
  });

  test(`${domain}: anchors remain an honest unanchored stub for all Saga node kinds`, () => {
    for (const [kind, id] of [['saga', saga.id], ['saga-participant', `${saga.id}.source`],
      ['saga-phase', `${saga.id}.reserve-source.prepare`]]) {
      assert.deepEqual(anchors(graph, kind, id).result, { status: 'unanchored', result: [] });
    }
  });
}

test('same names in another aggregate never hijack Saga phase, trigger or result refs', () => {
  const c = money();
  const decoy = structuredClone(c.aggregates[0]);
  decoy.name = 'Decoy';
  decoy.commands.forEach((c) => { c.guards = ['decoy-only']; });
  decoy.events.forEach((e) => { e.description = 'decoy-only'; });
  c.aggregates.unshift(decoy); // Legacy global ids intentionally remain first-wins.
  const g = buildGraph(c);
  assert.deepEqual(conditions(g, 'prepare-source').result.guards, ['decoy-only']);
  assert.deepEqual(conditions(g, 'Account.prepare-source').result.guards, []);
  assert.ok(![...g.nodes.keys()].some((id) => /^command:Decoy\.|^event:Decoy\./.test(id)));
  for (const edge of g.edges.filter((e) => e.relation === 'phase-commands' || e.relation === 'result'))
    assert.match(edge.to, /^(command|event):Account\./);
  assert.deepEqual(incoming(g, 'saga:money-transfer', 'triggers'), ['command:Account.StartTransfer', 'event:Account.TransferRequested']);
  assert.deepEqual(g.diagnostics, []);
});

for (const [surface, kind, name, pointer, remove] of [
  ['phase command', 'command', 'prepare-source', '/sagas/0/payload/steps/0/phases/prepare/commandRef',
    (c) => { c.aggregates[0].commands = c.aggregates[0].commands.filter((x) => x.name !== 'prepare-source'); }],
  ['command trigger', 'command', 'StartTransfer', '/sagas/0/payload/triggers/0/sourceRef',
    (c) => { c.aggregates[0].commands = c.aggregates[0].commands.filter((x) => x.name !== 'StartTransfer'); }],
  ['event trigger', 'event', 'TransferRequested', '/sagas/0/payload/triggers/1/sourceRef',
    (c) => { c.aggregates[0].events = c.aggregates[0].events.filter((x) => x.name !== 'TransferRequested'); }],
  ['result event', 'event', 'result-succeeded', '/sagas/0/payload/completions/0/eventRef',
    (c) => { c.aggregates[0].events = c.aggregates[0].events.filter((x) => x.name !== 'result-succeeded'); }],
]) {
  test(`missing ${surface}: existing global/narrative/other-owner names are not ownership proof`, () => {
    const c = money();
    const decoy = structuredClone(c.aggregates[0]);
    decoy.name = 'Decoy';
    remove(c);
    c.aggregates.push(decoy);
    c.sessions = [{ scopes: [{ notes: [{ type: kind, name }] }] }];
    const g = buildGraph(c), target = `${kind}:Account.${name}`;
    assert.ok(g.nodes.has(`${kind}:${name}`), 'global homonym still exists');
    assert.ok(!g.nodes.has(target), 'never manufacture qualified business node');
    assert.ok(!g.edges.some((e) => e.from === target || e.to === target));
    assert.deepEqual(g.diagnostics, [{ code: 'saga-ref-unmapped', sagaId: 'money-transfer',
      from: surface === 'phase command' ? 'saga-phase:money-transfer.reserve-source.prepare' : 'saga:money-transfer',
      relation: surface === 'phase command' ? 'phase-commands' : surface === 'result event' ? 'result' : 'triggers',
      pointer, target, ref: { aggregate: 'Account', name }, reason: 'unknown-owned-ref' }]);
    assert.deepEqual(describe(g, 'saga', 'money-transfer').diagnostics, g.diagnostics);
    assert.deepEqual(expand(g, 'saga:money-transfer').diagnostics, g.diagnostics);
    assert.deepEqual(sagaPhasesOf(g, 'money-transfer').diagnostics, g.diagnostics);
  });
}

test('unqualified phase reference is diagnosed, not resolved by a legacy command name', () => {
  const c = money();
  c.sagas[0].payload.steps[0].phases.prepare.commandRef = 'prepare-source';
  const g = buildGraph(c);
  assert.deepEqual(outgoing(g, 'saga-phase:money-transfer.reserve-source.prepare', 'phase-commands'), []);
  assert.equal(g.diagnostics[0].reason, 'aggregate-qualified-ref-required');
  assert.equal(g.diagnostics[0].ref, 'prepare-source');
  assert.equal(g.diagnostics[0].target, null);
  assert.ok(!g.nodes.has('command:Account.prepare-source'));
});

test('unknown aggregate, participant and event refs produce qualified diagnostics but no phantom nodes', () => {
  const c = money(), p = c.sagas[0].payload;
  p.participants[0].aggregate = 'Missing';
  p.steps[0].participant = 'ghost';
  p.steps[0].phases.prepare.commandRef.aggregate = 'Missing';
  p.completions[0].eventRef.aggregate = 'Missing';
  const g = buildGraph(c);
  assert.ok(!g.nodes.has('aggregate:Missing'));
  assert.ok(!g.nodes.has('saga-participant:money-transfer.ghost'));
  assert.ok(!g.nodes.has('command:Missing.prepare-source'));
  assert.ok(!g.nodes.has('event:Missing.result-succeeded'));
  assert.deepEqual(g.diagnostics.map((d) => d.target), [
    'aggregate:Missing', 'saga-participant:money-transfer.ghost',
    'command:Missing.prepare-source', 'command:Account.commit-source',
    'command:Account.compensate-source', 'event:Missing.result-succeeded',
  ]);
  assert.deepEqual(g.diagnostics.slice(1, 5).map((d) => d.reason), Array(4).fill('unknown-participant'));
  assert.ok(!g.nodes.has('command:Account.commit-source'));
  assert.ok(!g.nodes.has('command:Account.compensate-source'));
  assert.ok(g.edges.every((e) => g.nodes.has(e.from) && g.nodes.has(e.to)));
});

test('phase ref to a different real aggregate fails closed against the declared participant', () => {
  const c = money();
  c.aggregates.push({ name: 'Decoy', commands: [{ name: 'prepare-source' }], events: [] });
  c.sagas[0].payload.steps[0].phases.prepare.commandRef.aggregate = 'Decoy';
  const g = buildGraph(c);
  assert.deepEqual(outgoing(g, 'saga-phase:money-transfer.reserve-source.prepare', 'phase-commands'), []);
  assert.ok(!g.nodes.has('command:Decoy.prepare-source'));
  assert.equal(g.diagnostics[0].reason, 'participant-aggregate-mismatch');
  assert.equal(g.diagnostics[0].target, 'command:Decoy.prepare-source');
});

for (const scope of ['aggregate', 'command', 'event']) {
  test(`duplicate ${scope} ownership is diagnosed instead of selecting an arbitrary definition`, () => {
    const c = money();
    if (scope === 'aggregate') c.aggregates.push(structuredClone(c.aggregates[0]));
    if (scope === 'command') c.aggregates[0].commands.push(structuredClone(c.aggregates[0].commands[0]));
    if (scope === 'event') c.aggregates[0].events.push(structuredClone(c.aggregates[0].events.find((e) => e.name === 'result-succeeded')));
    const g = buildGraph(c);
    const target = scope === 'aggregate' ? 'aggregate:Account' : scope === 'command' ? 'command:Account.prepare-source' : 'event:Account.result-succeeded';
    assert.ok(g.diagnostics.some((d) => d.target === target && d.reason.startsWith('ambiguous-')));
    if (scope !== 'aggregate') assert.ok(!g.nodes.has(target));
  });
}

for (const conflicting of [false, true]) {
  test(`duplicate participant id (${conflicting ? 'conflicting' : 'identical'}): diagnose every declaration without merging ownership`, () => {
    const c = money(), payload = c.sagas[0].payload;
    const duplicate = structuredClone(payload.participants[0]);
    if (conflicting) {
      c.aggregates.push({ name: 'Decoy', commands: [{ name: 'prepare-source' }], events: [] });
      duplicate.aggregate = 'Decoy';
    }
    payload.participants.push(duplicate);
    const g = buildGraph(c), target = 'saga-participant:money-transfer.source';
    assert.ok(!g.nodes.has(target));
    assert.deepEqual(nodeIds(sagaParticipantsOf(g, 'money-transfer')), ['saga-participant:money-transfer.target']);
    assert.deepEqual(g.diagnostics.filter((d) => d.reason === 'duplicate-participant-id'), [0, 2].map((i) => ({
      code: 'saga-ref-unmapped', sagaId: 'money-transfer', from: 'saga:money-transfer', relation: 'owns',
      pointer: `/sagas/0/payload/participants/${i}/id`, target, ref: 'source', reason: 'duplicate-participant-id',
    })));
    assert.equal(g.diagnostics.filter((d) => d.reason === 'ambiguous-participant').length, 4);
    for (const phase of phaseNames) {
      const id = `saga-phase:money-transfer.reserve-source.${phase}`;
      assert.deepEqual(outgoing(g, id, 'participates'), []);
      assert.deepEqual(outgoing(g, id, 'phase-commands'), []);
      assert.ok(!g.nodes.has(`command:Account.${phase}-source`));
      assert.deepEqual(describe(g, 'saga-phase', id.slice('saga-phase:'.length)).diagnostics, g.diagnostics);
    }
    assert.deepEqual(describe(g, 'saga-participant', 'money-transfer.source').diagnostics,
      g.diagnostics.filter((d) => d.target === target));
    assert.deepEqual(sagaPhasesOf(g, 'money-transfer', 'reserve-source').diagnostics, g.diagnostics);
    assert.deepEqual(search(g, 'money-transfer', 'saga').diagnostics, g.diagnostics);
    assert.ok(!g.edges.some((e) => e.from === target || e.to === target));
  });

  test(`duplicate step id (${conflicting ? 'conflicting' : 'identical'}): do not union phases or choose one participant`, () => {
    const c = money(), payload = c.sagas[0].payload;
    const duplicate = structuredClone(payload.steps[0]);
    if (conflicting) {
      duplicate.participant = 'target';
      duplicate.phases = structuredClone(payload.steps[1].phases);
    }
    payload.steps.push(duplicate);
    const g = buildGraph(c), target = 'saga-step:money-transfer.reserve-source';
    assert.ok(!g.nodes.has(target));
    assert.deepEqual(nodeIds(sagaPhasesOf(g, 'money-transfer')),
      phaseNames.map((phase) => `saga-phase:money-transfer.reserve-target.${phase}`).sort());
    assert.deepEqual(g.diagnostics, [0, 2].map((i) => ({
      code: 'saga-ref-unmapped', sagaId: 'money-transfer', from: 'saga:money-transfer', relation: 'owns',
      pointer: `/sagas/0/payload/steps/${i}/id`, target, ref: 'reserve-source', reason: 'duplicate-step-id',
    })));
    for (const phase of phaseNames) {
      assert.ok(!g.nodes.has(`saga-phase:money-transfer.reserve-source.${phase}`));
      assert.ok(!g.nodes.has(`command:Account.${phase}-source`));
    }
    const env = sagaPhasesOf(g, 'money-transfer', 'reserve-source');
    assert.equal(env.result, null);
    assert.deepEqual(env.diagnostics, g.diagnostics);
    assert.deepEqual(describe(g, 'saga-step', 'money-transfer.reserve-source').diagnostics, g.diagnostics);
    assert.ok(g.edges.every((e) => g.nodes.has(e.from) && g.nodes.has(e.to)));
  });
}

test('participant without aggregate cannot authorize an otherwise real phase command', () => {
  const c = money();
  delete c.sagas[0].payload.participants[0].aggregate;
  const g = buildGraph(c);
  for (const phase of phaseNames) {
    const id = `saga-phase:money-transfer.reserve-source.${phase}`;
    assert.deepEqual(outgoing(g, id, 'phase-commands'), []);
    assert.ok(!g.nodes.has(`command:Account.${phase}-source`));
  }
  assert.equal(g.diagnostics.filter((d) => d.reason === 'participant-aggregate-required').length, 3);
  assert.deepEqual(sagaPhasesOf(g, 'money-transfer', 'reserve-source').diagnostics, g.diagnostics);
});

test('qualified id collision with a real dotted legacy name cannot silently select that command', () => {
  const c = money();
  c.aggregates.unshift({ name: 'Decoy', commands: [{ name: 'Account.prepare-source' }], events: [] });
  const g = buildGraph(c);
  assert.deepEqual(outgoing(g, 'saga-phase:money-transfer.reserve-source.prepare', 'phase-commands'), []);
  assert.equal(g.diagnostics[0].reason, 'qualified-id-collision');
  assert.equal(g.diagnostics[0].target, 'command:Account.prepare-source');
  assert.deepEqual(describe(g, 'command', 'Account.prepare-source', true).result, { name: 'Account.prepare-source' });
});

test('read-only none phases are real declarations with no command edge; absent phases are not invented', () => {
  const c = money(), step = c.sagas[0].payload.steps[0];
  for (const phase of phaseNames) step.phases[phase] = { kind: 'none', reason: 'read-only' };
  delete c.sagas[0].payload.steps[1].phases.compensate;
  const g = buildGraph(c);
  assert.equal(nodeIds(sagaPhasesOf(g, 'money-transfer')).length, 5);
  for (const phase of phaseNames) {
    assert.deepEqual(outgoing(g, `saga-phase:money-transfer.reserve-source.${phase}`, 'phase-commands'), []);
    assert.equal(describe(g, 'saga-phase', `money-transfer.reserve-source.${phase}`, true).result.reason, 'read-only');
  }
  assert.ok(!g.nodes.has('saga-phase:money-transfer.reserve-target.compensate'));
  assert.ok(!g.nodes.has('command:Account.prepare-source'));
});

test('unsupported opaque Saga payload remains describable but does not invent execution relations', () => {
  const c = money();
  c.sagas[0].payload.schemaVersion = 'future.saga/v9';
  const g = buildGraph(c);
  assert.deepEqual(describe(g, 'saga', 'money-transfer', true).result, c.sagas[0]);
  assert.deepEqual(nodeIds(sagaParticipantsOf(g, 'money-transfer')), []);
  assert.deepEqual(nodeIds(sagaPhasesOf(g, 'money-transfer')), []);
  assert.equal(g.diagnostics[0].code, 'saga-payload-unmapped');
  assert.ok(!g.nodes.has('command:Account.prepare-source'));
});

test('multiple Sagas scope participant and phase ids; only identical owned refs share business nodes', () => {
  const c = money(), fab = sagaContract('Fab').canonical;
  const second = structuredClone(c.sagas[0]);
  second.id = 'money-transfer-copy';
  c.sagas.push(second, fab.sagas[0]);
  c.aggregates.push(fab.aggregates[0]);
  const g = buildGraph(c);
  assert.equal(search(g, '', 'saga').result.length, 3);
  assert.equal(search(g, '', 'saga-participant').result.length, 6);
  assert.equal(search(g, '', 'saga-phase').result.length, 18);
  assert.deepEqual(incoming(g, 'command:Account.prepare-source', 'phase-commands'), [
    'saga-phase:money-transfer-copy.reserve-source.prepare', 'saga-phase:money-transfer.reserve-source.prepare',
  ]);
  assert.deepEqual(incoming(g, 'command:Lot.prepare-source', 'phase-commands'), ['saga-phase:fab-double-lot.reserve-source.prepare']);
  assert.ok(nodeIds(sagaPhasesOf(g, second.id)).every((id) => id.startsWith(`saga-phase:${second.id}.`)));
  assert.deepEqual(g.diagnostics, []);
});

test('pipeline participants_of remains steps and roles, not Saga participants even with the same id', () => {
  const c = money();
  c.sessions = [{ scopes: [{ notes: [{ type: 'role', name: 'Operator' }] }] }];
  c.pipelines = [{ id: 'money-transfer', steps: [{ id: 'reserve-source', actor: 'Operator' }] }];
  const g = buildGraph(c);
  assert.deepEqual(participants_of(g, 'money-transfer').result, {
    steps: [{ id: 'step:money-transfer.reserve-source', kind: 'step', name: 'reserve-source' }],
    participants: [{ id: 'role:Operator', kind: 'role', name: 'Operator' }],
  });
  assert.deepEqual(nodeIds(steps_of(g, 'money-transfer')), ['step:money-transfer.reserve-source']);
  assert.equal(sagaParticipantsOf(g, 'money-transfer').result.nodes.length, 2);
  assert.equal(sagaPhasesOf(g, 'money-transfer').result.nodes.length, 6);
});

test('ordinary Monarch ports and narrative Saga mentions never imply an invocation edge', () => {
  const c = money();
  c.pipelines = [{ id: 'monarch', steps: [
    { id: 'money-transfer', name: 'Invoke money-transfer Saga', execution: { port: 'money-transfer' } },
    { id: 'saga-port', execution: { port: 'fixture.SagaPort' } },
  ] }];
  const g = buildGraph(c);
  assert.ok(!g.edges.some((e) => e.from.startsWith('step:monarch.') && e.to.startsWith('saga:')));
});

test('missing Saga and Saga step use existing graceful no-such-node envelopes', () => {
  const g = buildGraph(money());
  for (const env of [sagaParticipantsOf(g, 'missing'), sagaPhasesOf(g, 'missing'),
    sagaPhasesOf(g, 'money-transfer', 'missing')]) {
    assert.equal(env.result, null);
    assert.match(env.summary, /no such node/);
    assert.ok(env.next_actions.some((action) => action.startsWith('search(')));
  }
});

test('optional seq is not manufactured and Saga header changes are visible through existing diff', () => {
  const c = money();
  delete c.sagas[0].seq;
  const g = buildGraph(c);
  assert.ok(!Object.hasOwn(describe(g, 'saga', 'money-transfer', true).result, 'seq'));
  const changed = structuredClone(c);
  changed.sagas[0].version = 'v2';
  assert.deepEqual(diff(g, buildGraph(changed)).result, { added: [], removed: [], changed: ['saga:money-transfer'] });
});

for (const [pilot, counts] of [
  ['bank', { nodes: 115, edges: 120, commands: 16, events: 22 }],
  ['fab', { nodes: 132, edges: 119, commands: 20, events: 31 }],
]) {
  test(`${pilot}: no-Saga legacy graph/search counts remain byte-equivalent with absent or empty sagas`, () => {
    const c = loadCanonical(join(import.meta.dirname, 'fixtures', `${pilot}.canonical.json`));
    const g = buildGraph(c), empty = buildGraph({ ...c, sagas: [] });
    assert.equal(g.nodes.size, counts.nodes);
    assert.equal(g.edges.length, counts.edges);
    assert.equal(search(g, '').result.length, counts.nodes);
    assert.equal(search(g, '', 'command').result.length, counts.commands);
    assert.equal(search(g, '', 'event').result.length, counts.events);
    assert.deepEqual([...empty.nodes], [...g.nodes]);
    assert.deepEqual(empty.edges, g.edges);
    assert.deepEqual(search(empty, ''), search(g, ''));
    assert.deepEqual(g.diagnostics, []);
    assert.ok(![...g.nodes.keys()].some((id) => id.startsWith('saga')));
  });
}
