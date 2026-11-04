import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { initProject } from '../lib/project/init.mjs';
import { compileTree } from '../lib/compile.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { generate } from '../generators/scala-cqrs-domain-v2/generate.mjs';

const scaffold = fileURLToPath(new URL('../scaffold/local-project/', import.meta.url));
const initUrl = new URL('../lib/project/init.mjs', import.meta.url).href;
const sharedUrl = new URL('../lib/shared.mjs', import.meta.url).href;
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const sandbox = t => {
  // macOS /var and /tmp are symlink aliases; callers must use a physical parent.
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'truthsrc-project-init-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
};
function snapshot(root, relative = '') {
  return readdirSync(join(root, relative)).sort().flatMap(name => {
    const path = join(relative, name), full = join(root, path), stat = lstatSync(full);
    if (stat.isSymbolicLink()) return [[path, 'symlink', readlinkSync(full)]];
    if (stat.isDirectory()) return [[path, 'directory'], ...snapshot(root, path)];
    return [[path, 'file', readFileSync(full).toString('base64')]];
  });
}
function child(cwd, script) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

test('fresh init copies only the local scaffold and passes both gates without rewriting source', t => {
  const parent = sandbox(t), root = join(parent, 'counter project'), before = snapshot(scaffold);
  const result = initProject([root]);
  assert.deepEqual(Object.keys(result).sort(), ['project', 'root', 'tree', 'validation']);
  assert.equal(result.root, root);
  assert.equal(result.tree, join(root, 'tree'));
  assert.equal(result.project, join(root, 'truthsrc.project.json'));
  assert.deepEqual(result.validation, { hard: [], notices: [], roundtrip: { ok: true, atoms: 3 } });
  assert.deepEqual(snapshot(root), before);
  const initialized = snapshot(root), canonical = compileTree(result.tree);
  assert.deepEqual(validateTree(result.tree), { hard: [], notices: [] });
  assert.deepEqual(roundtrip(result.tree), { ok: true, atoms: 3 });
  assert.equal(compileTree(result.tree), canonical);
  assert.deepEqual(snapshot(root), initialized);
  assert.deepEqual(snapshot(scaffold), before);
  assert.equal(existsSync(join(root, 'canonical.json')), false);
  const domain = JSON.parse(canonical);
  assert.equal(domain.aggregates.length, 1);
  assert.equal(domain.aggregates[0].name, 'Counter');
  assert.equal(domain.aggregates[0].commands.length, 1);
  assert.equal(domain.aggregates[0].events.length, 1);
});

test('scaffold config pins every required project field and all seven product versions', () => {
  assert.deepEqual(json(join(scaffold, 'truthsrc.project.json')), {
    schemaVersion: 'truthsrc.project/v1', tree: 'tree', canonicalId: 'example-domain', context: 'example',
    products: [
      { id: 'reference-layout', version: '1' },
      { id: 'exact-value-types', version: '1' },
      { id: 'exact-value-codecs', version: '1' },
      { id: 'domain-decision', version: '4' },
      { id: 'domain-dependencies', version: '6' },
      { id: 'domain-folds', version: '6' },
      { id: 'domain-external-events', version: '2' },
    ],
    exactTypes: [], exactCodecs: [], documents: [], assemblies: [], roles: {},
    generator: 'scala-cqrs-domain-v2',
    options: { packages: [{ context: 'example', package: 'example.domain' }], verificationCases: [] },
  });
});

test('init resolves one relative path from the caller cwd and supports new nested parents', t => {
  const parent = sandbox(t);
  child(parent, `
    import assert from 'node:assert/strict';
    import { resolve } from 'node:path';
    import { initProject } from ${JSON.stringify(initUrl)};
    const result = initProject(['nested/new counter/']);
    assert.equal(result.root, resolve('nested/new counter'));
    assert.equal(result.validation.roundtrip.ok, true);
  `);
  assert.deepEqual(snapshot(join(parent, 'nested', 'new counter')), snapshot(scaffold));
});

test('malformed arguments and flags fail before creating any directory', t => {
  const parent = sandbox(t), root = join(parent, 'new', 'counter'), before = snapshot(parent);
  for (const args of [
    undefined, null, {}, root, [], [''], [' \t\n '], [null], [undefined], [1], [true],
    ['--help'], ['--tree'], ['-counter'], [root, 'extra'], ['--', root], [root, '--plan'],
    ['--project', root], ['--out', root], [root + '\0suffix'], new Array(1),
  ]) {
    assert.throws(() => initProject(args), /expected exactly one new project directory/);
    assert.deepEqual(snapshot(parent), before);
  }
});

for (const kind of ['empty-directory', 'directory', 'file', 'directory-symlink', 'file-symlink', 'dangling-symlink']) {
  test(`init refuses existing ${kind} without touching any bytes`, t => {
    const parent = sandbox(t), root = join(parent, 'counter'), target = join(parent, 'target');
    if (kind === 'empty-directory' || kind === 'directory') {
      mkdirSync(root);
      if (kind === 'directory') writeFileSync(join(root, 'keep'), 'existing data');
    } else if (kind === 'file') writeFileSync(root, 'existing file');
    else {
      if (kind === 'directory-symlink') { mkdirSync(target); writeFileSync(join(target, 'keep'), 'target data'); }
      if (kind === 'file-symlink') writeFileSync(target, 'target file');
      symlinkSync(target, root);
    }
    const before = snapshot(parent);
    assert.throws(() => initProject([root]), /destination already exists/);
    assert.deepEqual(snapshot(parent), before);
  });
}

for (const kind of ['directory', 'file', 'dangling']) {
  test(`init refuses ${kind} symlink parents before any write`, t => {
    const parent = sandbox(t), target = join(parent, 'target'), alias = join(parent, 'alias');
    if (kind === 'directory') mkdirSync(target);
    if (kind === 'file') writeFileSync(target, 'do not touch');
    symlinkSync(target, alias);
    const before = snapshot(parent);
    assert.throws(() => initProject([join(alias, 'new', 'counter')]), /symlink parent|ENOTDIR/);
    assert.deepEqual(snapshot(parent), before);
  });
}

test('lexical symlink ancestors cannot be hidden by dot-dot normalization', t => {
  const parent = sandbox(t), target = join(parent, 'target'), alias = join(parent, 'alias');
  mkdirSync(target); symlinkSync(target, alias);
  const before = snapshot(parent);
  assert.throws(() => initProject([`${alias}/../counter`]), /symlink parent/);
  assert.deepEqual(snapshot(parent), before);
});

test('a regular file cannot be used as a parent', t => {
  const parent = sandbox(t), file = join(parent, 'file');
  writeFileSync(file, 'do not touch');
  const before = snapshot(parent);
  assert.throws(() => initProject([join(file, 'counter')]), /not a directory|ENOTDIR/);
  assert.deepEqual(snapshot(parent), before);
});

for (const mode of ['copy', 'validation', 'roundtrip']) {
  test(`a ${mode} failure preserves the new directory and unrelated user data`, t => {
    const parent = sandbox(t), root = join(parent, 'counter'), keep = join(parent, 'keep');
    writeFileSync(keep, 'unrelated sibling');
    // Fault injection is isolated in a child. Never mutate the shipped scaffold.
    child(parent, `
      import assert from 'node:assert/strict';
      import fs from 'node:fs';
      import { join } from 'node:path';
      import { syncBuiltinESMExports } from 'node:module';
      import { parseDoc, emitDoc } from ${JSON.stringify(sharedUrl)};
      const root = ${JSON.stringify(root)}, mode = ${JSON.stringify(mode)};
      const copy = fs.copyFileSync;
      fs.copyFileSync = (source, target, flags) => {
        if (mode === 'copy') {
          fs.writeFileSync(join(root, 'keep'), 'user-owned partial data', { flag: 'wx' });
          throw new Error('injected copy failure');
        }
        copy(source, target, flags);
        if (mode === 'validation' && target.endsWith('/aggregate.yaml')) {
          const doc = parseDoc(fs.readFileSync(target, 'utf8'));
          doc.payload.entity = '';
          fs.writeFileSync(target, emitDoc({
            scalars: [['kind', doc.kind], ['name', doc.name], ['context', doc.context]],
            nested: { order: doc.order }, blocks: { payload: doc.payload },
          }));
        }
        if (mode === 'roundtrip' && target.endsWith('/workshop.yaml'))
          fs.appendFileSync(target, '# keep this edit after the failed gate\\n');
      };
      syncBuiltinESMExports();
      const { initProject } = await import(${JSON.stringify(initUrl)});
      assert.throws(() => initProject([root]), new RegExp(mode + ' fail'));
      assert.equal(fs.lstatSync(root).isDirectory(), true);
      if (mode === 'copy') assert.equal(fs.readFileSync(join(root, 'keep'), 'utf8'), 'user-owned partial data');
      else assert.equal(fs.existsSync(join(root, 'truthsrc.project.json')), true);
      assert.throws(() => initProject([root]), /destination already exists/);
    `);
    assert.equal(readFileSync(keep, 'utf8'), 'unrelated sibling');
    assert.equal(lstatSync(root).isDirectory(), true);
  });
}

test('Counter derives seven complete products and a deterministic Scala domain-v2 plan', t => {
  const root = join(sandbox(t), 'counter'), result = initProject([root]), before = snapshot(root);
  const canonical = JSON.parse(compileTree(result.tree)), config = json(result.project);
  const request = deriveProjectRequest(canonical, config, []);
  const compilation = compileProductSet(request);
  assert.deepEqual(compilation.diagnostics, []);
  assert.equal(compilation.result.products.length, 7);
  const products = new Map(compilation.result.products.map(p => [p.id, p.payload]));
  assert.deepEqual(products.get('exact-value-types'), []);
  assert.deepEqual(products.get('exact-value-codecs'), []);
  assert.equal(products.get('domain-decision').commands[0].decisions.length, 2);
  assert.deepEqual(products.get('domain-folds').defaults.map(d => d.value), ['', '0']);
  assert.equal(products.get('domain-folds').events[0].assignments.length, 2);
  const manifest = json(new URL('../generators/scala-cqrs-domain-v2/generator.json', import.meta.url));
  const input = { compilation, manifest, options: config.options }, generated = generate(input);
  assert.deepEqual(generated.diagnostics, []);
  assert.ok(generated.plan.entries.some(e => e.path.endsWith('.scala') && e.content.includes('Counter') && e.content.includes('Long')));
  assert.deepEqual(generate(input), generated);
  assert.deepEqual(snapshot(root), before);
});
