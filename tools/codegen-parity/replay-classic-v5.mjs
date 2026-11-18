#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { runVerifiedProcess, processFailureState, validateProcessReceipt } from '../../lib/verification/process.mjs';
import { assertCanonicalPath, captureEvidenceFile, fingerprintEvidenceFile } from '../../lib/verification/files.mjs';
import { inventoryEvidence, compareEvidenceInventories, createEvidenceReferences } from '../../lib/verification/inventory.mjs';
import { parseStrictJson } from '../../lib/strict-json.mjs';

// Preparation-only entrypoint. Invoke only after independent asset/source review
// and the integrator's time-budget freeze. No private generator imports/calls.
const SELF = fileURLToPath(import.meta.url);
const J = path.resolve(path.dirname(SELF), '../..');
const REF = J + '/test/reference/classic-cqrs-v5';
const FIX = J + '/test/fixtures/classic-cqrs-v5';
const F1 = J + '/test/fixtures/classic-cqrs-f1';
const GENERATOR = J + '/generators/scala-cqrs-classic-v5';
const OPTIONS = F1 + '/options.json';
const VARIANTS = ['baseline', 'timestamp-int'];
const CONTROL = ['anchors.json', 'truthsrc.ledger.json'];
const SCOPE_SCHEMA = 'truthsrc.codegen-parity-scope/v1';
const ASSET_SCHEMA = 'truthsrc.classic-cqrs-v5-assets/v1';
const MATRIX_SCHEMA = 'truthsrc.classic-cqrs-v5-core-replay/v1';
const TARGET = 'scala-cqrs-classic-scaffold@5';
const FILE_LIMIT = 8 * 1024 * 1024;
const PROCESS_LIMIT = 16 * 1024 * 1024;
const REPORT_LIMIT = 64 * 1024 * 1024;
const BUDGET = Object.freeze({ generateMs: 120000, compareMs: 30000,
  coreTotalCapsMs: 660000, wallMs: 720000, cleanupReserveMs: 20000, supervisorCleanupMs: 20000 });
const PLANNED = VARIANTS.flatMap(v => ['a.generate', 'a.compare', 'b.generate', 'b.compare', 'sources.compare'].map(s => v + '.' + s));
const need = (ok, message) => { if (!ok) throw new Error(message); };
const unequal = message => Object.assign(new Error(message), { verdict: 'FAIL' });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fold = value => value.normalize('NFC').toLowerCase();
const fp = row => ({ bytes: row.bytes, sha256: row.sha256 });
const samePaths = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
  new Set(a).size === a.length && new Set(b).size === b.length && a.every(p => b.includes(p));
const fields = (value, names) => value !== null && typeof value === 'object' && !Array.isArray(value) && samePaths(Object.keys(value), names);
const uint = value => Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
const relativePath = file => typeof file === 'string' && file.isWellFormed() && file.length > 0 &&
  !/[\x00-\x1f\x7f-\x9f\\]/u.test(file) && !path.posix.isAbsolute(file) && !path.win32.isAbsolute(file) &&
  path.posix.normalize(file) === file && file.split('/').every(part => part && part !== '.' && part !== '..' &&
    !/[<>:"|?*]|[. ]$/u.test(part) && !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])\s*(?:\.|$)/iu.test(part));
const inside = (root, file) => file === root || file.startsWith(root + '/');
const identity = file => {
  const stat = fs.lstatSync(file);
  need(stat.isDirectory() && !stat.isSymbolicLink(), 'physical directory required: ' + file);
  return [stat.dev, stat.ino, stat.mode, stat.uid, stat.gid];
};
const pin = (file, limit = FILE_LIMIT) => ({ file, ...fingerprintEvidenceFile(file, { limit }) });
function captureJson(file, strict = true, limit = FILE_LIMIT) {
  const captured = captureEvidenceFile(file, { limit });
  // The strict parser's 8 MiB boundary applies to admitted assets. Public stdout
  // retains the supervisor's entire 16 MiB bound, without truncating a report.
  const value = strict ? parseStrictJson(captured.value) : JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(captured.value));
  return { pin: { file, ...fp(captured) }, value };
}
function pathDeclarations(files) {
  need(Array.isArray(files) && files.every(relativePath) && new Set(files.map(fold)).size === files.length, 'unique safe relative paths required');
  const spellings = new Map(), leaves = new Set(files.map(fold));
  for (const file of files) {
    const parts = file.split('/');
    for (let count = 1; count <= parts.length; count++) {
      const prefix = parts.slice(0, count).join('/'), key = fold(prefix);
      need(!spellings.has(key) || spellings.get(key) === prefix, 'directory spelling alias: ' + prefix);
      need(count === parts.length || !leaves.has(key), 'file/directory conflict: ' + prefix);
      spellings.set(key, prefix);
    }
  }
}
function expectedKind(file) {
  if (file.endsWith('.scala')) return 'scala';
  if (file.endsWith('.proto')) return 'proto';
  if (file === 'conf/routes' || file.endsWith('/conf/routes')) return 'routes';
  throw new Error('undeclared comparison file kind: ' + file);
}
function scopeGate(scope) {
  need(fields(scope, ['schemaVersion', 'paths', 'expectedOnly', 'actualOnly']) && scope.schemaVersion === SCOPE_SCHEMA &&
    samePaths(scope.expectedOnly, []) && samePaths(scope.actualOnly, CONTROL), 'full-source scope with only the two actual controls required');
  pathDeclarations([...scope.paths, ...scope.actualOnly]);
  // This is the initial matrix's admission boundary, not a comparison constant.
  // Every public report/capture count below is computed from these sealed paths.
  need(scope.paths.length === 52, 'initial v5 core requires all 52 existing complete files; no cap, subset or extension matrix');
  const kinds = scope.paths.reduce((r, p) => { r[expectedKind(p)]++; return r; }, { scala: 0, proto: 0, routes: 0 });
  need(kinds.scala === 49 && kinds.proto === 2 && kinds.routes === 1, 'initial core requires 49 Scala, two proto and one complete routes file');
  return kinds;
}
// Read-role policy, not a content-keyword filter. Check every NFC/case-folded
// component before traversal, content pinning or child read admission.
const forbiddenSourceComponents = new Set(['.git', '.rounds', 'docs', 'node_modules', 'secrets', 'credentials']);
const sensitiveSourceNames = [
  /^(?:secrets?|credentials?)(?:[._-]|$)/u,
  /^(?:agent\.output|full[-.]agent\.output)(?:[._-]|$)/u,
  /^(?:passwd|private[-_]?key|environment|\.env)(?:[._-]|$)/u,
  /^(?:process|old)[._-](?:args|argv|env|environment)(?:[._-]|$)/u,
  /^(?:args|argv|env|environment)[._-](?:dump|dumps)(?:[._-]|$)/u,
  /^(?:process[._-])?(?:args[._-]env|env[._-]args)(?:[._-]|$)/u,
];
function sourceReadAllowed(file) {
  const relative = path.posix.relative(J, file);
  return relativePath(relative) && relative.split('/').every(part => {
    const name = fold(part);
    return !forbiddenSourceComponents.has(name) && !sensitiveSourceNames.some(pattern => pattern.test(name));
  });
}
function sourcePaths() {
  const files = [], dirs = [], states = [];
  function visit(dir) {
    assertCanonicalPath(dir); dirs.push(dir);
    const id = identity(dir), names = fs.readdirSync(dir).sort();
    need(new Set(names.map(fold)).size === names.length, 'aliases in shipped source: ' + dir);
    states.push({ dir, identity: id, names });
    for (const name of names) {
      need(relativePath(name) && !name.includes('/'), 'unsafe shipped source entry');
      const file = dir + '/' + name;
      if (!sourceReadAllowed(file)) continue; // Names only: never traverse or hash denied entries.
      const stat = fs.lstatSync(file);
      need(!stat.isSymbolicLink() && (stat.isDirectory() || stat.isFile()), 'unsafe shipped source entry: ' + file);
      if (stat.isDirectory()) visit(file);
      else {
        need(stat.nlink === 1, 'hardlinked shipped source file: ' + file);
        if (/\.(?:mjs|cjs|js|json|scala|proto)$/u.test(name)) files.push(file);
      }
    }
    need(JSON.stringify(fs.readdirSync(dir).sort()) === JSON.stringify(names) && JSON.stringify(identity(dir)) === JSON.stringify(id), 'shipped source membership/identity changed during traversal');
  }
  for (const dir of ['lib', 'generators', 'src/core', 'bin']) visit(J + '/' + dir);
  return { files, dirs, states }; // Includes empty directories; not a whole-repository scan.
}
function checkPins(rows) {
  const unique = new Map();
  for (const row of rows) {
    need(row && typeof row.file === 'string' && uint(row.bytes) && /^[a-f0-9]{64}$/u.test(row.sha256), 'complete evidence pin required');
    if (unique.has(row.file)) need(JSON.stringify(fp(unique.get(row.file))) === JSON.stringify(fp(row)), 'conflicting repeated pin');
    unique.set(row.file, row);
  }
  // Keep each captured byte count as its recheck cap. Growth must fail before
  // hashing, including binary/log/report pins with different admission limits.
  const references = createEvidenceReferences();
  for (const row of unique.values()) references.retain({ file: row.file, ...fp(row) }, { limit: row.bytes });
  references.assertUnchanged(); // Also rejects spelling, hardlink and inode aliases.
}
function archivePins() {
  const captured = captureJson(REF + '/manifest.json'), m = captured.value;
  need(m.schemaVersion === ASSET_SCHEMA && m.pathBase === 'repository root' &&
    m.self === 'test/reference/classic-cqrs-v5/manifest.json' && m.selfExcluded === true &&
    Array.isArray(m.files) && uint(m.fileCountExcludingSelf) && m.files.length === m.fileCountExcludingSelf &&
    m.fileCountIncludingSelf === m.fileCountExcludingSelf + 1 && uint(m.bytesExcludingSelf), 'sealed v5 asset manifest with exact dynamic archive accounting required');
  const replay = m.replay;
  need(fields(replay, ['schemaVersion', 'cases', 'plannedCallIds', 'sourceReadFiles']) && replay.schemaVersion === MATRIX_SCHEMA &&
    Array.isArray(replay.cases) && replay.cases.length === VARIANTS.length &&
    JSON.stringify(replay.plannedCallIds) === JSON.stringify(PLANNED) && Array.isArray(replay.sourceReadFiles), 'sealed exact two-input/ten-call core reference index required; future oracle cases need a separately reviewed wrapper');
  const rows = m.files.map(row => {
    need(fields(row, ['path', 'bytes', 'sha256', 'category']) && relativePath(row.path) && uint(row.bytes) &&
      row.bytes <= FILE_LIMIT && /^[a-f0-9]{64}$/u.test(row.sha256), 'complete bounded archive row required');
    const file = J + '/' + row.path;
    need(inside(REF, file) || inside(FIX, file), 'archive row outside new v5 assets');
    need(file !== captured.pin.file, 'manifest self must be excluded');
    return { file, ...fp(row), category: row.category };
  });
  pathDeclarations(m.files.map(row => row.path));
  const cases = replay.cases.map((c, index) => {
    const v = VARIANTS[index];
    need(fields(c, ['id', 'request', 'input', 'options', 'expectedRoot', 'scope']) && c.id === v &&
      c.request === 'test/fixtures/classic-cqrs-v5/request-' + v + '.json' &&
      c.input === 'test/fixtures/classic-cqrs-f1/' + v + '.json' && c.options === 'test/fixtures/classic-cqrs-f1/options.json' &&
      c.expectedRoot === 'test/reference/classic-cqrs-v5/' + v && c.scope === 'test/reference/classic-cqrs-v5/scope.json', 'initial reference index must name the original complete F1 inputs, original options and global comparison scope');
    const scopeCapture = captureJson(J + '/' + c.scope), kinds = scopeGate(scopeCapture.value);
    const root = J + '/' + c.expectedRoot, inventory = Object.fromEntries(rows.filter(row => row.file.startsWith(root + '/'))
      .map(row => [row.file.slice(root.length + 1), fp(row)]));
    need(samePaths(Object.keys(inventory), scopeCapture.value.paths) && Object.values(inventory).every(row => row.bytes > 0),
      'sealed expected index must enumerate every nonempty complete scope file, not an intersection or claimed count');
    const expectedBytes = Object.values(inventory).reduce((n, row) => n + row.bytes, 0);
    need(uint(expectedBytes) && m.comparisonRootFilesPerVariant === scopeCapture.value.paths.length &&
      m.copiedRawBytesByVariant?.[v] === expectedBytes, 'recalculated expected file/byte totals must match the sealed manifest');
    return { ...c, request: J + '/' + c.request, input: J + '/' + c.input, options: J + '/' + c.options,
      expectedRoot: root, scope: scopeCapture.value, scopePin: scopeCapture.pin, kinds, inventory,
      expectedFiles: scopeCapture.value.paths.length, actualFiles: scopeCapture.value.paths.length + scopeCapture.value.actualOnly.length, expectedBytes };
  });
  const required = [...cases.map(c => c.request), ...new Set(cases.map(c => c.scopePin.file)), REF + '/provenance.json',
    ...cases.flatMap(c => c.scope.paths.map(p => c.expectedRoot + '/' + p))];
  need(required.every(file => rows.some(row => row.file === file)), 'sealed requests, global scope, provenance and all complete expected files required');
  for (const row of rows) {
    const c = cases.find(c => row.file.startsWith(c.expectedRoot + '/'));
    const category = c ? 'expected-' + expectedKind(row.file.slice(c.expectedRoot.length + 1)) :
      cases.some(c => c.request === row.file) ? 'product-request' : 'reference-metadata';
    need(row.category === category, 'incorrect archive category: ' + row.file);
    if (!c && category === 'reference-metadata') need(path.dirname(row.file) === REF &&
      (path.basename(row.file).endsWith('.json') || path.basename(row.file) === 'README.md') &&
      !/secret|credential|agent\.output|payload/iu.test(path.basename(row.file)), 'only explicitly sealed root metadata, not historical payload/read instructions, is admitted');
  }
  need(rows.reduce((n, row) => n + row.bytes, 0) === m.bytesExcludingSelf &&
    m.copiedFileCount === cases.reduce((n, c) => n + c.expectedFiles, 0) &&
    m.copiedOriginalByteCount === cases.reduce((n, c) => n + c.expectedBytes, 0) &&
    fields(m.copiedRawBytesByVariant, VARIANTS), 'complete archive totals must be recalculated, never preliminary totals');
  function reference(row) {
    need(relativePath(row.path) && uint(row.bytes) && row.bytes <= FILE_LIMIT && /^[a-f0-9]{64}$/u.test(row.sha256), 'bounded explicit read pin required');
    return { file: J + '/' + row.path, ...fp(row) };
  }
  need(Array.isArray(m.existingInputReferences) && m.existingInputReferences.length === 3 &&
    m.existingInputReferences.every(row => fields(row, ['path', 'bytes', 'sha256', 'requiredForReplay']) && row.requiredForReplay === true), 'exact three original F1 read references required');
  const inputs = m.existingInputReferences.map(reference);
  need(samePaths(inputs.map(row => row.file), [...cases.map(c => c.input), OPTIONS]), 'only original full F1 inputs and original options admitted');
  const extraSource = replay.sourceReadFiles.map(row => {
    need(fields(row, ['path', 'bytes', 'sha256']) && relativePath(row.path) &&
      ['tools/codegen-parity/', 'tools/freeze/'].some(root => row.path.startsWith(root)) &&
      sourceReadAllowed(J + '/' + row.path) &&
      /\.(?:mjs|cjs|js|json|scala|proto)$/u.test(row.path), 'extra source reads require explicit pins and the common read-role policy under safe tools/codegen-parity or tools/freeze, never historical evidence');
    return reference(row);
  });
  need(new Set(extraSource.map(row => fold(row.file))).size === extraSource.length, 'duplicate extra source read pin');
  const assets = [...rows.map(({ category, ...row }) => row), captured.pin];
  checkPins([...assets, ...inputs, ...extraSource]);
  for (const c of cases) need(assets.some(row => row.file === c.scopePin.file && row.bytes === c.scopePin.bytes && row.sha256 === c.scopePin.sha256), 'captured scope must match archive pin');
  const trees = [REF, FIX].map(root => {
    const inventory = inventoryEvidence(root, { limit: FILE_LIMIT });
    const declared = Object.fromEntries(assets.filter(row => row.file.startsWith(root + '/')).map(row => [row.file.slice(root.length + 1), fp(row)]));
    compareEvidenceInventories(declared, inventory); return { root, identity: identity(root), inventory };
  });
  for (const c of cases) compareEvidenceInventories(c.inventory, inventoryEvidence(c.expectedRoot, { limit: FILE_LIMIT }));
  return { manifest: captured.pin, assets, inputs, extraSource, trees, cases };
}
function requestGate(c, archive) {
  const captured = captureJson(c.request), r = captured.value;
  need(archive.assets.some(row => row.file === captured.pin.file && row.bytes === captured.pin.bytes && row.sha256 === captured.pin.sha256), 'request capture must match sealed archive');
  need(fields(r, ['schemaVersion', 'documents', 'assemblies', 'requirements', 'options']) && r.schemaVersion === 'truthsrc.product-input-files/v1' &&
    Array.isArray(r.documents) && r.documents.length === 1 && fields(r.documents[0], ['id', 'schemaVersion', 'file']) &&
    r.documents[0].id === 'classic-system' && r.documents[0].schemaVersion === 'truthsrc.classic-architecture-input/v1' &&
    r.documents[0].file === '../classic-cqrs-f1/' + c.id + '.json' && samePaths(r.assemblies, []) && fields(r.options, []), 'v5 request must retain the complete original input with no extra attachment, assembly or options');
  need(Array.isArray(r.requirements) && r.requirements.length === 1, 'one exact v5 architecture requirement required');
  const q = r.requirements[0];
  need(fields(q, ['id', 'version', 'payloadSchemaVersion', 'capabilities', 'inputRoles', 'requires']) &&
    q.id === 'classic-architecture' && q.version === '5' && q.payloadSchemaVersion === 'truthsrc.classic-architecture/v5' &&
    Array.isArray(q.capabilities) && q.capabilities.length === 1 && fields(q.capabilities[0], ['id', 'version']) &&
    q.capabilities[0].id === 'classic-source-scaffold' && q.capabilities[0].version === '5' &&
    fields(q.inputRoles, ['architecture']) && q.inputRoles.architecture === 'classic-system' && samePaths(q.requires, []), 'exact v5 payload/version/capability/input-role identity required');
  const options = captureJson(c.options);
  need(fields(options.value, ['rootPackage', 'frameworkPackage', 'moduleName', 'generatorVersion', 'knowledgeRelease']) &&
    archive.inputs.some(row => row.file === options.pin.file && row.bytes === options.pin.bytes && row.sha256 === options.pin.sha256), 'unchanged original five-field options must match their sealed pin');
}
const cleanBarriers = r => r.schemaVersion === 'truthsrc.verified-process/v1' && Number.isSafeInteger(r.pid) && r.pid > 0 &&
  r.signal === null && r.expectedSignal === null && r.launchError === null && r.timedOut === false && r.cancelled === null &&
  r.leftoverGroup === false && r.groupAliveAfter === false && r.outputLimitExceeded === false && r.outputError === false &&
  r.sandboxProfileUnchanged === true && r.directChildClosed === true && r.directChildReaped === true &&
  samePaths(r.terminationErrors, []) && samePaths(r.groupSignals, []) && samePaths(r.mainSignals, []) &&
  r.graceMs === 15000 && r.reapMs === 5000 && r.descendantExitGraceMs === 0 && r.maxOutputBytes === PROCESS_LIMIT &&
  uint(r.rawOutputBytes) && r.rawOutputBytes <= PROCESS_LIMIT &&
  fields(r.barrier, ['status', 'settled', 'error']) && r.barrier.status === 'not-requested' && r.barrier.settled === true && r.barrier.error === null;
const cleanDifference = r => cleanBarriers(r) && r.code === 1 && r.passed === false && r.status === 'failed' && r.expectedTermination === false;
const cleanSuccess = r => cleanBarriers(r) && r.code === 0 && r.passed === true && r.status === 'passed' && r.expectedTermination === true;
const membership = (inventory, declarations) => ({ missing: declarations.filter(p => !Object.hasOwn(inventory, p)).sort(),
  unexpected: Object.keys(inventory).filter(p => !declarations.includes(p)).sort() });

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  fs.writeSync(1, 'Usage: <physical-node-22.23.4> tools/codegen-parity/replay-classic-v5.mjs --out <new-absolute-root>\n' +
    'Darwin deny-network sandbox only. --out must be absent and a direct child of physical repository .rounds or physical system TMP.\n' +
    'Exactly baseline/timestamp-int: four public generate-products calls and six public full-inventory comparisons.\n' +
    'Requires sealed v5 manifest.replay, complete 52-file scopes and expected assets; no --matrix or automatic discovery.\n' +
    '720s local wall, fixed 660s command caps, 20s finalization reserve. Does not restart or replace the integrator-owned 7200s formal window.\n' +
    'No tests, compilation, runtime, all-family certification or acceptance token. Wait for exit and validate closeout/evidence; completion alone is unsigned.\n');
} else {
  process.exitCode = 2; // Never assign successful exit before every late barrier.
  let W, E, rootOwned = false, evidenceOwned = false, result, primary, source, archive, env, sandbox, policy;
  let started, deadline, coreComplete = false, pins = [], sourceBeforeAttempted = false, sourceSealReady = false, interrupted, streamFailure;
  const localPins = [], captures = [], ownedDirs = new Map(), directoryAttempts = new Set();
  const interrupt = signal => { interrupted ??= signal; };
  const ioFailure = error => { streamFailure ??= error.message; process.exitCode = 2; };
  const onInt = () => interrupt('SIGINT'), onTerm = () => interrupt('SIGTERM');
  process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
  process.stdout.on('error', ioFailure); process.stderr.on('error', ioFailure);
  const remember = row => { localPins.push(row); return row; };
  function owned() {
    need(rootOwned && W, 'exclusive new-root ownership required');
    for (const [dir, before] of ownedDirs) {
      assertCanonicalPath(dir);
      need(JSON.stringify(identity(dir)) === JSON.stringify(before), 'owned directory replaced or aliased: ' + dir);
    }
  }
  function newDir(dir) {
    owned(); need(inside(W, dir) && dir !== W, 'new directory outside exclusive root');
    need(!directoryAttempts.has(dir), 'directory admission is single-attempt; never retry a failed reservation');
    directoryAttempts.add(dir);
    assertCanonicalPath(dir, { kind: 'new' }); fs.mkdirSync(dir, { mode: 0o700 });
    ownedDirs.set(dir, identity(dir));
  }
  function ensureParents(file) {
    const pending = [];
    for (let dir = path.dirname(file); !ownedDirs.has(dir); dir = path.dirname(dir)) {
      need(inside(W, dir) && dir !== W, 'unowned evidence parent'); pending.push(dir);
    }
    for (const dir of pending.reverse()) newDir(dir);
  }
  function save(file, data, limit = REPORT_LIMIT) {
    owned(); need(inside(W, file) && file !== W, 'evidence write outside exclusive root');
    assertCanonicalPath(file, { kind: 'new' });
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n');
    need(bytes.length <= limit, 'whole evidence exceeds byte bound; no truncation');
    const fd = fs.openSync(file, 'wx', 0o600);
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    return remember(pin(file, limit));
  }
  function checkDeadline(label) {
    need(!interrupted, 'replay interrupted: ' + interrupted);
    need(!streamFailure, 'replay stream I/O failure: ' + streamFailure);
    need(deadline === undefined || performance.now() <= deadline, 'replay wall deadline exhausted: ' + label);
  }
  function checkAll() {
    owned(); checkPins([...pins, ...localPins]);
    if (source) need(JSON.stringify(sourcePaths()) === JSON.stringify(source), 'shipped source file/directory membership or identity drift');
    for (const row of archive?.trees ?? []) {
      need(JSON.stringify(identity(row.root)) === JSON.stringify(row.identity), 'asset root identity drift');
      compareEvidenceInventories(row.inventory, inventoryEvidence(row.root, { limit: FILE_LIMIT }));
    }
    for (const row of captures) for (const side of ['actual', 'sources']) if (row[side]?.inventory) {
      need(JSON.stringify(identity(row[side].root)) === JSON.stringify(row[side].identity), 'captured root identity drift');
      compareEvidenceInventories(row[side].inventory, inventoryEvidence(row[side].root, { limit: FILE_LIMIT }));
    }
  }
  function inventoryFor(root) {
    const c = archive.cases.find(c => c.expectedRoot === root);
    if (c) return c.inventory;
    for (const row of captures) for (const side of ['actual', 'sources']) if (row[side]?.root === root && row[side].inventory) return row[side].inventory;
    throw new Error('comparison root not bound to captured inventory');
  }
  function compareReport(output, receipt, argv, c, sourcesOnly) {
    const only = sourcesOnly ? [] : c.scope.actualOnly, scopePin = sourcesOnly ? result.sourcesScope : c.scopePin;
    need(output.schemaVersion === 'truthsrc.codegen-parity-report/v1' && output.expectedRoot === argv[2] && output.actualRoot === argv[4] &&
      output.scope?.file === argv[6] && output.scope.file === scopePin.file && output.scope.bytes === scopePin.bytes && output.scope.sha256 === scopePin.sha256 &&
      fields(output.scope.definition, ['schemaVersion', 'paths', 'expectedOnly', 'actualOnly']) && output.scope.definition.schemaVersion === SCOPE_SCHEMA &&
      samePaths(output.scope.definition.paths, c.scope.paths) && samePaths(output.scope.definition.expectedOnly, []) && samePaths(output.scope.definition.actualOnly, only), 'exact comparison roots and whole captured scope binding required');
    need(fields(output.inventories, ['expected', 'actual']) && fields(output.membership, ['expected', 'actual']) &&
      Array.isArray(output.files) && samePaths(output.files.map(row => row.path), c.scope.paths), 'complete inventories, membership and every declared file row required');
    const counts = output.counts, n = c.scope.paths.length;
    need(counts && ['equalFiles', 'differentFiles', 'unavailableFiles'].every(key => uint(counts[key])) &&
      counts.comparedPaths === n && counts.expectedOnly === 0 && counts.actualOnly === only.length &&
      counts.equalFiles + counts.differentFiles + counts.unavailableFiles === n, 'scope-derived complete comparison counts required');
    for (const [side, root, declarations] of [['expected', output.expectedRoot, c.scope.paths], ['actual', output.actualRoot, [...c.scope.paths, ...only]]]) {
      const captured = inventoryFor(root), reportedRows = output.inventories[side];
      need(Array.isArray(reportedRows) && samePaths(reportedRows.map(row => row.path), Object.keys(captured)) &&
        counts[side + 'InventoryFiles'] === Object.keys(captured).length, 'reported full inventory must match captured membership, including missing/extra output evidence');
      const reported = Object.fromEntries(reportedRows.map(row => {
        need(fields(row, ['path', 'bytes', 'sha256', 'partition']) && row.partition ===
          (c.scope.paths.includes(row.path) ? 'compared' : only.includes(row.path) && side === 'actual' ? 'ancillary' : 'unregistered'), 'incorrect inventory partition');
        return [row.path, fp(row)];
      }));
      compareEvidenceInventories(captured, reported);
      const want = membership(captured, declarations), found = output.membership[side];
      need(fields(found, ['missing', 'unexpected']) && samePaths(found.missing, want.missing) && samePaths(found.unexpected, want.unexpected), 'membership claims must describe the complete captured inventory');
      for (const row of output.files) {
        const expected = captured[row.path];
        if (!expected) need(row[side] === null, 'missing file must have a null evidence binding');
        else need(fields(row[side], ['file', 'bytes', 'sha256']) && row[side].file === root + '/' + row.path &&
          row[side].bytes === expected.bytes && row[side].sha256 === expected.sha256, 'file row not bound to captured root and complete fingerprint');
      }
    }
    for (const status of ['equal', 'different', 'unavailable']) need(output.files.filter(row => row.status === status).length === counts[status === 'unavailable' ? 'unavailableFiles' : status + 'Files'], 'file-status accounting mismatch');
    for (const row of output.files) {
      need(['equal', 'different', 'unavailable'].includes(row.status), 'unknown file status');
      if (row.status === 'unavailable') need(!row.expected || !row.actual, 'unavailable row has both files');
      else {
        need(row.expected && row.actual, 'compared row requires both complete files');
        const equalPins = row.expected.bytes === row.actual.bytes && row.expected.sha256 === row.actual.sha256;
        need(row.status === 'equal' ? equalPins : !equalPins, 'row status contradicts captured fingerprints');
      }
    }
    const different = counts.differentFiles > 0 || counts.unavailableFiles > 0 ||
      ['expected', 'actual'].some(side => output.membership[side].missing.length || output.membership[side].unexpected.length);
    need(output.status === (different ? 'different' : 'equal') && (different ? cleanDifference(receipt) : cleanSuccess(receipt)), 'only signed public comparison status is admissible');
    return different;
  }
  function recordSettlement(call, receipt) {
    need(receipt?.schemaVersion === 'truthsrc.verified-process/v1' && receipt.cwd === J && receipt.timeoutMs === call.timeoutMs &&
      receipt.sandboxProfile === sandbox.profile && receipt.sandboxProfileSha256 === sandbox.profileSha256 &&
      samePaths(receipt.envKeys, Object.keys(env)) &&
      JSON.stringify(receipt.command) === JSON.stringify(['/usr/bin/sandbox-exec', '-p', policy, process.execPath, ...call.argv]) &&
      receipt.commandSha256 === hash(JSON.stringify(receipt.command)) &&
      fields(receipt.paths, ['receipt', 'stdout', 'stderr']) && receipt.paths.receipt === call.evidenceBase + '.json' &&
      receipt.paths.stdout === call.evidenceBase + '.stdout.log' && receipt.paths.stderr === call.evidenceBase + '.stderr.log',
      'raw receipt command, profile, environment, evidence paths and exact cap binding required');
    need(call.receipt && call.stdout && call.stderr, 'all original process captures required for settlement classification');
    const raw = captureEvidenceFile(call.receipt.file, { limit: FILE_LIMIT });
    const stdout = captureEvidenceFile(call.stdout.file, { limit: PROCESS_LIMIT });
    const stderr = captureEvidenceFile(call.stderr.file, { limit: PROCESS_LIMIT });
    need(raw.bytes === call.receipt.bytes && raw.sha256 === call.receipt.sha256 &&
      raw.value.equals(Buffer.from(JSON.stringify(receipt, null, 2) + '\n')) &&
      stdout.bytes === call.stdout.bytes && stdout.sha256 === call.stdout.sha256 &&
      stderr.bytes === call.stderr.bytes && stderr.sha256 === call.stderr.sha256 &&
      stdout.sha256 === receipt.stdoutSha256 && stderr.sha256 === receipt.stderrSha256 &&
      stdout.bytes + stderr.bytes === receipt.rawOutputBytes && receipt.rawOutputBytes <= PROCESS_LIMIT,
      'whole original receipt and complete raw logs must match before settlement classification');
    const positivePid = Number.isSafeInteger(receipt.pid) && receipt.pid > 0;
    const failedSpawn = !positivePid && receipt.pid === null && receipt.launchError === 'spawn-failed';
    need(!call.noSpawnConfirmed || !positivePid && !failedSpawn,
      'receipt contradicts the helper confirmed nonspawn state');
    call.actualPositivePidExecution = positivePid;
    call.positivePid = positivePid ? receipt.pid : null;
    call.failedSpawn = failedSpawn;
    call.suppressedLaunch = !positivePid && receipt.pid === null && receipt.launchError === null &&
      typeof receipt.cancelled === 'string' && receipt.cancelled.length > 0;
    call.spawnAttempted ||= positivePid || failedSpawn;
    call.unknownSettlement = !positivePid && !failedSpawn && !call.suppressedLaunch;
    call.code = receipt.code; call.helperPassed = receipt.passed; call.settlementRecorded = true;
  }
  async function command(id, stage, argv, c, sourcesOnly = false) {
    started ??= performance.now(); deadline ??= started + BUDGET.wallMs;
    need(PLANNED[result.calls.length] === id, 'only the predeclared ten core calls may execute');
    const base = E + '/' + id, call = { id, stage, argv, helperInvoked: false, spawnAttempted: false,
      actualPositivePidExecution: false, positivePid: null, failedSpawn: false, suppressedLaunch: false,
      unknownSettlement: false, settlementRecorded: false, noSpawnConfirmed: false,
      pinsBefore: false, pinsAfter: false, accepted: false, evidenceBase: base };
    result.calls.push(call);
    let error, output, receipt;
    try {
      checkAll(); checkDeadline('before ' + id); call.pinsBefore = true;
      call.timeoutMs = stage === 'generate' ? BUDGET.generateMs : BUDGET.compareMs;
      call.deadline = { owner: 'this exclusive core invocation', startedMonotonicMs: started, deadlineMonotonicMs: deadline,
        admittedMonotonicMs: performance.now(), fixedCapMs: call.timeoutMs, cleanupReserveMs: BUDGET.cleanupReserveMs };
      need(deadline - performance.now() >= call.timeoutMs + BUDGET.cleanupReserveMs + BUDGET.supervisorCleanupMs, 'fixed call cap and cleanup cannot fit; refuse launch rather than silently shrink a cap');
      need(result.budgets.assignedTimeoutMs + call.timeoutMs <= BUDGET.coreTotalCapsMs, 'fixed total core caps exhausted');
      const processOptions = { executable: process.execPath, args: argv, cwd: J, env, base, timeoutMs: call.timeoutMs, sandbox };
      const commandBytes = Buffer.byteLength(JSON.stringify({ command: ['/usr/bin/sandbox-exec', '-p', policy, process.execPath, ...argv] }, null, 2));
      const optionBytes = Buffer.byteLength(JSON.stringify(processOptions));
      // Clean receipts have only the command, cwd/profile/three evidence paths,
      // env keys and fixed scalar fields. Four option copies bound those repeated
      // escaped strings; 4 KiB covers fixed keys, hashes, timestamps and numbers.
      const cleanReceiptUpperBoundBytes = commandBytes + 4 * optionBytes + 4096;
      need(commandBytes <= FILE_LIMIT / 4 && optionBytes <= FILE_LIMIT / 4 &&
        cleanReceiptUpperBoundBytes <= FILE_LIMIT / 2,
        'whole escaped command, options and clean receipt must fit the fixed helper JSON headroom');
      call.byteBounds = { profileBytes: Buffer.byteLength(policy), commandBytes, optionBytes,
        cleanReceiptUpperBoundBytes, receiptLimitBytes: FILE_LIMIT,
        scope: 'fixed clean receipt eligibility; failed receipts remain helper-bounded and never accepted' };
      result.budgets.assignedTimeoutMs += call.timeoutMs; call.helperInvoked = true;
      receipt = await runVerifiedProcess(processOptions);
      for (const [key, suffix] of [['receipt', '.json'], ['stdout', '.stdout.log'], ['stderr', '.stderr.log']]) {
        call[key] = remember(pin(base + suffix, key === 'receipt' ? FILE_LIMIT : PROCESS_LIMIT));
      }
      recordSettlement(call, receipt);
      if (cleanSuccess(receipt)) validateProcessReceipt(receipt, { base });
      need(cleanSuccess(receipt) || stage === 'compare' && cleanDifference(receipt), 'public process did not close cleanly: ' + id + '; retain raw receipt and both logs');
      const stdout = captureJson(call.stdout.file, false, PROCESS_LIMIT);
      need(stdout.pin.bytes === call.stdout.bytes && stdout.pin.sha256 === call.stdout.sha256, 'stdout drift during same-Buffer parse'); output = stdout.value;
      if (stage === 'generate') need(output.applied === true && fields(output.readiness, ['level', 'runnable']) &&
        output.readiness.level === 'classic-scaffold-only' && output.readiness.runnable === false, 'public output must remain scaffold-only/non-runnable');
      else {
        const different = compareReport(output, receipt, argv, c, sourcesOnly);
        call.comparison = { status: output.status, counts: output.counts, membership: output.membership, report: call.stdout };
        if (different) { call.signedDifference = true; throw unequal('complete raw bytes or inventory differ: ' + id); }
      }
      call.accepted = true;
    } catch (failure) {
      error = failure;
      const state = processFailureState(failure);
      if (state) {
        call.processFailureState = state; call.spawnAttempted ||= state.spawnAttempted === true;
        call.noSpawnConfirmed = state.spawnAttempted === false;
      }
      if (call.helperInvoked && !call.settlementRecorded) call.unknownSettlement = !call.noSpawnConfirmed;
    } finally {
      // Recover all three independently, even if helper finalization throws or
      // admission reserved only part of its evidence before a pre-spawn failure.
      if (call.helperInvoked) for (const [key, suffix] of [['receipt', '.json'], ['stdout', '.stdout.log'], ['stderr', '.stderr.log']]) {
        try {
          owned(); const file = base + suffix, stat = fs.lstatSync(file, { throwIfNoEntry: false });
          if (stat) call[key] ??= remember(pin(file, key === 'receipt' ? FILE_LIMIT : PROCESS_LIMIT));
          else need(!call.spawnAttempted && !call.unknownSettlement, 'post-spawn or unknown settlement evidence missing: ' + file);
        } catch (failure) { (call.evidenceFailures ??= []).push(failure.message); error ??= failure; }
      }
      if (call.helperInvoked && !call.settlementRecorded) {
        call.unknownSettlement = !call.noSpawnConfirmed;
        if (call.receipt && call.stdout && call.stderr) try {
          const recovered = captureJson(call.receipt.file);
          need(recovered.pin.bytes === call.receipt.bytes && recovered.pin.sha256 === call.receipt.sha256,
            'recovered receipt drift during settlement classification');
          recordSettlement(call, recovered.value);
          call.settlementRecovered = true;
        } catch (failure) { (call.evidenceFailures ??= []).push(failure.message); error ??= failure; }
      }
      try { checkAll(); checkDeadline('after ' + id); call.pinsAfter = true; }
      catch (failure) { call.pinOrDeadlineFailure = failure.message; result.integrityFailures.push(failure.message); error ??= failure; }
      call.endedMonotonicMs = performance.now();
    }
    if (error || call.evidenceFailures?.length || call.pinOrDeadlineFailure) {
      call.accepted = false; call.failure = error?.message ?? 'incomplete process evidence'; throw error ?? new Error(call.failure);
    }
    return output;
  }
  function captureActual(c, repeat, out) {
    const row = { variant: c.id, repeat, actual: { root: out } }; captures.push(row);
    try {
      assertCanonicalPath(out); row.actual.identity = identity(out);
      row.actual.inventory = inventoryEvidence(out, { limit: FILE_LIMIT });
      // Do not hide legitimate missing/extra output behind a wrapper BLOCKED:
      // the following public comparison observes/signs this entire inventory.
      checkAll(); checkDeadline('actual inventory'); return row;
    } catch (error) { row.failure = error.message; throw error; }
  }
  function captureSources(c, row, viewsRoot) {
    try {
      need(samePaths(Object.keys(row.actual.inventory), [...c.scope.paths, ...c.scope.actualOnly]), 'source-view creation requires the already-compared complete inventory');
      const root = viewsRoot + '/' + c.id + '-' + row.repeat; newDir(root);
      row.sources = { root, identity: identity(root) };
      for (const file of c.scope.paths) {
        const captured = captureEvidenceFile(row.actual.root + '/' + file), expected = row.actual.inventory[file];
        need(captured.bytes === expected.bytes && captured.sha256 === expected.sha256, 'actual drift during same-Buffer source copy');
        ensureParents(root + '/' + file); save(root + '/' + file, captured.value, FILE_LIMIT);
      }
      row.sources.inventory = inventoryEvidence(root, { limit: FILE_LIMIT });
      compareEvidenceInventories(Object.fromEntries(c.scope.paths.map(p => [p, row.actual.inventory[p]])), row.sources.inventory);
      const ledger = captureEvidenceFile(row.actual.root + '/truthsrc.ledger.json'), expected = row.actual.inventory['truthsrc.ledger.json'];
      need(ledger.bytes === expected.bytes && ledger.sha256 === expected.sha256, 'raw ledger capture drift');
      row.ledger = save(E + '/' + c.id + '-' + row.repeat + '.ledger.json', ledger.value, FILE_LIMIT);
      need(row.ledger.bytes === ledger.bytes && row.ledger.sha256 === ledger.sha256, 'same-Buffer raw ledger copy mismatch');
      checkAll(); checkDeadline('source and ledger captures');
      return root;
    } catch (error) { row.failure = error.message; throw error; }
  }
  try {
    need(process.versions.node === '22.23.4', 'physical Node 22.23.4 required; no alternate runtime');
    need(process.platform === 'darwin', 'Darwin deny-network sandbox required; no fallback');
    need(args.length === 2 && args[0] === '--out' && path.isAbsolute(args[1]) && path.resolve(args[1]) === args[1], 'only explicit canonical --out admitted; no --matrix, caps, retries or extra cases');
    assertCanonicalPath(J); assertCanonicalPath(process.execPath, { kind: 'file' });
    const candidate = args[1], parent = path.dirname(candidate); assertCanonicalPath(parent);
    need(parent === J + '/.rounds' || parent === fs.realpathSync(tmpdir()), 'output must be a new direct child of physical repository .rounds or physical system TMP');
    assertCanonicalPath(candidate, { kind: 'new' });
    fs.mkdirSync(candidate, { mode: 0o700 });
    // Assign ownership only after this exclusive mkdir succeeds. No failure path
    // may write a pre-existing run root, even if its spelling was supplied by CLI.
    W = candidate; rootOwned = true; ownedDirs.set(W, identity(W));
    result = { schemaVersion: 'truthsrc.classic-byte-replay/v5', verdict: 'BLOCKED', ready: false,
      rootOwnership: { exclusiveAdmission: true, root: W, identity: ownedDirs.get(W) },
      generator: GENERATOR, targetProfile: TARGET, readiness: { level: 'classic-scaffold-only', runnable: false },
      plannedCalls: PLANNED.length, plannedCallIds: PLANNED, calls: [], captures, ledgerChecks: [],
      integrityFailures: [], finalizationFailures: [], budgets: { ...BUDGET, assignedTimeoutMs: 0,
        outerFormalWindowMs: 7200000, outerOwnership: 'exclusive integrator; not started/refreshed/allocated by this core wrapper' },
      boundary: 'Initial existing complete F1 baseline/timestamp-int only. Full Scala/proto/routes inventories, including test/conf/module paths, are compared without normalization. No oracle-bundle discovery, supplemental/negative/old-version calls, all31 closure, type closure, compilation, quality or runtime claim. Preserve original defects and ???. Anchors inventoried/fingerprinted only; ledger raw determinism separately observed. Completion is unsigned until closeout and successful final process exit; no standalone acceptance token.' };
    E = W + '/evidence'; newDir(E); evidenceOwned = true;
    const A = W + '/actual', RT = W + '/runtime', V = W + '/views';
    for (const dir of [A, RT, V, RT + '/home', RT + '/tmp']) newDir(dir);
    source = sourcePaths();
    need(['generator.json', 'generate.mjs', 'produce.mjs'].every(name => source.files.includes(GENERATOR + '/' + name)), 'shipped v5 generator required before replay');
    archive = archivePins(); for (const c of archive.cases) requestGate(c, archive);
    const manifest = captureJson(GENERATOR + '/generator.json');
    need(manifest.value.schemaVersion === 'truthsrc.product-generator/v1' && manifest.value.name === 'scala-cqrs-classic-v5' &&
      manifest.value.version === '5' && manifest.value.targetProfile === TARGET &&
      samePaths(manifest.value.options, ['rootPackage', 'frameworkPackage', 'moduleName', 'generatorVersion', 'knowledgeRelease']),
      'exact shipped v5 generator name/version/targetProfile@5 and original options identity required');
    const files = [...new Set([...source.files, ...archive.assets.map(row => row.file), ...archive.inputs.map(row => row.file),
      ...archive.extraSource.map(row => row.file), J + '/package.json', J + '/tools/codegen-parity.mjs', SELF, process.execPath, '/usr/bin/sandbox-exec'])];
    pins = files.map(file => pin(file, file === process.execPath || file === '/usr/bin/sandbox-exec' ? Number.MAX_SAFE_INTEGER : FILE_LIMIT));
    checkPins([...pins, ...archive.assets, ...archive.inputs, ...archive.extraSource, manifest.pin]);
    const expectedRoots = archive.cases.map(c => c.expectedRoot), roots = [W, ...expectedRoots];
    need(roots.every((r, i) => roots.every((other, k) => i === k || !inside(r, other) && !inside(other, r) &&
      JSON.stringify(identity(r).slice(0, 2)) !== JSON.stringify(identity(other).slice(0, 2)))), 'comparison/run roots overlap or alias');
    result.sourceDirectories = source.dirs;
    result.assetArchive = { manifest: archive.manifest, inventories: archive.trees };
    result.coreMatrix = save(E + '/core-matrix.json', { schemaVersion: MATRIX_SCHEMA, plannedCallIds: PLANNED,
      cases: archive.cases.map(c => ({ id: c.id, request: archive.assets.find(row => row.file === c.request),
        input: archive.inputs.find(row => row.file === c.input), options: archive.inputs.find(row => row.file === c.options),
        expectedRoot: c.expectedRoot, scope: c.scopePin, paths: c.scope.paths, expectedInventory: c.inventory,
        expectedFiles: c.expectedFiles, actualFiles: c.actualFiles, expectedBytes: c.expectedBytes, kinds: c.kinds })),
      sourceReadFiles: archive.extraSource, budget: BUDGET });
    sourceBeforeAttempted = true; result.sourceBefore = save(E + '/source-before.json', pins); sourceSealReady = true;
    result.sourcesScope = save(E + '/sources.scope.json', { schemaVersion: SCOPE_SCHEMA,
      paths: archive.cases[0].scope.paths, expectedOnly: [], actualOnly: [] }, FILE_LIMIT);
    need(archive.cases.every(c => samePaths(c.scope.paths, archive.cases[0].scope.paths)), 'both initial inputs must share the exact complete path set');
    const dirs = new Set([...source.dirs, A, RT, V, RT + '/home', RT + '/tmp']);
    const readFiles = [...pins.map(row => row.file), result.sourcesScope.file];
    for (const file of readFiles) for (let dir = path.dirname(file); ; dir = path.dirname(dir)) {
      dirs.add(dir); if (dir === path.dirname(dir)) break;
    }
    const q = JSON.stringify, system = ['/System/Library', '/usr/lib', '/Library/Apple/System/Library',
      '/private/var/db/dyld', '/usr/share/icu', '/private/var/db/timezone/zoneinfo'];
    policy = '(version 1)\n(allow default)\n(deny network*)\n(deny file-write*)\n(deny file-read-data)\n' +
      '(allow file-read-data ' + system.map(dir => '(subpath ' + q(dir) + ')').join(' ') +
      ' (literal "/dev/null") (literal "/dev/random") (literal "/dev/urandom") (literal "/private/etc/localtime") ' +
      [...new Set([...readFiles, ...dirs])].map(file => '(literal ' + q(file) + ')').join(' ') +
      ' (subpath ' + q(A) + ') (subpath ' + q(RT) + ') (subpath ' + q(V) + '))\n' +
      '(allow file-write* (subpath ' + q(A) + ') (subpath ' + q(RT) + '))\n';
    need(Buffer.byteLength(policy) <= FILE_LIMIT / 4, 'whole sandbox profile must fit the helper capture and command headroom');
    const profile = save(E + '/sandbox.sb', policy, FILE_LIMIT);
    sandbox = { executable: '/usr/bin/sandbox-exec', profile: profile.file, profileSha256: profile.sha256 };
    env = { HOME: RT + '/home', TMPDIR: RT + '/tmp', PATH: path.dirname(process.execPath) + ':/usr/bin:/bin',
      LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', TZ: 'UTC', NODE_V8_COVERAGE: '' };
    result.sandbox = { ...sandbox, environmentKeys: Object.keys(env).sort(), childWrites: [A, RT], parentOnlyEvidence: E };
    for (const c of archive.cases) {
      const views = [];
      for (const repeat of ['a', 'b']) {
        const out = A + '/' + c.id + '-' + repeat; assertCanonicalPath(out, { kind: 'new' });
        await command(c.id + '.' + repeat + '.generate', 'generate', [J + '/bin/truthsrc.js', 'generate-products',
          '--request', c.request, '--generator', GENERATOR, '--out', out, '--options-json', c.options], c);
        const captured = captureActual(c, repeat, out);
        await command(c.id + '.' + repeat + '.compare', 'compare', [J + '/tools/codegen-parity.mjs',
          '--expected', c.expectedRoot, '--actual', out, '--scope', c.scopePin.file], c);
        views.push(captureSources(c, captured, V));
      }
      await command(c.id + '.sources.compare', 'compare', [J + '/tools/codegen-parity.mjs',
        '--expected', views[0], '--actual', views[1], '--scope', result.sourcesScope.file], c, true);
      const pair = captures.filter(row => row.variant === c.id), a = captureEvidenceFile(pair[0].ledger.file), b = captureEvidenceFile(pair[1].ledger.file);
      need(a.bytes === pair[0].ledger.bytes && a.sha256 === pair[0].ledger.sha256 && b.bytes === pair[1].ledger.bytes && b.sha256 === pair[1].ledger.sha256, 'raw ledger equality input drift');
      const observation = { variant: c.id, a: pair[0].ledger, b: pair[1].ledger, equal: a.value.equals(b.value),
        claim: 'Raw ledger determinism only; no anchor equality or source normalization' };
      result.ledgerChecks.push({ ...observation, evidence: save(E + '/' + c.id + '.ledger-equality.json', observation) });
      checkAll(); checkDeadline('ledger observation'); if (!observation.equal) throw unequal('raw captured ledger bytes differ: ' + c.id);
    }
    need(result.calls.length === PLANNED.length && result.calls.every(call => call.actualPositivePidExecution &&
      call.settlementRecorded && !call.unknownSettlement && call.accepted) &&
      result.budgets.assignedTimeoutMs === BUDGET.coreTotalCapsMs && captures.length === VARIANTS.length * 2 &&
      captures.every(row => !row.failure && row.sources?.inventory && row.ledger) && result.ledgerChecks.length === VARIANTS.length &&
      result.ledgerChecks.every(row => row.equal), 'all fixed core observations and complete raw captures required');
    coreComplete = true; // Eligibility only: final pins/deadline/seal/exit still follow.
  } catch (error) { primary = error; }
  finally {
    if (rootOwned && W && result) {
      const finalFailure = error => { primary ??= error; result.finalizationFailures.push(error.message); result.verdict = 'BLOCKED'; process.exitCode = 2; };
      function finalCheck(label) {
        checkAll(); checkDeadline(label); // Check AFTER the entire final pin scan.
        result.budgets.startedMonotonicMs = started ?? null; result.budgets.deadlineMonotonicMs = deadline ?? null;
        result.budgets.elapsedMs = started === undefined ? 0 : Math.ceil(performance.now() - started);
      }
      try {
        owned();
        if (!evidenceOwned) { newDir(W + '/evidence'); E = W + '/evidence'; evidenceOwned = true; }
        if (!sourceBeforeAttempted) { sourceBeforeAttempted = true; result.sourceBefore = save(E + '/source-before.json', pins); }
      } catch (error) { finalFailure(error); }
      const after = pins.map(row => {
        try { return pin(row.file, row.bytes); }
        catch (error) { finalFailure(error); return { file: row.file, error: error.message }; }
      });
      // A long final snapshot cannot cross the wall and still sign completion.
      try { checkDeadline('after final source pins, before source-after/completion'); } catch (error) { finalFailure(error); }
      if (evidenceOwned) try { result.sourceAfter = save(E + '/source-after.json', after); } catch (error) { finalFailure(error); }
      result.effectiveCalls = result.calls.filter(call => call.actualPositivePidExecution).length;
      result.actualCalls = result.effectiveCalls;
      const failureRecord = call => ({ id: call.id, failure: call.failure, helperInvoked: call.helperInvoked,
        spawnAttempted: call.spawnAttempted, actualPositivePidExecution: call.actualPositivePidExecution,
        positivePid: call.positivePid, receipt: call.receipt ?? null, stdout: call.stdout ?? null,
        stderr: call.stderr ?? null, processFailureState: call.processFailureState ?? null });
      result.failedObservations = result.calls.filter(call => call.actualPositivePidExecution && !call.accepted).map(failureRecord);
      result.failedSpawnAttempts = result.calls.filter(call => call.failedSpawn).map(failureRecord);
      result.unknownSettlements = result.calls.filter(call => call.unknownSettlement).map(failureRecord);
      result.suppressedLaunches = result.calls.filter(call => call.suppressedLaunch).map(failureRecord);
      result.preSpawnFailures = result.calls.filter(call => (!call.helperInvoked || call.noSpawnConfirmed) &&
        !call.suppressedLaunch && !call.failedSpawn && call.failure).map(failureRecord);
      // An unknown helper settlement is neither a confirmed execution nor a
      // clean unexecuted observation. Keep it in its own blocked partition.
      result.unexecuted = PLANNED.filter(id => !result.calls.some(call => call.id === id &&
        (call.actualPositivePidExecution || call.unknownSettlement)));
      result.remaining = result.unexecuted.length + result.unknownSettlements.length; result.interrupted = interrupted ?? null;
      try { finalCheck('before completion'); } catch (error) { finalFailure(error); }
      result.integrity = { scopedPinsUnchanged: sourceSealReady && pins.length > 0 && !!result.sourceBefore && !!result.sourceAfter && !result.integrityFailures.length &&
        !result.finalizationFailures.length && result.calls.every(call => call.pinsBefore && call.pinsAfter && !call.evidenceFailures?.length), pinCount: pins.length };
      if (primary) {
        result.failure = primary.message;
        result.verdict = primary.verdict === 'FAIL' && result.integrity.scopedPinsUnchanged ? 'FAIL' : 'BLOCKED';
        try { fs.writeSync(2, primary.message + '\n'); } catch (error) { finalFailure(error); }
      } else if (coreComplete && result.integrity.scopedPinsUnchanged && result.remaining === 0) result.verdict = 'CORE_COMPLETE';
      else finalFailure(new Error('core observations or final integrity incomplete'));
      result.acceptance = { completionAloneIsUnsigned: true, requiredCloseout: W + '/closeout.json',
        requiresSuccessfulFinalExit: true, outerFormalAcceptance: 'not performed by this wrapper' };
      result.evidenceBindings = localPins.map(row => ({ ...row }));
      let completionPin;
      try {
        completionPin = save(W + '/completion.json', result);
        finalCheck('after completion write and final pins');
        // No acceptance token in stdout or completion. Even this pointer is only
        // provisional until the parent observes exit and the closeout seal.
        fs.writeSync(1, JSON.stringify({ completion: completionPin, closeout: W + '/closeout.json',
          actualCalls: result.actualCalls, failedObservations: result.failedObservations.length, unexecuted: result.unexecuted }) + '\n');
        await new Promise(done => setImmediate(done));
        finalCheck('after completion notification');
        if (primary || result.verdict !== 'CORE_COMPLETE') throw primary ?? new Error('core not eligible for closeout');
        const closeout = save(W + '/closeout.json', { schemaVersion: 'truthsrc.classic-byte-replay-closeout/v5', status: 'closed',
          completion: completionPin, coreMatrix: result.coreMatrix, sourceBefore: result.sourceBefore, sourceAfter: result.sourceAfter,
          evidenceBindings: localPins.map(row => ({ ...row })), effectiveCalls: result.effectiveCalls,
          failedObservations: result.failedObservations, failedSpawnAttempts: result.failedSpawnAttempts,
          unknownSettlements: result.unknownSettlements, suppressedLaunches: result.suppressedLaunches,
          unexecuted: result.unexecuted,
          deadline: { owner: 'this exclusive core invocation only', startedMonotonicMs: started, deadlineMonotonicMs: deadline,
            sealedMonotonicMs: performance.now(), wallMs: BUDGET.wallMs, outerFormalWindowMs: 7200000, outerBudgetRefreshed: false },
          requiresExitCodeZero: true, claim: 'Limited raw core observations; not all31/type/runtime/outer formal acceptance' });
        // The closeout is also invalid on any subsequent pin/deadline/I/O error.
        // Its mere existence, like a child equal report, never supersedes exit 2.
        need(closeout.bytes > 0, 'empty closeout seal');
        await new Promise(done => setImmediate(done));
        finalCheck('after closeout and final pins');
        process.exitCode = 0; // Last operation capable of granting a successful exit.
      } catch (error) {
        if (error !== primary || !result.finalizationFailures.length && result.verdict === 'CORE_COMPLETE') finalFailure(error);
        result.failure = primary?.message ?? error.message;
        result.invalidCompletion = completionPin ?? { file: W + '/completion.json', unsigned: true };
        result.invalidCloseout = W + '/closeout.json';
        result.integrity.scopedPinsUnchanged = false;
        process.exitCode = result.verdict === 'FAIL' && !result.finalizationFailures.length && !streamFailure && !interrupted ? 1 : 2;
        try { save(E + '/completion-failure.json', { schemaVersion: 'truthsrc.classic-byte-replay-failure/v5',
          verdict: result.verdict, failure: result.failure, finalizationFailures: result.finalizationFailures,
          integrityFailures: result.integrityFailures, interrupted: interrupted ?? null, streamFailure: streamFailure ?? null,
          invalidCompletion: result.invalidCompletion, invalidCloseout: result.invalidCloseout,
          effectiveCalls: result.effectiveCalls, failedObservations: result.failedObservations,
          preSpawnFailures: result.preSpawnFailures, failedSpawnAttempts: result.failedSpawnAttempts,
          unknownSettlements: result.unknownSettlements, suppressedLaunches: result.suppressedLaunches,
          unexecuted: result.unexecuted,
          evidenceBindings: localPins.map(row => ({ ...row })) }); }
        catch { process.exitCode = 2; /* Retain partial files; never retry or overwrite. */ }
      }
    } else if (primary) {
      // Absolutely no writes when exclusive admission failed. Do not even try to
      // place a failure receipt under the supplied, potentially historical root.
      process.exitCode = 2;
      try { fs.writeSync(2, primary.message + '\n'); } catch { /* No owned evidence root. */ }
    }
    process.off('SIGINT', onInt); process.off('SIGTERM', onTerm);
    // Stream error listeners remain installed until process exit, never downgrade.
  }
}
