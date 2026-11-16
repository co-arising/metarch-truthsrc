import { refKey } from '../../../lib/domain-products/references.mjs';

const primitives = { string: 'String', boolean: 'Boolean', integer: 'Long', decimal: 'BigDecimal' };
export function scalaType(type) {
  if (type.form === 'primitive' && Object.hasOwn(primitives, type.name)) return primitives[type.name];
  if (type.form === 'nominal' && typeof type.fqn === 'string') return type.fqn;
  if (type.form === 'optional') return 'Option[' + scalaType(type.element) + ']';
  if (type.form === 'sequence') return 'Vector[' + scalaType(type.element) + ']';
  if (type.form === 'map') return 'Map[' + scalaType(type.key) + ', ' + scalaType(type.value) + ']';
  throw new TypeError('unsupported resolved Scala type');
}

/** Only already-admitted semantic values are interpolated; no guessed neutral values. */
export function scalaLiteral(value, type, values) {
  if (type.form === 'primitive') {
    if (type.name === 'string') return JSON.stringify(value);
    if (type.name === 'boolean') return String(value);
    if (type.name === 'integer') return 'java.lang.Long.parseLong(' + JSON.stringify(value) + ')';
    if (type.name === 'decimal') return 'BigDecimal(' + JSON.stringify(value) + ')';
    throw new TypeError('unsupported primitive literal');
  }
  if (type.form === 'nominal') {
    const definition = values.find(row => refKey(row.ref) === refKey(type.ref));
    if (!definition) throw new TypeError('literal nominal declaration is missing');
    if (definition.exact) {
      const exact = definition.exact;
      return type.fqn + '(' + (exact.form === 'decimal' ? 'BigDecimal(' + JSON.stringify(value) + ')' :
        'BigDecimal(' + JSON.stringify(value[exact.amountMember.id]) + '), ' + JSON.stringify(value[exact.unitMember.id])) + ')';
    }
    const fields = definition.fields;
    const arguments_ = definition.type.form === 'record' ? fields.map(field => scalaLiteral(value[field.ref.id], field.type, values)) :
      [scalaLiteral(value, fields[0].type, values)];
    return type.fqn + '(' + arguments_.join(', ') + ')';
  }
  if (type.form === 'optional') return value.present ? 'Some(' + scalaLiteral(value.value, type.element, values) + ')' : 'None';
  if (type.form === 'sequence') return 'Vector(' + value.map(item => scalaLiteral(item, type.element, values)).join(', ') + ')';
  if (type.form === 'map') return 'Map(' + value.map(row => scalaLiteral(row.key, type.key, values) + ' -> ' + scalaLiteral(row.value, type.value, values)).join(', ') + ')';
  throw new TypeError('unsupported admitted literal');
}
