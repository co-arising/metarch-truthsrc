import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTargetModel } from '../lib/scala-target/model.mjs';
import { LEGACY_COMPATIBLE, MODULAR_CANDIDATE } from '../lib/scala-target/profiles.mjs';
import { parcelTargetInput, ref, nominal } from './scala-target-fixture.mjs';

const rejects = (input, code) => assert.throws(() => buildTargetModel(input), error => error.diagnostic?.code === code);

test('module model closes every nested port signature without copying business types', () => {
  const input = parcelTargetInput(), original = structuredClone(input);
  const model = buildTargetModel(input);
  assert.deepEqual(input, original);
  assert.deepEqual(model.signatureClosure.map(value => value.id).sort(),
    ['Load', 'Parcel', 'ParcelId', 'Quote', 'QuoteError', 'QuoteRequest', 'Route', 'RouteId']);
  assert.equal(new Set(model.values.map(value => value.name)).size, 8);
  assert.deepEqual(model.ports.map(port => [port.name, port.packageName]), [
    ['CapacityPolicy', 'example.parcel.domain.ports'],
    ['RouteRepository', 'example.parcel.application.ports'],
    ['QuoteFlow', 'example.parcel.application.ports']
  ]);
  assert.equal(model.ports[1].methods[0].result.effect, 'future');
  assert.equal(model.ports[1].methods[0].result.valueType.form, 'optional');
  assert.equal(model.components.find(component => component.id === 'capacity-bridge').path,
    'modules/kernel/src/main/scala/example/parcel/domain/ports/CapacityPolicyBridge.scala');
  assert.equal(model.components.find(component => component.id === 'parcel-module').path,
    'src/main/scala/example/parcel/composition/ParcelModule.scala');
  assert.deepEqual(model.bindings.map(binding => [binding.port.id, binding.component]), [
    ['CapacityPolicy', 'capacity-bridge'], ['RouteRepository', 'route-repository'], ['QuoteFlow', 'quote-flow']
  ]);
  assert.ok(model.order.indexOf('capacity-rule') < model.order.indexOf('capacity-bridge'));
  assert.ok(model.order.indexOf('quote-flow') < model.order.indexOf('parcel-module'));
  assert.ok(Object.isFrozen(model.values[0].fields));
  assert.deepEqual(buildTargetModel(input), model);
});

test('target model does not silently reinterpret compatible layouts', () => {
  const input = parcelTargetInput(); input.profile = LEGACY_COMPATIBLE;
  rejects(input, 'TARGET_MODEL_PROFILE');
});

test('renaming Scala leaves knowledge refs and nominal references untouched', () => {
  const input = parcelTargetInput();
  input.values.find(value => value.ref.id === 'ParcelId').spelling = 'parcel-key';
  const model = buildTargetModel(input);
  const parcelId = model.values.find(value => value.ref.id === 'ParcelId');
  assert.equal(parcelId.name, 'ParcelKey');
  assert.equal(parcelId.ref.id, 'ParcelId');
  assert.equal(model.values.find(value => value.ref.id === 'Parcel').fields[0].valueType.ref.id, 'ParcelId');
});

test('nested signature closure detects outer ownership through sequences and optional values', () => {
  for (const id of ['ParcelId', 'RouteId', 'QuoteError']) {
    const input = parcelTargetInput(); input.values.find(value => value.ref.id === id).module = 'glue';
    rejects(input, 'TARGET_SIGNATURE_MODULE');
  }
  const input = parcelTargetInput();
  input.values.find(value => value.ref.id === 'Parcel').fields[0].valueType = { form: 'map',
    key: { form: 'primitive', name: 'string' }, value: { form: 'optional', element: nominal('Missing') } };
  rejects(input, 'TARGET_TYPE_UNRESOLVED');
});

test('sum variant fields belong to the complete signature closure', () => {
  const input = parcelTargetInput();
  input.values.find(value => value.ref.id === 'QuoteError').variants[0].fields = [{ id: 'detail', spelling: 'detail', binding: null, valueType: nominal('Missing') }];
  rejects(input, 'TARGET_TYPE_UNRESOLVED');
});

test('same-file values are explicit while case-folded source-file aliases are rejected', () => {
  const model = buildTargetModel(parcelTargetInput());
  assert.equal(model.files.length, 10);
  assert.equal(model.values.filter(value => value.path.endsWith('/ParcelValues.scala')).length, 7);
  const input = parcelTargetInput(); input.values[0].fileStem = 'PARCELValues';
  rejects(input, 'TARGET_PATH_COLLISION');
  const invalid = parcelTargetInput(); invalid.values[0].fileStem = 42; rejects(invalid, 'TARGET_FILE_STEM');
});

test('cycles, ambiguous type names and unresolved nominal kinds fail before render', () => {
  const cycle = parcelTargetInput();
  cycle.values.find(value => value.ref.id === 'ParcelId').fields[0].valueType = nominal('Parcel');
  rejects(cycle, 'TARGET_TYPE_CYCLE');
  const conflict = parcelTargetInput(); conflict.values[1].spelling = conflict.values[0].spelling;
  rejects(conflict, 'TARGET_NAME_COLLISION');
  const wrong = parcelTargetInput(); wrong.values[0].fields[0].valueType = { form: 'nominal', ref: ref('CapacityPolicy', 'port') };
  rejects(wrong, 'TARGET_TYPE_UNRESOLVED');
});

test('missing, duplicate or mismatched root binding is not an optional warning', () => {
  const missing = parcelTargetInput(); missing.bindings.pop(); rejects(missing, 'TARGET_BINDING_MISSING');
  const duplicate = parcelTargetInput(); duplicate.bindings.push(duplicate.bindings[0]); rejects(duplicate, 'TARGET_BINDING_DUPLICATE');
  const mismatch = parcelTargetInput(); mismatch.bindings[0].component = 'quote-flow'; rejects(mismatch, 'TARGET_BINDING_IMPLEMENTATION');
  const outer = parcelTargetInput(); outer.bindings[0].module = 'kernel'; rejects(outer, 'TARGET_BINDING_MODULE');
});

test('module direction and pure bridges reject outward dependencies', () => {
  const glue = parcelTargetInput(); glue.components.find(component => component.id === 'route-repository').dependencies = ['quote-flow'];
  rejects(glue, 'TARGET_MODULE_DIRECTION');
  const bridge = parcelTargetInput(); bridge.components.find(component => component.id === 'capacity-bridge').dependencies = ['quote-flow'];
  rejects(bridge, 'TARGET_MODULE_DIRECTION');
  const impure = parcelTargetInput(); impure.components.find(component => component.id === 'capacity-bridge').requires = [ref('RouteRepository', 'port')];
  rejects(impure, 'TARGET_PURE_DEPENDENCY');
  const misplaced = parcelTargetInput(); misplaced.components.find(component => component.id === 'quote-flow').module = 'kernel';
  rejects(misplaced, 'TARGET_COMPONENT_MODULE');
  const noDelegate = parcelTargetInput(); noDelegate.components.find(component => component.id === 'capacity-bridge').dependencies = [];
  rejects(noDelegate, 'TARGET_BRIDGE');
});

test('pure computation effects, port placement and module references are explicit', () => {
  const asynchronous = parcelTargetInput(); asynchronous.ports[0].methods[0].result.effect = 'future';
  rejects(asynchronous, 'TARGET_PURE_EFFECT');
  const moved = parcelTargetInput(); moved.ports[0].module = 'ext'; rejects(moved, 'TARGET_PORT_MODULE');
  const unknown = parcelTargetInput(); unknown.values[0].module = 'unknown'; rejects(unknown, 'TARGET_MODULE');
  const unsupported = parcelTargetInput(); unsupported.ports[0].methods[0].result.effect = 'guess'; rejects(unsupported, 'TARGET_EFFECT');
});

test('component cycles and missing dependencies are rejected independently of module names', () => {
  const missing = parcelTargetInput(); missing.components[0].dependencies = ['does-not-exist']; rejects(missing, 'TARGET_COMPONENT_UNRESOLVED');
  const cycle = parcelTargetInput(); cycle.components[0].dependencies = ['capacity-bridge']; rejects(cycle, 'TARGET_COMPONENT_CYCLE');
});

test('non-string roles cannot bypass bridge and purity checks through property coercion', () => {
  const arrayRole = parcelTargetInput(); arrayRole.components[1].role = ['bridge']; arrayRole.components[1].dependencies = [];
  rejects(arrayRole, 'TARGET_COMPONENT_MODULE');
  const effectful = parcelTargetInput(); effectful.components[1].role = ['bridge']; effectful.components[1].requires = [ref('RouteRepository', 'port')];
  rejects(effectful, 'TARGET_COMPONENT_MODULE');
});

test('inherited final member names cannot become generated port methods or case-class fields', () => {
  for (const spelling of ['wait', 'notify', 'notifyAll', 'getClass']) {
    const input = parcelTargetInput();
    input.ports[0].methods[0] = { id: spelling, spelling, binding: null, parameters: [],
      result: { effect: 'pure', valueType: { form: 'primitive', name: 'string' } } };
    rejects(input, 'TARGET_NAME_RESERVED');
    input.ports[0].methods[0].binding = 'readValue';
    assert.equal(buildTargetModel(input).ports[0].methods[0].name, 'readValue');
  }
  const value = parcelTargetInput(); value.values[0].fields[0].spelling = 'getClass';
  rejects(value, 'TARGET_NAME_RESERVED');
});

test('method-local parameter names do not inherit object member reservations', () => {
  const input = parcelTargetInput(); input.ports[0].methods[0].parameters[0].spelling = 'wait';
  assert.equal(buildTargetModel(input).ports[0].methods[0].parameters[0].name, 'wait');
});

test('unsupported fields, implicit implementations and accessors fail closed', () => {
  const implicit = parcelTargetInput(); implicit.ports[0].implementedBy = 'capacity-bridge'; rejects(implicit, 'PRODUCT_FIELD_UNKNOWN');
  const body = parcelTargetInput(); body.components[0].scalaBody = 'return true'; rejects(body, 'PRODUCT_FIELD_UNKNOWN');
  let invoked = false;
  const accessor = parcelTargetInput(); Object.defineProperty(accessor, 'values', { enumerable: true, get() { invoked = true; return []; } });
  rejects(accessor, 'TARGET_INPUT'); assert.equal(invoked, false);
});
