// Knowledge → contract derivation for the curated proto-converter family (#30).
// Builds truthsrc.proto-converter-input/v1 directly from buildCuratedProtoModel.
// Pure and fail-closed (PC_DERIVATION).
import { buildCuratedProtoModel } from './proto-model.mjs';
import { pathFor } from '../../generators/scala-cqrs-domain/naming.mjs';

const SCHEMA = 'truthsrc.proto-converter-input/v1';
const fail = message => { throw new Error('PC_DERIVATION: ' + message); };

export function deriveProtoConverters(products, options) {
  const packages = options?.packages;
  if (!Array.isArray(packages)) fail('explicit packages required');
  const modelContexts = buildCuratedProtoModel(products, options);

  const contexts = modelContexts.map(ctx => {
    const pkg = ctx.package;
    const deps = [...new Set([
      ctx.sharedProtoFile,
      ...ctx.aggregates.map(a => a.protoFile),
      ...ctx.valueObjects.map(vo => pathFor(pkg, 'domain/values/' + vo.typeId + '.scala')),
      ...ctx.aggregates.map(a => pathFor(pkg, 'domain/entities/' + a.aggId + 'Entity.scala')),
      ...ctx.aggregates.map(a => pathFor(pkg, 'domain/events/' + a.aggId + 'Events.scala')),
    ])];
    return {
      context: ctx.context,
      deps,
      valueObjects: ctx.valueObjects,
      aggregates: ctx.aggregates,
    };
  });

  if (!contexts.length) fail('no converter contexts derived');
  return {
    schemaVersion: SCHEMA,
    packages: packages.map(p => ({ context: p.context, package: p.package })),
    contexts,
  };
}
