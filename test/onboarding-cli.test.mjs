import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MIN_NODE_VERSION, supportsNode, assertNodeRuntime } from '../lib/node-runtime.mjs';
import { projectFormatArgs, renderProjectResult, renderProjectError } from '../lib/cli-presentation.mjs';

const tool = fileURLToPath(new URL('../', import.meta.url));
const cli = join(tool, 'bin/truthsrc.js');
const pkg = JSON.parse(readFileSync(join(tool, 'package.json'), 'utf8'));
const sandbox = t => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'truthsrc-onboarding-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
};
function command(executable, args, cwd, expected = 0, env = process.env) {
  const result = spawnSync(executable, args, { cwd, env, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, expected, `${executable} ${args.join(' ')}\n${result.stderr}\n${result.stdout}`);
  return result;
}
const run = (cwd, args, expected = 0, entry = cli) => command(process.execPath, [entry, ...args], cwd, expected);
const json = (cwd, args, entry = cli) => JSON.parse(run(cwd, args, 0, entry).stdout);
function inventory(root, relative = '') {
  return readdirSync(join(root, relative)).sort().flatMap(name => {
    const file = join(relative, name), stat = lstatSync(join(root, file));
    return stat.isDirectory() ? inventory(root, file) : [[file, readFileSync(join(root, file)).toString('base64')]];
  });
}

// This is a pure comparison/gate check on the current Node, not a Node 22.13 smoke run.
test('Node version policy is pure and agrees with package engines', () => {
  assert.equal(MIN_NODE_VERSION, '22.13.0');
  assert.equal(pkg.engines.node, '>=' + MIN_NODE_VERSION);
  for (const version of ['22.13.0', 'v22.13.0', '22.23.4', '23.0.0', '24.0.0']) {
    assert.equal(supportsNode(version), true, version);
    assert.doesNotThrow(() => assertNodeRuntime(version));
  }
  for (const version of ['18.20.0', '20.19.0', '22.5.0', '22.12.99', '22.13', '22.13.0-rc.1', 'banana', '', null, {}, '999999999999999999999.0.0']) {
    assert.equal(supportsNode(version), false, String(version));
    assert.throws(() => assertNodeRuntime(version), /NODE_VERSION.*>=22\.13\.0/);
  }
});

test('help/version and simulated old-Node preflight need no application or SQLite modules', t => {
  const root = sandbox(t), isolated = join(root, 'tool');
  for (const file of ['bin/truthsrc.js', 'lib/node-runtime.mjs', 'package.json']) {
    mkdirSync(dirname(join(isolated, file)), { recursive: true });
    copyFileSync(join(tool, file), join(isolated, file));
  }
  const entry = join(isolated, 'bin/truthsrc.js'), before = inventory(root);
  for (const args of [[], ['--help'], ['help'], ['help', 'init'], ['init', '--help'], ['--version']]) {
    assert.ok(run(root, args, 0, entry).stdout.length);
  }
  const invoke = args => `Object.defineProperty(process.versions, 'node', { value: '22.12.0' });
    process.argv = ${JSON.stringify([process.execPath, entry, ...args])};
    await import(${JSON.stringify(pathToFileURL(entry).href)});`;
  const blocked = command(process.execPath, ['--input-type=module', '-e', invoke(['init', 'must-not-exist'])], root, 2);
  assert.match(blocked.stderr, /NODE_VERSION.*found 22\.12\.0/);
  assert.doesNotMatch(blocked.stderr, /ERR_MODULE_NOT_FOUND|ERR_UNKNOWN_BUILTIN_MODULE/);
  command(process.execPath, ['--input-type=module', '-e', invoke(['init', '--help'])], root);
  command(process.execPath, ['--input-type=module', '-e', invoke(['--version'])], root);
  assert.deepEqual(inventory(root), before);
});

test('all command help, unknown commands and duplicate/incomplete project flags are safe', t => {
  const root = sandbox(t);
  assert.equal(run(root, ['--version']).stdout.trim(), pkg.version);
  for (const name of ['init', 'compile', 'decompose', 'validate', 'roundtrip', 'generate', 'graph', 'compile-project', 'generate-project', 'status-project', 'query-project', 'verify-project', 'view-project', 'mcp']) {
    assert.match(run(root, [name, '--help']).stdout, new RegExp('truthsrc ' + name));
  }
  assert.match(run(root, ['verify-project', '--help']).stdout, /--requirements <json>/);
  assert.match(run(root, ['view-project', '--help']).stdout, /--tour <json>.*--knowledge <selector>/);
  assert.match(run(root, ['does-not-exist'], 2).stderr, /Unknown command/);
  for (const args of [
    ['init', 'counter', '--help'], ['init', 'counter', '--unknown'],
    ['init', 'counter', '--format'], ['init', 'counter', '--format', 'yaml'],
    ['init', 'counter', '--format', 'human', '--format', 'json'], ['init', 'counter', '--format=json'],
    ['compile-project', '--project', 'missing', '--project', 'other'],
    ['generate-project', '--project', 'missing', '--out', 'generated', '--plan', '--plan'],
    ['generate-project', '--project', 'missing', '--out', 'generated', '--update', '--update'],
    ['generate-project', '--project', 'missing', '--out', 'generated', '--unknown', 'x', '--format', 'human'],
    ['status-project', '--project', 'missing', '--out', 'generated', '--out', 'other'],
    ['query-project', '--project', 'missing', '--out', 'generated', '--knowledge', 'SetCount', '--bogus', 'x'],
  ]) {
    const result = run(root, args, 2);
    assert.ok(result.stderr.trim(), args.join(' '));
    assert.equal(result.stdout, '');
  }
  assert.deepEqual(readdirSync(root), []);
});

test('format extraction is strict and presentation accepts verify/view receipts without importing their modules', () => {
  const args = ['--project', 'x', '--format', 'human', '--out', 'y'];
  assert.deepEqual(projectFormatArgs(args), { args: ['--project', 'x', '--out', 'y'], format: 'human' });
  assert.deepEqual(projectFormatArgs(['counter']), { args: ['counter'], format: 'json' });
  assert.equal(args.length, 6);
  for (const bad of [['--format'], ['--format', 'yaml'], ['--format', 'human', '--format', 'human']]) assert.throws(() => projectFormatArgs(bad), /PROJECT_FORMAT/);
  const view = renderProjectResult('view-project', { file: '/tmp/new-map.html', snapshot: { source: 'source-sha', knowledge: 'graph-sha' }, passed: false });
  assert.match(view, /\/tmp\/new-map\.html/);
  assert.match(view, /snapshot\.source: source-sha/);
  assert.match(view, /passed=false/);
  assert.match(view, /静态快照/);
  assert.match(view, /runtimeVerified=false/);
  const verification = renderProjectResult('verify-project', { passed: false, snapshot: 'abc', checks: { 'required-span': false }, diagnostics: [{ code: 'MISSING', message: 'keep this whole diagnostic' }] });
  assert.match(verification, /required-span/);
  assert.match(verification, /keep this whole diagnostic/);
  assert.match(verification, /回锚 passed=false/);
  const hugePlan = { sources: [], validation: { hard: [], roundtrip: { ok: true } }, applied: false,
    plan: { entries: Array.from({ length: 50 }, (_, i) => ({ path: `file-${i}.scala`, kind: 'source', content: 'DO_NOT_DUMP_SOURCE'.repeat(100) })) } };
  const human = renderProjectResult('generate-project', hugePlan);
  assert.match(human, /45 项未展示/);
  assert.doesNotMatch(human, /DO_NOT_DUMP_SOURCE/);
  assert.ok(human.length < 2500);
  const message = 'ownership conflict\n' + 'diagnostic details\n'.repeat(100);
  assert.ok(renderProjectError('generate-project', new Error(message)).includes(message));
});

test('real Counter CLI keeps JSON contracts and completes human generation/query/update', t => {
  const root = sandbox(t), init = json(root, ['init', 'counter-lab']);
  assert.deepEqual(Object.keys(init).sort(), ['project', 'root', 'tree', 'validation']);
  assert.equal(init.validation.roundtrip.ok, true);
  assert.equal(existsSync(join(init.root, '.truthsrc')), false);
  const args = ['--project', init.project, '--out', join(init.root, 'generated')];
  const compiled = json(root, ['compile-project', '--project', init.project]);
  assert.deepEqual(json(root, ['compile-project', '--project', init.project, '--format', 'json']), compiled);
  assert.equal(compiled.applied, false);
  const plan = run(root, ['generate-project', ...args, '--plan', '--format', 'human']);
  assert.match(plan.stdout, /生成预览（未写入）/);
  assert.doesNotMatch(plan.stdout, /"content"|"canonical"|case class/);
  assert.equal(existsSync(args[3]), false);
  assert.equal(existsSync(join(init.root, '.truthsrc')), false);
  const generated = run(root, ['generate-project', ...args, '--format', 'human']);
  assert.match(generated.stdout, /代码生成完成/);
  assert.match(generated.stdout, /graph.snapshot/);
  const status = json(root, ['status-project', ...args]);
  assert.equal(status.synchronized, true);
  assert.equal(status.inputs.state, 'current');
  assert.equal(status.runtimeVerified, false);
  assert.deepEqual(json(root, ['status-project', ...args, '--format', 'json']), status);
  const humanStatus = run(root, ['status-project', ...args, '--format', 'human']).stdout;
  assert.match(humanStatus, /inputs=current.*evidence=verified.*synchronized=true/);
  assert.match(humanStatus, /runtimeVerified=false/);
  const forward = json(root, ['query-project', ...args, '--knowledge', 'SetCount']);
  assert.deepEqual(json(root, ['query-project', ...args, '--knowledge', 'SetCount', '--format', 'json']), forward);
  const humanQuery = run(root, ['query-project', ...args, '--knowledge', 'SetCount', '--format', 'human']).stdout;
  assert.match(humanQuery, /set-count\.slice\.yaml/);
  assert.match(humanQuery, /precision=span/);
  assert.match(humanQuery, /current=unchanged/);
  const loc = forward.result.flatMap(row => row.locations).find(row => row.file.endsWith('CounterRules.scala') && row.verification.spanVerified && row.span.text.startsWith('  def SetCount('));
  assert.ok(loc);
  const bytes = readFileSync(join(args[3], loc.file));
  assert.equal(bytes.subarray(loc.span.start, loc.span.end).toString('utf8'), loc.span.text);
  const line = bytes.subarray(0, loc.span.start).toString('utf8').split('\n').length;
  const reverse = json(root, ['query-project', ...args, '--file', loc.file, '--line', String(line)]);
  assert.equal(reverse.precision, 'span');
  assert.ok(reverse.result.some(row => row.origins.some(origin => origin.name === 'SetCount')));
  const candidates = run(root, ['query-project', ...args, '--file', loc.file, '--symbol', 'next0', '--format', 'human']).stdout;
  assert.match(candidates, /state=candidates-only · precision=file/);
  const unmatched = json(root, ['query-project', ...args, '--knowledge', 'not-a-real-identity']);
  assert.equal(unmatched.state, 'unmapped');
  const changedFile = join(init.tree, 'contexts/example/aggregates/counter/aggregate.yaml');
  const original = readFileSync(changedFile, 'utf8');
  assert.ok(original.includes('"default": "0"'));
  writeFileSync(changedFile, original.replace('"default": "0"', '"default": "2"'));
  assert.match(run(root, ['status-project', ...args, '--format', 'human']).stdout, /inputs=changed.*synchronized=false/);
  const before = inventory(args[3]);
  assert.match(run(root, ['generate-project', ...args, '--update', '--plan', '--format', 'human']).stdout, /更新动作/);
  assert.deepEqual(inventory(args[3]), before);
  json(root, ['generate-project', ...args, '--update']);
  assert.equal(json(root, ['status-project', ...args]).synchronized, true);
  assert.equal(json(root, ['query-project', ...args, '--file', loc.file, '--line', String(line)]).precision, 'span');
  assert.equal(json(root, ['generate-project', ...args, '--update']).result.written, 0);
  assert.match(run(root, ['init', 'second-counter', '--format', 'human']).stdout, /Counter 项目已创建/);
});

test('legacy compile/decompose/validate/roundtrip/generate/graph branches retain their contracts', t => {
  const root = sandbox(t), init = json(root, ['init', 'counter-lab']);
  const canonical = join(root, 'canonical.json');
  assert.match(run(root, ['compile', '--tree', init.tree, '--out', canonical]).stdout, /canonical\.json/);
  assert.match(run(root, ['validate', '--tree', init.tree]).stdout, /0 hard/);
  assert.match(run(root, ['roundtrip', '--tree', init.tree]).stdout, /roundtrip identity/);
  const decomposed = join(root, 'restored', 'example');
  run(root, ['decompose', '--canonical', canonical, '--tree', decomposed]);
  const second = join(root, 'second.json');
  run(root, ['compile', '--tree', decomposed, '--out', second]);
  assert.equal(readFileSync(canonical, 'utf8'), readFileSync(second, 'utf8'));
  assert.deepEqual(inventory(init.tree), inventory(decomposed));
  const gen = join(root, 'custom-generator'), out = join(root, 'custom-output');
  run(root, ['init-generator', gen]);
  const args = ['--in', canonical, '--generator', gen, '--out', out];
  assert.match(run(root, ['generate', ...args, '--plan']).stdout, /nothing written/);
  assert.equal(existsSync(out), false);
  assert.match(run(root, ['generate', ...args]).stdout, /ledger/);
  assert.equal(existsSync(join(out, 'anchors.json')), true);
  for (const source of [['--tree', init.tree], ['--canonical', canonical]]) {
    const db = join(root, source[0].slice(2) + '.sqlite');
    assert.match(run(root, ['graph', ...source, '--out', db]).stdout, /graph store/);
    assert.equal(existsSync(db), true);
  }
  assert.match(run(root, ['graph', '--tree', init.tree], 2).stderr, /explicit --out/);
  // A structural validation error still exits 1; roundtrip failure still exits 2.
  const atom = join(init.tree, 'contexts/example/aggregates/counter/aggregate.yaml');
  const valid = readFileSync(atom, 'utf8');
  assert.ok(valid.includes('"entity": "CounterEntity"'));
  writeFileSync(atom, valid.replace('"entity": "CounterEntity"', '"entity": ""'));
  assert.match(run(root, ['validate', '--tree', init.tree], 1).stdout, /hard/);
  // Roundtrip identity is distinct from semantic validation: these bytes still roundtrip.
  run(root, ['roundtrip', '--tree', init.tree]);
  const legacy = join(root, 'legacy');
  mkdirSync(join(legacy, 'inbox/eventStorming'), { recursive: true });
  writeFileSync(join(legacy, 'workshop.yaml'), 'schemaVersion: truthsrc/v1\nname: demo\n\n');
  assert.match(run(root, ['roundtrip', '--tree', legacy], 2).stderr, /roundtrip red/);
});

test('local tarball allowlist installs offline and runs without the source checkout', t => {
  const root = sandbox(t), packDir = join(root, 'pack'), prefix = join(root, 'prefix');
  mkdirSync(packDir);
  const env = { ...process.env, npm_config_cache: join(root, 'npm-cache'), npm_config_update_notifier: 'false' };
  const packed = JSON.parse(command('npm', ['pack', tool, '--offline', '--ignore-scripts', '--json', '--pack-destination', packDir], root, 0, env).stdout)[0];
  const paths = packed.files.map(file => file.path);
  for (const directory of ['lib/', 'src/', 'schema/', 'generators/', 'scaffold/', 'mcp/', 'docs/artifacts/scala-cqrs/']) assert.ok(paths.some(path => path.startsWith(directory)), directory);
  for (const file of ['bin/truthsrc.js', 'lib/cli-presentation.mjs', 'lib/node-runtime.mjs', 'scaffold/unified-project/truthsrc.project.json', 'README.md', 'TUTORIAL.md']) assert.ok(paths.includes(file), file);
  for (const path of paths) assert.doesNotMatch(path, /(^|\/)(\.[^/]+|test|target|cache|__pycache__|node_modules)(\/|$)|\.(bak|tmp|pem|key|tgz|sqlite(?:-wal|-shm)?|db|log)$/);
  assert.ok(!paths.includes('canonical.json'));
  command('npm', ['install', '--prefix', prefix, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', join(packDir, packed.filename)], root, 0, env);
  const installed = join(prefix, 'node_modules/@madpolaris/truthsrc');
  assert.equal(lstatSync(installed).isSymbolicLink(), false);
  // Move the installed prefix to prove entry/resource paths are not bound to its installation path.
  const moved = join(root, 'relocated-prefix');
  renameSync(prefix, moved);
  const entry = join(moved, 'node_modules/@madpolaris/truthsrc/bin/truthsrc.js');
  assert.equal(run(root, ['--version'], 0, entry).stdout.trim(), pkg.version);
  const artifactCheck = join(moved, 'node_modules/@madpolaris/truthsrc/tools/artifact-docs-check.mjs');
  const artifactReport = JSON.parse(command(process.execPath, [artifactCheck, '--local'], root).stdout);
  assert.equal(artifactReport.passed, true);
  assert.equal(artifactReport.externalSourcesReverified, false);
  assert.equal(artifactReport.capabilities.calibrated, true);
  assert.equal(artifactReport.capabilities.producers.total, artifactReport.generators);
  assert.equal(artifactReport.capabilities.js.code.finalApproved.categories, 0);
  const capabilityMatrix = join(moved, 'node_modules/@madpolaris/truthsrc/docs/artifacts/CAPABILITY-MATRIX.md');
  assert.match(readFileSync(capabilityMatrix, 'utf8'), /生成入口反向覆盖/);
  const artifactIndex = join(moved, 'node_modules/@madpolaris/truthsrc/docs/artifacts/scala-cqrs/README.md');
  assert.ok(readFileSync(artifactIndex, 'utf8').includes('端口'));
  const provenance = join(moved, 'node_modules/@madpolaris/truthsrc/lib/handwritten-provenance.mjs');
  const handRoot = join(root, 'independent-handwritten');
  mkdirSync(handRoot);
  writeFileSync(join(handRoot, 'Policy.scala'), 'object Policy { def allowed = true }\n');
  const verifyHandwritten = `
    import { verifyHandwrittenSources } from ${JSON.stringify(pathToFileURL(provenance).href)};
    const result = await verifyHandwrittenSources(${JSON.stringify(handRoot)}, {
      documents: [{ id: 'sample', schemaVersion: 'example/v1', value: { rule: { version: '1', name: 'Eligibility' } } }]
    }, [{ file: 'Policy.scala', relation: 'implements', rationale: 'Independent sample policy', sources: ['source:sample#/rule'] }],
      { generator: { id: 'independent-source-map', version: '1' }, allowedRelations: ['implements'] });
    console.log(JSON.stringify({ files: Object.keys(result.inventory).length,
      relation: result.semanticMapping, symbolSpanVerified: result.symbolSpanVerified }));`;
  const handwritten = JSON.parse(command(process.execPath, ['--input-type=module', '-e', verifyHandwritten], root).stdout);
  assert.deepEqual(handwritten, { files: 1, relation: 'explicit-owner-declared-not-inferred', symbolSpanVerified: false });
  assert.deepEqual(readdirSync(handRoot), ['Policy.scala']);
  const verificationRoot = join(root, 'independent-verification');
  mkdirSync(verificationRoot);
  const verificationModule = name => pathToFileURL(join(moved, 'node_modules/@madpolaris/truthsrc/lib/verification', name + '.mjs')).href;
  const verification = `
    import assert from 'node:assert/strict';
    import { createHash } from 'node:crypto';
    import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
    import { dirname, join, relative } from 'node:path';
    import { captureEvidenceFile } from ${JSON.stringify(verificationModule('files'))};
    import { verifyToolingOwnership } from ${JSON.stringify(verificationModule('tooling-ownership'))};
    import { parseWorkerTranscript, validateWorkerLifecycle } from ${JSON.stringify(verificationModule('worker-evidence'))};
    import { runVerifiedProcess, inspectProcessEvidence } from ${JSON.stringify(verificationModule('process'))};
    const root = ${JSON.stringify(verificationRoot)};
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    const document = join(root, 'sample.json'), text = '{"price":1.25}\\n';
    writeFileSync(document, text, { flag: 'wx' });
    const captured = captureEvidenceFile(document, { parse: bytes => JSON.parse(bytes) });
    assert.equal(captured.sha256, hash(text)); assert.equal(captured.value.price, 1.25);
    const scripts = join(root, 'scripts'); mkdirSync(scripts);
    const publicRoot = ${JSON.stringify(join(moved, 'node_modules/@madpolaris/truthsrc'))};
    let specifier = relative(scripts, join(publicRoot, 'lib/verification/files.mjs')).split('\\\\').join('/');
    if (!specifier.startsWith('.')) specifier = './' + specifier;
    const literal = 'import ' + JSON.stringify(specifier) + ';';
    writeFileSync(join(scripts, 'audit.mjs'), literal + '\\nthrow new Error("not executed");\\n', { flag: 'wx' });
    const ownership = verifyToolingOwnership({ root, sourceRoots: { publicTool: publicRoot }, candidateFiles: ['scripts/audit.mjs'],
      inventory: { schemaVersion: 'truthsrc.tooling-ownership/v1', toolRoots: ['scripts'], scope: 'Independent installed consumer', entries: [{
        file: 'scripts/audit.mjs', lifecycle: 'current', provenance: { kind: 'engineering-authored', basis: 'Independent example tool' },
        responsibility: { summary: 'Capture explicit files', owners: ['example maintainers'], nature: 'adapter',
          mechanism: 'Public file evidence', policy: 'Example owner chooses paths' },
        consumers: [{ file: 'scripts/audit.mjs', kind: 'entry', evidence: literal, note: 'Literal declaration only, not executed' }],
        publicMechanism: { status: 'migrated', note: 'Installed package resolves independently', targets: [{
          sourceRoot: 'publicTool', file: 'lib/verification/files.mjs', consumer: 'scripts/audit.mjs', specifier
        }] }
      }] } });
    assert.equal(ownership.passed, true); assert.equal(ownership.toolCount, 1); assert.equal(ownership.executionVerified, false);
    const rows = parseWorkerTranscript(Buffer.from([
      { kind: 'worker-started', pid: 777 }, { id: 1, op: 'close' },
      { id: 1, ok: true, result: { closed: true } },
      { kind: 'worker-exited', pid: 777, exitCode: 0, waited: true }
    ].map(row => JSON.stringify(row)).join('\\n') + '\\n'));
    validateWorkerLifecycle({ rows, receipt: { schemaVersion: 'sample.worker/v1', pid: 777, closed: true, job: 'independent' },
      expectedReceipt: { schemaVersion: 'sample.worker/v1', job: 'independent' }, requireSuccessfulCloseExchange: true });
    let processExecuted = false;
    if (process.platform === 'darwin' && existsSync('/usr/bin/sandbox-exec')) {
      const profile = join(root, 'sandbox.sb');
      const policy = '(version 1)\\n(allow default)\\n(deny network*)\\n(deny file-write*)\\n(allow file-write* (literal "/dev/null"))\\n';
      writeFileSync(profile, policy, { flag: 'wx' });
      const base = join(root, 'process');
      const receipt = await runVerifiedProcess({ executable: realpathSync(process.execPath),
        args: ['-e', 'process.stdout.write("independent-public-process\\\\n")'], cwd: root,
        env: { HOME: root, TMPDIR: root, PATH: '/usr/bin:/bin', NODE_V8_COVERAGE: '' },
        base, timeoutMs: 5000, sandbox: { executable: '/usr/bin/sandbox-exec', profile, profileSha256: hash(policy) } });
      assert.equal(receipt.schemaVersion, 'truthsrc.verified-process/v1'); assert.equal(receipt.passed, true);
      assert.deepEqual(inspectProcessEvidence(base).receipt, receipt); processExecuted = true;
    } else {
      await assert.rejects(runVerifiedProcess({}), /sandbox|Darwin|darwin|platform/);
    }
    console.log(JSON.stringify({ captured: true, workerValidated: true, ownershipValidated: true, processExecuted, bankCheckoutRequired: false }));
  `;
  const verificationResult = JSON.parse(command(process.execPath, ['--input-type=module', '-e', verification], root,
    0, { PATH: '/usr/bin:/bin', NODE_V8_COVERAGE: '' }).stdout);
  assert.deepEqual(verificationResult, { captured: true, workerValidated: true, ownershipValidated: true,
    processExecuted: process.platform === 'darwin' && existsSync('/usr/bin/sandbox-exec'), bankCheckoutRequired: false });
  const lifecycleEntry = join(moved, 'node_modules/@madpolaris/truthsrc/lib/verification/runner.mjs');
  const lifecycleExample = join(moved, 'node_modules/@madpolaris/truthsrc/scaffold/verification-project/verification.mjs');
  const lifecycle = `
    import assert from 'node:assert/strict';
    import { chmodSync, cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
    import { register } from 'node:module';
    import { dirname, join } from 'node:path';
    import { pathToFileURL } from 'node:url';
    const root = ${JSON.stringify(root)}, installed = ${JSON.stringify(join(moved, 'node_modules/@madpolaris/truthsrc'))};
    const example = join(root, 'standalone-catalog');
    cpSync(join(installed, 'scaffold/verification-project'), example, { recursive: true, errorOnExist: true });
    const allow = [installed, example].map(path => pathToFileURL(path + '/').href);
    const loader = 'export async function resolve(specifier, context, next) { const result = await next(specifier, context); ' +
      'if (result.url.startsWith("file:") && !' + JSON.stringify(allow) + '.some(root => result.url.startsWith(root))) ' +
      'throw new Error("source checkout fallback forbidden"); return result; }';
    register('data:text/javascript,' + encodeURIComponent(loader), import.meta.url);
    const { runVerification, inspectVerificationRun } = await import(${JSON.stringify(pathToFileURL(lifecycleEntry).href)});
    const { catalogVerification } = await import(pathToFileURL(join(example, 'verification.mjs')));
    const runs = join(root, 'catalog-runs'); mkdirSync(runs);
    const options = catalogVerification(join(runs, 'first'));
    const report = await runVerification(options); assert.equal(report.passed, true);
    const inspect = () => inspectVerificationRun({ directory: options.directory, plan: options.plan, verify: options.verify });
    assert.equal((await inspect()).passed, true); assert.equal((await inspect()).passed, true);
    assert.equal(readdirSync(options.lease.registry).filter(name => name.endsWith('.lock')).length, 0);
    await assert.rejects(runVerification(options));
    const output = join(options.directory, 'artifacts/catalog.mjs');
    writeFileSync(output, 'export const labels = Object.freeze([]); export const count = 0;\\n');
    assert.equal((await inspect()).passed, false);
    const second = catalogVerification(join(runs, 'second'));
    assert.equal((await runVerification(second)).passed, true);
    writeFileSync(join(example, 'new-input.json'), '{}');
    assert.equal((await inspectVerificationRun({ directory: second.directory, plan: second.plan, verify: second.verify })).passed, false);
    console.log(JSON.stringify({ built: true, independentlyVerified: true, leaseReleased: true,
      staleArtifactRejected: true, addedInputRejected: true, sourceCheckoutRequired: false }));
  `;
  assert.ok(paths.includes('lib/verification/runner.mjs'));
  assert.ok(paths.includes('scaffold/verification-project/verification.mjs'));
  assert.deepEqual(JSON.parse(command(process.execPath, ['--input-type=module', '-e', lifecycle], root,
    0, { PATH: '/usr/bin:/bin', NODE_V8_COVERAGE: '' }).stdout), {
    built: true, independentlyVerified: true, leaseReleased: true, staleArtifactRejected: true,
    addedInputRejected: true, sourceCheckoutRequired: false,
  });
  const targetRoot = join(moved, 'node_modules/@madpolaris/truthsrc');
  const targetContracts = `
    import assert from 'node:assert/strict';
    import { register } from 'node:module';
    import { pathToFileURL } from 'node:url';
    const installed = ${JSON.stringify(targetRoot)};
    const allowed = pathToFileURL(installed + '/').href;
    register('data:text/javascript,' + encodeURIComponent('export async function resolve(s,c,n) { const r = await n(s,c); ' +
      'if(r.url.startsWith("file:") && !r.url.startsWith(' + JSON.stringify(allowed) + ')) throw Error("checkout fallback"); return r; }'), import.meta.url);
    const { MODULAR_CANDIDATE, targetProfile } = await import(pathToFileURL(installed + '/lib/scala-target/profiles.mjs'));
    const { resolveName, resolveNameSet, resolveArtifactPath } = await import(pathToFileURL(installed + '/lib/scala-target/naming.mjs'));
    const { buildTargetModel } = await import(pathToFileURL(installed + '/lib/scala-target/model.mjs'));
    const entry = { knowledgeId: 'source:catalog#/item', scope: 'example.catalog', space: 'scala-type',
      spelling: 'HTTP-item', binding: null, prefix: [], suffix: [] };
    assert.equal(resolveName({ profile: MODULAR_CANDIDATE, ...entry }).name, 'HttpItem');
    assert.equal(resolveName({ profile: MODULAR_CANDIDATE, ...entry, space: 'wire' }).name, 'HTTP-item');
    assert.throws(() => resolveNameSet({ profile: MODULAR_CANDIDATE, names: [entry, { ...entry,
      knowledgeId: 'source:catalog#/other', spelling: 'Http_item' }], reserved: [] }), error => error.diagnostic.code === 'TARGET_NAME_COLLISION');
    assert.equal(resolveArtifactPath({ profile: MODULAR_CANDIDATE, module: 'kernel', packageName: 'example.catalog', typeName: 'HttpItem' }),
      'modules/kernel/src/main/scala/example/catalog/HttpItem.scala');
    const model = buildTargetModel({ schemaVersion: 'truthsrc.scala-target-model/v1', profile: MODULAR_CANDIDATE,
      contexts: [{ id: 'Catalog', packageName: 'example.catalog' }], values: [{
        ref: { context: 'Catalog', kind: 'type', owner: [], id: 'item-id' }, spelling: 'HTTP-item', binding: null,
        module: 'kernel', shape: 'record', fileStem: null, variants: [], fields: [{
          id: 'wire-value', spelling: 'wire-value', binding: null, valueType: { form: 'primitive', name: 'string' }
        }]
      }], ports: [], components: [], bindings: [] });
    assert.equal(model.status, 'candidate');
    assert.equal(model.values[0].ref.id, 'item-id');
    assert.equal(model.values[0].name, 'HttpItem');
    assert.equal(model.values[0].fields[0].name, 'wireValue');
    assert.deepEqual(model.files, ['modules/kernel/src/main/scala/example/catalog/domain/values/HttpItem.scala']);
    assert.equal(targetProfile(MODULAR_CANDIDATE).generator, null);
    assert.equal(targetProfile(MODULAR_CANDIDATE).approval, null);
    console.log(JSON.stringify({ installed: true, collisionRejected: true, stableWire: true, candidateOnly: true }));
  `;
  assert.deepEqual(JSON.parse(command(process.execPath, ['--input-type=module', '-e', targetContracts], root,
    0, { PATH: '/usr/bin:/bin', NODE_V8_COVERAGE: '' }).stdout), {
    installed: true, collisionRejected: true, stableWire: true, candidateOnly: true,
  });
  const familyConsumer = `
    import assert from 'node:assert/strict';
    import { register } from 'node:module';
    import { cpSync, readFileSync } from 'node:fs';
    import { join } from 'node:path';
    import { pathToFileURL } from 'node:url';
    const installed = ${JSON.stringify(targetRoot)};
    const allowed = pathToFileURL(installed + '/').href;
    register('data:text/javascript,' + encodeURIComponent('export async function resolve(s,c,n) { const r = await n(s,c); ' +
      'if(r.url.startsWith("file:") && !r.url.startsWith(' + JSON.stringify(allowed) + ')) throw Error("checkout fallback"); return r; }'), import.meta.url);
    const { projectCli } = await import(pathToFileURL(join(installed, 'lib/project/cli.mjs')));
    const { verifyProject } = await import(pathToFileURL(join(installed, 'lib/project/verify.mjs')));
    const { queryProject } = await import(pathToFileURL(join(installed, 'lib/project/query.mjs')));
    const sample = ${JSON.stringify(join(root, 'installed-domain-kernel'))};
    cpSync(join(installed, 'scaffold/domain-kernel-project'), sample, { recursive: true, errorOnExist: true, force: false });
    const project = join(sample, 'truthsrc.project.json'), out = join(sample, 'generated');
    const args = ['--project', project, '--out', out];
    const plan = await projectCli('generate-project', [...args, '--plan']);
    assert.equal(plan.applied, false);
    assert.equal(plan.plan.generator.id, 'scala-cqrs-domain-kernel');
    assert.equal((await projectCli('generate-project', args)).applied, true);
    for (const source of plan.plan.entries) assert.equal(readFileSync(join(out, source.path), 'utf8'), source.content);
    const verified = verifyProject({ project, out });
    assert.equal(verified.passed, true, JSON.stringify(verified.diagnostics));
    assert.equal(verified.runtimeVerified, false);
    const anchors = JSON.parse(readFileSync(join(out, 'anchors.json'))).anchors;
    const pair = Object.entries(anchors).flatMap(([knowledge, locations]) => locations.map(location => ({ knowledge, location })))
      .find(row => row.location.span && row.location.file.endsWith('/CounterState.scala'));
    assert.ok(pair);
    const bytes = readFileSync(join(out, pair.location.file));
    const line = bytes.subarray(0, pair.location.span.start).toString('utf8').split('\\n').length;
    const reverse = queryProject({ project, out, file: pair.location.file, line });
    assert.equal(reverse.precision, 'span');
    assert.ok(reverse.result.some(row => row.knowledge === pair.knowledge && row.origins.some(origin => origin.file && origin.relation !== 'unresolved')));
    assert.equal((await projectCli('generate-project', [...args, '--update'])).result.written, 0);
    console.log(JSON.stringify({ generated: true, sourceVerified: true, reverseMapped: true, runtimeVerified: false, checkoutFallback: false }));
  `;
  assert.ok(paths.includes('generators/scala-cqrs-domain-kernel-v1/generator.json'));
  assert.ok(paths.includes('scaffold/domain-kernel-project/truthsrc.project.json'));
  assert.deepEqual(JSON.parse(command(process.execPath, ['--input-type=module', '-e', familyConsumer], root,
    0, { PATH: '/usr/bin:/bin', NODE_V8_COVERAGE: '' }).stdout), {
    generated: true, sourceVerified: true, reverseMapped: true, runtimeVerified: false, checkoutFallback: false,
  });
  const aggregateConsumer = `
    import assert from 'node:assert/strict';
    import { register } from 'node:module';
    import { cpSync, readFileSync } from 'node:fs';
    import { join } from 'node:path';
    import { pathToFileURL } from 'node:url';
    const installed = ${JSON.stringify(targetRoot)};
    const allowed = pathToFileURL(installed + '/').href;
    register('data:text/javascript,' + encodeURIComponent('export async function resolve(s,c,n) { const r = await n(s,c); ' +
      'if(r.url.startsWith("file:") && !r.url.startsWith(' + JSON.stringify(allowed) + ')) throw Error("checkout fallback"); return r; }'), import.meta.url);
    const { projectCli } = await import(pathToFileURL(join(installed, 'lib/project/cli.mjs')));
    const { verifyProject } = await import(pathToFileURL(join(installed, 'lib/project/verify.mjs')));
    const { queryProject } = await import(pathToFileURL(join(installed, 'lib/project/query.mjs')));
    const sample = ${JSON.stringify(join(root, 'installed-aggregate-core'))};
    cpSync(join(installed, 'scaffold/aggregate-core-project'), sample, { recursive: true, errorOnExist: true, force: false });
    const project = join(sample, 'truthsrc.project.json'), out = join(sample, 'generated');
    const args = ['--project', project, '--out', out];
    const plan = await projectCli('generate-project', [...args, '--plan']);
    assert.equal(plan.applied, false);
    assert.equal(plan.plan.generator.id, 'scala-cqrs-aggregate-core');
    assert.equal((await projectCli('generate-project', args)).applied, true);
    for (const source of plan.plan.entries) assert.equal(readFileSync(join(out, source.path), 'utf8'), source.content);
    const verified = verifyProject({ project, out });
    assert.equal(verified.passed, true, JSON.stringify(verified.diagnostics));
    assert.equal(verified.runtimeVerified, false);
    const anchors = JSON.parse(readFileSync(join(out, 'anchors.json'))).anchors;
    for (const filename of ['WarehouseRules.scala', 'WarehouseEventHandler.scala', 'WarehouseAggregate.scala']) {
      const pair = Object.entries(anchors).flatMap(([knowledge, locations]) => locations.map(location => ({ knowledge, location })))
        .find(row => row.location.span && row.location.file.endsWith('/' + filename));
      assert.ok(pair, filename);
      const bytes = readFileSync(join(out, pair.location.file));
      const line = bytes.subarray(0, pair.location.span.start).toString('utf8').split('\\n').length;
      const reverse = queryProject({ project, out, file: pair.location.file, line });
      assert.equal(reverse.precision, 'span');
      assert.ok(reverse.result.some(row => row.knowledge === pair.knowledge && row.origins.some(origin => origin.file && origin.relation !== 'unresolved')));
    }
    assert.equal((await projectCli('generate-project', [...args, '--update'])).result.written, 0);
    console.log(JSON.stringify({ generated: true, sourceVerified: true, pureAndActorMapped: true, runtimeVerified: false, checkoutFallback: false }));
  `;
  assert.ok(paths.includes('generators/scala-cqrs-aggregate-core-v1/generator.json'));
  assert.ok(paths.includes('scaffold/aggregate-core-project/truthsrc.project.json'));
  assert.ok(!paths.some(path => path.startsWith('test/reference/aggregate-core/')));
  assert.deepEqual(JSON.parse(command(process.execPath, ['--input-type=module', '-e', aggregateConsumer], root,
    0, { PATH: '/usr/bin:/bin', NODE_V8_COVERAGE: '' }).stdout), {
    generated: true, sourceVerified: true, pureAndActorMapped: true, runtimeVerified: false, checkoutFallback: false,
  });
  const created = json(root, ['init', 'packed-counter'], entry);
  const args = ['--project', created.project, '--out', join(created.root, 'generated')];
  assert.equal(json(root, ['generate-project', ...args], entry).applied, true);
  assert.equal(json(root, ['status-project', ...args], entry).synchronized, true);
  assert.ok(json(root, ['query-project', ...args, '--knowledge', 'SetCount'], entry).result.length);
  assert.match(run(root, ['query-project', ...args, '--knowledge', 'SetCount', '--format', 'human'], 0, entry).stdout, /set-count\.slice\.yaml/);
  // Source-prefix install is a separate smoke; it may be a symlink and does not prove tarball completeness.
  const sourcePrefix = join(root, 'source-prefix');
  command('npm', ['install', '--prefix', sourcePrefix, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', tool], root, 0, env);
  const sourceEntry = join(sourcePrefix, 'node_modules/@madpolaris/truthsrc/bin/truthsrc.js');
  const sourceInit = json(root, ['init', 'source-counter'], sourceEntry);
  assert.equal(json(root, ['generate-project', '--project', sourceInit.project, '--out', join(sourceInit.root, 'generated')], sourceEntry).applied, true);
});
