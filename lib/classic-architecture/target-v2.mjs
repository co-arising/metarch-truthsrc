import { equal } from '../products/request.mjs';

// Separate trusted marker and exact target: @2 never changes the @1 exemption.
export const CLASSIC_SOURCE_SCAFFOLD_PRODUCER = Symbol('classic-source-scaffold@2');
const kinds = ['application-protocol', 'command-helper', 'aggregate-behavior', 'domain-entity',
  'value-object', 'invariant-rule', 'event-handler'];
const product = { id: 'classic-architecture', version: '2', payloadSchemaVersion: 'truthsrc.classic-architecture/v2',
  capabilities: [{ id: 'classic-source-scaffold', version: '2' }] };
const manifest = {
  schemaVersion: 'truthsrc.product-generator/v1', name: 'scala-cqrs-classic-v2', version: '2',
  targetProfile: 'scala-cqrs-classic-scaffold@2', products: [product],
  producers: [{ id: 'classic-source-scaffold', version: '2', products: ['classic-architecture'], artifactKinds: kinds }],
  artifactKinds: kinds, options: ['rootPackage', 'frameworkPackage', 'moduleName', 'generatorVersion', 'knowledgeRelease'],
};

export function isClassicSourceScaffoldManifest(value) {
  return equal(value, manifest);
}
export function preservesClassicSourcePlaceholders(target, implementation, products) {
  if (implementation?.[CLASSIC_SOURCE_SCAFFOLD_PRODUCER] !== true || !isClassicSourceScaffoldManifest(target)) return false;
  if (products.length !== 1 || products[0].id !== product.id || products[0].version !== product.version) return false;
  return equal(products[0].payload.readiness, { level: 'classic-scaffold-only', runnable: false });
}
