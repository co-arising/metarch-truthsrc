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

// Four public generations and six public comparisons; no producer/builder imports.
const J = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REF = J + '/test/reference/classic-cqrs-v4', FIX = J + '/test/fixtures/classic-cqrs-v4';
const F1 = J + '/test/fixtures/classic-cqrs-f1', options = F1 + '/options.json';
const variants = ['baseline', 'timestamp-int'], ancillary = ['anchors.json', 'truthsrc.ledger.json'];
const added = ['app/net/imadz/banking/application/aggregates/repository/CreditBalanceRepository.scala',
  'app/net/imadz/banking/infrastructure/repositories/aggregate/CreditBalanceRepositoryImpl.scala'];
const planned = variants.flatMap(v => ['a.generate', 'a.compare', 'b.generate', 'b.compare', 'sources.compare'].map(s => v + '.' + s));
const need = (ok, message) => { if (!ok) throw new Error(message); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = file => ({ file, ...fingerprintEvidenceFile(file) });
const fold = text => text.normalize('NFC').toLowerCase();
const samePaths = (found, expected) => Array.isArray(found) && found.length === expected.length &&
  new Set(found).size === found.length && found.every(file => expected.includes(file));
const relativePath = file => typeof file === 'string' && file.isWellFormed() && file.length > 0 &&
  !/[\x00-\x1f\x7f-\x9f\\]/u.test(file) && !path.posix.isAbsolute(file) && !path.win32.isAbsolute(file) &&
  path.posix.normalize(file) === file && file.split('/').every(part => part && part !== '.' && part !== '..');
const fingerprint = row => ({ bytes: row.bytes, sha256: row.sha256 });
function captureJson(file) {
  const captured = captureEvidenceFile(file);
  return { pin: { file, ...fingerprint(captured) }, value: JSON.parse(captured.value.toString('utf8')) };
}
function save(file, data) {
  assertCanonicalPath(file, { kind: 'new' });
  fs.writeFileSync(file, Buffer.isBuffer(data) || typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
function newDir(dir) { assertCanonicalPath(dir, { kind: 'new' }); fs.mkdirSync(dir, { mode: 0o700 }); }
function sourcePaths() {
  const files = [], dirs = [];
  function visit(dir) {
    assertCanonicalPath(dir); dirs.push(dir);
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    need(new Set(entries.map(entry => fold(entry.name))).size === entries.length, 'aliases in shipped source directories');
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      need(!entry.isSymbolicLink() && (entry.isDirectory() || entry.isFile()), 'unsafe entry in shipped source directories');
      if (entry.isDirectory()) visit(file);
      else if (/\.(?:mjs|js)$/u.test(entry.name) || entry.name === 'generator.json') files.push(file);
    }
  }
  // Deliberately never traverse docs (including every old baseline), .rounds or agent outputs.
  for (const dir of ['lib', 'generators', 'src/core', 'bin']) visit(path.join(J, dir));
  return { files, dirs }; // Includes empty directories for the child's exact read allowlist.
}
function checkPins(rows) {
  for (const row of rows) {
    const actual = pin(row.file);
    need(actual.bytes === row.bytes && actual.sha256 === row.sha256, 'replay pin drift: ' + row.file);
  }
}
function archivePins(scope, scopePin) {
  const file = REF + '/manifest.json', captured = captureJson(file), manifest = captured.value;
  need(manifest.schemaVersion === 'truthsrc.classic-cqrs-v4-assets/v1' && manifest.pathBase === 'repository root' &&
    manifest.self === 'test/reference/classic-cqrs-v4/manifest.json' && manifest.selfExcluded === true &&
    manifest.fileCountExcludingSelf === 43 && manifest.fileCountIncludingSelf === 44 &&
    manifest.copiedFileCount === 38 && manifest.comparisonRootFilesPerVariant === 19 &&
    Array.isArray(manifest.files) && manifest.files.length === 43, 'sealed 43-row/44-with-self v4 archive required');
  const required = [REF + '/README.md', REF + '/scope.json', REF + '/provenance.json',
    ...variants.map(v => FIX + '/request-' + v + '.json'),
    ...variants.flatMap(v => scope.paths.map(p => REF + '/' + v + '/' + p))];
  const rowPin = row => {
    need(relativePath(row.path) && Number.isSafeInteger(row.bytes) && row.bytes >= 0 &&
      typeof row.sha256 === 'string' && /^[a-f0-9]{64}$/u.test(row.sha256), 'invalid archive pin');
    return { file: J + '/' + row.path, bytes: row.bytes, sha256: row.sha256 };
  };
  const rows = manifest.files.map(row => {
    need(['test/reference/classic-cqrs-v4/', 'test/fixtures/classic-cqrs-v4/'].some(root => row.path?.startsWith(root)), 'reference manifest path outside v4 assets');
    const result = rowPin(row), category = result.file.endsWith('.scala') ? 'expected-scala' :
      result.file.startsWith(FIX + '/') ? 'product-request' : 'reference-metadata';
    need(row.category === category, 'incorrect archive row category'); return result;
  });
  need(new Set(rows.map(row => fold(row.file))).size === 43 && samePaths(rows.map(row => row.file), required), 'exact 38 Scala, two requests, README, scope and provenance pins required');
  need(rows.reduce((n, row) => n + row.bytes, 0) === manifest.bytesExcludingSelf &&
    rows.filter(row => row.file.endsWith('.scala')).reduce((n, row) => n + row.bytes, 0) === manifest.copiedOriginalByteCount &&
    variants.every(v => rows.filter(row => row.file.startsWith(REF + '/' + v + '/')).reduce((n, row) => n + row.bytes, 0) === manifest.copiedRawBytesByVariant?.[v]), 'archive byte accounting mismatch');
  need(rows.some(row => row.file === scopePin.file && row.bytes === scopePin.bytes && row.sha256 === scopePin.sha256), 'scope capture must match sealed archive');
  need(Array.isArray(manifest.existingInputReferences) && manifest.existingInputReferences.length === 3 &&
    manifest.existingInputReferences.every(row => row.requiredForReplay === true), 'three original F1 input/options references required');
  const inputs = manifest.existingInputReferences.map(rowPin);
  need(new Set(inputs.map(row => fold(row.file))).size === 3 && samePaths(inputs.map(row => row.file),
    [...variants.map(v => F1 + '/' + v + '.json'), options]), 'only original F1 inputs/options may be required');
  for (const p of added) {
    const a = rows.find(row => row.file === REF + '/baseline/' + p), b = rows.find(row => row.file === REF + '/timestamp-int/' + p);
    need(a && b && a.bytes === b.bytes && a.sha256 === b.sha256, 'new repository surfaces must retain unchanged expected bytes across inputs');
  }
  const assets = [...rows, captured.pin];
  checkPins([...assets, ...inputs]);
  const trees = [REF, FIX].map(root => {
    const inventory = inventoryEvidence(root), declared = Object.fromEntries(assets.filter(row => row.file.startsWith(root + '/'))
      .map(row => [row.file.slice(root.length + 1), fingerprint(row)]));
    compareEvidenceInventories(declared, inventory); return { root, inventory };
  });
  // Optional historical/local lineage is data in the sealed manifest, never a read instruction.
  return { assets, inputs, trees };
}
const cleanProcessBarriers = r => r.schemaVersion === 'truthsrc.verified-process/v1' && Number.isSafeInteger(r.pid) && r.pid > 0 &&
  r.signal === null && r.expectedSignal === null && r.launchError === null && r.timedOut === false && r.cancelled === null &&
  r.leftoverGroup === false && r.groupAliveAfter === false && r.outputLimitExceeded === false && r.outputError === false &&
  r.sandboxProfileUnchanged === true && r.directChildClosed === true && r.directChildReaped === true &&
  Array.isArray(r.terminationErrors) && r.terminationErrors.length === 0 && Array.isArray(r.groupSignals) && r.groupSignals.length === 0 &&
  Array.isArray(r.mainSignals) && r.mainSignals.length === 0 && r.graceMs === 15000 && r.reapMs === 5000 && r.descendantExitGraceMs === 0 &&
  r.barrier?.status === 'not-requested' && r.barrier.settled === true && r.barrier.error === null;
const cleanDifferenceExit = r => cleanProcessBarriers(r) && r.code === 1 && r.passed === false && r.status === 'failed' && r.expectedTermination === false;
const cleanSuccessExit = r => cleanProcessBarriers(r) && r.code === 0 && r.passed === true && r.status === 'passed' && r.expectedTermination === true;
const unequal = message => Object.assign(new Error(message), { verdict: 'FAIL' });
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('Usage: node tools/codegen-parity/replay-classic-v4.mjs --out <new-absolute-root>\n' +
    'Node >=22.13; Darwin sandbox only. New direct child of physical repository .rounds/ or system temporary directory.\n' +
    'Four generate-products calls (120s each), six full-source comparisons (30s each); 720s wall from first call, 20s cleanup reserve. No tests or runtime certification.\n' +
    'Future invocation: <physical-node-22.23.4> tools/codegen-parity/replay-classic-v4.mjs --out <physical-repository>/.rounds/<new-classic-v4-root>');
} else {
  let W, E, result, primary, started, deadline, scope, scopePin, source, archive, env, sandbox, policy;
  let pins = [], sourceBeforeAttempted = false, coreComplete = false;
  const localPins = [], captures = [];
  const remember = row => { localPins.push(row); return row; };
  function checkAll() {
    checkPins([...pins, ...localPins]);
    if (source) {
      const current = sourcePaths();
      need(samePaths(current.files, source.files) && samePaths(current.dirs, source.dirs), 'shipped source file/directory membership drift');
    }
    for (const row of archive?.trees ?? []) compareEvidenceInventories(row.inventory, inventoryEvidence(row.root));
    for (const row of captures) for (const side of ['actual', 'sources']) if (row[side]?.inventory)
      compareEvidenceInventories(row[side].inventory, inventoryEvidence(row[side].root));
  }
  function inventoryFor(root) {
    for (const v of variants) if (root === REF + '/' + v) return Object.fromEntries(archive.assets
      .filter(row => row.file.startsWith(root + '/')).map(row => [row.file.slice(root.length + 1), fingerprint(row)]));
    for (const row of captures) for (const side of ['actual', 'sources']) if (row[side]?.root === root) return row[side].inventory;
    throw new Error('comparison root not bound to captured inventory');
  }
  async function command(id, stage, argv, sourcesOnly = false) {
    started ??= performance.now(); deadline ??= started + 720000;
    need(planned[result.calls.length] === id, 'only the fixed ten core calls may execute');
    const base = E + '/' + id, call = { id, stage, argv, spawnAttempted: false, pinsBefore: false, pinsAfter: false, accepted: false };
    result.calls.push(call);
    let error, output;
    try {
      checkAll(); call.pinsBefore = true;
      call.timeoutMs = Math.min(stage === 'generate' ? 120000 : 30000, Math.floor(deadline - performance.now() - 20000));
      need(call.timeoutMs > 0, 'replay wall budget exhausted; no further call');
      result.budgets.assignedTimeoutMs += call.timeoutMs;
      need(result.budgets.assignedTimeoutMs <= 660000, 'core total caps exhausted');
      const receipt = await runVerifiedProcess({ executable: process.execPath, args: argv, cwd: J, env, base, timeoutMs: call.timeoutMs, sandbox });
      call.spawnAttempted = true; call.rawReceipt = receipt; call.code = receipt.code; call.passed = receipt.passed;
      need(receipt.cwd === J && receipt.timeoutMs === call.timeoutMs && receipt.sandboxProfile === sandbox.profile &&
        receipt.sandboxProfileSha256 === sandbox.profileSha256 && samePaths(receipt.envKeys, Object.keys(env)) &&
        JSON.stringify(receipt.command) === JSON.stringify(['/usr/bin/sandbox-exec', '-p', policy, process.execPath, ...argv]) &&
        receipt.commandSha256 === hash(JSON.stringify(receipt.command)), 'raw receipt command/profile/environment binding required');
      for (const [key, suffix] of [['receipt', '.json'], ['stdout', '.stdout.log'], ['stderr', '.stderr.log']]) {
        need(receipt.paths[key] === base + suffix, 'raw receipt evidence path mismatch');
        call[key] = remember(pin(base + suffix));
      }
      const raw = captureEvidenceFile(call.receipt.file);
      need(raw.bytes === call.receipt.bytes && raw.sha256 === call.receipt.sha256 &&
        raw.value.equals(Buffer.from(JSON.stringify(receipt, null, 2) + '\n')), 'raw receipt differs from helper return');
      need(call.stdout.sha256 === receipt.stdoutSha256 && call.stderr.sha256 === receipt.stderrSha256, 'stdout/stderr differ from signed raw receipt');
      need(cleanSuccessExit(receipt) || stage === 'compare' && cleanDifferenceExit(receipt), 'public ' + stage + ' failed: ' + id + '; see captured stderr');
      const stdout = captureJson(call.stdout.file);
      need(stdout.pin.bytes === call.stdout.bytes && stdout.pin.sha256 === call.stdout.sha256, 'stdout changed during parse'); output = stdout.value;
      if (stage === 'generate') need(output.applied === true && output.readiness?.level === 'classic-scaffold-only' &&
        output.readiness.runnable === false && samePaths(Object.keys(output.readiness), ['level', 'runnable']), 'scaffold-only generation result required');
      else {
        call.comparison = { status: output.status, counts: output.counts, membership: output.membership };
        const c = output.counts, only = sourcesOnly ? [] : ancillary, binding = sourcesOnly ? result.sourcesScope : scopePin;
        need(output.schemaVersion === 'truthsrc.codegen-parity-report/v1' && output.expectedRoot === argv[2] && output.actualRoot === argv[4] &&
          output.scope?.file === argv[6] && output.scope.file === binding.file && output.scope.bytes === binding.bytes && output.scope.sha256 === binding.sha256 &&
          output.scope.definition?.schemaVersion === scope.schemaVersion && samePaths(Object.keys(output.scope.definition), ['schemaVersion', 'paths', 'expectedOnly', 'actualOnly']) &&
          samePaths(output.scope.definition.paths, scope.paths) && samePaths(output.scope.definition.expectedOnly, []) &&
          samePaths(output.scope.definition.actualOnly, only), 'exact comparison roots and captured scope binding required');
        need(c?.comparedPaths === 19 && c.expectedInventoryFiles === 19 && c.actualInventoryFiles === (sourcesOnly ? 19 : 21) &&
          c.expectedOnly === 0 && c.actualOnly === (sourcesOnly ? 0 : 2) && c.unavailableFiles === 0 &&
          Number.isSafeInteger(c.equalFiles) && c.equalFiles >= 0 && Number.isSafeInteger(c.differentFiles) && c.differentFiles >= 0 &&
          c.equalFiles + c.differentFiles === 19, 'complete literal 19/21 actual or 19/19 source counts required');
        need(samePaths(Object.keys(output.membership ?? {}), ['expected', 'actual']) && ['expected', 'actual'].every(side =>
          samePaths(Object.keys(output.membership[side] ?? {}), ['missing', 'unexpected']) &&
          samePaths(output.membership[side].missing, []) && samePaths(output.membership[side].unexpected, [])) &&
          samePaths(Object.keys(output.inventories ?? {}), ['expected', 'actual']) &&
          samePaths(output.inventories.expected?.map(row => row.path), scope.paths) &&
          samePaths(output.inventories.actual?.map(row => row.path), [...scope.paths, ...only]) &&
          samePaths(output.files?.map(row => row.path), scope.paths) && output.files.every(row => ['equal', 'different'].includes(row.status)) &&
          output.files.filter(row => row.status === 'different').length === c.differentFiles &&
          output.files.filter(row => row.status === 'equal').length === c.equalFiles, 'complete inventory sets and all 19 file rows required');
        for (const [side, root] of [['expected', output.expectedRoot], ['actual', output.actualRoot]]) {
          const captured = inventoryFor(root), reported = Object.fromEntries(output.inventories[side].map(row => {
            need(row.partition === (scope.paths.includes(row.path) ? 'compared' : 'ancillary'), 'incorrect inventory partition');
            return [row.path, fingerprint(row)];
          }));
          compareEvidenceInventories(captured, reported);
          for (const row of output.files) {
            need(row[side]?.file === root + '/' + row.path && samePaths(Object.keys(row[side]), ['file', 'bytes', 'sha256']) &&
              row[side].bytes === captured[row.path].bytes && row[side].sha256 === captured[row.path].sha256, 'file row not bound to captured root/bytes');
            if (row.status === 'equal') need(row.expected.bytes === row.actual.bytes && row.expected.sha256 === row.actual.sha256, 'equal row has unequal fingerprints');
          }
        }
        if (c.differentFiles) {
          need(cleanDifferenceExit(receipt) && output.status === 'different', 'unsigned comparison difference');
          call.byteDifference = true; throw unequal('full Scala bytes differ: ' + id);
        }
        need(cleanSuccessExit(receipt) && output.status === 'equal' && c.equalFiles === 19 && c.differentFiles === 0, 'successful full 19-file comparison required');
      }
      call.accepted = true;
    } catch (failure) {
      error = failure; const state = processFailureState(failure);
      if (state) { call.processFailureState = state; call.spawnAttempted ||= state.spawnAttempted === true; }
    } finally {
      if (call.spawnAttempted) for (const [key, suffix] of [['receipt', '.json'], ['stdout', '.stdout.log'], ['stderr', '.stderr.log']]) {
        try { call[key] ??= remember(pin(base + suffix)); }
        catch (failure) { (call.evidenceFailures ??= []).push(failure.message); if (error?.verdict === 'FAIL') call.differenceFailure = error.message; error = failure; }
      }
      try { checkAll(); call.pinsAfter = true; }
      catch (failure) { call.pinFailure = failure.message; result.pinFailure ??= failure.message;
        if (error?.verdict === 'FAIL') call.differenceFailure = error.message; error = failure; }
    }
    if (!error && performance.now() > deadline) error = new Error('replay wall budget exhausted');
    if (error) { call.accepted = false; call.failure = error.message; throw error; }
    return output;
  }
  function captureActual(variant, repeat, out, V) {
    const row = { variant, repeat, actual: { root: out } }; captures.push(row);
    try {
      const inventory = inventoryEvidence(out); row.actual.inventory = inventory;
      need(samePaths(Object.keys(inventory), [...scope.paths, ...ancillary]), 'complete actual inventory of exactly 21 files required');
      const parent = V + '/' + variant + '-' + repeat, root = parent + '/sources'; newDir(parent); newDir(root); row.sources = { root };
      for (const file of scope.paths) {
        const captured = captureEvidenceFile(out + '/' + file), before = inventory[file];
        need(captured.bytes === before.bytes && captured.sha256 === before.sha256, 'actual changed during source capture');
        fs.mkdirSync(path.dirname(root + '/' + file), { recursive: true, mode: 0o700 }); save(root + '/' + file, captured.value);
      }
      const sources = inventoryEvidence(root), declared = Object.fromEntries(scope.paths.map(file => [file, inventory[file]]));
      row.sources.inventory = sources; compareEvidenceInventories(declared, sources);
      const ledger = captureEvidenceFile(out + '/truthsrc.ledger.json'), before = inventory['truthsrc.ledger.json'];
      need(ledger.bytes === before.bytes && ledger.sha256 === before.sha256, 'ledger changed during capture');
      const file = E + '/' + variant + '-' + repeat + '.ledger.json'; save(file, ledger.value);
      row.ledger = remember(pin(file)); need(row.ledger.bytes === ledger.bytes && row.ledger.sha256 === ledger.sha256, 'raw ledger capture changed');
      checkAll(); return root;
    } catch (error) { row.failure = error.message; throw error; }
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
    result = { schemaVersion: 'truthsrc.classic-byte-replay/v4', verdict: 'BLOCKED', ready: false, comparedFilesPerInput: 19,
      readiness: { level: 'classic-scaffold-only', runnable: false }, plannedCalls: 10, plannedCallIds: planned, calls: [], captures,
      ledgerChecks: [], finalizationFailures: [],
      budgets: { generateMs: 120000, compareMs: 30000, coreTotalCapsMs: 660000, wallMs: 720000, cleanupReserveMs: 20000, assignedTimeoutMs: 0 },
      unchangedOutputPathsAcrossInputs: added,
      boundary: 'Only original baseline/timestamp-int and 19 full Scala files. The two added repository outputs are unchanged across these inputs, not changed-output coverage. Nineteen files are NOT type-closed: raw default-family references CreditBalanceAggregateProtocol.CreditBalanceAggregateCommandFamily and CreditBalanceProtocol.CreditBalanceCommandFamily are preserved, not repaired. Not whole-family parity, quality, compilation or runtime certification. Anchors inventoried/pinned only, never normalized or byte-equality claimed; ledger raw-byte equality separately captured. Footprint is the public generator responsibility, not interpreted by this wrapper. Formal 42-minute total and supplemental remaining budget belong to the exclusive outer owner, not a new wrapper flag.' };
    for (const dir of [A, RT, E, V, RT + '/home', RT + '/tmp']) newDir(dir);
    source = sourcePaths();
    need(['generator.json', 'generate.mjs', 'produce.mjs'].every(name => source.files.includes(J + '/generators/scala-cqrs-classic-v4/' + name)), 'shipped v4 generator must exist before replay');
    const capturedScope = captureJson(REF + '/scope.json'); scope = capturedScope.value; scopePin = capturedScope.pin;
    need(scope.schemaVersion === 'truthsrc.codegen-parity-scope/v1' && samePaths(Object.keys(scope), ['schemaVersion', 'paths', 'expectedOnly', 'actualOnly']) &&
      Array.isArray(scope.paths) && scope.paths.length === 19 && scope.paths.every(file => relativePath(file) && file.startsWith('app/') && file.endsWith('.scala')) &&
      new Set(scope.paths.map(fold)).size === 19 && added.every(file => scope.paths.includes(file)) &&
      samePaths(scope.expectedOnly, []) && samePaths(scope.actualOnly, ancillary), 'explicit 19-Scala/21-actual v4 scope required');
    archive = archivePins(scope, scopePin);
    for (const variant of variants) {
      const captured = captureJson(FIX + '/request-' + variant + '.json'), request = captured.value;
      checkPins([captured.pin]);
      need(archive.assets.some(row => row.file === captured.pin.file && row.bytes === captured.pin.bytes && row.sha256 === captured.pin.sha256) &&
        request.schemaVersion === 'truthsrc.product-input-files/v1' && request.documents?.length === 1 &&
        request.documents[0].id === 'classic-system' && request.documents[0].schemaVersion === 'truthsrc.classic-architecture-input/v1' &&
        request.documents[0].file === '../classic-cqrs-f1/' + variant + '.json' && samePaths(request.assemblies, []) &&
        request.requirements?.length === 1 && request.requirements[0].id === 'classic-architecture' && request.requirements[0].version === '4' &&
        request.requirements[0].payloadSchemaVersion === 'truthsrc.classic-architecture/v4' &&
        request.requirements[0].capabilities?.length === 1 && request.requirements[0].capabilities[0].id === 'classic-source-scaffold' &&
        request.requirements[0].capabilities[0].version === '4' && request.requirements[0].inputRoles?.architecture === 'classic-system' &&
        samePaths(request.requirements[0].requires, []) && samePaths(Object.keys(request.options ?? {}), []), 'sealed v4 request must retain complete original F1 input');
    }
    pins = [...new Map([...source.files.map(pin), ...archive.assets, ...archive.inputs, pin(J + '/package.json'),
      pin(J + '/tools/codegen-parity.mjs'), pin(J + '/tools/codegen-parity/replay-classic-v3.mjs'),
      pin(fileURLToPath(import.meta.url)), pin(process.execPath), pin('/usr/bin/sandbox-exec')].map(row => [row.file, row])).values()];
    result.assetArchive = { requiredRows: 43, includingSelf: 44, existingInputReferences: 3, inventories: archive.trees };
    result.sourceDirectories = source.dirs;
    sourceBeforeAttempted = true; save(E + '/source-before.json', pins); result.sourceBefore = remember(pin(E + '/source-before.json'));
    const viewScope = E + '/sources.scope.json'; save(viewScope, { schemaVersion: scope.schemaVersion, paths: scope.paths, expectedOnly: [], actualOnly: [] });
    result.sourcesScope = remember(pin(viewScope));
    const dirs = new Set([...source.dirs, ...archive.trees.map(row => row.root), A, RT, E, V, RT + '/home', RT + '/tmp']);
    for (const file of [...pins.map(row => row.file), ...localPins.map(row => row.file)]) {
      for (let dir = path.dirname(file); ; dir = path.dirname(dir)) { dirs.add(dir); if (dir === path.dirname(dir)) break; }
    }
    const q = JSON.stringify, system = ['/System/Library', '/usr/lib', '/Library/Apple/System/Library', '/private/var/db/dyld', '/usr/share/icu', '/private/var/db/timezone/zoneinfo'];
    policy = '(version 1)\n(allow default)\n(deny network*)\n(deny file-write*)\n(deny file-read-data)\n' +
      '(allow file-read-data ' + system.map(dir => '(subpath ' + q(dir) + ')').join(' ') +
      ' (literal "/dev/null") (literal "/dev/random") (literal "/dev/urandom") (literal "/private/etc/localtime") ' +
      [...new Set([...pins.map(row => row.file), viewScope, ...dirs])].map(file => '(literal ' + q(file) + ')').join(' ') +
      ' (subpath ' + q(A) + ') (subpath ' + q(RT) + ') (subpath ' + q(V) + '))\n' +
      '(allow file-write* (subpath ' + q(A) + ') (subpath ' + q(RT) + '))\n';
    const profile = E + '/sandbox.sb'; save(profile, policy); remember(pin(profile));
    sandbox = { executable: '/usr/bin/sandbox-exec', profile, profileSha256: hash(policy) };
    env = { HOME: RT + '/home', TMPDIR: RT + '/tmp', PATH: path.dirname(process.execPath) + ':/usr/bin:/bin',
      LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', TZ: 'UTC', NODE_V8_COVERAGE: '' };
    for (const variant of variants) {
      const views = [];
      for (const repeat of ['a', 'b']) {
        const out = A + '/' + variant + '-' + repeat; assertCanonicalPath(out, { kind: 'new' });
        await command(variant + '.' + repeat + '.generate', 'generate', [J + '/bin/truthsrc.js', 'generate-products', '--request', FIX + '/request-' + variant + '.json',
          '--generator', J + '/generators/scala-cqrs-classic-v4', '--out', out, '--options-json', options]);
        views.push(captureActual(variant, repeat, out, V));
        await command(variant + '.' + repeat + '.compare', 'compare', [J + '/tools/codegen-parity.mjs', '--expected', REF + '/' + variant, '--actual', out, '--scope', scopePin.file]);
      }
      const pair = captures.filter(row => row.variant === variant), a = captureEvidenceFile(pair[0].ledger.file), b = captureEvidenceFile(pair[1].ledger.file);
      need(a.bytes === pair[0].ledger.bytes && a.sha256 === pair[0].ledger.sha256 && b.bytes === pair[1].ledger.bytes && b.sha256 === pair[1].ledger.sha256, 'ledger equality inputs drifted');
      const ledgerCheck = { variant, a: pair[0].ledger, b: pair[1].ledger, equal: a.value.equals(b.value) };
      result.ledgerChecks.push(ledgerCheck); save(E + '/' + variant + '.ledger-equality.json', ledgerCheck); remember(pin(E + '/' + variant + '.ledger-equality.json'));
      checkAll(); if (!ledgerCheck.equal) throw unequal('raw captured ledger bytes differ: ' + variant);
      await command(variant + '.sources.compare', 'compare', [J + '/tools/codegen-parity.mjs', '--expected', views[0], '--actual', views[1], '--scope', viewScope], true);
    }
    need(result.calls.length === 10 && result.calls.every(call => call.spawnAttempted && call.accepted && cleanSuccessExit(call.rawReceipt)) &&
      captures.length === 4 && captures.every(row => !row.failure && row.sources?.inventory && row.ledger) &&
      result.ledgerChecks.length === 2 && result.ledgerChecks.every(row => row.equal), 'all ten signed core observations and four complete captures required');
    coreComplete = true; // Not a signed PASS: final pin/inventory/budget checks still follow.
  } catch (error) { primary = error; }
  finally {
    if (W && result) {
      const finalFailure = error => { primary ??= error; result.finalizationFailures.push(error.message); result.verdict = 'BLOCKED'; };
      try {
        if (!sourceBeforeAttempted) { sourceBeforeAttempted = true; save(E + '/source-before.json', pins); result.sourceBefore = remember(pin(E + '/source-before.json')); }
      } catch (error) { finalFailure(error); }
      const after = pins.map(row => { try { return pin(row.file); } catch (error) { finalFailure(error); return { file: row.file, error: error.message }; } });
      try { save(E + '/source-after.json', after); result.sourceAfter = remember(pin(E + '/source-after.json')); }
      catch (error) { finalFailure(error); }
      result.actualCalls = result.calls.filter(call => call.spawnAttempted).length;
      result.unexecuted = planned.filter(id => !result.calls.some(call => call.id === id && call.spawnAttempted)); result.remaining = result.unexecuted.length;
      const validateFinal = () => {
        checkAll(); need(deadline === undefined || performance.now() <= deadline, 'replay wall budget exhausted');
        result.budgets.elapsedMs = started === undefined ? 0 : Math.ceil(performance.now() - started);
        result.integrity = { scopedPinsUnchanged: !!result.sourceBefore && !result.pinFailure && !result.finalizationFailures.length &&
          result.calls.every(call => call.pinsBefore && call.pinsAfter && !call.evidenceFailures?.length), pinCount: pins.length };
      };
      try { validateFinal(); } catch (error) { finalFailure(error); result.integrity = { scopedPinsUnchanged: false, pinCount: pins.length }; }
      if (primary) {
        result.failure = primary.message;
        result.verdict = primary.verdict === 'FAIL' && !result.pinFailure && !result.finalizationFailures.length ? 'FAIL' : 'BLOCKED';
        try { save(E + '/final-failure.json', { verdict: result.verdict, failure: result.failure, actualCalls: result.actualCalls,
          unexecuted: result.unexecuted, remaining: result.remaining, finalizationFailures: result.finalizationFailures }); remember(pin(E + '/final-failure.json')); }
        catch (error) { finalFailure(error); }
      }
      try { validateFinal(); } catch (error) { finalFailure(error); result.integrity = { scopedPinsUnchanged: false, pinCount: pins.length }; }
      if (!primary && coreComplete && result.integrity.scopedPinsUnchanged && result.remaining === 0) result.verdict = 'PASS';
      if (primary) {
        result.failure = primary.message;
        try { fs.writeSync(2, primary.message + '\n'); }
        catch (error) { finalFailure(error); result.integrity.scopedPinsUnchanged = false; }
      }
      process.exitCode = result.verdict === 'PASS' ? 0 : result.verdict === 'FAIL' ? 1 : 2;
      const completion = W + '/completion.json';
      try {
        save(completion, result);
        const completionPin = pin(completion);
        need(deadline === undefined || performance.now() <= deadline, 'replay wall budget exhausted during completion write');
        // Emit no PASS token that could survive a later stdout/finalization failure.
        fs.writeSync(1, JSON.stringify({ completion, completionPin, actualCalls: result.actualCalls, scopedPins: pins.length }) + '\n');
      } catch (error) {
        finalFailure(error); result.failure = primary.message; result.invalidCompletion = completion; process.exitCode = 2;
        result.integrity.scopedPinsUnchanged = false;
        try { fs.writeSync(2, primary.message + '\n'); } catch (failure) { finalFailure(failure); }
        try { save(E + '/completion-failure.json', result); } catch { /* outer owner must reject incomplete/invalid completion evidence */ }
      }
    } else if (primary) {
      process.exitCode = 2;
      try { fs.writeSync(2, primary.message + '\n'); } catch { /* no owned evidence root; retain BLOCKED exit */ }
    }
  }
}
