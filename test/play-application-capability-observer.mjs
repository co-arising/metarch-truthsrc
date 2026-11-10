import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { captureProject, projectCli, assertUnchanged } from '../lib/project/cli.mjs';
import { verifyProject } from '../lib/project/verify.mjs';
import { matchOutputContracts } from '../lib/artifact-docs/capabilities.mjs';
import { jsonBytes, normalizedPath, sha256 } from '../lib/artifact-docs/io.mjs';

export function playInputs(captured) {
  const base = dirname(captured.file);
  return [{ name: 'request', sha256: sha256(jsonBytes(captured.request)) },
    { name: 'options', sha256: sha256(jsonBytes(captured.config.options)) },
    ...captured.sources.filter(s => s.file).map(s => ({ name: 'project-file:' + normalizedPath(relative(base, s.file)), sha256: s.sha256 }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'))];
}
export async function observePlayCapability(catalog, { author, destination }) {
  const producer = catalog.producers.find(p => p.id === 'scala-cqrs-play-application-v1'); assert(producer);
  mkdirSync(destination);
  const projectRoot = join(destination, 'author'); mkdirSync(projectRoot);
  for (const member of ['truth', 'bindings', 'implementations', 'truthsrc.project.json'])
    cpSync(join(author, member), join(projectRoot, member), { recursive: true, force: false, errorOnExist: true });
  const project = join(projectRoot, 'truthsrc.project.json'), out = join(destination, 'generated');
  const captured = captureProject(project);
  assert.deepEqual(captured.compilation.diagnostics, []); assert.equal(captured.compilation.result.products.length, 10);
  assert.deepEqual(captured.validation.hard, []); assert.equal(captured.validation.roundtrip.ok, true);
  const inputs = playInputs(captured), args = ['--project', project, '--out', out];
  const planned = await projectCli('generate-project', [...args, '--plan']);
  const applied = await projectCli('generate-project', args);
  assert(applied.applied); assert(verifyProject({ project, out }).passed);
  const artifacts = planned.plan.entries.filter(e => e.kind !== 'project-evidence').map(entry => {
    const bytes = readFileSync(join(out, entry.path)); assert.equal(bytes.toString('utf8'), entry.content);
    const contracts = matchOutputContracts(producer, entry, 'manifest').sort(); assert(contracts.length, 'unmapped artifact: ' + entry.path);
    return { path: entry.path, kind: entry.kind, bytes: bytes.length, sha256: sha256(bytes), contracts };
  });
  assert.equal((await projectCli('generate-project', [...args, '--update'])).result.written, 0);
  assertUnchanged(captured);
  return { producer: producer.id, project, out, inputs, artifacts, checks: [
    { name: 'sole-author-validate-and-roundtrip', passed: true },
    { name: 'exact-ten-product-source-lowering', passed: true },
    { name: 'public-capture-graph-plan-single-writer', passed: true },
    { name: 'actual-output-contracts-and-byte-equality', passed: true },
    { name: 'external-implementations-preserved-and-source-fresh', passed: true },
    { name: 'unchanged-regeneration-writes-zero-source', passed: true },
  ] };
}
