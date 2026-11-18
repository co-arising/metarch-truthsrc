import { equal } from '../products/request.mjs';
import { CLASSIC_FAMILIES_V5 } from './compile.mjs';

export const CLASSIC_FULL_SCAFFOLD_PRODUCER = Symbol('classic-source-scaffold@5');
const product = { id: 'classic-architecture', version: '5', payloadSchemaVersion: 'truthsrc.classic-architecture/v5',
  capabilities: [{ id: 'classic-source-scaffold', version: '5' }] };
const manifest = {
  schemaVersion: 'truthsrc.product-generator/v1', name: 'scala-cqrs-classic-v5', version: '5',
  targetProfile: 'scala-cqrs-classic-scaffold@5', products: [product],
  producers: [{ id: 'classic-source-scaffold', version: '5', products: ['classic-architecture'], artifactKinds: [...CLASSIC_FAMILIES_V5] }],
  artifactKinds: [...CLASSIC_FAMILIES_V5], options: ['rootPackage', 'frameworkPackage', 'moduleName', 'generatorVersion', 'knowledgeRelease'],
};

export function isClassicFullScaffoldManifest(value) {
  return equal(value, manifest);
}
export function preservesClassicFullPlaceholders(target, implementation, products) {
  if (implementation?.[CLASSIC_FULL_SCAFFOLD_PRODUCER] !== true || !isClassicFullScaffoldManifest(target)) return false;
  if (products.length !== 1 || products[0].id !== product.id || products[0].version !== product.version) return false;
  return equal(products[0].payload.readiness, { level: 'classic-scaffold-only', runnable: false });
}
