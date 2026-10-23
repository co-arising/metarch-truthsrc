// SagaS6 only: pure producers and isolated CLI subprocesses, never shared apps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, writeFileSync, existsSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { emitLegacySagaSpec, validateLegacySagaSpec } from '../generators/saga-dsl/emit.mjs';
import { parseSagaAtom, adaptLegacySagaSpec, compileSagaContract } from '../generators/saga-dsl/parse.mjs';
import { generate, planStrictSagaIR } from '../generators/saga-dsl/generate.mjs';
import { emitDoc } from '../lib/shared.mjs';
import { loadManifest } from '../src/core/manifest.mjs';
import { plan, apply } from '../src/core/generate.mjs';
import { sagaContract, REQUIRED_CAPABILITIES, RESULT_KINDS } from './fixtures/saga-contract.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const genDir = join(root, 'generators/saga-dsl');
const clone = (value) => structuredClone(value);
const legacy = () => JSON.parse(readFileSync(join(genDir, 'transfer.spec.json'), 'utf8'));
const canonicalOnly = () => ({ schemaVersion: 'truthsrc/v1', workshop: 'Explicit legacy adapter' });
const strictContext = (domain = 'MoneyTransfer') => {
  const { canonical, binding } = sagaContract(domain);
  return { canonical, options: { mode: 'strict-contract', binding } };
};
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function temp(t) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'saga-s6-test-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const run = (script, args = []) => spawnSync(process.execPath, [join(genDir, script), ...args], { encoding: 'utf8', timeout: 10000 });
const jsonFile = (dir, name, value) => { const path = join(dir, name); writeFileSync(path, JSON.stringify(value)); return path; };
function atom(canonical, ordinal = 0) {
  const { payload, ...headers } = canonical.sagas[ordinal];
  return emitDoc({ scalars: [['kind', 'saga'], ...Object.entries(headers)], blocks: { payload } });
}
const compact = (text) => text.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, '');
const objectBody = (text) => text.slice(text.indexOf('object TransferSaga'));
const entryData = (entries, kind) => JSON.parse(entries.find((entry) => entry.kind === kind).content);

// No harness-owned files or runtime are involved in these checks.
test('pure imports do not inspect argv, print, exit or write even with CLI-looking arguments', (t) => {
  const dir = temp(t), input = jsonFile(dir, 'spec.json', legacy()), out = join(dir, 'never.scala');
  const script = `
    process.argv = ['node', ${JSON.stringify(join(dir, 'import-consumer.mjs'))}, ${JSON.stringify(input)}, ${JSON.stringify(out)}];
    process.exit = () => { throw new Error('import attempted exit'); };
    console.log = console.error = () => { throw new Error('import attempted logging'); };
    for (const file of ['emit.mjs', 'parse.mjs', 'generate.mjs']) await import(${JSON.stringify(new URL('../generators/saga-dsl/', import.meta.url).href)} + file);
    if (process.exitCode) throw new Error('import changed exitCode');
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
  assert.equal(existsSync(out), false); assert.deepEqual(readdirSync(dir), ['spec.json']);
});

test('legacy pure emitter retains golden DSL semantic shape and evaluates no source fragments', () => {
  const spec = legacy(), before = clone(spec); freeze(spec);
  const output = emitLegacySagaSpec(spec);
  const golden = readFileSync(join(root, 'golden/saga-dsl/src/main/scala/goldens/sagadsl/TransferSaga.scala'), 'utf8');
  assert.equal(compact(objectBody(output)), compact(objectBody(golden)));
  for (const line of ['final case class TransferArgs(fromAccount: String, toAccount: String, amount: Long)',
    'def ledger: RecipientRef[LedgerCommand]', 'sealed trait LedgerCommand']) {
    assert.ok(output.includes(line)); assert.ok(golden.includes(line));
  }
  assert.deepEqual(spec, before);
  assert.equal(emitLegacySagaSpec(spec), output);
  const injected = legacy(); injected.prelude = 'globalThis.__sagaS6MustNotExecute = true';
  assert.ok(emitLegacySagaSpec(injected).includes(injected.prelude));
  assert.equal(globalThis.__sagaS6MustNotExecute, undefined);
});

test('multiple legacy steps preserve each participantRef/protocol/group rather than a global or first ref', () => {
  const spec = legacy();
  const second = clone(spec.steps[0]);
  spec.steps[0].participantRef = 'source'; spec.steps[0].protocolType = 'SourceCommand'; spec.steps[0].group = 2;
  second.id = 'settle-target'; second.participantRef = 'target'; second.protocolType = 'TargetCommand'; second.group = 7;
  spec.steps.push(second);
  const output = emitLegacySagaSpec(spec);
  assert.ok(output.includes('def source: RecipientRef[SourceCommand]'));
  assert.ok(output.includes('def target: RecipientRef[TargetCommand]'));
  assert.ok(!output.includes('def ledger:'));
  assert.equal((output.match(/ctx.source/g) ?? []).length, 3);
  assert.equal((output.match(/ctx.target/g) ?? []).length, 3);
  assert.ok(output.includes('.inGroup(2)')); assert.ok(output.includes('.inGroup(7)'));
  assert.equal(output.indexOf('"reserve"') < output.indexOf('"settle-target"'), true);
  delete spec.participantRef; delete spec.protocolType;
  assert.equal(emitLegacySagaSpec(spec), output);
});

for (const [name, mutate] of [
  ['top-level trigger', (s) => { s.trigger = {}; }],
  ['step query', (s) => { s.steps[0].query = {}; }],
  ['phase query', (s) => { s.steps[0].phases.prepare.query = {}; }],
  ['phase unknown', (s) => { s.steps[0].phases.prepare.passunknown = 'success'; }],
  ['unknown phase', (s) => { s.steps[0].phases.Decision = {}; }],
  ['args field unknown', (s) => { s.argsFields[0].default = 0; }],
  ['absent group', (s) => { delete s.steps[0].group; }],
  ['missing participant', (s) => { delete s.participantRef; }],
  ['absent command arguments', (s) => { delete s.steps[0].phases.prepare.commandArgs; }],
  ['incomplete TCC', (s) => { delete s.steps[0].phases.compensate; }],
  ['bad retries', (s) => { s.steps[0].maxRetries = -1; }],
  ['bad version', (s) => { s.version = 'v1'; }],
  ['duplicate step', (s) => { s.steps.push(clone(s.steps[0])); }],
  ['conflicting participant protocol', (s) => { const step = clone(s.steps[0]); step.id = 'other'; step.protocolType = 'Other'; s.steps.push(step); }],
  ['TODO', (s) => { s.preCheck = 'TODO'; }],
  ['placeholder', (s) => { s.helpers = '???'; }],
  ['type injection', (s) => { s.argsFields[0].type = 'String; exit()'; }],
]) test(`legacy strict shape rejects ${name}`, () => {
  const spec = legacy(); mutate(spec);
  assert.throws(() => emitLegacySagaSpec(spec), /legacySagaSpec/);
  assert.throws(() => adaptLegacySagaSpec(spec), /legacySagaSpec/);
});

test('legacy and strict exports reject non-JSON/getters/functions without running them', () => {
  let accessed = false;
  const spec = legacy();
  Object.defineProperty(spec, 'unknown', { enumerable: true, get() { accessed = true; throw new Error('must not execute'); } });
  assert.throws(() => emitLegacySagaSpec(spec), /JSON data/); assert.equal(accessed, false);
  const ctx = strictContext(); ctx.options.callback = () => { accessed = true; };
  assert.throws(() => generate(ctx), /JSON data/); assert.equal(accessed, false);
  const sparse = legacy(); sparse.steps.length = 2147483647;
  assert.throws(() => validateLegacySagaSpec(sparse), /sparse/);
});

test('legacy emitter CLI keeps positional public API, usage and fail-before-write', (t) => {
  const dir = temp(t), spec = jsonFile(dir, 'spec.json', legacy()), out = join(dir, 'transfer.scala');
  const result = run('emit.mjs', [spec, out]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(out, 'utf8'), emitLegacySagaSpec(legacy()));
  assert.equal(run('emit.mjs').status, 1);
  assert.match(run('emit.mjs').stderr, /usage:/);
  const invalid = legacy(); invalid.passunknown = 'Right'; writeFileSync(spec, JSON.stringify(invalid));
  writeFileSync(out, 'existing protected output');
  const failed = run('emit.mjs', [spec, out]);
  assert.equal(failed.status, 1); assert.match(failed.stderr, /unsupported field/);
  assert.equal(readFileSync(out, 'utf8'), 'existing protected output');
  const missing = join(dir, 'absent-dir', 'new.scala');
  assert.equal(run('emit.mjs', [spec, missing]).status, 1);
  assert.equal(existsSync(dirname(missing)), false);
});

test('legal Saga atoms use shared JSON payload parsing and exactly closed canonical/binding', () => {
  for (const domain of ['MoneyTransfer', 'Fab']) {
    const { canonical, binding } = sagaContract(domain), before = clone({ canonical, binding });
    const bytes = atom(canonical); freeze(canonical); freeze(binding);
    assert.deepEqual(parseSagaAtom(bytes, { canonical, binding }), compileSagaContract(canonical, binding));
    assert.deepEqual({ canonical, binding }, before);
    assert.throws(() => parseSagaAtom(bytes, { binding }), /CANONICAL_REQUIRED/);
    assert.throws(() => parseSagaAtom(bytes, { canonical }), /BINDING_REQUIRED/);
    assert.throws(() => parseSagaAtom(bytes.replace('purpose', 'unsupported'), { canonical, binding }), /exactly match/);
    assert.throws(() => parseSagaAtom(bytes.replace('kind: saga', 'kind: pipeline'), { canonical, binding }), /kind: saga/);
  }
  const data = sagaContract(); data.canonical.sagas[0].payload.passunknown = 'success';
  assert.throws(() => parseSagaAtom(atom(data.canonical), data), /SAGA_SCHEMA.*passunknown/);
  assert.throws(() => parseSagaAtom(readFileSync(join(genDir, 'transfer.saga.yaml'), 'utf8'), sagaContract()), /malformed/);
});

test('parser CLI emits only strict IR with explicit closure or an explicitly legacy full-spec adapter', (t) => {
  const dir = temp(t), data = sagaContract('Fab');
  const canonicalPath = jsonFile(dir, 'canonical.json', data.canonical);
  const bindingPath = jsonFile(dir, 'binding.json', data.binding);
  const sagaPath = join(dir, 'fab.saga.yaml'); writeFileSync(sagaPath, atom(data.canonical));
  const out = join(dir, 'strict.json');
  const result = run('parse.mjs', [sagaPath, bindingPath, out, '--canonical', canonicalPath]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), compileSagaContract(data.canonical, data.binding));
  const oldArgs = run('parse.mjs', [join(genDir, 'transfer.saga.yaml'), join(genDir, 'transfer.binding.json'), out]);
  assert.equal(oldArgs.status, 1); assert.match(oldArgs.stderr, /no inferred/);
  const spec = jsonFile(dir, 'legacy.json', legacy()), legacyOut = join(dir, 'legacy-adapted.json');
  assert.equal(run('parse.mjs', [spec, legacyOut, '--legacy']).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(legacyOut, 'utf8')), adaptLegacySagaSpec(legacy()));
  data.binding.sagas[0].steps[0].phases.prepare.query.resultKinds = ['confirmed', 'not-executed', 'success'];
  writeFileSync(bindingPath, JSON.stringify(data.binding));
  const before = readFileSync(out, 'utf8');
  const failed = run('parse.mjs', [sagaPath, bindingPath, out, '--canonical', canonicalPath]);
  assert.equal(failed.status, 1); assert.match(failed.stderr, /SAGA_SCHEMA.*resultKinds/);
  assert.equal(readFileSync(out, 'utf8'), before);
});

for (const domain of ['MoneyTransfer', 'Fab']) test(`${domain}: strict IR producer consumes every contract field, participant, phase, group and trigger`, () => {
  const ctx = strictContext(domain), before = clone(ctx); freeze(ctx);
  const ir = compileSagaContract(ctx.canonical, ctx.options.binding);
  const entries = generate({ ...ctx, options: { ...ctx.options, ir } });
  assert.equal(entries.length, 3);
  assert.deepEqual(generate(ctx), entries);
  assert.deepEqual(planStrictSagaIR(ir, { canonical: ctx.canonical, binding: ctx.options.binding }), entries);
  const contract = entryData(entries, 'saga-contract');
  assert.equal(contract.runnable, false); assert.equal(contract.readiness, 'contract-only');
  assert.equal(contract.runtimeBindingVerified, false);
  assert.deepEqual(contract.contract, ir.sagas[0]);
  assert.deepEqual(contract.contract.definition.payload.resultKinds, RESULT_KINDS);
  const rows = entryData(entries, 'saga-phase-table').rows;
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map((row) => row.participantId), ['source', 'source', 'source', 'target', 'target', 'target']);
  assert.deepEqual(rows.map((row) => row.addressing.resolver), Array(3).fill('fixture.sourceResolver').concat(Array(3).fill('fixture.targetResolver')));
  assert.deepEqual(rows.map((row) => row.group.id), domain === 'Fab' ? [1, 1, 1, 2, 2, 2] : Array(6).fill(1));
  if (domain === 'Fab') {
    assert.deepEqual(rows[3].group.dependsOn, [1]);
    assert.equal(rows[3].declaration.bindings[2].ref, 'step:reserve-source:prepare:carried');
  }
  const ledger = entryData(entries, 'saga-contract-ledger');
  assert.deepEqual(ledger.runtimeRequirements.map((row) => row.capability), REQUIRED_CAPABILITIES);
  assert.ok(ledger.runtimeRequirements.every((row) => row.verification === 'unverified'));
  for (const [pointer, source] of Object.entries(ir.sourceMap).filter(([pointer]) => pointer.startsWith('/sagas/0/'))) {
    assert.deepEqual(ledger.consumed.find((row) => row.pointer === pointer)?.source, source, `must consume ${pointer}`);
  }
  assert.equal(ledger.consumed.filter((row) => /\/payload\/triggers\/\d+\/id$/.test(row.pointer)).length, 2);
  assert.ok(entries.every((entry) => entry.path.endsWith('.json')));
  assert.ok(entries.every((entry) => !entry.content.includes('???')));
  assert.deepEqual(ctx, before);
});

test('multiple strict contracts all consumed in deterministic seq order; explicit read-only phases preserved', () => {
  const data = sagaContract(), fab = sagaContract('Fab'); data.canonical.sagas[0].seq = 2;
  data.canonical.aggregates.push(...fab.canonical.aggregates); data.canonical.sagas.push(...fab.canonical.sagas);
  data.binding.sagas.push(...fab.binding.sagas);
  for (const phase of ['prepare', 'commit', 'compensate']) {
    data.canonical.sagas[0].payload.steps[0].phases[phase] = { kind: 'none', reason: 'read-only' };
    data.binding.sagas[0].steps[0].phases[phase] = { kind: 'none', reason: 'read-only' };
  }
  const ctx = { canonical: data.canonical, options: { mode: 'strict-contract', binding: data.binding } };
  const entries = generate(ctx); assert.equal(entries.length, 6);
  const moneyRows = JSON.parse(entries.find((entry) => entry.path === 'contracts/sagas/money-transfer.phases.json').content).rows;
  assert.ok(moneyRows.slice(0, 3).every((row) => row.declaration.kind === 'none' && row.binding.reason === 'read-only'));
  const reverse = (value) => Array.isArray(value) ? value.map(reverse) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverse(item)])) : value;
  assert.deepEqual(generate(reverse(ctx)), entries);
});

for (const [name, mutate] of [
  ['unknown', (ctx) => { ctx.options.binding.sagas[0].steps[0].phases.prepare.query.passunknown = true; }],
  ['unsafe unknown classification', (ctx) => { ctx.options.binding.sagas[0].steps[0].phases.prepare.query.resultKinds[2] = 'succeeded'; }],
  ['missing Decision', (ctx) => { ctx.options.binding.sagas[0].engine.capabilities.required.shift(); }],
  ['missing query', (ctx) => { delete ctx.options.binding.sagas[0].steps[0].phases.prepare.query; }],
  ['runtime certificate flag', (ctx) => { ctx.options.binding.sagas[0].engine.runtimeVerified = true; }],
  ['unsupported join', (ctx) => { ctx.canonical.sagas[0].payload.triggers[1].join = 'first'; }],
]) test(`strict producer rejects ${name} rather than success defaults`, () => {
  const ctx = strictContext(); mutate(ctx);
  assert.throws(() => generate(ctx), /SAGA_SCHEMA/);
});

test('forged strict IR/schema/readiness/digest/unknown shape cannot bypass recompile closure', () => {
  const ctx = strictContext(), ir = compileSagaContract(ctx.canonical, ctx.options.binding);
  for (const change of [(x) => { x.schemaVersion = 'truthsrc.saga-ir/v2'; }, (x) => { x.readiness = 'runnable'; },
    (x) => { x.digest = '0'.repeat(64); }, (x) => { x.passunknown = true; },
    (x) => { x.sagas[0].binding.steps[0].phases.prepare.query.mapper = 'pretend.Mapper'; }]) {
    const forged = clone(ir); change(forged);
    assert.throws(() => generate({ ...ctx, options: { ...ctx.options, ir: forged } }), /IR_MISMATCH/);
  }
  assert.throws(() => planStrictSagaIR(ir), /BINDING_REQUIRED/);
  const missing = clone(ctx); delete missing.options.binding;
  assert.throws(() => generate(missing), /BINDING_REQUIRED/);
});

test('strict runnable source always rejects unverified runtime bindings, including self-certified options', (t) => {
  const ctx = strictContext(); ctx.options.mode = 'strict-scala';
  assert.throws(() => generate(ctx), /RUNTIME_BINDING_UNVERIFIED.*Decision.*unknown.*query/);
  ctx.options.runtimeBinding = { verified: true, entrypoint: 'invented.API' };
  assert.throws(() => generate(ctx), /unsupported option runtimeBinding/);
  const dir = temp(t), ir = compileSagaContract(ctx.canonical, ctx.options.binding);
  const input = jsonFile(dir, 'ir.json', ir), out = join(dir, 'strict.scala');
  const result = run('emit.mjs', [input, out]);
  assert.equal(result.status, 1); assert.match(result.stderr, /RUNTIME_BINDING_UNVERIFIED/);
  assert.equal(existsSync(out), false);
});

test('producer requires explicit mode and forbids skipping/downgrading canonical Sagas or unsupported options/products', () => {
  assert.throws(() => generate({ canonical: canonicalOnly() }), /explicit mode/);
  assert.throws(() => generate({ canonical: canonicalOnly(), options: { mode: 'legacy', legacySagaSpecs: [] } }), /complete legacySagaSpecs/);
  const data = sagaContract();
  assert.throws(() => generate({ canonical: data.canonical, options: { mode: 'legacy', legacySagaSpecs: [legacy()] } }), /downgrade/);
  assert.throws(() => generate({ ...strictContext(), products: { sagas: [] } }), /populated products/);
  const ctx = strictContext(); ctx.options.passunknown = 'success';
  assert.throws(() => generate(ctx), /unsupported option/);
  const broken = legacy(); broken.steps[0].group = undefined;
  assert.throws(() => generate({ canonical: canonicalOnly(), options: { mode: 'legacy', legacySagaSpecs: [legacy(), broken] } }), /JSON data/);
  assert.throws(() => generate({ canonical: canonicalOnly(), options: { mode: 'legacy', legacySagaSpecs: [legacy(), legacy()] } }), /Duplicate.*path/);
  const empty = { schemaVersion: 'truthsrc.saga-binding/v1', sagas: [] };
  assert.deepEqual(generate({ canonical: canonicalOnly(), options: { mode: 'strict-contract', binding: empty } }), []);
});

test('manifest fits current physical-template product and canonical version pattern; core plan consumes pure entries', async (t) => {
  const manifest = loadManifest(genDir);
  assert.deepEqual(manifest.products, ['template']); assert.equal(manifest.inputSchema, 'truthsrc/v1.0');
  const dir = temp(t), ctx = strictContext(), canonicalFile = jsonFile(dir, 'canonical.json', ctx.canonical);
  const planned = await plan({ canonicalFile, generatorDir: genDir, options: ctx.options });
  assert.deepEqual(planned.entries, generate(ctx));
  assert.ok(planned.entries.every((entry) => manifest.artifactKinds.includes(entry.kind)));
  const legacyCtx = { canonical: canonicalOnly(), options: { mode: 'legacy', legacySagaSpecs: [legacy()] } };
  const legacyFile = jsonFile(dir, 'legacy-canonical.json', legacyCtx.canonical);
  const legacyPlan = await plan({ canonicalFile: legacyFile, generatorDir: genDir, options: legacyCtx.options });
  assert.deepEqual(legacyPlan.entries, generate(legacyCtx));
  assert.equal(legacyPlan.entries[0].path, 'src/main/scala/goldens/sagadsl/TransferSaga.scala');
  assert.equal(legacyPlan.entries[0].content, emitLegacySagaSpec(legacy()));
  assert.deepEqual(readdirSync(dir).sort(), ['canonical.json', 'legacy-canonical.json']);
});

test('identifier separators, declaration collisions and encoded placeholders are bounded', () => {
  const spec = legacy(); spec.participantRef = 'ledger_'; spec.argsFields[2].name = 'amount_';
  const source = emitLegacySagaSpec(spec);
  assert.ok(source.includes('def ledger_ : RecipientRef[LedgerCommand]'));
  assert.ok(source.includes('amount_ : Long'));
  const invalid = legacy(); invalid.objectName = '_';
  assert.throws(() => emitLegacySagaSpec(invalid), /Scala identifier/);
  invalid.objectName = invalid.argsType;
  assert.throws(() => emitLegacySagaSpec(invalid), /distinct names/);
  const encoded = legacy(); encoded.preCheck = (String.fromCharCode(92) + 'u003f').repeat(3);
  assert.throws(() => emitLegacySagaSpec(encoded), /Unicode source escape/);
  const duplicate = legacy(); duplicate.objectName = 'OtherSaga';
  assert.throws(() => generate({ canonical: canonicalOnly(), options: { mode: 'legacy', legacySagaSpecs: [legacy(), duplicate] } }), /Duplicate legacy Scala declaration/);
});

test('context getters/proxies/inherited defaults and primitive products fail without executing user code', () => {
  let accessed = false;
  const ctx = { canonical: canonicalOnly() };
  Object.defineProperty(ctx, 'options', { enumerable: true, get() { accessed = true; return {}; } });
  assert.throws(() => generate(ctx), /JSON data/); assert.equal(accessed, false);
  const proxy = new Proxy(sagaContract().canonical, { get() { accessed = true; return []; } });
  assert.throws(() => generate({ canonical: proxy }), /Proxy/); assert.equal(accessed, false);
  for (const products of [true, 1, '']) assert.throws(() => generate({ ...strictContext(), products }), /products/);
  Object.prototype.participantRef = 'ghost'; Object.prototype.protocolType = 'GhostCommand'; Object.prototype.mode = 'legacy';
  try {
    const spec = legacy(); delete spec.participantRef; delete spec.protocolType;
    assert.throws(() => emitLegacySagaSpec(spec), /participantRef/);
    assert.throws(() => generate({ canonical: canonicalOnly() }), /explicit mode/);
  } finally {
    delete Object.prototype.participantRef; delete Object.prototype.protocolType; delete Object.prototype.mode;
  }
});

test('symlink CLI invocation still validates and runs emitter/parser wrappers', (t) => {
  const dir = temp(t), spec = jsonFile(dir, 'spec.json', legacy());
  for (const script of ['emit.mjs', 'parse.mjs']) {
    const alias = join(dir, script); symlinkSync(join(genDir, script), alias);
    const out = join(dir, script === 'emit.mjs' ? 'out.scala' : 'out.spec.json');
    const result = spawnSync(process.execPath, [alias, spec, out, ...(script === 'parse.mjs' ? ['--legacy'] : [])], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr); assert.equal(existsSync(out), true);
  }
});

test('core apply rejects invalid/query/Decision/unknown input before making any output directory or modifying a file', async (t) => {
  const dir = temp(t), outDir = join(dir, 'must-not-exist');
  for (const mutate of [
    (ctx) => { ctx.options.passunknown = 'succeeded'; },
    (ctx) => { ctx.options.binding.sagas[0].steps[1].phases.commit.query.resultKinds[2] = 'succeeded'; },
    (ctx) => { ctx.options.binding.sagas[0].engine.capabilities.required.shift(); },
    (ctx) => { ctx.options.mode = 'strict-scala'; },
    (ctx) => { ctx.canonical.sagas[0].payload.unsupported = 'unknown'; },
  ]) {
    const ctx = strictContext(); mutate(ctx);
    const canonicalFile = jsonFile(dir, 'canonical.json', ctx.canonical);
    await assert.rejects(apply({ canonicalFile, generatorDir: genDir, outDir, options: ctx.options }));
    assert.equal(existsSync(outDir), false);
  }
  const protectedDir = join(dir, 'existing-output');
  // Use temp root directly to prove failure does not even add a ledger/anchors.
  const protectedFile = join(dir, 'keep.scala'); writeFileSync(protectedFile, 'untouched');
  const before = readdirSync(dir).sort(); const ctx = strictContext(); ctx.options.passunknown = true;
  const canonicalFile = join(dir, 'canonical.json'); writeFileSync(canonicalFile, JSON.stringify(ctx.canonical));
  await assert.rejects(apply({ canonicalFile, generatorDir: genDir, outDir: dir, options: ctx.options }));
  assert.deepEqual(readdirSync(dir).sort(), before); assert.equal(readFileSync(protectedFile, 'utf8'), 'untouched');
  assert.equal(existsSync(protectedDir), false);
});
