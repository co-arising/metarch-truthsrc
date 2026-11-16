import { refKey } from '../../../lib/domain-products/references.mjs';
import { localType } from './values.mjs';

export const codecName = codec => codec.identifier;
export function representationFields(model, representation) {
  const definition = model.values.find(value => refKey(value.ref) === refKey(representation.ref));
  if (!definition) throw new TypeError('codec representation definition is missing');
  return definition.fields;
}

export function exactCodecsTemplate(context, codecs, model, out) {
  out.append('package ' + context.package + '.infrastructure.serialization\n\nimport ' + context.package + '.domain.values._\n\n');
  out.append('object ExactValueCodecs {\n', codecs.flatMap(codec => codec.sources));
  const parameterized = codecs.some(codec => codec.exact.precision !== 38);
  const blocked = ['ExactValueCodecs', 'DomainConverters', ...codecs.map(codecName)];
  out.append('  private def coefficient(text: String' + (parameterized ? ', precision: Int' : '') + '): java.math.BigInteger = {\n' +
    '    require(text != null && text.length <= ' + (parameterized ? 'precision + 2' : '40') + ', "canonical exact text is required")\n' +
    '    require(text.matches("-?(0|[1-9][0-9]*)") && text != "-0", "noncanonical exact text")\n' +
    '    val digits = if (text.startsWith("-")) text.length - 1 else text.length\n' +
    '    require(digits <= ' + (parameterized ? 'precision' : '38') + ', "exact precision exceeded")\n' +
    '    new java.math.BigInteger(text)\n  }\n');
  if (codecs.some(codec => codec.descriptor.format === 'fixed-decimal-text' && codec.exact.scale > 0)) {
    out.append('\n  private def fixed(text: String, precision: Int, scale: Int): java.math.BigDecimal = {\n' +
      '    require(text != null && text.length <= precision + 3, "canonical exact text is required")\n' +
      '    require(text.matches("-?(0|[1-9][0-9]*)\\\\.[0-9]{" + scale + "}"), "noncanonical exact text")\n' +
      '    val unscaled = new java.math.BigInteger(text.replace(".", ""))\n' +
      '    require(!(text.startsWith("-") && unscaled.signum == 0), "noncanonical exact text")\n' +
      '    require(unscaled.abs.toString.length <= precision, "exact precision exceeded")\n' +
      '    new java.math.BigDecimal(unscaled, scale)\n  }\n', codecs.flatMap(codec => codec.sources));
  }
  for (const codec of codecs) {
    const exact = codec.exact, descriptor = codec.descriptor, domain = localType(codec.domain, [context.package + '.domain.values'], blocked);
    const definition = model.values.find(value => refKey(value.ref) === refKey(codec.domain.ref));
    const amount = definition.fields[0].accessor, unit = exact.form === 'unit-decimal' ? definition.fields[1].accessor : null;
    out.append('\n  object ' + codecName(codec) + ' {\n', codec.sources);
    for (const [role, suffix] of [['wire', 'Wire'], ['po', 'Po']]) {
      const representation = codec[role], fields = representationFields(model, representation);
      const representationType = localType(representation, [context.package + '.domain.values'], blocked);
      const amountText = descriptor.format === 'minor-units-text' ? 'unscaledValue.toString' : 'toPlainString';
      out.append('    def to' + suffix + '(value: ' + domain + '): ' + representationType + ' =\n' +
        '      ' + representationType + '(' + domain + '.checkedAmount(value.' + amount + ').bigDecimal.' + amountText + (unit ? ', value.' + unit : '') + ')\n\n', codec.sources);
      const coefficient = 'coefficient(value.' + fields[0].accessor + (parameterized ? ', ' + exact.precision : '') + ')';
      const decimal = descriptor.format === 'fixed-decimal-text' && exact.scale > 0 ?
        'fixed(value.' + fields[0].accessor + ', ' + exact.precision + ', ' + exact.scale + ')' : 'new java.math.BigDecimal(' + coefficient + ', ' + exact.scale + ')';
      out.append('    def from' + suffix + '(value: ' + representationType + '): ' + domain + ' = {\n' +
        '      val decimal = ' + decimal + '\n' +
        '      ' + domain + '(new scala.math.BigDecimal(decimal, java.math.MathContext.UNLIMITED)' + (unit ? ', value.' + fields[1].accessor : '') + ')\n    }\n', codec.sources);
      if (role === 'wire') out.append('\n');
    }
    out.append('  }\n');
  }
  out.append('}\n');
}
