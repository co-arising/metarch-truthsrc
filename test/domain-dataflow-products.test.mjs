import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import test from 'node:test';
import { compileProductSet } from '../lib/products/compile.mjs';
import { compileDependencies } from '../lib/domain-products/dependencies.mjs';
import { compileFolds, evaluateFolds } from '../lib/domain-products/folds.mjs';
import { parseInteger, evaluateValue, validateValue, applyExact } from '../lib/domain-products/values.mjs';
import { copyImmutableData } from '../lib/immutable-data.mjs';

const fixture = name => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/dataflow-products/${name}.json`, import.meta.url)), 'utf8'));
const request = () => {
  const manifest = fixture('files');
  return { ...manifest, schemaVersion: 'truthsrc.product-compilation/v1', documents: manifest.documents.map(d => ({ id: d.id, schemaVersion: d.schemaVersion, value: fixture(d.file.replace('.json', '')) })) };
};
const compile = () => compileProductSet(request());
test('dataflow products derive complete signature, host pin and event slots from canonical source', () => {
  const { result, diagnostics } = compile();
  assert.deepEqual(diagnostics, []);
  const dependencies = result.products.find(p => p.id === 'domain-dependencies').payload;
  assert.deepEqual(dependencies.commands[0].declaredSignature.map(p => p.ref.id), ['warehouse', 'requestId', 'label', 'delta', 'batch']);
  assert.equal(dependencies.commands[0].events[0].slots.find(s => s.slot.id === 'releaseId').producer.op, 'host');
  assert.equal(dependencies.hosts[0].id.kind, 'port');
  assert.ok(dependencies.commands[0].usedDependencies.some(r => r.id === 'warehouse'));
});
test('signed-64 integers use exact text and reject overflow/negative zero', () => {
  assert.equal(parseInteger('9223372036854775807'), 9223372036854775807n);
  for (const v of ['9223372036854775808', '-9223372036854775809', '-0', '01', '1.0', 1]) assert.throws(() => parseInteger(v));
});
test('folds remove map key but optional RHS reads the same original pre-event map', () => {
  const { result } = compile();
  const layout = result.products.find(p => p.id === 'reference-layout').payload;
  const types = result.products.find(p => p.id === 'exact-value-types').payload;
  const folds = result.products.find(p => p.id === 'domain-folds').payload.events[0];
  const ref = (kind, owner, id) => ({ context: 'inventory', kind, owner, id });
  const values = new Map([
    [ref('state-field', ['Stock'], 'requests'), [{ key: 'r1', value: 'old' }]],
    [ref('state-field', ['Stock'], 'lastLabel'), { present: false, value: null }],
    [ref('state-field', ['Stock'], 'count'), '7'],
    [ref('state-field', ['Stock'], 'load'), '1.00'],
    [ref('state-field', ['Stock'], 'processed'), []],
    [ref('event-slot', ['Stock', 'Released'], 'delta'), '0.25'],
    [ref('event-slot', ['Stock', 'Released'], 'batch'), ['r1', 'r2']],
    [ref('event-slot', ['Stock', 'Released'], 'requestId'), 'r1'],
    [ref('event-slot', ['Stock', 'Released'], 'releaseId'), 'release-r1'],
    [ref('event-slot', ['Stock', 'Released'], 'label'), 'new'],
  ]);
  const output = evaluateFolds(folds, values, layout, types);
  const get = id => [...output].find(([r]) => r.id === id)[1];
  assert.deepEqual(get('requests'), []);
  assert.deepEqual(get('lastLabel'), { present: true, value: 'old' });
  assert.equal(get('count'), '8');
  assert.equal(get('load'), '1.25');
  assert.deepEqual(get('processed'), [{ key: 'r1', value: 'recorded' }, { key: 'r2', value: 'recorded' }]);
  assert.deepEqual([...values][0][1], [{ key: 'r1', value: 'old' }]);
});
const document = (r, id) => r.documents.find(d => d.id === id).value;
for (const [name, mutate, code] of [
  ['missing parameter origin', r => delete document(r, 'domain').aggregates[0].commands[0].parameters[0].origin, 'DEPENDENCY_ORIGIN'],
  ['host output falsely declared as command input', r => document(r, 'domain').aggregates[0].commands[0].parameters[0].origin = 'SYSTEM_INJECTED', 'DEPENDENCY_ORIGIN'],
  ['canonical wrong parameter type', r => document(r, 'domain').aggregates[0].commands[0].parameters[0].type = 'Boolean', 'VALUE_SOURCE'],
  ['unproduced event requires an explicit separate contract', r => document(r, 'domain').aggregates[0].commands[0].produces = [], 'DEPENDENCY_EVENT_UNPRODUCED'],
  ['missing event slot producer', r => document(r, 'domain').aggregates[0].events[0].bindings.pop(), 'DEPENDENCY_SLOT'],
  ['duplicate event slot producer', r => document(r, 'domain').aggregates[0].events[0].bindings.push(document(r, 'domain').aggregates[0].events[0].bindings[0]), 'DEPENDENCY_SLOT'],
  ['extra event slot producer', r => document(r, 'domain').aggregates[0].events[0].bindings.push({ slot: 'extra', expr: 'param.label' }), 'DEPENDENCY_SLOT'],
  ['wrong nominal slot producer', r => document(r, 'domain').aggregates[0].events[0].bindings[3].expr = 'param.label', 'VALUE_TYPE'],
  ['unknown produces event', r => document(r, 'domain').aggregates[0].commands[0].produces.push('Missing'), 'DEPENDENCY_EVENT'],
  ['partial command override cannot fall back', r => document(r, 'domain').aggregates[0].commands[0].emissionBindings = { Released: { requestId: 'param.requestId' } }, 'PRODUCT_FIELD_MISSING'],
  ['unknown host version', r => document(r, 'domain').hostComputations[0].version = '2', 'HOST_DESCRIPTOR'],
  ['unknown host output pin', r => document(r, 'domain').aggregates[0].events[0].bindings[1].expr.version = '2', 'VALUE_SCOPE'],
  ['unknown host input', r => document(r, 'domain').hostComputations[0].inputDependencies[0].id = 'ghost', 'VALUE_REFERENCE'],
  ['empty stable identity keys', r => document(r, 'domain').hostComputations[0].stableIdentityContract.keys = [], 'HOST_DESCRIPTOR'],
  ['host descriptor extra field', r => document(r, 'domain').hostComputations[0].runnable = true, 'PRODUCT_FIELD_UNKNOWN'],
  ['missing explicit state default', r => delete document(r, 'domain').aggregates[0].stateFields[0].default, 'FOLD_DEFAULT'],
  ['wrong exact default scale', r => document(r, 'domain').aggregates[0].stateFields[3].default = '0.000', 'EXACT_SCALE'],
  ['duplicate default map key', r => document(r, 'domain').aggregates[0].stateFields[0].default = [{ key: 'x', value: 'a' }, { key: 'x', value: 'b' }], 'VALUE_DUPLICATE_KEY'],
  ['replay cannot read command input', r => document(r, 'domain').aggregates[0].events[0].foldAssignments[0].key = 'param.requestId', 'VALUE_SCOPE'],
  ['replay cannot read host output', r => document(r, 'domain').aggregates[0].events[0].foldAssignments[1].expr = { form: 'host', id: document(r, 'domain').hostComputations[0].id, version: '1' }, 'VALUE_SCOPE'],
  ['null fold row is a diagnostic not thrown TypeError', r => document(r, 'domain').aggregates[0].events[0].foldAssignments[0] = null, 'PRODUCT_SHAPE'],
  ['unknown fold operator', r => document(r, 'domain').aggregates[0].events[0].foldAssignments[0].op = 'eval', 'FOLD_OPERATOR'],
  ['duplicate fold target', r => document(r, 'domain').aggregates[0].events[0].foldAssignments.push(document(r, 'domain').aggregates[0].events[0].foldAssignments[0]), 'FOLD_TARGET'],
  ['fold wrong collection target', r => document(r, 'domain').aggregates[0].events[0].foldAssignments[0].slot = 'count', 'FOLD_TYPE'],
  ['fold arithmetic invalid sign', r => document(r, 'domain').aggregates[0].events[0].foldAssignments[2].sign = 0, 'FOLD_SIGN'],
  ['fold integer literal overflow', r => document(r, 'domain').aggregates[0].events[0].foldAssignments[2].delta = 'literal:9223372036854775808', 'VALUE_OVERFLOW'],
  ['used dependencies cannot be forged', r => document(r, 'dependencies').dependencies.commands[0].usedDependencies.shift(), 'PRODUCT_PAYLOAD_MISMATCH'],
  ['signature cannot omit guard-only value', r => document(r, 'dependencies').dependencies.commands[0].declaredSignature.shift(), 'PRODUCT_PAYLOAD_MISMATCH'],
  ['fold binding cannot omit assignment', r => document(r, 'folds').folds.events[0].assignments.shift(), 'PRODUCT_PAYLOAD_MISMATCH'],
  ['v1 dependency cannot silently require decision-v2', r => r.requirements.find(r => r.id === 'domain-dependencies').requires[1].version = '2', 'PRODUCT_DEPENDENCY'],
]) test(name, () => {
  const r = request(); mutate(r);
  const result = compileProductSet(r);
  assert.equal(result.result, null);
  assert.equal(result.diagnostics[0].code, code);
});

test('all collection operations and signed arithmetic replay against immutable original state', () => {
  const set = compile().result;
  const layout = set.products.find(p => p.id === 'reference-layout').payload;
  const exact = set.products.find(p => p.id === 'exact-value-types').payload;
  const event = structuredClone(set.products.find(p => p.id === 'domain-folds').payload.events[0]);
  const ref = id => ({ context: 'inventory', kind: 'state-field', owner: ['Stock'], id });
  const text = value => ({ op: 'literal', valueType: { form: 'primitive', name: 'string' }, value });
  const keys = value => ({ op: 'literal', valueType: { form: 'sequence', element: { form: 'primitive', name: 'string' } }, value });
  const values = new Map([[ref('requests'), [{ key: 'a', value: 'one' }, { key: 'b', value: 'two' }]]]);
  const assignment = event.assignments[0];
  for (const [update, expected] of [
    [{ op: 'put', key: text('a'), value: text('replacement') }, [{ key: 'b', value: 'two' }, { key: 'a', value: 'replacement' }]],
    [{ op: 'remove-all', key: keys(['a', 'missing']) }, [{ key: 'b', value: 'two' }]],
    [{ op: 'put-all', key: keys(['a', 'a', 'c']), value: text('added') }, [{ key: 'b', value: 'two' }, { key: 'a', value: 'added' }, { key: 'c', value: 'added' }]],
  ]) {
    const output = evaluateFolds({ ...event, assignments: [{ ...assignment, update }] }, values, layout, exact);
    assert.deepEqual([...output][0][1], expected);
    assert.deepEqual([...values][0][1], [{ key: 'a', value: 'one' }, { key: 'b', value: 'two' }]);
  }
  const count = event.assignments[2], load = event.assignments[3];
  const input = new Map([[ref('count'), '7'], [ref('load'), '1.00'], [load.update.delta.ref, '0.25']]);
  const result = evaluateFolds({ ...event, assignments: [{ ...count, update: { ...count.update, sign: -1 } }, { ...load, update: { ...load.update, sign: -1 } }] }, input, layout, exact);
  assert.equal([...result].find(([r]) => r.id === 'count')[1], '6');
  assert.equal([...result].find(([r]) => r.id === 'load')[1], '0.75');
  assert.throws(() => evaluateFolds({ ...event, assignments: [assignment, assignment] }, values, layout, exact));
});

test('host values are explicit oracle inputs, never fabricated command fields or runtime implementations', () => {
  const set = compile().result;
  const layout = set.products.find(p => p.id === 'reference-layout').payload;
  const dependencies = set.products.find(p => p.id === 'domain-dependencies').payload;
  const c = dependencies.commands[0], slot = c.events[0].slots.find(s => s.slot.id === 'releaseId');
  assert.equal(evaluateValue(slot.producer, c.command, new Map([[dependencies.hosts[0].id, 'stable-release-r1']]), layout, dependencies.hosts), 'stable-release-r1');
  assert.throws(() => evaluateValue(slot.producer, c.command, new Map(), layout, dependencies.hosts));
});

test('source-derived immutable products are detached from later caller mutations', () => {
  const input = request(), result = compileProductSet(input).result;
  input.documents[4].value.dependencies.commands[0].declaredSignature.shift();
  assert.equal(result.products.find(p => p.id === 'domain-dependencies').payload.commands[0].declaredSignature.length, 5);
  assert.ok(Object.isFrozen(result));
  assert.throws(() => { result.products[0].payload.commands[0].decisions.push({}); });
});

test('actual complete command override retains source without per-slot fallback', () => {
  const input = request(), canonical = document(input, 'domain');
  canonical.aggregates[0].commands[0].emissionBindings = { Released: Object.fromEntries(canonical.aggregates[0].events[0].bindings.map(r => [r.slot, r.expr])) };
  const emission = document(input, 'dependencies').dependencies.commands[0].events[0];
  emission.source.pointer = '/aggregates/0/commands/0/emissionBindings/Released';
  emission.slots.forEach(s => { s.source.pointer = emission.source.pointer + '/' + s.slot.id; });
  assert.deepEqual(compileProductSet(input).diagnostics, []);
});

test('optional carriers distinguish None from Some(None) and map lookup of an absent optional item', () => {
  const base = { form: 'primitive', name: 'string' }, optional = { form: 'optional', element: base }, nested = { form: 'optional', element: optional };
  const none = { present: false, value: null }, someNone = { present: true, value: none };
  validateValue(none, nested, { declarations: [] });
  validateValue(someNone, nested, { declarations: [] });
  assert.notDeepEqual(none, someNone);
  for (const invalid of [null, { present: false, value: 'wrong' }, { present: 'true', value: null }, { present: true, value: null }]) assert.throws(() => validateValue(invalid, nested, { declarations: [] }));
  const map = { context: 'inventory', kind: 'state-field', owner: ['Stock'], id: 'nested' }, key = { context: 'inventory', kind: 'event-slot', owner: ['Stock', 'Released'], id: 'key' };
  const layout = { declarations: [{ ref: map, valueType: { form: 'map', key: base, value: optional } }, { ref: key, valueType: base }] };
  const e = { op: 'map-get', map: { op: 'ref', ref: map }, key: { op: 'ref', ref: key } }, scope = { context: 'inventory', kind: 'event', owner: ['Stock'], id: 'Released' };
  assert.deepEqual(evaluateValue(e, scope, new Map([[map, [{ key: 'k', value: none }]], [key, 'k']]), layout), someNone);
  assert.deepEqual(evaluateValue(e, scope, new Map([[map, []], [key, 'k']]), layout), none);
});

test('exact arithmetic rejects units, scales and overflow without rounding or implicit conversion', () => {
  const ref = id => ({ context: 'logistics', kind: 'type', owner: [], id });
  const type = { domain: ref('Distance'), version: '1', source: { document: 'domain', pointer: '' }, form: 'unit-decimal', precision: 5, scale: 2,
    amountMember: { context: 'logistics', kind: 'member', owner: ['Distance'], id: 'amount' }, unitMember: { context: 'logistics', kind: 'member', owner: ['Distance'], id: 'unit' }, units: ['km', 'mi'] };
  const nominal = { form: 'nominal', ref: type.domain };
  assert.deepEqual(applyExact({ amount: '1.00', unit: 'km' }, { amount: '0.25', unit: 'km' }, -1, nominal, [type]), { amount: '0.75', unit: 'km' });
  for (const [base, delta] of [[{ amount: '1.00', unit: 'km' }, { amount: '0.25', unit: 'mi' }], [{ amount: '999.99', unit: 'km' }, { amount: '0.25', unit: 'km' }], [{ amount: '1.000', unit: 'km' }, { amount: '0.25', unit: 'km' }]]) assert.throws(() => applyExact(base, delta, 1, nominal, [type]));
});

test('dataflow compiler initializes and executes without file/process/clock effects', () => {
  const modules = new Map();
  function bundle(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const text = readFileSync(url, 'utf8').replace(/from '(\.[^']+)'/gu, (_, relative) => `from ${JSON.stringify(bundle(new URL(relative, url)))}`);
    const result = `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
    modules.set(url.href, result); return result;
  }
  const compiler = bundle(new URL('../lib/products/compile.mjs', import.meta.url));
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
    const { compileProductSet } = await import(${JSON.stringify(compiler)});
    const input = ${JSON.stringify(request())};
    const compiled = compileProductSet(input);
    if (!compiled.result || compiled.diagnostics.length) throw Error('pure dataflow compile failed');
    input.documents[0].value.aggregates[0].events[0].foldAssignments[0].op = 'eval';
    if (compileProductSet(input).result !== null) throw Error('bad fold admitted');
    finish(0);
  `;
  execFileSync(process.execPath, ['--input-type=module'], { input: script, encoding: 'utf8', timeout: 20000, maxBuffer: 4 * 1024 * 1024 });
});
