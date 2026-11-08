import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateCoreFixture } from './aggregate-core-fixture.mjs';
import { buildModels } from '../generators/scala-cqrs-aggregate-core-v1/build-models.mjs';
import { actorProtocolTemplate } from '../generators/scala-cqrs-aggregate-core-v1/templates/actor-protocol.mjs';
import { aggregateTemplate } from '../generators/scala-cqrs-aggregate-core-v1/templates/aggregate.mjs';
import { factoryTemplate } from '../generators/scala-cqrs-aggregate-core-v1/templates/factory.mjs';
import { repositoryTemplate, repositoryImplementationTemplate } from '../generators/scala-cqrs-aggregate-core-v1/templates/repository.mjs';
import { aggregateSourceEntry } from '../generators/scala-cqrs-domain-kernel-v1/entry.mjs';

const fixture = aggregateCoreFixture();
const ref = { context: 'inventory', kind: 'aggregate', owner: [], id: 'Warehouse' };
const options = () => structuredClone(fixture.config.options);
const model = names => buildModels({ products: fixture.products, options: { ...options(), names } });
const render = (m, role, template) => {
  const a = m.aggregates[0], artifact = a[role];
  return aggregateSourceEntry({ path: artifact.path, kind: artifact.kind, sources: artifact.sources, footprint: fixture.config.products, deps: artifact.directDeps }, out => template(a, m, out));
};

for (const [role, name] of [
  ...['Command', 'Reply', 'Execute', 'GetState', 'Accepted', 'Rejected'].map(name => ['actor-protocol', name]),
  ['actor-repository', 'Handle'], ['local-actor-repository', 'IllegalStateException'], ['local-actor-repository', 'IllegalArgumentException'],
]) test(`Actor target rejects its synthetic or exception scope collision: ${role}/${name}`, () => {
  assert.throws(() => model([{ ref, role, name }]));
});

test('all Actor artifact bindings are complete names and references follow them', () => {
  const names = [['actor-protocol','WarehouseMessages'],['aggregate','WarehouseBehavior'],['factory','WarehouseCreator'],
    ['bootstrap','WarehouseStart'],['actor-repository','WarehouseDirectory'],['local-actor-repository','LocalWarehouseDirectory']].map(([role, name]) => ({ ref, role, name }));
  const m = model(names), a = m.aggregates[0];
  assert.equal(a.factory.package, 'example.inventory.application.factories');
  assert.match(render(m, 'aggregate', aggregateTemplate).content, /WarehouseMessages\.Command/);
  assert.match(render(m, 'factory', factoryTemplate).content, /trait WarehouseCreator/);
  assert.match(render(m, 'repositoryImplementation', repositoryImplementationTemplate).content, /extends WarehouseDirectory\[K\]/);
  assert.doesNotMatch(render(m, 'actorProtocol', actorProtocolTemplate).content, /WarehouseActorProtocol/);
  assert.doesNotMatch(render(m, 'repository', repositoryTemplate).content, /WarehouseActorRepository/);
});

test('a legal State binding that matches an Actor message stays qualified in Actor templates', () => {
  const m = model([{ ref, role: 'state', name: 'GetState' }]);
  const protocol = render(m, 'actorProtocol', actorProtocolTemplate).content;
  const behavior = render(m, 'aggregate', aggregateTemplate).content;
  assert.match(protocol, /replyTo: ActorRef\[_root_\.example\.inventory\.domain\.GetState\]/);
  assert.match(behavior, /\(_root_\.example\.inventory\.domain\.GetState, WarehouseActorProtocol\.Command\)/);
  assert.doesNotMatch(protocol, /import example\.inventory\.domain\.GetState\n/);
});
