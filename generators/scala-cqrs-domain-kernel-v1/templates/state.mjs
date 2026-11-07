import { refKey } from '../../../lib/domain-products/references.mjs';
import { scalaLiteral } from './types.mjs';
import { localType } from './values.mjs';

/** Human-readable admitted literals. In particular Long.MinValue is a legal Scala literal. */
export function prettyLiteral(value, type, values, packages, indent = 0, multiline = false, blocked = []) {
  if (type.form === 'primitive') return type.name === 'integer' ? value + 'L' : scalaLiteral(value, type, values);
  if (type.form === 'nominal') {
    const definition = values.find(row => refKey(row.ref) === refKey(type.ref));
    if (!definition) throw new TypeError('literal nominal declaration is missing');
    const name = localType(type, packages, blocked);
    if (definition.exact) {
      const exact = definition.exact;
      const args = exact.form === 'decimal' ? [scalaLiteral(value, { form: 'primitive', name: 'decimal' }, values)] :
        [scalaLiteral(value[exact.amountMember.id], { form: 'primitive', name: 'decimal' }, values), scalaLiteral(value[exact.unitMember.id], { form: 'primitive', name: 'string' }, values)];
      return name + '(' + args.join(', ') + ')';
    }
    if (definition.type.form !== 'record') return name + '(' + prettyLiteral(value, definition.fields[0].type, values, packages, indent, false, blocked) + ')';
    const args = definition.fields.map(field => field.identifier + ' = ' + prettyLiteral(value[field.ref.id], field.type, values, packages, indent + 2, false, blocked));
    return multiline ? name + '(\n' + args.map(arg => ' '.repeat(indent + 2) + arg).join(',\n') + '\n' + ' '.repeat(indent) + ')' : name + '(' + args.join(', ') + ')';
  }
  if (type.form === 'optional') return value.present ? 'Some(' + prettyLiteral(value.value, type.element, values, packages, indent, false, blocked) + ')' : 'None';
  if (type.form === 'sequence') return 'Vector(' + value.map(item => prettyLiteral(item, type.element, values, packages, indent, false, blocked)).join(', ') + ')';
  if (type.form === 'map') return 'Map(' + value.map(row => prettyLiteral(row.key, type.key, values, packages, indent, false, blocked) + ' -> ' + prettyLiteral(row.value, type.value, values, packages, indent, false, blocked)).join(', ') + ')';
  throw new TypeError('unsupported admitted default');
}

export function stateTemplate(state, model, out) {
  const packages = [state.package + '.values'];
  out.append('package ' + state.package + '\n\nimport ' + packages[0] + '._\n\n');
  out.append('final case class ' + state.identifier + '(\n', state.sources);
  state.fields.forEach((field, index) => out.append('  ' + field.identifier + ': ' + localType(field.type, packages, [state.name]) + ' = ' +
    prettyLiteral(field.default, field.type, model.values, packages, 2, true, [state.name]) + (index + 1 < state.fields.length ? ',' : '') + '\n', field.sources));
  out.append(')\n\nobject ' + state.identifier + ' {\n  val empty: ' + state.identifier + ' = ' + state.identifier + '()\n}\n');
}
