import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileTree } from '../lib/compile.mjs';
import { buildGraphStore } from '../lib/graphstore.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const rpc = (id, method, params = {}) => JSON.stringify({ jsonrpc: '2.0', id, method, params });

function mcpCall(lines) {
  const input = lines.join('\n') + '\n';
  const result = spawnSync(process.execPath, [join(root, 'bin', 'truthsrc.js'), 'mcp'], { input, encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().split('\n').map(line => JSON.parse(line));
}

test('public MCP exposes distinct Saga participants and phase verbs over the authored tree', () => {
  const tree = join(root, 'example', 'saga-money-transfer', 'tree');
  const replies = mcpCall([rpc(1, 'tools/list'),
    rpc(2, 'tools/call', { name: 'saga_participants_of', arguments: { tree, saga: 'money-transfer' } }),
    rpc(3, 'tools/call', { name: 'saga_phases_of', arguments: { tree, saga: 'money-transfer' } })]);
  const tools = replies.find(reply => reply.id === 1).result.tools.map(tool => tool.name);
  assert.ok(tools.includes('saga_participants_of'));
  assert.ok(tools.includes('saga_phases_of'));
  for (const id of [2, 3]) {
    const reply = replies.find(reply => reply.id === id);
    assert.equal(reply.result.isError, undefined);
    const data = JSON.parse(reply.result.content[0].text);
    assert.ok(data.summary);
    assert.ok(JSON.stringify(data.result).includes('money-transfer'));
  }
});

test('public MCP serves every verb from a graphstore file and unions anchor indexes', async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), 'saga-mcp-store-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const tree = join(root, 'example', 'saga-money-transfer', 'tree');
  const store = join(scratch, 'graph.db');
  buildGraphStore(JSON.parse(compileTree(tree)), { file: store });
  // A second pipeline-owned anchor index beside the store: one scala location for
  // the same knowledge key, fingerprinted against bytes written in this scratch.
  const scalaFile = join(scratch, 'SagaModule.scala');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(scalaFile, 'object SagaModule\n');
  const fingerprint = `sha256:${createHash('sha256').update('object SagaModule\n').digest('hex')}`;
  const bcIndex = join(scratch, 'bc-anchors.json');
  await writeFile(bcIndex, JSON.stringify({ version: 'truthsrc.anchors/v1', anchors: { 'saga:money-transfer': [
    { repo: 'bc-scratch', file: 'SagaModule.scala', module: null, symbol: null, span: null,
      generator: 'codegen-main', generatorVersion: 'p8-anchors-20261024', fingerprint,
      status: 'source-verified', verification: { method: 'sha256-bytes', level: 'file', fileVerified: true, symbolVerified: false, spanVerified: false } },
  ] } }, null, 2));
  const replies = mcpCall([
    rpc(1, 'tools/call', { name: 'saga_participants_of', arguments: { store, saga: 'money-transfer' } }),
    // anchors over the store graph, unioning two indexes at once
    rpc(2, 'tools/call', { name: 'anchors', arguments: { store, kind: 'saga', id: 'money-transfer',
      indexFile: [bcIndex], repoRoots: { 'bc-scratch': scratch } } }),
    // a store path that does not exist fails closed as a tool error, not a crash
    rpc(3, 'tools/call', { name: 'describe', arguments: { store: join(scratch, 'missing.db'), kind: 'saga', id: 'money-transfer' } }),
  ]);
  const participants = JSON.parse(replies.find(reply => reply.id === 1).result.content[0].text);
  assert.ok(JSON.stringify(participants.result).includes('money-transfer'));
  const backAnchors = JSON.parse(replies.find(reply => reply.id === 2).result.content[0].text);
  assert.equal(backAnchors.result.status, 'source-verified');
  assert.equal(backAnchors.result.result.length, 1);
  assert.equal(backAnchors.result.result[0].freshness, 'current-bytes');
  const failed = replies.find(reply => reply.id === 3);
  assert.equal(failed.error.code, -32603);
  assert.match(failed.error.message, /tool error/);
});
