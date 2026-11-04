import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, readFileSync, readdirSync, lstatSync, writeFileSync, existsSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { initProject } from '../lib/project/init.mjs';
import { captureProject, projectCli } from '../lib/project/cli.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { compileExactTypes } from '../lib/value-products/exact-types.mjs';

const bin = fileURLToPath(new URL('../bin/truthsrc.js', import.meta.url));
const json = file => JSON.parse(readFileSync(file));
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
function snapshot(root) {
  if (!existsSync(root)) return null;
  return readdirSync(root).sort().flatMap(name => {
    const file = join(root, name);
    return lstatSync(file).isDirectory() ? snapshot(file).map(([p, h]) => [name + '/' + p, h])
      : [[name, createHash('sha256').update(readFileSync(file)).digest('hex')]];
  });
}
function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'truthsrc-project-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, ...initProject([join(root, 'project')]), out: join(root, 'source') };
}
const args = f => ['--project', f.project, '--out', f.out];

test('public CLI init, compile, plan, apply and repeat leave inputs unchanged and anchor actual files', async t => {
  const f = fixture(t), before = snapshot(f.root);
  const compile = spawnSync(process.execPath, [bin, 'compile-project', '--project', f.project], { cwd: '/', encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(compile.status, 0, compile.stderr);
  assert.equal(JSON.parse(compile.stdout).compilation.result.products.length, 7);
  const planned = await projectCli('generate-project', [...args(f), '--plan']);
  assert.equal(planned.applied, false);
  assert.equal(existsSync(f.out), false);
  assert.deepEqual(snapshot(f.root), before);
  const result = await projectCli('generate-project', args(f));
  assert.equal(result.applied, true);
  assert.equal(result.result.total, planned.plan.entries.length);
  for (const entry of planned.plan.entries) assert.equal(readFileSync(join(f.out, entry.path), 'utf8'), entry.content);
  const anchors = json(join(f.out, 'anchors.json'));
  assert.ok(Object.keys(anchors.anchors).length);
  for (const location of Object.values(anchors.anchors).flat()) {
    assert.equal(location.status, 'source-verified');
    assert.equal(location.verification.level, 'file');
    assert.equal(location.fingerprint, 'sha256:' + createHash('sha256').update(readFileSync(join(f.out, location.file))).digest('hex'));
    assert.ok(!location.file.startsWith('.truthsrc/'));
  }
  const generated = snapshot(f.out);
  const repeat = await projectCli('generate-project', args(f));
  assert.equal(repeat.result.written, 0);
  assert.deepEqual(snapshot(f.out), generated);
  assert.deepEqual(snapshot(f.root), before);
  const initAgain = spawnSync(process.execPath, [bin, 'init', f.root], { encoding: 'utf8' });
  assert.equal(initAgain.status, 2);
  assert.match(initAgain.stderr, /already exists/);
});

test('source and options change derived products and plan; existing output is never forcibly replaced', async t => {
  const f = fixture(t), original = captureProject(f.project);
  await projectCli('generate-project', args(f));
  const existing = snapshot(f.out), config = json(f.project);
  config.options.packages[0].package = 'other.domain'; save(f.project, config);
  const planned = await projectCli('generate-project', [...args(f), '--plan']);
  assert.ok(planned.plan.entries.some(e => e.content.includes('package other.domain')));
  assert.deepEqual(snapshot(f.out), existing);
  await assert.rejects(projectCli('generate-project', args(f)), /refusing to overwrite/);
  assert.deepEqual(snapshot(f.out), existing);
  const atom = join(f.tree, 'aggregates/counter/aggregate.yaml');
  const text = readFileSync(atom, 'utf8');
  assert.ok(text.includes('"default": "0"'));
  writeFileSync(atom, text.replace('"default": "0"', '"default": "1"'));
  const changed = captureProject(f.project);
  assert.notDeepEqual(changed.compilation, original.compilation);
  assert.equal(changed.compilation.result.products.find(p => p.id === 'domain-folds').payload.defaults[1].value, '1');
});

test('unknown or invalid configuration fails before touching target', async t => {
  const f = fixture(t), config = json(f.project);
  mkdirSync(f.out); writeFileSync(join(f.out, 'keep'), 'user data');
  const before = snapshot(f.out);
  const changes = [
    c => { c.extra = true; }, c => { c.schemaVersion = 'unknown'; },
    c => { c.generator = '../scala-cqrs-domain-v2'; }, c => { c.generator = 'missing'; },
    c => { c.generator = 'pipeline'; }, c => { c.options.unknown = true; },
    c => { c.products[0].version = '99'; }, c => { c.products.pop(); },
    c => { c.roles.semanticBinding = 'manual'; },
    c => { c.documents = [{ id: 'bad', file: 'absent.json' }]; },
    c => { c.tree = 'missing-tree'; }, c => { c.exactTypes = [{ source: {} }]; },
  ];
  for (const change of changes) {
    const c = structuredClone(config); change(c); save(f.project, c);
    await assert.rejects(projectCli('generate-project', args(f)));
    assert.deepEqual(snapshot(f.out), before);
  }
  save(f.project, config);
  for (const flags of [[], ['--project'], [...args(f), '--plan', '--plan'], [...args(f), '--direct'], [...args(f), '--project', f.project]])
    await assert.rejects(projectCli('generate-project', flags));
  assert.deepEqual(snapshot(f.out), before);
});

test('input/output overlap and symlink aliases fail before target writes', async t => {
  const f = fixture(t);
  for (const out of [f.tree, join(f.tree, 'generated'), f.project, f.root, join(f.root, '..')])
    await assert.rejects(projectCli('generate-project', ['--project', f.project, '--out', out]), /disjoint|contain/);
  const alias = join(f.root, 'alias'); symlinkSync(f.tree, alias);
  await assert.rejects(projectCli('generate-project', ['--project', f.project, '--out', alias]), /symlink/);
  await assert.rejects(projectCli('generate-project', ['--project', f.project, '--out', alias + '/../new']), /symlink/);
  const config = json(f.project); config.tree = 'alias'; save(f.project, config);
  assert.throws(() => captureProject(f.project), /symlink/);
  assert.equal(existsSync(f.out), false);
});

test('omitted empty families are supported, malformed families and unresolved external production still refuse', t => {
  const f = fixture(t), captured = captureProject(f.project), { canonical, config } = captured;
  assert.equal(Object.hasOwn(canonical, 'hostComputations'), false);
  assert.equal(Object.hasOwn(canonical, 'externalEventProducers'), false);
  for (const key of ['hostComputations', 'externalEventProducers']) {
    for (const value of [null, {}, '']) {
      const changed = structuredClone(canonical); changed[key] = value;
      assert.throws(() => deriveProjectRequest(changed, config, []));
    }
  }
  const changed = structuredClone(canonical);
  changed.aggregates[0].commands[0].produces = [];
  assert.throws(() => deriveProjectRequest(changed, config, []), /external event/);
  const request = structuredClone(captured.request);
  request.documents.find(d => d.id === 'dependencies').value.dependencies.commands[0].events = [];
  assert.equal(compileProductSet(request).result, null);
});

test('business context-shaped literals are not references; real declaration conflicts fail for every selection', t => {
  const f = fixture(t), { canonical, config } = captureProject(f.project);
  const value = structuredClone(canonical);
  value.valueObjects = [{ name: 'ExternalKey', context: config.context, fields: [
    { name: 'context', dataType: 'String' }, { name: 'kind', dataType: 'String' },
    { name: 'owner', dataType: 'List[String]' }, { name: 'id', dataType: 'String' },
  ] }];
  value.aggregates[0].stateFields.push({ name: 'remote', dataType: 'ExternalKey', default: { context: 'remote-system', kind: 'order', owner: [], id: '42' } });
  const request = deriveProjectRequest(value, config, []);
  assert.deepEqual(compileProductSet(request).diagnostics, []);
  const missing = structuredClone(canonical); delete missing.aggregates[0].context;
  assert.throws(() => deriveProjectRequest(missing, config, []), /explicit aggregate context/);
  const conflict = structuredClone(canonical);
  conflict.sagas = [{ id: 'other', name: 'Other', version: '1', context: 'other', payload: {} }];
  const only = { ...config, products: [{ id: 'saga-contract', version: '1' }], roles: { sagaBinding: 'sagas' } };
  assert.throws(() => deriveProjectRequest(conflict, only, []), /conflicts/);
});

test('filesystem-root and case aliases cannot hide input overlap', async t => {
  const f = fixture(t);
  await assert.rejects(projectCli('generate-project', ['--project', f.project, '--out', '/']), /disjoint/);
  const alias = f.tree.toUpperCase();
  if (existsSync(alias)) for (const flags of [[], ['--plan']])
    await assert.rejects(projectCli('generate-project', ['--project', f.project, '--out', alias, ...flags]), /case-fold/);
  assert.equal(existsSync(f.out), false);
});

test('empty exact types never admit a decimal hidden in a container', () => {
  const binding = { id: 'types', value: { schemaVersion: 'truthsrc.exact-type-binding/v1', types: [] } };
  for (const valueType of [
    { form: 'primitive', name: 'decimal' },
    { form: 'sequence', element: { form: 'primitive', name: 'decimal' } },
    { form: 'map', key: { form: 'primitive', name: 'string' }, value: { form: 'optional', element: { form: 'primitive', name: 'decimal' } } },
  ]) assert.throws(() => compileExactTypes(binding, {}, { declarations: [{ valueType }] }), e => e.diagnostic.code === 'EXACT_EMPTY');
});
