import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { compileProductSet } from '../lib/products/compile.mjs';
import { evaluateDecisions } from '../lib/domain-products/decision.mjs';
import { parseExpression, infer, exactOperand } from '../lib/domain-products/expressions.mjs';
import { evaluateFolds } from '../lib/domain-products/folds.mjs';

const fixture = n => JSON.parse(readFileSync(new URL(`./fixtures/guards-v3/${n}.json`, import.meta.url), 'utf8'));
const request = () => { const f = fixture('files'); return { ...f, schemaVersion: 'truthsrc.product-compilation/v1', documents: f.documents.map(d => ({ id: d.id, schemaVersion: d.schemaVersion, value: fixture(d.file.slice(0, -5)) })) }; };
const doc = (r, id) => r.documents.find(d => d.id === id).value;
const ref = (kind, id) => ({ context: 'measurement', kind, owner: kind === 'parameter' ? ['Gauge', 'Adjust'] : ['Gauge'], id });
function compiled() {
  const c = compileProductSet(request()); assert.deepEqual(c.diagnostics, []);
  const p = id => c.result.products.find(p => p.id === id).payload;
  return { set: c.result, layout: p('reference-layout'), exact: { types: p('exact-value-types') }, command: p('domain-decision').commands[0], folds: p('domain-folds').events[0] };
}
const values = () => new Map([[ref('parameter', 'label'), 'sample'], [ref('parameter', 'delta'), '0.25'], [ref('parameter', 'steps'), '3'], [ref('parameter', 'batch'), ['a', 'b']], [ref('state-field', 'level'), '1.00'], [ref('state-field', 'status'), 'ready'], [ref('state-field', 'stock'), new Map([['a', 'x'], ['b', 'y']])]]);
test('explicit v3 compiler derives complete mixed ordered guards and guard-only dependencies', () => {
  const c = compiled(); assert.equal(c.command.decisions.length, 7);
  assert.deepEqual(c.command.decisions.map(d => d.sourceOrdinal), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(c.set.products.find(p => p.id === 'domain-dependencies').payload.commands[0].declaredSignature.length, 4);
  assert.ok(c.set.products.find(p => p.id === 'domain-dependencies').payload.commands[0].usedDependencies.some(r => r.id === 'stock'));
  assert.equal(c.set.readiness.runnable, false);
});
test('pure oracle enforces positivity, coverage, sufficiency and status without changing inputs', () => {
  const c = compiled(), v = values(); const run = () => evaluateDecisions(c.command, v, c.layout, c.exact, '3');
  assert.deepEqual(run(), { kind: 'continue' });
  for (const [r, value, code] of [[ref('parameter', 'delta'), '0.00', 'not-positive'], [ref('parameter', 'batch'), ['missing'], 'uncovered'], [ref('state-field', 'level'), '0.10', 'insufficient'], [ref('state-field', 'status'), 'retired', 'not-ready']]) {
    const original = [...v].find(([key]) => key.id === r.id)[1]; v.set([...v.keys()].find(key => key.id === r.id), value);
    assert.deepEqual(run(), { kind: 'reject', errCode: code }); v.set([...v.keys()].find(key => key.id === r.id), original);
  }
  assert.equal([...v].find(([r]) => r.id === 'status')[1], 'ready');
});
test('integer guard arithmetic is signed-64 exact, left-associated and bounded', () => {
  const c = compiled();
  const p = parseExpression('param.steps - 1 + 2 > 0', c.command.command, c.layout, c.exact, '3');
  const command = { ...c.command, decisions: [{ ...c.command.decisions[6], predicate: p }] };
  assert.deepEqual(evaluateDecisions(command, new Map([[ref('parameter', 'steps'), '9007199254740993']]), c.layout, c.exact, '3'), { kind: 'continue' });
  assert.throws(() => evaluateDecisions(command, new Map([[ref('parameter', 'steps'), '9223372036854775807']]), c.layout, c.exact, '3'));
  for (const s of ['param.steps * 2 > 0', 'param.steps / 2 > 0', 'param.steps + 1.0 > 0', 'param.steps + 9223372036854775808 > 0']) assert.throws(() => parseExpression(s, c.command.command, c.layout, c.exact, '3'));
});
test('v1 and v2 source languages still reject guard arithmetic and new structured forms', () => {
  const c = compiled(); for (const version of ['1', '2']) assert.throws(() => parseExpression('param.delta + 0.10 > 0.00', c.command.command, c.layout, c.exact, version));
  const r = request(); for (const q of r.requirements) { if (q.version === '3') { q.version = '2'; q.payloadSchemaVersion = q.payloadSchemaVersion.replace('/v3', '/v2'); q.capabilities[0].version = '2'; } q.requires.forEach(d => { if (d.version === '3') d.version = '2'; }); }
  for (const d of r.documents) { d.schemaVersion = d.schemaVersion.replace('/v3', '/v2'); d.value.schemaVersion = d.value.schemaVersion.replace('/v3', '/v2'); }
  assert.equal(compileProductSet(r).result, null);
});
for (const [name, mutate] of [
  ['mixed dependency version', r => r.requirements.find(q => q.id === 'domain-dependencies').requires[1].version = '2'],
  ['missing exact metadata', r => r.requirements = r.requirements.filter(q => q.id !== 'exact-value-types')],
  ['unknown structured field', r => doc(r, 'domain').aggregates[0].commands[0].guards[1].when.round = true],
  ['bare decimal positivity', r => doc(r, 'domain').aggregates[0].commands[0].guards[1].when.amount = 'param.delta.amount'],
  ['unknown sufficient state', r => doc(r, 'domain').aggregates[0].commands[0].guards[3].when.in = 'ghost'],
  ['status from wrong shape', r => doc(r, 'domain').aggregates[0].commands[0].guards[4].from = ['ready']],
  ['status no precondition', r => { delete doc(r, 'domain').aggregates[0].commands[0].guards[4].from; delete doc(r, 'domain').aggregates[0].commands[0].guards[4].notStatus; }],
  ['status duplicate forbidden state', r => doc(r, 'domain').aggregates[0].commands[0].guards[4].notStatus = ['retired', 'retired']],
  ['status ambiguous extra key', r => doc(r, 'domain').aggregates[0].commands[0].guards[4].cond = 'true'],
  ['forged full binding and predicate', r => doc(r, 'decisions').decisions.commands[0].decisions[1].predicate = { op: 'boolean', value: true }],
  ['omitted guard-only parameter', r => doc(r, 'dependencies').dependencies.commands[0].declaredSignature.pop()],
]) test(name + ' fails closed', () => { const r = request(); mutate(r); const c = compileProductSet(r); assert.equal(c.result, null); assert.ok(c.diagnostics.length); });
test('empty coverage is true, succeed-empty stops before unavailable later inputs', () => {
  const c = compiled(), v = new Map([[ref('parameter', 'batch'), []], [ref('state-field', 'stock'), new Map()]]);
  const coverage = { ...c.command, decisions: [c.command.decisions[2]] };
  assert.deepEqual(evaluateDecisions(coverage, v, c.layout, c.exact, '3'), { kind: 'continue' });
  const stop = { ...c.command, decisions: [{ ...c.command.decisions[1], onFalse: { kind: 'succeed-empty' } }, c.command.decisions[2]] };
  assert.deepEqual(evaluateDecisions(stop, new Map([[ref('parameter', 'delta'), '0.00']]), c.layout, c.exact, '3'), { kind: 'succeed-empty' });
});
test('v3 replay retains the v2 finite grammar and pre-event semantics', () => {
  const c = compiled(); const input = new Map([[ref('state-field', 'level'), '1.00'], [ref('state-field', 'previous'), '9.00'], [ref('state-field', 'count'), '7'], [{ context: 'measurement', kind: 'event-slot', owner: ['Gauge', 'Adjusted'], id: 'change' }, '0.35'], [{ context: 'measurement', kind: 'event-slot', owner: ['Gauge', 'Adjusted'], id: 'steps' }, '2']]);
  const output = evaluateFolds(c.folds, input, c.layout, c.exact.types);
  assert.equal([...output].find(([r]) => r.id === 'level')[1], '1.35'); assert.equal([...output].find(([r]) => r.id === 'previous')[1], '1.00');
});

function unitFixture() {
  const c = compiled(), typeRef = { context: 'measurement', kind: 'type', owner: [], id: 'Distance' };
  const amount = { context: 'measurement', kind: 'member', owner: ['Distance'], id: 'amount' }, unit = { ...amount, id: 'unit' };
  const nominal = { form: 'nominal', ref: typeRef }, text = { form: 'primitive', name: 'string' };
  const type = { domain: typeRef, version: '1', source: { document: 'domain', pointer: '' }, form: 'unit-decimal', precision: 5, scale: 2, amountMember: amount, unitMember: unit, units: ['km', 'mi'] };
  const layout = { ...c.layout, declarations: [...c.layout.declarations,
    { ref: typeRef, valueType: { form: 'record', members: [amount, unit] } }, { ref: amount, valueType: { form: 'primitive', name: 'decimal' } }, { ref: unit, valueType: text },
    { ref: ref('parameter', 'distance'), valueType: nominal }, { ref: ref('parameter', 'other'), valueType: nominal }, { ref: ref('state-field', 'balances'), valueType: { form: 'map', key: text, value: nominal } }] };
  const exact = { types: [type] }, expression = id => ({ op: 'ref', ref: ref('parameter', id) });
  const decision = predicate => ({ ...c.command, decisions: [{ ...c.command.decisions[1], predicate }] });
  return { ...c, layout, exact, expression, decision, typeRef };
}
test('unit-keyed balance sufficiency returns false for a missing key and refuses wrong units/scale', () => {
  const c = unitFixture(), p = { op: 'exact-sufficient', left: { op: 'ref', ref: ref('state-field', 'balances') }, right: c.expression('distance') };
  assert.deepEqual(infer(p, c.command.command, c.layout, c.exact, '3'), { form: 'primitive', name: 'boolean' });
  const run = balances => evaluateDecisions(c.decision(p), new Map([[ref('parameter', 'distance'), { amount: '0.25', unit: 'km' }], [ref('state-field', 'balances'), balances]]), c.layout, c.exact, '3');
  assert.deepEqual(run(new Map([['km', { amount: '1.00', unit: 'km' }]])), { kind: 'continue' });
  assert.deepEqual(run(new Map()), { kind: 'reject', errCode: 'not-positive' });
  assert.throws(() => run(new Map([[1, { amount: '1.00', unit: 'km' }]])));
  for (const value of [{ amount: '1.00', unit: 'mi' }, { amount: '1.000', unit: 'km' }, { amount: '1000.00', unit: 'km' }]) assert.throws(() => run(new Map([['km', value]])));
});
test('unit arithmetic preserves units across member arithmetic rather than erasing them', () => {
  const c = unitFixture();
  const p = parseExpression('param.distance.amount - param.other.amount >= 0.00', c.command.command, c.layout, c.exact, '3');
  const run = unit => evaluateDecisions(c.decision(p), new Map([[ref('parameter', 'distance'), { amount: '1.00', unit: 'km' }], [ref('parameter', 'other'), { amount: '0.25', unit }]]), c.layout, c.exact, '3');
  assert.deepEqual(run('km'), { kind: 'continue' }); assert.throws(() => run('mi'));
  const nominal = { op: 'add', left: c.expression('distance'), right: c.expression('other') };
  assert.deepEqual(exactOperand(nominal, c.command.command, c.layout, c.exact, '3').domain, c.typeRef);
  assert.throws(() => infer({ op: 'add', left: c.expression('distance'), right: { op: 'decimal', value: '0.25' } }, c.command.command, c.layout, c.exact, '3'));
});
test('structured paths cannot smuggle arithmetic, literals or arbitrary source calls', () => {
  for (const amount of ['param.delta + 0.10', '0.10', 'param.delta.round(2)']) { const r = request(); doc(r, 'domain').aggregates[0].commands[0].guards[1].when.amount = amount; assert.equal(compileProductSet(r).result, null); }
});
test('v3 exact overflow and depth reject before producing a successful result', () => {
  const c = compiled();
  const p = parseExpression('state.level + param.delta > 0.00', c.command.command, c.layout, c.exact, '3');
  assert.throws(() => evaluateDecisions({ ...c.command, decisions: [{ ...c.command.decisions[5], predicate: p }] }, new Map([[ref('state-field', 'level'), '999.99'], [ref('parameter', 'delta'), '0.01']]), c.layout, c.exact, '3'));
  assert.throws(() => parseExpression('('.repeat(33) + 'true' + ')'.repeat(33), c.command.command, c.layout, c.exact, '3'));
});
test('ordered v3 guard outcomes do not deduplicate shared error codes or reorder empty success', () => {
  const c = compiled(), first = { ...c.command.decisions[0], onFalse: { kind: 'reject', errCode: 'same' } }, second = { ...c.command.decisions[1], onFalse: { kind: 'succeed-empty' } };
  const command = { ...c.command, decisions: [first, second, c.command.decisions[2]] };
  assert.deepEqual(evaluateDecisions(command, new Map([[ref('parameter', 'label'), ''], [ref('parameter', 'delta'), '0.00']]), c.layout, c.exact, '3'), { kind: 'reject', errCode: 'same' });
  assert.deepEqual(evaluateDecisions(command, new Map([[ref('parameter', 'label'), 'present'], [ref('parameter', 'delta'), '0.00']]), c.layout, c.exact, '3'), { kind: 'succeed-empty' });
});
test('v3 exact types cannot alias another nominal with an identical carrier', () => {
  const c = compiled(), other = { context: 'measurement', kind: 'type', owner: [], id: 'OtherRatio' };
  const layout = { ...c.layout, declarations: [...c.layout.declarations, { ref: ref('parameter', 'other'), valueType: { form: 'nominal', ref: other } }] };
  const exact = { types: [...c.exact.types, { ...c.exact.types[0], domain: other }] };
  for (const source of ['param.delta + param.other > 0.00', 'param.delta > param.other', 'param.other + param.delta == 0.00']) assert.throws(() => parseExpression(source, c.command.command, layout, exact, '3'));
});
test('guard arithmetic preserves presence dominance around raw lookup', () => {
  const c = compiled(), map = ref('state-field', 'ratios'), string = { form: 'primitive', name: 'string' }, type = { form: 'nominal', ref: c.exact.types[0].domain };
  const layout = { ...c.layout, declarations: [...c.layout.declarations, { ref: map, valueType: { form: 'map', key: string, value: type } }] };
  const safe = parseExpression('state.ratios.contains(param.label) && state.ratios(param.label) + 0.10 > 0.00', c.command.command, layout, c.exact, '3');
  const missing = new Map([[ref('parameter', 'label'), 'missing'], [map, new Map()]]);
  assert.deepEqual(evaluateDecisions({ ...c.command, decisions: [{ ...c.command.decisions[0], predicate: safe }] }, missing, layout, c.exact, '3'), { kind: 'reject', errCode: 'empty-label' });
});
test('status conjunction bounds and explicit outcome/error requirements fail closed', () => {
  for (const mutate of [g => g.notStatus = Array.from({ length: 63 }, (_, i) => `s${i}`), g => { g.onFail = 'succeed-empty'; delete g.errCode; }, g => g.from = '']) {
    const r = request(); mutate(doc(r, 'domain').aggregates[0].commands[0].guards[4]); assert.equal(compileProductSet(r).result, null);
  }
});
test('integer-only v3 parser preserves minus-token boundaries and signed minimum without exact types', () => {
  const c = compiled(), p = parseExpression('param.steps - -1 >= -9223372036854775808', c.command.command, c.layout, null, '3');
  assert.deepEqual(evaluateDecisions({ ...c.command, decisions: [{ ...c.command.decisions[6], predicate: p }] }, new Map([[ref('parameter', 'steps'), '1']]), c.layout, null, '3'), { kind: 'continue' });
});
test('v3 compiler initializes and compiles with file/process/clock/network effects denied', () => {
  const modules = new Map();
  function bundle(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const text = readFileSync(url, 'utf8').replace(/from '(\.[^']+)'/gu, (_, relative) => `from ${JSON.stringify(bundle(new URL(relative, url)))}`);
    const result = `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`; modules.set(url.href, result); return result;
  }
  const compiler = bundle(new URL('../lib/products/compile.mjs', import.meta.url));
  const script = `
    const fs = (await import('node:fs')).default, child = (await import('node:child_process')).default;
    const { syncBuiltinESMExports } = await import('node:module'); const deny = () => { throw Error('forbidden effect'); };
    for (const key of ['readFileSync','readdirSync','existsSync','writeFileSync','mkdirSync','rmSync','statSync','lstatSync','openSync']) fs[key] = deny;
    for (const key of ['readFile','writeFile','readdir','stat','open','access']) fs.promises[key] = deny;
    for (const key of ['execFileSync','execSync','spawn','spawnSync','exec','fork']) child[key] = deny;
    syncBuiltinESMExports(); const finish = process.exit.bind(process);
    globalThis.process = new Proxy({}, { get: deny }); globalThis.Date = new Proxy(class {}, { get: deny, construct: deny });
    globalThis.fetch = deny; globalThis.setTimeout = deny; globalThis.setInterval = deny; Math.random = deny;
    const { compileProductSet } = await import(${JSON.stringify(compiler)}); const input = ${JSON.stringify(request())};
    if (!compileProductSet(input).result) throw Error('pure v3 compile failed');
    input.documents[0].value.aggregates[0].commands[0].guards[1].when.amount = 'param.delta + 0.10';
    if (compileProductSet(input).result !== null) throw Error('illegal path admitted'); finish(0);
  `;
  execFileSync(process.execPath, ['--input-type=module'], { input: script, encoding: 'utf8', timeout: 20000, maxBuffer: 4 * 1024 * 1024 });
});
