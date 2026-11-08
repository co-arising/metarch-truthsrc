import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, renameSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const tool = fileURLToPath(new URL('..', import.meta.url));
const consumer = new URL('./reference/module-seams-installed-consumer.mjs', import.meta.url).href;
test('module seams tarball installs offline, relocates and preserves three input freshness surfaces', t => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'module-seams-installed-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pack = join(root, 'pack'), prefix = join(root, 'prefix'); mkdirSync(pack);
  const env = { ...process.env, PATH: dirname(process.execPath) + ':/usr/bin:/bin', npm_config_cache: join(root, 'npm-cache'), npm_config_update_notifier: 'false' };
  const run = (command, args) => {
    const r = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
    assert.ifError(r.error); assert.equal(r.status, 0, r.stdout + '\n' + r.stderr); return r.stdout;
  };
  const packed = JSON.parse(run('npm', ['pack', tool, '--offline', '--ignore-scripts', '--json', '--pack-destination', pack]))[0];
  assert(packed.files.some(f => f.path === 'generators/scala-cqrs-module-seams-v1/generator.json'));
  assert(packed.files.some(f => f.path === 'scaffold/module-seams-project/truthsrc.project.json'));
  assert(!packed.files.some(f => f.path.startsWith('test/reference/')));
  run('npm', ['install', '--prefix', prefix, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', join(pack, packed.filename)]);
  const relocated = join(root, 'relocated'); renameSync(prefix, relocated);
  const installed = join(relocated, 'node_modules/@madpolaris/truthsrc'); assert(!lstatSync(installed).isSymbolicLink());
  const invocation = `const { installedConsumer } = await import(${JSON.stringify(consumer)}); console.log(JSON.stringify(await installedConsumer(${JSON.stringify(installed)}, ${JSON.stringify(join(root, 'project'))})));`;
  const result = JSON.parse(run(process.execPath, ['--input-type=module', '-e', invocation]));
  assert.deepEqual(result, { installed: true, generated: 7, handwritten: 3, changed: ['handwritten', 'composition', 'signature'], checkoutFallback: false, runtimeVerified: false });
});
