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
