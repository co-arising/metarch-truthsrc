import { copyImmutableData } from '../immutable-data.mjs';

export const STRICT_SAGA_TARGET = copyImmutableData({
  artifact: 'net.imadz:saga-core_2.13:0.2.1-p23.20261027.1',
  artifactSha256: 'f20ad61eba670d2766cd39a1f75bd236351d0069b0480bb85d7335ffff93f8cf',
  artifactStatus: 'fixed-offline-candidate', apiMode: 'strict',
  definitionApi: 'net.imadz.infra.saga.strict.StrictSagaDefinition',
  coordinatorApi: 'net.imadz.infra.saga.strict.StrictSagaCoordinator',
  executionMode: 'static-serial-allTCC',
});
export const MONARCH_R2_ARTIFACTS = copyImmutableData([
  { artifact: 'net.imadz:monarch-persistence_2.13:0.3.0-dev.r2-20261106-dc168f96fa62',
    sha256: '2dea09f3c97b4832fd78552f546a1d5fb4f68d5b92c42cb3d4466101c59d21b0' },
  { artifact: 'net.imadz:monarch-core_2.13:0.2.1',
    sha256: '66223d37ab979b59cde557500f3da7aafaf532ddfe3268401c5f786093e0f971' },
]);
