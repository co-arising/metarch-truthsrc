import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, renameSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const tool = fileURLToPath(new URL('..', import.meta.url));
const consumer = new URL('./reference/saga-monarch-installed-consumer.mjs', import.meta.url).href;
test('Saga Monarch package installs offline, relocates and preserves author/binding/implementation freshness', t => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'saga-monarch-installed-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pack = join(root, 'pack'), prefix = join(root, 'prefix'); mkdirSync(pack);
  const env = { ...process.env, PATH: dirname(process.execPath) + ':/usr/bin:/bin',
    npm_config_cache: join(root, 'npm-cache'), npm_config_update_notifier: 'false' };
  const run = (command, args) => {
    const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
    assert.ifError(result.error); assert.equal(result.status, 0, result.stdout + '\n' + result.stderr); return result.stdout;
  };
  const packed = JSON.parse(run('npm', ['pack', tool, '--offline', '--ignore-scripts', '--json', '--pack-destination', pack]))[0];
  assert(packed.files.some(file => file.path === 'generators/scala-cqrs-saga-monarch-v1/generator.json'));
  assert(packed.files.some(file => file.path === 'generators/scala-cqrs-saga-monarch-v1/templates/run-runtime.mjs'));
  assert(packed.files.some(file => file.path === 'scaffold/saga-monarch-project/truthsrc.project.json'));
  assert(!packed.files.some(file => file.path.startsWith('test/reference/')));
  run('npm', ['install', '--prefix', prefix, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', join(pack, packed.filename)]);
  const relocated = join(root, 'relocated'); renameSync(prefix, relocated);
  const installed = join(relocated, 'node_modules/@madpolaris/truthsrc'); assert(!lstatSync(installed).isSymbolicLink());
  const invocation = `const { installedSagaMonarchConsumer } = await import(${JSON.stringify(consumer)}); console.log(JSON.stringify(await installedSagaMonarchConsumer(${JSON.stringify(installed)}, ${JSON.stringify(join(root, 'project'))})));`;
  const result = JSON.parse(run(process.execPath, ['--input-type=module', '-e', invocation]));
  assert.equal(result.installed, true); assert.equal(result.generated, 6); assert.equal(result.handwritten, 1);
  assert.deepEqual(result.changed, ['implementation', 'binding', 'author']);
  assert.equal(result.checkoutFallback, false); assert.equal(result.runtimeVerified, false); assert.equal(result.sourceVerification, true);
});
