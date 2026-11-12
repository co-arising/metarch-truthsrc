import { copyImmutableData } from '../immutable-data.mjs';

export const STRICT_SAGA_TARGET = copyImmutableData({
  artifact: 'net.imadz:saga-core_2.13:0.3.0',
  artifactSha256: '550fbd5cdb18a50d71a62f8f743d59f24ac1daa03f0aeb07c23c8355c2c0d862',
  artifactStatus: 'published-maven-central',
  apiMode: 'strict',
  definitionApi: 'net.imadz.infra.saga.strict.StrictSagaDefinition',
  coordinatorApi: 'net.imadz.infra.saga.strict.StrictSagaCoordinator',
  executionMode: 'static-serial-allTCC',
});
export const MONARCH_R2_ARTIFACTS = copyImmutableData([
  { artifact: 'net.imadz:monarch-persistence_2.13:0.3.0',
    sha256: 'f42f1b9946be8f5a659ef067a731eee093e81b7c2df9b3e1ad8abefef4971c55' },
  { artifact: 'net.imadz:monarch-core_2.13:0.3.0',
    sha256: '0c7a25eecae28d6f4b14a36c887511ffca5d2a755a5a618b281a271a66310b3b' },
]);
