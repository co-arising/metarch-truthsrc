import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkerTranscript, validateWorkerLifecycle } from '../lib/verification/worker-evidence.mjs';

const transcript = rows => Buffer.from(rows.map(row => JSON.stringify(row)).join('\n') + '\n');
function example() {
  return {
    rows: [
      { kind: 'worker-started', pid: 42 },
      { id: 7, op: 'render', input: { document: 'warehouse' } },
      { id: 7, ok: false, error: 'retry separately' },
      { id: 99, op: 'close', input: null },
      { id: 99, ok: true, result: { closed: true } },
      { kind: 'worker-exited', pid: 42, waited: true, exitCode: 0 },
    ],
    receipt: { schemaVersion: 'warehouse.renderer/v3', pid: 42, closed: true,
      owner: 'warehouse-1', input: { version: 4, labels: ['stock'] }, diagnostic: 'extra receipt data' },
    expectedReceipt: { schemaVersion: 'warehouse.renderer/v3', owner: 'warehouse-1', input: { version: 4, labels: ['stock'] } },
  };
}

test('non-domain worker transcript and explicit receipt fields validate without I/O', () => {
  const input = example();
  input.rows = parseWorkerTranscript(transcript(input.rows));
  const result = validateWorkerLifecycle(input);
  assert.equal(result.pid, 42);
  assert.deepEqual(result.receipt, input.receipt);
  assert.deepEqual(result.exit, input.rows.at(-1));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.receipt.input.labels));
  // Arbitrary explicit receipt schema and noncontiguous IDs are supported.
  input.receipt.schemaVersion = input.expectedReceipt.schemaVersion = 'another.protocol/v9';
  assert.equal(validateWorkerLifecycle(input).receipt.schemaVersion, 'another.protocol/v9');
});

test('parser accepts UTF-8 bytes, CRLF and explicit record parser', () => {
  const bytes = transcript(example().rows);
  assert.deepEqual(parseWorkerTranscript(new Uint8Array(bytes)), example().rows);
  assert.deepEqual(parseWorkerTranscript(Buffer.from(bytes.toString().replaceAll('\n', '\r\n'))), example().rows);
  const seen = [];
  const rows = parseWorkerTranscript(bytes, { parseRecord(line) { seen.push(line); return JSON.parse(line); } });
  assert.equal(seen.length, 6);
  assert.deepEqual(rows, example().rows);
  assert.ok(Object.isFrozen(rows) && rows.every(Object.isFrozen));
});

test('parser rejects empty, truncated, blank, malformed, duplicate-key and non-object JSONL', () => {
  for (const text of ['', '\n', '{}', '{}\n\n', '{}\n \n', '{\n', '{} {}\n',
    '{"pid":42,"pid":43}\n', 'null\n', '[]\n', 'true\n', '"text"\n',
    '{"pid":1.5}\n', '{"pid":-0}\n', '{"pid":9007199254740992}\n', '﻿{}\n']) {
    assert.throws(() => parseWorkerTranscript(Buffer.from(text)), undefined, JSON.stringify(text));
  }
  assert.throws(() => parseWorkerTranscript(Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d, 0x0a])), /UTF-8/);
  assert.throws(() => parseWorkerTranscript(Buffer.alloc(8 * 1024 * 1024 + 1, 10)), /8 MiB/);
  for (const bytes of [null, {}, 5, new DataView(new ArrayBuffer(4))]) assert.throws(() => parseWorkerTranscript(bytes));
});

test('start and completion must be unique, ordered, waited, clean and the same worker', () => {
  const mutations = [
    x => x.rows.shift(),
    x => x.rows.splice(1, 0, { ...x.rows[0] }),
    x => x.rows.reverse(),
    x => x.rows.push({ ...x.rows.at(-1) }),
    x => x.rows.pop(),
    x => { x.rows.at(-1).pid = 43; },
    x => { x.rows.at(-1).waited = false; },
    x => { x.rows.at(-1).exitCode = 1; },
    x => { x.rows[0].kind = 'started'; },
    x => { x.rows[0].id = 0; },
    x => { x.rows.at(-1).op = 'close'; },
  ];
  for (const mutate of mutations) { const x = example(); mutate(x); assert.throws(() => validateWorkerLifecycle(x)); }
  for (const pid of [0, -1, -0, 1.5, '42', Number.MAX_SAFE_INTEGER + 1]) {
    const x = example(); x.rows[0].pid = x.rows.at(-1).pid = x.receipt.pid = pid;
    assert.throws(() => validateWorkerLifecycle(x));
  }
  const x = example(); x.rows[0].pid = x.rows.at(-1).pid = x.receipt.pid = 1;
  assert.equal(validateWorkerLifecycle(x).pid, 1, 'no application-specific PID floor');
});

test('each explicit expectation is an own field with exact structural equality', () => {
  for (const mutate of [
    x => { x.receipt.schemaVersion = 'other'; },
    x => { delete x.receipt.owner; },
    x => { x.receipt.input.version = '4'; },
    x => { x.receipt.input.extra = true; },
    x => { x.expectedReceipt.absent = true; },
    x => { x.receipt.pid = 43; },
    x => { x.receipt.closed = false; },
    x => { delete x.expectedReceipt; },
    x => { x.expectedReceipt = {}; },
    x => { x.expectedReceipt = []; },
  ]) { const x = example(); mutate(x); assert.throws(() => validateWorkerLifecycle(x)); }
  const x = example(); x.expectedReceipt = JSON.parse('{"toString":"own value"}');
  assert.throws(() => validateWorkerLifecycle(x));
});

test('close exchange must correlate identity and precede the final exit', () => {
  for (const mutate of [
    x => { x.rows[4].id = 98; },
    x => { x.rows[3].id = 7; },
    x => { x.rows[3].id = '99'; },
    x => { x.rows[3].id = -1; },
    x => { x.rows[3].id = -0; },
    x => { x.rows[4].result.closed = false; },
    x => { delete x.rows[4].result; },
    x => { x.rows.splice(3, 1); },
    x => { x.rows.splice(4, 1); },
    x => { [x.rows[3], x.rows[4]] = [x.rows[4], x.rows[3]]; },
    x => { [x.rows[4], x.rows[5]] = [x.rows[5], x.rows[4]]; },
    x => { x.rows.splice(5, 0, { id: 100, op: 'render' }, { id: 100, ok: true, result: {} }); },
    x => { x.rows.splice(1, 0, { id: 6, op: 'render' }); },
    x => { x.rows.splice(1, 0, { message: 'unclassified evidence' }); },
    x => { x.rows[4].pid = 43; },
  ]) { const x = example(); mutate(x); assert.throws(() => validateWorkerLifecycle(x)); }
});

test('successful close is an explicit stricter policy, not inferred from another response', () => {
  for (const ok of [false, undefined]) {
    const x = example();
    if (ok === undefined) delete x.rows[4].ok; else x.rows[4].ok = ok;
    assert.equal(validateWorkerLifecycle(x).pid, 42);
    assert.throws(() => validateWorkerLifecycle({ ...x, requireSuccessfulCloseExchange: true }), /successful close/);
  }
  const x = example(); x.rows[2] = { id: 7, ok: true, result: { closed: true } }; x.rows[4].ok = false;
  assert.throws(() => validateWorkerLifecycle({ ...x, requireSuccessfulCloseExchange: true }), /successful close/);
  assert.equal(validateWorkerLifecycle({ ...example(), requireSuccessfulCloseExchange: true }).pid, 42);
});

test('no-exit evidence allows EOF and an unfinished exchange but never a claimed exit', () => {
  const x = example(); x.expectExit = false;
  assert.throws(() => validateWorkerLifecycle(x), /exit/);
  x.rows = x.rows.slice(0, 1);
  assert.equal(validateWorkerLifecycle(x).exit, null);
  assert.throws(() => validateWorkerLifecycle({ ...x, requireSuccessfulCloseExchange: true }), /close/);
  x.rows.push({ id: 123, op: 'render', input: {} });
  assert.equal(validateWorkerLifecycle(x).pid, 42);
  x.rows.push({ id: 124, ok: true, result: {} });
  assert.throws(() => validateWorkerLifecycle(x), /identity/);
  const closed = example(); closed.rows.pop();
  assert.equal(validateWorkerLifecycle({ ...closed, expectExit: false, requireSuccessfulCloseExchange: true }).exit, null);
});

test('validation snapshots data without freezing or retaining caller objects', () => {
  const x = example(), before = structuredClone(x), result = validateWorkerLifecycle(x);
  assert.deepEqual(x, before);
  assert.ok(!Object.isFrozen(x) && !Object.isFrozen(x.rows) && !Object.isFrozen(x.receipt));
  x.receipt.input.labels.push('changed'); x.rows.at(-1).pid = 999; x.expectedReceipt.input.version = 999;
  assert.deepEqual(result.receipt.input.labels, ['stock']); assert.equal(result.exit.pid, 42);
  assert.throws(() => { result.receipt.input.version = 999; }, TypeError);
  const source = { kind: 'worker-started', pid: 42 };
  const parsed = parseWorkerTranscript(Buffer.from('{}\n'), { parseRecord: () => source });
  source.pid = 9; assert.equal(parsed[0].pid, 42); assert.ok(!Object.isFrozen(source));
  const bytes = Buffer.from('{}\n{}\n'); let count = 0;
  parseWorkerTranscript(bytes, { parseRecord(line) { bytes.fill(0); count++; return JSON.parse(line); } });
  assert.equal(count, 2, 'caller mutation cannot alter subsequent captured records');
});

test('accessors, proxies, cycles, sparse data and invalid options are rejected without executing hooks', () => {
  let calls = 0;
  const getter = { enumerable: true, get() { calls++; throw new Error('getter called'); } };
  for (const key of ['rows', 'receipt', 'expectedReceipt', 'expectExit']) {
    const x = example(); Object.defineProperty(x, key, getter);
    assert.throws(() => validateWorkerLifecycle(x));
  }
  for (const key of ['receipt', 'expectedReceipt']) {
    const x = example(); Object.defineProperty(x[key], 'owner', getter);
    assert.throws(() => validateWorkerLifecycle(x));
  }
  const x = example(); Object.defineProperty(x.rows[0], 'pid', getter);
  assert.throws(() => validateWorkerLifecycle(x));
  assert.throws(() => parseWorkerTranscript(Buffer.from('{}\n'), Object.defineProperty({}, 'parseRecord', getter)));
  assert.throws(() => parseWorkerTranscript(Buffer.from('{}\n'), { parseRecord: () => Object.defineProperty({}, 'pid', getter) }));
  const proxy = new Proxy({}, { ownKeys() { calls++; throw new Error('trap called'); } });
  assert.throws(() => validateWorkerLifecycle(proxy));
  assert.throws(() => validateWorkerLifecycle({ ...example(), receipt: proxy }));
  assert.throws(() => parseWorkerTranscript(Buffer.from('{}\n'), proxy));
  assert.throws(() => parseWorkerTranscript(Buffer.from('{}\n'), { parseRecord: () => proxy }));
  assert.equal(calls, 0);
  const cyclic = example(); cyclic.receipt.self = cyclic.receipt;
  const sparse = example(); delete sparse.rows[2];
  for (const bad of [cyclic, sparse, { ...example(), expectExit: 'false' },
    { ...example(), requireSuccessfulCloseExchange: 1 }, { ...example(), unexpected: true }]) {
    assert.throws(() => validateWorkerLifecycle(bad));
  }
  for (const opts of [null, [], { parseRecord: true }, { unknown: true }]) {
    assert.throws(() => parseWorkerTranscript(Buffer.from('{}\n'), opts));
  }
});
