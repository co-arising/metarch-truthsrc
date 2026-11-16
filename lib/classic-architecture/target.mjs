import { equal } from '../products/request.mjs';

// Only a trusted implementation can carry this marker; input JSON cannot enable it.
export const CLASSIC_SCAFFOLD_PRODUCER = Symbol('classic-aggregate-scaffold@1');
const kinds = ['application-protocol', 'command-helper', 'aggregate-behavior', 'domain-entity'];
const product = { id: 'classic-architecture', version: '1', payloadSchemaVersion: 'truthsrc.classic-architecture/v1',
  capabilities: [{ id: 'classic-aggregate-scaffold', version: '1' }] };
const manifest = {
  schemaVersion: 'truthsrc.product-generator/v1', name: 'scala-cqrs-classic', version: '1',
  targetProfile: 'scala-cqrs-classic-scaffold@1', products: [product],
  producers: [{ id: 'classic-aggregate-scaffold', version: '1', products: ['classic-architecture'], artifactKinds: kinds }],
  artifactKinds: kinds, options: ['rootPackage', 'frameworkPackage', 'moduleName', 'generatorVersion', 'knowledgeRelease'],
};

export function isClassicScaffoldManifest(value) {
  return equal(value, manifest);
}
export function preservesClassicPlaceholders(target, implementation, products) {
  if (implementation?.[CLASSIC_SCAFFOLD_PRODUCER] !== true || !isClassicScaffoldManifest(target)) return false;
  if (products.length !== 1 || products[0].id !== product.id || products[0].version !== product.version) return false;
  return equal(products[0].payload.readiness, { level: 'classic-scaffold-only', runnable: false });
}
