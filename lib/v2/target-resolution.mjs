// Shared target auto-detection and resolution for co-arising 2.0 (dual-stack & Scala single-stack).
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function detectProjectTargets(rootDir) {
  if (!rootDir) return null;
  const absRoot = resolve(rootDir);
  const hasTs = existsSync(join(absRoot, 'generated-scaffold/ts'));
  const hasScala = existsSync(join(absRoot, 'generated-scaffold/scala'))
    || existsSync(join(absRoot, '.truthsrc/generated-scala-manifest.json'));
  if (hasScala && !hasTs) {
    return existsSync(join(absRoot, 'generated-scaffold/build.sbt'))
      || existsSync(join(absRoot, '.truthsrc/generated-scala-manifest.json'))
      ? ['scala-cqrs-play-service-v2']
      : ['scala'];
  }
  if (hasScala && hasTs) {
    return existsSync(join(absRoot, 'generated-scaffold/build.sbt'))
      || existsSync(join(absRoot, '.truthsrc/generated-scala-manifest.json'))
      ? ['typescript', 'scala-cqrs-play-service-v2']
      : ['typescript', 'scala'];
  }
  return null;
}

export function resolveEffectiveTargets({ explicitTargets = null, configTargets = null, rootDir = null } = {}) {
  if (Array.isArray(explicitTargets) && explicitTargets.length > 0) return explicitTargets;
  if (Array.isArray(configTargets) && configTargets.length > 0) return configTargets;
  return detectProjectTargets(rootDir) ?? ['typescript'];
}
