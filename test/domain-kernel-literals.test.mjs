import test from 'node:test';
import assert from 'node:assert/strict';
import { scalaType, scalaLiteral } from '../generators/scala-cqrs-domain-kernel-v1/templates/types.mjs';

const primitive = name => ({ form: 'primitive', name });
const ref = id => ({ context: 'counter', kind: 'type', owner: [], id });
const nominal = id => ({ form: 'nominal', ref: ref(id), fqn: 'example.counter.domain.values.' + id });
const values = [
  { ref: ref('Label'), type: primitive('string'), fields: [{ name: 'value', type: primitive('string') }], exact: null },
  { ref: ref('Ratio'), fields: [{ name: 'value', type: primitive('decimal') }], exact: { form: 'decimal' } },
  { ref: ref('Distance'), fields: [{ name: 'amount', type: primitive('decimal') }, { name: 'unit', type: primitive('string') }],
    exact: { form: 'unit-decimal', amountMember: { id: 'amount' }, unitMember: { id: 'unit' } } },
  { ref: ref('Reading'), type: { form: 'record' }, exact: null, fields: [
    { ref: { id: 'first' }, name: 'first', type: nominal('Label') },
    { ref: { id: 'second' }, name: 'second', type: { form: 'optional', element: nominal('Ratio') } }
  ] }
];

test('resolved structural types retain every container and full nominal identity', () => {
  assert.equal(scalaType({ form: 'map', key: nominal('Label'), value: { form: 'sequence', element: { form: 'optional', element: primitive('integer') } } }),
    'Map[example.counter.domain.values.Label, Vector[Option[Long]]]');
  assert.throws(() => scalaType({ form: 'record' }));
  assert.throws(() => scalaType({ form: 'primitive', name: 'arbitrary' }));
});

test('literals render independently typed nested records, exact values and explicit presence', () => {
  assert.equal(scalaLiteral({ first: 'café 🚚', second: { present: true, value: '0.2500' } }, nominal('Reading'), values),
    'example.counter.domain.values.Reading(example.counter.domain.values.Label("café 🚚"), Some(example.counter.domain.values.Ratio(BigDecimal("0.2500"))))');
  assert.equal(scalaLiteral({ amount: '-12', unit: 'm' }, nominal('Distance'), values),
    'example.counter.domain.values.Distance(BigDecimal("-12"), "m")');
  assert.equal(scalaLiteral({ present: true, value: { present: false } }, { form: 'optional', element: { form: 'optional', element: primitive('string') } }, values), 'Some(None)');
});

test('integer endpoints remain canonical text until Long construction', () => {
  for (const value of ['-9223372036854775808', '9223372036854775807'])
    assert.equal(scalaLiteral(value, primitive('integer'), values), 'java.lang.Long.parseLong("' + value + '")');
  assert.equal(scalaLiteral('quote"\\\n\t', primitive('string'), values), '"quote\\"\\\\\\n\\t"');
});

test('maps preserve declared rows without dropping duplicate values during rendering', () => {
  const type = { form: 'map', key: primitive('string'), value: { form: 'sequence', element: primitive('integer') } };
  assert.equal(scalaLiteral([{ key: 'left', value: ['1', '2'] }, { key: 'right', value: ['3'] }], type, values),
    'Map("left" -> Vector(java.lang.Long.parseLong("1"), java.lang.Long.parseLong("2")), "right" -> Vector(java.lang.Long.parseLong("3")))');
  assert.throws(() => scalaLiteral({}, nominal('Missing'), values));
});
