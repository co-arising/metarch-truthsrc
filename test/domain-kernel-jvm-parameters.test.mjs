import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { domainKernelFixture } from './domain-kernel-fixture.mjs';
import { compileAuthorEntries, restoreAuthorEntries, emitAuthorDoc } from '../lib/author-surface.mjs';
import { parseAuthorDoc } from '../lib/author-parse.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { buildModels } from '../generators/scala-cqrs-domain-kernel-v1/build-models.mjs';
import { serializationModel } from '../generators/scala-cqrs-domain-kernel-v1/serialization-model.mjs';
import { generate } from '../generators/scala-cqrs-domain-kernel-v1/generate.mjs';
import { validateCodeMappings } from '../src/core/code-mappings.mjs';

const manifest = JSON.parse(readFileSync(new URL('../generators/scala-cqrs-domain-kernel-v1/generator.json', import.meta.url)));
const ref = (kind, id) => ({ context: 'counter', kind, owner: kind === 'parameter' ? ['Counter', 'SetCount'] : ['Counter'], id });
const defaults = type => type === 'Long' || type === 'Int' ? '0' : type === 'Boolean' ? false : type === 'Option[Long]' ? { present: false, value: null } : type === 'Vector[Long]' || type === 'Map[String, Long]' ? [] : type === 'WireRatio' ? '0' : 'sentinel';

// Current counterexamples originate in the author fixture, never forged product payloads.
// All edits/author roundtrips and public generation stay in memory.
function variant({ kind, n, types = Array(n).fill('Long') }) {
  const fixture = domainKernelFixture(), entries = structuredClone(fixture.canonical.authoring.files);
  const edit = (suffix, mutate) => {
    const entry = entries.find(e => e.file.endsWith(suffix)); assert.ok(entry, suffix);
    const doc = parseAuthorDoc(entry.content, entry.file); mutate(doc); entry.content = emitAuthorDoc(doc);
  };
  if (kind === 'record') {
    edit('/reading.vo.yaml', d => { d.payload.fields = types.map((type, i) => `field${i}: ${JSON.stringify(type)}`); });
    edit('/aggregate.yaml', d => { d.payload.stateFields.find(f => f.name === 'reading').default = Object.fromEntries(types.map((t, i) => [`field${i}`, defaults(t)])); });
  } else if (kind === 'command') {
    edit('/set-count.slice.yaml', d => d.payload.parameters.push(...types.map((t, i) => `extra${i}: ${JSON.stringify(t)} @BUSINESS_INPUT`)));
  } else if (kind === 'event') {
    edit('/set-count.slice.yaml', d => {
      d.events.CountSet.payloads.push(...types.map((t, i) => `extra${i}: ${JSON.stringify(t)} @PROPAGATED`));
      d.events.CountSet.bindings.push(...types.map((_, i) => ({ slot: `extra${i}`, expr: 'param.count' })));
    });
  } else if (kind === 'state') {
    edit('/aggregate.yaml', d => d.payload.stateFields.push(...types.map((t, i) => ({ name: `extra${i}`, dataType: t, default: defaults(t) }))));
  } else if (kind === 'host') {
    const indices = Array.from({ length: n }, (_, i) => i);
    edit('/set-count.slice.yaml', d => d.payload.parameters.push(...indices.filter(i => i % 2 === 0).map(i => `hostInput${i}: Long @BUSINESS_INPUT`)));
    edit('/aggregate.yaml', d => d.payload.stateFields.push(...indices.filter(i => i % 2 === 1).map(i => ({ name: `hostInput${i}`, dataType: 'Long', default: '0' }))));
    edit('/--counter---accepted-ratio--.formal.yaml', d => {
      d.payload.inputDependencies = [ref('parameter', 'count'), ref('state-field', 'minimum'), ...indices.map(i => ref(i % 2 === 0 ? 'parameter' : 'state-field', `hostInput${i}`))];
      d.payload.stableIdentityContract.keys = [ref('parameter', 'count')];
    });
  } else assert.fail('unknown test variant');
  const { canonical } = compileAuthorEntries(entries, { rootName: 'domain-kernel' });
  assert.deepEqual(restoreAuthorEntries(canonical), entries);
  const compilation = compileProductSet(deriveProjectRequest(canonical, fixture.config, []));
  assert.deepEqual(compilation.diagnostics, []);
  const input = { products: Object.fromEntries(compilation.result.products.map(p => [p.id, p.payload])), options: fixture.config.options };
  return { input, plan: () => generate({ compilation, manifest, options: fixture.config.options }) };
}

const modelDiagnostic = (run, signature, slots, source) => {
  assert.throws(run, error => {
    assert.equal(error.diagnostic?.code, 'KERNEL_JVM_SLOTS');
    assert.ok(error.diagnostic.message.includes(signature), error.diagnostic.message);
    assert.match(error.diagnostic.message, new RegExp(`requires ${slots} JVM parameter slots`));
    assert.match(error.diagnostic.message, /maximum is 255/);
    assert.deepEqual(error.diagnostic.source, source);
    return true;
  });
};

for (const [kind, n, signature, slots, pointer] of [
  ['record', 128, 'example.counter.domain.values.Reading', 257, '/valueObjects/6'],
  ['command', 126, 'example.counter.domain.CounterProtocol.SetCount', 257, '/aggregates/0/commands/0'],
  ['event', 125, 'example.counter.domain.CounterProtocol.CountSet', 256, '/aggregates/0/events/0'],
  ['state', 123, 'example.counter.domain.CounterState', 256, '/aggregates/0'],
]) test(`reject current ${kind} constructor overflow before rendering with precise source`, () => {
  const v = variant({ kind, n }), before = structuredClone(v.input);
  modelDiagnostic(() => buildModels(v.input), signature, slots, { document: 'counter-domain', pointer });
  const result = v.plan();
  assert.equal(result.plan, null);
  assert.ok(result.diagnostics.some(d => d.message.includes(signature) && d.message.includes('JVM parameter slots')));
  assert.deepEqual(v.input, before);
});

test('reject host overflow assembled from individually legal command/state signatures', () => {
  const v = variant({ kind: 'host', n: 126 });
  const host = v.input.products['domain-dependencies'].hosts[0];
  modelDiagnostic(() => buildModels(v.input), 'example.counter.domain.ports.CounterComputations.acceptedRatio', 257, host.source);
  // The neighboring signature uses 255 slots, not a field-count or arity-22 cap.
  const legal = buildModels(variant({ kind: 'host', n: 125 }).input).aggregates[0];
  assert.equal(legal.computations.methods[0].parameters.length, 127);
  assert.ok(legal.protocol.commands[0].fields.length < 70);
  assert.ok(legal.state.fields.length < 70);
  assert.deepEqual(legal.ruleParams.params[0].fields.map(f => f.name), ['state', 'command', 'hosts']);
});

test('ScalaPB unknownFields makes 127 Long illegal even though the kernel constructor fits', () => {
  const v = variant({ kind: 'record', n: 127 }), model = buildModels(v.input);
  assert.equal(model.values.find(v => v.name === 'Reading').fields.length, 127);
  modelDiagnostic(() => serializationModel(model), 'example.counter.protobuf.ReadingValue', 256, { document: 'counter-domain', pointer: '/valueObjects/6' });
  assert.equal(v.plan().plan, null);
});

for (const [kind, n] of [['command', 125], ['event', 124], ['state', 122], ['host', 125]])
  test(`admit boundary ${kind} without flattening referenced parameters`, () => {
    const v = variant({ kind, n });
    assert.doesNotThrow(() => serializationModel(buildModels(v.input)));
    assert.deepEqual(v.plan().diagnostics, []);
  });

for (const [label, types] of [
  ['23 String', Array(23).fill('String')],
  ['126 Long', Array(126).fill('Long')],
  ['126 Long plus String', [...Array(126).fill('Long'), 'String']],
  ['128 sequence Long', Array(128).fill('Vector[Long]')],
  ['128 nominal', Array(128).fill('WireRatio')],
  ['mixed one-slot references and primitive Boolean', Array.from({ length: 150 }, (_, i) => ['String', 'Boolean', 'Option[Long]', 'Vector[Long]', 'Map[String, Long]', 'WireRatio'][i % 6])],
]) test(`admit ${label}, preserve defaults/identities/mappings and deterministic output`, () => {
  const v = variant({ kind: 'record', n: types.length, types });
  const model = buildModels(v.input), graph = serializationModel(model);
  const reading = model.values.find(v => v.name === 'Reading'), pb = graph.nodes.find(n => n.name === 'ReadingValue');
  assert.equal(reading.fields.length, types.length);
  assert.deepEqual(pb.fields.map(f => f.number), types.map((_, i) => i + 1));
  assert.deepEqual(pb.ref, reading.ref);
  assert.deepEqual(model.aggregates[0].state.fields.find(f => f.name === 'reading').default, Object.fromEntries(types.map((t, i) => [`field${i}`, defaults(t)])));
  const first = v.plan(), second = v.plan();
  assert.deepEqual(first.diagnostics, []); assert.deepEqual(first, second);
  assert.equal(first.plan.entries.length, 18);
  first.plan.entries.forEach(validateCodeMappings);
});

// These larger model shapes hit independent public-plan string/byte limits.
// Admission here tests JVM descriptors only, not an expansion of those limits.
for (const [type, n] of [['String', 253], ['Option[Long]', 128], ['Map[String, Long]', 128]])
  test(`model admits ${n} ${type} as one-slot references without flattening`, () => {
    const v = variant({ kind: 'record', n, types: Array(n).fill(type) });
    const before = structuredClone(v.input), model = buildModels(v.input), graph = serializationModel(model);
    const reading = model.values.find(v => v.name === 'Reading'), root = graph.nodes.find(n => n.name === 'ReadingValue');
    assert.equal(reading.fields.length, n); assert.deepEqual(root.ref, reading.ref);
    assert.deepEqual(root.fields.map(f => f.number), Array.from({ length: n }, (_, i) => i + 1));
    if (type === 'Option[Long]') {
      const wrapper = graph.nodes.find(node => node.id === root.fields[0].nodeId);
      assert.deepEqual(wrapper.fields.map(f => f.wireType), ['bool', 'int64']);
      assert.deepEqual(model.aggregates[0].state.fields.find(f => f.name === 'reading').default.field0, { present: false, value: null });
    }
    assert.deepEqual(buildModels(v.input), model);
    assert.deepEqual(serializationModel(model), graph);
    assert.deepEqual(v.input, before);
  });

test('slot counting is not a universal 127-field cap and includes the PB synthetic reference', () => {
  const v = variant({ kind: 'record', n: 254, types: Array(254).fill('String') });
  modelDiagnostic(() => serializationModel(buildModels(v.input)), 'example.counter.protobuf.ReadingValue', 256, { document: 'counter-domain', pointer: '/valueObjects/6' });
});

test('nominal record parameters remain one reference slot even when their members contain Long', () => {
  const v = variant({ kind: 'command', n: 128, types: Array(128).fill('Reading') });
  const model = buildModels(v.input), command = model.aggregates[0].protocol.commands[0];
  assert.equal(command.fields.length, 131);
  assert.ok(command.fields.slice(3).every(f => f.type.form === 'nominal' && f.type.ref.id === 'Reading'));
  assert.doesNotThrow(() => serializationModel(model));
});

test('canonical Int also lowers to two-slot Long; unsupported types never fall back to references', () => {
  const v = variant({ kind: 'record', n: 128, types: Array(128).fill('Int') });
  modelDiagnostic(() => buildModels(v.input), 'example.counter.domain.values.Reading', 257, { document: 'counter-domain', pointer: '/valueObjects/6' });
  assert.throws(() => variant({ kind: 'record', n: 1, types: ['Double'] }), error => error.diagnostic?.code === 'VALUE_TYPE');
});
