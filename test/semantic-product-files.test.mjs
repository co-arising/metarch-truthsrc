import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseStrictJson } from '../lib/strict-json.mjs';
import { captureProductRequest, readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
const fixture = fileURLToPath(new URL('./fixtures/semantic-products/files.json', import.meta.url));
const cli = fileURLToPath(new URL('../bin/truthsrc.js', import.meta.url));

test('strict JSON rejects duplicate escaped keys, unsafe numeric tokens, malformed bytes and depth', () => {
  for (const raw of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"x":1.0}', '{"x":1e2}', '{"x":-0}', '{"x":9007199254740992}', '{"x":true,}', '[1,]', 'true false', '﻿{}', '['.repeat(130) + '0' + ']'.repeat(130)])
    assert.throws(() => parseStrictJson(raw), undefined, raw.slice(0, 100));
  assert.throws(() => parseStrictJson(Buffer.from([0xc3, 0x28])));
  assert.throws(() => parseStrictJson(' '.repeat(8 * 1024 * 1024 + 1)));
  const good = parseStrictJson('{"__proto__":{"x":1},"n":9007199254740991,"escaped":"\\n"}');
  assert.equal(Object.getPrototypeOf(good), Object.prototype);
  assert.deepEqual(good.__proto__, { x: 1 });
  assert.equal(good.n, Number.MAX_SAFE_INTEGER);
});

test('file capture reports real bytes separately; CLI product equals pure memory compilation', () => {
  const root = mkdtempSync(join(tmpdir(), 'p24-products-'));
  try {
    const output = join(root, 'products.json');
    const receipt = JSON.parse(execFileSync(process.execPath, [cli, 'compile-products', '--request', fixture, '--out', output], { encoding: 'utf8', timeout: 15000 }));
    const bytes = readFileSync(output);
    assert.equal(receipt.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual(JSON.parse(bytes), compileProductSet(readProductRequest(fixture)).result);
    const captured = captureProductRequest(fixture);
    assert.deepEqual(receipt.sources, captured.sources);
    for (const row of receipt.sources) assert.equal(row.sha256, createHash('sha256').update(readFileSync(row.file)).digest('hex'));
    const second = spawnSync(process.execPath, [cli, 'compile-products', '--request', fixture, '--out', output], { encoding: 'utf8', timeout: 15000 });
    assert.equal(second.status, 2); assert.deepEqual(readFileSync(output), bytes);
    for (const args of [['--unknown', 'x'], ['--request'], ['--request', fixture, '--request', fixture], ['--request', fixture]]) {
      const failed = spawnSync(process.execPath, [cli, 'compile-products', ...args], { encoding: 'utf8', timeout: 15000 });
      assert.equal(failed.status, 2);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('file adapter refuses symlinks, directories, relative manifests and malformed documents', () => {
  const root = mkdtempSync(join(tmpdir(), 'p24-product-boundary-'));
  try {
    symlinkSync(fixture, join(root, 'link.json'));
    assert.throws(() => readProductRequest(join(root, 'link.json')));
    assert.throws(() => readProductRequest(root));
    assert.throws(() => readProductRequest('relative.json'));
    const input = join(root, 'request.json');
    writeFileSync(input, '{"schemaVersion":1,"schemaVersion":2}');
    assert.throws(() => readProductRequest(input));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
