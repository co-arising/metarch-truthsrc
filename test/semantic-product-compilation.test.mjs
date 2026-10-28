import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { compileProductSet } from '../lib/products/compile.mjs';
import { readProductRequest } from '../lib/products/cli.mjs';
import { parseExpression, lookupSafety } from '../lib/domain-products/expressions.mjs';

const fixture = fileURLToPath(new URL('./fixtures/semantic-products/files.json', import.meta.url));
const request = () => structuredClone(readProductRequest(fixture));
const frozen = x => !x || typeof x !== 'object' || Object.isFrozen(x) && Object.values(x).every(frozen);
const code = input => {
  const result = compileProductSet(input);
  assert.equal(result.result, null);
  assert.ok(frozen(result));
  return result.diagnostics[0].code;
};

test('actual multi-document compilation independently derives ordered decisions, detaches and freezes', () => {
  const input = request(), before = JSON.stringify(input);
  const compiled = compileProductSet(input);
  assert.deepEqual(compiled.diagnostics, []);
  assert.ok(frozen(compiled));
  assert.equal(JSON.stringify(input), before);
  assert.ok(!Object.isFrozen(input));
  const decisions = compiled.result.products[0].payload.commands[0].decisions;
  assert.deepEqual(decisions.map(d => [d.sourceOrdinal, d.ruleId, d.onFalse.kind]), [[0, 'body-match', 'reject'], [1, 'duplicate', 'succeed-empty'], [2, 'warehouse-required', 'reject']]);
  assert.deepEqual(compileProductSet(input), compiled);
  input.documents[0].value.aggregates[0].commands[0].guards[0].cond = 'false';
  assert.equal(code(input), 'PRODUCT_PAYLOAD_MISMATCH');
  assert.equal(compiled.result.products[0].payload.commands[0].decisions[0].predicate.op, 'or');
});

for (const [label, change, expected] of [
  ['caller compiler flag', r => { r.verified = true; }, 'PRODUCT_FIELD_UNKNOWN'],
  ['nonempty options', r => { r.options.eval = true; }, 'PRODUCT_FIELD_UNKNOWN'],
  ['duplicate document', r => r.documents.push(r.documents[0]), 'PRODUCT_DUPLICATE'],
  ['unused document', r => r.documents.push({ ...r.documents[0], id: 'unused' }), 'PRODUCT_DOCUMENT_UNUSED'],
  ['wrong role', r => { r.requirements[1].inputRoles.canonical = 'references'; }, 'PRODUCT_ROLE'],
  ['missing product', r => r.requirements.shift(), 'PRODUCT_DEPENDENCY'],
  ['wrong version', r => { r.requirements[0].version = '2'; }, 'PRODUCT_UNSUPPORTED'],
  ['unknown product', r => { r.requirements[0].id = '__proto__'; }, 'PRODUCT_UNSUPPORTED'],
  ['unsupported capability', r => { r.requirements[0].capabilities = []; }, 'PRODUCT_CAPABILITY'],
  ['assembly', r => r.assemblies.push({}), 'PRODUCT_ASSEMBLY_UNSUPPORTED'],
  ['unsafe number', r => { r.documents[0].value.n = 1.1; }, 'PRODUCT_EXACT_NUMBER'],
  ['unsafe lookup', r => { r.documents[0].value.aggregates[0].commands[0].guards[0].cond = 'state.requests(param.warehouse) == param.label'; }, 'DECISION_LOOKUP_UNSAFE'],
  ['wrong short circuit', r => { r.documents[0].value.aggregates[0].commands[0].guards[0].cond = 'state.requests.contains(param.warehouse) || state.requests(param.warehouse) == param.label'; }, 'DECISION_LOOKUP_UNSAFE'],
  ['unknown source method', r => { r.documents[0].value.aggregates[0].commands[0].guards[0].cond = 'System.exit(0)'; }, 'DECISION_SOURCE_EXPRESSION_UNSUPPORTED'],
  ['mixed guard forms', r => { r.documents[0].value.aggregates[0].commands[0].guards[0].when = {}; }, 'DECISION_SOURCE_EXPRESSION_UNSUPPORTED'],
  ['forged decision', r => { r.documents[2].value.decisions.commands[0].decisions[0].onFalse.errCode = 'forged'; }, 'PRODUCT_PAYLOAD_MISMATCH'],
  ['dropped guard', r => r.documents[2].value.decisions.commands[0].decisions.pop(), 'PRODUCT_PAYLOAD_MISMATCH'],
  ['bad source pointer', r => { r.documents[1].value.layout.declarations[0].source.pointer = '/missing'; }, 'PRODUCT_SOURCE'],
  ['hidden canonical command', r => r.documents[0].value.aggregates[0].commands.push({ name: 'Hidden', guards: [] }), 'DECISION_COVERAGE'],
  ['mislabeled canonical command', r => { r.documents[0].value.aggregates[0].commands[0].name = 'Other'; }, 'DECISION_SOURCE'],
  ['missing owner', r => r.documents[1].value.layout.declarations.shift(), 'REFERENCE_OWNER'],
  ['missing reference dependency', r => { r.documents[1].value.layout.declarations[1].dependencies = []; }, 'REFERENCE_DEPENDENCIES'],
  ['wrong reference kind', r => { r.documents[1].value.layout.declarations[0].ref.kind = 'constructor'; }, 'REFERENCE_OWNER'],
]) test(`compilation refuses ${label} without returning partial products`, () => {
  const input = request(); change(input);
  assert.equal(code(input), expected);
  assert.deepEqual(compileProductSet(input), compileProductSet(input));
});

test('memory boundary refuses accessors and proxies without invoking them', () => {
  let calls = 0;
  const raw = request();
  Object.defineProperty(raw, 'trap', { enumerable: true, get() { calls++; throw Error('read'); } });
  assert.equal(code(raw), 'PRODUCT_INPUT');
  assert.equal(code(new Proxy({}, { get() { calls++; throw Error('read'); } })), 'PRODUCT_INPUT');
  assert.equal(calls, 0);
});

test('typed parser has finite vocabulary, bounds, map key forall and safe lookup', () => {
  const input = request(), layout = input.documents[1].value.layout;
  const command = layout.declarations.find(d => d.ref.kind === 'command').ref;
  const parse = raw => parseExpression(raw, command, layout);
  const expression = parse('!param.warehouse.isEmpty && (state.requests.contains(param.warehouse) || false)');
  assert.equal(expression.op, 'and'); assert.equal(expression.left.op, 'not'); assert.equal(expression.right.op, 'or');
  assert.equal(parse('state.requests.keys.forall(_ == param.warehouse)').op, 'all-equal');
  assert.doesNotThrow(() => lookupSafety(parse('!state.requests.contains(param.warehouse) || state.requests(param.warehouse) == param.label')));
  for (const raw of ['param.missing.nonEmpty', 'param.warehouse && true', 'state.requests.get(param.warehouse).get', 'true trailing', 'param.warehouse == 1', '('.repeat(100) + 'true' + ')'.repeat(100), '!'.repeat(10000) + 'true'])
    assert.throws(() => parse(raw), undefined, raw.slice(0, 100));
});

test('malformed product identities are diagnostics, never JS coercion or thrown TypeError', () => {
  for (const id of [{ toString: null }, [], null, 42]) {
    const input = request(); input.requirements[0].id = id;
    assert.equal(code(input), 'PRODUCT_SHAPE');
  }
});

test('ordered presence guards dominate later raw lookup, but not guards moved before them', () => {
  const input = request(), layout = input.documents[1].value.layout;
  const row = input.documents[2].value.decisions.commands[0], command = row.command;
  const guards = [
    { kind: 'invariantRef', ref: 'present', errCode: 'missing', cond: 'state.requests.contains(param.warehouse)' },
    { kind: 'invariantRef', ref: 'matches', errCode: 'conflict', cond: 'state.requests(param.warehouse) == param.label' },
  ];
  input.documents[0].value.aggregates[0].commands[0].guards = guards;
  row.decisions = guards.map((g, sourceOrdinal) => ({ sourceOrdinal, ruleId: g.ref,
    source: { document: 'domain', pointer: `/aggregates/0/commands/0/guards/${sourceOrdinal}` },
    predicate: parseExpression(g.cond, command, layout), onFalse: { kind: 'reject', errCode: g.errCode },
    dependencies: sourceOrdinal === 0 ? row.decisions[0].dependencies.slice(0, 2) : row.decisions[0].dependencies,
  }));
  assert.deepEqual(compileProductSet(input).diagnostics, []);
  input.documents[0].value.aggregates[0].commands[0].guards.reverse();
  assert.equal(code(input), 'DECISION_LOOKUP_UNSAFE');
});

test('compiler initialization and compilation work with filesystem/process/clock effects denied', () => {
  const modules = new Map();
  function bundle(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const text = readFileSync(url, 'utf8').replace(/from '(\.[^']+)'/gu, (_, relative) => `from ${JSON.stringify(bundle(new URL(relative, url)))}`);
    const result = `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
    modules.set(url.href, result); return result;
  }
  const module = bundle(new URL('../lib/products/compile.mjs', import.meta.url));
  const script = `
    const fs = (await import('node:fs')).default, child = (await import('node:child_process')).default;
    const { syncBuiltinESMExports } = await import('node:module');
    const deny = () => { throw Error('forbidden effect'); };
    for (const key of ['readFileSync','readdirSync','existsSync','writeFileSync','mkdirSync','rmSync','statSync','lstatSync','openSync']) fs[key] = deny;
    for (const key of ['readFile','writeFile','readdir','stat','open','access']) fs.promises[key] = deny;
    for (const key of ['execFileSync','execSync','spawn','spawnSync','exec','fork']) child[key] = deny;
    syncBuiltinESMExports(); const finish = process.exit.bind(process);
    globalThis.process = new Proxy({}, { get: deny }); globalThis.Date = new Proxy(class {}, { get: deny, construct: deny });
    globalThis.fetch = deny; globalThis.setTimeout = deny; Math.random = deny;
    const { compileProductSet } = await import(${JSON.stringify(module)});
    const input = ${JSON.stringify(request())};
    if (!compileProductSet(input).result) throw Error('pure compile failed');
    input.documents[0].value.aggregates[0].commands[0].guards[0].cond = 'false';
    if (compileProductSet(input).result !== null) throw Error('bad source admitted');
    finish(0);
  `;
  execFileSync(process.execPath, ['--input-type=module'], { input: script, encoding: 'utf8', timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
});

test('whole compiled output remains serializable and has no hidden filesystem provenance claims', () => {
  const result = compileProductSet(request()).result;
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  assert.deepEqual(result.readiness, { level: 'static-contract-only', runnable: false, runtimeBindingVerified: false });
  assert.equal(Object.hasOwn(result, 'sourcesVerified'), false);
  assert.equal(JSON.parse(readFileSync(fixture, 'utf8')).schemaVersion, 'truthsrc.product-input-files/v1');
});
