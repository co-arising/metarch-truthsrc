import test from 'node:test';
import assert from 'node:assert/strict';
import { compileProductSet } from '../lib/products/compile.mjs';
import { buildAggregateModels } from '../generators/scala-cqrs-play-service/build-aggregate-models.mjs';
import { buildStateModels } from '../generators/scala-cqrs-domain/build-state-models.mjs';
import { stateEntries } from '../generators/scala-cqrs-domain/templates/aggregate-state.mjs';
import { validateCodeMappings } from '../src/core/code-mappings.mjs';
import { serviceApplicationFixture } from './service-application-fixture.mjs';

function context() {
  const { request, options } = serviceApplicationFixture();
  const compilation = compileProductSet(request);
  assert.deepEqual(compilation.diagnostics, []);
  return { products: Object.fromEntries(compilation.result.products.map(p => [p.id, p.payload])), options };
}

const roles = ['legacy', 'protocol', 'behavior', 'aggregate', 'factory', 'bootstrap', 'repository'];

test('aggregate models describe ordered responsibilities independently of Scala rendering', () => {
  const models = buildAggregateModels(context());
  assert.equal(models.length, 14);
  const warehouse = models.filter(m => m.aggregate.ref.id === 'Warehouse');
  assert.deepEqual(warehouse.map(m => m.role), roles);
  const behavior = warehouse.find(m => m.role === 'behavior');
  assert.deepEqual(behavior.groups.map(g => g.kind), ['query', 'execution']);
  assert.deepEqual(behavior.groups[1].commands.map(c => c.ref.id), [
    'ReserveSkuQuantity', 'CommitSkuReservation', 'ReleaseSkuReservation', 'RequestSkuReservation'
  ]);
  const protocol = warehouse.find(m => m.role === 'protocol');
  assert.deepEqual(protocol.aliases, ['Execute', 'GetState', 'Accepted', 'Refused']);
  assert.equal(protocol.carrierOwner, 'legacy');
  assert.equal(warehouse.find(m => m.role === 'repository').lookup, 'owned-local-actor-cache');
  assert.equal(warehouse.find(m => m.role === 'bootstrap').persistenceIdentity, 'unique-id');
  assert.ok(models.every(m => m.artifact.sources.length && m.artifact.dependencies.length));
});

test('external authority behavior precedes query and execution with exact producer identities', () => {
  const models = buildAggregateModels(context());
  const behavior = models.find(m => m.aggregate.ref.id === 'AllocationOrder' && m.role === 'behavior');
  assert.deepEqual(behavior.groups.map(g => g.kind), ['external', 'query', 'execution']);
  assert.deepEqual(behavior.groups[0].producers.map(p => p.id), [
    'reservationCompletion0', 'reservationCompletion1', 'reservationCompletion2',
    'reservationCompletion3', 'reservationCompletion4'
  ]);
  assert.equal(behavior.groups[0].producers[0].source.document, 'domain');
  assert.equal(behavior.authority, true);
});

test('models are detached immutable data without pre-rendered Scala bodies', () => {
  const input = structuredClone(context()), before = structuredClone(input), models = buildAggregateModels(input);
  assert.deepEqual(input, before);
  function visit(value) {
    if (value && typeof value === 'object') {
      assert.ok(Object.isFrozen(value));
      assert.ok(!Object.hasOwn(value, 'content') && !Object.hasOwn(value, 'body'));
      Object.values(value).forEach(visit);
    } else if (typeof value === 'string') {
      assert.ok(!/\n|\b(?:import|def|class|trait|object)\s/.test(value), value);
    }
  }
  visit(models);
  assert.throws(() => { models[0].aggregate.ref.id = 'Changed'; }, TypeError);
  const command = input.products['reference-layout'].declarations.find(d => d.ref.kind === 'command');
  command.ref.id = 'Changed';
  assert.equal(models.find(m => m.role === 'behavior').groups[1].commands[0].ref.id, 'ReserveSkuQuantity');
});

test('state models carry exact typed defaults and sources without coupling to other products', () => {
  const input = context(), models = buildStateModels(input, true);
  const warehouse = models.find(m => m.aggregate.ref.id === 'Warehouse');
  assert.equal(warehouse.layered, true);
  assert.deepEqual(warehouse.fields.map(d => ({ name: d.target.id, value: d.value })), [{ name: 'receipts', value: [] }]);
  assert.equal(warehouse.fields[0].valueType.key.ref.id, 'TxId');
  assert.deepEqual(warehouse.events.map(e => e.ref.id), ['SkuQuantityReserved', 'SkuReservationCommitted', 'SkuReservationReleased', 'SkuReservationRequested']);
  assert.deepEqual(warehouse.literalTypes.declarations.map(d => d.ref.id), ['TxId']);
  const entries = stateEntries(warehouse, input.options, []);
  assert.equal(entries.length, 2);
  entries.forEach(entry => validateCodeMappings(entry));
  assert.equal(entries[1].codeMappings[0].span.text, '  def empty: State = State(Map())\n');
  assert.ok(entries.every(e => !e.content.includes('akka.') && !e.content.includes('.infrastructure.')));
});

test('state rendering preserves typed nested defaults, keywords and UTF-8 mapping offsets', () => {
  const ref = (kind, id, owner = []) => ({ context: 'sample', kind, owner, id });
  const field = { target: ref('state-field', 'type', ['Example']), valueType: { form: 'optional', element: { form: 'primitive', name: 'string' } },
    value: { present: true, value: '中文引号"\nnext' }, source: { document: 'domain', pointer: '/aggregates/0/stateFields/0/default' } };
  const aggregate = { ref: ref('aggregate', 'Example'), source: { document: 'domain', pointer: '/aggregates/0' }, valueType: null, dependencies: [] };
  const input = { products: { 'reference-layout': { declarations: [aggregate] }, 'domain-folds': { defaults: [field] }, 'exact-value-types': [] },
    options: { packages: [{ context: 'sample', package: 'example.sample' }] } };
  const [model] = buildStateModels(input, true);
  const entries = stateEntries(model, input.options, []);
  assert.ok(entries[0].content.includes('`type`: Option[String]'));
  assert.ok(entries[1].content.includes('Some("中文引号\\"\\nnext")'));
  validateCodeMappings(entries[1]);
  assert.throws(() => { model.fields[0].value.present = false; }, TypeError);
});

test('state templates preserve nonempty nominal records, maps and exact unit defaults', () => {
  const input = structuredClone(context());
  const nominal = id => ({ form: 'nominal', ref: { context: 'inventory', kind: 'type', owner: [], id } });
  const target = id => ({ context: 'inventory', kind: 'state-field', owner: ['Warehouse'], id });
  input.products['domain-folds'].defaults = [
    { target: target('records'), valueType: { form: 'sequence', element: nominal('CompletionRecord0') },
      value: [{ txid: '交易-α' }], source: { document: 'synthetic-defaults', pointer: '/records' } },
    { target: target('distances'), valueType: { form: 'map', key: nominal('TxId'), value: { form: 'optional', element: nominal('Distance') } },
      value: [{ key: '交易-β', value: { present: true, value: { amount: '1.250', unit: 'km' } } },
        { key: 'missing', value: { present: false } }], source: { document: 'synthetic-defaults', pointer: '/distances' } }
  ];
  const model = buildStateModels(input, true).find(m => m.aggregate.ref.id === 'Warehouse');
  const [state, entity] = stateEntries(model, input.options, []);
  assert.ok(state.content.includes('records: Vector[example.inventory.domain.values.CompletionRecord0]'));
  assert.ok(state.content.includes('distances: Map[example.inventory.domain.values.TxId, Option[example.inventory.domain.values.Distance]]'));
  const expected = '  def empty: State = State(Vector(example.inventory.domain.values.CompletionRecord0(example.inventory.domain.values.TxId("交易-α"))), ' +
    'Map(example.inventory.domain.values.TxId("交易-β") -> Some(example.inventory.domain.values.Distance(BigDecimal("1.250"), "km")), ' +
    'example.inventory.domain.values.TxId("missing") -> None))\n';
  assert.equal(entity.codeMappings[0].span.text, expected);
  validateCodeMappings(entity);
  assert.deepEqual(model.dependencies, [
    'app/example/inventory/domain/values/CompletionRecord0.scala',
    'app/example/inventory/domain/values/TxId.scala',
    'app/example/inventory/domain/values/Distance.scala'
  ]);
  assert.ok(model.literalTypes.declarations.some(d => d.ref.kind === 'member' && d.ref.id === 'txid'));
  assert.ok(model.literalTypes.declarations.some(d => d.ref.kind === 'member' && d.ref.id === 'amount'));
});
