import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAggregateCoreVariant } from './aggregate-core-variants.mjs';
import { domainKernelFixture } from './domain-kernel-fixture.mjs';
import { captureProject } from '../lib/project/cli.mjs';
import { buildModels } from '../generators/scala-cqrs-aggregate-core-v1/build-models.mjs';
import { render } from '../generators/scala-cqrs-aggregate-core-v1/render.mjs';
import { createAggregateCorePredicateVariant } from './aggregate-core-predicate-variants.mjs';

test('all seven fold operators and multiple events are derived from a valid physical author variant', t => {
  const owner = mkdtempSync(join(realpathSync(tmpdir()), 'aggregate-ops-author-'));
  t.after(() => rmSync(owner, { recursive: true, force: true }));
  const f = createAggregateCoreVariant(join(owner, 'author'));
  const capture = captureProject(f.project);
  assert.equal(capture.validation.hard.length, 0);
  assert.equal(capture.validation.roundtrip.ok, true);
  const fixture = domainKernelFixture(f.project);
  const model = buildModels({ products: fixture.products, options: fixture.config.options });
  assert.deepEqual([...new Set(model.aggregates[0].events.flatMap(event => event.assignments.map(a => a.update.op)))].sort(),
    ['integer-apply', 'money-apply', 'put', 'put-all', 'remove', 'remove-all', 'set']);
  assert.equal(model.aggregates[0].commands[0].emissions.length, 2);
  const entries = render(model, fixture.config.products);
  const fold = entries.find(entry => entry.kind === 'event-handler');
  assert.match(fold.content, /left = state\.right/);
  assert.match(fold.content, /right = state\.left/);
  assert.match(fold.content, /oldValue = state\.removed\.get\(value\.key\)/);
  assert.match(fold.content, /distanceTotal = state\.distanceTotal\.minus\(value\.distance\)/);
  assert.ok(entries.every(entry => entry.deps.every(path => entries.some(target => target.path === path))));
  assert.throws(() => createAggregateCoreVariant(join(owner, 'author')), /absent destination/);
});

test('actual params-root author imports are anchored outside the nested RuleParams package', t => {
  const owner = mkdtempSync(join(realpathSync(tmpdir()), 'aggregate-predicate-import-'));
  t.after(() => rmSync(owner, { recursive: true, force: true }));
  const variant = createAggregateCorePredicateVariant(join(owner, 'author'));
  const f = domainKernelFixture(variant.project);
  const entries = render(buildModels({ products: f.products, options: f.config.options }), f.config.products);
  const rules = entries.find(entry => entry.kind === 'rules');
  assert.match(rules.content, /import _root_\.params\.counter\.domain\.CounterProtocol/);
  assert.match(rules.content, /import _root_\.params\.counter\.domain\.invariant\.params\.CounterRuleParams\._/);
  assert.doesNotMatch(rules.content, /^import params\./m);
});
