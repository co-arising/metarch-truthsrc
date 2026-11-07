import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { profileFor } from '../lib/products/registry.mjs';
import { refKey } from '../lib/domain-products/references.mjs';
import { buildModels } from '../generators/scala-cqrs-domain-kernel-v1/build-models.mjs';
import { serializationModel } from '../generators/scala-cqrs-domain-kernel-v1/serialization-model.mjs';
import { domainKernelFixture } from './domain-kernel-fixture.mjs';

function fixture(name = 'tickets-domain-v4-products') {
  const request = structuredClone(readProductRequest(fileURLToPath(new URL(`./fixtures/${name}/files.json`, import.meta.url))));
  // Upgrade the existing Counter fixture's product profiles only, not its business source.
  for (const [id, version, documentId, schema] of [
    ['domain-decision', '4', 'decisions', 'truthsrc.domain-semantic-binding/v4'],
    ['domain-dependencies', '6', 'dependencies', 'truthsrc.domain-dependency-binding/v6'],
    ['domain-folds', '6', 'folds', 'truthsrc.domain-fold-binding/v6'],
    ['domain-external-events', '2', 'external', 'truthsrc.domain-external-event-binding/v2'],
  ]) {
    const profile = profileFor(id, version);
    Object.assign(request.requirements.find(p => p.id === id), { version, payloadSchemaVersion: profile.payloadSchemaVersion,
      capabilities: profile.capabilities, requires: profile.requires });
    const doc = request.documents.find(d => d.id === documentId);
    doc.schemaVersion = schema; doc.value.schemaVersion = schema;
  }
  const result = compileProductSet(request);
  assert.deepEqual(result.diagnostics, []);
  const products = Object.fromEntries(result.result.products.map(p => [p.id, structuredClone(p.payload)]));
  // PB inference is strictly test setup. Public options always carry explicit roots.
  const layout = products['reference-layout'];
  const options = { packages: layout.contexts.map(context => ({ context, package: `sample.${context}` })), names: [],
    protobuf: layout.contexts.map(context => ({ context, package: `sample.${context}.infrastructure.protobuf`,
      messages: layout.declarations.filter(d => d.ref.context === context && ['type', 'aggregate', 'event'].includes(d.ref.kind))
        .map((d, i) => ({ ref: d.ref, role: { type: 'value', aggregate: 'state', event: 'event' }[d.ref.kind], name: `Root${i}` })) })) };
  return { products, options };
}
const referenceInput = () => { const f = domainKernelFixture(); return { products: structuredClone(f.products), options: structuredClone(f.config.options) }; };
const declaration = (input, kind, id) => input.products['reference-layout'].declarations.find(d => d.ref.kind === kind && d.ref.id === id);
const binding = (input, kind, id, role, name) => input.options.names.push({ ref: declaration(input, kind, id).ref, role, name });
function frozen(value) {
  if (value && typeof value === 'object') { assert.equal(Object.isFrozen(value), true); Object.values(value).forEach(frozen); }
}

test('admitted v2 payloads produce detached immutable full family models, not Scala syntax', () => {
  const input = fixture(), before = structuredClone(input), model = buildModels(input);
  assert.deepEqual(input, before); frozen(model);
  assert.equal(model.values.length, 5);
  assert.equal(model.values.find(v => v.ref.id === 'DistancePO').name, 'DistancePo');
  assert.ok(model.values.every(v => v.path.startsWith('modules/kernel/src/main/scala/sample/tickets/domain/values/')));
  const a = model.aggregates[0];
  assert.equal(a.protocol.name, 'BookingProtocol');
  assert.deepEqual(a.protocol.commands[0].fields.map(f => f.ref.id), ['type', 'distance']);
  assert.equal(a.protocol.commands[0].fields[0].accessor, '`type`');
  assert.deepEqual(a.state.fields.map(f => f.default), ['', false, '0.000']);
  assert.equal(a.computations.methods[0].name, 'ticketIdentity');
  assert.equal(a.computations.methods[0].parameters[0].type.fqn, 'sample.tickets.domain.values.TicketId');
  assert.equal(a.computations.methods[0].outputType.fqn, 'sample.tickets.domain.values.TicketId');
  assert.deepEqual(a.ruleParams.params[0].fields.map(f => f.name), ['state', 'command', 'hosts']);
  assert.equal(a.ruleParams.params[0].fields[1].type.fqn, 'sample.tickets.domain.BookingProtocol.Reserve');
  assert.deepEqual(model.codecs[0].descriptor, input.products['exact-value-codecs'][0]);
  assert.deepEqual(model.codecs[0].exact, input.products['exact-value-types'][0]);
  assert.ok(model.codecs[0].sources.every(s => s.document === 'domain'));
  assert.ok(!JSON.stringify(model).includes('def '));
  assert.throws(() => { model.values[0].name = 'Mutated'; }, TypeError);
  input.options.packages[0].package = 'changed';
  assert.equal(model.contexts[0].package, 'sample.tickets');
});

test('actual output dependency paths are closed and transitively complete', () => {
  const model = buildModels(fixture()), all = new Map(model.artifacts.map(a => [a.path, a]));
  assert.equal(all.size, model.artifacts.length);
  for (const artifact of all.values()) {
    assert.ok(!artifact.deps.includes(artifact.path));
    for (const dep of artifact.directDeps) {
      assert.ok(all.has(dep), dep); assert.ok(artifact.deps.includes(dep));
      for (const transitive of all.get(dep).deps) assert.ok(artifact.deps.includes(transitive), `${artifact.path} -> ${transitive}`);
    }
  }
  const params = model.aggregates[0].ruleParams;
  assert.ok(params.deps.includes(model.values.find(v => v.ref.id === 'Distance').path));
});

test('protobuf roots are explicit and serialization is independent of Scala renaming', () => {
  const input = fixture(), first = serializationModel(buildModels(input));
  binding(input, 'type', 'TicketId', 'value', 'TicketKey');
  binding(input, 'aggregate', 'Booking', 'state', 'Snapshot');
  binding(input, 'event', 'Reserved', 'event', 'Done');
  const second = serializationModel(buildModels(input));
  const wireShape = value => value.nodes.map(n => [n.id, n.kind, n.fields.map(f => [f.name, f.number, f.nodeId, f.repeated, f.required])]);
  assert.deepEqual(wireShape(first), wireShape(second)); frozen(second);
  assert.equal(second.roots.length, input.options.protobuf[0].messages.length);
  assert.ok(second.nodes.every(n => n.path === 'modules/glue/src/main/protobuf/tickets_domain.proto'));
  const seen = new Set();
  for (const node of second.nodes) { for (const dep of node.deps) assert.ok(seen.has(dep)); seen.add(node.id); }
});

test('independent author fixture retains exact defaults, signatures and full container presence graph', () => {
  const input = referenceInput(), model = buildModels(input), graph = serializationModel(model), a = model.aggregates[0];
  assert.equal(model.values.length, 7);
  assert.equal(model.artifacts.filter(a => a.role === 'exact-codecs').length, 1);
  assert.equal(model.artifacts.find(a => a.role === 'exact-codecs').fqn, 'example.counter.infrastructure.serialization.ExactValueCodecs');
  assert.deepEqual(a.state.fields.map(f => f.default), input.products['domain-folds'].defaults.map(f => f.value));
  assert.deepEqual(a.computations.methods[0].parameters.map(f => f.name), ['reading', 'count', 'minimum']);
  assert.equal(a.computations.methods[0].outputType.name, 'Ratio');
  const root = graph.nodes.find(n => n.name === 'ReadingValue');
  assert.deepEqual(root.fields.map(f => [f.name, f.number]), Array.from({ length: 7 }, (_, i) => [`f${i}`, i + 1]));
  for (const name of ['ReadingValueField4', 'ReadingValueField4Value', 'ReadingValueField5', 'ReadingValueField5Element', 'ReadingValueField6']) {
    const n = graph.nodes.find(n => n.name === name); assert.ok(n, name);
    assert.deepEqual(n.fields.map(f => [f.name, f.number]), [['present', 1], ['f0', 2]]);
  }
  const entry = graph.nodes.find(n => n.name === 'ReadingValueField6Entry');
  assert.deepEqual(entry.fields.map(f => [f.name, f.number]), [['f0', 1], ['f1', 2]]);
  assert.equal(entry.fields[1].nodeId, 'example.counter.protobuf.RatioValue');
  assert.equal(graph.nodes.find(n => n.name === 'RatioValue').codec.id, 'ratio-minor-units');
  assert.equal(graph.nodes.find(n => n.name === 'DistanceValue').exact.scale, 0);
  assert.equal(model.codecs[0].sources.some(s => s.document !== 'counter-domain'), false);
  const seen = new Set();
  for (const n of graph.nodes) { n.deps.forEach(id => assert.ok(seen.has(id))); seen.add(n.id); }
});

for (const [label, mutate] of [
  ['unknown option', i => { i.options.methods = []; }],
  ['missing option', i => { delete i.options.names; }],
  ['extra override field', i => { binding(i, 'type', 'TicketId', 'value', 'Key'); i.options.names[0].body = 'evil'; }],
  ['duplicate override', i => { binding(i, 'type', 'TicketId', 'value', 'Key'); i.options.names.push(i.options.names[0]); }],
  ['mis-role override', i => { binding(i, 'type', 'TicketId', 'state', 'Snapshot'); }],
  ['unused port override', i => { binding(i, 'port', 'TicketReceiptPort', 'host-method', 'external'); }],
  ['dangling override', i => { binding(i, 'type', 'TicketId', 'value', 'Key'); i.options.names[0].ref = { ...i.options.names[0].ref, id: 'Missing' }; }],
  ['missing package', i => { i.options.packages = []; }],
  ['duplicate package context', i => { i.options.packages.push(i.options.packages[0]); }],
  ['portable package reserved', i => { i.options.packages[0].package = 'example.con'; }],
  ['nonportable package', i => { i.options.packages[0].package = 'example.Tickets'; }],
  ['case-folded type collision', i => { binding(i, 'type', 'TicketId', 'value', 'Ticket'); binding(i, 'type', 'TicketReceipt', 'value', 'TICKET'); }],
  ['shared Command/Event scope collision', i => { binding(i, 'command', 'Reserve', 'command', 'Same'); binding(i, 'event', 'Reserved', 'event', 'Same'); }],
  ['Command trait shadow', i => { binding(i, 'command', 'Reserve', 'command', 'Command'); }],
  ['Event trait shadow', i => { binding(i, 'event', 'Reserved', 'event', 'Event'); }],
  ['State/Protocol same package collision', i => { binding(i, 'aggregate', 'Booking', 'state', 'Same'); binding(i, 'aggregate', 'Booking', 'protocol', 'Same'); }],
  ['case-class accessor collision', i => { binding(i, 'state-field', 'reserved', 'state-field', 'copy'); }],
  ['Object final accessor collision', i => { binding(i, 'state-field', 'reserved', 'state-field', 'getClass'); }],
  ['companion accessor collision', i => { binding(i, 'member', 'type', 'member', 'companion'); }],
  ['host Object final method collision', i => { binding(i, 'port', 'TicketIdentity', 'host-method', 'wait'); }],
  ['missing nominal closure', i => { i.products['reference-layout'].declarations = i.products['reference-layout'].declarations.filter(d => d.ref.id !== 'TicketId'); }],
  ['raw Scala fallback', i => { declaration(i, 'type', 'TicketId').valueType = { form: 'scala', name: 'Any' }; }],
  ['extra admitted declaration field', i => { declaration(i, 'type', 'TicketId').scala = 'String'; }],
  ['recursive nominal graph', i => { const d = declaration(i, 'type', 'TicketId'); d.valueType = { form: 'nominal', ref: d.ref }; d.dependencies = [d.ref]; }],
  ['missing default', i => { i.products['domain-folds'].defaults.pop(); }],
  ['malformed integer default', i => { const d = i.products['domain-folds'].defaults.find(d => d.target.id === 'reserved'); d.value = 'false'; }],
  ['missing event signature', i => { i.products['domain-dependencies'].events.pop(); }],
  ['missing command parameter', i => { i.products['domain-dependencies'].commands[0].declaredSignature.pop(); }],
  ['missing exact codec', i => { i.products['exact-value-codecs'] = []; }],
  ['wrong codec pin', i => { i.products['exact-value-codecs'][0].domainVersion = '2'; }],
  ['missing PB root', i => { i.options.protobuf[0].messages.pop(); }],
  ['duplicate PB root', i => { i.options.protobuf[0].messages.push(i.options.protobuf[0].messages[0]); }],
  ['mis-role PB root', i => { i.options.protobuf[0].messages[0].role = 'event'; }],
  ['PB in kernel namespace', i => { i.options.protobuf[0].package = 'sample.tickets.domain.values'; }],
]) test(`reject ${label}`, () => {
  const input = fixture(); mutate(input); assert.throws(() => buildModels(input), error => typeof error.diagnostic?.code === 'string');
});

for (const invalid of ['Message', 'String', 'Option', 'GeneratedMessage', 'lower', 'Has_Underscore', 'Root.Type', 'Enum', 'Con'])
  test(`reject unsupported ScalaPB root ${invalid}`, () => {
    const input = fixture(); input.options.protobuf[0].messages[0].name = invalid;
    assert.throws(() => serializationModel(buildModels(input)));
  });

test('PB root and generated container suffix collisions are rejected', () => {
  const input = referenceInput();
  input.options.protobuf[0].messages.find(m => m.ref.id === 'Ratio').name = 'ReadingValueField4Value';
  assert.throws(() => serializationModel(buildModels(input)));
  const second = fixture(); second.options.protobuf[0].messages[1].name = second.options.protobuf[0].messages[0].name;
  assert.throws(() => serializationModel(buildModels(second)));
});

test('override binding is complete, not a base for generated affixes; all legal roles consume', () => {
  const input = fixture();
  for (const [kind, id, role, name] of [
    ['type', 'TicketId', 'value', 'TicketKey'], ['member', 'type', 'member', 'ticketKind'],
    ['aggregate', 'Booking', 'protocol', 'Requests'], ['command', 'Reserve', 'command', 'Accept'],
    ['event', 'Reserved', 'event', 'Accepted'], ['aggregate', 'Booking', 'state', 'Snapshot'],
    ['state-field', 'reserved', 'state-field', 'isReserved'], ['aggregate', 'Booking', 'computations', 'HostApi'],
    ['port', 'TicketIdentity', 'host-method', 'computeKey'], ['aggregate', 'Booking', 'rule-params', 'RuleInputs'],
    ['command', 'Reserve', 'params', 'AcceptInput'],
  ]) binding(input, kind, id, role, name);
  const model = buildModels(input), a = model.aggregates[0];
  assert.equal(a.protocol.name, 'Requests'); assert.equal(a.state.name, 'Snapshot');
  assert.equal(a.ruleParams.name, 'RuleInputs'); assert.equal(a.ruleParams.params[0].name, 'AcceptInput');
  assert.equal(a.ruleParams.params[0].fields[1].type.fqn, 'sample.tickets.domain.Requests.Accept');
  assert.equal(a.computations.methods[0].name, 'computeKey');
  assert.equal(model.values.find(v => v.ref.id === 'TicketReceipt').fields[0].name, 'ticketKind');
});

test('Unicode source refs require ASCII bindings and are retained across nominal/default/PB identities', () => {
  const input = fixture(), original = declaration(input, 'type', 'TicketId').ref, replacement = { ...original, id: '票据𝄞' };
  function rename(value) {
    if (!value || typeof value !== 'object') return value;
    if (value.context === original.context && value.kind === original.kind && Array.isArray(value.owner) && refKey(value) === refKey(original)) return replacement;
    if (Array.isArray(value)) return value.map(rename);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rename(v)]));
  }
  const changed = rename(input); assert.throws(() => buildModels(changed));
  binding(changed, 'type', replacement.id, 'value', 'TicketKey');
  const model = buildModels(changed), graph = serializationModel(model);
  assert.equal(model.values[0].ref.id, replacement.id);
  assert.equal(model.aggregates[0].state.fields[0].type.ref.id, replacement.id);
  assert.equal(graph.roots[0].ref.id, replacement.id);
  assert.equal(graph.roots[0].nodeId, 'sample.tickets.infrastructure.protobuf.Root0');
});

test('immutable input guard rejects getters, exotic prototypes and undefined without reading getter', () => {
  const input = fixture(); let invoked = false;
  Object.defineProperty(input.options.names, 'evil', { enumerable: true, get() { invoked = true; return 'evil'; } });
  assert.throws(() => buildModels(input)); assert.equal(invoked, false);
  const second = fixture(); second.options.names = new Map(); assert.throws(() => buildModels(second));
  const third = fixture(); third.options.names = undefined; assert.throws(() => buildModels(third));
});

test('empty host interfaces are legal, no fabricated implementation appears', () => {
  const input = fixture('domain-generation'), model = buildModels(input);
  assert.deepEqual(model.aggregates[0].computations.methods, []);
  assert.ok(!JSON.stringify(model).includes('.none'));
  assert.equal(model.values.find(v => v.ref.id === 'Ratio').exact.scale, 2);
});

test('multiple independent contexts resolve full filenames; cross-context protobuf nominal imports reject', () => {
  const a = fixture(), b = fixture();
  const rewrite = value => {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(rewrite);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === 'context' && v === 'tickets' ? 'other' : k === 'id' && v === 'distance-codec' ? 'other-distance-codec' : rewrite(v)]));
  };
  const second = rewrite(b);
  second.products['reference-layout'].contexts = ['other'];
  second.options.packages = [{ context: 'other', package: 'sample.other' }];
  second.options.protobuf[0].package = 'sample.other.infrastructure.protobuf';
  for (const [id, product] of Object.entries(a.products)) {
    if (Array.isArray(product)) product.push(...second.products[id]);
    else for (const [property, rows] of Object.entries(product)) rows.push(...second.products[id][property]);
  }
  a.options.packages.push(...second.options.packages); a.options.protobuf.push(...second.options.protobuf);
  const model = buildModels(a); assert.equal(model.aggregates.length, 2); assert.equal(serializationModel(model).contexts.length, 2);
  const collision = structuredClone(a); collision.options.packages[1].package = 'sample.tickets'; assert.throws(() => buildModels(collision));
  const separateFiles = structuredClone(a);
  separateFiles.options.protobuf[0].package = 'shared.a_b.c'; separateFiles.options.protobuf[1].package = 'shared.a.b_c';
  assert.deepEqual(buildModels(separateFiles).contexts.map(row => row.protoPath), [
    'modules/glue/src/main/protobuf/tickets_domain.proto', 'modules/glue/src/main/protobuf/other_domain.proto'
  ]);
  const cross = structuredClone(a), receipt = declaration(cross, 'type', 'TicketReceipt');
  const member = cross.products['reference-layout'].declarations.find(d => d.ref.kind === 'member' && d.ref.context === 'tickets');
  const foreign = cross.products['reference-layout'].declarations.find(d => d.ref.kind === 'type' && d.ref.context === 'other' && d.ref.id === 'TicketId').ref;
  member.valueType = { form: 'nominal', ref: foreign }; member.dependencies = [receipt.ref, foreign];
  assert.throws(() => serializationModel(buildModels(cross)));
});

test('model output contains no executable/rendered syntax fields and nested bindings have dependency metadata', () => {
  const model = buildModels(referenceInput());
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    for (const [k, v] of Object.entries(value)) {
      assert.ok(!['content', 'body', 'expression', 'predicate', 'update', 'decisions', 'literalScala', 'scalaType'].includes(k), k);
      walk(v);
    }
  }
  walk(model);
  const a = model.aggregates[0];
  for (const child of [...a.protocol.commands, ...a.protocol.events, ...a.computations.methods, ...a.ruleParams.params]) {
    assert.ok(Array.isArray(child.refs)); assert.ok(Array.isArray(child.deps)); assert.ok(Array.isArray(child.directDeps));
    for (const path of child.deps) assert.ok(model.artifacts.some(a => a.path === path));
  }
});

test('compiled Unicode and acronym ref renames, not author spelling, determine automatic names', () => {
  for (const name of ['HTTPKey', '票据𝄞']) {
    const request = structuredClone(readProductRequest(fileURLToPath(new URL('./fixtures/tickets-domain-v4-products/files.json', import.meta.url))));
    const replace = value => {
      if (value === 'TicketId') return name;
      if (Array.isArray(value)) return value.map(replace);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replace(v)]));
      return value;
    };
    const compilation = compileProductSet(replace(request)); assert.deepEqual(compilation.diagnostics, []);
    const input = fixture(); input.products = Object.fromEntries(compilation.result.products.map(p => [p.id, structuredClone(p.payload)]));
    input.options.protobuf[0].messages[0].ref = declaration(input, 'type', name).ref;
    if (name.startsWith('票')) binding(input, 'type', name, 'value', 'TicketKey');
    const model = buildModels(input);
    assert.equal(model.values[0].name, name === 'HTTPKey' ? 'HttpKey' : 'TicketKey');
    assert.equal(model.aggregates[0].state.fields[0].type.ref.id, name);
    assert.equal(serializationModel(model).roots[0].ref.id, name);
  }
});

test('state defaults use declaration field order even when defaults carrier rows are shuffled', () => {
  const input = referenceInput(), expected = buildModels(input).aggregates[0].state.fields;
  input.products['domain-folds'].defaults.reverse();
  assert.deepEqual(buildModels(input).aggregates[0].state.fields, expected);
});

test('host input name collisions reject only within their actual scope, not implementation locals', () => {
  const input = referenceInput();
  binding(input, 'parameter', 'reading', 'member', 'p');
  binding(input, 'state-field', 'minimum', 'state-field', 's');
  const model = buildModels(input);
  assert.deepEqual(model.aggregates[0].computations.methods[0].parameters.map(p => p.name), ['p', 'count', 's']);
  binding(input, 'state-field', 'maximum', 'state-field', 'other');
  // Distinct command and state constructor scopes are legal, but collide once both become host inputs.
  const host = input.products['domain-dependencies'].hosts[0];
  host.inputDependencies.push(declaration(input, 'state-field', 'maximum').ref);
  input.options.names.find(n => n.ref.id === 'maximum').name = 'p';
  assert.throws(() => buildModels(input));
});

test('exact helper accessor, unsupported decimal and forged source/default are rejected', () => {
  const i = referenceInput(); binding(i, 'member', 'amount', 'member', 'checkedAmount'); assert.throws(() => buildModels(i));
  const second = fixture(); const d = declaration(second, 'type', 'TicketId'); d.valueType = { form: 'primitive', name: 'decimal' }; assert.throws(() => buildModels(second));
  const third = referenceInput(); third.products['domain-folds'].defaults[0].source.pointer = '/fictional'; assert.throws(() => buildModels(third));
  const fourth = referenceInput(); fourth.products['domain-folds'].defaults.find(f => f.target.id === 'count').value = '-0'; assert.throws(() => buildModels(fourth));
  const fifth = referenceInput(); fifth.products['domain-folds'].defaults.find(f => f.target.id === 'accepted').value = '0.2'; assert.throws(() => buildModels(fifth));
});

test('PB package stem collisions and generated file descriptor class collisions reject', () => {
  const input = fixture(); input.options.protobuf[0].package = 'sample.syntax.pb'; assert.throws(() => serializationModel(buildModels(input)));
  const second = fixture(); second.options.protobuf[0].messages[0].name = 'TicketsDomainProto'; assert.throws(() => serializationModel(buildModels(second)));
  const third = fixture(); third.options.protobuf[0].package = 'sample.tickets.infrastructure.serialization';
  third.options.protobuf[0].messages[0].name = 'DomainConverters'; assert.throws(() => buildModels(third));
});

test('container chains support map keys, nested map values, and stable positional node paths', () => {
  const input = referenceInput(), reading = declaration(input, 'type', 'Reading');
  const d = declaration(input, 'member', 'ratios');
  d.valueType = { form: 'map', key: { form: 'nominal', ref: declaration(input, 'type', 'WireRatio').ref },
    value: { form: 'optional', element: { form: 'sequence', element: { form: 'map', key: { form: 'primitive', name: 'string' }, value: { form: 'nominal', ref: declaration(input, 'type', 'Ratio').ref } } } } };
  d.dependencies = [reading.ref, declaration(input, 'type', 'WireRatio').ref, declaration(input, 'type', 'Ratio').ref];
  input.products['domain-folds'].defaults.find(f => f.target.id === 'reading').value.ratios = [];
  const graph = serializationModel(buildModels(input));
  for (const name of ['ReadingValueField6', 'ReadingValueField6Entry', 'ReadingValueField6EntryValue', 'ReadingValueField6EntryValueValue',
    'ReadingValueField6EntryValueValueElement', 'ReadingValueField6EntryValueValueElementEntry']) assert.ok(graph.nodes.some(n => n.name === name), name);
  const entry = graph.nodes.find(n => n.name === 'ReadingValueField6Entry');
  assert.equal(entry.fields[0].nodeId, 'example.counter.protobuf.WireRatioValue');
  assert.ok(entry.refs.some(r => r.kind === 'type' && r.id === 'WireRatio'));
});

test('large nominal records retain all 23 ordered fields and sentinel defaults', () => {
  const input = referenceInput(), reading = declaration(input, 'type', 'Reading');
  input.products['reference-layout'].declarations = input.products['reference-layout'].declarations.filter(d => d.ref.kind !== 'member' || d.ref.owner[0] !== 'Reading');
  const members = Array.from({ length: 23 }, (_, i) => ({
    ref: { context: 'counter', kind: 'member', owner: ['Reading'], id: `field${i}` },
    valueType: { form: 'primitive', name: 'string' }, source: { document: 'counter-domain', pointer: `/valueObjects/6/fields/${i}` }, dependencies: [reading.ref]
  }));
  input.products['reference-layout'].declarations.push(...members);
  reading.valueType = { form: 'record', members: members.map(m => m.ref) }; reading.dependencies = members.map(m => m.ref);
  const carrier = Object.fromEntries(members.map((m, i) => [m.ref.id, `sentinel-${i}-𝄞`]));
  input.products['domain-folds'].defaults.find(f => f.target.id === 'reading').value = carrier;
  const model = buildModels(input), graph = serializationModel(model), root = graph.nodes.find(n => n.name === 'ReadingValue');
  assert.equal(root.fields.length, 23); assert.deepEqual(root.fields.map(f => f.accessor), members.map(m => m.ref.id));
  assert.deepEqual(root.fields.map(f => f.number), Array.from({ length: 23 }, (_, i) => i + 1));
  assert.deepEqual(model.aggregates[0].state.fields.find(f => f.ref.id === 'reading').default, carrier);
});
