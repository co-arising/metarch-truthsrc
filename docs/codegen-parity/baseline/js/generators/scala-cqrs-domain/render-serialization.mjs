import { entry, key, packageFor, pathFor, symbol, typeName } from './naming.mjs';
import { serializationModel } from './serialization.mjs';

const primitive = { string: 'string', boolean: 'bool', integer: 'sint64', decimal: 'string' };
const protoPath = pkg => 'app/protobuf/' + pkg.replaceAll('.', '_') + '_domain.proto';
const converterPath = pkg => pathFor(pkg, 'infrastructure/serialization/DomainConverters.scala');
const pbType = carrier => carrier.form === 'node' ? carrier.node.name : primitive[carrier.form];
const domainType = node => node.kind === 'state' ? node.pkg + '.domain.' + symbol(node.aggregate.id) + 'State' : node.kind === 'event' ? node.pkg + '.domain.' + symbol(node.event.owner[0]) + 'Protocol.' + symbol(node.event.id) : typeName(node.type, { packages: [{ context: node.ref.context, package: node.pkg }] });
export function renderProto(context, footprint) {
  const nodes = serializationModel(context.products, context.options);
  return [...new Set(nodes.map(n => n.pkg))].map(pkg => {
    const local = nodes.filter(n => n.pkg === pkg);
    let text = 'syntax = "proto3";\n\nimport "scalapb/scalapb.proto";\npackage ' + pkg + '.infrastructure.proto;\noption (scalapb.options) = { flat_package: true };\n\n';
    for (const n of local) {
      text += 'message ' + n.name + ' {\n';
      if (n.kind === 'optional') text += '  bool present = 1;\n';
      n.fields.forEach((f, i) => { text += '  ' + (f.repeated ? 'repeated ' : '') + pbType(f.carrier) + ' f' + i + ' = ' + (i + (n.kind === 'optional' ? 2 : 1)) + ';\n'; });
      text += '}\n\n';
    }
    return entry(protoPath(pkg), text, 'proto', local.flatMap(n => n.sources), footprint);
  });
}
export function renderConverters(context, footprint) {
  const { products, options } = context, nodes = serializationModel(products, options);
  return [...new Set(nodes.map(n => n.pkg))].flatMap(pkg => {
    const local = nodes.filter(n => n.pkg === pkg), pb = pkg + '.infrastructure.proto.';
    const carrierType = c => c.form === 'node' ? c.node.kind === 'map-entry' ? '(' + carrierType(c.node.fields[0].carrier) + ', ' + carrierType(c.node.fields[1].carrier) + ')' : c.type ? typeName(c.type, options) : typeName(c.node.type, options) : { string: 'String', boolean: 'Boolean', integer: 'Long', decimal: 'BigDecimal' }[c.form];
    const actualType = n => ['nominal', 'exact', 'state', 'event'].includes(n.kind) ? domainType(n) : n.kind === 'map-entry' ? '(' + carrierType(n.fields[0].carrier) + ', ' + carrierType(n.fields[1].carrier) + ')' : typeName(n.type, options);
    const encode = (c, value) => c.form === 'node' ? 'encode' + c.node.name + '(' + value + ')' : c.form === 'decimal' ? value + '.bigDecimal.toPlainString' : value;
    const decode = (c, value) => c.form === 'node' ? 'decode' + c.node.name + '(' + value + ')' : c.form === 'decimal' ? 'BigDecimal(' + value + ')' : value;
    const field = (c, value) => c.form === 'node' ? 'Some(' + encode(c, value) + ')' : encode(c, value);
    const required = (c, value) => decode(c, c.form === 'node' ? value + '.getOrElse(throw new IllegalArgumentException("required typed value missing"))' : value);
    let text = 'package ' + pkg + '.infrastructure.serialization\n\nobject DomainConverters {\n';
    text += '  private def fixed(value: BigDecimal, scale: Int): String = value.bigDecimal.setScale(scale, java.math.RoundingMode.UNNECESSARY).toPlainString\n';
    text += '  private def readExact(value: String, scale: Int, minor: Boolean): BigDecimal = {\n' +
      '    require(value != null && value.length <= 80, "bounded exact text required")\n' +
      '    val pattern = if (minor || scale == 0) "-?(0|[1-9][0-9]*)" else "-?(0|[1-9][0-9]*)\\\\.[0-9]{" + scale + "}"\n' +
      '    require(value.matches(pattern) && !(value.startsWith("-") && BigDecimal(value) == 0), "noncanonical exact text")\n' +
      '    if (minor) BigDecimal(new java.math.BigDecimal(new java.math.BigInteger(value), scale)) else BigDecimal(value)\n  }\n';
    const header = text, groups = [];
    for (const n of local) {
      const start = text.length;
      const t = actualType(n), target = pb + n.name;
      let encoded, decoded;
      if (n.kind === 'exact') {
        const d = n.descriptor, c = n.codec, amount = 'value.' + symbol(d.amountMember?.id ?? 'value'), unit = d.unitMember && 'value.' + symbol(d.unitMember.id), minor = c.format === 'minor-units-text';
        const packed = minor ? amount + '.bigDecimal.setScale(' + d.scale + ', java.math.RoundingMode.UNNECESSARY).unscaledValue.toString' : 'fixed(' + amount + ', ' + d.scale + ')';
        encoded = target + '(' + packed + (unit ? ', ' + unit : '') + ')';
        decoded = t + '(readExact(value.f0, ' + d.scale + ', ' + minor + ')' + (unit ? ', value.f1' : '') + ')';
        for (const representation of ['wire', 'po']) {
          const r = c[representation], rt = typeName({ form: 'nominal', ref: r.ref }, options), capital = representation === 'wire' ? 'Wire' : 'PO';
          const textValue = 'encoded.f0', record = r.amountMember ? rt + '(' + textValue + ', encoded.f1)' : rt + '(' + textValue + ')';
          text += '  def ' + symbol(n.ref.id + 'To' + capital) + '(value: ' + t + '): ' + rt + ' = { val encoded = encode' + n.name + '(value); ' + record + ' }\n';
          text += '  def ' + symbol(n.ref.id + 'From' + capital) + '(value: ' + rt + '): ' + t + ' = decode' + n.name + '(' + target + '(' + (r.amountMember ? 'value.' + symbol(r.amountMember.id) + ', value.' + symbol(r.unitMember.id) : 'value.value') + '))\n';
        }
      } else if (n.kind === 'optional') {
        const c = n.fields[0].carrier;
        encoded = 'value match { case None => ' + target + '(present = false); case Some(item) => ' + target + '(present = true, f0 = ' + field(c, 'item') + ') }';
        const empty = c.form === 'node' ? 'value.f0.isEmpty' : c.form === 'string' || c.form === 'decimal' ? 'value.f0.isEmpty' : c.form === 'boolean' ? '!value.f0' : 'value.f0 == 0L';
        decoded = 'if (!value.present) { require(' + empty + ', "absent optional contains a value"); None } else Some(' + required(c, 'value.f0') + ')';
      } else if (n.kind === 'sequence') {
        const c = n.fields[0].carrier;
        encoded = target + '(value.map(item => ' + encode(c, 'item') + '))';
        decoded = 'value.f0.map(item => ' + decode(c, 'item') + ').toVector';
      } else if (n.kind === 'map') {
        const c = n.fields[0].carrier;
        encoded = '{ val rows = value.toVector.map(item => ' + encode(c, 'item') + ').sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); ' + target + '(rows) }';
        decoded = '{ val rows = value.f0.map(item => ' + decode(c, 'item') + ').toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }';
      } else {
        encoded = target + '(' + n.fields.map((f, i) => field(f.carrier, n.kind === 'map-entry' ? 'value._' + (i + 1) : 'value.' + symbol(f.name))).join(', ') + ')';
        const args = n.fields.map((f, i) => required(f.carrier, 'value.f' + i)).join(', ');
        decoded = n.kind === 'map-entry' ? '(' + args + ')' : t + '(' + args + ')';
      }
      text += '  def encode' + n.name + '(value: ' + t + '): ' + target + ' = ' + encoded + '\n';
      text += '  def decode' + n.name + '(value: ' + target + '): ' + t + ' = ' + decoded + '\n';
      groups.push({ node: n, content: text.slice(start) });
    }
    text += '}\n';
    const dependencies = [protoPath(pkg), ...products['reference-layout'].declarations.filter(d => d.ref.context === options.packages.find(p => p.package === pkg)?.context && d.ref.kind === 'type').map(d => pathFor(pkg, 'domain/values/' + d.ref.id + '.scala')),
      ...local.filter(n => n.kind === 'state').map(n => pathFor(pkg, 'domain/' + n.aggregate.id + 'State.scala')),
      ...new Set(local.filter(n => n.kind === 'event').map(n => pathFor(pkg, 'domain/' + n.event.owner[0] + 'Protocol.scala')))];
    if (text.length <= 60000) return [entry(converterPath(pkg), text, 'converter', local.flatMap(n => n.sources), footprint, [...new Set(dependencies)])];
    const parts = [];
    for (const group of groups) {
      if (!parts.length || parts.at(-1).content.length + group.content.length > 48000) parts.push({ content: '', nodes: [] });
      parts.at(-1).content += group.content;
      parts.at(-1).nodes.push(group.node);
    }
    const names = parts.map((_, i) => 'DomainConvertersPart' + i);
    const paths = names.map(name => pathFor(pkg, 'infrastructure/serialization/' + name + '.scala'));
    const facade = header.replace('object DomainConverters {', 'object DomainConverters extends ' + names.join(' with ') + ' {') + '}\n';
    return [entry(converterPath(pkg), facade, 'converter', local.flatMap(n => n.sources), footprint, [...new Set([...dependencies, ...paths])]),
      ...parts.map((part, i) => entry(paths[i], 'package ' + pkg + '.infrastructure.serialization\n\ntrait ' + names[i] + ' { self: DomainConverters.type =>\n' +
        header.slice(header.indexOf('  private def fixed')) + part.content + '}\n', 'converter', part.nodes.flatMap(n => n.sources), footprint, [...new Set(dependencies)]))];
  });
}
