import { refKey } from '../../lib/domain-products/references.mjs';
import { resolveName } from '../../lib/scala-target/naming.mjs';
import { MODULAR_CANDIDATE } from '../../lib/scala-target/profiles.mjs';
import { localType } from './templates/values.mjs';

/** The existing public converter ABI, resolved once without rendering Scala. */
export function converterAbi(context, serialization, model) {
  const domain = model.contexts.find(row => row.context === context.context);
  const nodes = new Map(serialization.nodes.map(node => [node.id, node]));
  const roots = serialization.roots.filter(root => nodes.get(root.nodeId)?.context === context.context);
  const aggregates = model.aggregates.filter(row => row.ref.context === context.context);
  const eventRows = aggregates.flatMap(aggregate => aggregate.protocol.events.map(event => ({ aggregate, event })));
  const glueNames = ['DomainConverters', 'ExactValueCodecs'];
  const occupied = new Set([...glueNames, ...model.values.filter(row => row.ref.context === context.context).map(row => row.name), ...aggregates.map(row => row.state.name)]);
  const eventNames = new Map();
  for (const { aggregate, event } of eventRows) {
    const duplicate = occupied.has(event.name) || eventRows.filter(row => row.event.name === event.name).length > 1;
    const name = duplicate ? aggregate.protocol.name + event.name : event.identifier;
    const qualified = duplicate && occupied.has(name);
    eventNames.set(refKey(event.ref), qualified ? event.fqn : name);
    if (!qualified) occupied.add(name);
  }
  const blocked = [...glueNames, ...aggregates.map(row => row.state.name), ...eventNames.values()];
  const converterType = type => localType(type, [domain.package + '.domain.values', domain.package + '.domain'], blocked);
  const rootNames = new Map(), rootTypes = new Map();
  for (const root of roots) {
    const node = nodes.get(root.nodeId);
    if (root.role === 'event') {
      const row = eventRows.find(row => refKey(row.event.ref) === refKey(root.ref));
      if (!row) throw new TypeError('converter event declaration is missing');
      const rawName = row.aggregate.ref.id;
      const aggregateName = /^[A-Za-z][A-Za-z0-9]*$/.test(rawName) ? rawName : /^[A-Za-z][A-Za-z0-9_ -]*$/.test(rawName) ?
        resolveName({ profile: MODULAR_CANDIDATE, knowledgeId: refKey(row.aggregate.ref), scope: context.package + ':event-converter',
          space: 'scala-type', spelling: rawName, binding: null, prefix: [], suffix: [] }).name : row.aggregate.protocol.name;
      rootNames.set(node.id, aggregateName + row.event.name);
      rootTypes.set(node.id, eventNames.get(refKey(row.event.ref)));
    } else {
      rootNames.set(node.id, node.type.name);
      rootTypes.set(node.id, root.role === 'value' ? converterType(node.type) : glueNames.includes(node.type.name) ? node.type.fqn : node.type.identifier);
    }
  }
  const signatures = roots.map(root => JSON.stringify([rootNames.get(root.nodeId), nodes.get(root.nodeId).type.fqn]));
  if (new Set(signatures).size !== signatures.length) throw new TypeError('converter public method signature collision');
  const methodName = node => rootNames.get(node.id) ?? node.name;
  const typeName = node => rootTypes.get(node.id) ?? converterType(node.type);
  return { domain, nodes, roots, aggregates, eventRows, glueNames, occupied, eventNames, converterType, methodName, typeName,
    registrations: roots.map(root => {
      const node = nodes.get(root.nodeId);
      return { ref: root.ref, role: root.role, nodeId: node.id, domainType: node.type.fqn, protobufType: node.fqn,
        encode: 'encode' + methodName(node), decode: 'decode' + methodName(node) };
    }) };
}
