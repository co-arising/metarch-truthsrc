import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateProductCli } from '../lib/products/generate-cli.mjs';

const args = out => ['--request', fileURLToPath(new URL('./fixtures/domain-generation/files.json', import.meta.url)),
  '--generator', fileURLToPath(new URL('../generators/scala-cqrs-domain', import.meta.url)), '--out', out,
  '--options-json', fileURLToPath(new URL('./fixtures/domain-generation/options.json', import.meta.url))];
test('formal product CLI plans with no target I/O and applies actual source anchors through existing core', async () => {
  const root = mkdtempSync(join(tmpdir(), 'truthsrc-product-generation-')), out = join(root, 'source');
  const planned = await generateProductCli([...args(out), '--plan']);
  assert.equal(existsSync(out), false); assert.equal(planned.applied, false);
  const applied = await generateProductCli(args(out));
  assert.equal(applied.applied, true); assert.equal(applied.result.total, planned.plan.entries.length);
  for (const e of planned.plan.entries) assert.equal(readFileSync(join(out, e.path), 'utf8'), e.content);
  const ledger = JSON.parse(readFileSync(join(out, 'truthsrc.ledger.json')));
  assert.ok(ledger.entries.every(e => e.productFootprint.length && e.knowledgeIds.length));
  const anchors = JSON.parse(readFileSync(join(out, 'anchors.json')));
  assert.ok(Object.keys(anchors.anchors).length);
  const repeat = await generateProductCli(args(out));
  assert.equal(repeat.result.written, 0); assert.equal(repeat.result.identical, repeat.result.total);
});
test('formal generation rejects unknown flags, duplicate plan and unregistered generator before target writes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'truthsrc-product-reject-')), out = join(root, 'absent');
  await assert.rejects(generateProductCli([...args(out), '--direct']), e => e.diagnostic?.code === 'PRODUCT_CLI');
  await assert.rejects(generateProductCli([...args(out), '--plan', '--plan']), e => e.diagnostic?.code === 'PRODUCT_CLI');
  const untrusted = args(out); untrusted[untrusted.indexOf('--generator') + 1] = root;
  await assert.rejects(generateProductCli(untrusted), e => e.diagnostic?.code === 'PRODUCT_PRODUCER');
  assert.equal(existsSync(out), false);
});
