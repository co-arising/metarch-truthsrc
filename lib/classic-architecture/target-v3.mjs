import { equal } from '../products/request.mjs';

// @3 extends the ordinary source packet without widening either older target.
export const CLASSIC_AGGREGATE_SCAFFOLD_PRODUCER = Symbol('classic-source-scaffold@3');
const kinds = ['application-protocol', 'command-helper', 'aggregate-behavior', 'domain-entity',
  'value-object', 'invariant-rule', 'event-handler', 'aggregate-root', 'aggregate-factory'];
const product = { id: 'classic-architecture', version: '3', payloadSchemaVersion: 'truthsrc.classic-architecture/v3',
  capabilities: [{ id: 'classic-source-scaffold', version: '3' }] };
const manifest = {
  schemaVersion: 'truthsrc.product-generator/v1', name: 'scala-cqrs-classic-v3', version: '3',
  targetProfile: 'scala-cqrs-classic-scaffold@3', products: [product],
  producers: [{ id: 'classic-source-scaffold', version: '3', products: ['classic-architecture'], artifactKinds: kinds }],
  artifactKinds: kinds, options: ['rootPackage', 'frameworkPackage', 'moduleName', 'generatorVersion', 'knowledgeRelease'],
};

export function isClassicAggregateScaffoldManifest(value) {
  return equal(value, manifest);
}
export function preservesClassicAggregatePlaceholders(target, implementation, products) {
  if (implementation?.[CLASSIC_AGGREGATE_SCAFFOLD_PRODUCER] !== true || !isClassicAggregateScaffoldManifest(target)) return false;
  if (products.length !== 1 || products[0].id !== product.id || products[0].version !== product.version) return false;
  return equal(products[0].payload.readiness, { level: 'classic-scaffold-only', runnable: false });
}
