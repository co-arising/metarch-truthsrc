// Knowledge → contract derivation for the proto-converter family (#30).
// Derives truthsrc.proto-converter-input/v1 from serializationModel with short
// intra-package Scala types. Pure and fail-closed (PC_DERIVATION).
import { serializationModel } from '../../generators/scala-cqrs-domain/serialization.mjs';
import { packageFor, pathFor, symbol, typeName } from '../../generators/scala-cqrs-domain/naming.mjs';

const SCHEMA = 'truthsrc.proto-converter-input/v1';
const fail = message => { throw new Error('PC_DERIVATION: ' + message); };

const dedupSources = sources => {
  const seen = new Set();
  const out = [];
  for (const s of sources) {
    const k = s.document + '#' + s.pointer;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ document: s.document, pointer: s.pointer });
  }
  return out;
};

const shorten = (typeStr, pkg) =>
  typeStr
    .replaceAll(pkg + '.domain.values.', '')
    .replaceAll(pkg + '.domain.', '');

export function deriveProtoConverters(products, options) {
  const layout = products?.['reference-layout'];
  const packages = options?.packages;
  if (!layout || !Array.isArray(packages)) fail('reference-layout and packages required');

  const nodes = serializationModel(products, options);
  const contexts = [];

  for (const context of layout.contexts) {
    const pkg = packageFor(context, options);
    const local = nodes.filter(n => n.pkg === pkg);
    const protoPath = 'app/protobuf/' + pkg.replaceAll('.', '_') + '_domain.proto';

    const carrierType = c => {
      if (c.form === 'node') {
        if (c.node.kind === 'map-entry') {
          return '(' + carrierType(c.node.fields[0].carrier) + ', ' + carrierType(c.node.fields[1].carrier) + ')';
        }
        return shorten(c.type ? typeName(c.type, options) : typeName(c.node.type, options), pkg);
      }
      return { string: 'String', boolean: 'Boolean', integer: 'Long', decimal: 'BigDecimal' }[c.form];
    };

    const scalaTypeFor = n => {
      if (n.kind === 'state') return symbol(n.aggregate.id) + 'State';
      if (n.kind === 'event') return symbol(n.event.owner[0]) + 'Protocol.' + symbol(n.event.id);
      if (n.kind === 'nominal' || n.kind === 'exact') return symbol(n.ref.id);
      if (n.kind === 'map-entry') return '(' + carrierType(n.fields[0].carrier) + ', ' + carrierType(n.fields[1].carrier) + ')';
      return shorten(typeName(n.type, options), pkg);
    };

    const derivedNodes = local.map(n => {
      const base = {
        name: n.name,
        kind: n.kind,
        scalaType: scalaTypeFor(n),
        fields: n.fields.map(f => ({
          name: symbol(f.name),
          carrierForm: f.carrier.form,
          ...(f.carrier.form === 'node' ? { carrierNode: f.carrier.node.name } : {}),
        })),
        sources: dedupSources(n.sources),
      };
      if (n.kind === 'exact') {
        const d = n.descriptor;
        const c = n.codec;
        base.exact = {
          domainName: symbol(n.ref.id),
          scale: d.scale,
          minor: c.format === 'minor-units-text',
          amountField: symbol(d.amountMember?.id ?? 'value'),
          unitField: d.unitMember ? symbol(d.unitMember.id) : null,
          representations: ['wire', 'po'].map(rep => {
            const r = c[rep];
            return {
              capital: rep === 'wire' ? 'Wire' : 'PO',
              typeName: shorten(typeName({ form: 'nominal', ref: r.ref }, options), pkg),
              amountField: r.amountMember ? symbol(r.amountMember.id) : null,
              unitField: r.unitMember ? symbol(r.unitMember.id) : null,
            };
          }),
        };
      }
      return base;
    });

    const deps = [...new Set([
      protoPath,
      ...layout.declarations
        .filter(d => d.ref.context === context && d.ref.kind === 'type')
        .map(d => pathFor(pkg, 'domain/values/' + d.ref.id + '.scala')),
      ...local.filter(n => n.kind === 'state').map(n => pathFor(pkg, 'domain/' + n.aggregate.id + 'State.scala')),
      ...local.filter(n => n.kind === 'event').map(n => pathFor(pkg, 'domain/' + n.event.owner[0] + 'Protocol.scala')),
    ])];

    contexts.push({ context, deps, nodes: derivedNodes });
  }

  if (!contexts.length) fail('no converter contexts derived');
  return {
    schemaVersion: SCHEMA,
    packages: packages.map(p => ({ context: p.context, package: p.package })),
    contexts,
  };
}
