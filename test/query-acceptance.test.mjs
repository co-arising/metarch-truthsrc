// query-acceptance.test.mjs — the 27 consumption scenarios (§6 of the design)
// as executable acceptance tests over the two compiled pilot trees.
//
// Rule: every expected answer was verified against the actual tree content
// (see comments citing the source atom). Where the tree lacks the data to
// express a scenario, the test asserts the honest empty result and says so —
// never invented data. Scenarios that need a data source v0.5 doesn't have
// yet (DEV-5: generated/handwritten manifest) are listed in the header and
// have no test.
//
// Fixtures: test/fixtures/{bank,fab}.canonical.json, compiled from
// ~/workspace/split/{bank-batch-transactor-demo,fab-simulator-demo}/truth/
// (97 and 122 atoms; both validate 0-hard). Regenerate after tree changes:
//   node -e "import('./lib/compile.mjs').then(async ({compileTree}) => {
//     const {writeFileSync} = await import('node:fs');
//     writeFileSync('test/fixtures/bank.canonical.json',
//       compileTree('/home/hatch/workspace/split/bank-batch-transactor-demo/truth'));
//     writeFileSync('test/fixtures/fab.canonical.json',
//       compileTree('/home/hatch/workspace/split/fab-simulator-demo/truth')); })"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import {
  loadCanonical, buildGraph, describe, expand, blast_radius, lineage, anchors,
  search, conditions, diff, orphans, consistency_check,
  slices_of, events_of, commands_of, read_models_of, policies_triggered_by,
  policies_constraining, steps_of, participants_of, consumed_by, trigger_source_of,
  aggregates_referencing, contexts_depending_on,
} from '../lib/query.mjs';

const FX = join(import.meta.dirname, 'fixtures');
const bank = buildGraph(loadCanonical(join(FX, 'bank.canonical.json')));
const fab = buildGraph(loadCanonical(join(FX, 'fab.canonical.json')));

const ids = (env) => env.result.nodes.map((n) => n.id).sort();
const hasAll = (env, want) => { const s = new Set(ids(env)); return want.every((w) => s.has(w)); };

// ── envelope contract ────────────────────────────────────────────────────────
test('envelope: every verb returns {summary, result, next_actions, budget}', () => {
  for (const env of [
    describe(bank, 'aggregate', 'Batch Chain Run'),
    expand(bank, 'event:run-completed'),
    blast_radius(bank, 'event:run-completed'),
    lineage(bank, 'order-credited.amount'),
    anchors(bank, 'slice', 'replay-exception'),
    search(bank, 'replay'),
    conditions(bank, 'replay-exception'),
    orphans(bank),
    consistency_check(bank),
    slices_of(bank, 'Batch Chain Run'),
  ]) {
    assert.ok(typeof env.summary === 'string' && env.summary.length, 'summary');
    assert.ok('result' in env, 'result');
    assert.ok(Array.isArray(env.next_actions), 'next_actions');
    assert.ok(env.budget && typeof env.budget.depth_used === 'number', 'budget');
  }
});

test('describe defaults to summary; full=true returns the atom', () => {
  const s = describe(bank, 'aggregate', 'Batch Chain Run');
  assert.ok(s.result.summary.includes('Batch Chain Run'));
  assert.ok(!('commands' in s.result), 'summary must not dump the payload');
  const f = describe(bank, 'aggregate', 'Batch Chain Run', true);
  assert.ok(Array.isArray(f.result.commands) && f.result.commands.length === 2);
});

test('expand defaults: depth=1, limit=100, both directions', () => {
  const r = expand(bank, 'event:run-completed');
  assert.equal(r.budget.depth_used, 1);
  assert.ok(r.budget.nodes_visited <= 100);
  // both directions: outgoing triggers + incoming produces
  assert.ok(hasAll(r, ['policy:Batch Business Closure', 'command:start-batch-run']));
});

test('unknown ids fail gracefully with a search hint', () => {
  for (const env of [describe(bank, 'aggregate', 'Nope'), expand(bank, 'event:nope'), conditions(bank, 'nope')]) {
    assert.ok(env.summary.includes('no such'), env.summary);
    assert.ok(env.next_actions.some((a) => a.startsWith('search(')));
  }
});

// ── BA: business analyst ─────────────────────────────────────────────────────
test('BA-1: which policies does an event trigger?', () => {
  // source: policies/*.policy.yaml — all six declare triggers: [{event: run-completed}]
  const got = ids(policies_triggered_by(bank, 'run-completed'));
  assert.deepEqual(got, [
    'policy:Batch Business Closure', 'policy:BatchBusinessClosure',
    'policy:Failure Routing Decision', 'policy:FailureRoutingDecision',
    'policy:Suspicious Reconfirmation', 'policy:SuspiciousReconfirmation',
  ]);
});

test('BA-2: which slices does a policy constrain? — honest empty (no R8 carrier in v0.4 trees)', () => {
  // The pilot trees encode policy→command (invokes) but no policy→slice
  // constrains edges; R8's carrier is explicit links (none present).
  const r = policies_constraining(bank, 'replay-exception');
  assert.deepEqual(r.result.nodes, []);
});

test('BA-3: the full picture of an aggregate', () => {
  // source: aggregates/batch-chain-run/aggregate.yaml (order.commands/events)
  const d = describe(bank, 'aggregate', 'Batch Chain Run', true);
  assert.deepEqual(d.result.commands.map((c) => c.name).sort(), ['simulate-crash', 'start-batch-run']);
  assert.deepEqual(d.result.events.map((e) => e.name).sort(),
    ['run-completed', 'run-failed', 'run-recovered', 'run-started', 'stage-completed']);
});

test('BA-4: under what conditions does a command produce an event?', () => {
  // source: aggregates/customer-order/slices/replay-exception.slice.yaml
  // (payload.guards + payload.produces)
  const r = conditions(bank, 'replay-exception');
  assert.deepEqual(r.result.guards, ['order is currently in except_pool', 'human confirmed (one-click replay in the UI)']);
  assert.deepEqual(r.result.produces, ['exception-replayed']);
});

test('BA-5: which roles take part in a process, doing which steps?', () => {
  // source: pipelines/batch-chain.pipeline.yaml (6 steps, verified ids)
  const steps = ids(steps_of(bank, 'batch-chain'));
  assert.deepEqual(steps, [
    'step:batch-chain.classify', 'step:batch-chain.file-gen', 'step:batch-chain.parse',
    'step:batch-chain.poll', 'step:batch-chain.upload', 'step:batch-chain.wait-ack',
  ]);
  // honest empty: steps carry no actor in v0.4 trees (R15 without carrier)
  assert.deepEqual(participants_of(bank, 'batch-chain').result.participants, []);
});

test('BA-6: field lineage — where does a business field come from and go?', () => {
  // source: inbox/09-lineage/relation-rf-amount-flow-24.yaml
  //   "demo-customer.amount → order-credited.amount → chain-stats.amount"
  const r = lineage(bank, 'order-credited.amount');
  assert.ok(hasAll(r, ['field:demo-customer.amount', 'field:order-credited.amount', 'field:chain-stats.amount']),
    JSON.stringify(ids(r)));
});

test('BA-7: exception branches of an aggregate', () => {
  // source: aggregates/customer-order (6 slices incl. the exception path)
  const r = slices_of(bank, 'Customer Order');
  assert.ok(hasAll(r, ['slice:park-in-exception-pool', 'slice:replay-exception']), JSON.stringify(ids(r)));
});

// ── PM: product manager ──────────────────────────────────────────────────────
test('PM-1: what can a role issue / view? (the 02×13 permission matrix as API)', () => {
  // source: inbox/02-commands/role-cs-operator-*.yaml (can_issue/can_view)
  assert.deepEqual(ids(commands_of(bank, 'Operator')),
    ['command:replay-exception', 'command:simulate-crash', 'command:start-batch-run']);
  assert.deepEqual(ids(read_models_of(bank, 'Operator')),
    ['read-model:chain-stats', 'read-model:event-feed', 'read-model:exception-pool']);
});

test('PM-2: which use-cases does a story cover? — honest empty (no R17 carrier in v0.4 trees)', () => {
  // Bank stories are inbox notes with no covers links; there is no
  // use-cases.yaml in either pilot tree. R17 needs explicit links.
  const stories = search(bank, '', 'story').result;
  assert.ok(stories.length > 0, 'sanity: story nodes exist');
  for (const s of stories.slice(0, 3)) {
    const r = expand(bank, s.id, { relations: ['covers'], depth: 1 });
    assert.deepEqual(r.result.edges, [], s.id);
  }
});

test('PM-3: a requirement changes — what stories/scenarios are impacted?', () => {
  // policy change blast radius (may-impact): the invoking policy, the commands
  // it invokes, the events they produce, and the sibling policies on the same trigger.
  const r = blast_radius(bank, 'policy:Batch Business Closure', { depth: 2 });
  assert.ok(hasAll(r, [
    'policy:Batch Business Closure', 'command:settle-recharge', 'command:start-batch-run',
    'event:run-completed', 'slice:settle-recharge',
  ]), JSON.stringify(ids(r).slice(0, 10)));
});

test('PM-4: who sees a read-model, where does its data come from?', () => {
  // source: read-models/exception-pool.rm.yaml (visible_to: [] — documented in
  // MIGRATION-NOTES.md as pre-existing, not a migration loss)
  const d = describe(bank, 'read-model', 'exception-pool', true);
  assert.deepEqual(d.result.visible_to, []);
  const srcs = d.result.fields.map((f) => f.source);
  assert.ok(srcs.includes('eventField:order-parked-in-exception-pool.customerId'));
  assert.ok(srcs.includes('eventField:order-credited.amount'));
});

test('PM-5: happy path vs exception path steps', () => {
  // steps_of lists the pipeline; path typing per step is not in v0.4 trees
  // (noted, not invented) — the six bank steps are all verified present.
  const steps = ids(steps_of(bank, 'batch-chain'));
  assert.equal(steps.length, 6);
  // fab: 25-step pipeline likewise enumerates cleanly
  assert.equal(ids(steps_of(fab, 'fab-pipeline')).length, 25);
});

test('PM-6: what changed between two knowledge versions?', () => {
  const same = diff(bank, bank);
  assert.deepEqual(same.result, { added: [], removed: [], changed: [] });
  const other = diff(bank, fab);
  assert.ok(other.result.added.length > 50 && other.result.removed.length > 50);
  assert.ok(other.summary.includes('+') && other.summary.includes('−'));
});

// ── AR: architect ────────────────────────────────────────────────────────────
test('AR-1: blast radius of changing an event (may-impact, over-approximate)', () => {
  const r = blast_radius(bank, 'event:run-completed', { depth: 3 });
  // verified by tracing the tree: trigger → 6 policies → invoked commands →
  // produced events; plus the producing command/slice upstream.
  assert.ok(hasAll(r, [
    'policy:Batch Business Closure', 'policy:Failure Routing Decision', 'policy:Suspicious Reconfirmation',
    'command:settle-recharge', 'command:start-batch-run',
    'slice:settle-recharge', 'slice:start-batch-run',
    'event:run-completed',
  ]), JSON.stringify(ids(r)));
  assert.ok(r.summary.includes('may-impact'));
});

test('AR-2: relations between two aggregates — honest empty (R2 needs from/to; 07 notes are prose-only)', () => {
  assert.deepEqual(ids(aggregates_referencing(bank, 'Customer Order')), []);
});

test('AR-3: context map — honest empty (05 notes carry no machine-readable from/to)', () => {
  const r = contexts_depending_on(bank, 'anything');
  assert.equal(r.result, null);
  assert.ok(r.summary.includes('no such node'));
});

test('AR-4: how many read-models consume a field? (reverse lineage)', () => {
  // source: read-models/chain-statistics.rm.yaml + live-event-feed.rm.yaml
  // both derive fields from eventField:run-started.runId
  assert.deepEqual(ids(consumed_by(bank, 'run-started.runId')),
    ['read-model:chain-stats', 'read-model:event-feed']);
});

test('AR-5: duplicate policies sharing one trigger+invokes signature', () => {
  // real finding in the bank tree: the three inbox-migrated policies (38/39/40)
  // duplicate the three originals (35/36/37) — same triggers+invokes.
  const { findings } = consistency_check(bank).result;
  const dup = findings.filter((f) => f.type === 'duplicate-policy');
  assert.equal(dup.length, 3);
  assert.ok(dup.some((f) => f.policies.includes('policy:Batch Business Closure')
    && f.policies.includes('policy:BatchBusinessClosure')));
});

test('AR-6: orphans — unclaimed L1 cards and sourceless events', () => {
  // mirrors the validator's AG1/AG2 notices (verified identical lists)
  const r = orphans(bank).result;
  assert.deepEqual(r.unclaimed_commands,
    ['AbandonOrder', 'EscalateToManual', 'ParkInExceptionPool', 'ReplayException',
     'SettlePurchase', 'SettleRecharge', 'SimulateCrash', 'StartBatchRun']);
  assert.ok(r.unclaimed_events.includes('RunStarted') && r.unclaimed_events.length === 11);
});

test('AR-7: knowledge↔code alignment — anchors honestly report unanchored', () => {
  const r = anchors(bank, 'slice', 'replay-exception');
  assert.equal(r.result.status, 'unanchored');
  assert.deepEqual(r.result.result, []);
});

// ── DEV: developer ───────────────────────────────────────────────────────────
test('DEV-1: where is the code for this slice? — unanchored until chain 3 lands', () => {
  const r = anchors(bank, 'slice', 'replay-exception');
  assert.equal(r.result.status, 'unanchored');
  assert.ok(r.summary.includes('not yet landed'));
});

test('DEV-2: implementing a command — which events, which policies?', () => {
  const r = expand(bank, 'command:replay-exception', { relations: ['produces'] });
  assert.ok(hasAll(r, ['event:exception-replayed']), JSON.stringify(ids(r)));
  // policies constraining the slice: no R8 carrier — honest empty
  assert.deepEqual(ids(policies_constraining(bank, 'replay-exception')), []);
});

test('DEV-3: changing a field — which projections are affected?', () => {
  const r = blast_radius(bank, 'field:run-started.runId', { depth: 2 });
  assert.ok(hasAll(r, ['read-model:chain-stats', 'read-model:event-feed']), JSON.stringify(ids(r)));
  // …∩ anchors(*) is empty while unanchored — the honest composition
  assert.equal(anchors(bank, 'read-model', 'chain-stats').result.result.length, 0);
});

test('DEV-4: replay/recovery semantics of an aggregate', () => {
  // source: aggregates/customer-order/aggregate.yaml — carries the A1/A3
  // arbitration notes verbatim in payload
  const d = describe(bank, 'aggregate', 'Customer Order', true);
  const text = JSON.stringify(d.result);
  assert.ok(text.includes('arbitrated'), 'arbitration notes ride along in full describe');
});

test('DEV-6: who emitted this event — the causal chain', () => {
  // source: replay-exception slice payload.produces = ["exception-replayed"]
  assert.deepEqual(ids(trigger_source_of(bank, 'exception-replayed')), ['command:replay-exception']);
  // fab cross-check: wafer-measured ← record-measurement
  assert.deepEqual(ids(trigger_source_of(fab, 'wafer-measured')), ['command:record-measurement']);
});

test('DEV-7: adding a pipeline step — change impact checklist', () => {
  const r = expand(bank, 'step:batch-chain.file-gen', { depth: 2 });
  assert.ok(hasAll(r, ['pipeline:batch-chain', 'step:batch-chain.file-gen']), JSON.stringify(ids(r)));
});

test('search finds atoms by domain language', () => {
  const r = search(bank, 'replay');
  const hitIds = r.result.map((h) => h.id).sort();
  for (const want of ['slice:replay-exception', 'command:replay-exception', 'event:exception-replayed'])
    assert.ok(hitIds.includes(want), JSON.stringify(hitIds));
  const scoped = search(bank, 'closure', 'policy');
  assert.ok(scoped.result.length > 0 && scoped.result.every((h) => h.kind === 'policy'));
});

// ── A1–A4: known-answer blast-radius fixtures ─────────────────────────────────
// The arbitrations are documented in the tree itself (payload notes marked
// "A1 (arbitrated 2026-10-18)" etc.). `actual` = the knowledge atoms the
// arbitration touched (verified by grep); the predicted may-impact set must
// be a superset. A2 was code-only (sharding registration) — no knowledge
// impact, no fixture. A4 documents a KNOWN GAP: aggregate:Batch Chain Run
// mentions the A4 invariant in prose (identityDetail) with no R20 used-by
// edge, so impact analysis cannot reach it — the query exposes a tree
// completeness gap instead of faking the edge.
test('A1 fixture: replayException ledger fix', () => {
  // actual: aggregates/customer-order/{aggregate.yaml, slices/replay-exception.slice.yaml}
  const r = blast_radius(bank, 'event:exception-replayed', { depth: 3 });
  assert.ok(hasAll(r, ['slice:replay-exception', 'command:replay-exception', 'aggregate:Customer Order']),
    JSON.stringify(ids(r)));
});

test('A3 fixture: crash recovery rebuilds the terminal ledger', () => {
  // actual: aggregates/customer-order/aggregate.yaml (A3 arbitration note).
  // The impact path is 4 hops (event→policy→command→slice→aggregate), so the
  // fixture passes depth: 4 explicitly — default depth 3 is the safe default,
  // not a completeness promise.
  const r = blast_radius(bank, 'event:run-completed', { depth: 4 });
  assert.ok(hasAll(r, ['aggregate:Customer Order']), JSON.stringify(ids(r).filter((x) => x.startsWith('aggregate:'))));
});

test('A4 fixture: BatchKey encode/decode invariant', () => {
  // actual: value-objects/batch-key.vo.yaml + the A4 note in
  // aggregates/batch-chain-run/aggregate.yaml (identityDetail, prose only).
  const r = blast_radius(bank, 'value-object:batch-key', { depth: 3 });
  assert.ok(hasAll(r, ['value-object:batch-key']));
  // KNOWN GAP (R20): no used-by carrier → the aggregate mention is unreachable.
  assert.ok(!hasAll(r, ['aggregate:Batch Chain Run']),
    'documents the R20 gap: prose mention without a machine-readable edge');
});
