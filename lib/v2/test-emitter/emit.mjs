// Orchestrates emitting locked Gherkin .feature + executable target BDD oracles + SHA-256 manifest for Canonical Model v2.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { emitGherkinFeature } from '../../ears/emit-gherkin.mjs';
import { buildLockedManifest } from '../../ears/emitters/scala-scalatest.mjs';
import { emitExecutableTsApplicationSpec, emitExecutableTsDomainSpec } from './typescript-node-test.mjs';
import { emitExecutableScalaDomainSpec } from './scala-scalatest.mjs';

function adaptV2TestIrForGherkin(testIr) {
  return {
    ...testIr,
    scenarios: testIr.scenarios.map(sc => ({
      ...sc,
      examples: (sc.examples ?? []).map(ex => ({
        ...ex,
        witness: ex.witness?.scalars ?? {},
      })),
    })),
  };
}

export function emitV2ExecutableTests(canonicalV2, {
  outDir,
  targets = ['typescript'],
  packageName = 'example.v2',
} = {}) {
  const root = resolve(outDir);
  const testsRoot = join(root, 'generated-tests');
  const manifestEntries = [];
  const emitted = [];

  const writeLocked = (relUnderTests, content, kind, behavior) => {
    const dest = join(testsRoot, relUnderTests);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content, 'utf8');
    const sha256 = createHash('sha256').update(content).digest('hex');
    manifestEntries.push({
      relativePath: relative(testsRoot, dest),
      sha256,
      sourceFile: behavior.sourceFile,
      sourceSha256: behavior.testIr.meta.sourceSha256,
    });
    emitted.push({ kind, target: behavior.target, file: dest, relativePath: relUnderTests, sha256 });
  };

  for (const beh of canonicalV2.behaviors) {
    const gherkin = emitGherkinFeature(adaptV2TestIrForGherkin(beh.testIr));
    writeLocked(`features/${gherkin.path}`, gherkin.content, 'gherkin', beh);

    if (targets.includes('typescript')) {
      const tsSpec = beh.layer === 'application'
        ? emitExecutableTsApplicationSpec(canonicalV2, beh)
        : emitExecutableTsDomainSpec(canonicalV2, beh);
      writeLocked(tsSpec.path, tsSpec.content, 'typescript-node-test', beh);
    }

    if (targets.includes('scala') && beh.layer === 'domain') {
      const scSpec = emitExecutableScalaDomainSpec(canonicalV2, beh, { packageName });
      writeLocked(scSpec.path, scSpec.content, 'scala-scalatest', beh);
    }
  }

  const manifestPath = join(testsRoot, 'manifest.sha256.json');
  const manifest = buildLockedManifest(manifestEntries, { generatorVersion: 'co-arising-v2/2.0' });
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  return {
    schemaVersion: 'co-arising.emit-tests-v2/v1',
    canonicalSha256: canonicalV2.canonicalSha256,
    targets,
    manifestFile: manifestPath,
    manifestCount: manifestEntries.length,
    emitted,
  };
}
