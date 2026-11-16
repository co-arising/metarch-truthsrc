import { refKey } from '../../../lib/domain-products/references.mjs';
import { resolveName } from '../../../lib/scala-target/naming.mjs';
import { MODULAR_CANDIDATE } from '../../../lib/scala-target/profiles.mjs';
import { converterAbi } from '../converter-abi.mjs';
import { codecName, representationFields } from './exact-codecs.mjs';
import { wireFields } from './protobuf.mjs';

const structural = new Set(['optional', 'sequence', 'map', 'map-entry']);

export function convertersTemplate(context, serialization, model, out) {
  const { domain, nodes, roots, aggregates, eventRows, glueNames, occupied, eventNames,
    converterType, methodName, typeName } = converterAbi(context, serialization, model);
  const encode = (field, expression) => field.nodeId ? 'encode' + methodName(nodes.get(field.nodeId)) + '(' + expression + ')' : expression;
  const decode = (node, field, expression, required = true) => {
    if (!field.nodeId) return expression;
    const argument = required ? 'required(' + expression + ', ' + JSON.stringify(node.name + '.' + field.name) + ')' : expression;
    return 'decode' + methodName(nodes.get(field.nodeId)) + '(' + argument + ')';
  };
  const encodeField = (field, expression) => field.nodeId ? 'Some(' + encode(field, expression) + ')' : expression;
  out.append('package ' + domain.package + '.infrastructure.serialization\n\n');
  for (const { event } of eventRows) {
    const alias = eventNames.get(refKey(event.ref));
    if (alias !== event.fqn) out.append('import ' + (alias === event.identifier ? event.fqn : event.fqn.slice(0, event.fqn.lastIndexOf('.')) + '.{' + event.identifier + ' => ' + alias + '}') + '\n');
  }
  for (const aggregate of aggregates) if (!glueNames.includes(aggregate.state.name)) out.append('import ' + aggregate.state.fqn + '\n');
  const pbParts = context.package.split('.'), pbLeaf = pbParts.pop();
  out.append('import ' + domain.package + '.domain.values._\nimport ' + (pbParts.length ? pbParts.join('.') : '_root_') + '.{' + pbLeaf + ' => pb}\n\n');
  const converterSources = serialization.nodes.filter(node => node.context === context.context).flatMap(node => node.sources);
  const exceptionType = occupied.has('IllegalArgumentException') ? 'java.lang.IllegalArgumentException' : 'IllegalArgumentException';
  out.append('object DomainConverters {\n  private def required[A](value: Option[A], path: String): A =\n' +
    '    value.getOrElse(throw new ' + exceptionType + '("missing required message: " + path))\n', converterSources);

  function pair(node, encodeBody, decodeBody, { privateMethod = false, blockEncode = false, blockDecode = false, encodeParameters = null, decodeType = null } = {}) {
    const visibility = privateMethod ? 'private ' : '', name = methodName(node), type = typeName(node), pb = 'pb.' + node.name;
    out.append('\n  ' + visibility + 'def encode' + name + '(' + (encodeParameters ?? 'value: ' + type) + '): ' + pb + ' =' +
      (blockEncode ? ' {\n' + encodeBody + '\n  }\n' : '\n' + encodeBody + '\n'), node.sources);
    out.append('\n  ' + visibility + 'def decode' + name + '(value: ' + pb + '): ' + (decodeType ?? type) + ' =' +
      (blockDecode ? ' {\n' + decodeBody + '\n  }\n' : '\n' + decodeBody + '\n'), node.sources);
  }
  function optional(node) {
    const payload = wireFields(node)[1], element = node.type.element;
    const variable = element.form === 'primitive' ? { string: 'text', integer: 'number', boolean: 'flag' }[element.name] : 'inner';
    if (!variable) throw new TypeError('unsupported optional primitive');
    const condition = payload.nodeId || element.name === 'string' ? 'value.f0.isEmpty' : element.name === 'integer' ? 'value.f0 == 0L' : '!value.f0';
    pair(node,
      '    value match {\n      case Some(' + variable + ') => pb.' + node.name + '(present = true, f0 = ' + encodeField(payload, variable) + ')\n' +
      '      case None => pb.' + node.name + '(present = false)\n    }',
      '    if (value.present) Some(' + decode(node, payload, 'value.f0') + ')\n    else {\n' +
      '      require(' + condition + ', "absent optional carries a value: ' + node.name + '")\n      None\n    }',
      { privateMethod: true, blockDecode: true });
  }
  function sequence(node) {
    const payload = wireFields(node)[1];
    const encoded = payload.nodeId ? 'value.map(encode' + methodName(nodes.get(payload.nodeId)) + ')' : 'value';
    const decoded = payload.nodeId ? 'value.f0.map(decode' + methodName(nodes.get(payload.nodeId)) + ').toVector' : 'value.f0.toVector';
    pair(node, '    pb.' + node.name + '(present = true, f0 = ' + encoded + ')',
      '    require(value.present, "required sequence is absent: ' + node.name + '")\n    ' + decoded,
      { privateMethod: true, blockDecode: true });
  }
  function mapEntry(node) {
    const [key, value] = wireFields(node);
    const keyType = converterType(node.type.key);
    const valueType = converterType(node.type.value);
    pair(node, '    pb.' + node.name + '(f0 = ' + encodeField(key, 'key') + ', f1 = ' + encodeField(value, 'value') + ')',
      '    ' + decode(node, key, 'value.f0') + ' -> ' + decode(node, value, 'value.f1'),
      { privateMethod: true, encodeParameters: 'key: ' + keyType + ', value: ' + valueType, decodeType: '(' + keyType + ', ' + valueType + ')' });
  }
  const typedMaps = serialization.nodes.some(node => node.context === context.context && node.kind === 'map' && !(node.type.key.form === 'primitive' && node.type.key.name === 'string'));
  if (typedMaps) out.append('\n  private def compareBytes(left: Array[Byte], right: Array[Byte]): Int = {\n' +
    '    var index = 0\n    while (index < left.length && index < right.length) {\n' +
    '      val difference = (left(index) & 0xff) - (right(index) & 0xff)\n' +
    '      if (difference != 0) return difference\n      index += 1\n    }\n    java.lang.Integer.compare(left.length, right.length)\n  }\n', converterSources);
  function map(node) {
    const entry = nodes.get(wireFields(node)[1].nodeId);
    if (!entry) throw new TypeError('map entry is missing');
    const valueType = node.type.value;
    const resolvedVariable = valueType.form === 'nominal' ? resolveName({ profile: MODULAR_CANDIDATE, knowledgeId: refKey(valueType.ref),
      scope: node.id + ':map-local', space: 'scala-member', spelling: valueType.name, binding: null, prefix: [], suffix: [] }).identifier : 'item';
    const variable = resolvedVariable === 'key' || resolvedVariable === 'encode' + entry.name ? 'item' : resolvedVariable;
    let encoded;
    if (node.type.key.form === 'primitive' && node.type.key.name === 'string') {
      encoded = '    pb.' + node.name + '(present = true, f0 = value.toVector.sortBy(_._1).map {\n' +
        '      case (key, ' + variable + ') => encode' + entry.name + '(key, ' + variable + ')\n    })';
    } else {
      // Sort the actual encoded key-message bytes, not a guessed toString ordering.
      encoded = '    val entries = value.toVector.map {\n' +
        '      case (key, item) =>\n        val encoded = encode' + entry.name + '(key, item)\n' +
        '        val keyBytes = encoded.copy(f1 = ' + (wireFields(entry)[1].nodeId ? 'None' :
          { string: '""', boolean: 'false', integer: '0L' }[node.type.value.name]) + ').toByteArray\n' +
        '        keyBytes -> encoded\n    }\n' +
        '    val sorted = entries.sortWith { case ((left, _), (right, _)) => compareBytes(left, right) < 0 }\n' +
        '    require(sorted.sliding(2).forall(pair => pair.size < 2 || compareBytes(pair(0)._1, pair(1)._1) != 0), "ambiguous encoded map key: ' + node.name + '")\n' +
        '    pb.' + node.name + '(present = true, f0 = sorted.map(_._2))';
      if (encoded.includes('undefined')) throw new TypeError('unsupported typed map value');
    }
    pair(node, encoded,
      '    require(value.present, "required map is absent: ' + node.name + '")\n' +
      '    val entries = value.f0.map(decode' + entry.name + ')\n' +
      '    require(entries.map(_._1).distinct.size == entries.size, "duplicate map key: ' + node.name + '")\n    entries.toMap',
      { privateMethod: true, blockEncode: !(node.type.key.form === 'primitive' && node.type.key.name === 'string'), blockDecode: true });
  }
  function exact(node) {
    const codec = model.codecs.find(codec => refKey(codec.domain.ref) === refKey(node.ref));
    if (!codec) throw new TypeError('exact converter codec is missing');
    const fields = representationFields(model, codec.wire), codecObject = 'ExactValueCodecs.' + codecName(codec);
    const scalar = codec.exact.form === 'decimal';
    const encoded = scalar ? '    pb.' + node.name + '(f0 = ' + codecObject + '.toWire(value).' + fields[0].accessor + ')' :
      '    val wire = ' + codecObject + '.toWire(value)\n    pb.' + node.name + '(' + fields.map((field, index) => 'f' + index + ' = wire.' + field.accessor).join(', ') + ')';
    const decoded = '    ' + codecObject + '.fromWire(' + converterType(codec.wire) + '(' + fields.map((field, index) => 'value.f' + index).join(', ') + '))';
    pair(node, encoded, decoded, { blockEncode: !scalar });
  }
  function record(node) {
    const fields = wireFields(node), type = typeName(node);
    const definition = node.kind === 'nominal' ? model.values.find(value => refKey(value.ref) === refKey(node.ref)) : null;
    const positional = definition && definition.type.form !== 'record';
    const small = fields.length <= 2 && fields.every(field => !field.nodeId);
    const encodeArguments = fields.map(field => field.name + ' = ' + encodeField(field, 'value.' + field.accessor));
    const decodeArguments = fields.map(field => (positional ? '' : field.accessor + ' = ') + decode(node, field, 'value.' + field.name));
    const encoded = small ? '    pb.' + node.name + '(' + encodeArguments.join(', ') + ')' :
      '    pb.' + node.name + '(\n' + encodeArguments.map(argument => '      ' + argument).join(',\n') + '\n    )';
    const decoded = small ? '    ' + type + '(' + decodeArguments.join(', ') + ')' :
      '    ' + type + '(\n' + decodeArguments.map(argument => '      ' + argument).join(',\n') + '\n    )';
    pair(node, encoded, decoded);
  }
  const emitted = new Set();
  function helpers(node) {
    for (const field of wireFields(node)) {
      if (!field.nodeId) continue;
      const child = nodes.get(field.nodeId);
      if (!child) throw new TypeError('converter child is missing');
      if (!structural.has(child.kind) || emitted.has(child.id)) continue;
      helpers(child); emitted.add(child.id);
      ({ optional, sequence, map, 'map-entry': mapEntry }[child.kind])(child);
    }
  }
  for (const root of roots) {
    const node = nodes.get(root.nodeId); helpers(node);
    if (node.kind === 'exact') exact(node); else record(node);
  }
  out.append('}\n');
}
