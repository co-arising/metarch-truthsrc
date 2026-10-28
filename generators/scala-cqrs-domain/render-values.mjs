import { entry, key, packageFor, pathFor, symbol, typeName } from './naming.mjs';

/** Target rendering only: exact representation constraints already come from typed products. */
export function renderValues({ products, options }, footprint) {
  const layout = products['reference-layout'], exact = products['exact-value-types'];
  return layout.declarations.filter(d => d.ref.kind === 'type').map(d => {
    const pkg = packageFor(d.ref.context, options), name = symbol(d.ref.id), shape = d.valueType;
    const descriptor = exact.find(t => key(t.domain) === key(d.ref));
    let body;
    if (descriptor) {
      const amount = symbol(descriptor.amountMember?.id ?? 'value'), unit = descriptor.unitMember && symbol(descriptor.unitMember.id);
      const fields = amount + ': BigDecimal' + (unit ? ', ' + unit + ': String' : '');
      const unitCheck = unit ? '\n  require(' + JSON.stringify(descriptor.units) .replace('[', 'Set(').replace(']', ')') + '.contains(' + unit + '), "unsupported exact unit")' : '';
      const same = unit ? 'require(' + unit + ' == other.' + unit + ', "exact units differ"); ' : '';
      const create = expr => name + '(' + name + '.checkedAmount(' + expr + ')' + (unit ? ', ' + unit : '') + ')';
      const normalized = name + '.checkedAmount(' + amount + ')';
      const otherAmount = name + '.checkedAmount(other.' + amount + ')';
      body = 'final case class ' + name + '(' + fields + ') {\n  ' + name + '.checkedAmount(' + amount + ')' + unitCheck + '\n' +
        '  def isPositive: Boolean = ' + amount + ' > 0\n' +
        '  def compareSameUnit(other: ' + name + '): Int = { ' + same + amount + '.compare(other.' + amount + ') }\n' +
        '  def plus(other: ' + name + '): ' + name + ' = { ' + same + create(normalized + ' + ' + otherAmount) + ' }\n' +
        '  def minus(other: ' + name + '): ' + name + ' = { ' + same + create(normalized + ' - ' + otherAmount) + ' }\n' +
        '}\nobject ' + name + ' {\n  def checkedAmount(value: BigDecimal): BigDecimal = {\n' +
        '    require(value != null, "exact amount is required")\n' +
        '    val scaled = value.bigDecimal.setScale(' + descriptor.scale + ', java.math.RoundingMode.UNNECESSARY)\n' +
        '    require(scaled.precision <= ' + descriptor.precision + ', "exact precision exceeded")\n' +
        '    new scala.math.BigDecimal(scaled, java.math.MathContext.UNLIMITED)\n  }\n}\n';
    } else if (shape.form === 'record') {
      const fields = shape.members.map(r => {
        const member = layout.declarations.find(m => key(m.ref) === key(r));
        return symbol(r.id) + ': ' + typeName(member.valueType, options);
      });
      body = 'final case class ' + name + '(' + fields.join(', ') + ')\n';
    } else body = 'final case class ' + name + '(value: ' + typeName(shape, options) + ')\n';
    return entry(pathFor(pkg, 'domain/values/' + d.ref.id + '.scala'), 'package ' + pkg + '.domain.values\n\n' + body,
      'value-object', [d.source], footprint);
  });
}
