import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { parseExpression } from '../lib/domain-products/expressions.mjs';
import { evaluateDecisions } from '../lib/domain-products/decision.mjs';
import { compareExact, formatExact, packExact, parseExact, unpackExact } from '../lib/value-products/exact-types.mjs';
import { decodeExact, encodeExact } from '../lib/value-products/exact-codecs.mjs';

const fixture = fileURLToPath(new URL('./fixtures/exact-products/files.json', import.meta.url));
const request = () => structuredClone(readProductRequest(fixture));
const compiled = () => compileProductSet(request());
const types = () => compiled().result.products.find(p => p.id === 'exact-value-types').payload;
const codecs = () => compiled().result.products.find(p => p.id === 'exact-value-codecs').payload;
const code = change => { const input = request(); change(input); const result = compileProductSet(input);
  assert.equal(result.result, null, 'expected refusal'); return result.diagnostics[0].code; };
const refuses = (expected, change) => assert.equal(code(change), expected);
const throwsCode = (expected, fn) => assert.throws(fn, error => error?.diagnostic?.code === expected, expected);

test('exact type and codec products compile in dependency order from explicit documents', () => {
  const result = compiled();
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.result.products.map(p => [p.id, p.version]),
    [['domain-decision', '2'], ['exact-value-codecs', '1'], ['exact-value-types', '1'], ['reference-layout', '1']]);
  assert.deepEqual(types().map(t => [t.domain.id, t.form, t.precision, t.scale, t.units]),
    [['Ratio', 'decimal', 5, 2, []], ['Distance', 'unit-decimal', 9, 3, ['km', 'mi']]]);
  assert.deepEqual(codecs().map(c => [c.id, c.format, c.wire.ref.id, c.po.ref.id]),
    [['ratio-minor-units', 'minor-units-text', 'WireRatio', 'PoRatio'],
     ['distance-fixed-text', 'fixed-decimal-text', 'WireDistance', 'PoDistance']]);
  const decisions = result.result.products[0].payload.commands[0].decisions;
  assert.deepEqual(decisions.map(d => [d.sourceOrdinal, d.ruleId, d.onFalse.kind]),
    [[0, 'leg-cap', 'reject'], [1, 'unit-match', 'reject'], [2, 'tolerance-floor', 'reject'], [3, 'duplicate', 'succeed-empty']]);
  assert.equal(decisions[0].predicate.op, 'less-equal');
  assert.equal(decisions[0].predicate.left.op, 'member');
  assert.equal(decisions[0].predicate.left.member.id, 'amount');
});

for (const [label, change, expected] of [
  ['precision beyond 38', r => { r.documents[2].value.types[0].precision = 39; }, 'EXACT_BOUNDS'],
  ['scale above precision', r => { r.documents[2].value.types[0].scale = 6; }, 'EXACT_BOUNDS'],
  ['duplicate units', r => { r.documents[2].value.types[1].units = ['km', 'km']; }, 'EXACT_UNIT'],
  ['record without unit member', r => { r.documents[2].value.types[1].unitMember = null; }, 'EXACT_SHAPE'],
  ['scalar with units', r => { r.documents[2].value.types[0].units = ['x']; }, 'EXACT_SHAPE'],
  ['unknown domain form', r => { r.documents[2].value.types[0].form = 'float'; }, 'EXACT_SHAPE'],
  ['domain type not in layout', r => { r.documents[2].value.types[0].domain.id = 'Missing'; }, 'EXACT_IDENTITY'],
  ['canonical version drift', r => { r.documents[2].value.types[0].version = '2'; }, 'EXACT_VERSION'],
  ['codec pinning wrong domain version', r => { r.documents[3].value.codecs[0].domainVersion = '2'; }, 'EXACT_VERSION'],
  ['wire aliasing domain identity', r => { r.documents[3].value.codecs[0].wire.ref = structuredClone(r.documents[2].value.types[0].domain); }, 'EXACT_IDENTITY'],
  ['po aliasing wire identity', r => { r.documents[3].value.codecs[1].po.ref = structuredClone(r.documents[3].value.codecs[1].wire.ref); }, 'EXACT_IDENTITY'],
  ['codec for missing type', r => r.documents[3].value.codecs.pop(), 'EXACT_COVERAGE'],
  ['unsupported codec format', r => { r.documents[3].value.codecs[0].format = 'double'; }, 'EXACT_CODEC'],
  ['codec row source drift', r => { r.documents[3].value.codecs[0].source.pointer = '/codecs/9'; }, 'EXACT_SOURCE'],
  ['member literal with wrong scale', r => { r.documents[0].value.aggregates[0].commands[0].guards[2].cond = 'param.tolerance >= 0.5'; }, 'DECISION_TYPE'],
  ['amount literal with wrong scale', r => { r.documents[0].value.aggregates[0].commands[0].guards[0].cond = 'param.legDistance.amount <= 900.00'; }, 'DECISION_TYPE'],
  ['literal over precision', r => { r.documents[0].value.aggregates[0].commands[0].guards[0].cond = 'param.legDistance.amount <= 1000000.000'; }, 'DECISION_TYPE'],
  ['cross nominal comparison', r => { r.documents[0].value.aggregates[0].commands[0].guards[0].cond = 'param.legDistance.amount < param.tolerance'; }, 'DECISION_TYPE'],
  ['bare literal comparison', r => { r.documents[0].value.aggregates[0].commands[0].guards[0].cond = '1.000 < 2.000'; }, 'DECISION_TYPE'],
  ['undeclared PO body', r => { r.documents[0].value.valueObjects[5].fields = []; }, 'PRODUCT_SOURCE'],
  ['canonical amount body changed to float', r => { r.documents[0].value.valueObjects[1].fields[0].dataType = 'Double'; }, 'EXACT_SHAPE'],
  ['member pointer replaced by owner', r => { r.documents[1].value.layout.declarations[2].source.pointer = '/valueObjects/1'; }, 'EXACT_SHAPE'],
  ['nominal record compared to literal', r => { r.documents[0].value.aggregates[0].commands[0].guards[0].cond = 'param.legDistance < 900.000'; }, 'DECISION_TYPE'],
  ['non canonical literal', r => { r.documents[0].value.aggregates[0].commands[0].guards[0].cond = 'param.legDistance.amount <= 012.000'; }, 'DECISION_NUMBER'],
  ['forged decision literal', r => { r.documents[4].value.decisions.commands[0].decisions[0].predicate.right.value = '800.000'; }, 'PRODUCT_PAYLOAD_MISMATCH'],
  ['dropped exact requirement', r => { r.requirements[3].requires.pop(); }, 'PRODUCT_DEPENDENCY'],
  ['semantic binding v1 schema with v2 identity', r => { r.documents[4].value.schemaVersion = 'truthsrc.domain-semantic-binding/v1'; r.documents[4].schemaVersion = 'truthsrc.domain-semantic-binding/v1'; }, 'PRODUCT_ROLE'],
]) test(`exact compilation refuses ${label}`, () => refuses(expected, change));

test('decimal parsing is exact text: no float, rounding, leading zeros or negative zero', () => {
  const [ratio, distance] = types();
  assert.equal(parseExact('12.345', distance), 12345n);
  assert.equal(parseExact('-0.001', distance), -1n);
  assert.equal(parseExact('999.99', ratio), 99999n);
  assert.equal(formatExact(12345n, distance), '12.345');
  assert.equal(formatExact(0n, distance), '0.000');
  assert.equal(formatExact(-1n, ratio), '-0.01');
  throwsCode('EXACT_SCALE', () => parseExact('12.34', distance));
  throwsCode('EXACT_SCALE', () => parseExact('12', distance));
  throwsCode('EXACT_SCALE', () => parseExact('12.3450', distance));
  throwsCode('EXACT_VALUE', () => parseExact('012.345', distance));
  throwsCode('EXACT_VALUE', () => parseExact('-0.000', distance));
  throwsCode('EXACT_VALUE', () => parseExact('1.2e3', distance));
  throwsCode('EXACT_OVERFLOW', () => parseExact('1000.00', ratio));
  throwsCode('EXACT_UNIT', () => unpackExact({ amount: '1.000', unit: 'm' }, distance));
});

test('comparisons require matching declared units and stay coefficient ordered', () => {
  const distance = types()[1];
  const a = packExact(12345n, 'km', distance), b = packExact(12346n, 'km', distance);
  assert.equal(compareExact(distance, a, b), -1);
  assert.equal(compareExact(distance, b, a), 1);
  assert.equal(compareExact(distance, a, packExact(12345n, 'km', distance)), 0);
  throwsCode('EXACT_UNIT', () => compareExact(distance, a, packExact(12345n, 'mi', distance)));
});

test('reversible conversions preserve exact bytes for both wire and PO targets', () => {
  const [ratio, distance] = types(), [ratioCodec, distanceCodec] = codecs();
  const leg = { amount: '12.345', unit: 'km' };
  for (const target of ['wire', 'po']) {
    const encoded = encodeExact(distance, distanceCodec, leg, target);
    const names = target === 'wire' ? ['wAmount', 'wUnit'] : ['pAmount', 'pUnit'];
    assert.deepEqual(encoded, { [names[0]]: '12.345', [names[1]]: 'km' });
    assert.deepEqual(decodeExact(distance, distanceCodec, encoded, target), leg);
  }
  assert.equal(encodeExact(ratio, ratioCodec, '12.34'), '1234');
  assert.equal(encodeExact(ratio, ratioCodec, '-0.01'), '-1');
  assert.deepEqual(decodeExact(ratio, ratioCodec, '1234'), '12.34');
  assert.deepEqual(decodeExact(ratio, ratioCodec, '-1'), '-0.01');
  throwsCode('EXACT_VALUE', () => decodeExact(ratio, ratioCodec, '0123'));
  throwsCode('EXACT_VALUE', () => decodeExact(ratio, ratioCodec, '-0'));
  throwsCode('EXACT_CODEC', () => encodeExact(ratio, distanceCodec, '12.34'));
  throwsCode('EXACT_CODEC', () => encodeExact(distance, ratioCodec, leg));
  throwsCode('EXACT_UNIT', () => encodeExact(distance, distanceCodec, { amount: '1.000', unit: 'm' }));
});

test('v2 parser vocabulary stays bounded and v1 inputs never gain numeric or member syntax', () => {
  const [ratio, distance] = types();
  const layout = compiled().result.products.find(p => p.id === 'reference-layout').payload;
  const command = { context: 'logistics', kind: 'command', owner: ['Shipment'], id: 'ReportLeg' };
  const exact = { types: [ratio, distance] };
  const parse = raw => parseExpression(raw, command, layout, exact);
  assert.equal(parse('param.legDistance.amount <= 900.000').op, 'less-equal');
  assert.equal(parse('param.legDistance.unit == state.travelled.unit').op, 'equal');
  assert.equal(parse('param.tolerance >= 0.50').op, 'greater-equal');
  assert.throws(() => parse('param.legDistance < 900.000'));
  assert.throws(() => parse('param.tolerance >= 0.5'));
  assert.throws(() => parse('param.legDistance.unknown == "x"'));
  assert.throws(() => parse('param.legDistance.amount <= 1e3'));
  assert.throws(() => parseExpression('param.tolerance >= 0.50', command, layout, null));
});

test('precision-38 and scale boundaries roundtrip without binary floating point', () => {
  const ratio = types()[0], codec = codecs()[0];
  const large = { ...ratio, precision: 38, scale: 18 };
  const value = '12345678901234567890.123456789012345678';
  assert.equal(encodeExact(large, codec, value), '12345678901234567890123456789012345678');
  assert.equal(decodeExact(large, codec, '12345678901234567890123456789012345678'), value);
  const allFraction = { ...ratio, precision: 3, scale: 3 };
  assert.equal(parseExact('0.001', allFraction), 1n);
  assert.equal(formatExact(999n, allFraction), '0.999');
  throwsCode('EXACT_OVERFLOW', () => parseExact('1.000', allFraction));
  const integer = { ...ratio, precision: 3, scale: 0 };
  assert.equal(parseExact('-999', integer), -999n);
  throwsCode('EXACT_SCALE', () => parseExact('1.0', integer));
  for (const number of [0n, 1n, -1n, 12345n, -12345n, 99999n]) {
    const text = formatExact(number, ratio);
    assert.equal(parseExact(text, ratio), number);
    for (const target of ['wire', 'po']) assert.equal(decodeExact(ratio, codec, encodeExact(ratio, codec, text, target), target), text);
  }
  throwsCode('EXACT_BOUNDS', () => formatExact(0n, { ...ratio, scale: 100000000 }));
  throwsCode('EXACT_VALUE', () => formatExact(1.0, ratio));
});

test('nominal comparison and equality use representable literals of the same exact type', () => {
  const result = compiled().result, layout = result.products.find(p => p.id === 'reference-layout').payload;
  const command = result.products[0].payload.commands[0].command, exact = { types: types() };
  const parse = raw => parseExpression(raw, command, layout, exact);
  assert.equal(parse('param.legDistance.amount == 900.000').op, 'equal');
  assert.equal(parse('param.tolerance == 0.50').op, 'equal');
  assert.equal(parse('param.legDistance.amount <= state.travelled.amount').op, 'less-equal');
  assert.throws(() => parse('param.legDistance.amount == 900.00'));
  assert.throws(() => parse('param.legDistance.amount <= param.tolerance'));
  assert.throws(() => parse('1.000 < 2.000'));
});

test('independent decision oracle covers scale, units, first failure and duplicate success', () => {
  const result = compiled().result, command = result.products[0].payload.commands[0];
  const layout = result.products.find(p => p.id === 'reference-layout').payload, exact = { types: types() };
  const ref = (kind, id) => ({ context: 'logistics', kind, owner: kind === 'parameter' ? ['Shipment', 'ReportLeg'] : ['Shipment'], id });
  const values = (amount, unit, ratio, duplicate = false) => new Map([
    [ref('parameter','legId'),'leg-1'], [ref('parameter','legDistance'),{ amount, unit }],
    [ref('parameter','tolerance'),ratio], [ref('state-field','travelled'),{ amount:'0.000', unit:'km' }],
    [ref('state-field','legs'),new Map(duplicate ? [['leg-1','done']] : [])],
  ]);
  const run = (...args) => evaluateDecisions(command, values(...args), layout, exact);
  assert.deepEqual(run('120.500','km','0.75'), { kind:'continue' });
  assert.deepEqual(run('950.000','km','0.75'), { kind:'reject', errCode:'leg-too-long' });
  assert.deepEqual(run('120.500','mi','0.75'), { kind:'reject', errCode:'unit-mismatch' });
  assert.deepEqual(run('120.500','km','0.40'), { kind:'reject', errCode:'bad-tolerance' });
  assert.deepEqual(run('120.500','km','0.75',true), { kind:'succeed-empty' });
  throwsCode('EXACT_SCALE', () => run('120.50','km','0.75'));
  throwsCode('EXACT_OVERFLOW', () => run('1000000.000','km','0.75'));
  throwsCode('EXACT_UNIT', () => run('120.500','m','0.75'));
  throwsCode('EXACT_SCALE', () => run('120.500','km','0.7'));
});

test('explicit financial representation uses independent currency and decimal constraints without defaults', () => {
  const [scalar, record] = types(), [scalarCodec, recordCodec] = codecs();
  const moneyRef = { context:'fund-orders', kind:'type', owner:[], id:'Money' };
  const money = { ...record, domain:moneyRef, precision:18, scale:2,
    amountMember:{ context:'fund-orders', kind:'member', owner:['Money'], id:'amount' },
    unitMember:{ context:'fund-orders', kind:'member', owner:['Money'], id:'currency' }, units:['CNY'] };
  const moneyCodec = { ...recordCodec, domain:moneyRef, id:'fund-order-money-text', wire:{ ...recordCodec.wire,
    unitMember:{ ...recordCodec.wire.unitMember, id:'currencyCode' } } };
  const value = { amount:'1000.00', currency:'CNY' };
  const encoded = encodeExact(money, moneyCodec, value);
  assert.deepEqual(encoded, { wAmount:'1000.00', currencyCode:'CNY' });
  assert.deepEqual(decodeExact(money, moneyCodec, encoded), value);
  throwsCode('EXACT_UNIT', () => encodeExact(money, moneyCodec, { amount:'1000.00', currency:'USD' }));
  throwsCode('EXACT_SCALE', () => encodeExact(money, moneyCodec, { amount:'1000.001', currency:'CNY' }));
  const shares = { ...scalar, precision:18, scale:6 };
  assert.equal(decodeExact(shares, scalarCodec, encodeExact(shares, scalarCodec, '476.190476')), '476.190476');
});

test('exact compiler and codec oracle initialize and execute with effects denied', () => {
  const modules = new Map();
  function bundle(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const text = readFileSync(url, 'utf8').replace(/from '(\.[^']+)'/gu, (_, relative) => `from ${JSON.stringify(bundle(new URL(relative, url)))}`);
    const result = `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
    modules.set(url.href, result); return result;
  }
  const compiler = bundle(new URL('../lib/products/compile.mjs', import.meta.url));
  const codec = bundle(new URL('../lib/value-products/exact-codecs.mjs', import.meta.url));
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
    const { encodeExact, decodeExact } = await import(${JSON.stringify(codec)});
    const input = ${JSON.stringify(request())};
    const compiled = compileProductSet(input);
    if (!compiled.result || compiled.diagnostics.length) throw Error('exact pure compile failed');
    const type = compiled.result.products.find(p => p.id === 'exact-value-types').payload[0];
    const binding = compiled.result.products.find(p => p.id === 'exact-value-codecs').payload[0];
    if (decodeExact(type, binding, encodeExact(type, binding, '12.34')) !== '12.34') throw Error('pure codec failed');
    input.documents[2].value.types[0].precision = 39;
    if (compileProductSet(input).result !== null) throw Error('bad exact declaration admitted');
    finish(0);
  `;
  execFileSync(process.execPath, ['--input-type=module'], { input: script, encoding: 'utf8', timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
});

test('legacy v1 decision fixture still compiles without exact products', () => {
  const v1 = readProductRequest(fileURLToPath(new URL('./fixtures/semantic-products/files.json', import.meta.url)));
  const result = compileProductSet(v1);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.result.products.map(p => [p.id, p.version]),
    [['domain-decision', '1'], ['reference-layout', '1']]);
});
