import { copyImmutableData } from '../immutable-data.mjs';
import { DEFAULT_RUNTIME_PROFILE, resolveRuntimeProfile } from '../runtime-profile.mjs';

export function strictSagaTarget(options) {
  const profile = options ? resolveRuntimeProfile(options) : DEFAULT_RUNTIME_PROFILE;
  return copyImmutableData({
    artifact: `${profile.organization}:${profile.sagaArtifact}_${profile.scalaBinaryVersion}:${profile.sagaVersion}`,
    artifactSha256: profile.sagaSha256,
    artifactStatus: 'published-maven-central',
    apiMode: 'strict',
    definitionApi: `${profile.strictSagaPackage}.StrictSagaDefinition`,
    coordinatorApi: `${profile.strictSagaPackage}.StrictSagaCoordinator`,
    executionMode: 'static-serial-allTCC',
  });
}

export function monarchR2Artifacts(options) {
  const profile = options ? resolveRuntimeProfile(options) : DEFAULT_RUNTIME_PROFILE;
  const byName = name => profile.monarchArtifacts.find(a => a.name === name);
  const ordered = [byName('monarch-persistence'), byName('monarch-core')].filter(Boolean);
  return copyImmutableData(ordered.map(item => ({
    artifact: `${item.organization ?? profile.organization}:${item.name}_${item.scalaBinaryVersion ?? profile.scalaBinaryVersion}:${item.version}`,
    sha256: item.sha256,
  })));
}

export const STRICT_SAGA_TARGET = strictSagaTarget();
export const MONARCH_R2_ARTIFACTS = monarchR2Artifacts();
