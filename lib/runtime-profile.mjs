// Configurable runtime stack profile for Scala/Play/Akka CQRS generation.
// Defaults remain `net.imadz` / `0.3.0` / `0.2.1` so existing projects and
// curated goldens reproduce byte-identically, while allowing projects or
// callers to override organization, package prefixes, artifact coordinates,
// versions, and pinned SHA-256 digests without modifying generator logic.

const SAFE_PKG_RE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/u;
const SAFE_ARTIFACT_RE = /^[a-z][a-z0-9-]*$/u;
const SAFE_VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

export const DEFAULT_RUNTIME_PROFILE = Object.freeze({
  organization: 'net.imadz',
  packagePrefix: 'net.imadz',
  commonPackage: 'net.imadz.common',
  strictSagaPackage: 'net.imadz.infra.saga.strict',
  legacySagaPackage: 'net.imadz.infra.saga',
  monarchPackage: 'net.imadz.monarch',
  monarchPersistencePackage: 'net.imadz.monarch.persistence',
  commonCoreArtifact: 'common-core',
  commonCoreVersion: '0.2.1',
  scalaBinaryVersion: '2.13',
  sagaArtifact: 'saga-core',
  sagaVersion: '0.3.0',
  sagaSha256: '550fbd5cdb18a50d71a62f8f743d59f24ac1daa03f0aeb07c23c8355c2c0d862',
  sagaSymbolicVersion: 'strict-runtime-binding-v1-SNAPSHOT',
  monarchVersion: '0.3.0',
  monarchArtifacts: Object.freeze([
    Object.freeze({
      name: 'monarch-core',
      version: '0.3.0',
      sha256: '0c7a25eecae28d6f4b14a36c887511ffca5d2a755a5a618b281a271a66310b3b',
    }),
    Object.freeze({
      name: 'monarch-persistence',
      version: '0.3.0',
      sha256: 'f42f1b9946be8f5a659ef067a731eee093e81b7c2df9b3e1ad8abefef4971c55',
    }),
  ]),
});

export function parseMavenCoordinate(coordinate) {
  if (typeof coordinate !== 'string') return null;
  const parts = coordinate.split(':');
  if (parts.length !== 3) return null;
  const [organization, rawArtifact, version] = parts;
  if (!SAFE_PKG_RE.test(organization) || !SAFE_VERSION_RE.test(version)) return null;
  const scalaMatch = /^([a-z][a-z0-9-]*)_(\d+\.\d+)$/u.exec(rawArtifact);
  if (scalaMatch) {
    return {
      organization,
      artifact: scalaMatch[1],
      scalaBinaryVersion: scalaMatch[2],
      version,
    };
  }
  if (!SAFE_ARTIFACT_RE.test(rawArtifact)) return null;
  return { organization, artifact: rawArtifact, scalaBinaryVersion: null, version };
}

export function mavenJarRelPath(organization, artifact, scalaBinaryVersion, version) {
  const fullArtifact = scalaBinaryVersion ? `${artifact}_${scalaBinaryVersion}` : artifact;
  return `${organization.replaceAll('.', '/')}/${fullArtifact}/${version}/${fullArtifact}-${version}.jar`;
}

export function resolveRuntimeProfile(options = {}) {
  const raw = options?.runtimeProfile ?? options?.runtimeArtifact?.profile ?? {};
  const parsedCoord = parseMavenCoordinate(options?.runtimeArtifact?.coordinate);

  const organization = raw.organization ?? parsedCoord?.organization ?? DEFAULT_RUNTIME_PROFILE.organization;
  const packagePrefix = raw.packagePrefix ?? raw.organization ?? parsedCoord?.organization ?? DEFAULT_RUNTIME_PROFILE.packagePrefix;
  if (!SAFE_PKG_RE.test(organization)) throw new TypeError('invalid runtime organization: ' + organization);
  if (!SAFE_PKG_RE.test(packagePrefix)) throw new TypeError('invalid runtime packagePrefix: ' + packagePrefix);

  const commonPackage = raw.commonPackage ?? `${packagePrefix}.common`;
  const strictSagaPackage = raw.strictSagaPackage ?? `${packagePrefix}.infra.saga.strict`;
  const legacySagaPackage = raw.legacySagaPackage ?? `${packagePrefix}.infra.saga`;
  const monarchPackage = raw.monarchPackage ?? `${packagePrefix}.monarch`;
  const monarchPersistencePackage = raw.monarchPersistencePackage ?? `${monarchPackage}.persistence`;

  for (const [label, pkg] of [
    ['commonPackage', commonPackage],
    ['strictSagaPackage', strictSagaPackage],
    ['legacySagaPackage', legacySagaPackage],
    ['monarchPackage', monarchPackage],
    ['monarchPersistencePackage', monarchPersistencePackage],
  ]) {
    if (!SAFE_PKG_RE.test(pkg)) throw new TypeError(`invalid runtime ${label}: ${pkg}`);
  }

  const scalaBinaryVersion = raw.scalaBinaryVersion ?? parsedCoord?.scalaBinaryVersion ?? DEFAULT_RUNTIME_PROFILE.scalaBinaryVersion;
  const sagaArtifact = raw.sagaArtifact ?? parsedCoord?.artifact ?? DEFAULT_RUNTIME_PROFILE.sagaArtifact;
  const sagaVersion = raw.sagaVersion ?? parsedCoord?.version ?? DEFAULT_RUNTIME_PROFILE.sagaVersion;
  const sagaSha256 = raw.sagaSha256 ?? options?.runtimeArtifact?.sha256 ?? DEFAULT_RUNTIME_PROFILE.sagaSha256;
  const commonCoreArtifact = raw.commonCoreArtifact ?? DEFAULT_RUNTIME_PROFILE.commonCoreArtifact;
  const commonCoreVersion = raw.commonCoreVersion ?? DEFAULT_RUNTIME_PROFILE.commonCoreVersion;
  const monarchVersion = raw.monarchVersion ?? DEFAULT_RUNTIME_PROFILE.monarchVersion;

  const monarchSource = raw.monarchArtifacts ?? options?.runtimeArtifact?.monarchArtifacts ?? DEFAULT_RUNTIME_PROFILE.monarchArtifacts;
  const monarchArtifacts = Object.freeze(monarchSource.map(item => Object.freeze({
    organization: item.organization ?? organization,
    name: item.name,
    scalaBinaryVersion: item.scalaBinaryVersion ?? scalaBinaryVersion,
    version: item.version ?? monarchVersion,
    sha256: item.sha256,
  })));

  return Object.freeze({
    organization,
    packagePrefix,
    commonPackage,
    strictSagaPackage,
    legacySagaPackage,
    monarchPackage,
    monarchPersistencePackage,
    commonCoreArtifact,
    commonCoreVersion,
    scalaBinaryVersion,
    sagaArtifact,
    sagaVersion,
    sagaSha256,
    sagaSymbolicVersion: raw.sagaSymbolicVersion ?? DEFAULT_RUNTIME_PROFILE.sagaSymbolicVersion,
    monarchVersion,
    monarchArtifacts,
  });
}

export function runtimeFromContract(input) {
  return input?.runtimeProfile ? resolveRuntimeProfile({ runtimeProfile: input.runtimeProfile }) : DEFAULT_RUNTIME_PROFILE;
}
