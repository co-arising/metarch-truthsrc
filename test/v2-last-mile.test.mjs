// End-to-end tests for co-arising 2.0 Last-Mile Kit:
//   1. `truthsrc tasks-v2` derived state machine (PENDING -> UNVERIFIED -> GREEN_NEEDS_REVIEW -> VERIFIED -> STALE)
//      + automatic dirty invalidation when upstream .ears changes
//   2. `truthsrc mcp` 5 new v2 MCP tools over real JSON-RPC 2.0 stdio (v2_compile, v2_query_graph, v2_tasks, v2_context_pack, v2_verify)
//   3. Cross-platform AGY / Claude Code Skills & AGY `run_workflow` template structural checks
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const BIN = join(REPO_ROOT, 'bin/truthsrc.js');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8', timeout: 60_000, ...options });
}

test('tasks-v2 derives PENDING -> UNVERIFIED -> GREEN_NEEDS_REVIEW -> VERIFIED and auto-invalidates to STALE on .ears change', () => {
  const work = mkdtempSync(join(tmpdir(), 'coarising-tasks-v2-'));
  try {
    const proj = join(work, 'proj');
    const init = runCli(['init-v2', proj, '--target', 'typescript']);
    assert.equal(init.status, 0, init.stderr + init.stdout);

    // Force quota-intake back to unimplemented skeleton to test full lifecycle from PENDING
    const clozePath = join(proj, 'handwritten/quota-intake.cloze.ts');
    const filledSrc = readFileSync(clozePath, 'utf8');
    const unimplSrc = filledSrc.replace(
      /\/\/ @cloze:start\(quota-intake\)[\s\S]*?\/\/ @cloze:end\(quota-intake\)/u,
      '// @cloze:start(quota-intake)\n    throw new Error("CLOZE_NOT_IMPLEMENTED: quota-intake");\n    // @cloze:end(quota-intake)',
    );
    writeFileSync(clozePath, unimplSrc, 'utf8');

    // 1. PENDING
    const t1 = JSON.parse(runCli(['tasks-v2', '--root', proj, '--format', 'json']).stdout);
    assert.equal(t1.summary.deterministicDone, 1);
    assert.equal(t1.summary.pending, 1);
    assert.equal(t1.tasks[0].status, 'PENDING');
    assert.equal(t1.parallelizable.length, 1);

    // --next returns Sandwich Context Pack
    const nextRes = JSON.parse(runCli(['tasks-v2', '--root', proj, '--next', '--format', 'json']).stdout);
    assert.equal(nextRes.done, false);
    assert.equal(nextRes.nextTask.slotId, 'quota-intake');
    assert.ok(nextRes.contextPackMarkdown.includes('Sandwich Context Pack'));

    // 2. Fill @cloze -> UNVERIFIED before verify-v2
    writeFileSync(clozePath, filledSrc, 'utf8');
    const t2 = JSON.parse(runCli(['tasks-v2', '--root', proj, '--format', 'json']).stdout);
    assert.equal(t2.tasks[0].status, 'UNVERIFIED');

    // 3. Run verify-v2 -> GREEN_NEEDS_REVIEW
    const ver = runCli([
      'verify-v2', '--root', proj, '--target', 'typescript',
      '--canonical', join(proj, '.truthsrc/canonical-v2.json'),
      '--db', join(proj, '.truthsrc/knowledge.sqlite'),
      '--strict',
    ]);
    assert.equal(ver.status, 0, ver.stderr + ver.stdout);
    const t3 = JSON.parse(runCli(['tasks-v2', '--root', proj, '--format', 'json']).stdout);
    assert.equal(t3.tasks[0].status, 'GREEN_NEEDS_REVIEW');
    assert.equal(t3.reviewQueue.length, 1);

    // 4. Record Blind Review PASS -> VERIFIED (disappears from default actionable list)
    const rev = runCli([
      'tasks-v2', '--root', proj, '--record-review',
      '--slot', 'quota-intake', '--verdict', 'PASS', '--reviewer', 'blind-bot',
    ]);
    assert.equal(rev.status, 0, rev.stderr + rev.stdout);
    const t4 = JSON.parse(runCli(['tasks-v2', '--root', proj, '--format', 'json']).stdout);
    assert.equal(t4.summary.verified, 1);
    assert.equal(t4.tasks.length, 0);

    // 5. Mutate upstream application .ears & recompile -> automatic dirty invalidation to STALE!
    const appEars = join(proj, 'truth/core/behaviors/application/quota-intake.story.ears');
    const appSrc = readFileSync(appEars, 'utf8');
    writeFileSync(appEars, appSrc.replace('UNAUTHORIZED', 'ACCESS_DENIED'), 'utf8');
    const recompile = runCli([
      'compile-v2',
      '--structures', join(proj, 'truth/core/structures'),
      '--behaviors', join(proj, 'truth/core/behaviors'),
      '--out', join(proj, '.truthsrc/canonical-v2.json'),
      '--db', join(proj, '.truthsrc/knowledge.sqlite'),
    ]);
    assert.equal(recompile.status, 0, recompile.stderr + recompile.stdout);

    const t5 = JSON.parse(runCli(['tasks-v2', '--root', proj, '--format', 'json']).stdout);
    assert.equal(t5.summary.stale, 1);
    assert.equal(t5.tasks[0].status, 'STALE');
    assert.equal(t5.parallelizable.length, 1);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('truthsrc mcp exposes and executes all 5 v2 tools (v2_compile, v2_query_graph, v2_tasks, v2_context_pack, v2_verify)', () => {
  const work = mkdtempSync(join(tmpdir(), 'coarising-mcp-v2-'));
  try {
    const proj = join(work, 'proj');
    const init = runCli(['init-v2', proj, '--target', 'typescript']);
    assert.equal(init.status, 0, init.stderr + init.stdout);

    const reqs = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'v2_compile',
          arguments: {
            structures: join(proj, 'truth/core/structures'),
            behaviors: join(proj, 'truth/core/behaviors'),
            out: join(proj, '.truthsrc/canonical-v2.json'),
            db: join(proj, '.truthsrc/knowledge.sqlite'),
          },
        },
      },
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'v2_query_graph',
          arguments: { db: join(proj, '.truthsrc/knowledge.sqlite'), nodeId: 'behavior:QuotaIntake' },
        },
      },
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'v2_tasks',
          arguments: { root: proj, includeDone: true },
        },
      },
      {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'v2_context_pack',
          arguments: {
            canonical: join(proj, '.truthsrc/canonical-v2.json'),
            db: join(proj, '.truthsrc/knowledge.sqlite'),
            slot: 'quota-intake',
            workspace: proj,
          },
        },
      },
      {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'v2_verify',
          arguments: {
            root: proj,
            targets: ['typescript'],
            canonical: join(proj, '.truthsrc/canonical-v2.json'),
            db: join(proj, '.truthsrc/knowledge.sqlite'),
            strict: true,
          },
        },
      },
    ];

    const proc = runCli(['mcp'], { input: reqs.map(r => JSON.stringify(r)).join('\n') + '\n' });
    assert.equal(proc.status, 0, proc.stderr);
    const replies = proc.stdout.trim().split('\n').map(l => JSON.parse(l));
    const byId = new Map(replies.map(r => [r.id, r]));

    const toolNames = byId.get(2).result.tools.map(t => t.name);
    for (const expected of ['v2_compile', 'v2_query_graph', 'v2_tasks', 'v2_context_pack', 'v2_verify', 'v2_view']) {
      assert.ok(toolNames.includes(expected), `missing MCP tool ${expected}`);
    }

    const compPayload = JSON.parse(byId.get(3).result.content[0].text);
    assert.equal(compPayload.passed, true);

    const graphPayload = JSON.parse(byId.get(4).result.content[0].text);
    assert.equal(graphPayload.node.name, 'QuotaIntake');

    const tasksPayload = JSON.parse(byId.get(5).result.content[0].text);
    assert.equal(tasksPayload.summary.totalCloze, 1);

    const packPayload = JSON.parse(byId.get(6).result.content[0].text);
    assert.ok(packPayload.markdown.includes('Sandwich Context Pack'));

    const verifyPayload = JSON.parse(byId.get(7).result.content[0].text);
    assert.equal(verifyPayload.passed, true);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('cross-platform Skills (coarising-distill, coarising-cloze-worker) and AGY workflow template exist and are well-formed', () => {
  const distill = join(REPO_ROOT, 'skills/coarising_distill/SKILL.md');
  const distillYamlRef = join(REPO_ROOT, 'skills/coarising_distill/references/structures_and_bindings_schema.md');
  const distillEarsRef = join(REPO_ROOT, 'skills/coarising_distill/references/ears_v2_grammar.md');
  const worker = join(REPO_ROOT, 'skills/coarising_cloze_worker/SKILL.md');
  const workflow = join(REPO_ROOT, 'workflows/coarising_cloze_pipeline.py');

  for (const f of [distill, distillYamlRef, distillEarsRef, worker, workflow]) {
    assert.ok(existsSync(f), `missing ${f}`);
  }
  const dText = readFileSync(distill, 'utf8');
  assert.ok(dText.startsWith('---\nname: coarising-distill\n'));
  assert.ok(dText.includes('v2_compile') && dText.includes('Clarification Card'));
  assert.ok(dText.includes('references/structures_and_bindings_schema.md') && dText.includes('references/ears_v2_grammar.md'));
  assert.ok(readFileSync(distillYamlRef, 'utf8').includes('co-arising.effect-binding/v2'));
  assert.ok(readFileSync(distillEarsRef, 'utf8').includes('EARS_NEG_PRED_NAME'));

  // Machine-verify that the bundled YAML + domain .ears + application .ears examples actually compile & pass Z3
  const yamlRefText = readFileSync(distillYamlRef, 'utf8');
  const earsRefText = readFileSync(distillEarsRef, 'utf8');
  const yamlBlocks = [...yamlRefText.matchAll(/```yaml\n([\s\S]*?)```/gu)].map(m => m[1]);
  const earsBlocks = [...earsRefText.matchAll(/```ears\n([\s\S]*?)```/gu)].map(m => m[1]);
  const structYaml = yamlBlocks.find(b => b.includes('system: wallet-app') && b.includes('aggregates:'));
  const bindingYaml = yamlBlocks.find(b => b.includes('schemaVersion: co-arising.effect-binding/v2'));
  const domainEars = earsBlocks.find(b => b.startsWith('slice WalletLedger.ReserveFunds'));
  const appEars = earsBlocks.find(b => b.startsWith('story WalletTransfer layer application'));
  assert.ok(structYaml && bindingYaml && domainEars && appEars, 'bundled skill reference examples must be extractable');

  const tmp = mkdtempSync(join(tmpdir(), 'coarising-skill-ref-check-'));
  try {
    mkdirSync(join(tmp, 'structures'), { recursive: true });
    mkdirSync(join(tmp, 'behaviors/domain'), { recursive: true });
    mkdirSync(join(tmp, 'behaviors/application'), { recursive: true });
    mkdirSync(join(tmp, 'bindings'), { recursive: true });
    writeFileSync(join(tmp, 'structures/wallet.yaml'), structYaml, 'utf8');
    writeFileSync(join(tmp, 'behaviors/domain/wallet-reserve.ears'), domainEars, 'utf8');
    writeFileSync(join(tmp, 'behaviors/application/wallet-transfer.story.ears'), appEars, 'utf8');
    writeFileSync(join(tmp, 'bindings/wallet-effects.yaml'), bindingYaml, 'utf8');

    const compProc = runCli([
      'compile-v2',
      '--structures', join(tmp, 'structures'),
      '--behaviors', join(tmp, 'behaviors'),
      '--out', join(tmp, 'canonical.json'),
    ]);
    assert.equal(compProc.status, 0, `bundled skill reference example failed compile-v2:\n${compProc.stdout}\n${compProc.stderr}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const wText = readFileSync(worker, 'utf8');
  assert.ok(wText.startsWith('---\nname: coarising-cloze-worker\n'));
  assert.ok(wText.includes('tasks-v2') && wText.includes('--record-review'));

  const pyText = readFileSync(workflow, 'utf8');
  assert.ok(pyText.includes('parallel(') && pyText.includes('phase(') && pyText.includes('tasks-v2') && pyText.includes('check-v2'));
});
