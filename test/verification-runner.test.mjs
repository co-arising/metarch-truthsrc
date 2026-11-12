import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { getEventListeners } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectVerificationRun, runVerification } from '../lib/verification/runner.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const root = mkdtempSync(join(realpathSync(tmpdir()), 'verification-runner-'));
const hash = text => createHash('sha256').update(text).digest('hex');
const save = (file, value) => writeFileSync(file, JSON.stringify(value) + '\n', { flag: 'wx' });
let sequence = 0;
function fixture() {
  const directory = join(root, String(++sequence)); mkdirSync(directory, { mode: 0o700 });
  const source = join(directory, 'source'); mkdirSync(source);
  const input = join(source, 'items.json'), oracle = join(source, 'oracle.json');
  const builder = join(source, 'builder.mjs'), checker = join(source, 'checker.mjs');
  save(input, { items: ['tea', 'coffee'] }); save(oracle, ['TEA', 'COFFEE']);
  writeFileSync(builder, 'export const responsibility = "build catalog";\n');
  writeFileSync(checker, 'export const responsibility = "independent catalog oracle";\n');
  const run = join(directory, 'run'), registry = join(directory, 'leases');
  const plan = { contract: { id: 'catalog-project', version: '1' },
    inputs: { files: [input, oracle], trees: [{ root: source, excludeDirectories: [] }] },
    actionFile: builder, verifiers: [{ id: 'catalog-matches', file: checker }], artifacts: ['catalog.json'] };
  const lease = { registry, lockNames: ['catalog.lock'], usedName: 'run-one.used.json', record: { owner: 'catalog-owner' } };
  let builds = 0, checks = 0;
  const action = async ({ artifactRoot }) => {
    builds++;
    const items = JSON.parse(readFileSync(input)).items.map(item => item.toUpperCase());
    save(join(artifactRoot, 'catalog.json'), items); return { count: items.length };
  };
  const verify = { 'catalog-matches': ({ artifactRoot, value }) => {
    checks++;
    const artifact = JSON.parse(readFileSync(join(artifactRoot, 'catalog.json')));
    assert.deepEqual(artifact, JSON.parse(readFileSync(oracle)));
    return value.count === artifact.length;
  } };
  const inspect = () => inspectVerificationRun({ directory: run, plan, verify });
  return { directory, run, registry, input, oracle, builder, checker, source, plan, lease, action, verify, inspect,
    counts: () => ({ builds, checks }), options: () => ({ directory: run, plan, lease, action, verify }) };
}

function fileState(directory) {
  return Object.fromEntries(readdirSync(directory, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => {
    const file = join(entry.parentPath, entry.name), stat = statSync(file);
    return [file, { bytes: hash(readFileSync(file)), mtime: stat.mtimeMs, mode: stat.mode }];
  }));
}

test('one non-bank action, explicit oracle, held lease and read-only report form a complete run', async () => {
  const f = fixture(), action = f.action;
  const report = await runVerification({ ...f.options(), action: async context => {
    assert.ok(existsSync(join(f.registry, 'catalog.lock')));
    return action(context);
  } });
  assert.equal(report.passed, true); assert.equal(report.runtimeVerified, false);
  assert.deepEqual(report.checks, [{ id: 'catalog-matches', passed: true }]);
  assert.equal(f.counts().builds, 1);
  assert.ok(!existsSync(join(f.registry, 'catalog.lock')));
  assert.ok(existsSync(join(f.registry, 'run-one.used.json')));
  assert.equal(statSync(f.run).mode & 0o777, 0o700);
  assert.equal(statSync(join(f.run, 'result.json')).mode & 0o777, 0o400);
  const before = fileState(f.directory), builds = f.counts().builds;
  assert.equal((await f.inspect()).passed, true); assert.equal((await f.inspect()).passed, true);
  assert.deepEqual(fileState(f.directory), before); assert.equal(f.counts().builds, builds);
  assert.ok(!JSON.stringify(report).includes('COFFEE'));
});

test('the run and single-use grant cannot be resumed or reused', async () => {
  const f = fixture(); assert.equal((await runVerification(f.options())).passed, true);
  await assert.rejects(runVerification(f.options()));
  const second = join(f.directory, 'second');
  await assert.rejects(runVerification({ ...f.options(), directory: second }));
  assert.equal(existsSync(second), false); assert.equal(f.counts().builds, 1);
});

test('content changes, new or removed tree members, and changed verifier invalidate static acceptance', async () => {
  for (const mutate of [
    f => writeFileSync(f.input, '{"items":["wrong"]}'),
    f => writeFileSync(join(f.source, 'added.json'), '{}'),
    f => renameSync(f.input, join(f.source, 'renamed.json')),
    f => writeFileSync(f.checker, '// a different verification implementation\n'),
    f => writeFileSync(join(f.run, 'artifacts/catalog.json'), '[]'),
  ]) {
    const f = fixture(); assert.equal((await runVerification(f.options())).passed, true);
    mutate(f); const before = fileState(f.directory);
    assert.equal((await f.inspect()).passed, false); assert.deepEqual(fileState(f.directory), before);
    assert.equal(f.counts().builds, 1);
  }
});

test('runtime input drift fails and releases only the owned cooperative lease', async () => {
  const f = fixture(), build = f.action;
  const result = await runVerification({ ...f.options(), action: async context => {
    const value = await build(context); writeFileSync(f.input, '{"items":["changed"]}'); return value;
  } });
  assert.equal(result.passed, false); assert.equal(existsSync(join(f.registry, 'catalog.lock')), false);
  assert.ok(existsSync(join(f.run, 'result.json')));
});

test('missing, extra and aliased expected artifacts cannot become accepted output', async () => {
  for (const mode of ['missing', 'extra']) {
    const f = fixture(), build = f.action;
    const result = await runVerification({ ...f.options(), action: async context => {
      if (mode === 'missing') return { count: 0 };
      const value = await build(context); save(join(context.artifactRoot, 'surprise.json'), {}); return value;
    } });
    assert.equal(result.passed, false);
  }
  const f = fixture(); f.plan.artifacts = ['catalog.json', 'CATALOG.json'];
  await assert.rejects(runVerification(f.options())); assert.equal(existsSync(f.run), false);
});

test('an omitted verifier is rejected before side effects and a truthy result never passes', async () => {
  const f = fixture();
  await assert.rejects(runVerification({ ...f.options(), verify: {} })); assert.equal(existsSync(f.run), false);
  assert.equal((await runVerification({ ...f.options(), verify: { 'catalog-matches': () => 'true' } })).passed, false);
});

test('the externally supplied plan prevents dropping a required check in stored evidence', async () => {
  const f = fixture(); assert.equal((await runVerification(f.options())).passed, true);
  const start = join(f.run, 'started.json'), value = JSON.parse(readFileSync(start));
  value.plan.verifiers = []; chmodSync(start, 0o600); writeFileSync(start, JSON.stringify(value));
  assert.equal((await f.inspect()).passed, false);
});

test('changed contract identity, declared input set, or artifact contract is not silently accepted', async () => {
  const f = fixture(); assert.equal((await runVerification(f.options())).passed, true);
  for (const change of [
    plan => { plan.contract.version = '2'; },
    plan => { plan.inputs.files.pop(); },
    plan => { plan.artifacts = []; },
  ]) {
    const plan = structuredClone(f.plan); change(plan);
    assert.equal((await inspectVerificationRun({ directory: f.run, plan, verify: f.verify })).passed, false);
  }
});

test('a failed action preserves bounded private evidence without publishing raw exception text', async () => {
  const f = fixture();
  const report = await runVerification({ ...f.options(), action: () => { throw new Error('SECRET=do-not-publish'); } });
  assert.equal(report.passed, false);
  for (const file of ['started.json', 'result.json']) assert.doesNotMatch(readFileSync(join(f.run, file), 'utf8'), /do-not-publish/);
  assert.doesNotMatch(JSON.stringify(report), /do-not-publish/);
  assert.equal(existsSync(join(f.registry, 'catalog.lock')), false);
});

test('an incomplete receipt or failed check cannot be reported as successful', async () => {
  const f = fixture(); mkdirSync(f.run); save(join(f.run, 'started.json'), { schemaVersion: 'truthsrc.verification-run/v1' });
  assert.equal((await f.inspect()).passed, false); assert.equal(f.counts().builds, 0);
  const other = fixture(); assert.equal((await runVerification(other.options())).passed, true);
  assert.equal((await inspectVerificationRun({ directory: other.run, plan: other.plan,
    verify: { 'catalog-matches': () => false } })).passed, false);
});

test('inspection never calls execution, acquires a lease, or requires active lock files', async () => {
  const f = fixture(); assert.equal((await runVerification(f.options())).passed, true);
  save(join(f.registry, 'catalog.lock'), { owner: 'another owner now' });
  const bytes = readFileSync(join(f.registry, 'catalog.lock'));
  assert.equal((await f.inspect()).passed, true);
  assert.deepEqual(readFileSync(join(f.registry, 'catalog.lock')), bytes);
});

test('tampering with a held lock retains all locks and rejects completion', async () => {
  const f = fixture(), action = f.action;
  const result = await runVerification({ ...f.options(), action: async context => {
    const value = await action(context);
    writeFileSync(join(f.registry, 'catalog.lock'), '{"owner":"foreign"}'); return value;
  } });
  assert.equal(result.passed, false); assert.ok(existsSync(join(f.registry, 'catalog.lock')));
});

test('cancellation while an action is unsettled does not release its lease early', async () => {
  const f = fixture(), abort = new AbortController();
  let enter, finish;
  const entered = new Promise(resolve => { enter = resolve; });
  const pending = new Promise(resolve => { finish = resolve; });
  const running = runVerification({ ...f.options(), signal: abort.signal,
    action: async () => { enter(); await pending; return {}; } });
  await entered; abort.abort();
  assert.ok(existsSync(join(f.registry, 'catalog.lock')));
  assert.equal(existsSync(join(f.run, 'result.json')), false);
  finish(); assert.equal((await running).passed, false);
  assert.equal(existsSync(join(f.registry, 'catalog.lock')), false);
});

test('C2 native cancellation ignores signal own methods and getters without leaking leases', { timeout: 15000 }, async t => {
  for (const override of ['addEventListener', 'removeEventListener', 'getters'])
    for (const cancelled of [false, true]) await t.test(override + (cancelled ? ' cancelled' : ' completed'), async t => {
    const f = fixture(), controller = new AbortController(), handles = new Set(), open = fs.openSync, close = fs.closeSync;
    t.mock.method(fs, 'openSync', (...args) => {
      const fd = open(...args); if (String(args[0]).endsWith('catalog.lock')) handles.add(fd); return fd;
    });
    t.mock.method(fs, 'closeSync', fd => { handles.delete(fd); return close(fd); });
    t.after(() => {
      t.diagnostic('open lease descriptors at completion: ' + handles.size);
      for (const fd of handles) close(fd);
    });
    let calls = 0, enter, finish;
    const trap = () => { calls++; throw new Error('signal override executed'); };
    if (override === 'getters') {
      for (const key of ['addEventListener', 'removeEventListener', 'aborted', 'throwIfAborted', 'reason'])
        Object.defineProperty(controller.signal, key, { get: trap });
    } else Object.defineProperty(controller.signal, override, { value: trap });
    const entered = new Promise(resolve => { enter = resolve; }), pending = new Promise(resolve => { finish = resolve; });
    const running = runVerification({ ...f.options(), signal: controller.signal, action: async context => {
      enter(); if (cancelled) await pending;
      return f.action(context);
    } });
    try {
      if (cancelled) {
        await Promise.race([entered, running]); controller.abort();
        assert.ok(existsSync(join(f.registry, 'catalog.lock')));
        assert.equal(existsSync(join(f.run, 'result.json')), false); finish();
      }
      const report = await running;
      assert.equal(report.passed, !cancelled); assert.equal(calls, 0); assert.equal(handles.size, 0);
      const result = JSON.parse(readFileSync(join(f.run, 'result.json')));
      assert.equal(result.leaseReleased, true); assert.equal(result.resourcesStopped, true);
      assert.equal(result.cancelled, cancelled); assert.equal(existsSync(join(f.registry, 'catalog.lock')), false);
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    } finally { finish(); }
  });
});

test('C2 invalid signal brands and proxies are rejected before a lease or run directory exists', async () => {
  let calls = 0;
  const trap = () => { calls++; throw new Error('signal admission executed a getter or proxy'); };
  const { proxy, revoke } = Proxy.revocable(new AbortController().signal, {}); revoke();
  for (const signal of [new Proxy(new AbortController().signal, { get: trap, getPrototypeOf: trap }), proxy,
    Object.create(AbortSignal.prototype), Object.create(new Proxy(AbortSignal.prototype, { get: trap, getPrototypeOf: trap }))]) {
    const f = fixture();
    await assert.rejects(runVerification({ ...f.options(), signal }));
    assert.equal(existsSync(f.run), false); assert.equal(existsSync(f.registry), false);
  }
  const f = fixture(), controller = new AbortController(); controller.abort();
  Object.defineProperty(controller.signal, 'throwIfAborted', { value: () => {} });
  Object.defineProperty(controller.signal, 'aborted', { get: trap });
  await assert.rejects(runVerification({ ...f.options(), signal: controller.signal }));
  assert.equal(existsSync(f.run), false); assert.equal(existsSync(f.registry), false); assert.equal(calls, 0);
});

test('metadata and callback maps are captured before awaiting and getters never execute', async () => {
  const f = fixture(); let reads = 0;
  const options = { ...f.options() }; Object.defineProperty(options, 'plan', { enumerable: true, get() { reads++; return f.plan; } });
  await assert.rejects(runVerification(options)); assert.equal(reads, 0); assert.equal(existsSync(f.run), false);
  const verify = {}; Object.defineProperty(verify, 'catalog-matches', { enumerable: true, get() { reads++; return f.verify['catalog-matches']; } });
  await assert.rejects(runVerification({ ...f.options(), verify })); assert.equal(reads, 0);
  const opts = f.options(), running = runVerification(opts);
  f.plan.artifacts.push('later.json'); f.verify['catalog-matches'] = () => false;
  assert.equal((await running).passed, true);
});

test('input/artifact/lease overlap and unsafe metadata are refused before writing', async () => {
  for (const mutate of [
    f => { f.plan.inputs.trees[0].root = f.directory; },
    f => { f.lease.registry = f.run; },
    f => { f.plan.artifacts = ['../outside.json']; },
    f => { f.plan.verifiers[0].id = '__proto__'; },
    f => { f.plan.contract.extra = true; },
  ]) {
    const f = fixture(); mutate(f);
    await assert.rejects(runVerification(f.options())); assert.equal(existsSync(f.run), false);
  }
});

test('a verifier that mutates an artifact fails the final evidence comparison', async () => {
  const f = fixture();
  const result = await runVerification({ ...f.options(), verify: { 'catalog-matches': ({ artifactRoot }) => {
    writeFileSync(join(artifactRoot, 'catalog.json'), '["changed"]'); return true;
  } } });
  assert.equal(result.passed, false);
});

test('verifiers receive the same cancellation context and run only within owned execution', async () => {
  const f = fixture(); let calls = 0;
  const verify = { 'catalog-matches': async ({ signal }) => {
    calls++; signal.throwIfAborted();
    if (calls === 1) assert.ok(existsSync(join(f.registry, 'catalog.lock')));
    return true;
  } };
  assert.equal((await runVerification({ ...f.options(), verify })).passed, true);
  assert.equal(calls, 1, 'execution must not re-enter callbacks after releasing its lease');
  assert.equal((await inspectVerificationRun({ directory: f.run, plan: f.plan, verify })).passed, true);
  assert.equal(calls, 2);
});

test('synchronous callback data is detached before microtasks and returned thenables are never invoked', async () => {
  const f = fixture(), build = f.action; let getters = 0;
  const action = ({ artifactRoot }) => {
    save(join(artifactRoot, 'catalog.json'), ['TEA', 'COFFEE']);
    const value = { count: 2 }; queueMicrotask(() => { value.count = 3; }); return value;
  };
  assert.equal((await runVerification({ ...f.options(), action })).passed, true);
  for (const site of ['action', 'verify']) {
    const other = fixture();
    const thenable = { get then() { getters++; return done => done(true); } };
    const options = site === 'action' ? { ...other.options(), action: () => thenable }
      : { ...other.options(), verify: { 'catalog-matches': () => thenable } };
    assert.equal((await runVerification(options)).passed, false);
  }
  assert.equal(getters, 0);
});

test('invalid decorated callback promises settle before lease release', async () => {
  const f = fixture(); let enter, finish;
  const started = new Promise(resolve => { enter = resolve; });
  const work = new Promise(resolve => { finish = resolve; }); work.label = 'pending-build';
  const result = runVerification({ ...f.options(), action: () => { enter(); return work; } });
  await started; await new Promise(done => setImmediate(done));
  assert.ok(existsSync(join(f.registry, 'catalog.lock')));
  finish({}); assert.equal((await result).passed, false);
  assert.equal(existsSync(join(f.registry, 'catalog.lock')), false);
});

test('C1 proxy action and verifier promises retain ownership without invoking traps', { timeout: 5000 }, async t => {
  for (const site of ['action', 'verify']) await t.test(site, async t => {
    const f = fixture(), handles = new Set(), open = fs.openSync, close = fs.closeSync;
    t.mock.method(fs, 'openSync', (...args) => {
      const fd = open(...args); if (String(args[0]).endsWith('catalog.lock')) handles.add(fd); return fd;
    });
    t.mock.method(fs, 'closeSync', fd => { handles.delete(fd); return close(fd); });
    let finish, calls = 0, settled = false;
    const work = new Promise(resolve => { finish = resolve; }); work.then(() => { settled = true; });
    const trap = () => { calls++; throw new Error('proxy trap executed'); };
    const proxy = new Proxy(work, { get: trap, getPrototypeOf: trap, ownKeys: trap, getOwnPropertyDescriptor: trap });
    try {
      const report = await runVerification({ ...f.options(), ...(site === 'action' ? { action: () => proxy }
        : { verify: { 'catalog-matches': () => proxy } }) });
      assert.equal(report.passed, false); assert.equal(calls, 0); assert.equal(settled, false);
      assert.ok(report.diagnostics.includes('VERIFICATION_RESOURCES_UNVERIFIED'));
      const result = JSON.parse(readFileSync(join(f.run, 'result.json')));
      assert.equal(result.resourcesStopped, false); assert.equal(result.leaseReleased, false);
      assert.ok(existsSync(join(f.registry, 'catalog.lock'))); assert.equal(handles.size, 0);
    } finally { finish(); await work; }
  });
});

test('private evidence permission drift and malformed lease metadata cannot pass static inspection', async () => {
  const f = fixture(); assert.equal((await runVerification(f.options())).passed, true);
  chmodSync(f.run, 0o777); assert.equal((await f.inspect()).passed, false); chmodSync(f.run, 0o700);
  const startFile = join(f.run, 'started.json'), resultFile = join(f.run, 'result.json');
  const start = JSON.parse(readFileSync(startFile)), result = JSON.parse(readFileSync(resultFile));
  start.lease.lockNames = [];
  const bytes = Buffer.from(JSON.stringify(start, null, 2) + '\n'); chmodSync(startFile, 0o600); writeFileSync(startFile, bytes);
  result.started.bytes = bytes.length; result.started.sha256 = hash(bytes);
  chmodSync(resultFile, 0o600); writeFileSync(resultFile, JSON.stringify(result, null, 2) + '\n');
  assert.equal((await f.inspect()).passed, false);
});

test('queued artifact changes during the final event-loop drain cannot be sealed as passed', async () => {
  const f = fixture();
  const result = await runVerification({ ...f.options(), verify: { 'catalog-matches': ({ artifactRoot }) => {
    setImmediate(() => writeFileSync(join(artifactRoot, 'catalog.json'), '[]'));
    return true;
  } } });
  assert.equal(result.passed, false);
  assert.equal(JSON.parse(readFileSync(join(f.run, 'result.json'))).passed, false);
  assert.equal(existsSync(join(f.registry, 'catalog.lock')), false);
});

test('retained locks close their descriptors without unlinking another owner record', async t => {
  const f = fixture(), original = fs.openSync, close = fs.closeSync; const handles = new Set();
  t.mock.method(fs, 'openSync', (...args) => { const fd = original(...args); if (String(args[0]).endsWith('catalog.lock')) handles.add(fd); return fd; });
  t.mock.method(fs, 'closeSync', fd => { handles.delete(fd); return close(fd); });
  const result = await runVerification({ ...f.options(), action: () => {
    writeFileSync(join(f.registry, 'catalog.lock'), 'foreign'); throw new Error('failed');
  } });
  assert.equal(result.passed, false); assert.equal(handles.size, 0);
  assert.equal(readFileSync(join(f.registry, 'catalog.lock'), 'utf8'), 'foreign');
});

const processLane = { skip: process.platform !== 'darwin' || !existsSync('/usr/bin/sandbox-exec'), timeout: 30_000 };
function processFixture(f, script) {
  f.plan.processCount = 1;
  const profile = join(f.source, 'sandbox.sb');
  const policy = '(version 1)\n(allow default)\n(deny network*)\n(deny file-write*)\n(allow file-write* (literal "/dev/null"))\n';
  writeFileSync(profile, policy, { flag: 'wx' });
  return { executable: realpathSync(process.execPath), args: ['-e', script], cwd: f.source,
    env: { PATH: '/usr/bin:/bin', HOME: f.directory, TMPDIR: f.directory, NODE_V8_COVERAGE: '' }, timeoutMs: 3000,
    sandbox: { executable: '/usr/bin/sandbox-exec', profile, profileSha256: hash(policy) } };
}

test('optional sandbox process execution is composed and statically rechecked', processLane, async () => {
  const f = fixture(), args = processFixture(f, 'process.stdout.write("catalog process verified\\n")'), build = f.action;
  const result = await runVerification({ ...f.options(), action: async context => {
    const value = await build(context); assert.equal((await context.runProcess(args)).passed, true); return value;
  } });
  assert.equal(result.passed, true); assert.equal((await f.inspect()).passed, true);
  assert.equal(JSON.parse(readFileSync(join(f.run, 'result.json'))).processes.length, 1);
  chmodSync(join(f.run, 'process-001.stdout.log'), 0o600);
  writeFileSync(join(f.run, 'process-001.stdout.log'), 'tampered');
  assert.equal((await f.inspect()).passed, false);
});

test('a failed process cannot be hidden by an action returning success', processLane, async () => {
  const f = fixture(), args = processFixture(f, 'process.exit(3)'), build = f.action;
  const result = await runVerification({ ...f.options(), action: async context => {
    const value = await build(context); await context.runProcess(args); return value;
  } });
  assert.equal(result.passed, false); assert.equal(existsSync(join(f.registry, 'catalog.lock')), false);
});

test('failed process admission cannot crash an unawaited caller or retain a nonexistent child', processLane, async () => {
  const f = fixture(), args = processFixture(f, 'process.exit(0)'), module = new URL('../lib/verification/runner.mjs', import.meta.url).href;
  args.timeoutMs = 0;
  const code = `import { runVerification } from ${JSON.stringify(module)};
    import { existsSync, writeFileSync } from 'node:fs';
    import { join } from 'node:path';
    const options = ${JSON.stringify({ directory: f.run, plan: f.plan, lease: f.lease })};
    const result = await runVerification({ ...options, action: ({ artifactRoot, runProcess }) => {
      runProcess(${JSON.stringify(args)});
      writeFileSync(join(artifactRoot, 'catalog.json'), '["TEA","COFFEE"]');
      return {count:2};
    }, verify: {'catalog-matches': () => true} });
    await new Promise(done => setImmediate(done));
    console.log(JSON.stringify({passed:result.passed, lock:existsSync(${JSON.stringify(join(f.registry, 'catalog.lock'))})}));`;
  assert.deepEqual(JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8', timeout: 15000, env: { PATH: '/usr/bin:/bin', NODE_V8_COVERAGE: '' },
  })), { passed: false, lock: false });
});

test('fire-and-forget owned processes settle before release and late execution capabilities are revoked', processLane, async () => {
  const f = fixture(), args = processFixture(f, 'setTimeout(() => process.stdout.write("done"), 200)'), build = f.action;
  let runProcess;
  const result = await runVerification({ ...f.options(), action: async context => {
    runProcess = context.runProcess;
    context.runProcess(args); return build(context);
  } });
  assert.equal(result.passed, true); assert.equal(existsSync(join(f.registry, 'catalog.lock')), false);
  await assert.rejects(runProcess(args));
  assert.equal(existsSync(join(f.run, 'process-002.json')), false);
});
