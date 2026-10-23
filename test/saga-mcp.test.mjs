import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const rpc = (id, method, params = {}) => JSON.stringify({ jsonrpc: '2.0', id, method, params });

test('public MCP exposes distinct Saga participants and phase verbs over the authored tree', () => {
  const tree = join(root, 'example', 'saga-money-transfer', 'tree');
  const input = [rpc(1, 'tools/list'),
    rpc(2, 'tools/call', { name: 'saga_participants_of', arguments: { tree, saga: 'money-transfer' } }),
    rpc(3, 'tools/call', { name: 'saga_phases_of', arguments: { tree, saga: 'money-transfer' } })].join('\n') + '\n';
  const result = spawnSync(process.execPath, [join(root, 'bin', 'truthsrc.js'), 'mcp'], { input, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  const replies = result.stdout.trim().split('\n').map(line => JSON.parse(line));
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
