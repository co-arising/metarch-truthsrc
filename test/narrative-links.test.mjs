import test from 'node:test';
import assert from 'node:assert/strict';
import { relatedNarrativeSources } from '../lib/project/narrative-links.mjs';

const record = (pointer, kind, name, owner = []) => ({ pointer, kind, name, owner, surface: '', relation: 'direct', identity: [kind, ...owner, name].join(':'), file: 'atom.yaml', atomPointer: '/payload' });
test('story follows explicit use-case and qualified command links, never opaque document-shaped data', () => {
  const story = record('/stories/0', 'story', 'Purchase'), useCase = record('/useCases/useCases/0', 'use-case', 'purchase'), command = record('/aggregates/0/commands/0', 'command', 'Submit', ['Order']);
  const index = { context: 'example', records: [story, useCase, command] };
  const canonical = { stories: [{ links: [{ relation: 'covers', target: 'use-case:Purchase' }] }], useCases: { useCases: [{ id: 'purchase', useCase: 'Purchase', steps: [{ references: [{ context: 'example', kind: 'command', owner: ['Order'], id: 'Submit' }] }] }] }, aggregates: [{ commands: [{ name: 'Submit' }] }] };
  const links = relatedNarrativeSources(canonical, index, [story]);
  assert.ok(links.some(r => r.identity === command.identity && r.trace.length === 2));
  assert.ok(links.every(r => r.association === 'declared-reference-not-direct-generation'));
  canonical.stories[0] = { body: { document: 'canonical', pointer: '/aggregates/0/commands/0' }, references: [{ context: 'other', kind: 'command', owner: ['Order'], id: 'Submit' }] };
  const diagnostics = [];
  assert.deepEqual(relatedNarrativeSources(canonical, index, [story], diagnostics), []);
  assert.equal(diagnostics[0].code, 'NARRATIVE_REFERENCE_MISSING');
});
test('read-model event-field lineage retains owner and does not turn description text into edges', () => {
  const model = record('/readModels/0', 'read-model', 'view'), order = record('/aggregates/0/events/0', 'event', 'Created', ['Order']), other = record('/aggregates/1/events/0', 'event', 'Created', ['Other']);
  const canonical = { readModels: [{ sourceAggregate: 'Order', fields: [{ source: 'eventField:Created.id' }, { source: 'Documentation only: Other.Created.id' }] }] };
  const result = relatedNarrativeSources(canonical, { context: 'example', records: [model, order, other] }, [model]);
  assert.deepEqual(result.map(r => r.identity), [order.identity]);
});
