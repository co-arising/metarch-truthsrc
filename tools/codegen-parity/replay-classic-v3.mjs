#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { runVerifiedProcess, processFailureState } from '../../lib/verification/process.mjs';
import { assertCanonicalPath, captureEvidenceFile, fingerprintEvidenceFile } from '../../lib/verification/files.mjs';
import { inventoryEvidence, compareEvidenceInventories } from '../../lib/verification/inventory.mjs';

// Four public generations and six public comparisons; no renderer or generator imports.
const J = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REF = J + '/test/reference/classic-cqrs-v3', FIX = J + '/test/fixtures/classic-cqrs-v3';
const variants = ['baseline', 'timestamp-int'], ancillary = ['anchors.json', 'truthsrc.ledger.json'];
const planned = variants.flatMap(v => ['a.generate', 'a.compare', 'b.generate', 'b.compare', 'sources.compare'].map(s => v + '.' + s));
const need = (ok, message) => { if (!ok) throw new Error(message); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = file => JSON.parse(captureEvidenceFile(file).value.toString('utf8'));
const pin = file => ({ file, ...fingerprintEvidenceFile(file) });
const samePaths = (found, expected) => Array.isArray(found) && found.length === expected.length &&
  new Set(found).size === found.length && found.every(file => expected.includes(file));
function save(file, data) {
  assertCanonicalPath(file, { kind: 'new' });
  fs.writeFileSync(file, Buffer.isBuffer(data) || typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
function newDir(dir) { assertCanonicalPath(dir, { kind: 'new' }); fs.mkdirSync(dir, { mode: 0o700 }); }
function sourcePaths() {
  const files = [], dirs = [];
  function visit(dir) {
    assertCanonicalPath(dir); dirs.push(dir);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      need(!entry.isSymbolicLink(), 'symlink in shipped source directories');
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && (/\.(?:mjs|js)$/u.test(entry.name) || entry.name === 'generator.json')) files.push(file);
    }
  }
  for (const dir of ['lib', 'generators', 'src/core', 'bin']) visit(path.join(J, dir));
  return { files, dirs };
}
function checkPins(rows) {
  for (const row of rows) {
    const actual = pin(row.file);
    need(actual.bytes === row.bytes && actual.sha256 === row.sha256, 'replay pin drift: ' + row.file);
  }
}
function archivePins() {
  const file = REF + '/manifest.json', manifest = json(file);
  need(Array.isArray(manifest.files), 'reference manifest files required');
  const rows = manifest.files.map(row => {
    need(typeof row.path === 'string' && path.posix.normalize(row.path) === row.path &&
      !row.path.includes('\\') && !row.path.split('/').includes('..') &&
      ['test/reference/classic-cqrs-v3/', 'test/fixtures/classic-cqrs-v3/'].some(root => row.path.startsWith(root)), 'reference manifest path outside replay assets');
    need(Number.isSafeInteger(row.bytes) && row.bytes >= 0 && /^[a-f0-9]{64}$/u.test(row.sha256), 'invalid archive pin');
    return { file: J + '/' + row.path, bytes: row.bytes, sha256: row.sha256 };
  });
  need(new Set(rows.map(row => row.file)).size === rows.length, 'duplicate archive paths');
  checkPins(rows); return [...rows, pin(file)];
}
const cleanDifferenceExit = r => r.code === 1 && r.passed === false && r.signal === null && r.launchError === null &&
  r.timedOut === false && r.cancelled === null && r.leftoverGroup === false && r.groupAliveAfter === false &&
  r.outputLimitExceeded === false && r.outputError === false && r.sandboxProfileUnchanged === true &&
  r.directChildClosed === true && r.directChildReaped === true && !r.terminationErrors.length && !r.groupSignals.length &&
  r.barrier.status === 'not-requested' && r.barrier.settled === true && r.barrier.error === null;
const unequal = message => Object.assign(new Error(message), { verdict: 'FAIL' });
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('Usage: node tools/codegen-parity/replay-classic-v3.mjs --out <new-absolute-root>\n' +
    'Node >=22.13; Darwin sandbox only. New direct child of physical repository .rounds/ or system temporary directory.\n' +
    'Four generate-products calls (120s each), six full-source comparisons (30s each); 720s wall from first call, 20s cleanup reserve. No tests or runtime certification.');
} else {
  let W, E, result, primary, deadline, scope, env, sandbox;
  let pins = [];
  const localPins = [], captures = [];
  function checkAll() {
    checkPins([...pins, ...localPins]);
    for (const row of captures) {
      compareEvidenceInventories(row.actual.inventory, inventoryEvidence(row.actual.root));
      compareEvidenceInventories(row.sources.inventory, inventoryEvidence(row.sources.root));
    }
  }
  async function command(id, stage, argv, actualCount = 19) {
    deadline ??= performance.now() + 720000;
    const base = E + '/' + id, call = { id, stage, argv, spawnAttempted: false, pinsBefore: false, pinsAfter: false };
    result.calls.push(call);
    let error, output;
    try {
      checkAll(); call.pinsBefore = true;
      call.timeoutMs = Math.min(stage === 'generate' ? 120000 : 30000, Math.floor(deadline - performance.now() - 20000));
      need(call.timeoutMs > 0, 'replay wall budget exhausted; no further call');
      const receipt = await runVerifiedProcess({ executable: process.execPath, args: argv, cwd: J, env, base, timeoutMs: call.timeoutMs, sandbox });
      call.spawnAttempted = true; call.rawReceipt = receipt; call.code = receipt.code; call.passed = receipt.passed;
      for (const key of ['receipt', 'stdout', 'stderr']) call[key] = pin(receipt.paths[key]);
      need(receipt.passed && receipt.code === 0 || stage === 'compare' && cleanDifferenceExit(receipt), 'public ' + stage + ' failed: ' + id + '; see captured stderr');
      output = json(receipt.paths.stdout);
      if (stage === 'generate') need(output.applied === true && output.readiness?.runnable === false, 'scaffold-only generation result required');
      else {
        call.comparison = { status: output.status, counts: output.counts, membership: output.membership };
        const c = output.counts, only = actualCount === 19 ? ancillary : [];
        need(output.schemaVersion === 'truthsrc.codegen-parity-report/v1' && output.expectedRoot === argv[2] && output.actualRoot === argv[4] &&
          output.scope?.file === argv[6] && samePaths(output.scope.definition.paths, scope.paths) &&
          samePaths(output.scope.definition.expectedOnly, []) && samePaths(output.scope.definition.actualOnly, only), 'exact comparison scope required');
        need(c?.comparedPaths === 17 && c.expectedInventoryFiles === 17 && c.actualInventoryFiles === actualCount &&
          c.expectedOnly === 0 && c.actualOnly === only.length && c.unavailableFiles === 0 &&
          Number.isSafeInteger(c.equalFiles) && c.equalFiles >= 0 && Number.isSafeInteger(c.differentFiles) && c.differentFiles >= 0 &&
          c.equalFiles + c.differentFiles === 17, 'complete comparison counts required');
        need(samePaths(Object.keys(output.membership ?? {}), ['expected', 'actual']) && ['expected', 'actual'].every(side =>
          samePaths(output.membership[side]?.missing, []) && samePaths(output.membership[side]?.unexpected, [])) &&
          samePaths(output.inventories?.expected?.map(row => row.path), scope.paths) &&
          samePaths(output.inventories?.actual?.map(row => row.path), [...scope.paths, ...only]) &&
          samePaths(output.files?.map(row => row.path), scope.paths) && output.files.every(row => ['equal', 'different'].includes(row.status)) &&
          output.files.filter(row => row.status === 'different').length === c.differentFiles, 'complete inventory sets and file membership required');
        if (c.differentFiles) {
          need(cleanDifferenceExit(receipt) && output.status === 'different', 'unsigned comparison difference');
          throw unequal('full Scala bytes differ: ' + id);
        }
        need(receipt.passed && receipt.code === 0 && output.status === 'equal' && c.equalFiles === 17, 'successful 17-file comparison required');
      }
    } catch (failure) {
      error = failure; const state = processFailureState(failure);
      if (state) { call.processFailureState = state; call.spawnAttempted ||= state.spawnAttempted === true; }
    } finally {
      if (call.spawnAttempted) for (const [key, suffix] of [['receipt', '.json'], ['stdout', '.stdout.log'], ['stderr', '.stderr.log']]) {
        try { call[key] ??= pin(base + suffix); }
        catch (failure) { (call.evidenceFailures ??= []).push(failure.message); error ??= failure; }
      }
      try { checkAll(); call.pinsAfter = true; }
      catch (failure) { call.pinFailure = failure.message; result.pinFailure ??= failure.message; error ??= failure; }
    }
    if (!error && performance.now() > deadline) error = new Error('replay wall budget exhausted');
    if (error) { call.failure = error.message; throw error; }
    return output;
  }
  function captureActual(variant, repeat, out, V) {
    const inventory = inventoryEvidence(out);
    need(samePaths(Object.keys(inventory), [...scope.paths, ...ancillary]), 'complete actual inventory of 19 files required');
    const parent = V + '/' + variant + '-' + repeat, root = parent + '/sources'; newDir(parent); newDir(root);
    for (const file of scope.paths) {
      const captured = captureEvidenceFile(out + '/' + file), before = inventory[file];
      need(captured.bytes === before.bytes && captured.sha256 === before.sha256, 'actual changed during source capture');
      fs.mkdirSync(path.dirname(root + '/' + file), { recursive: true, mode: 0o700 }); save(root + '/' + file, captured.value);
    }
    const sources = inventoryEvidence(root), declared = Object.fromEntries(scope.paths.map(file => [file, inventory[file]]));
    compareEvidenceInventories(declared, sources);
    const ledger = captureEvidenceFile(out + '/truthsrc.ledger.json'), before = inventory['truthsrc.ledger.json'];
    need(ledger.bytes === before.bytes && ledger.sha256 === before.sha256, 'ledger changed during capture');
    const file = E + '/' + variant + '-' + repeat + '.ledger.json'; save(file, ledger.value);
    const ledgerPin = pin(file); need(ledgerPin.bytes === ledger.bytes && ledgerPin.sha256 === ledger.sha256, 'raw ledger capture changed');
    localPins.push(ledgerPin);
    captures.push({ variant, repeat, actual: { root: out, inventory }, sources: { root, inventory: sources }, ledger: ledgerPin });
    checkAll(); return root;
  }
  try {
    const [major, minor] = process.versions.node.split('.').map(Number);
    need(major > 22 || major === 22 && minor >= 13, 'Node >=22.13 required');
    need(process.platform === 'darwin', 'Darwin sandbox required; no unsandboxed fallback');
    need(args.length === 2 && args[0] === '--out' && path.isAbsolute(args[1]) && path.resolve(args[1]) === args[1], 'explicit canonical --out required');
    assertCanonicalPath(J);
    const candidate = args[1], parent = path.dirname(candidate); assertCanonicalPath(parent);
    need(parent === J + '/.rounds' || parent === fs.realpathSync(tmpdir()), 'output parent must be physical .rounds/ or system temporary directory');
    newDir(candidate); W = candidate;
    const A = W + '/actual', RT = W + '/runtime', V = W + '/views'; E = W + '/evidence';
    result = { schemaVersion: 'truthsrc.classic-byte-replay/v3', verdict: 'BLOCKED', ready: false, comparedFilesPerInput: 17,
      readiness: { level: 'classic-scaffold-only', runnable: false }, plannedCalls: 10, calls: [], captures, ledgerChecks: [], finalizationFailures: [],
      budgets: { generateMs: 120000, compareMs: 30000, coreTotalCapsMs: 660000, wallMs: 720000, cleanupReserveMs: 20000 },
      boundary: 'Only baseline/timestamp-int, 17 full Scala files including two added unchanged-output surfaces. Not all input variations, whole-family parity, quality, compilation, finance or runtime certification. Anchors inventory-only, never normalized or byte-equality claimed; ledger raw-byte equality separately captured.' };
    for (const dir of [A, RT, E, V, RT + '/home', RT + '/tmp']) newDir(dir);
    const source = sourcePaths(), reference = archivePins(), scopeFile = REF + '/scope.json'; scope = json(scopeFile);
    need(scope.schemaVersion === 'truthsrc.codegen-parity-scope/v1' && samePaths(Object.keys(scope), ['schemaVersion', 'paths', 'expectedOnly', 'actualOnly']) &&
      Array.isArray(scope.paths) && scope.paths.length === 17 && new Set(scope.paths.map(file => typeof file === 'string' ? file.normalize('NFC').toLowerCase() : file)).size === 17 &&
      scope.paths.every(file => typeof file === 'string' && file.startsWith('app/') && file.endsWith('.scala') && path.posix.normalize(file) === file &&
        !file.includes('\\') && !file.split('/').includes('..')) && samePaths(scope.expectedOnly, []) && samePaths(scope.actualOnly, ancillary), 'explicit 17-Scala/19-actual scope required');
    const required = [scopeFile, REF + '/provenance.json', ...variants.map(v => FIX + '/request-' + v + '.json'),
      ...variants.flatMap(v => scope.paths.map(file => REF + '/' + v + '/' + file))];
    need(required.every(file => reference.some(row => row.file === file)), 'manifest must pin requests, scope, provenance and all 34 expected files');
    const options = J + '/test/fixtures/classic-cqrs-f1/options.json';
    const inputs = variants.map(v => J + '/test/fixtures/classic-cqrs-f1/' + v + '.json');
    pins = [...new Map([...source.files.map(pin), ...reference, ...inputs.map(pin), pin(options), pin(J + '/package.json'),
      pin(J + '/tools/codegen-parity.mjs'), pin(fileURLToPath(import.meta.url)), pin(process.execPath)].map(row => [row.file, row])).values()];
    save(E + '/source-before.json', pins); result.sourceBefore = pin(E + '/source-before.json'); localPins.push(result.sourceBefore);
    const viewScope = E + '/sources.scope.json'; save(viewScope, { schemaVersion: scope.schemaVersion, paths: scope.paths, expectedOnly: [], actualOnly: [] }); localPins.push(pin(viewScope));
    const dirs = new Set(source.dirs);
    for (const file of [...pins.map(row => row.file), ...localPins.map(row => row.file), E + '/placeholder', A + '/placeholder', RT + '/placeholder', V + '/placeholder']) {
      for (let dir = path.dirname(file); ; dir = path.dirname(dir)) { dirs.add(dir); if (dir === path.dirname(dir)) break; }
    }
    const q = JSON.stringify, system = ['/System/Library', '/usr/lib', '/Library/Apple/System/Library', '/private/var/db/dyld', '/usr/share/icu', '/private/var/db/timezone/zoneinfo'];
    const policy = '(version 1)\n(allow default)\n(deny network*)\n(deny file-write*)\n(deny file-read-data)\n' +
      '(allow file-read-data ' + system.map(dir => '(subpath ' + q(dir) + ')').join(' ') +
      ' (literal "/dev/null") (literal "/dev/random") (literal "/dev/urandom") (literal "/private/etc/localtime") ' +
      [...new Set([...pins.map(row => row.file), viewScope, ...dirs])].map(file => '(literal ' + q(file) + ')').join(' ') +
      ' (subpath ' + q(A) + ') (subpath ' + q(RT) + ') (subpath ' + q(V) + '))\n' +
      '(allow file-write* (subpath ' + q(A) + ') (subpath ' + q(RT) + '))\n';
    const profile = E + '/sandbox.sb'; save(profile, policy); localPins.push(pin(profile));
    sandbox = { executable: '/usr/bin/sandbox-exec', profile, profileSha256: hash(policy) };
    env = { HOME: RT + '/home', TMPDIR: RT + '/tmp', PATH: path.dirname(process.execPath) + ':/usr/bin:/bin',
      LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', TZ: 'UTC', NODE_V8_COVERAGE: '' };
    for (const variant of variants) {
      const views = [];
      for (const repeat of ['a', 'b']) {
        const out = A + '/' + variant + '-' + repeat; assertCanonicalPath(out, { kind: 'new' });
        await command(variant + '.' + repeat + '.generate', 'generate', [J + '/bin/truthsrc.js', 'generate-products', '--request', FIX + '/request-' + variant + '.json',
          '--generator', J + '/generators/scala-cqrs-classic-v3', '--out', out, '--options-json', options]);
        views.push(captureActual(variant, repeat, out, V));
        await command(variant + '.' + repeat + '.compare', 'compare', [J + '/tools/codegen-parity.mjs', '--expected', REF + '/' + variant, '--actual', out, '--scope', scopeFile]);
      }
      const pair = captures.filter(row => row.variant === variant), a = captureEvidenceFile(pair[0].ledger.file), b = captureEvidenceFile(pair[1].ledger.file);
      const ledgerCheck = { variant, a: pair[0].ledger, b: pair[1].ledger, equal: a.value.equals(b.value) };
      result.ledgerChecks.push(ledgerCheck); save(E + '/' + variant + '.ledger-equality.json', ledgerCheck); localPins.push(pin(E + '/' + variant + '.ledger-equality.json'));
      if (!ledgerCheck.equal) throw unequal('raw captured ledger bytes differ: ' + variant);
      await command(variant + '.sources.compare', 'compare', [J + '/tools/codegen-parity.mjs', '--expected', views[0], '--actual', views[1], '--scope', viewScope], 17);
    }
    result.verdict = 'PASS';
  } catch (error) { primary = error; }
  finally {
    if (W && result) {
      const finalFailure = error => { primary ??= error; result.finalizationFailures.push(error.message); result.verdict = 'BLOCKED'; };
      try { if (!result.sourceBefore) { save(E + '/source-before.json', pins); result.sourceBefore = pin(E + '/source-before.json'); } }
      catch (error) { finalFailure(error); }
      const after = pins.map(row => { try { return pin(row.file); } catch (error) { finalFailure(error); return { file: row.file, error: error.message }; } });
      try { save(E + '/source-after.json', after); result.sourceAfter = pin(E + '/source-after.json'); checkAll();
        need(deadline === undefined || performance.now() <= deadline, 'replay wall budget exhausted');
        result.integrity = { scopedPinsUnchanged: !result.pinFailure && !result.finalizationFailures.length && result.calls.every(call => call.pinsBefore && call.pinsAfter), pinCount: pins.length }; }
      catch (error) { finalFailure(error); result.integrity = { scopedPinsUnchanged: false, pinCount: pins.length }; }
      result.actualCalls = result.calls.filter(call => call.spawnAttempted).length;
      result.unexecuted = planned.filter(id => !result.calls.some(call => call.id === id && call.spawnAttempted)); result.remaining = result.unexecuted.length;
      try { fs.writeSync(1, JSON.stringify({ verdict: result.verdict, actualCalls: result.actualCalls, scopedPins: pins.length, completion: W + '/completion.json' }) + '\n'); }
      catch (error) { finalFailure(error); }
      if (primary) {
        result.verdict = primary.verdict === 'FAIL' && !result.pinFailure && !result.finalizationFailures.length ? 'FAIL' : 'BLOCKED'; result.failure = primary.message;
        try { save(E + '/final-failure.json', { verdict: result.verdict, failure: result.failure, actualCalls: result.actualCalls, unexecuted: result.unexecuted, remaining: result.remaining, finalizationFailures: result.finalizationFailures }); }
        catch (error) { finalFailure(error); }
      }
      if (result.verdict !== 'PASS') process.exitCode = result.verdict === 'FAIL' ? 1 : 2;
      try { save(W + '/completion.json', result); }
      catch (error) { finalFailure(error); result.failure = primary.message; process.exitCode = 2;
        try { save(E + '/completion-failure.json', result); } catch { /* outer supervisor must reject incomplete evidence */ } }
    } else if (primary) process.exitCode = 2;
    if (primary) { try { fs.writeSync(2, primary.message + '\n'); } catch { /* retain nonzero exit */ } }
  }
}
