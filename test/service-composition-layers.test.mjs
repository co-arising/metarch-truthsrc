import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { generate } from '../generators/scala-cqrs-play-service/generate.mjs';
import { applicationRegistry } from '../generators/scala-cqrs-application/produce.mjs';
import { renderInvariant } from '../generators/scala-cqrs-domain/render-domain.mjs';
import { validateCodeMappings } from '../src/core/code-mappings.mjs';
import { serviceApplicationFixture } from './service-application-fixture.mjs';

const manifest = JSON.parse(readFileSync(new URL('../generators/scala-cqrs-play-service/generator.json', import.meta.url)));
const fixture = serviceApplicationFixture(), compilation = compileProductSet(fixture.request);
assert.deepEqual(compilation.diagnostics, []);
const generated = generate({ compilation, manifest, options: fixture.options });
assert.deepEqual(generated.diagnostics, []);
const entries = generated.plan.entries, byPath = new Map(entries.map(e => [e.path, e]));
const products = Object.fromEntries(compilation.result.products.map(p => [p.id, p.payload]));
const source = suffix => {
  const matches = entries.filter(e => e.path.endsWith(suffix));
  assert.equal(matches.length, 1, suffix);
  return matches[0];
};

function legacy(id) {
  const implementation = applicationRegistry('2')[id];
  return implementation.produce({ products, options: fixture.options });
}

test('service layering keeps old command, event, values, converters and adapters byte-identical', () => {
  for (const id of ['command-dsl', 'valueobject-dsl', 'converter-dsl']) {
    for (const old of legacy(id)) assert.equal(byPath.get(old.path)?.content, old.content, old.path);
  }
  for (const old of legacy('aggregate-dsl').filter(e => e.kind === 'state')) {
    const before = old.content.match(/^final case class .+$/m)?.[0];
    const after = byPath.get(old.path).content.match(/^final case class .+$/m)?.[0];
    assert.equal(after, before);
    assert.match(byPath.get(old.path).content, /\.domain\.entities\.[A-Za-z]+Entity\.empty/);
  }
});

test('both legacy actor constructors lead to the real generated bootstrap and application behavior', () => {
  for (const e of entries.filter(e => e.kind === 'aggregate')) {
    const name = /object ([A-Za-z]+)Aggregate \{/.exec(e.content)[1];
    assert.ok(e.content.includes('infrastructure.bootstrap.' + name + 'Bootstrap.create(persistenceId, initial, hosts'));
    assert.ok(e.content.includes(name + 'Aggregate(persistenceId, initial, hosts'));
    assert.ok(!e.content.includes('EventSourcedBehavior'));
    const bootstrap = source('/bootstrap/' + name + 'Bootstrap.scala').content;
    assert.ok(bootstrap.includes('PersistenceId.ofUniqueId(persistenceId)'));
    assert.ok(bootstrap.includes(name + 'Aggregate.commandHandler(hosts'));
    assert.ok(bootstrap.includes(name + 'EventHandler.apply'));
    assert.ok(bootstrap.includes('.eventAdapter(' + name + 'EventAdapter)'));
    assert.ok(bootstrap.includes('.snapshotAdapter(' + name + 'SnapshotAdapter)'));
    assert.ok(!bootstrap.includes('ClusterSharding') && !bootstrap.includes('withTagger'));
    const behavior = source('/behaviors/' + name + 'Behaviors.scala').content;
    assert.ok(behavior.includes('case GetState(reply) => Effect.none.thenRun'));
    assert.ok(behavior.includes('case Right(events) => Effect.persist(events).thenRun'));
    assert.ok(behavior.includes('case Left(code) => Effect.none.thenRun'));
    const protocol = source('/application/aggregates/' + name + 'Protocol.scala').content;
    assert.ok(protocol.includes('type Command = ') && protocol.includes('Aggregate.Request'));
    assert.ok(protocol.includes('type Execute = ') && protocol.includes('val Execute: '));
    assert.ok(protocol.includes('type CommandHandler = (State, Command) => Effect[Event, State]'));
  }
});

test('fold statements and ordering move intact and precise mappings follow the new core', () => {
  const fp = ['reference-layout','domain-decision','domain-folds','exact-value-types'].map(id => ({ id, version: compilation.result.products.find(p => p.id === id).version }));
  const old = renderInvariant({ products, options: fixture.options }, fp, false).filter(e => e.kind === 'event-handler');
  for (const previous of old) {
    const name = /object ([A-Za-z]+)EventHandler/.exec(previous.content)[1];
    const core = source('/domain/entities/behaviors/' + name + 'EventHandler.scala');
    assert.equal(core.content.slice(core.content.indexOf('object ')), previous.content.slice(previous.content.indexOf('object ')));
    assert.ok(core.codeMappings.length > 0);
    assert.doesNotThrow(() => validateCodeMappings(core));
    const wrapper = byPath.get(previous.path);
    assert.ok(wrapper.content.includes('.domain.entities.behaviors.' + name + 'EventHandler(state, input)'));
    assert.ok(!wrapper.content.includes('val next'));
    assert.ok(!core.content.includes('.application.') && !core.content.includes('.infrastructure.'));
  }
});

test('local repositories perform identity lookup and cache only successful spawns without claiming actor ownership', () => {
  for (const e of entries.filter(e => e.kind === 'aggregate-repository')) {
    assert.ok(e.content.includes('def get(id: K): Handle = synchronized'));
    assert.ok(e.content.includes('handles.getOrElseUpdate(id, {'));
    assert.ok(e.content.includes('!identities.contains(pid) || identities(pid) == id'));
    assert.ok(e.content.indexOf('val ref = spawn(') < e.content.indexOf('identities.put('));
    assert.ok(e.content.includes('require(!closed, "repository is closed")'));
    assert.ok(e.content.includes('closed = true; handles.clear(); identities.clear()'));
    assert.ok(!/systemActorOf|gracefulStop|ClusterSharding|EntityRef/.test(e.content));
  }
});

test('service bootstrap owns one factory selection while the loader and components retain lifecycle responsibilities', () => {
  const startup = source('/bootstrap/ApplicationBootstrap.scala').content;
  const loader = source('/InventoryServiceLoader.scala').content;
  assert.equal((startup.match(/\.loadClass\(/g) || []).length, 1);
  assert.equal((loader.match(/\.loadClass\(/g) || []).length, 0);
  assert.ok(loader.includes('ApplicationBootstrap.load(context)'));
  assert.ok(startup.includes('Configuration.validate(context.initialConfiguration)'));
  assert.ok(startup.includes('composition factory pin mismatch'));
  assert.ok(startup.indexOf('requireInstalled(composition)') < startup.indexOf('new InventoryServiceComponents'));
  assert.ok(startup.includes('context.lifecycle.stop()') && startup.includes('composition.close()'));
  assert.equal((loader.match(/applicationLifecycle\.addStopHook/g) || []).length, 1);
});

test('new files are declared, dependency-complete and byte deterministic', () => {
  assert.deepEqual(generate({ compilation, manifest, options: fixture.options }), generated);
  for (const e of entries) {
    assert.ok(manifest.artifactKinds.includes(e.kind), e.kind);
    assert.ok(e.deps.every(p => byPath.has(p)), e.path);
    assert.doesNotThrow(() => validateCodeMappings(e));
  }
  for (const id of ['aggregate-dsl', 'invariant-dsl']) {
    const changed = structuredClone(manifest);
    changed.producers.find(p => p.id === id).artifactKinds = ['unclaimed'];
    assert.equal(generate({ compilation, manifest: changed, options: fixture.options }).plan, null);
  }
});
