import { declaration } from '../../lib/domain-products/values.mjs';
import { key, packageFor, pathFor, symbol, typeName } from '../scala-cqrs-domain/naming.mjs';

const q = JSON.stringify;
// Preserve a declared PID kind verbatim even when it needs a Scala quoted identifier.
const kindSymbol = value => /^[A-Za-z][A-Za-z0-9_-]*$/u.test(value) && value.includes('-') ? '`' + value + '`' : symbol(value);

/** The existing carrier, PB and adapter names are compatibility APIs, not new aliases. */
export function renderJournalDomain({ products, options }, pkg, store, source) {
  const layout = products['reference-layout'];
  const resolve = ref => declaration(ref, layout, source);
  const deps = new Set([pathFor(pkg, `infrastructure/projection/${store.id}Repository.scala`)]);
  const sources = [source], codeMappings = [];
  function text(value, type, seen = new Set()) {
    if (type.form === 'primitive' && type.name === 'string') return value;
    if (type.form === 'nominal' && !seen.has(key(type.ref))) {
      const next = new Set([...seen, key(type.ref)]);
      return text(value + '.value', resolve(type.ref).valueType, next);
    }
    throw new TypeError('journal identity requires an acyclic nominal text or primitive string carrier');
  }
  function fromText(value, type, seen = new Set()) {
    if (type.form === 'primitive' && type.name === 'string') return value;
    if (type.form === 'nominal' && !seen.has(key(type.ref))) {
      deps.add(pathFor(packageFor(type.ref.context, options), `domain/values/${type.ref.id}.scala`));
      return typeName(type, options) + '(' + fromText(value, resolve(type.ref).valueType, new Set([...seen, key(type.ref)])) + ')';
    }
    throw new TypeError('journal identity requires an acyclic nominal text or primitive string carrier');
  }
  const streams = store.streams.map(stream => {
    const aggregate = resolve(stream.aggregate), identity = resolve(stream.identity);
    const domainPackage = packageFor(aggregate.ref.context, options);
    const aggregateName = aggregate.ref.id;
    const state = domainPackage + '.domain.' + symbol(aggregateName + 'State');
    const converters = domainPackage + '.infrastructure.serialization.DomainConverters';
    const pb = domainPackage + '.infrastructure.proto.' + symbol(aggregateName + 'StatePB');
    for (const suffix of ['State', 'Protocol', 'EventHandler']) deps.add(pathFor(domainPackage, `domain/${aggregateName}${suffix}.scala`));
    deps.add(pathFor(domainPackage, `infrastructure/serialization/${aggregateName}Adapters.scala`));
    deps.add(pathFor(domainPackage, 'infrastructure/serialization/DomainConverters.scala'));
    deps.add('app/protobuf/' + domainPackage.replaceAll('.', '_') + '_domain.proto');
    sources.push(aggregate.source, identity.source);
    return { ...stream, aggregate, identity, domainPackage, aggregateName, state, converters, pb,
      method: kindSymbol(stream.kind + 'State'), ownership: kindSymbol(stream.kind),
      initial: fromText('row.resource', identity.valueType),
      nextIdentity: text('next.' + symbol(identity.ref.id), identity.valueType) };
  });
  let content = `package ${pkg}.infrastructure.projection

import scalapb.GeneratedMessage
import ${symbol(store.id)}Repository.{Row, State}

object ${symbol(store.id)}Domain {
`;
  for (const stream of streams) {
    const start = content.length;
    content += `  def ${stream.method}(row: Row): ${stream.state} = {
    require(row.kind == ${q(stream.kind)}, "stream kind mismatch")
    row.payload.map(bytes => ${stream.converters}.decode${stream.aggregateName}StatePB(${stream.pb}.parseFrom(bytes)))
      .getOrElse(${stream.state}.empty.copy(${symbol(stream.identity.ref.id)} = ${stream.initial}))
  }
`;
    const span = { start, end: content.length };
    codeMappings.push(...[stream.aggregate.source, stream.identity.source].map(source => ({ source, span, scope: span })));
  }
  content += '  trait Ownership {\n' + streams.map(stream => `    def ${stream.ownership}(row: Row, next: ${stream.state}): (Option[String], Option[String])\n`).join('') + `  }
  def fold(row: Row, event: Any, ownership: Ownership): State = row.kind match {
`;
  for (const stream of streams) {
    const start = content.length, eventMappings = [];
    content += `    case ${q(stream.kind)} =>
      val message = event match {
        case pb: GeneratedMessage => pb
        case _ => throw new IllegalArgumentException("domain journal must contain protobuf")
      }
      val next = ${stream.domainPackage}.infrastructure.serialization.${symbol(stream.aggregateName + 'EventAdapter')}
        .fromJournal(message, message.getClass.getSimpleName).events.foldLeft(${stream.method}(row)) { (state, event) =>
`;
    if (stream.eventIdentities.length) {
      content += '          event match {\n';
      for (const mapping of stream.eventIdentities) {
        const event = resolve(mapping.event), field = resolve(mapping.field);
        const eventStart = content.length;
        content += `            case value: ${stream.domainPackage}.domain.${symbol(stream.aggregateName + 'Protocol')}.${symbol(event.ref.id)} =>
              require(${text('value.' + symbol(field.ref.id), field.valueType)} == row.resource, ${q(stream.kind + ' event identity mismatch')})
`;
        sources.push(event.source, field.source);
        const span = { start: eventStart, end: content.length };
        eventMappings.push(...[event.source, field.source].map(source => ({ source, span })));
      }
      content += '            case _ => ()\n          }\n';
    }
    content += `          ${stream.domainPackage}.domain.${symbol(stream.aggregateName + 'EventHandler')}(state, event)
        }
      require(${stream.allowEmptyIdentity ? stream.nextIdentity + '.isEmpty || ' : ''}${stream.nextIdentity} == row.resource, ${q(stream.kind + ' identity mismatch')})
      val (account, principal) = ownership.${stream.ownership}(row, next)
      State(Some(${stream.converters}.encode${stream.aggregateName}StatePB(next).toByteArray), account, principal)
`;
    const span = { start, end: content.length };
    codeMappings.push({ source: stream.aggregate.source, span, scope: span }, ...eventMappings.map(mapping => ({ ...mapping, scope: span })));
  }
  if (store.technicalKinds.length) content += `    case ${store.technicalKinds.map(q).join(' | ')} => State(None, None, None)
`;
  content += `    case _ => throw new IllegalArgumentException("unrecognized persistence kind")
  }
}
`;
  return { content, deps: [...deps], sources, codeMappings };
}
