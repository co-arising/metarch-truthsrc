import { equal } from '../products/request.mjs';

// @4 owns the repository source slice, without changing any older target.
export const CLASSIC_REPOSITORY_SCAFFOLD_PRODUCER = Symbol('classic-source-scaffold@4');
const kinds = ['application-protocol', 'command-helper', 'aggregate-behavior', 'domain-entity',
  'value-object', 'invariant-rule', 'event-handler', 'aggregate-root', 'aggregate-factory',
  'aggregate-repository-port', 'aggregate-repository-implementation'];
const product = { id: 'classic-architecture', version: '4', payloadSchemaVersion: 'truthsrc.classic-architecture/v4',
  capabilities: [{ id: 'classic-source-scaffold', version: '4' }] };
const manifest = {
  schemaVersion: 'truthsrc.product-generator/v1', name: 'scala-cqrs-classic-v4', version: '4',
  targetProfile: 'scala-cqrs-classic-scaffold@4', products: [product],
  producers: [{ id: 'classic-source-scaffold', version: '4', products: ['classic-architecture'], artifactKinds: kinds }],
  artifactKinds: kinds, options: ['rootPackage', 'frameworkPackage', 'moduleName', 'generatorVersion', 'knowledgeRelease'],
};

export function isClassicRepositoryScaffoldManifest(value) {
  return equal(value, manifest);
}
export function preservesClassicRepositoryPlaceholders(target, implementation, products) {
  if (implementation?.[CLASSIC_REPOSITORY_SCAFFOLD_PRODUCER] !== true || !isClassicRepositoryScaffoldManifest(target)) return false;
  if (products.length !== 1 || products[0].id !== product.id || products[0].version !== product.version) return false;
  return equal(products[0].payload.readiness, { level: 'classic-scaffold-only', runnable: false });
}
