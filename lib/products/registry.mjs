import { copyImmutableData } from '../immutable-data.mjs';

export const COMPILATION = 'truthsrc.product-compilation/v1';
export const PRODUCT_SET = 'truthsrc.semantic-product-set/v1';
export const ENVELOPE = 'truthsrc.semantic-product/v1';
export const COMPILER = Object.freeze({ id: 'truthsrc-semantic-products', version: '1' });
export const READINESS = Object.freeze({ level: 'static-contract-only', runnable: false, runtimeBindingVerified: false });
export function profileFor(id, version) {
  if (['domain-decision', 'domain-dependencies', 'domain-folds'].includes(id) && version === '2') return PROFILES[id + '@2'];
  if (!['reference-layout', 'domain-decision', 'exact-value-types', 'exact-value-codecs', 'domain-dependencies', 'domain-folds'].includes(id)) return null;
  const profile = PROFILES[id];
  return profile.version === version ? profile : null;
}

export const PROFILES = copyImmutableData({
  'domain-dependencies@2': {
    version: '2', payloadSchemaVersion: 'truthsrc.domain-dependencies/v2', capabilities: [{ id: 'domain-dependencies', version: '2' }],
    roles: { canonical: 'truthsrc/v1', dependencyBinding: 'truthsrc.domain-dependency-binding/v2' },
    requires: [{ id: 'reference-layout', version: '1' }, { id: 'domain-decision', version: '2' }, { id: 'exact-value-types', version: '1' }], bindingRole: 'dependencyBinding', pointer: '/dependencies',
  },
  'domain-folds@2': {
    version: '2', payloadSchemaVersion: 'truthsrc.domain-folds/v2', capabilities: [{ id: 'domain-folds', version: '2' }],
    roles: { canonical: 'truthsrc/v1', foldBinding: 'truthsrc.domain-fold-binding/v2' },
    requires: [{ id: 'reference-layout', version: '1' }, { id: 'domain-dependencies', version: '2' }, { id: 'exact-value-types', version: '1' }], bindingRole: 'foldBinding', pointer: '/folds',
  },
  'domain-dependencies': {
    version: '1', payloadSchemaVersion: 'truthsrc.domain-dependencies/v1', capabilities: [{ id: 'domain-dependencies', version: '1' }],
    roles: { canonical: 'truthsrc/v1', dependencyBinding: 'truthsrc.domain-dependency-binding/v1' },
    requires: [{ id: 'reference-layout', version: '1' }, { id: 'domain-decision', version: '1' }], bindingRole: 'dependencyBinding', pointer: '/dependencies',
  },
  'domain-folds': {
    version: '1', payloadSchemaVersion: 'truthsrc.domain-folds/v1', capabilities: [{ id: 'domain-folds', version: '1' }],
    roles: { canonical: 'truthsrc/v1', foldBinding: 'truthsrc.domain-fold-binding/v1' },
    requires: [{ id: 'reference-layout', version: '1' }, { id: 'domain-dependencies', version: '1' }, { id: 'exact-value-types', version: '1' }], bindingRole: 'foldBinding', pointer: '/folds',
  },
  'reference-layout': {
    version: '1', payloadSchemaVersion: 'truthsrc.reference-layout/v1',
    capabilities: [{ id: 'qualified-reference-layout', version: '1' }],
    roles: { canonical: 'truthsrc/v1', referenceBinding: 'truthsrc.reference-binding/v1' },
    requires: [], bindingRole: 'referenceBinding', pointer: '/layout',
  },
  'exact-value-types': {
    version: '1', payloadSchemaVersion: 'truthsrc.exact-value-types/v1', capabilities: [{ id: 'exact-value-types', version: '1' }],
    roles: { canonical: 'truthsrc/v1', exactTypeBinding: 'truthsrc.exact-type-binding/v1' },
    requires: [{ id: 'reference-layout', version: '1' }], bindingRole: 'exactTypeBinding', pointer: '/types',
  },
  'exact-value-codecs': {
    version: '1', payloadSchemaVersion: 'truthsrc.exact-value-codecs/v1', capabilities: [{ id: 'exact-value-codecs', version: '1' }],
    roles: { canonical: 'truthsrc/v1', exactCodecBinding: 'truthsrc.exact-codec-binding/v1' },
    requires: [{ id: 'reference-layout', version: '1' }, { id: 'exact-value-types', version: '1' }], bindingRole: 'exactCodecBinding', pointer: '/codecs',
  },
  'domain-decision@2': {
    version: '2', payloadSchemaVersion: 'truthsrc.domain-decision/v2', capabilities: [{ id: 'ordered-domain-decision', version: '2' }],
    roles: { canonical: 'truthsrc/v1', semanticBinding: 'truthsrc.domain-semantic-binding/v2' },
    requires: [{ id: 'reference-layout', version: '1' }, { id: 'exact-value-types', version: '1' }], bindingRole: 'semanticBinding', pointer: '/decisions',
  },
  'domain-decision': {
    version: '1', payloadSchemaVersion: 'truthsrc.domain-decision/v1',
    capabilities: [{ id: 'ordered-domain-decision', version: '1' }],
    roles: { canonical: 'truthsrc/v1', semanticBinding: 'truthsrc.domain-semantic-binding/v1' },
    requires: [{ id: 'reference-layout', version: '1' }], bindingRole: 'semanticBinding', pointer: '/decisions',
  },
});
