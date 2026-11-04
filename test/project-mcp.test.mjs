import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initProject } from '../lib/project/init.mjs';
import { projectCli } from '../lib/project/cli.mjs';

const bin = fileURLToPath(new URL('../bin/truthsrc.js', import.meta.url));
test('public MCP project status and sources use the same snapshot-bound read-only contract', async t => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'truthsrc-project-mcp-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { project } = initProject([join(root, 'project')]), out = join(root, 'generated');
  await projectCli('generate-project', ['--project', project, '--out', out]);
  const requests = [
    { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'project_status', arguments: { project, out } } },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'project_sources', arguments: { project, out, knowledge: 'SetCount' } } },
  ];
  const child = spawnSync(process.execPath, [bin, 'mcp'], { input: requests.map(r => JSON.stringify(r)).join('\n') + '\n', encoding: 'utf8', timeout: 30000 });
  assert.equal(child.status, 0, child.stderr);
  const replies = child.stdout.trim().split('\n').map(line => JSON.parse(line));
  const tools = replies.find(r => r.id === 1).result.tools.map(t => t.name);
  assert.ok(tools.includes('project_status')); assert.ok(tools.includes('project_sources'));
  for (const id of [2, 3]) assert.equal(replies.find(r => r.id === id).error, undefined);
  assert.equal(JSON.parse(replies.find(r => r.id === 2).result.content[0].text).synchronized, true);
  const sources = JSON.parse(replies.find(r => r.id === 3).result.content[0].text);
  assert.equal(sources.state, 'mapped');
  assert.ok(sources.result.some(r => r.origins.some(o => o.file.endsWith('set-count.slice.yaml'))));
});
