import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sagaContract } from './fixtures/saga-contract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'bin', 'truthsrc.js');
const generator = join(root, 'generators', 'saga-dsl');
function fixture(t, mode = 'strict-contract') {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'saga-gen-cli-')));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const { canonical, binding } = sagaContract();
  const input = join(directory, 'canonical.json');
  const options = join(directory, 'options.json');
  writeFileSync(input, JSON.stringify(canonical));
  writeFileSync(options, JSON.stringify({ mode, binding }));
  return { directory, input, options };
}
const run = (...args) => spawnSync(process.execPath, [cli, 'generate', ...args], { encoding: 'utf8' });

test('public generation plan loads an explicit nested Saga binding without writing artifacts', (t) => {
  const { directory, input, options } = fixture(t);
  const target = join(directory, 'target');
  const result = run('--in', input, '--generator', generator, '--options-json', options, '--out', target, '--plan');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /3 files \(nothing written\)/);
  assert.match(result.stdout, /saga-phase-table/);
  assert.equal(existsSync(target), false);
});

test('public generation rejects strict runnable source when the runtime binding is unverified', (t) => {
  const { directory, input, options } = fixture(t, 'strict-scala');
  const target = join(directory, 'target');
  const result = run('--in', input, '--generator', generator, '--options-json', options, '--out', target);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /SAGA_RUNTIME_BINDING_UNVERIFIED/);
  assert.equal(existsSync(target), false);
});

for (const args of [['--out'], ['--unknown', 'x'], ['--plan', '--plan'],
  ['--option', 'mode'], ['--option', 'mode=a', '--option', 'mode=b']]) {
  test(`public generation flags fail before loading/applying: ${JSON.stringify(args)}`, () => {
    const result = run(...args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /\[FAIL\]/);
    assert.doesNotMatch(result.stderr, /ERR_INVALID_ARG_TYPE/);
  });
}
