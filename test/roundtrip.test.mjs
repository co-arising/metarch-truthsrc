import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileTree } from '../lib/compile.mjs';
import { decomposeCanonical } from '../lib/decompose.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { emitDoc } from '../lib/shared.mjs';

// ── helpers ──────────────────────────────────────────────────────────────────
const atom = (type, name, seq, payload, stage = 'eventStorming') => emitDoc({
  scalars: [['kind', 'note'], ['type', type], ['name', name]],
  nested: { origin: { stage, board: 'board1', seq } },
  blocks: { payload },
});

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'truthsrc-test-'));
  mkdirSync(join(dir, 'inbox', 'eventStorming'), { recursive: true });
  return dir;
}
const put = (dir, rel, text) => {
  mkdirSync(join(dir, rel, '..'), { recursive: true });
  writeFileSync(join(dir, rel), text);
};
const rules = (list) => list.map((h) => h.slice(1, h.indexOf(']')));
// A minimal valid aggregate (RF1/RF2/RF3-clean) with one slice.
const loanAggregate = (overrides = {}) => emitDoc({
  scalars: [['kind', 'aggregate'], ['name', 'Loan'], ['seq', 0]],
  nested: { order: { commands: ['RequestLoan'], events: ['LoanRequested'] } },
  blocks: {
    payload: {
      name: 'Loan', entity: 'LoanEntity', description: 'loan lifecycle',
      identifier: { name: 'loanId', dataType: 'String (UUID)', origin: 'SYSTEM_GENERATED' },
      stateFields: [{ name: 'status', dataType: 'String', role: 'State' }],
      ...overrides.payload,
    },
    ...overrides.blocks,
  },
});
const requestLoanSlice = (overrides = {}) => emitDoc({
  scalars: [['kind', 'slice'], ['aggregate', 'Loan'], ['command', 'RequestLoan']],
  blocks: {
    payload: {
      name: 'RequestLoan', description: 'submit',
      parameters: [{ name: 'amount', dataType: 'Money' }],
      produces: ['LoanRequested'],
      ...overrides.payload,
    },
    events: {
      LoanRequested: {
        name: 'LoanRequested', description: 'application received',
        payloads: [{ name: 'loanId', dataType: 'String (UUID)' }],
        bindings: [{ slot: 'loanId', expr: 'state.loanId' }],
        foldAssignments: [{ slot: 'status', expr: 'literal:REQUESTED' }],
      },
      ...overrides.events,
    },
  },
});
const withLoan = (dir) => {
  put(dir, 'aggregates/loan/aggregate.yaml', loanAggregate());
  put(dir, 'aggregates/loan/slices/request-loan.slice.yaml', requestLoanSlice());
};

// ── golden example ───────────────────────────────────────────────────────────
test('golden example: roundtrip identity holds over the full schema (26 atoms)', () => {
  const r = roundtrip(join(import.meta.dirname, '..', 'example', 'tree'));
  assert.equal(r.ok, true, JSON.stringify(r));
});
test('golden example: validate is clean and canonical carries all products', () => {
  const tree = join(import.meta.dirname, '..', 'example', 'tree');
  const { hard, notices } = validateTree(tree);
  assert.deepEqual(hard, []);
  assert.deepEqual(notices, []);
  const c = JSON.parse(compileTree(tree));
  assert.equal(c.schemaVersion, 'truthsrc/v1');
  assert.equal(c.aggregates.length, 1);
  const a = c.aggregates[0];
  assert.equal(a.name, 'Loan');
  assert.deepEqual(a.commands.map((x) => x.name), ['RequestLoan', 'ApproveLoan', 'DisburseLoan', 'RecordPayment']);
  assert.deepEqual(a.events.map((x) => x.name), ['LoanRequested', 'LoanApproved', 'LoanDisbursed', 'PaymentReceived', 'LoanRepaid']);
  // event pool: full definition travels with the product even for the extraEvent
  assert.equal(a.events[4].foldAssignments[0].expr, 'literal:REPAID');
  assert.equal(c.valueObjects[0].name, 'Money');
  assert.equal(c.readModels[0].sourceAggregate, 'Loan');
  assert.equal(c.stories[0].role, 'Applicant');
  assert.equal(c.useCases.useCases[0].useCase, 'RequestLoan');
  // sessions keep the L1 face: policy notes ride along with their payloads
  const cs = c.sessions.find((s) => s.session === 'commandStorming');
  const types = cs.scopes[0].notes.map((n) => n.type);
  assert.ok(types.includes('policy') && types.includes('role') && types.includes('command'));
});

// ── core invariants ──────────────────────────────────────────────────────────
test('canonical is deterministic and orders by seq', () => {
  const dir = scratch();
  const p = (n) => ({ type: 'event', name: n, stage: 'eventStorming', description: `desc of ${n}`, info: { timeline: 'T' }, links: [] });
  put(dir, 'inbox/eventStorming/event-es-bsecond-1.yaml', atom('event', 'BSecond', 1, p('BSecond')));
  put(dir, 'inbox/eventStorming/event-es-afirst-0.yaml', atom('event', 'AFirst', 0, p('AFirst')));
  const c = JSON.parse(compileTree(dir));
  assert.deepEqual(c.sessions[0].scopes[0].notes.map((n) => n.name), ['AFirst', 'BSecond']);
  assert.equal(compileTree(dir), compileTree(dir)); // I1 byte-deterministic
});

test('roundtrip: regenerating the tree from canonical is byte-identical (I2)', () => {
  const dir = scratch();
  put(dir, 'workshop.yaml', 'schemaVersion: truthsrc/v1\nname: demo\n');
  const payload = { type: 'event', name: 'X', stage: 'eventStorming', description: 'd', info: { timeline: 'T', sequence: 0, step: 0 }, links: [], nested: { a: [1, 2, { b: 'c' }] } };
  put(dir, 'inbox/eventStorming/event-es-x-0.yaml', atom('event', 'X', 0, payload));
  withLoan(dir);
  const canonical = compileTree(dir);
  const dir2 = mkdtempSync(join(tmpdir(), 'truthsrc-test-'));
  decomposeCanonical(canonical, dir2);
  assert.equal(readFileSync(join(dir2, 'inbox/eventStorming/event-es-x-0.yaml'), 'utf8'),
              readFileSync(join(dir, 'inbox/eventStorming/event-es-x-0.yaml'), 'utf8'));
  assert.equal(readFileSync(join(dir2, 'aggregates/loan/aggregate.yaml'), 'utf8'),
              readFileSync(join(dir, 'aggregates/loan/aggregate.yaml'), 'utf8'));
  assert.equal(compileTree(dir2), canonical);
});

test('decompose distributes owned notes into aggregates/<slug>/notes', () => {
  const dir = scratch();
  const p = (t, n) => ({ type: t, name: n, stage: 'commandStorming', description: 'd', links: [] });
  put(dir, 'aggregates/loan/aggregate.yaml', loanAggregate());
  put(dir, 'aggregates/loan/slices/request-loan.slice.yaml', requestLoanSlice());
  const canonical = JSON.parse(compileTree(dir));
  canonical.sessions.push({
    session: 'commandStorming',
    scopes: [{ scope: 'board1', notes: [p('command', 'RequestLoan'), p('command', 'OtherCommand'), p('event', 'LoanRequested')] }],
  });
  const dir2 = mkdtempSync(join(tmpdir(), 'truthsrc-test-'));
  decomposeCanonical(JSON.stringify(canonical), dir2);
  assert.ok(existsSync(join(dir2, 'aggregates/loan/notes/command-cs-request-loan-0.yaml')));
  assert.ok(existsSync(join(dir2, 'aggregates/loan/notes/event-cs-loan-requested-2.yaml')));
  assert.ok(existsSync(join(dir2, 'inbox/commandStorming/command-cs-other-command-1.yaml')), 'unowned command stays in inbox');
});

// ── stage rules: eventStorming ───────────────────────────────────────────────
test('rules fire: ES1/ES2/ES5 hard, ES3/ES4 notice', () => {
  const dir = scratch();
  put(dir, 'inbox/eventStorming/event-es-bad1-0.yaml',
    atom('event', 'Bad1', 0, { type: 'event', name: 'Bad1', stage: 'eventStorming', description: '', info: {}, links: [] }));
  put(dir, 'inbox/eventStorming/event-es-updatedthing-1.yaml',
    atom('event', 'UpdatedThing', 1, { type: 'event', name: 'UpdatedThing', stage: 'eventStorming', description: 'has desc', info: { timeline: 'T' }, links: [] }));
  put(dir, 'inbox/eventStorming/event-es-bad1-2.yaml',
    atom('event', 'Bad1', 2, { type: 'event', name: 'Bad1', stage: 'eventStorming', description: 'dup name', info: { timeline: 'T' }, links: [] }));
  put(dir, 'inbox/eventStorming/question-es-dangling-3.yaml',
    atom('question', 'Dangling', 3, { type: 'question', name: 'Dangling', stage: 'eventStorming', description: 'q', info: {}, links: ['command:DoSomething'] }));
  const { hard, notices } = validateTree(dir);
  assert.ok(rules(hard).includes('ES1'), 'ES1 fires on empty description');
  assert.ok(rules(hard).includes('ES2'), 'ES2 fires on missing timeline');
  assert.ok(rules(hard).includes('ES5'), 'ES5 fires on question without event link');
  assert.equal(hard.filter((h) => h.startsWith('[ES3]')).length, 0, 'ES3 is notice, not hard');
  assert.ok(notices.some((n) => n.startsWith('[ES3]')), 'ES3 notice on duplicate name');
  assert.ok(notices.some((n) => n.startsWith('[ES4]')), 'ES4 notice on solution verb');
});

test('rules fire: CS1/CS3/CS8 notices, CS2 unannotated chain', () => {
  const dir = scratch();
  put(dir, 'inbox/eventStorming/event-es-orphan-0.yaml',
    atom('event', 'Orphan', 0, { type: 'event', name: 'Orphan', stage: 'eventStorming', description: 'd', info: { timeline: 'T' }, links: [] }));
  put(dir, 'inbox/commandStorming/event-es-source-0.yaml',
    atom('event', 'Source', 0, { type: 'event', name: 'Source', stage: 'commandStorming', description: 'd', info: { timeline: 'T' }, links: ['event:Orphan'] }, 'commandStorming')); // CS2: no @strong/@eventual
  put(dir, 'inbox/commandStorming/command-cs-roleless-1.yaml',
    atom('command', 'Roleless', 1, { type: 'command', name: 'Roleless', stage: 'commandStorming', description: 'd', links: [] }, 'commandStorming'));
  put(dir, 'inbox/commandStorming/command-cs-roleless-2.yaml',
    atom('command', 'Roleless', 2, { type: 'command', name: 'Roleless', stage: 'commandStorming', description: 'd2', links: [] }, 'commandStorming')); // CS8 dup
  const { notices } = validateTree(dir);
  assert.ok(notices.some((n) => n.startsWith('[CS1]') && n.includes('Source')), 'CS1 fires on event with no trigger source');
  assert.ok(notices.some((n) => n.startsWith('[CS2]')), 'CS2 fires on unannotated event→event link');
  assert.ok(notices.some((n) => n.startsWith('[CS3]') && n.includes('Roleless')), 'CS3 fires on command without role/policy');
  assert.ok(notices.some((n) => n.startsWith('[CS8]')), 'CS8 fires on duplicate command name');
});

// ── structural rules: aggregates / slices / event pool ──────────────────────
test('rules fire: RF1/RF2 hard on missing entity/identifier, RF3 on missing dataType', () => {
  const dir = scratch();
  put(dir, 'aggregates/loan/aggregate.yaml', loanAggregate({
    payload: { entity: undefined, identifier: undefined, stateFields: [{ name: 'status' }] },
  }));
  const { hard } = validateTree(dir);
  const r = rules(hard);
  assert.ok(r.includes('RF1'), 'RF1 fires on missing entity');
  assert.ok(r.includes('RF2'), 'RF2 fires on missing identifier');
  assert.ok(hard.some((h) => h.startsWith('[RF3]') && h.includes('status')), 'RF3 fires on state field without dataType');
});

test('rules fire: V5 order.commands closure, V6 event pool closure', () => {
  // slice present but not listed in order.commands
  const dir = scratch();
  put(dir, 'aggregates/loan/aggregate.yaml', emitDoc({
    scalars: [['kind', 'aggregate'], ['name', 'Loan'], ['seq', 0]],
    nested: { order: { commands: [], events: ['LoanRequested'] } },
    blocks: {
      payload: {
        name: 'Loan', entity: 'LoanEntity', description: 'loan lifecycle',
        identifier: { name: 'loanId', dataType: 'String (UUID)', origin: 'SYSTEM_GENERATED' },
        stateFields: [{ name: 'status', dataType: 'String', role: 'State' }],
      },
      extraEvents: [{ name: 'LoanRequested', payloads: [{ name: 'loanId', dataType: 'String (UUID)' }] }],
    },
  }));
  put(dir, 'aggregates/loan/slices/request-loan.slice.yaml', requestLoanSlice());
  let r = validateTree(dir);
  assert.ok(rules(r.hard).includes('V5'), 'V5 fires when a slice is missing from order.commands');

  // produced event with no definition in the pool
  const dir3 = scratch();
  put(dir3, 'aggregates/loan/aggregate.yaml', loanAggregate());
  put(dir3, 'aggregates/loan/slices/request-loan.slice.yaml', requestLoanSlice({
    payload: { produces: ['LoanRequested', 'GhostEvent'] },
  }));
  r = validateTree(dir3);
  assert.ok(r.hard.some((h) => h.startsWith('[V6]') && h.includes('GhostEvent')), 'V6 fires on unresolved produces');

  // event defined in two slices
  const dir4 = scratch();
  put(dir4, 'aggregates/loan/aggregate.yaml', loanAggregate());
  put(dir4, 'aggregates/loan/slices/request-loan.slice.yaml', requestLoanSlice());
  put(dir4, 'aggregates/loan/slices/other.slice.yaml', emitDoc({
    scalars: [['kind', 'slice'], ['aggregate', 'Loan'], ['command', 'OtherCommand']],
    blocks: {
      payload: { name: 'OtherCommand', parameters: [{ name: 'x', dataType: 'String' }], produces: ['LoanRequested'] },
      events: {
        LoanRequested: { name: 'LoanRequested', payloads: [{ name: 'loanId', dataType: 'String (UUID)' }] },
      },
    },
  }));
  r = validateTree(dir4);
  assert.ok(r.hard.some((h) => h.startsWith('[V6]') && h.includes('two slices')), 'V6 fires on duplicate event definition');
});

test('rules fire: V4 slice identity, V12 seq collisions', () => {
  const dir = scratch();
  put(dir, 'aggregates/loan/aggregate.yaml', loanAggregate());
  put(dir, 'aggregates/loan/slices/request-loan.slice.yaml', requestLoanSlice({ payload: { name: 'Misnamed' } }));
  put(dir, 'aggregates/other/aggregate.yaml', loanAggregate()); // duplicate name + seq
  let r = validateTree(dir);
  assert.ok(r.hard.some((h) => h.startsWith('[V4]') && h.includes('Misnamed')), 'V4 fires on payload.name ≠ header command');
  assert.ok(rules(r.hard).includes('V12'), 'V12 fires on aggregate seq collision');
  assert.ok(r.notices.some((n) => n.startsWith('[AG6]')), 'AG6 notice on duplicate aggregate name');
});

// ── structural rules: policies ───────────────────────────────────────────────
test('rules fire: V7/V8/V9 policy contract', () => {
  const dir = scratch();
  withLoan(dir);
  // policy with no triggers block at all
  put(dir, 'policies/policy-cs-broken-0.policy.yaml', emitDoc({
    scalars: [['kind', 'policy'], ['type', 'policy'], ['name', 'Broken']],
    nested: { origin: { stage: 'commandStorming', board: 'board1', seq: 0 } },
    blocks: { payload: { type: 'policy', name: 'Broken', stage: 'commandStorming', links: [] } },
  }));
  let r = validateTree(dir);
  assert.ok(rules(r.hard).includes('V7'), 'V7 fires on missing triggers/invokes');

  // dual-track drift: links claim an event the structured block does not
  const dir2 = scratch();
  withLoan(dir2);
  put(dir2, 'policies/policy-cs-drifter-0.policy.yaml', emitDoc({
    scalars: [['kind', 'policy'], ['type', 'policy'], ['name', 'Drifter']],
    nested: { origin: { stage: 'commandStorming', board: 'board1', seq: 0 } },
    objLists: { triggers: [{ event: 'LoanRequested', aggregate: 'Loan' }], invokes: [{ command: 'RequestLoan', aggregate: 'Loan' }] },
    blocks: { payload: { type: 'policy', name: 'Drifter', stage: 'commandStorming', info: { triggers: [{ event: 'LoanRequested', aggregate: 'Loan' }], invokes: [{ command: 'RequestLoan', aggregate: 'Loan' }] }, links: ['event:Ghost'] } },
  }));
  r = validateTree(dir2);
  assert.ok(r.hard.some((h) => h.startsWith('[V8]') && h.includes('Ghost')), 'V8 fires on links/structure drift');
  assert.ok(r.notices.some((n) => n.startsWith('[CS5]')), 'CS5 notice fires without command link');
});

// ── structural rules: catalogs ───────────────────────────────────────────────
test('rules fire: V10 value-object fields, V11 read-model source lineage', () => {
  const dir = scratch();
  put(dir, 'value-objects/bad.vo.yaml', emitDoc({
    scalars: [['kind', 'value-object'], ['name', 'Bad'], ['seq', 0]],
    blocks: { payload: { name: 'Bad', description: 'no fields key' } },
  }));
  put(dir, 'read-models/bad.rm.yaml', emitDoc({
    scalars: [['kind', 'read-model'], ['name', 'BadRM'], ['seq', 0]],
    blocks: { payload: { name: 'BadRM', sourceAggregate: 'NoSuchAggregate', fields: [{ name: 'f', dataType: 'String' }] } },
  }));
  const { hard } = validateTree(dir);
  const r = rules(hard);
  assert.ok(r.includes('V10'), 'V10 fires on value-object without fields array');
  assert.ok(hard.some((h) => h.startsWith('[V11]') && h.includes('NoSuchAggregate')), 'V11 fires on unresolved sourceAggregate');
  assert.ok(hard.some((h) => h.startsWith('[V11]') && h.includes('no source')), 'V11 fires on field without source derivation');
});

// ── addressing ───────────────────────────────────────────────────────────────
test('structure: seq collision and non-contiguous seqs are hard', () => {
  const dir = scratch();
  const p = (n) => ({ type: 'event', name: n, stage: 'eventStorming', description: 'd', info: { timeline: 'T' }, links: [] });
  put(dir, 'inbox/eventStorming/event-es-a-0.yaml', atom('event', 'A', 0, p('A')));
  put(dir, 'inbox/eventStorming/event-es-a-0-dup.yaml', atom('event', 'A', 0, p('A')));
  const { hard } = validateTree(dir);
  assert.ok(hard.some((h) => h.startsWith('[V2]') && h.includes('collision')));
  const dir2 = scratch();
  put(dir2, 'inbox/eventStorming/event-es-a-1.yaml', atom('event', 'A', 1, p('A')));
  const r2 = validateTree(dir2);
  assert.ok(r2.hard.some((h) => h.startsWith('[V2]') && h.includes('contiguous')));
});

test('decompose is a total inverse: unknown stage rejected', () => {
  const dir = scratch();
  assert.throws(() => decomposeCanonical(JSON.stringify({ schemaVersion: 'truthsrc/v1', workshop: 'w', sessions: [{ session: 'nope', scopes: [] }] }), dir));
  assert.equal(readdirSync(join(dir, 'inbox', 'eventStorming')).length, 0, 'no atom written for unknown stage');
});
