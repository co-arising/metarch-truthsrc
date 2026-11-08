// One Warehouse-lite family. Test-only, opt-in; never a build/discovery framework.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { basename, delimiter, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { absolutePath, regular, within, present, files, snapshot, hash, privateOutput,
  compilerSession, acceptance } from '../compiler-tools.mjs';
import { parseStrictJson } from '../../../lib/strict-json.mjs';
import { actorToolchain, warehouseClasspaths } from './toolchain.mjs';
import { runtimeMutationAcceptance } from '../compiler-results.mjs';

const domain = 'modules/kernel/src/main/scala/example/inventory/domain/';
const glue = 'modules/glue/src/main/scala/example/inventory/';
export const candidate = 'scala-cqrs-aggregate-core@1';
export const writer = 'scala-cqrs-aggregate-core';
// Fixed from REFERENCE-CONTRACT.md, not directory extensions or generated output.
export const sourceInventory = Object.freeze({
  kernel: Object.freeze([
    'WarehouseProtocol.scala', 'WarehouseState.scala', 'ports/WarehouseComputations.scala',
    'invariant/params/WarehouseRuleParams.scala', 'invariant/WarehouseRules.scala',
    'command/WarehouseCommandHelpers.scala', 'entities/behaviors/WarehouseEventHandler.scala',
    ...['TxId', 'WarehouseId', 'SkuId', 'ReservationId'].map(name => `values/${name}.scala`),
  ].map(name => domain + name)),
  glue: Object.freeze([
    'application/aggregates/WarehouseActorProtocol.scala', 'application/aggregates/WarehouseAggregate.scala',
    'application/factories/WarehouseAggregateFactory.scala', 'application/aggregates/WarehouseActorRepository.scala',
    'infrastructure/bootstrap/WarehouseBootstrap.scala', 'infrastructure/repositories/LocalWarehouseActorRepository.scala',
    'infrastructure/serialization/DomainConverters.scala',
  ].map(name => glue + name)),
  proto: Object.freeze(['modules/glue/src/main/protobuf/inventory_domain.proto']),
  build: Object.freeze(['build.sbt', 'project/build.properties', 'project/plugins.sbt']),
  // Fixed primary sample support inventory, including both separately verified tests.
  generatedTest: Object.freeze([
    'modules/glue/src/test/scala/example/inventory/infrastructure/serialization/WarehouseStateRoundTripSpec.scala',
    'modules/glue/src/test/scala/example/inventory/domain/invariant/WarehouseAggregateReplaySpec.scala',
  ]),
});
export const metadataInventory = Object.freeze([
  '.truthsrc/canonical.json', '.truthsrc/request.json', '.truthsrc/compiled.json', '.truthsrc/inputs.json',
  'truthsrc.ledger.json', 'anchors.json',
]);
export const managedInventory = Object.freeze(['example/inventory/protobuf/InventoryDomainProto.scala']);
export const managedMessages = Object.freeze([
  'TxIdValue', 'WarehouseIdValue', 'SkuIdValue', 'ReservationIdValue',
  'WarehouseSnapshot', 'WarehouseSnapshotField0', 'WarehouseSnapshotField0Entry',
  'WarehouseSkuQuantityReserved', 'WarehouseSkuReservationCommitted',
]);
export function validateManagedSource(text) {
  assert.match(text, /^package example\.inventory\.protobuf\s*$/m);
  assert.deepEqual([...text.matchAll(/^final case class (\w+)\(/gm)].map(row => row[1]), managedMessages);
  assert.match(text, /^object InventoryDomainProto extends _root_\.scalapb\.GeneratedFileObject/m);
}

const oraclePackage = 'example.inventory.aggregatecore.reference';
const oracleLock = fileURLToPath(new URL('./oracle.lock.json', import.meta.url));
const oracleLockSha256 = '57448224ae63dd04a742b2bd6a8577f9c17c98d4e839a869e28c286e8f1534c2';
export function validateOracleBytes(path, bytes) {
  assert.equal(hash(oracleLock), oracleLockSha256, 'Independent oracle manifest changed');
  const expected = parseStrictJson(readFileSync(regular(oracleLock)));
  assert.deepEqual(Object.keys(expected).sort(), [...oracleContract.files].sort(), 'Oracle manifest inventory differs');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected[path], 'Independent oracle body changed: ' + path);
}
export function assertNoClassOverlap(productionRoots, oracleClasses) {
  const production = new Set(productionRoots.flatMap(root => files(root).filter(path => path.endsWith('.class')).map(path => relative(root, path))));
  for (const path of files(oracleClasses).filter(path => path.endsWith('.class')))
    assert(!production.has(relative(oracleClasses, path)), 'Oracle class shadows production: ' + relative(oracleClasses, path));
}
const suite = (name, testNames, extra = {}) => Object.freeze({ file: name + '.scala', suite: oraclePackage + '.' + name,
  style: 'funsuite', testNames: Object.freeze(testNames), ...extra });
// Code-controlled descriptions of exactly two registration shapes, not Scala evaluation.
export const repositoryLoops = Object.freeze({
  failure: Object.freeze({ header: '  for (phase <- Vector("identity", "behavior", "spawn")) {',
    expression: 'phase + " failure neither caches the key nor reserves its PID and same key can retry"',
    names: Object.freeze(['identity', 'behavior', 'spawn'].map(phase => phase + ' failure neither caches the key nor reserves its PID and same key can retry')) }),
  reentry: Object.freeze({ header: '  for (phase <- Vector("identity", "behavior", "spawn"); operation <- Vector("get", "close")) {',
    expression: 'phase + " callback rejects reentrant " + operation + " and a failed outer lookup is retryable"',
    names: Object.freeze(['identity', 'behavior', 'spawn'].flatMap(phase => ['get', 'close'].map(operation =>
      phase + ' callback rejects reentrant ' + operation + ' and a failed outer lookup is retryable'))) }),
});
const repositoryCases = Object.freeze([
  'same key caches the exact Handle, with identity/behavior/spawn called once in order',
  'different keys with the same PID reject before behavior/spawn without disturbing the first key',
  Object.freeze({ loop: 'failure' }),
  'failed or null spawn does not reserve a PID against a different key',
  'null callbacks, key, identity, behavior and actor result plus blank PID reject explicitly',
  Object.freeze({ loop: 'reentry' }),
  'close is idempotent, disallows get and does not stop an already handed out actor',
  'close on another thread waits for a complete lookup rather than clearing partially built ownership',
]);
const independentSuites = Object.freeze([
  suite('PureDecisionSpec', [
    'quantity rejection precedes both receipt access and any host call',
    'receipt guard is a new sample design and stops reserve and commit with empty success',
    'successful reserve invokes exactly one host with the declared four input arguments in order',
    'host exceptions propagate rather than being converted to business rejection or empty success',
    'helpers bind declared event slots only; commit neither reads irrelevant fields nor calls hosts',
    'reserve event has no fold, commit fold uses the event txid and preserves unrelated receipts',
  ]),
  suite('PersistenceSpec', [
    'query, ordered quantity rejection and duplicate empty successes do not persist',
    'reserve and commit retain journal order; same PID restart replays fold without invoking hosts',
    'factory refuses null/blank PID, state, host and both missing typed adapters',
    'generic String journal and adapted snapshot are actually injected and used during recovery',
    'throwing host stops the actor with no Accepted and no journal event',
  ]),
  suite('ReplyOrderingSpec', [
    'nonempty Accepted waits for the controlled ACK, then state matches the acknowledged fold',
    'journal per-write rejection terminates without producing Accepted',
    'failed journal Future terminates without producing Accepted or hidden retries',
  ]),
  suite('RepositorySpec', repositoryCases.flatMap(row => typeof row === 'string' ? [row] : repositoryLoops[row.loop].names),
    { registrations: repositoryCases }),
  suite('PbRoundtripSpec', [
    'all four scalar VOs traverse actual protobuf bytes with exact text, including empty and unicode',
    'state default encodes a present empty map, not a silently missing snapshot field',
    'nonempty receipt state roundtrips real bytes with nominal keys, literal values and deterministic ordering',
    'nominal map keys order by value-free protobuf bytes, not text or receipt values',
    'both declared events use distinct required nominal payloads through actual protobuf bytes',
    'missing snapshot/map/key, absent map and duplicate keys are rejected after wire parsing',
  ]),
]);
const positiveControls = Object.freeze([
  Object.freeze({ label: 'valid-host', file: 'positive/ValidHost.scala', kernelOnly: true, dependencies: Object.freeze([]) }),
  Object.freeze({ label: 'valid-adapters', file: 'positive/ValidAdapters.scala', kernelOnly: false, dependencies: Object.freeze(['valid-host']) }),
]);
const compileControl = (label, file, symbol, diagnostics, kernelOnly = false) => Object.freeze({ label, negative: 'negative/' + file + '.scala',
  symbol, diagnostics: Object.freeze(diagnostics), kernelOnly, dependencies: Object.freeze(kernelOnly ? ['valid-host'] : ['valid-host', 'valid-adapters']) });
const compilerControls = Object.freeze([
  compileControl('missing-method', 'MissingMethod', 'reservationIdentity', [/needs to be abstract/, /reservationIdentity/], true),
  compileControl('wrong-output-type', 'WrongOutputType', 'reservationIdentity', [/reservationIdentity/, /incompatible type|type mismatch/, /ReservationId/], true),
  compileControl('missing-adapters', 'MissingAdapters', 'create', [/not enough arguments/, /eventAdapter/, /snapshotAdapter/]),
  compileControl('missing-snapshot-adapter', 'MissingSnapshotAdapter', 'create', [/not enough arguments/, /snapshotAdapter/]),
  compileControl('wrong-event-adapter', 'WrongEventAdapter', 'EventAdapter', [/type mismatch/, /WarehouseProtocol\.Command/, /WarehouseProtocol\.Event/]),
  compileControl('wrong-snapshot-adapter', 'WrongSnapshotAdapter', 'SnapshotAdapter', [/type mismatch/, /SnapshotAdapter\[String\]/, /WarehouseState/]),
  compileControl('wrong-actor-protocol', 'WrongActorProtocol', 'Execute', [/Execute is not a member of object/, /WarehouseProtocol/]),
  compileControl('kernel-depends-on-glue', 'KernelDependsOnGlue', 'application', [/object application is not a member of package example\.inventory/], true),
]);
const runtimeControl = (label, layer, file, suiteFile, caseIndex, from, to, diagnostic) => {
  const target = independentSuites.find(row => row.file === suiteFile);
  return Object.freeze({ label, layer, file, suite: target, from, to, expected: Object.freeze({ kind: 'suite-rejection', suite: target.suite,
    testNames: Object.freeze([target.testNames[caseIndex]]), failedTestName: target.testNames[caseIndex], diagnostic }) });
};
const runtimeControls = Object.freeze([
  runtimeControl('early-reply', 'glue', glue + 'application/aggregates/WarehouseAggregate.scala', 'ReplyOrderingSpec.scala', 0,
    'Effect.persist[WarehouseProtocol.Event, WarehouseState](events).thenReply(replyTo)(_ => Accepted(events))',
    'replyTo ! Accepted(events)\n            Effect.persist[WarehouseProtocol.Event, WarehouseState](events)',
    /Received unexpected message[\s\S]*Accepted[\s\S]*ReplyOrderingSpec\.scala:\d+/),
  runtimeControl('rejected-calls-host', 'kernel', domain + 'invariant/WarehouseRules.scala', 'PureDecisionSpec.scala', 0,
    'if (!(params.command.quantity > 0L)) Left("quantity-positive")',
    'if (!(params.command.quantity > 0L)) {\n      params.hosts.reservationIdentity(params.command.txid, params.command.warehouseId, params.command.skuId, params.command.quantity)\n      Left("quantity-positive")\n    }',
    /host must not be evaluated on this path[\s\S]*PureDecisionSpec\.scala:\d+/),
  runtimeControl('fold-omission', 'kernel', domain + 'entities/behaviors/WarehouseEventHandler.scala', 'PureDecisionSpec.scala', 5,
    'state.copy(receipts = state.receipts.updated(value.txid, "SkuReservationCommitted"))', 'state',
    /WarehouseState[\s\S]*did not equal[\s\S]*PureDecisionSpec\.scala:\d+/),
]);
const generatedReplaySuite = Object.freeze({
  file: sourceInventory.generatedTest[1],
  suite: 'example.inventory.domain.invariant.WarehouseAggregateReplaySpec', style: 'funsuite',
  testNames: Object.freeze(['empty event history preserves the explicitly declared initial state']),
});
export const oracleContract = Object.freeze({
  status: 'ready', mechanics: 'ready',
  files: Object.freeze([...independentSuites.map(row => row.file), 'ReferenceSupport.scala', 'ControlledAggregateCoreJournal.scala',
    ...positiveControls.map(row => row.file), ...compilerControls.map(row => row.negative)]),
  suites: independentSuites, positiveControls, compilerControls, runtimeControls,
  generatedSuites: Object.freeze([Object.freeze({ file: sourceInventory.generatedTest[0], suite: 'example.inventory.infrastructure.serialization.WarehouseStateRoundTripSpec',
    style: 'wordspec', scope: 'WarehouseState serialization', leaf: 'round-trip the declared empty state through protobuf bytes',
    testNames: Object.freeze(['should round-trip the declared empty state through protobuf bytes']) }), generatedReplaySuite]),
  deferredControl: 'sequential-state-fold requires main CounterOps independent lane; Warehouse fold-omission is NOT that control',
});
// Runtime acceptance descriptors, separate from final-writer artifact kinds.
const successExpected = pattern => ({ kind: 'success', ...(pattern ? { pattern } : {}) });
const suitesExpected = (suites, testNames) => ({ kind: 'suites', suites, tests: testNames.length, testNames });

export const executionGates = Object.freeze([]);
export function assertExecutionReady() {
  assert.equal(oracleContract.status, 'ready', `Finite verification blocked: ${executionGates.join('; ')}`);
  assert(oracleContract.compilerControls.length === 8 && oracleContract.positiveControls.length === 2 && oracleContract.runtimeControls.length === 3,
    'Finite controls cannot be empty or omitted');
}

const pathFlags = new Set(['--java', '--maven-cache', '--protoc', '--source', '--oracle', '--out', '--source-receipt']);
const required = ['--java', '--maven-cache', '--protoc', '--source', '--oracle', '--out', '--mode'];
export function options(args) {
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    assert(pathFlags.has(flag) || flag === '--mode', `Unknown flag: ${flag}`);
    assert(!Object.hasOwn(result, flag), `Repeated flag: ${flag}`);
    assert(typeof value === 'string' && value.length > 0 && !value.startsWith('--'), `Missing value: ${flag}`);
    if (flag === '--mode') assert(['reference', 'generated'].includes(value), '--mode must be reference or generated');
    else absolutePath(value, flag);
    result[flag] = value;
  }
  for (const flag of required) assert(Object.hasOwn(result, flag), `Missing flag: ${flag}`);
  assert(result['--mode'] === 'generated' ? Object.hasOwn(result, '--source-receipt') : !Object.hasOwn(result, '--source-receipt'),
    '--source-receipt is required only in generated mode');
  return result;
}
function realDirectory(path) {
  absolutePath(path, 'input directory');
  assert(lstatSync(path).isDirectory() && realpathSync(path) === path, `Not a real input directory: ${path}`);
  return path;
}
export function disjoint(a, b, label) {
  absolutePath(a, label); absolutePath(b, label);
  assert(!within(a, b) && !within(b, a), `${label} must be disjoint`);
}
export function expectedSourcePaths(mode) {
  assert(['reference', 'generated'].includes(mode), 'Unknown source mode');
  return [...sourceInventory.kernel, ...sourceInventory.glue, ...sourceInventory.proto, ...sourceInventory.build,
    ...(mode === 'generated' ? [...sourceInventory.generatedTest, ...metadataInventory] : [])];
}
export function validateInventory(actual, expected, label) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), `Incomplete or extra finite ${label} inventory`);
}
export function collectProductionInputs(source, mode) {
  realDirectory(source);
  const sourcePaths = files(source);
  validateInventory(sourcePaths.map(path => relative(source, path)), expectedSourcePaths(mode), 'source');
  return sourcePaths;
}
// Mask literals/comments solely for registration brace depth. No execution/eval or AST inference.
function scalaStructure(text) {
  const masked = text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
    token => token.replace(/[^\n]/g, ' '));
  const depths = new Map(); let depth = 0;
  for (let i = 0; i < masked.length; i++) {
    depths.set(i, depth);
    if (masked[i] === '{') depth++;
    if (masked[i] === '}') depth--;
    assert(depth >= 0, 'Invalid suite structure');
  }
  assert.equal(depth, 0, 'Unclosed suite structure');
  return depths;
}
export function validateSuiteSource(text, expected) {
  assert(typeof expected?.suite === 'string' && /^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)+$/.test(expected.suite), 'Fixed oracle suite FQN required');
  assert(Array.isArray(expected.testNames) && expected.testNames.length > 0 && new Set(expected.testNames).size === expected.testNames.length,
    'Fixed unique literal oracle test names required');
  const parts = expected.suite.split('.'), name = parts.pop();
  assert.match(text, new RegExp(`^package ${parts.join('\\.')}\\s*$`, 'm'), 'Oracle package drifted');
  const depths = scalaStructure(text);
  if (expected.style === 'wordspec') {
    assert.equal(expected.suite, oracleContract.generatedSuites[0].suite, 'Only fixed generated WordSpec admitted');
    assert.match(text, new RegExp(`^final class ${name} extends AnyWordSpec \\{$`, 'm'), 'Generated WordSpec declaration drifted');
    assert(text.includes(`\n  "${expected.scope}" should {\n    "${expected.leaf}" in {\n`), 'Generated WordSpec scope/leaf drifted');
    assert.equal((text.match(/\b(?:in|should)\s*\{/g) ?? []).length, 2, 'Extra/nonliteral generated WordSpec cases');
    assert.equal((text.match(/\btest\s*\(/g) ?? []).length, 0, 'Unexpected FunSuite test in WordSpec');
    assert.deepEqual(expected.testNames, ['should ' + expected.leaf], 'Generated reporter case name drifted');
    return;
  }
  assert.match(text, new RegExp(`^final class ${name} extends AnyFunSuite\\b`, 'm'), 'Oracle suite declaration drifted');
  const registrations = [...text.matchAll(/^( +)test\(([^\n]*)\) \{$/gm)];
  assert.equal((text.match(/\btest\s*\(/g) ?? []).length, registrations.length, 'Only enumerated literal tests are admitted');
  const declared = expected.registrations ?? expected.testNames;
  assert.equal(registrations.length, declared.length, 'Oracle registration count drifted');
  if (expected.registrations) assert.equal(expected.suite, oraclePackage + '.RepositorySpec', 'Only Repository fixed registration loops admitted');
  const names = [];
  registrations.forEach((match, i) => {
    const row = declared[i];
    if (typeof row === 'string') {
      assert.equal(match[1], '  ', 'Oracle literal registration indentation drifted');
      assert.equal(depths.get(match.index), 1, 'Literal test must be directly in suite');
      assert.equal(match[2], JSON.stringify(row), 'Oracle test names/count drifted; expectations cannot follow runtime logs');
      names.push(row);
    } else {
      const loop = repositoryLoops[row.loop];
      assert(loop, 'Unadmitted registration loop');
      assert.equal(match[1], '    ', 'Repository loop registration indentation drifted');
      assert.equal(match[2], loop.expression, 'Repository fixed test expression drifted');
      const prefix = loop.header + '\n';
      const start = match.index - prefix.length;
      assert.equal(text.slice(start, match.index), prefix, 'Repository fixed phase/operation loop drifted');
      assert.equal(depths.get(start), 1, 'Repository loop must be directly in suite');
      assert.equal(depths.get(match.index), 2, 'Repository test must be inside the fixed loop');
      names.push(...loop.names);
    }
  });
  assert.deepEqual(names, expected.testNames, 'Oracle test names/count drifted; expectations cannot follow runtime logs');
}
export function collectOracleInputs(oracle) {
  realDirectory(oracle);
  const paths = files(oracle);
  validateInventory(paths.map(path => relative(oracle, path)), oracleContract.files, 'oracle');
  for (const path of paths) validateOracleBytes(relative(oracle, path), readFileSync(path));
  for (const row of oracleContract.suites) validateSuiteSource(readFileSync(regular(join(oracle, row.file)), 'utf8'), row);
  return paths;
}
export function collectInputs(source, oracle, mode) {
  disjoint(source, oracle, 'Production source and independent oracle');
  const sourcePaths = collectProductionInputs(source, mode);
  realDirectory(oracle);
  assertExecutionReady();
  const oraclePaths = collectOracleInputs(oracle);
  if (mode === 'generated') for (const suite of oracleContract.generatedSuites)
    validateSuiteSource(readFileSync(regular(join(source, suite.file)), 'utf8'), suite);
  return { sourcePaths, oraclePaths };
}

const kinds = Object.freeze({
  'WarehouseProtocol.scala': 'protocol', 'WarehouseState.scala': 'state', 'WarehouseComputations.scala': 'computation-port',
  'WarehouseRuleParams.scala': 'rule-parameters', 'WarehouseRules.scala': 'rules', 'WarehouseCommandHelpers.scala': 'command-helpers',
  'WarehouseEventHandler.scala': 'event-handler', 'WarehouseActorProtocol.scala': 'actor-protocol', 'WarehouseAggregate.scala': 'aggregate',
  'WarehouseAggregateFactory.scala': 'aggregate-factory', 'WarehouseActorRepository.scala': 'actor-repository',
  'WarehouseBootstrap.scala': 'aggregate-bootstrap', 'LocalWarehouseActorRepository.scala': 'actor-repository-implementation',
  'DomainConverters.scala': 'converter',
});
export function kindFor(path) {
  assert(expectedSourcePaths('generated').includes(path), `Unknown finite artifact: ${path}`);
  if (path.startsWith('.truthsrc/')) return 'project-evidence';
  if (sourceInventory.build.includes(path)) return 'build';
  if (sourceInventory.proto.includes(path)) return 'proto';
  if (sourceInventory.generatedTest.includes(path)) return 'generated-test';
  if (sourceInventory.kernel.includes(path) && path.startsWith(domain + 'values/')) return 'value-object';
  assert(Object.hasOwn(kinds, basename(path)), `Artifact has no final-writer kind: ${path}`);
  return kinds[basename(path)];
}
export const writerInventory = Object.freeze(expectedSourcePaths('generated').filter(path => !['truthsrc.ledger.json', 'anchors.json'].includes(path)));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = path => parseStrictJson(readFileSync(regular(path)));

// Detached-data contract test seam. Real generatedEvidence supplies actual byte pins.
export function checkWriterRecords(source, receipt, ledger, inputs, pins) {
  assert.equal(receipt.schemaVersion, 'truthsrc.project-result/v1', 'Expected real generate-project receipt');
  assert.equal(receipt.applied, true, 'Plan-only receipt cannot certify final writer bytes');
  assert.equal(receipt.result?.name, writer, 'Wrong final writer generator');
  assert.equal(receipt.result?.ledger, join(source, 'truthsrc.ledger.json'), 'Receipt points to a different output');
  assert.equal(receipt.result?.anchors, join(source, 'anchors.json'), 'Receipt points to a different anchor output');
  assert.equal(ledger.generator, writer, 'Wrong ledger generator');
  assert(Array.isArray(inputs.sources) && inputs.sources.length > 0, 'Writer has no real source records');
  assert.deepEqual(inputs.sources, receipt.sources, 'Generated metadata and execution receipt have different inputs');
  const owners = inputs.sources.filter(row => row.role === 'project');
  assert.equal(owners.length, 1, 'Writer must identify one real project owner');
  const owner = absolutePath(owners[0].file, 'writer project owner');
  assert(Array.isArray(inputs.generatedFiles), 'Writer must describe whole generated file set');
  validateInventory(inputs.generatedFiles, writerInventory.filter(path => !path.startsWith('.truthsrc/')), 'writer whole-file');
  assert.equal(receipt.result.total, writerInventory.length, 'Final writer total differs from full inventory');
  assert(Array.isArray(ledger.entries) && Array.isArray(receipt.result.actions), 'Final writer records are missing');
  validateInventory(ledger.entries.map(row => row.path), writerInventory, 'ledger');
  validateInventory(receipt.result.actions.map(row => row.path), writerInventory, 'receipt action');
  validateInventory(pins.map(row => row.path), writerInventory, 'final byte pin');
  for (const pin of pins) {
    assert(/^[a-f0-9]{64}$/.test(pin.sha256), `Invalid final byte pin: ${pin.path}`);
    const entry = ledger.entries.find(row => row.path === pin.path), action = receipt.result.actions.find(row => row.path === pin.path);
    assert.equal(entry.ownership?.generator, writer, 'Wrong writer entry owner generator');
    assert.equal(entry.ownership?.id, owner, 'Writer ownership does not match project');
    assert.equal(entry.kind, kindFor(pin.path), 'Writer kind differs from finite artifact');
    assert.equal(action.kind, entry.kind, 'Writer action and ledger kinds differ');
    assert.equal(entry.ownership?.fingerprint, `sha256:${pin.sha256}`, `Writer ledger does not match actual bytes: ${pin.path}`);
    assert.equal(action.fingerprint, `sha256:${pin.sha256}`, `Writer receipt does not match actual bytes: ${pin.path}`);
    assert(['ADD', 'COVER', 'MERGE', 'IDENTICAL'].includes(action.outcome), `Unaccepted writer action: ${pin.path}`);
  }
  return owner;
}
export function producerProof(recordedRoot, pins) {
  assert(typeof recordedRoot === 'string', 'Writer producer root is missing');
  const root = absolutePath(recordedRoot.endsWith('/') ? recordedRoot.slice(0, -1) : recordedRoot, 'producer root');
  const paths = pins.map(row => row.path);
  assert(paths.length > 0 && new Set(paths).size === paths.length, 'Producer must have unique actual files');
  for (const row of pins) {
    absolutePath(row.path, 'producer source');
    assert(row.path !== root && within(row.path, root) && /^[a-f0-9]{64}$/.test(row.sha256), 'Invalid producer byte pin');
  }
  const ordered = [...pins].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return digest(JSON.stringify(ordered.map(row => [row.path.slice(recordedRoot.length), row.sha256])) + '\n');
}
export function generatedEvidence(source, receiptPath) {
  realDirectory(source); regular(absolutePath(receiptPath, '--source-receipt'));
  assert(!within(receiptPath, source), 'Generated source receipt must be outside source tree');
  collectProductionInputs(source, 'generated');
  const receipt = readJson(receiptPath), ledger = readJson(join(source, 'truthsrc.ledger.json'));
  const inputs = readJson(join(source, '.truthsrc/inputs.json'));
  const finalBytes = writerInventory.map(path => ({ path, sha256: hash(join(source, path)) }));
  const owner = checkWriterRecords(source, receipt, ledger, inputs, finalBytes);
  const project = readJson(owner);
  assert.equal(project.schemaVersion, 'truthsrc.project/v1', 'Real project schema required');
  assert.equal(project.generator, 'scala-cqrs-aggregate-core-v1', 'Project uses a different producer');
  assert.equal(project.context, 'inventory', 'Different author sample context');
  assert.equal(project.canonicalId, 'inventory-domain', 'Different author canonical identity');
  assert(Array.isArray(project.documents) && project.documents.length === 0, 'Warehouse-lite has no side document inputs');
  assert(typeof project.tree === 'string' && project.tree.length > 0 && !project.tree.includes('\0'), 'Real project author tree required');
  const treeRoot = realDirectory(absolutePath(resolve(dirname(owner), project.tree), 'author tree'));
  disjoint(source, treeRoot, 'Generated source and author tree');
  const fileRows = inputs.sources.filter(row => row.file);
  assert.equal(new Set(fileRows.map(row => row.file)).size, fileRows.length, 'Duplicate writer source records');
  for (const row of inputs.sources) assert(['project', 'tree', 'tool'].includes(row.role), 'Unknown Warehouse-lite source role');
  const inputHashes = fileRows.map(row => {
    absolutePath(row.file, 'writer input'); regular(row.file);
    const bytes = readFileSync(row.file), sha256 = digest(bytes);
    assert.equal(sha256, row.sha256, `Writer source input has changed: ${row.file}`);
    assert.equal(bytes.length, row.bytes, `Writer source byte length has changed: ${row.file}`);
    return { path: row.file, sha256 };
  });
  const trees = inputs.sources.filter(row => row.role === 'tree');
  assert(trees.length > 0, 'Writer receipt must include the real author tree');
  assert.deepEqual(files(treeRoot).sort(), trees.map(row => row.file).sort(), 'Writer author tree whole-file inventory has changed');
  const toolRows = inputs.sources.filter(row => row.role === 'tool');
  assert.equal(toolRows.length, 1, 'Writer must pin one real producer fingerprint');
  assert(!toolRows[0].file, 'Tool record must pin its producer root, not an arbitrary file');
  const recordedRoot = toolRows[0].root;
  assert(typeof recordedRoot === 'string', 'Writer producer root is missing');
  const producerRoot = realDirectory(absolutePath(recordedRoot.endsWith('/') ? recordedRoot.slice(0, -1) : recordedRoot, 'producer root'));
  disjoint(source, producerRoot, 'Generated source and producer');
  const producerPaths = ['lib', 'src', 'generators', 'schema', 'scaffold'].flatMap(dir => files(join(producerRoot, dir)))
    .concat([regular(join(producerRoot, 'bin/truthsrc.js')), regular(join(producerRoot, 'package.json'))]).sort();
  const producerPins = snapshot(producerPaths), producerFingerprint = producerProof(recordedRoot, producerPins);
  assert.equal(producerFingerprint, toolRows[0].sha256, 'Producer has changed since final writer receipt');
  inputHashes.push(...producerPins);
  return { receipt: receiptPath, sha256: hash(receiptPath), generator: writer, owner, treeRoot, producerRoot, producerFingerprint,
    inputs: inputs.sources, finalBytes, inputHashes, inputFiles: inputHashes.map(row => row.path) };
}

export function pinBytes(bytes, sha256, label) {
  assert(Buffer.isBuffer(bytes) && /^[a-f0-9]{64}$/.test(sha256 ?? ''), 'Admitted Buffer and SHA256 required');
  assert.equal(digest(bytes), sha256, `Staged bytes differ from admitted input: ${label}`);
  return bytes; // The exact checked Buffer is what the exclusive writer receives.
}
export function stagePinned(io, path, destination, pins) {
  return io.write(destination, pinBytes(readFileSync(regular(path)), pins.get(path), path));
}

// Kept as an export for existing finite Actor consumers.
export { runtimeMutationAcceptance } from '../compiler-results.mjs';

// First-written process/phase logs become immutable pins for every later phase.
export function extendLogPins(before, after) {
  assert.equal(new Set(after.map(row => row.path)).size, after.length, 'Duplicate log evidence path');
  for (const row of before) assert.deepEqual(after.find(item => item.path === row.path), row, 'Earlier process/phase log changed or disappeared');
  return after.map(row => ({ ...row }));
}

export function compilerControlClasspath(control, tools, classes, positives) {
  assert([...oracleContract.positiveControls, ...oracleContract.compilerControls].includes(control), 'Finite compiler fixture required');
  const dependencies = control.dependencies.map(label => {
    assert(positives[label], 'Control requires passed positive dependency: ' + label);
    assert(!Object.values(classes).includes(positives[label]) && ![...tools.compiler, ...tools.plugin, ...tools.runtime,
      ...tools.actorLibraries, ...tools.testLibraries, ...tools.actorTestLibraries].includes(positives[label]), 'Positive output must be exclusive from production/tools/oracle/test roles');
    return absolutePath(positives[label], 'Positive class output');
  });
  const cp = control.kernelOnly ? [tools.library, classes.kernel] : warehouseClasspaths(tools, classes).production;
  assert.equal(new Set([...cp, ...dependencies]).size, cp.length + dependencies.length, 'Positive output must be exclusive');
  return [...cp, ...dependencies];
}

export function mutationBytes(bytes, control) {
  assert(Buffer.isBuffer(bytes) && oracleContract.runtimeControls.includes(control), 'Finite owned mutation recipe required');
  const text = bytes.toString('utf8');
  assert(Buffer.from(text).equals(bytes), 'Mutation input must be exact UTF-8');
  assert.equal(text.split(control.from).length, 2, 'Mutation anchor missing or ambiguous: ' + control.label);
  const changed = Buffer.from(text.replace(control.from, control.to));
  assert(!changed.equals(bytes), 'Mutation must actually change source bytes');
  return changed;
}
const suiteExpected = target => suitesExpected([target.suite], target.testNames);
function expectedDescriptor(expected) {
  if (expected.kind === 'suites') return { kind: expected.kind, suites: expected.suites, tests: expected.tests, testNames: expected.testNames };
  if (expected.kind === 'suite-rejection') return { kind: expected.kind, suite: expected.suite, testNames: expected.testNames,
    failedTestName: expected.failedTestName, diagnostic: expected.diagnostic instanceof RegExp ? expected.diagnostic.source : expected.diagnostic };
  if (expected.kind === 'compiler-rejection') return { kind: expected.kind, file: expected.file, symbol: expected.symbol,
    diagnostics: expected.diagnostics.map(pattern => pattern instanceof RegExp ? pattern.source : pattern) };
  return { kind: expected.kind, ...(expected.pattern ? { pattern: expected.pattern instanceof RegExp ? expected.pattern.source : expected.pattern } : {}) };
}
export function fixedPhasePlan(mode) {
  assert(['reference', 'generated'].includes(mode), 'Unknown phase mode');
  const row = (label, expected = successExpected()) => ({ label, ...expectedDescriptor(expected) });
  const plan = [row('java-version', successExpected(/version "11\./)), row('protoc-version', successExpected(/^libprotoc 3\.21\.9\s*$/m)),
    ...['kernel-production', 'protoc-scalapb', 'pb-production', 'glue-production', 'independent-oracle'].map(label => row(label)),
    row('independent-oracle-suites', suitesExpected(oracleContract.suites.map(target => target.suite),
      oracleContract.suites.flatMap(target => target.testNames)))];
  if (mode === 'generated') plan.push(row('generated-tests'), ...oracleContract.generatedSuites.map((suite, index) => row('generated-test-suite-' + index, suiteExpected(suite))));
  plan.push(...oracleContract.positiveControls.map(control => row(control.label + '-positive')),
    ...oracleContract.compilerControls.map(control => row(control.label + '-negative', { kind: 'compiler-rejection',
      file: basename(control.negative), symbol: control.symbol, diagnostics: control.diagnostics })));
  for (const control of oracleContract.runtimeControls) {
    plan.push(row(control.label + '-unmutated-suite', suiteExpected(control.suite)));
    if (control.layer === 'kernel') plan.push(row(control.label + '-kernel'));
    plan.push(row(control.label + '-glue'), row(control.label + '-oracle'), row(control.label + '-case', control.expected));
  }
  assert.equal(new Set(plan.map(row => row.label)).size, plan.length, 'Repeated finite phase');
  return plan;
}
export function validatePhaseResults(runs, mode) {
  assert.deepEqual(runs.map(run => ({ label: run.label, ...expectedDescriptor(run.expected) })), fixedPhasePlan(mode), 'Missing/extra/reordered/drifted finite phases');
  for (const run of runs) {
    assert.equal(run.accepted, true, 'Unaccepted finite phase: ' + run.label);
    assert.equal(run.exitCode, ['compiler-rejection', 'suite-rejection'].includes(run.expected.kind) ? 1 : 0, 'Wrong phase exit code');
    assert.equal(run.signal, null, 'Signalled finite phase');
    assert(!run.processError, 'Process lifecycle error in finite phase');
  }
}

export function preflight(opts) {
  const source = opts['--source'], oracle = opts['--oracle'], mode = opts['--mode'];
  const out = absolutePath(opts['--out'], '--out');
  assert(!present(out), `Output must be absent (including symlinks): ${out}`);
  disjoint(source, oracle, 'Production source and independent oracle');
  if (mode === 'generated') {
    assert(!within(opts['--source-receipt'], oracle), 'Source receipt must be outside independent oracle tree');
  }
  const collected = collectInputs(source, oracle, mode);
  const evidence = mode === 'generated' ? generatedEvidence(source, opts['--source-receipt']) : null;
  const tools = actorToolchain(opts['--java'], opts['--maven-cache'], opts['--protoc']);
  const inputPaths = [...new Set([...collected.sourcePaths, ...collected.oraclePaths, ...(evidence ? [evidence.receipt, ...evidence.inputFiles] : [])])];
  const verifier = fileURLToPath(import.meta.url);
  const toolPaths = [...new Set([...tools.paths, verifier, oracleLock,
    fileURLToPath(new URL('./toolchain.mjs', import.meta.url)), fileURLToPath(new URL('../compiler-tools.mjs', import.meta.url)),
    ...['process.mjs', 'files.mjs', 'callbacks.mjs'].map(name => fileURLToPath(new URL('../../../lib/verification/' + name, import.meta.url))),
    ...['immutable-data.mjs', 'strict-json.mjs', 'products/request.mjs'].map(name => fileURLToPath(new URL('../../../lib/' + name, import.meta.url))),
  ])];
  const before = { inputs: snapshot(inputPaths), toolchain: snapshot(toolPaths) };
  for (const control of oracleContract.runtimeControls) {
    const path = regular(join(source, control.file));
    mutationBytes(pinBytes(readFileSync(path), before.inputs.find(row => row.path === path)?.sha256, path), control);
  }
  assert.deepEqual(snapshot(tools.paths), tools.supplyHashes, 'Supply pins changed after admission');
  assert.deepEqual(snapshot(tools.includeHashes.map(row => row.path)), tools.includeHashes, 'Includes changed after extraction');
  if (evidence) assert.deepEqual(generatedEvidence(source, evidence.receipt), evidence, 'Source evidence changed during preflight');
  for (const input of [source, oracle, tools.cache, tools.javaHome, dirname(verifier), ...inputPaths, ...toolPaths,
    ...(evidence ? [evidence.treeRoot, evidence.producerRoot] : [])]) disjoint(out, input, 'Output and input/tool');
  return { source, oracle, mode, out, collected, evidence, tools, inputPaths, toolPaths, before };
}

export async function main(args = process.argv.slice(2)) {
  assert(!process.env.NODE_TEST_CONTEXT, 'NODE_TEST_CONTEXT forbids JVM/native execution');
  const opts = options(args);
  // Source inventory, independent cases and both generated suites are fixed;
  // readiness admits execution, never a compiled or behavior qualification.
  assertExecutionReady();
  const admitted = preflight(opts);
  return compileWarehouseLane(admitted);
}

async function compileWarehouseLane({ source, oracle, mode, out, collected, evidence, tools, inputPaths, toolPaths, before }) {
  assertExecutionReady();
  assert(!process.env.NODE_TEST_CONTEXT, 'NODE_TEST_CONTEXT forbids JVM/native execution');
  const io = privateOutput(out, [source, oracle, tools.cache, tools.javaHome, ...inputPaths, ...toolPaths,
    ...(evidence ? [evidence.treeRoot, evidence.producerRoot] : [])]);
  const session = compilerSession(io, tools, { suiteRejectionAcceptance: runtimeMutationAcceptance });
  const phasePlan = fixedPhasePlan(mode);
  let logPins = [], checkpoint = 0;
  const captureLogs = () => { logPins = extendLogPins(logPins, snapshot(files(join(io.out, 'logs')))); };
  // Only hash checkpoints around the *existing* async session, not a new runner.
  const phase = async (method, ...args) => {
    captureLogs();
    const number = String(++checkpoint).padStart(2, '0');
    io.json(`log-hashes-${number}-before.json`, logPins);
    try {
      assert.equal(method === 'protocVersion' ? 'protoc-version' : args[0], phasePlan[checkpoint - 1]?.label, 'Phase launch differs from fixed plan');
      const result = await session[method](...args);
      assert.deepEqual({ label: result.label, ...expectedDescriptor(result.expected) }, phasePlan[checkpoint - 1], 'Phase acceptance differs from fixed plan');
      return result;
    } finally { captureLogs(); io.json(`log-hashes-${number}-after.json`, logPins); }
  };
  let failure, stagedBefore, managedBefore;
  const mutationPins = [], mutationRoots = [], mutations = [];
  let hashesUnchanged = false;
  try {
    io.json('hashes-before.json', before);
    io.json('phase-plan.json', phasePlan);
    io.json('source-evidence.json', { candidate, mode, source, oracle, evidence, sourceInventory, oracleContract });
    io.json('toolchain.json', { artifacts: tools.artifacts, parents: tools.parents, pomClosure: tools.pomClosure, resources: tools.resources,
      compiler: tools.compiler, kernelTargetClasspath: [tools.library], plugin: tools.plugin, runtime: tools.runtime,
      actorLibraries: tools.actorLibraries, actorTestLibraries: tools.actorTestLibraries, testLibraries: tools.testLibraries, manifests: tools.manifests });
    const pins = new Map(before.inputs.map(row => [row.path, row.sha256]));
    const copied = new Map(collected.sourcePaths.map(path => [path, stagePinned(io, path, join('inputs/source', relative(source, path)), pins)]));
    const oracleCopied = new Map(collected.oraclePaths.map(path => [path, stagePinned(io, path, join('inputs/oracle', relative(oracle, path)), pins)]));
    const sourceSet = name => sourceInventory[name].map(path => copied.get(join(source, path)));
    const oraclePath = name => oracleCopied.get(join(oracle, name));
    stagedBefore = snapshot([...files(join(io.out, 'inputs')), ...files(join(io.out, 'includes')), ...files(join(io.out, 'tools'))]);
    io.json('staged-hashes-before.json', stagedBefore);
    await phase('jvm','java-version', ['-version'], successExpected(/version "11\./));
    await phase('protocVersion');
    const classes = Object.fromEntries(['kernel', 'pb', 'glue', 'oracle', ...(mode === 'generated' ? ['generated-test'] : [])]
      .map(name => [name, io.directory(`classes/${mode}/${name}`)]));
    const cp = warehouseClasspaths(tools, classes);
    await phase('compile','kernel-production', sourceSet('kernel'), cp.kernel, classes.kernel);
    const managed = io.directory(`managed/${mode}`);
    await phase('generate','protoc-scalapb', join(io.out, 'inputs/source/modules/glue/src/main/protobuf'), sourceSet('proto'), managed);
    const managedSources = files(managed);
    validateInventory(managedSources.map(path => relative(managed, path)), managedInventory, 'managed ScalaPB');
    validateManagedSource(readFileSync(managedSources[0], 'utf8'));
    managedBefore = snapshot(managedSources);
    io.json('managed-hashes-before.json', managedBefore);
    await phase('compile','pb-production', managedSources, cp.pb, classes.pb);
    await phase('compile','glue-production', sourceSet('glue'), cp.glue, classes.glue);
    const oracleSources = oracleContract.files.filter(path => path.endsWith('.scala') && !path.startsWith('positive/') && !path.startsWith('negative/')).map(oraclePath);
    const runSuite = (label, suite, classpath, oracleClasses, expected, selectedCase) => phase('jvm', label,
      ['-cp', [...classpath, oracleClasses].join(delimiter), 'org.scalatest.tools.Runner', '-R', oracleClasses,
        '-oWF', '-s', suite.suite, ...(selectedCase ? ['-t', selectedCase] : [])], expected);
    await phase('compile','independent-oracle', oracleSources, cp.tests, classes.oracle);
    assertNoClassOverlap([classes.kernel, classes.pb, classes.glue], classes.oracle);
    const suiteNames = oracleContract.suites.map(row => row.suite), testNames = oracleContract.suites.flatMap(row => row.testNames);
    await phase('jvm','independent-oracle-suites', ['-cp', [...cp.tests, classes.oracle].join(delimiter), 'org.scalatest.tools.Runner',
      '-R', classes.oracle, '-oW', ...suiteNames.flatMap(name => ['-s', name])], suitesExpected(suiteNames, testNames));
    if (mode === 'generated') {
      await phase('compile','generated-tests', sourceSet('generatedTest'), cp.tests, classes['generated-test']);
      assertNoClassOverlap([classes.kernel, classes.pb, classes.glue], classes['generated-test']);
      for (const [index, generated] of oracleContract.generatedSuites.entries())
        await runSuite('generated-test-suite-' + index, generated, cp.tests, classes['generated-test'], suiteExpected(generated));
    }
    const positives = {};
    for (const control of oracleContract.positiveControls) {
      const target = io.directory(`classes/${mode}/controls/${control.label}`);
      await phase('compile', control.label + '-positive', [oraclePath(control.file)], compilerControlClasspath(control, tools, classes, positives), target);
      positives[control.label] = target;
    }
    for (const control of oracleContract.compilerControls) {
      await phase('compile', control.label + '-negative', [oraclePath(control.negative)], compilerControlClasspath(control, tools, classes, positives),
        io.directory(`classes/${mode}/controls/${control.label}-negative`),
        { kind: 'compiler-rejection', file: basename(control.negative), symbol: control.symbol, diagnostics: control.diagnostics });
    }
    for (const control of oracleContract.runtimeControls) {
      // Same unmodified independent suite must pass before its isolated one-case counterexample.
      await runSuite(control.label + '-unmutated-suite', control.suite, cp.tests, classes.oracle, suiteExpected(control.suite));
      const mutantSources = new Map([...sourceInventory.kernel, ...sourceInventory.glue].map(path => {
        const original = join(source, path), bytes = pinBytes(readFileSync(regular(original)), pins.get(original), original);
        const changed = path === control.file ? mutationBytes(bytes, control) : bytes;
        return [path, io.write(join('mutations', mode, control.label, 'source', path), changed)];
      }));
      const root = join(io.out, 'mutations', mode, control.label, 'source');
      const beforeMutation = snapshot(files(root));
      mutationRoots.push(root);
      mutationPins.push(...beforeMutation);
      io.json(`mutations/${mode}/${control.label}/hashes-before.json`, beforeMutation);
      const mutantClasses = { kernel: control.layer === 'kernel' ? io.directory(`classes/${mode}/mutations/${control.label}/kernel`) : classes.kernel,
        pb: classes.pb, glue: io.directory(`classes/${mode}/mutations/${control.label}/glue`),
        oracle: io.directory(`classes/${mode}/mutations/${control.label}/oracle`) };
      const mutantCP = warehouseClasspaths(tools, mutantClasses);
      if (control.layer === 'kernel') await phase('compile', control.label + '-kernel', sourceInventory.kernel.map(path => mutantSources.get(path)), mutantCP.kernel, mutantClasses.kernel);
      await phase('compile', control.label + '-glue', sourceInventory.glue.map(path => mutantSources.get(path)), mutantCP.glue, mutantClasses.glue);
      await phase('compile', control.label + '-oracle', oracleSources, mutantCP.tests, mutantClasses.oracle);
      assertNoClassOverlap([mutantClasses.kernel, mutantClasses.pb, mutantClasses.glue], mutantClasses.oracle);
      await runSuite(control.label + '-case', control.suite, mutantCP.tests, mutantClasses.oracle, control.expected, control.expected.failedTestName);
      const afterMutation = snapshot(files(root));
      io.json(`mutations/${mode}/${control.label}/hashes-after.json`, afterMutation);
      assert.deepEqual(afterMutation, beforeMutation, 'Owned mutation copy changed during its control');
      const record = { label: control.label, file: control.file, sourceSha256: pins.get(join(source, control.file)),
        mutationSha256: hash(mutantSources.get(control.file)), from: control.from, to: control.to, classOutputs: mutantClasses,
        target: control.expected.failedTestName, suite: control.suite.suite, diagnostic: control.expected.diagnostic.source,
        sequentialStateFold: false };
      mutations.push(record);
      io.json(`mutations/${mode}/${control.label}/control.json`, record);
    }
    validatePhaseResults(session.runs, mode);
  } catch (error) { failure = error.stack ?? String(error); }
  finally {
    try {
      const after = { inputs: snapshot(inputPaths), toolchain: snapshot(toolPaths) };
      io.json('hashes-after.json', after);
      assert.deepEqual(after, before, 'Source/tool/JAR inputs changed during execution');
      assert.deepEqual(files(source), collected.sourcePaths, 'Production whole-file inventory changed');
      assert.deepEqual(files(oracle), collected.oraclePaths, 'Oracle whole-file inventory changed');
      if (stagedBefore) {
        const after = snapshot([...files(join(io.out, 'inputs')), ...files(join(io.out, 'includes')), ...files(join(io.out, 'tools'))]);
        io.json('staged-hashes-after.json', after); assert.deepEqual(after, stagedBefore, 'Staged bytes/includes/launcher changed');
      }
      if (managedBefore) {
        const after = snapshot(files(join(io.out, 'managed', mode)));
        io.json('managed-hashes-after.json', after); assert.deepEqual(after, managedBefore, 'Managed ScalaPB source bytes changed');
      }
      const mutationAfter = snapshot(mutationRoots.flatMap(root => files(root)));
      io.json('mutation-hashes-final.json', mutationAfter);
      assert.deepEqual(mutationAfter, mutationPins, 'Mutation whole-source inventory/bytes changed');
      if (evidence) assert.deepEqual(generatedEvidence(source, evidence.receipt), evidence, 'Final writer/author/producer evidence changed');
      captureLogs();
      io.json('log-hashes-final.json', logPins);
      hashesUnchanged = true;
    } catch (error) { failure = [failure, error.stack ?? String(error)].filter(Boolean).join('\n'); }
    const logs = snapshot(files(join(io.out, 'logs')));
    const passed = !failure && hashesUnchanged && session.runs.every(run => run.accepted);
    io.json('execution.json', { candidate, mode, source, oracle, sourceEvidence: evidence, passed, failure: failure ?? null,
      hashesUnchanged, inputs: before.inputs, toolchain: before.toolchain, stagedSources: stagedBefore ?? [], managedSources: managedBefore ?? [],
      logs, runs: session.runs, phasePlan, mutations, mutationSources: mutationPins, deferredControl: oracleContract.deferredControl,
      network: 'denied', writeRoot: io.out, timeoutMsPerPhase: 120000,
      independentSuites: oracleContract.suites, generatedSuites: mode === 'generated' ? oracleContract.generatedSuites : [],
      sbtExecuted: false, crossJvmRecovery: false, controlledJournalDurability: false, approval: null });
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${join(io.out, 'execution.json')}`);
    if (!passed) process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url) && !process.env.NODE_TEST_CONTEXT) {
  try { await main(); } catch (error) { console.error(error.stack ?? String(error)); process.exitCode = 1; }
}
