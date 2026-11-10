import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { captureProject, projectCli } from '../lib/project/cli.mjs';
import { verifyProject } from '../lib/project/verify.mjs';
import { matchOutputContracts } from '../lib/artifact-docs/capabilities.mjs';
import { jsonBytes, normalizedPath, sha256 } from '../lib/artifact-docs/io.mjs';

export function sagaMonarchInputs(captured) {
  const base = dirname(captured.file);
  return [
    { name: 'request', sha256: sha256(jsonBytes(captured.request)) },
    { name: 'options', sha256: sha256(jsonBytes(captured.config.options)) },
    ...captured.sources.filter(source => source.file).map(source => ({
      name: 'project-file:' + normalizedPath(relative(base, source.file)), sha256: source.sha256,
    })).sort((a, b) => a.name.localeCompare(b.name, 'en')),
  ];
}

export async function observeSagaMonarchCapability(catalog, { author, destination }) {
  const producer = catalog.producers.find(row => row.id === 'scala-cqrs-saga-monarch-v1');
  assert(producer, 'Saga/Monarch producer is not registered');
  mkdirSync(destination);
  const projectRoot = join(destination, 'author'); mkdirSync(projectRoot);
  for (const member of ['truth', 'bindings', 'implementations', 'truthsrc.project.json'])
    cpSync(join(author, member), join(projectRoot, member), { recursive: true, force: false, errorOnExist: true });
  const project = join(projectRoot, 'truthsrc.project.json'), out = join(destination, 'generated');
  const captured = captureProject(project);
  assert.deepEqual(captured.compilation.diagnostics, []);
  assert.equal(captured.compilation.result.products.length, 8);
  assert.deepEqual(captured.validation.hard, []); assert.equal(captured.validation.roundtrip.ok, true);
  const inputs = sagaMonarchInputs(captured);
  const args = ['--project', project, '--out', out];
  const planned = await projectCli('generate-project', [...args, '--plan']);
  const applied = await projectCli('generate-project', args);
  assert.equal(applied.applied, true);
  const verification = verifyProject({ project, out }); assert.equal(verification.passed, true);
  const hasRuns = captured.compilation.result.products.find(row => row.id === 'execution-contract').payload.pipelines.length > 0;
  const artifacts = planned.plan.entries.filter(entry => entry.kind !== 'project-evidence').flatMap(entry => {
    const bytes = readFileSync(join(out, entry.path)); assert.equal(bytes.toString('utf8'), entry.content);
    const eligible = matchOutputContracts(producer, entry, 'manifest'); assert(eligible.length, 'unmapped producer artifact: ' + entry.path);
    const contracts = eligible.filter(id => id !== 'typed-run' || hasRuns).sort();
    if (!contracts.length) return [];
    return [{ path: entry.path, kind: entry.kind, bytes: bytes.length, sha256: sha256(bytes), contracts }];
  });
  assert.equal((await projectCli('generate-project', [...args, '--update'])).result.written, 0);
  assert.deepEqual(sagaMonarchInputs(captureProject(project)), inputs);
  for (const artifact of artifacts) assert.equal(sha256(readFileSync(join(out, artifact.path))), artifact.sha256);
  return { producer: producer.id, project, out, inputs, artifacts, hasRuns, checks: [
    { name: 'sole-author-validation-and-roundtrip', passed: true },
    { name: 'eight-products-have-no-diagnostics', passed: true },
    { name: 'public-project-capture-graph-plan-writer', passed: true },
    { name: 'actual-path-kind-channel-and-conditional-contracts', passed: true },
    { name: 'source-verification-and-zero-source-write-regeneration', passed: true },
    { name: 'author-bindings-and-external-implementation-bytes-unchanged', passed: true },
  ] };
}
