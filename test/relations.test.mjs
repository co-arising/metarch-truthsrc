import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateTree } from '../lib/validate.mjs';
import { emitDoc, RELATION_REGISTRY } from '../lib/shared.mjs';

// ── helpers ──────────────────────────────────────────────────────────────────
// Minimal tree that is V-clean: one aggregate with one slice, one event note,
// one role note, one read-model. Tests add atoms to provoke R1/R2.
function baseTree() {
  const dir = mkdtempSync(join(tmpdir(), 'truthsrc-r-'));
  const put = (rel, text) => {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), text);
  };
  put('workshop.yaml', emitDoc({ scalars: [['schemaVersion', 'truthsrc/v1'], ['name', 'rtest']] }));
  put('aggregates/shop/aggregate.yaml', emitDoc({
    scalars: [['kind', 'aggregate'], ['name', 'Shop']],
    nested: { order: { commands: ['place-order'], events: ['order-placed'] } },
    blocks: {
      payload: { name: 'Shop', entity: 'Shop', identifier: { name: 'shopId', dataType: 'string' }, stateFields: [] },
    },
  }));
  put('aggregates/shop/slices/place-order.slice.yaml', emitDoc({
    scalars: [['kind', 'slice'], ['aggregate', 'Shop'], ['command', 'place-order']],
    blocks: {
      payload: { name: 'place-order', parameters: [], produces: ['order-placed'] },
      events: { 'order-placed': { name: 'order-placed', description: 'd', payloads: [{ name: 'shopId', dataType: 'string' }] } },
    },
  }));
  put('inbox/eventStorming/event-es-order-placed-0.yaml', emitDoc({
    scalars: [['kind', 'note'], ['type', 'event'], ['name', 'order-placed']],
    nested: { origin: { stage: 'eventStorming', board: 'board1', seq: 0 } },
    blocks: { payload: { type: 'event', name: 'order-placed', description: 'a business fact', info: { timeline: 't0' } } },
  }));
  put('inbox/commandStorming/role-cs-clerk-0.yaml', emitDoc({
    scalars: [['kind', 'note'], ['type', 'role'], ['name', 'Clerk']],
    nested: { origin: { stage: 'commandStorming', board: 'board1', seq: 0 } },
    blocks: { payload: { type: 'role', name: 'Clerk', can_issue: ['place-order'], can_view: [], links: ['command:place-order'] } },
  }));
  put('read-models/shop-stats.rm.yaml', emitDoc({
    scalars: [['kind', 'read-model'], ['name', 'Shop Stats']],
    blocks: { payload: { name: 'Shop Stats', id: 'shop-stats', fields: [{ name: 'count', dataType: 'integer', source: 'eventField:order-placed.shopId' }], visible_to: [] } },
  }));
  return { dir, put };
}
const hardRules = (hard) => hard.map((h) => h.slice(1, h.indexOf(']')));

test('v0.5: registry carries 22 declared relations with human-adjudicated propagates flags', () => {
  assert.equal(RELATION_REGISTRY.length, 22);
  const byId = Object.fromEntries(RELATION_REGISTRY.map((r) => [r.id, r]));
  assert.equal(byId.R7.propagates, true);   // event triggers policy
  assert.equal(byId.R12.propagates, false); // role can-issue: permission, no behavior impact
  assert.equal(byId.R13.propagates, false); // read-model visible-to: permission
  assert.equal(byId.R17.propagates, false); // story covers use-case: traceability
  for (const r of RELATION_REGISTRY) {
    assert.ok(r.from && r.relation && r.to, `R entry ${r.id} complete`);
    assert.ok(typeof r.propagates === 'boolean', `R entry ${r.id} propagates adjudicated`);
  }
});

test('v0.5 R2: kind-specific carriers resolve on a clean tree', () => {
  const { dir } = baseTree();
  const { hard } = validateTree(dir);
  assert.deepEqual(hard, []);
});

test('v0.5 R2: role can_issue to a nonexistent command is hard', () => {
  const { dir, put } = baseTree();
  put('inbox/commandStorming/role-cs-ghost-1.yaml', emitDoc({
    scalars: [['kind', 'note'], ['type', 'role'], ['name', 'Ghost']],
    nested: { origin: { stage: 'commandStorming', board: 'board1', seq: 1 } },
    blocks: { payload: { type: 'role', name: 'Ghost', can_issue: ['no-such-command'], can_view: [], links: [] } },
  }));
  const { hard } = validateTree(dir);
  assert.ok(hardRules(hard).includes('R2'), JSON.stringify(hard));
  assert.ok(hard.some((h) => h.includes('no-such-command')));
});

test('v0.5 R2: role can_view to a nonexistent read-model is hard', () => {
  const { dir, put } = baseTree();
  put('inbox/commandStorming/role-cs-peeker-1.yaml', emitDoc({
    scalars: [['kind', 'note'], ['type', 'role'], ['name', 'Peeker']],
    nested: { origin: { stage: 'commandStorming', board: 'board1', seq: 1 } },
    blocks: { payload: { type: 'role', name: 'Peeker', can_issue: [], can_view: ['no-such-rm'], links: [] } },
  }));
  const { hard } = validateTree(dir);
  assert.ok(hardRules(hard).includes('R2'), JSON.stringify(hard));
});

test('v0.5 R2: read-model field deriving from an unknown event is hard', () => {
  const { dir, put } = baseTree();
  put('read-models/bad.rm.yaml', emitDoc({
    scalars: [['kind', 'read-model'], ['name', 'Bad']],
    blocks: { payload: { name: 'Bad', id: 'bad', fields: [{ name: 'x', dataType: 'string', source: 'eventField:no-such-event.y' }], visible_to: [] } },
  }));
  const { hard } = validateTree(dir);
  assert.ok(hardRules(hard).includes('R2'), JSON.stringify(hard));
  assert.ok(hard.some((h) => h.includes('no-such-event')));
});

test('v0.5 R1: explicit link with an undeclared relation is hard', () => {
  const { dir, put } = baseTree();
  put('read-models/shop-stats.rm.yaml', emitDoc({
    scalars: [['kind', 'read-model'], ['name', 'Shop Stats']],
    blocks: {
      payload: {
        name: 'Shop Stats', id: 'shop-stats',
        fields: [{ name: 'count', dataType: 'integer', source: 'eventField:order-placed.shopId' }],
        visible_to: [],
        links: [{ relation: 'mind-controls', target: 'role:Clerk' }],
      },
    },
  }));
  const { hard } = validateTree(dir);
  assert.ok(hardRules(hard).includes('R1'), JSON.stringify(hard));
  assert.ok(hard.some((h) => h.includes('undeclared relation')));
});

test('v0.5 R1: explicit link with a wrong from-kind is hard', () => {
  const { dir, put } = baseTree();
  // triggers is event→policy; a read-model cannot originate it.
  put('read-models/shop-stats.rm.yaml', emitDoc({
    scalars: [['kind', 'read-model'], ['name', 'Shop Stats']],
    blocks: {
      payload: {
        name: 'Shop Stats', id: 'shop-stats',
        fields: [{ name: 'count', dataType: 'integer', source: 'eventField:order-placed.shopId' }],
        visible_to: [],
        links: [{ relation: 'triggers', target: 'policy:P' }],
      },
    },
  }));
  const { hard } = validateTree(dir);
  assert.ok(hardRules(hard).includes('R1'), JSON.stringify(hard));
  assert.ok(hard.some((h) => h.includes('cannot originate')));
});

test('v0.5 R1: explicit link with a wrong target-kind is hard', () => {
  const { dir, put } = baseTree();
  put('inbox/eventStorming/event-es-order-placed-0.yaml', emitDoc({
    scalars: [['kind', 'note'], ['type', 'event'], ['name', 'order-placed']],
    nested: { origin: { stage: 'eventStorming', board: 'board1', seq: 0 } },
    blocks: {
      payload: {
        type: 'event', name: 'order-placed', description: 'a business fact', info: { timeline: 't0' },
        links: [{ relation: 'triggers', target: 'slice:place-order' }], // must be policy:<id>
      },
    },
  }));
  const { hard } = validateTree(dir);
  assert.ok(hardRules(hard).includes('R1'), JSON.stringify(hard));
});

test('v0.5 R2: explicit link to a nonexistent node is hard', () => {
  const { dir, put } = baseTree();
  put('inbox/commandStorming/role-cs-clerk-0.yaml', emitDoc({
    scalars: [['kind', 'note'], ['type', 'role'], ['name', 'Clerk']],
    nested: { origin: { stage: 'commandStorming', board: 'board1', seq: 0 } },
    blocks: {
      payload: {
        type: 'role', name: 'Clerk', can_issue: ['place-order'], can_view: [],
        links: [{ relation: 'can-issue', target: 'command:ghost-command' }],
      },
    },
  }));
  const { hard } = validateTree(dir);
  assert.ok(hardRules(hard).includes('R2'), JSON.stringify(hard));
  assert.ok(hard.some((h) => h.includes('resolves to nothing')));
});

test('v0.5 R1/R2: well-formed explicit links validate clean', () => {
  const { dir, put } = baseTree();
  put('policies/p-rf-dupcheck-0.policy.yaml', emitDoc({
    scalars: [['kind', 'policy'], ['type', 'policy'], ['name', 'DupCheck']],
    nested: { origin: { stage: 'refining', board: 'board1', seq: 0 } },
    objLists: {
      triggers: [{ event: 'order-placed', aggregate: 'Shop' }],
      invokes: [{ command: 'place-order', aggregate: 'Shop' }],
    },
    blocks: {
      payload: {
        type: 'policy', name: 'DupCheck',
        links: ['event:order-placed', 'command:place-order',
          { relation: 'constrains', target: 'slice:place-order' }],
        info: {
          triggers: [{ event: 'order-placed', aggregate: 'Shop' }],
          invokes: [{ command: 'place-order', aggregate: 'Shop' }],
        },
      },
    },
  }));
  const { hard } = validateTree(dir);
  assert.deepEqual(hard, [], JSON.stringify(hard));
});

test('v0.5 R1: legacy string-form links are not judged by R1', () => {
  const { dir } = baseTree(); // role payload.links: ['command:place-order'] — string form
  const { hard } = validateTree(dir);
  assert.ok(!hardRules(hard).includes('R1'), JSON.stringify(hard));
});
