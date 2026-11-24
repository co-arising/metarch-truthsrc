// Knowledge → contract derivation for the proto-schema family (#29).
// Derives truthsrc.proto-schema-input/v1 for domain, execution, host, and
// effect protobuf schemas. Pure and fail-closed (PS_DERIVATION).
import { serializationModel } from '../../generators/scala-cqrs-domain/serialization.mjs';
import { packageFor } from '../../generators/scala-cqrs-domain/naming.mjs';

const SCHEMA = 'truthsrc.proto-schema-input/v1';
const PRIMITIVE = Object.freeze({ string: 'string', boolean: 'bool', integer: 'sint64', decimal: 'string' });
const fail = message => { throw new Error('PS_DERIVATION: ' + message); };

const dedupSources = sources => {
  const seen = new Set();
  const out = [];
  for (const s of sources) {
    if (!s || typeof s.document !== 'string' || typeof s.pointer !== 'string') fail('invalid source entry');
    const k = s.document + '#' + s.pointer;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ document: s.document, pointer: s.pointer });
  }
  return out;
};

export function deriveDomainProtoSchemas(products, options) {
  const nodes = serializationModel(products, options);
  const pkgs = [...new Set(nodes.map(n => n.pkg))];
  const files = pkgs.map(pkg => {
    const local = nodes.filter(n => n.pkg === pkg);
    const messages = local.map(n => {
      const fields = [];
      if (n.kind === 'optional') fields.push({ modifier: '', type: 'bool', name: 'present', number: 1 });
      n.fields.forEach((f, i) => {
        const pbType = f.carrier.form === 'node' ? f.carrier.node.name : PRIMITIVE[f.carrier.form];
        if (!pbType) fail('unsupported carrier form: ' + f.carrier.form);
        fields.push({
          modifier: f.repeated ? 'repeated' : '',
          type: pbType,
          name: 'f' + i,
          number: i + (n.kind === 'optional' ? 2 : 1),
        });
      });
      return { name: n.name, fields };
    });
    return {
      path: 'app/protobuf/' + pkg.replaceAll('.', '_') + '_domain.proto',
      kind: 'proto',
      packageName: pkg + '.infrastructure.proto',
      imports: ['scalapb/scalapb.proto'],
      messages,
      deps: [],
      sources: dedupSources(local.flatMap(n => n.sources)),
    };
  });
  if (!files.length) fail('no domain proto schemas derived');
  return { schemaVersion: SCHEMA, files };
}

export function deriveExecutionProtoSchemas(products, options) {
  const layout = products?.['reference-layout'];
  const pipelines = products?.['execution-contract']?.pipelines;
  if (!layout || !Array.isArray(pipelines)) fail('reference-layout and execution-contract required');
  const files = pipelines.map(p => {
    const declarations = layout.declarations.filter(d => d.ref.kind === 'pipeline' && d.ref.id === p.id);
    if (declarations.length !== 1) fail('exactly one pipeline declaration required for ' + p.id);
    const declaration = declarations[0];
    const context = declaration.ref.context;
    const pkg = packageFor(context, options);
    const name = p.id.replaceAll('-', '_') + 'Execution';
    const protoName = name.replaceAll('_', '') + 'StatePB';
    const resolve = id => {
      const pin = p.binding.types.find(t => t.id === id);
      if (!pin) fail('missing execution type binding: ' + id);
      const rows = layout.declarations.filter(d => d.ref.context === context && d.ref.kind === 'type' && d.ref.id === id);
      if (rows.length === 1) return { form: 'nominal', id };
      const runtime = (products['saga-runtime-contract']?.sagas ?? []).flatMap(s => s.args.types).filter(t => t.id === id);
      if (runtime.length && runtime.every(t => t.kind === 'integer' && t.canonicalType === 'Int' && t.implementation === pin.implementation))
        return { form: 'primitive', name: 'integer' };
      if (runtime.length && runtime.every(t => t.kind === 'string' && t.canonicalType === 'String' && t.implementation === pin.implementation))
        return { form: 'primitive', name: 'string' };
      fail('unresolved execution type: ' + id);
    };
    const pbFields = p.inputs.map((inp, idx) => ({ name: 'input' + idx, id: inp.type }));
    let outIdx = 0;
    for (const step of p.steps) {
      for (const w of step.writes) pbFields.push({ name: 'output' + outIdx++, id: w.type });
    }
    const fields = [{ modifier: '', type: 'string', name: 'planversion', number: 1 }];
    pbFields.forEach((f, idx) => {
      const resolved = resolve(f.id);
      if (resolved.form === 'nominal') {
        fields.push({ modifier: '', type: '.' + pkg + '.infrastructure.proto.' + f.id + 'PB', name: f.name, number: idx + 2 });
      } else {
        fields.push({ modifier: 'optional', type: resolved.name === 'string' ? 'string' : 'int64', name: f.name, number: idx + 2 });
      }
    });
    const domainProto = pkg.replaceAll('.', '_') + '_domain.proto';
    return {
      path: 'app/protobuf/' + p.id.replaceAll('-', '_') + '_execution.proto',
      kind: 'proto',
      packageName: pkg + '.infrastructure.executionproto',
      imports: ['scalapb/scalapb.proto', domainProto],
      messages: [{ name: protoName, fields }],
      deps: ['app/protobuf/' + domainProto],
      sources: dedupSources([declaration.source]),
    };
  });
  return { schemaVersion: SCHEMA, files };
}

export function deriveHostProtoSchemas(products, options) {
  const hosts = products?.['saga-host-contract']?.hosts;
  if (!Array.isArray(hosts)) fail('saga-host-contract hosts required');
  const files = hosts.map(h => {
    const pkg = packageFor(h.saga.ref.context, options);
    const stem = h.id.replaceAll('-', '_');
    const protoName = stem.replaceAll('_', '') + 'HostEventPB';
    return {
      path: 'app/protobuf/' + stem + '_host.proto',
      kind: 'host-proto',
      packageName: pkg + '.infrastructure.hostproto',
      imports: ['scalapb/scalapb.proto'],
      messages: [{
        name: protoName,
        fields: [
          { modifier: '', type: 'string', name: 'kind', number: 1 },
          { modifier: '', type: 'bytes', name: 'original', number: 2 },
          { modifier: '', type: 'bytes', name: 'args', number: 3 },
          { modifier: '', type: 'string', name: 'operation', number: 4 },
          { modifier: '', type: 'bytes', name: 'identity', number: 5 },
        ],
      }],
      deps: [],
      sources: dedupSources([h.source]),
    };
  });
  return { schemaVersion: SCHEMA, files };
}

export function deriveEffectProtoSchemas(products, options) {
  const hosts = products?.['effect-host-contract']?.hosts;
  if (!Array.isArray(hosts)) fail('effect-host-contract hosts required');
  const files = hosts.map(h => {
    const pkg = packageFor(h.pipeline.ref.context, options);
    const stem = h.id.replaceAll('-', '_');
    const protoName = stem.replaceAll('_', '') + 'EffectHostEventPB';
    return {
      path: 'app/protobuf/' + stem + '_effect.proto',
      kind: 'effect-proto',
      packageName: pkg + '.infrastructure.effectproto',
      imports: ['scalapb/scalapb.proto'],
      messages: [{
        name: protoName,
        fields: [
          { modifier: '', type: 'string', name: 'version', number: 1 },
          { modifier: '', type: 'string', name: 'kind', number: 2 },
          { modifier: '', type: 'bytes', name: 'original', number: 3 },
          { modifier: '', type: 'string', name: 'operation', number: 4 },
          { modifier: '', type: 'bytes', name: 'observation', number: 5 },
          { modifier: '', type: 'string', name: 'authorization', number: 6 },
        ],
      }],
      deps: [],
      sources: dedupSources([h.source]),
    };
  });
  return { schemaVersion: SCHEMA, files };
}

export function deriveAllProtoSchemas(products, options) {
  const files = [
    ...deriveDomainProtoSchemas(products, options).files,
    ...deriveExecutionProtoSchemas(products, options).files,
    ...deriveHostProtoSchemas(products, options).files,
    ...deriveEffectProtoSchemas(products, options).files,
  ];
  return { schemaVersion: SCHEMA, files };
}
