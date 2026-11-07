import assert from 'node:assert/strict';
import { types } from 'node:util';
import { copyImmutableData } from '../immutable-data.mjs';
import { MAX_JSON_BYTES, parseStrictJson } from '../strict-json.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);
const identity = value => Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);

// The parser's one callback is deliberately not passed through the JSON-data
// copier. Inspect descriptors instead, so even options cannot execute getters.
function recordParser(options) {
  assert.ok(object(options) && !types.isProxy(options), 'plain parser options required');
  assert.ok([Object.prototype, null].includes(Object.getPrototypeOf(options)), 'plain parser options required');
  const entries = Object.getOwnPropertyDescriptors(options);
  for (const key of Reflect.ownKeys(entries)) {
    assert.ok(key === 'parseRecord' && entries[key].enumerable && own(entries[key], 'value'), 'invalid parser option');
  }
  const parse = entries.parseRecord?.value ?? parseStrictJson;
  assert.equal(typeof parse, 'function', 'parseRecord must be a function');
  return parse;
}

/**
 * Parse a nonempty, newline-terminated UTF-8 JSONL snapshot (CRLF is allowed).
 * Each row must be an object. parseRecord receives one immutable line of text;
 * the default is strict JSON (including duplicate-key and exact-number checks).
 * Returns detached, deeply frozen rows. It performs no filesystem/process I/O.
 */
export function parseWorkerTranscript(bytes, options = {}) {
  const parse = recordParser(options);
  assert.ok(types.isUint8Array(bytes), 'worker transcript must be UTF-8 bytes');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new Error('worker transcript contains invalid UTF-8'); }
  assert.ok(Buffer.byteLength(text, 'utf8') <= MAX_JSON_BYTES, 'worker transcript exceeds 8 MiB');
  assert.ok(text.length > 0 && text.endsWith('\n'), 'complete worker JSONL required');
  // Decode the entire snapshot before invoking caller code. A callback cannot
  // mutate the original buffer to change the interpretation of later records.
  return Object.freeze(text.slice(0, -1).split('\n').map((line, index) => {
    assert.ok(line.trim().length > 0, 'blank worker JSONL record');
    const row = copyImmutableData(parse(line), `/rows/${index}`);
    assert.ok(object(row), 'worker JSONL record must be an object');
    return row;
  }));
}

/**
 * Pure lifecycle check for a sequential request/reply worker protocol:
 *   {kind:'worker-started',pid}, {id,op,...}, {id,ok?,result?,error?},
 *   {kind:'worker-exited',pid,waited:true,exitCode:0}.
 * IDs are nonnegative safe integers, unique per request, not necessarily ordered
 * or contiguous. Replies must match the outstanding request. Ordinary failures
 * are allowed. A normal exit requires a matching close reply with result.closed
 * exactly true; requireSuccessfulCloseExchange additionally requires ok===true.
 * With expectExit=false there must be no exit row; EOF may leave a request open.
 *
 * receipt must have the same pid and closed===true. expectedReceipt is a required
 * nonempty map: every declared own field is compared exactly (deep equality),
 * while additional receipt fields are allowed. No receipt schema/path is assumed.
 * Returns frozen {pid,receipt,exit}; exit is null when no exit was expected.
 * Inputs are snapshotted without invoking accessors or freezing caller objects.
 */
export function validateWorkerLifecycle(options) {
  const input = copyImmutableData(options);
  assert.ok(object(input), 'worker lifecycle options required');
  for (const key of Object.keys(input)) assert.ok(['rows', 'receipt', 'expectedReceipt', 'expectExit', 'requireSuccessfulCloseExchange'].includes(key), 'unknown worker lifecycle option');
  const { rows, receipt, expectedReceipt, expectExit = true, requireSuccessfulCloseExchange = false } = input;
  assert.equal(typeof expectExit, 'boolean', 'expectExit must be boolean');
  assert.equal(typeof requireSuccessfulCloseExchange, 'boolean', 'requireSuccessfulCloseExchange must be boolean');
  assert.ok(Array.isArray(rows) && rows.length > 0 && rows.every(object), 'worker rows required');
  assert.ok(object(receipt), 'worker receipt required');
  assert.ok(object(expectedReceipt) && Object.keys(expectedReceipt).length > 0, 'explicit expected receipt fields required');
  for (const [key, value] of Object.entries(expectedReceipt)) {
    assert.ok(own(receipt, key), `expected receipt field missing: ${key}`);
    assert.deepEqual(receipt[key], value, `worker receipt field differs: ${key}`);
  }

  const starts = rows.filter(row => row.kind === 'worker-started');
  const exits = rows.filter(row => row.kind === 'worker-exited');
  assert.equal(starts.length, 1, 'exactly one worker start required');
  assert.equal(rows[0], starts[0], 'worker start must be first');
  const { pid } = starts[0];
  assert.ok(identity(pid) && pid > 0, 'positive worker PID required');
  assert.equal(receipt.pid, pid, 'worker receipt PID differs');
  assert.equal(receipt.closed, true, 'closed worker receipt required');
  assert.equal(exits.length, expectExit ? 1 : 0, 'unexpected worker exit count');
  const exit = expectExit ? exits[0] : null;
  if (exit) {
    assert.equal(rows.at(-1), exit, 'worker exit must be last');
    assert.equal(exit.pid, pid, 'worker exit PID differs');
    assert.equal(exit.waited, true, 'worker exit must attest waiting');
    assert.equal(exit.exitCode, 0, 'worker exit must be clean');
  }

  const ids = new Set();
  let pending = null, closeRequest = null, closeReply = null;
  for (const row of rows) {
    if (own(row, 'kind')) {
      assert.ok(row === starts[0] || row === exit, 'unknown worker lifecycle row');
      assert.ok(!['id', 'op', 'ok', 'result', 'error'].some(key => own(row, key)), 'ambiguous worker lifecycle row');
      continue;
    }
    if (own(row, 'pid')) assert.equal(row.pid, pid, 'exchange worker PID differs');
    assert.ok(identity(row.id), 'nonnegative safe exchange identity required');
    if (own(row, 'op')) {
      assert.ok(typeof row.op === 'string' && row.op.length > 0, 'worker operation required');
      assert.ok(!['ok', 'result', 'error'].some(key => own(row, key)), 'ambiguous worker request');
      assert.equal(pending, null, 'worker request before previous response');
      assert.equal(closeRequest, null, 'worker request after close');
      assert.ok(!ids.has(row.id), 'reused worker request identity');
      ids.add(row.id); pending = row;
      if (row.op === 'close') closeRequest = row;
    } else {
      assert.ok(['ok', 'result', 'error'].some(key => own(row, key)), 'worker response required');
      if (own(row, 'ok')) assert.equal(typeof row.ok, 'boolean', 'worker response ok must be boolean');
      assert.ok(pending, 'worker response without request');
      assert.equal(row.id, pending.id, 'worker response identity differs');
      if (pending === closeRequest) closeReply = row;
      pending = null;
    }
  }
  if (expectExit) assert.equal(pending, null, 'worker exit before response');
  if (expectExit || requireSuccessfulCloseExchange) {
    assert.ok(closeRequest && closeReply && closeReply.result?.closed === true, 'worker close exchange missing');
    if (requireSuccessfulCloseExchange) assert.equal(closeReply.ok, true, 'worker successful close exchange missing');
  }
  return Object.freeze({ pid, receipt, exit });
}
