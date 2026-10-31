import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { largeTicketRequest } from './cli-large-ticket-fixture.mjs';
import { compileProductCli } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { MAX_JSON_BYTES } from '../lib/strict-json.mjs';

test('complete independent ticket products compact losslessly when pretty output exceeds the unchanged byte limit', () => {
  const root = mkdtempSync(join(tmpdir(), 'product-cli-large-'));
  try {
    const request = largeTicketRequest(), compilation = compileProductSet(request);
    assert.deepEqual(compilation.diagnostics, []);
    const pretty = JSON.stringify(compilation.result, null, 2) + '\n';
    const compact = JSON.stringify(compilation.result) + '\n';
    assert.ok(Buffer.byteLength(pretty) > MAX_JSON_BYTES);
    assert.ok(Buffer.byteLength(compact) <= MAX_JSON_BYTES);
    for (const d of request.documents) writeFileSync(join(root, d.id + '.json'), JSON.stringify(d.value));
    writeFileSync(join(root, 'files.json'), JSON.stringify({ schemaVersion: 'truthsrc.product-input-files/v1', documents: request.documents.map(d => ({ id: d.id, schemaVersion: d.schemaVersion, file: d.id + '.json' })), assemblies: request.assemblies, requirements: request.requirements, options: request.options }));
    compileProductCli(['--request', join(root, 'files.json'), '--out', join(root, 'out.json')]);
    assert.equal(readFileSync(join(root, 'out.json'), 'utf8'), compact);
    assert.deepEqual(JSON.parse(compact), compilation.result);
    const oversized = { ...request.documents[0].value, cliCapacityFixture: 'x'.repeat(5200000) };
    writeFileSync(join(root, request.documents[0].id + '.json'), JSON.stringify(oversized));
    assert.throws(() => compileProductCli(['--request', join(root, 'files.json'), '--out', join(root, 'too-large.json')]), error => error.diagnostic?.code === 'PRODUCT_COMPILATION' && error.message.includes('request exceeds 8 MiB'));
    assert.equal(existsSync(join(root, 'too-large.json')), false);
    writeFileSync(join(root, request.documents[0].id + '.json'), JSON.stringify(request.documents[0].value));
    assert.throws(() => compileProductCli(['--request', join(root, 'files.json'), '--out', join(root, 'out.json')]));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
