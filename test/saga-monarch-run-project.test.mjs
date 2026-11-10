import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configureSagaMonarchVariant } from './fixtures/saga-monarch-variants.mjs';
import { compileTreeWithSources } from '../lib/compile.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { captureProject, projectCli } from '../lib/project/cli.mjs';
import { verifyProject } from '../lib/project/verify.mjs';

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'truthsrc-typed-run-project-'))), author = join(root, 'author');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(fileURLToPath(new URL('../scaffold/saga-monarch-project', import.meta.url)), author, { recursive: true });
  mkdirSync(join(author, 'truth/saga-monarch/contexts/inventory/pipelines'), { recursive: true });
  configureSagaMonarchVariant(author, 'retry');
  const project = join(author, 'truthsrc.project.json'), tree = join(author, 'truth/saga-monarch');
  assert.deepEqual(validateTree(tree).hard, []); assert.equal(roundtrip(tree).ok, true);
  const config = JSON.parse(readFileSync(project, 'utf8'));
  const documents = config.documents.map(doc => { const value = JSON.parse(readFileSync(join(author, doc.file), 'utf8'));
    return { id: doc.id, schemaVersion: value.schemaVersion, value }; });
  return { root, author, project, tree, config, documents,
    canonical: structuredClone(compileTreeWithSources(tree, { context: config.context }).canonical) };
}
const compile = f => compileProductSet(deriveProjectRequest(f.canonical, f.config, f.documents));

test('author-derived business Run is distinct from outer R2 execute/batch codec with exact sources', async t => {
  const f = fixture(t), compilation = compile(f);
  assert.deepEqual(compilation.diagnostics, []);
  const product = id => compilation.result.products.find(p => p.id === id).payload;
  const run = product('execution-contract').pipelines[0];
  assert.equal(run.binding.run.codecVersion, 'managed-codec-v1');
  assert.equal(product('saga-host-contract').workflow.technical.codecVersion, 'batch-codec-1');
  assert.equal(product('execution-contract').sourceMap['/pipelines/0/inputs/0'].document, 'inventory-domain');
  assert.equal(product('execution-contract').sourceMap['/pipelines/0/binding/run'].document, 'execution-binding');
  const captured = captureProject(f.project), out = join(f.root, 'generated');
  assert.equal(captured.implementations.members.length, 2);
  const planned = await projectCli('generate-project', ['--project', f.project, '--out', out, '--plan']);
  const text = planned.plan.entries.filter(e => e.path.endsWith('.scala')).map(e => e.content).join('\n');
  assert.match(text, /object ManagedCheckRunProtocol/);
  assert.match(text, /object ManagedCheckRun/);
  assert.doesNotMatch(text, /runConnectors: Map\[String, ExternalOperationPort\]/);
  assert.match(text, /managed-codec-v1/);
  assert.equal((await projectCli('generate-project', ['--project', f.project, '--out', out])).applied, true);
  assert.equal(verifyProject({ project: f.project, out }).passed, true);
});

for (const [label, mutate, code] of [
  ['missing input', f => f.canonical.workflows[0].areas[0].action.inputs.pop(), 'WORKFLOW_RUN_INPUT'],
  ['mistyped input', f => { f.canonical.workflows[0].areas[0].action.inputs[0].source = 'transaction-id'; }, 'WORKFLOW_RUN_INPUT'],
  ['unknown outcome', f => { f.canonical.workflows[0].areas[0].action.result.outcomes[0].code = 'guessed'; }, 'WORKFLOW_RUN_RESULT'],
  ['rejection as success', f => { f.canonical.workflows[0].areas[0].action.result.outcomes[1].result = 'succeeded'; }, 'WORKFLOW_RUN_RESULT'],
  ['unbound leaf', f => { f.documents.find(d => d.id === 'composition').value.root.runs[0].ports[0].implementation = 'missing'; }, 'SAGA_MONARCH_RUN_BINDING'],
]) test('public Run bridge rejects ' + label, t => {
  const f = fixture(t); mutate(f); const result = compile(f);
  assert.equal(result.result, null);
  assert.ok(result.diagnostics.some(d => d.code === code), JSON.stringify(result.diagnostics));
});
