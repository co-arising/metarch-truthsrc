import { scalaType } from './types.mjs';

/** Use the type API, abbreviating only explicitly imported/local nominal packages. */
export function localType(type, packages = [], blocked = []) {
  function imported(row) {
    if (row.form === 'nominal') {
      const packageName = row.fqn.slice(0, row.fqn.lastIndexOf('.'));
      return packages.includes(packageName) && !blocked.includes(row.name) ? { ...row, fqn: row.identifier } : row;
    }
    if (row.form === 'optional' || row.form === 'sequence') return { ...row, element: imported(row.element) };
    if (row.form === 'map') return { ...row, key: imported(row.key), value: imported(row.value) };
    return row;
  }
  return scalaType(imported(type));
}

export function valueTemplate(value, out) {
  out.append('package ' + value.package + '\n\n');
  const name = value.identifier;
  if (!value.exact) {
    if (value.type.form === 'record' && value.fields.length <= 2 && value.fields.every(field => field.type.form === 'primitive')) {
      out.append('final case class ' + name + '(', value.sources);
      value.fields.forEach((field, index) => out.append((index ? ', ' : '') + field.identifier + ': ' + localType(field.type, [value.package]), field.sources));
      out.append(')\n');
    } else if (value.type.form === 'record') {
      out.append('final case class ' + name + '(\n', value.sources);
      value.fields.forEach((field, i) => out.append('  ' + field.identifier + ': ' + localType(field.type, [value.package]) +
        (i + 1 < value.fields.length ? ',' : '') + '\n', field.sources));
      out.append(')\n');
    } else {
      out.append('final case class ' + name + '(', value.sources);
      const field = value.fields[0];
      out.append(field.identifier + ': ' + localType(field.type, [value.package]), field.sources);
      out.append(')\n');
    }
    return;
  }
  const exact = value.exact, unitDecimal = exact.form === 'unit-decimal';
  const amount = value.fields[0].accessor, unit = unitDecimal ? value.fields[1].accessor : null;
  const receiver = accessor => accessor === 'other' ? 'this.' + accessor : accessor;
  const ownAmount = receiver(amount), ownUnit = unit && receiver(unit);
  out.append('final case class ' + name + '(' + value.fields.map(field => field.identifier + ': ' + localType(field.type, [value.package])).join(', ') + ') {\n', value.sources);
  out.append('  ' + name + '.checkedAmount(' + amount + ')\n', value.fields[0].sources);
  if (unitDecimal) out.append('  require(Set(' + exact.units.map(unit => JSON.stringify(unit)).join(', ') + ').contains(' + unit + '), "unsupported exact unit")\n', value.fields[1].sources);
  out.append('\n  def isPositive: Boolean = ' + amount + ' > 0\n\n');
  if (unitDecimal) {
    out.append('  def compareSameUnit(other: ' + name + '): Int = {\n' +
      '    require(' + ownUnit + ' == other.' + unit + ', "exact units differ")\n' +
      '    ' + ownAmount + '.compare(other.' + amount + ')\n  }\n');
    for (const [method, operator] of [['plus', '+'], ['minus', '-']]) out.append('\n  def ' + method + '(other: ' + name + '): ' + name + ' = {\n' +
      '    require(' + ownUnit + ' == other.' + unit + ', "exact units differ")\n' +
      '    ' + name + '(' + name + '.checkedAmount(' + ownAmount + ') ' + operator + ' ' + name + '.checkedAmount(other.' + amount + '), ' + ownUnit + ')\n  }\n');
  } else {
    out.append('  def compareSameUnit(other: ' + name + '): Int = ' + ownAmount + '.compare(other.' + amount + ')\n');
    for (const [method, operator] of [['plus', '+'], ['minus', '-']]) out.append('\n  def ' + method + '(other: ' + name + '): ' + name + ' =\n' +
      '    ' + name + '(' + name + '.checkedAmount(' + ownAmount + ') ' + operator + ' ' + name + '.checkedAmount(other.' + amount + '))\n');
  }
  out.append('}\n\nobject ' + name + ' {\n  def checkedAmount(value: BigDecimal): BigDecimal = {\n' +
    '    require(value != null, "exact amount is required")\n' +
    '    val scaled = value.bigDecimal.setScale(' + exact.scale + ', java.math.RoundingMode.UNNECESSARY)\n' +
    '    require(scaled.precision <= ' + exact.precision + ', "exact precision exceeded")\n' +
    '    new scala.math.BigDecimal(scaled, java.math.MathContext.UNLIMITED)\n  }\n}\n', value.sources);
}
