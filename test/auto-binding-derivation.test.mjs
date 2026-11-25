import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileTreeWithSources } from '../lib/compile.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { AUTO_DERIVED_DOC_IDS } from '../lib/project/derive-bindings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BANK_ROOT = path.resolve(ROOT, '../bank-wealth-demo');

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
  ['bank-wealth', 'acme-commerce'],
  ['bankwealth', 'commerce'],
  ['CreditBalance', 'WarehouseStock'],
  ['FundOrder', 'PurchaseOrder'],
  ['SipPlan', 'SubscriptionSchedule'],
  ['BankPayment', 'CommerceCheckout'],
  ['bank-payment', 'commerce-checkout'],
  ['BankRefund', 'CommerceReturn'],
  ['bank-refund', 'commerce-return'],
  ['BankTa', 'CommerceCarrier'],
  ['bank-ta', 'commerce-carrier'],
  ['BankSip', 'CommerceSchedule'],
  ['bank-sip', 'commerce-schedule'],
  ['BankCash', 'CommerceDirect'],
  ['bank-cash', 'commerce-direct'],
  ['BankService', 'CommerceService'],
  ['bank-service', 'commerce-service'],
  ['Bank', 'Commerce'],
  ['bank-v1', 'commerce-v1'],
  ['bank-', 'commerce-'],
];

test('auto-derived saga/runtime/execution bindings compile all 14 products without manual binding JSON files', { skip: !fs.existsSync(BANK_ROOT) }, () => {
  const rawConfig = JSON.parse(fs.readFileSync(path.join(BANK_ROOT, 'truthsrc.project.json'), 'utf8'));
  const { canonical: rawCanonical } = compileTreeWithSources(path.join(BANK_ROOT, 'truth/bank-wealth'), { context: rawConfig.context });

  // Run on a rewritten non-bank commerce domain with documents=[], assemblies=[], roles={}.
  const canonical = deepReplace(rawCanonical, COMMERCE_REWRITES);
  const config = deepReplace({ ...rawConfig, documents: [], assemblies: [], roles: {} }, COMMERCE_REWRITES);
  const request = deriveProjectRequest(canonical, config, []);

  assert.ok(request.documents.some(d => d.id === AUTO_DERIVED_DOC_IDS.sagaBinding));
  assert.ok(request.documents.some(d => d.id === AUTO_DERIVED_DOC_IDS.runtimeBinding));
  assert.ok(request.documents.some(d => d.id === AUTO_DERIVED_DOC_IDS.executionBinding));

  const compilation = compileProductSet(request);
  assert.equal(compilation.diagnostics.length, 0, JSON.stringify(compilation.diagnostics));
  assert.equal(compilation.result.products.length, 14);

  // Verify zero bank vocabulary leaked into auto-derived binding documents.
  const derivedText = JSON.stringify(
    request.documents.filter(d => Object.values(AUTO_DERIVED_DOC_IDS).includes(d.id))
  );
  for (const forbidden of ['bankwealth', 'CreditBalance', 'FundOrder', 'SipPlan', 'BankPayment', 'fixture.wealth']) {
    assert.ok(!derivedText.includes(forbidden), `auto-derived bindings leaked ${forbidden}`);
  }
});

test('auto-derived bindings fail closed when options.packages is missing for the project context', { skip: !fs.existsSync(BANK_ROOT) }, () => {
  const rawConfig = JSON.parse(fs.readFileSync(path.join(BANK_ROOT, 'truthsrc.project.json'), 'utf8'));
  const { canonical } = compileTreeWithSources(path.join(BANK_ROOT, 'truth/bank-wealth'), { context: rawConfig.context });
  const broken = { ...rawConfig, documents: [], assemblies: [], roles: {}, options: { ...rawConfig.options, packages: [] } };
  assert.throws(() => deriveProjectRequest(canonical, broken, []), /options\.packages/);
});
