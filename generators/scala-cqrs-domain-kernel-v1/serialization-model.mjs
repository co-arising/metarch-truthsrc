import { targetData, resolveNameSet } from '../../lib/scala-target/naming.mjs';
import { MODULAR_CANDIDATE } from '../../lib/scala-target/profiles.mjs';
import { fail } from '../../lib/products/request.mjs';
import { refKey } from '../../lib/domain-products/references.mjs';

const reject = message => fail('KERNEL_PROTOBUF', message, { document: 'target', pointer: '/protobuf' });
const syntaxReserved = new Set('syntax import weak public package option optional required repeated oneof map reserved extensions to max message enum service rpc returns stream extend group true false inf nan'.split(' '));
// These names shadow identifiers emitted by ScalaPB 0.11.x or the libraries its generated code uses.
const scalaPBReserved = new Set(['Any', 'AnyRef', 'AnyVal', 'Object', 'Nothing', 'Null', 'Unit', 'String', 'Boolean', 'Byte', 'Short', 'Int', 'Long', 'Float', 'Double',
  'Array', 'Seq', 'Vector', 'List', 'Map', 'Set', 'Option', 'Some', 'None', 'Either', 'Left', 'Right', 'Product', 'Serializable', 'BigDecimal', 'BigInt',
  'GeneratedMessage', 'GeneratedMessageCompanion', 'Message', 'MessageLite', 'Parser', 'ByteString', 'CodedInputStream', 'CodedOutputStream',
  'UnknownFieldSet', 'Lens', 'Updatable', 'PValue', 'PMessage', 'Descriptor', 'Descriptors', 'Collection', 'Builder',
  'Equals', 'HashCode', 'ToString', 'GetClass', 'Notify', 'NotifyAll', 'Wait', 'Clone', 'Finalize', 'Companion', 'Copy',
  'ParseFrom', 'ToByteArray', 'ToByteString', 'WriteTo', 'SerializedSize', 'DefaultInstance', 'MessageCompanion', 'ScalaDescriptor',
  'JavaDescriptor', 'GetField', 'GetFieldByNumber', 'DiscardUnknownFields', 'Validate', 'MergeFrom', 'FromFieldsMap', 'Reads']);
const dedupe = values => [...new Set(values)];
const refsOf = values => [...new Map(values.map(r => [refKey(r), r])).values()];
const sourcesOf = values => [...new Map(values.map(s => [JSON.stringify(s), s])).values()];
const rootKey = (ref, role) => JSON.stringify([refKey(ref), role]);
const nominal = v => ({ form: 'nominal', role: v.role, ref: v.ref, name: v.name, identifier: v.identifier, fqn: v.fqn, path: v.path });

/** Structural protobuf graph, independent from Scala spelling and without target text. */
export function serializationModel(raw) {
  const model = targetData(raw), nodes = [], roots = [], contexts = [];
  const rootBindings = new Map(), definitions = new Map(), names = new Map(), completed = new Map(), pending = new Set();
  for (const artifact of model.artifacts.filter(a => a.name !== null))
    names.set(artifact.package + '.' + artifact.name.toLowerCase(), artifact.name);
  const values = new Map(model.values.map(v => [refKey(v.ref), v]));
  for (const v of model.values) definitions.set(rootKey(v.ref, 'value'), v);
  for (const a of model.aggregates) {
    definitions.set(rootKey(a.ref, 'state'), a.state);
    for (const e of a.protocol.events) definitions.set(rootKey(e.ref, 'event'), e);
  }
  function safeName(name, context) {
    if (typeof name !== 'string' || name.length > 160 || !/^[A-Z][A-Za-z0-9]*$/.test(name) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name) || syntaxReserved.has(name.toLowerCase()) || scalaPBReserved.has(name))
      reject('explicit protobuf name is unsupported or unsafe in generated ScalaPB identifiers');
    const key = context.protobuf.package + '.' + name.toLowerCase();
    if (names.has(key)) reject('protobuf root/generated suffix/portable name collision');
    names.set(key, name);
  }
  for (const context of model.contexts) {
    const pb = context.protobuf;
    resolveNameSet({ profile: MODULAR_CANDIDATE, names: [{ knowledgeId: context.context, scope: 'protobuf', space: 'scala-package', spelling: context.context,
      binding: pb.package, prefix: [], suffix: [] }], reserved: [] });
    if (pb.package.split('.').some(segment => syntaxReserved.has(segment))) reject('protobuf package contains a reserved syntax segment');
    const stem = context.protoPath.split('/').at(-1).replace(/\.proto$/, '');
    const descriptorName = stem.split('_').map(s => s[0].toUpperCase() + s.slice(1)).join('') + 'Proto';
    names.set(pb.package + '.' + descriptorName.toLowerCase(), descriptorName);
    for (const binding of pb.messages) {
      const key = rootKey(binding.ref, binding.role);
      if (rootBindings.has(key) || !definitions.has(key) || binding.ref.context !== context.context) reject('protobuf root binding is duplicate, mis-role, or unresolved');
      safeName(binding.name, context);
      rootBindings.set(key, { ...binding, context, id: pb.package + '.' + binding.name });
    }
  }
  if (rootBindings.size !== definitions.size) reject('all nominal/state/event roots require explicit protobuf bindings');
  function newNode(kind, type, ref, context, name, refs, sources) {
    return { id: context.protobuf.package + '.' + name, kind, context: context.context, name, fqn: context.protobuf.package + '.' + name,
      type, ref, refs: refsOf(refs), sources: sourcesOf(sources), fields: [], deps: [], path: context.protoPath };
  }
  function finish(node) {
    node.deps = dedupe(node.fields.flatMap(f => f.nodeId ? [f.nodeId] : []));
    if (node.deps.includes(node.id) || node.deps.some(id => !completed.has(id))) reject('recursive or incomplete protobuf node graph');
    node.refs = refsOf([...node.refs, ...node.deps.flatMap(id => completed.get(id).refs)]);
    nodes.push(node); completed.set(node.id, node); return node;
  }
  function pbField(name, number, type, nodeId, { repeated = false, required = false, ref = null, accessor = null, sources = [] } = {}) {
    const wireType = nodeId ? null : { string: 'string', boolean: 'bool', integer: 'int64', decimal: 'string' }[type.name];
    if (!nodeId && !wireType) reject('unsupported primitive protobuf type');
    return { name, number, repeated, required, type, wireType, nodeId, ref, accessor, sources };
  }
  function fieldFor(name, number, type, context, pathName, field, repeated = false, required = true) {
    const nodeId = type.form === 'primitive' ? null : ensureType(type, context, pathName, field).id;
    return pbField(name, number, type, nodeId, { repeated, required: nodeId !== null && required && !repeated,
      ref: field.ref, accessor: field.accessor, sources: field.sources });
  }
  function ensureType(type, context, name, field) {
    if (type.form === 'nominal') {
      if (type.role !== 'value' || !values.has(refKey(type.ref))) reject('serialization nominal closure must point to value definitions');
      if (type.ref.context !== context.context) reject('cross-context nominal protobuf imports are unsupported in this finite candidate');
      return ensureRoot(rootKey(type.ref, 'value'));
    }
    if (!['optional', 'sequence', 'map'].includes(type.form)) reject('unsupported serialization structural type');
    safeName(name, context);
    const refs = field.ref ? [field.ref] : [];
    const node = newNode(type.form, type, field.ref, context, name, refs, field.sources);
    const inner = { ref: field.ref, accessor: null, sources: field.sources };
    node.fields.push(pbField('present', 1, { form: 'primitive', name: 'boolean' }, null, { sources: field.sources }));
    if (type.form === 'optional') node.fields.push(fieldFor('f0', 2, type.element, context, name + 'Value', inner, false, false));
    if (type.form === 'sequence') node.fields.push(fieldFor('f0', 2, type.element, context, name + 'Element', inner, true));
    if (type.form === 'map') {
      const entryName = name + 'Entry'; safeName(entryName, context);
      const entry = newNode('map-entry', type, field.ref, context, entryName, refs, field.sources);
      entry.fields.push(fieldFor('f0', 1, type.key, context, entryName + 'Key', inner));
      entry.fields.push(fieldFor('f1', 2, type.value, context, entryName + 'Value', inner));
      finish(entry);
      node.fields.push(pbField('f0', 2, type, entry.id, { repeated: true, ref: field.ref, sources: field.sources }));
    }
    return finish(node);
  }
  function ensureRoot(key) {
    const binding = rootBindings.get(key); if (!binding) reject('explicit protobuf root missing');
    if (completed.has(binding.id)) return completed.get(binding.id);
    if (pending.has(binding.id)) reject('recursive nominal protobuf graph'); pending.add(binding.id);
    const definition = definitions.get(key), context = binding.context;
    const kind = binding.role === 'value' ? definition.exact ? 'exact' : 'nominal' : binding.role;
    const node = newNode(kind, nominal(definition), binding.ref, context, binding.name,
      definition.refs ?? [definition.ref, ...definition.fields.flatMap(f => f.ref ? [f.ref] : [])], definition.sources);
    if (definition.exact) {
      node.exact = definition.exact;
      const codec = model.codecs.find(c => refKey(c.ref) === refKey(definition.ref));
      if (!codec) reject('exact serialization root requires admitted codec');
      node.codec = codec.descriptor;
    }
    definition.fields.forEach((field, i) => {
      node.fields.push(fieldFor('f' + i, i + 1, field.type, context, binding.name + 'Field' + i, field));
    });
    pending.delete(binding.id); return finish(node);
  }
  for (const context of model.contexts) {
    const ids = [];
    for (const binding of context.protobuf.messages) {
      const node = ensureRoot(rootKey(binding.ref, binding.role));
      roots.push({ role: binding.role, ref: binding.ref, nodeId: node.id }); ids.push(node.id);
    }
    contexts.push({ context: context.context, package: context.protobuf.package, protoPath: context.protoPath, converterPath: context.converter.path,
      nodeIds: nodes.filter(n => n.context === context.context).map(n => n.id), rootIds: ids });
  }
  return targetData({ contexts, nodes, roots, artifacts: model.artifacts.filter(a => ['protobuf', 'converter'].includes(a.role)) });
}
