import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureProject } from '../lib/project/cli.mjs';
import { implementationBuildInputs } from '../lib/project/implementations.mjs';
import { emitAuthorDoc } from '../lib/author-surface.mjs';
import { slug } from '../lib/shared.mjs';
import { buildModels, productFootprint } from '../generators/scala-cqrs-module-seams-v1/build-models.mjs';
import { render } from '../generators/scala-cqrs-module-seams-v1/render.mjs';
import { generate } from '../generators/scala-cqrs-module-seams-v1/generate.mjs';
import { validateCodeMappings } from '../src/core/code-mappings.mjs';
import { projectRoot, ref } from './module-seams-fixture.mjs';

const manifest = JSON.parse(readFileSync(new URL('../generators/scala-cqrs-module-seams-v1/generator.json', import.meta.url)));
function fixture(t, edit = () => {}) {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'module-seams-template-review-')));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const author = join(temp, 'author'); cpSync(projectRoot, author, { recursive: true });
  const project = join(author, 'truthsrc.project.json'), config = JSON.parse(readFileSync(project));
  edit(config, author);
  writeFileSync(project, JSON.stringify(config, null, 2) + '\n');
  const captured = captureProject(project);
  assert.deepEqual(captured.validation.hard, []);
  assert.equal(captured.validation.roundtrip.ok, true);
  const input = { compilation: captured.compilation, options: config.options };
  const model = buildModels(input), outDir = join(temp, 'generated');
  const roots = implementationBuildInputs(captured.implementations, { sourceRoots: model.lowered.sourceRoots, handwritten: model.lowered.handwritten, outDir });
  return { model, roots, input: { ...input, manifest }, context: { implementations: captured.implementations, outDir } };
}
function fullPlan(f) {
  const result = generate(f.input, f.context);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.plan);
  assert.deepEqual(generate(f.input, f.context), result);
  return result.plan.entries;
}
function reachable(model, start) {
  const graph = new Map([...model.artifacts, ...model.support].map(a => [a.path, a.directDeps]));
  const seen = new Set([start]), pending = [...graph.get(start)];
  while (pending.length) {
    const path = pending.shift();
    if (seen.has(path)) continue;
    seen.add(path); pending.push(...graph.get(path));
  }
  seen.delete(start); return [...seen].sort();
}
for (const grouping of ['original', 'split-parcel', 'all-separate']) test('T1 public generation preserves complete dependencies: ' + grouping, t => {
  const f = fixture(t, config => {
    for (const file of config.options.valueFiles) if (grouping === 'all-separate' || grouping === 'split-parcel' && file.ref.id === 'Parcel') file.fileStem = file.ref.id;
  });
  const entries = fullPlan(f);
  for (const entry of entries) {
    assert.deepEqual([...entry.deps].sort(), reachable(f.model, entry.path), entry.path);
    assert.equal(new Set(entry.deps).size, entry.deps.length);
    assert.ok(!entry.deps.includes(entry.path)); validateCodeMappings(entry);
  }
  if (grouping === 'split-parcel') {
    const parcel = entries.find(e => e.path.endsWith('/values/Parcel.scala'));
    const group = entries.find(e => e.path.endsWith('/ParcelValues.scala'));
    assert.ok(parcel.deps.includes(group.path)); assert.ok(group.deps.includes(parcel.path));
  }
});
for (const [name, mutate, code] of [
  ['missing target', m => { m.support[0].directDeps = ['missing.scala']; }, 'MODULE_SEAMS_RENDER'],
  ['portable collision', m => { m.support[0].path = m.artifacts[0].path.toUpperCase(); }, 'MODULE_SEAMS_RENDER'],
  ['traversal', m => { m.support[0].path = '../escape.scala'; }, 'MODULE_SEAMS_PATH'],
  ['wrong kind', m => { m.support[0].kind = 'value-object'; }, 'MODULE_SEAMS_RENDER'],
]) test('T1 complete preflight precedes every template: ' + name, t => {
  const f = fixture(t), model = structuredClone(f.model);
  // If any template runs before the later malformed job is checked, this throws
  // a plain TypeError instead of the required graph/path diagnostic.
  model.artifacts.find(a => a.role === 'value').values = null;
  mutate(model);
  assert.throws(() => render(model, f.roots, productFootprint), e => e.diagnostic?.code === code);
});
function addSum(config, author, name) {
  const payload = { schemaVersion: 'truthsrc.signature-value/v1', name, shape: 'sum', variants: [{ name: 'Present', fields: [] }] };
  writeFileSync(join(author, config.tree, 'contexts/parcel/value-objects/' + slug(name) + '.vo.yaml'),
    emitAuthorDoc({ kind: 'value-object', name, seq: 9, payload }));
  config.options.valueFiles.push({ ref: ref('type', name), fileStem: name });
}
test('T2 author sum keeps its name while support suites use the verification package', t => {
  const f = fixture(t, (config, author) => addSum(config, author, 'ModuleSeamsValueShapeSpec'));
  const entries = fullPlan(f);
  const production = entries.find(e => e.path.endsWith('/domain/ModuleSeamsValueShapeSpec.scala'));
  assert.match(production.content, /sealed trait ModuleSeamsValueShapeSpec/);
  for (const support of f.model.support.filter(s => s.kind === 'generated-test')) {
    assert.equal(support.packageName, 'example.parcel.verification');
    assert.ok(support.path.includes('/example/parcel/verification/'));
  }
  const declarations = [...f.model.values, ...f.model.ports, ...f.model.lowered.target.components,
    ...f.model.support.filter(s => s.kind === 'generated-test')].map(s => s.packageName + '.' + s.name);
  assert.equal(new Set(declarations).size, declarations.length);
});
test('T2 root may share the suite short name without sharing its FQN', t => {
  const f = fixture(t, config => { config.options.names.find(n => n.role === 'composition').name = 'ModuleSeamsRootShapeSpec'; });
  fullPlan(f);
  assert.equal(f.model.root.packageName, 'example.parcel.composition');
  assert.equal(f.model.support.find(s => s.role === 'root-shape-test').packageName, 'example.parcel.verification');
});
test('T2 generated support follows a renamed context package without changing standard-library references', t => {
  const f = fixture(t, (config, author) => {
    config.options.packages[0].package = 'renamed.parcel';
    const file = join(author, 'bindings/module-seams.json'), binding = JSON.parse(readFileSync(file));
    binding.implementations.forEach(i => { i.symbol = i.symbol.replace('example.parcel.', 'renamed.parcel.'); });
    writeFileSync(file, JSON.stringify(binding, null, 2) + '\n');
  });
  const entries = fullPlan(f);
  assert.ok(f.model.support.filter(s => s.kind === 'generated-test').every(s => s.packageName === 'renamed.parcel.verification'));
  assert.ok(entries.some(e => e.content.includes('_root_.scala.concurrent.ExecutionContext')));
});
