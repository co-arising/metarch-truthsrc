import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync, mkdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitDoc } from '../lib/shared.mjs';
import { sagaContract } from './fixtures/saga-contract.mjs';

const cli = fileURLToPath(new URL('../bin/truthsrc.js', import.meta.url));
function scratch(t) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'truthsrc-contract-cli-')));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
const run = (...args) => spawnSync(process.execPath, [cli, 'compile-execution', ...args], { encoding: 'utf8' });
const narrative = { schemaVersion: 'truthsrc/v1', workshop: 'cli-example', pipelines: [] };

for (const domain of ['MoneyTransfer', 'Fab']) {
  test(`public Saga compilation accepts closed ${domain} contracts and rejects unknown execution keys before writing`, (t) => {
    const directory = scratch(t);
    const { canonical, binding } = sagaContract(domain);
    const input = join(directory, 'canonical.json');
    const bound = join(directory, 'binding.json');
    const output = join(directory, 'saga.json');
    writeFileSync(input, JSON.stringify(canonical));
    writeFileSync(bound, JSON.stringify(binding));
    const args = [cli, 'compile-sagas', '--in', input, '--binding', bound, '--out', output];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const ir = JSON.parse(readFileSync(output));
    assert.equal(ir.schemaVersion, 'truthsrc.saga-ir/v1');
    assert.equal(ir.readiness, 'contract-only');
    assert.equal(ir.sagas[0].definition.id, canonical.sagas[0].id);
    canonical.sagas[0].payload.unknownKey = true;
    writeFileSync(input, JSON.stringify(canonical));
    const invalidOutput = join(directory, 'invalid-saga.json');
    const invalid = spawnSync(process.execPath, [...args.slice(0, -1), invalidOutput], { encoding: 'utf8' });
    assert.equal(invalid.status, 2);
    assert.match(invalid.stderr, /SAGA_SCHEMA/);
    assert.equal(existsSync(invalidOutput), false);
  });
}

test('public compilation writes deterministic contract-only IR, including an identical rerun', (t) => {
  const directory = scratch(t);
  const input = join(directory, 'canonical.json');
  const output = join(directory, 'execution.json');
  writeFileSync(input, JSON.stringify(narrative));
  const result = run('--in', input, '--out', output);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /contract-only; runtime not verified/);
  assert.equal(JSON.parse(readFileSync(output)).schemaVersion, 'truthsrc.execution/v1');
  const bytes = readFileSync(output, 'utf8');
  assert.equal(run('--in', input, '--out', output).status, 0);
  assert.equal(readFileSync(output, 'utf8'), bytes);
});

for (const args of [[], ['--out'], ['--tree'], ['--typo', 'value'], ['--in', '--out'],
  ['--in', 'a', '--in', 'b', '--out', 'c'], ['--tree', 'a', '--in', 'b', '--out', 'c']]) {
  test(`public compilation rejects invalid flags without uncaught argument parsing: ${JSON.stringify(args)}`, () => {
    const result = run(...args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /\[FAIL\]/);
    assert.doesNotMatch(result.stderr, /ERR_INVALID_ARG_TYPE/);
  });
}

test('malformed input and schema diagnostics do not create output', (t) => {
  const directory = scratch(t);
  const input = join(directory, 'canonical.json');
  const output = join(directory, 'execution.json');
  for (const bytes of ['{', JSON.stringify({ ...narrative, schemaVersion: 'unsupported' })]) {
    writeFileSync(input, bytes);
    const result = run('--in', input, '--out', output);
    assert.equal(result.status, 2);
    assert.equal(existsSync(output), false);
  }
});

test('output cannot overwrite input, a different existing file, or a symbolic-link target', (t) => {
  const directory = scratch(t);
  const input = join(directory, 'canonical.json');
  writeFileSync(input, JSON.stringify(narrative));
  assert.equal(run('--in', input, '--out', input).status, 2);
  const output = join(directory, 'execution.json');
  writeFileSync(output, 'keep me');
  assert.equal(run('--in', input, '--out', output).status, 2);
  assert.equal(readFileSync(output, 'utf8'), 'keep me');
  const outside = join(directory, 'outside');
  mkdirSync(outside);
  const linked = join(directory, 'linked');
  symlinkSync(outside, linked);
  assert.equal(run('--in', input, '--out', join(linked, 'execution.json')).status, 2);
  assert.equal(existsSync(join(outside, 'execution.json')), false);
});

test('tree opt-in execution shape is checked, not silently treated as a narrative', (t) => {
  const directory = scratch(t);
  const tree = join(directory, 'tree');
  mkdirSync(join(tree, 'pipelines'), { recursive: true });
  writeFileSync(join(tree, 'workshop.yaml'), 'schemaVersion: truthsrc/v1\nname: invalid-execution\n');
  writeFileSync(join(tree, 'pipelines', 'invalid.pipeline.yaml'), emitDoc({
    scalars: [['kind', 'pipeline'], ['id', 'invalid'], ['name', 'Invalid']],
    blocks: { steps: [{ id: 'first', name: 'First' }], execution: { schemaVersion: 'truthsrc.execution/v1', unknown: true } },
  }));
  const output = join(directory, 'execution.json');
  const result = run('--tree', tree, '--out', output);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /PL4/);
  assert.equal(existsSync(output), false);
});

test('tree validation fails before projection or output creation', (t) => {
  const directory = scratch(t);
  const tree = join(directory, 'tree');
  mkdirSync(tree);
  writeFileSync(join(tree, 'workshop.yaml'), 'schemaVersion: unsupported\nname: invalid\n');
  const output = join(directory, 'execution.json');
  const result = run('--tree', tree, '--out', output);
  assert.equal(result.status, 2);
  assert.equal(existsSync(output), false);
});
