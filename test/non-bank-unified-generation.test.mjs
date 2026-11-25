// Regression guard against domain-specific hardcoding in metarch-truthsrc:
// proves that a non-bank bounded context (`commerce` / `example.commerce`)
// runs cleanly through unified derivation & emitter families by default,
// with zero hardcoded `bankwealth` / bank aggregate / bank host references.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isUnifiedContext, isClassicRetiredContext, withPlayServiceEmission } from '../lib/derivation/emission-policy.mjs';
import { deriveValueObjects } from '../lib/derivation/value-object.mjs';
import { deriveDomainEntities } from '../lib/derivation/domain-entity.mjs';
import { deriveInvariantRules } from '../lib/derivation/aggregate-invariant-rules.mjs';
import { deriveEventHandlers } from '../lib/derivation/event-handler.mjs';
import { deriveProtocolLayers } from '../lib/derivation/protocol-layer.mjs';
import { deriveAggregateLayers } from '../lib/derivation/aggregate-layer.mjs';
import { deriveAggregateRepositories } from '../lib/derivation/aggregate-repository.mjs';
import { deriveAggregateBootstraps } from '../lib/derivation/aggregate-bootstrap.mjs';
import { deriveEffectFace } from '../lib/derivation/effect-face.mjs';
import { derivePipelineInvocationFace } from '../lib/derivation/pipeline-invocation-face.mjs';
import { getFamily, renderFamily } from '../emitter/registry.mjs';
import { mavenJarRelPath, resolveRuntimeProfile } from '../lib/runtime-profile.mjs';
import '../emitter/families/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const deepReplace = (value, replacements) => {
  if (typeof value === 'string') {
    let out = value;
    for (const [from, to] of replacements) out = out.replaceAll(from, to);
    return out;
  }
  if (Array.isArray(value)) return value.map(item => deepReplace(item, replacements));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepReplace(v, replacements);
    return out;
  }
  return value;
};

const COMMERCE_REWRITES = [
  ['example.bankwealth', 'example.commerce'],
  ['bankwealth', 'commerce'],
  ['CreditBalance', 'WarehouseStock'],
  ['FundOrder', 'PurchaseOrder'],
  ['SipPlan', 'SubscriptionSchedule'],
  ['bank-sip-dispatch', 'commerce-schedule-dispatch'],
  ['bank-ta-effect', 'commerce-carrier-effect'],
  ['bank-ta-submission-v1', 'commerce-carrier-dispatch-v1'],
  ['bank-cash-payment-v1', 'commerce-checkout-v1'],
  ['bank-payment-host', 'commerce-checkout-host'],
  ['bank-payment-technical', 'commerce-checkout-technical'],
  ['BankPaymentTechnical', 'CommerceCheckoutTechnical'],
  ['BankPayment', 'CommerceCheckout'],
  ['BankSipDispatch', 'CommerceScheduleDispatch'],
  ['BankTaEffect', 'CommerceCarrierEffect'],
  ['BankTa', 'CommerceCarrier'],
  ['Bank', 'Commerce'],
  ['fund-order', 'purchase-order'],
  ['bank-', 'commerce-'],
];

const FORBIDDEN = ['bankwealth', 'CreditBalance', 'FundOrder', 'SipPlan', 'BankPayment', 'BankTa', 'BankSip'];

function assertNoBankLeakage(outputs, label) {
  assert.ok(Object.keys(outputs).length > 0, label + ' emitted at least one file');
  for (const [filePath, content] of Object.entries(outputs)) {
    for (const token of FORBIDDEN) {
      assert.ok(!filePath.includes(token), `${label} path leaked ${token}: ${filePath}`);
      assert.ok(!content.includes(token), `${label} content leaked ${token} in ${filePath}`);
    }
  }
}

test('emission policy enables unified mode for arbitrary non-bank contexts by default', () => {
  assert.equal(isUnifiedContext('commerce', {}), true);
  assert.equal(isUnifiedContext('healthcare', {}), true);
  assert.equal(isUnifiedContext('commerce', { emission: 'classic' }), false);
  assert.equal(isUnifiedContext('commerce', { service: { emission: 'classic' } }), false);
  assert.equal(isUnifiedContext('commerce', { emitterContexts: ['healthcare'] }), false);
  assert.equal(isUnifiedContext('commerce', { emitterContexts: ['commerce'] }), true);

  assert.equal(isClassicRetiredContext('commerce', {}), false);
  const activated = withPlayServiceEmission({ options: { packages: [{ context: 'commerce', package: 'example.commerce' }] } });
  assert.equal(isClassicRetiredContext('commerce', activated.options), true);
});

test('non-bank commerce domain derives and renders core aggregate families without bank hardcoding', () => {
  const voFixture = deepReplace(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/value-object-v1/knowledge-products.json'), 'utf8')),
    COMMERCE_REWRITES
  );
  const voContract = deriveValueObjects(voFixture, voFixture.options);
  assertNoBankLeakage(renderFamily(getFamily('value-object'), voContract), 'value-object');

  const deFixture = deepReplace(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/domain-entity-v1/knowledge-products.json'), 'utf8')),
    COMMERCE_REWRITES
  );
  const deContract = deriveDomainEntities(deFixture, deFixture.options);
  assertNoBankLeakage(renderFamily(getFamily('domain-entity'), deContract), 'domain-entity');

  const rulesFixture = deepReplace(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/aggregate-invariant-rules-v1/knowledge-products.json'), 'utf8')),
    COMMERCE_REWRITES
  );
  const rulesContract = deriveInvariantRules(rulesFixture.products, rulesFixture.options);
  assert.deepEqual(rulesContract.aggregates.map(a => a.aggregate), ['WarehouseStock', 'PurchaseOrder', 'SubscriptionSchedule']);
  assertNoBankLeakage(renderFamily(getFamily('aggregate-invariant-rules'), rulesContract), 'aggregate-invariant-rules');

  const ehFixture = deepReplace(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/event-handler-v1/knowledge-products.json'), 'utf8')),
    COMMERCE_REWRITES
  );
  const ehContract = deriveEventHandlers(ehFixture.products, ehFixture.options);
  assertNoBankLeakage(renderFamily(getFamily('event-handler'), ehContract), 'event-handler');

  const plFixture = deepReplace(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/protocol-layer-v1/knowledge-products.json'), 'utf8')),
    COMMERCE_REWRITES
  );
  const plContract = deriveProtocolLayers(plFixture.products, plFixture.options);
  assertNoBankLeakage(renderFamily(getFamily('protocol-layer'), plContract), 'protocol-layer');

  const alFixture = deepReplace(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/aggregate-layer-v1/knowledge-products.json'), 'utf8')),
    COMMERCE_REWRITES
  );
  const alContract = deriveAggregateLayers(alFixture.products, alFixture.options);
  assertNoBankLeakage(renderFamily(getFamily('aggregate-layer'), alContract), 'aggregate-layer');

  const arFixture = deepReplace(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/aggregate-repository-v1/knowledge-products.json'), 'utf8')),
    COMMERCE_REWRITES
  );
  const arContract = deriveAggregateRepositories(arFixture, arFixture.options);
  assertNoBankLeakage(renderFamily(getFamily('aggregate-repository'), arContract), 'aggregate-repository');

  const abContract = deriveAggregateBootstraps(alFixture.products, alFixture.options);
  assertNoBankLeakage(renderFamily(getFamily('aggregate-bootstrap'), abContract), 'aggregate-bootstrap');
});

test('non-bank commerce domain derives and renders effect-face and pipeline-invocation-face without bank hardcoding', () => {
  const efFixture = deepReplace(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/effect-face-v1/knowledge-products.json'), 'utf8')),
    COMMERCE_REWRITES
  );
  const efContract = deriveEffectFace(efFixture.products, efFixture.options);
  assert.equal(efContract.cases.length, 2);
  assertNoBankLeakage(renderFamily(getFamily('effect-face'), efContract), 'effect-face');

  // Also prove single-host effect-face works (no hardcoded pair count).
  const singleEf = structuredClone(efFixture);
  singleEf.products['effect-host-contract'].hosts = singleEf.products['effect-host-contract'].hosts.slice(0, 1);
  const singleContract = deriveEffectFace(singleEf.products, singleEf.options);
  assert.equal(singleContract.cases.length, 1);
  assertNoBankLeakage(renderFamily(getFamily('effect-face'), singleContract), 'effect-face-single');

  const pifFixture = deepReplace(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/pipeline-invocation-face-v1/knowledge-products.json'), 'utf8')),
    COMMERCE_REWRITES
  );
  const pifContract = derivePipelineInvocationFace(pifFixture.products, pifFixture.options, 'commerce-checkout-host');
  assert.equal(pifContract.saga.context, 'commerce');
  assertNoBankLeakage(renderFamily(getFamily('pipeline-invocation-face'), pifContract), 'pipeline-invocation-face');
});

test('runtimeProfile parameterizes organization, package prefixes, and artifact versions away from net.imadz', () => {
  const customOptions = {
    runtimeArtifact: {
      coordinate: 'com.acme:saga-core_2.13:1.4.0',
      sha256: 'a'.repeat(64),
    },
    runtimeProfile: {
      packagePrefix: 'com.acme.cqrs',
      commonCoreVersion: '0.9.0',
      monarchVersion: '1.4.0',
    },
  };
  const rp = resolveRuntimeProfile(customOptions);
  assert.equal(rp.organization, 'com.acme');
  assert.equal(rp.commonPackage, 'com.acme.cqrs.common');
  assert.equal(rp.strictSagaPackage, 'com.acme.cqrs.infra.saga.strict');
  assert.equal(rp.monarchPersistencePackage, 'com.acme.cqrs.monarch.persistence');
  assert.equal(
    mavenJarRelPath(rp.organization, rp.sagaArtifact, rp.scalaBinaryVersion, rp.sagaVersion),
    'com/acme/saga-core_2.13/1.4.0/saga-core_2.13-1.4.0.jar'
  );

  // Verify custom runtimeProfile flows through emitted Scala & HOCON with zero net.imadz strings.
  const voFixture = deepReplace(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/value-object-v1/knowledge-products.json'), 'utf8')),
    COMMERCE_REWRITES
  );
  const voContract = { ...deriveValueObjects(voFixture, voFixture.options), runtimeProfile: customOptions.runtimeProfile };
  const voOut = renderFamily(getFamily('value-object'), voContract);
  for (const content of Object.values(voOut)) assert.ok(!content.includes('net.imadz'));
  assert.ok(Object.values(voOut).some(c => c.includes('com.acme.cqrs.common.CommonTypes.iMadzError')));

  const deFixture = deepReplace(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/domain-entity-v1/knowledge-products.json'), 'utf8')),
    COMMERCE_REWRITES
  );
  const deContract = { ...deriveDomainEntities(deFixture, deFixture.options), runtimeProfile: customOptions.runtimeProfile };
  const deOut = renderFamily(getFamily('domain-entity'), deContract);
  for (const content of Object.values(deOut)) {
    assert.ok(!content.includes('net.imadz'));
    assert.ok(content.includes('import com.acme.cqrs.common.CborSerializable'));
  }

  const efFixture = deepReplace(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/effect-face-v1/knowledge-products.json'), 'utf8')),
    COMMERCE_REWRITES
  );
  const efContract = deriveEffectFace(efFixture.products, { ...efFixture.options, runtimeProfile: customOptions.runtimeProfile });
  const efOut = renderFamily(getFamily('effect-face'), efContract);
  for (const content of Object.values(efOut)) assert.ok(!content.includes('net.imadz'));
  assert.ok(Object.values(efOut).some(c => c.includes('import com.acme.cqrs.monarch.StageError')));
});
