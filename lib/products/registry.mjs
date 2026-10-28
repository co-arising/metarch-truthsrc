import { copyImmutableData } from '../immutable-data.mjs';

export const COMPILATION = 'truthsrc.product-compilation/v1';
export const PRODUCT_SET = 'truthsrc.semantic-product-set/v1';
export const ENVELOPE = 'truthsrc.semantic-product/v1';
export const COMPILER = Object.freeze({ id: 'truthsrc-semantic-products', version: '1' });
export const READINESS = Object.freeze({ level: 'static-contract-only', runnable: false, runtimeBindingVerified: false });
export function profileFor(id, version) {
  if (['artifact-contract', 'domain-external-events'].includes(id) && version === '2') return PROFILES[id + '@2'];
  if (['domain-decision', 'domain-dependencies', 'domain-folds'].includes(id) && ['2', '3', '4', '5'].includes(version)) return PROFILES[id + '@' + version] ?? null;
  if (!['reference-layout', 'domain-decision', 'exact-value-types', 'exact-value-codecs', 'domain-dependencies', 'domain-folds', 'saga-contract', 'execution-contract', 'saga-runtime-contract', 'domain-external-events', 'artifact-contract', 'saga-host-contract'].includes(id)) return null;
  const profile = PROFILES[id];
  return profile.version === version ? profile : null;
}

export const PROFILES = copyImmutableData({
  'saga-host-contract': {
    version: '1', payloadSchemaVersion: 'truthsrc.saga-host-contract/v1', capabilities: [{ id: 'finite-saga-host-contract', version: '1' }],
    roles: { canonical: 'truthsrc/v1', hostBinding: 'truthsrc.saga-host-binding/v1' },
    requires: [{ id: 'reference-layout', version: '1' }, { id: 'exact-value-types', version: '1' }, { id: 'saga-contract', version: '1' }, { id: 'saga-runtime-contract', version: '1' }, { id: 'execution-contract', version: '1' }, { id: 'domain-external-events', version: '2' }, { id: 'artifact-contract', version: '2' }], bindingRole: 'hostBinding', pointer: '/hosts',
  },
  'artifact-contract@2': {
    version: '2', payloadSchemaVersion: 'truthsrc.artifact-contract/v2', capabilities: [{ id: 'artifact-static-contract', version: '2' }],
    roles: { canonical: 'truthsrc/v1', artifactBinding: 'truthsrc.artifact-binding/v2' },
    requires: [{ id: 'reference-layout', version: '1' }], bindingRole: 'artifactBinding', pointer: '/artifacts',
  },
  'artifact-contract': {
    version: '1', payloadSchemaVersion: 'truthsrc.artifact-contract/v1', capabilities: [{ id: 'artifact-static-contract', version: '1' }],
    roles: { canonical: 'truthsrc/v1', artifactBinding: 'truthsrc.artifact-binding/v1' },
    requires: [{ id: 'reference-layout', version: '1' }], bindingRole: 'artifactBinding', pointer: '/artifacts',
  },
  'domain-external-events@2': {
    version: '2', payloadSchemaVersion: 'truthsrc.domain-external-events/v2', capabilities: [{ id: 'external-event-producers', version: '2' }],
    roles: { canonical: 'truthsrc/v1', externalEventBinding: 'truthsrc.domain-external-event-binding/v2' },
    requires: [{ id: 'reference-layout', version: '1' }], bindingRole: 'externalEventBinding', pointer: '/externalEvents',
  },
  'domain-external-events': {
    version: '1', payloadSchemaVersion: 'truthsrc.domain-external-events/v1', capabilities: [{ id: 'external-event-producers', version: '1' }],
    roles: { canonical: 'truthsrc/v1', externalEventBinding: 'truthsrc.domain-external-event-binding/v1' },
    requires: [{ id: 'reference-layout', version: '1' }], bindingRole: 'externalEventBinding', pointer: '/externalEvents',
  },
  'domain-dependencies@5': {
    version: '5', payloadSchemaVersion: 'truthsrc.domain-dependencies/v5', capabilities: [{ id: 'domain-dependencies', version: '5' }],
    roles: { canonical: 'truthsrc/v1', dependencyBinding: 'truthsrc.domain-dependency-binding/v5' },
    requires: [{ id: 'reference-layout', version: '1' }, { id: 'domain-decision', version: '3' }, { id: 'exact-value-types', version: '1' }, { id: 'domain-external-events', version: '2' }], bindingRole: 'dependencyBinding', pointer: '/dependencies',
  },
  'domain-folds@5': {
    version: '5', payloadSchemaVersion: 'truthsrc.domain-folds/v5', capabilities: [{ id: 'domain-folds', version: '5' }],
    roles: { canonical: 'truthsrc/v1', foldBinding: 'truthsrc.domain-fold-binding/v5' },
    requires: [{ id: 'reference-layout', version: '1' }, { id: 'domain-dependencies', version: '5' }, { id: 'exact-value-types', version: '1' }], bindingRole: 'foldBinding', pointer: '/folds',
  },
  'domain-dependencies@4': {
    version: '4', payloadSchemaVersion: 'truthsrc.domain-dependencies/v4', capabilities: [{ id: 'domain-dependencies', version: '4' }],
    roles: { canonical: 'truthsrc/v1', dependencyBinding: 'truthsrc.domain-dependency-binding/v4' },
    requires: [{ id: 'reference-layout', version: '1' }, { id: 'domain-decision', version: '3' }, { id: 'exact-value-types', version: '1' }, { id: 'domain-external-events', version: '1' }], bindingRole: 'dependencyBinding', pointer: '/dependencies',
  },
  'domain-folds@4': {
    version: '4', payloadSchemaVersion: 'truthsrc.domain-folds/v4', capabilities: [{ id: 'domain-folds', version: '4' }],
    roles: { canonical: 'truthsrc/v1', foldBinding: 'truthsrc.domain-fold-binding/v4' },
    requires: [{ id: 'reference-layout', version: '1' }, { id: 'domain-dependencies', version: '4' }, { id: 'exact-value-types', version: '1' }], bindingRole: 'foldBinding', pointer: '/folds',
  },
  'saga-contract': {
    version: '1', payloadSchemaVersion: 'truthsrc.saga-ir/v1', capabilities: [{ id: 'saga-static-contract', version: '1' }],
    roles: { canonical: 'truthsrc/v1', sagaBinding: 'truthsrc.saga-binding/v1' },
    requires: [], bindingRole: 'sagaBinding', pointer: '',
  },
  'execution-contract': {
    version: '1', payloadSchemaVersion: 'truthsrc.execution/v1', capabilities: [{ id: 'execution-static-contract', version: '1' }],
    roles: { canonical: 'truthsrc/v1', executionBinding: 'truthsrc.execution-binding/v1', sagaBinding: 'truthsrc.saga-binding/v1' },
    requires: [{ id: 'saga-contract', version: '1' }], bindingRole: 'executionBinding', pointer: '',
  },
  'saga-runtime-contract': {
    version: '1', payloadSchemaVersion: 'truthsrc.saga-runtime-contract/v3', capabilities: [{ id: 'saga-runtime-lowering', version: '3' }],
    roles: { canonical: 'truthsrc/v1', sagaBinding: 'truthsrc.saga-binding/v1', runtimeBinding: 'truthsrc.saga-runtime-binding/v2' },
    requires: [{ id: 'saga-contract', version: '1' }], bindingRole: 'runtimeBinding', pointer: '',
  },
  'domain-decision@3': {
    version: '3', payloadSchemaVersion: 'truthsrc.domain-decision/v3', capabilities: [{ id: 'ordered-domain-decision', version: '3' }],
    roles: { canonical: 'truthsrc/v1', semanticBinding: 'truthsrc.domain-semantic-binding/v3' },
    requires: [{ id: 'reference-layout', version: '1' }, { id: 'exact-value-types', version: '1' }], bindingRole: 'semanticBinding', pointer: '/decisions',
  },
  'domain-dependencies@3': {
    version: '3', payloadSchemaVersion: 'truthsrc.domain-dependencies/v3', capabilities: [{ id: 'domain-dependencies', version: '3' }],
    roles: { canonical: 'truthsrc/v1', dependencyBinding: 'truthsrc.domain-dependency-binding/v3' },
    requires: [{ id: 'reference-layout', version: '1' }, { id: 'domain-decision', version: '3' }, { id: 'exact-value-types', version: '1' }], bindingRole: 'dependencyBinding', pointer: '/dependencies',
  },
  'domain-folds@3': {
    version: '3', payloadSchemaVersion: 'truthsrc.domain-folds/v3', capabilities: [{ id: 'domain-folds', version: '3' }],
    roles: { canonical: 'truthsrc/v1', foldBinding: 'truthsrc.domain-fold-binding/v3' },
    requires: [{ id: 'reference-layout', version: '1' }, { id: 'domain-dependencies', version: '3' }, { id: 'exact-value-types', version: '1' }], bindingRole: 'foldBinding', pointer: '/folds',
  },
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
