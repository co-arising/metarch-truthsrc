import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { targetProfile, LEGACY_COMPATIBLE, MODULAR_CANDIDATE } from '../lib/scala-target/profiles.mjs';
import { resolveName, resolveNameSet, resolveArtifactPath } from '../lib/scala-target/naming.mjs';

const name = (spelling, changes = {}) => ({ profile: MODULAR_CANDIDATE, knowledgeId: 'source:parcel#/' + spelling,
  scope: 'example.parcel', space: 'scala-type', spelling, binding: null, prefix: [], suffix: [], ...changes });
const entry = (spelling, changes = {}) => { const { profile, ...value } = name(spelling, changes); return value; };
const rejected = (code, run) => assert.throws(run, error => error.diagnostic?.code === code);

test('target contracts are explicit candidates, not installed generator profiles', () => {
  const compatible = targetProfile(LEGACY_COMPATIBLE), modular = targetProfile(MODULAR_CANDIDATE);
  assert.equal(compatible.naming, 'explicit-compatible');
  assert.equal(modular.naming, 'camel-ascii');
  assert.equal(modular.status, 'candidate');
  assert.equal(modular.approval, null);
  assert.equal(modular.generator, null);
  assert.deepEqual(modular.modules.map(module => [module.id, module.dependsOn]), [
    ['kernel', []], ['glue', ['kernel']], ['ext', ['kernel', 'glue']], ['root', ['kernel', 'glue', 'ext']]
  ]);
  assert.ok(Object.isFrozen(modular.modules[1].dependsOn));
  rejected('TARGET_PROFILE', () => targetProfile());
  rejected('TARGET_PROFILE', () => targetProfile('scala-cqrs-play-service'));
  const registry = readFileSync(new URL('../lib/products/registry.mjs', import.meta.url), 'utf8');
  assert.ok(!registry.includes(MODULAR_CANDIDATE));
});

for (const [spelling, type, member] of [
  ['bank_cash_payment_v1', 'BankCashPaymentV1', 'bankCashPaymentV1'],
  ['HTTPServer', 'HttpServer', 'httpServer'],
  ['getURLValue', 'GetUrlValue', 'getUrlValue'],
  ['XML-http_request', 'XmlHttpRequest', 'xmlHttpRequest'],
  ['HTTP2Status', 'Http2Status', 'http2Status'],
  ['alreadyCamel', 'AlreadyCamel', 'alreadyCamel']
]) test('deterministic separate type/member casing: ' + spelling, () => {
  assert.equal(resolveName(name(spelling)).name, type);
  assert.equal(resolveName(name(spelling, { space: 'scala-member' })).name, member);
});

test('compose complete names before escaping keywords', () => {
  const member = resolveName(name('type', { space: 'scala-member' }));
  assert.equal(member.name, 'type');
  assert.equal(member.identifier, '`type`');
  assert.equal(resolveName(name('type', { suffix: ['Protocol'] })).identifier, 'TypeProtocol');
  assert.equal(resolveName(name('type', { space: 'scala-member', prefix: ['read'] })).identifier, 'readType');
  assert.equal(resolveName(name('bank-payment-result', { prefix: ['Ingest'] })).name, 'IngestBankPaymentResult');
  rejected('TARGET_REDUNDANT_AFFIX', () => resolveName(name('BankService', { suffix: ['Service'] })));
});

test('explicit compatible bindings preserve complete names without reconstructing an old renderer', () => {
  const legacy = resolveName(name('bank-cash-payment-v1', {
    profile: LEGACY_COMPATIBLE, binding: 'bank_cash_payment_v1Execution'
  }));
  assert.equal(legacy.name, 'bank_cash_payment_v1Execution');
  assert.equal(legacy.knowledgeId, 'source:parcel#/bank-cash-payment-v1');
  assert.equal(resolveName(name('type', { profile: LEGACY_COMPATIBLE, space: 'scala-member', binding: 'type' })).identifier, '`type`');
  rejected('TARGET_BINDING_REQUIRED', () => resolveName(name('BankService', { profile: LEGACY_COMPATIBLE })));
  rejected('TARGET_BINDING_AFFIX', () => resolveName(name('legacy', { profile: LEGACY_COMPATIBLE, binding: 'Legacy', suffix: ['State'] })));
  rejected('TARGET_SCALA_NAME', () => resolveName(name('type', { profile: LEGACY_COMPATIBLE, binding: '`type`Protocol' })));
});

test('Unicode authors retain identity and require explicit ASCII target names', () => {
  const original = name('余额-请求', { knowledgeId: 'source:领域#/账户/余额', binding: 'BalanceRequest' });
  const result = resolveName(original);
  assert.equal(result.name, 'BalanceRequest');
  assert.equal(result.spelling, original.spelling);
  assert.equal(result.knowledgeId, original.knowledgeId);
  rejected('TARGET_NAME_BINDING', () => resolveName(name('余额-请求')));
  rejected('TARGET_NAME_BINDING', () => resolveName(name('Café')));
  rejected('TARGET_SCALA_NAME', () => resolveName(name('余额', { binding: '余额' })));
});

test('stable identities are explicit opaque values, never derivatives of Scala names', () => {
  for (const space of ['sql', 'protobuf', 'wire', 'persistence', 'operation', 'codec']) {
    const spelling = space === 'wire' ? 'Café́/余额/v1' : 'bank_cash_payment_v1';
    const spec = name(spelling, { space });
    const result = resolveName(spec);
    assert.equal(result.name, spelling);
    assert.equal(result.identifier, null);
    assert.equal(result.knowledgeId, spec.knowledgeId);
    rejected('TARGET_STABLE_IDENTITY', () => resolveName({ ...spec, binding: 'Prettier' }));
    rejected('TARGET_STABLE_IDENTITY', () => resolveName({ ...spec, suffix: ['Event'] }));
  }
  const identity = 'source:领域#/余额';
  assert.equal(resolveName(name(identity, { space: 'knowledge', knowledgeId: identity })).name, identity);
  rejected('TARGET_STABLE_IDENTITY', () => resolveName(name('different', { space: 'knowledge' })));
});

test('package choices are explicit, lowercase and portable', () => {
  assert.equal(resolveName(name('Parcel bounded context', { space: 'scala-package', binding: 'example.parcel' })).name, 'example.parcel');
  rejected('TARGET_BINDING_REQUIRED', () => resolveName(name('example.parcel', { space: 'scala-package' })));
  for (const binding of ['example.Parcel', 'example.type', 'example..parcel', 'example/parcel', 'example.con'])
    rejected('TARGET_PACKAGE', () => resolveName(name('Parcel', { space: 'scala-package', binding })));
});

test('ambiguous symbols and portable file aliases fail with both identities', () => {
  for (const names of [[entry('a-b'), entry('a_b')], [entry('URL'), entry('Url')],
    [entry('Foo', { binding: 'Foo' }), entry('FOO', { binding: 'FOO' })]]) {
    assert.throws(() => resolveNameSet({ profile: MODULAR_CANDIDATE, names, reserved: [] }), error => {
      assert.equal(error.diagnostic.code, 'TARGET_NAME_COLLISION');
      assert.equal(error.diagnostic.related.length, 2);
      assert.deepEqual(error.diagnostic.related.map(value => value.knowledgeId), names.map(value => value.knowledgeId));
      return true;
    });
  }
  const distinct = resolveNameSet({ profile: MODULAR_CANDIDATE,
    names: [entry('Parcel'), entry('Parcel', { scope: 'example.other', knowledgeId: 'other' })], reserved: [] });
  assert.equal(distinct.length, 2);
});

test('reservations and package convergence are checked in their actual scope', () => {
  rejected('TARGET_NAME_RESERVED', () => resolveNameSet({ profile: MODULAR_CANDIDATE,
    names: [entry('reply-to', { space: 'scala-member' })],
    reserved: [{ scope: 'example.parcel', space: 'scala-member', name: 'replyTo', reason: 'actor envelope' }] }));
  rejected('TARGET_NAME_COLLISION', () => resolveNameSet({ profile: MODULAR_CANDIDATE, names: [
    entry('Sales', { scope: 'packages', space: 'scala-package', binding: 'example.shared' }),
    entry('Shipping', { scope: 'packages', space: 'scala-package', binding: 'example.shared' })
  ], reserved: [] }));
  const members = resolveNameSet({ profile: MODULAR_CANDIDATE,
    names: [entry('fooBar', { space: 'scala-member' }), entry('foobar', { space: 'scala-member' })], reserved: [] });
  assert.equal(members.length, 2);
});

test('reservations accept only unescaped names from the selected namespace', () => {
  rejected('TARGET_SCALA_NAME', () => resolveNameSet({ profile: MODULAR_CANDIDATE,
    names: [entry('type', { space: 'scala-member' })],
    reserved: [{ scope: 'example.parcel', space: 'scala-member', name: '`type`', reason: 'keyword member' }] }));
  rejected('TARGET_NAME_RESERVED', () => resolveNameSet({ profile: MODULAR_CANDIDATE,
    names: [entry('type', { space: 'scala-member' })],
    reserved: [{ scope: 'example.parcel', space: 'scala-member', name: 'type', reason: 'keyword member' }] }));
});

test('no unsupported characters, malformed data or policy keys are silently normalized', () => {
  for (const spelling of ['1parcel', 'a/b', 'x.y', '!', '_', 'a\tb', 'a​b'])
    assert.throws(() => resolveName(name(spelling)));
  for (const spelling of ['CON', 'NUL', 'LPT1', 'COM9'])
    rejected('TARGET_PORTABLE_NAME', () => resolveName(name(spelling)));
  rejected('PRODUCT_FIELD_UNKNOWN', () => resolveName({ ...name('Parcel'), normalizeWire: true }));
  rejected('TARGET_NAME_SPACE', () => resolveName(name('Parcel', { space: 'automatic' })));
  assert.throws(() => resolveName(name('Parcel', { knowledgeId: '\ud800' })));
  let invoked = false;
  const accessor = name('Parcel');
  Object.defineProperty(accessor, 'spelling', { enumerable: true, get() { invoked = true; return 'Parcel'; } });
  rejected('TARGET_INPUT', () => resolveName(accessor));
  assert.equal(invoked, false);
});

test('resolved data is detached/frozen, deterministic and preserves author order', () => {
  const input = name('route', { suffix: ['Id'] }), before = structuredClone(input);
  const resolved = resolveName(input);
  assert.deepEqual(input, before);
  assert.deepEqual(resolveName(input), resolved);
  assert.ok(Object.isFrozen(resolved) && Object.isFrozen(resolved.suffix));
  input.suffix.push('Invalid');
  assert.deepEqual(resolved.suffix, ['Id']);
  const left = [entry('B'), entry('A')], right = [...left].reverse();
  assert.deepEqual(resolveNameSet({ profile: MODULAR_CANDIDATE, names: left, reserved: [] }).map(x => x.name), ['B', 'A']);
  assert.deepEqual(resolveNameSet({ profile: MODULAR_CANDIDATE, names: right, reserved: [] }).map(x => x.name), ['A', 'B']);
});

test('source placement is explicit and independent of wire or knowledge identities', () => {
  assert.equal(resolveArtifactPath({ profile: MODULAR_CANDIDATE, module: 'kernel', packageName: 'example.parcel.domain', typeName: 'RouteId' }),
    'modules/kernel/src/main/scala/example/parcel/domain/RouteId.scala');
  assert.equal(resolveArtifactPath({ profile: MODULAR_CANDIDATE, module: 'root', packageName: 'example.parcel.composition', typeName: 'ParcelModule' }),
    'src/main/scala/example/parcel/composition/ParcelModule.scala');
  assert.equal(resolveArtifactPath({ profile: LEGACY_COMPATIBLE, module: 'root', packageName: 'example.parcel.domain', typeName: 'old_state' }),
    'app/example/parcel/domain/old_state.scala');
  rejected('TARGET_MODULE', () => resolveArtifactPath({ profile: MODULAR_CANDIDATE, module: '../ext', packageName: 'example.parcel', typeName: 'Route' }));
  rejected('TARGET_SCALA_NAME', () => resolveArtifactPath({ profile: MODULAR_CANDIDATE, module: 'kernel', packageName: 'example.parcel', typeName: '../Route' }));
});
