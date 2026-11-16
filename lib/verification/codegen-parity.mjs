import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { copyImmutableData } from '../immutable-data.mjs';
import { parseStrictJson } from '../strict-json.mjs';
import { assertCanonicalPath, captureEvidenceFile } from './files.mjs';
import { compareEvidenceInventories, createEvidenceReferences, inventoryEvidence } from './inventory.mjs';

export const CODEGEN_PARITY_SCOPE_VERSION = 'truthsrc.codegen-parity-scope/v1';
const DIFF_INPUT_LIMIT = 16 * 1024 * 1024;
const REPORT_JSON_LIMIT = 64 * 1024 * 1024;
const rechecks = new WeakMap();
const fold = value => value.normalize('NFC').toLowerCase();
const fingerprint = ({ bytes, sha256 }) => ({ bytes, sha256 });
const rootIdentity = root => {
  const stat = fs.lstatSync(root);
  return [stat.dev, stat.ino, stat.mode, stat.uid, stat.gid];
};

export function isWithinRoot(root, file) {
  const relative = path.relative(root, file);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}

function relativeFile(file) {
  assert.ok(typeof file === 'string' && file.length > 0 && file.isWellFormed() &&
    !/[\x00-\x1f\x7f-\x9f\\]/u.test(file) && !path.posix.isAbsolute(file) && !path.win32.isAbsolute(file),
  'safe relative slash-separated scope path required');
  const parts = file.split('/');
  assert.ok(parts.every(part => part && part !== '.' && part !== '..' &&
    !/[<>:"|?*]|[. ]$/u.test(part) && !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])\s*(?:\.|$)/iu.test(part)),
  'unsafe or aliased scope path: ' + file);
}

function validateScope(input) {
  const scope = copyImmutableData(input);
  assert.ok(scope && !Array.isArray(scope) && typeof scope === 'object', 'scope must be an object');
  const allowed = ['schemaVersion', 'paths', 'expectedOnly', 'actualOnly', 'sourcePins'];
  assert.ok(Object.keys(scope).every(key => allowed.includes(key)), 'unknown scope field');
  assert.equal(scope.schemaVersion, CODEGEN_PARITY_SCOPE_VERSION, 'unsupported scope schemaVersion');
  const seen = new Set();
  for (const key of ['paths', 'expectedOnly', 'actualOnly']) {
    assert.ok(Array.isArray(scope[key]), 'explicit scope.' + key + ' array required');
    for (const file of scope[key]) {
      relativeFile(file);
      assert.ok(!seen.has(fold(file)), 'duplicate or aliased scope path across partitions: ' + file);
      seen.add(fold(file));
    }
  }
  assert.ok(scope.paths.length > 0, 'scope.paths must be nonempty');
  for (const files of [[...scope.paths, ...scope.expectedOnly], [...scope.paths, ...scope.actualOnly]]) {
    const spellings = new Map(), leaves = new Set(files.map(fold));
    for (const file of files) {
      const parts = file.split('/');
      for (let count = 1; count <= parts.length; count++) {
        const prefix = parts.slice(0, count).join('/'), key = fold(prefix);
        assert.ok(!spellings.has(key) || spellings.get(key) === prefix, 'scope directory spelling alias: ' + prefix);
        assert.ok(count === parts.length || !leaves.has(key), 'scope file/directory conflict: ' + prefix);
        spellings.set(key, prefix);
      }
    }
  }
  if (Object.hasOwn(scope, 'sourcePins')) assert.ok(Array.isArray(scope.sourcePins), 'scope.sourcePins must be an array');
  const pins = new Set();
  for (const pin of scope.sourcePins ?? []) {
    assert.ok(pin && typeof pin.file === 'string', 'source pin file required');
    assert.ok(!pins.has(fold(pin.file)), 'duplicate or aliased source pin: ' + pin.file);
    pins.add(fold(pin.file));
  }
  return scope;
}

function membership(inventory, declarations) {
  const declared = new Set(declarations), found = new Set(Object.keys(inventory).map(file => file.split(path.sep).join('/')));
  return {
    missing: declarations.filter(file => !found.has(file)).sort(),
    unexpected: [...found].filter(file => !declared.has(file)).sort(),
  };
}

function firstDifference(expected, actual) {
  let offset = 0;
  while (offset < Math.min(expected.length, actual.length) && expected[offset] === actual[offset]) offset++;
  const context = bytes => {
    const start = Math.max(0, offset - 16), end = Math.min(bytes.length, offset + 17);
    return {
      byte: offset < bytes.length ? bytes[offset].toString(16).padStart(2, '0') : null,
      start, end, hex: bytes.subarray(start, end).toString('hex'),
    };
  };
  return { offset, expected: context(expected), actual: context(actual) };
}

// Reserve before constructing diff strings or serializing the whole report.
// Metadata strings cost at most six JSON bytes per UTF-8 byte. The per-node
// allowance covers two-space indentation, punctuation and scalar values.
function reportBudget() {
  let bytes = 1; // final newline
  const reserve = count => {
    bytes += count;
    assert.ok(bytes <= REPORT_JSON_LIMIT, 'cumulative conservative report JSON exceeds 64 MiB');
  };
  const json = (value, depth = 0) => {
    reserve(32 + 4 * depth);
    if (typeof value === 'string') reserve(6 * Buffer.byteLength(value));
    else if (Array.isArray(value)) for (const item of value) json(item, depth + 1);
    else if (value !== null && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
      json(key, depth + 1);
      json(item, depth + 1);
    }
  };
  return { reserve, json };
}

// Valid UTF-8 text keeps its byte length in JSON except ASCII escapes. Add a
// conservative sign/newline allowance per row, including an unterminated row.
// Counting avoids allocating an escaped copy or millions of lines before gating.
function diffBodyJsonBound(bytes) {
  let size = 3;
  for (const byte of bytes) {
    size += byte < 32 ? ([8, 9, 10, 12, 13].includes(byte) ? 2 : 6) : byte === 34 || byte === 92 ? 2 : 1;
    if (byte === 10) size += 3;
  }
  return size;
}

// A single full-replacement hunk is deliberately non-minimal, but complete and
// linear in input size. UTF-8 decoding is diagnostic only; preserve BOM and CR.
function textDiff(file, expected, actual, budget) {
  let before, after;
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
    before = decoder.decode(expected);
    after = decoder.decode(actual);
  } catch { return { unifiedDiff: null, textDiffUnavailable: 'non-UTF-8 bytes; use byte offset, hex and hashes' }; }
  if (before.includes('\0') || after.includes('\0'))
    return { unifiedDiff: null, textDiffUnavailable: 'NUL-containing binary data; use byte offset, hex and hashes' };
  // Two escaped path headers, range headers, EOF markers and string quotes.
  budget.reserve(12 * Buffer.byteLength(file) + 512 + diffBodyJsonBound(expected) + diffBodyJsonBound(actual));
  const lines = text => text === '' ? [] : (text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n'));
  const oldLines = lines(before), newLines = lines(after);
  const range = count => count === 0 ? '0,0' : '1,' + count;
  const body = (text, rows, sign) => rows.map(line => sign + line + '\n').join('') +
    (text !== '' && !text.endsWith('\n') ? '\\ No newline at end of file\n' : '');
  return { unifiedDiff: `--- expected/${file}\n+++ actual/${file}\n@@ -${range(oldLines.length)} +${range(newLines.length)} @@\n` +
    body(before, oldLines, '-') + body(after, newLines, '+') };
}

/**
 * Canonical absolute input paths; no writes. Missing/extra files are differences,
 * malformed declarations, unsafe inputs, pin failures and observed drift throw.
 * Every file is inventoried (no hidden-file/exclusion policy); only scope.paths
 * is compared. Every present scope.path is captured, even if its peer is missing.
 * Captures use the existing 8 MiB per file / scope limit. Differing pairs together
 * admit at most 16 MiB raw input; conservative report JSON is capped at 64 MiB.
 * Rechecks detect observed drift, not an atomic snapshot: callers own both roots
 * and must exclude mount aliases. No platform-wide mount detection is attempted.
 */
export function compareCodegenParity(input) {
  const options = copyImmutableData(input);
  assert.ok(options && !Array.isArray(options) && typeof options === 'object', 'comparison options required');
  assert.deepEqual(Object.keys(options).sort(), ['actualRoot', 'expectedRoot', 'scopeFile'], 'exact comparison options required');
  const { expectedRoot, actualRoot, scopeFile } = options;
  assertCanonicalPath(expectedRoot);
  assertCanonicalPath(actualRoot);
  assert.ok(!isWithinRoot(expectedRoot, actualRoot) && !isWithinRoot(actualRoot, expectedRoot), 'expected and actual roots overlap');
  const identities = [rootIdentity(expectedRoot), rootIdentity(actualRoot)];
  assert.notDeepEqual(identities[0].slice(0, 2), identities[1].slice(0, 2), 'expected and actual roots alias');

  const references = createEvidenceReferences();
  const capturedScope = captureEvidenceFile(scopeFile);
  references.retain({ file: scopeFile, ...fingerprint(capturedScope) });
  const scope = validateScope(parseStrictJson(capturedScope.value));
  for (const pin of scope.sourcePins ?? []) references.retain(pin);
  references.assertUnchanged();

  const expected = inventoryEvidence(expectedRoot), actual = inventoryEvidence(actualRoot);
  const sets = {
    expected: membership(expected, [...scope.paths, ...scope.expectedOnly]),
    actual: membership(actual, [...scope.paths, ...scope.actualOnly]),
  };
  const inventoryRows = (entries, only) => Object.entries(entries).map(([key, value]) => {
    const file = key.split(path.sep).join('/');
    return { path: file, ...value, partition: scope.paths.includes(file) ? 'compared' : only.includes(file) ? 'ancillary' : 'unregistered' };
  });
  const files = [], budget = reportBudget();
  const report = {
    schemaVersion: 'truthsrc.codegen-parity-report/v1',
    status: 'different',
    claim: 'Byte parity covers only scope.paths, not the whole project. Ancillary files are inventoried, not compared. Generation correctness is not assessed.',
    expectedRoot, actualRoot,
    scope: { file: scopeFile, ...fingerprint(capturedScope), definition: scope },
    sourcePins: { status: scope.sourcePins?.length ? 'verified' : 'not-requested', files: scope.sourcePins ?? [] },
    counts: {
      comparedPaths: scope.paths.length,
      equalFiles: 0,
      differentFiles: 0,
      unavailableFiles: 0,
      expectedInventoryFiles: Object.keys(expected).length,
      actualInventoryFiles: Object.keys(actual).length,
      expectedOnly: scope.expectedOnly.length,
      actualOnly: scope.actualOnly.length,
    },
    membership: sets,
    inventories: { expected: inventoryRows(expected, scope.expectedOnly), actual: inventoryRows(actual, scope.actualOnly) },
    files,
  };
  budget.json(report);
  let diffInputBytes = 0;
  for (const file of scope.paths) {
    const expectedFile = path.join(expectedRoot, ...file.split('/'));
    const actualFile = path.join(actualRoot, ...file.split('/'));
    // Inventories use native relative separators; scope and reports use '/'.
    const key = file.split('/').join(path.sep);
    const left = Object.hasOwn(expected, key) ? expected[key] : null;
    const right = Object.hasOwn(actual, key) ? actual[key] : null;
    const row = {
      path: file,
      expected: left && { file: expectedFile, ...left },
      actual: right && { file: actualFile, ...right },
    };
    const a = left && captureEvidenceFile(expectedFile), b = right && captureEvidenceFile(actualFile);
    if (a) assert.deepEqual(fingerprint(a), left, 'expected changed since inventory: ' + file);
    if (b) assert.deepEqual(fingerprint(b), right, 'actual changed since inventory: ' + file);
    if (!a || !b) row.status = 'unavailable';
    else if (a.value.equals(b.value)) row.status = 'equal';
    else {
      // Include binary differing pairs too; no decoding-dependent bypass.
      diffInputBytes += a.bytes + b.bytes;
      assert.ok(diffInputBytes <= DIFF_INPUT_LIMIT, 'cumulative differing-pair raw input exceeds 16 MiB');
      row.status = 'different';
      row.firstDifference = firstDifference(a.value, b.value);
      Object.assign(row, textDiff(file, a.value, b.value, budget));
    }
    // A text diff has already reserved its escaped size before construction.
    budget.json(Object.hasOwn(row, 'unifiedDiff') ? { ...row, unifiedDiff: null } : row, 2);
    files.push(row);
    report.counts[row.status === 'equal' ? 'equalFiles' : row.status === 'different' ? 'differentFiles' : 'unavailableFiles']++;
  }
  if (files.every(file => file.status === 'equal') &&
    Object.values(sets).every(set => set.missing.length === 0 && set.unexpected.length === 0)) report.status = 'equal';

  const recheck = () => {
    compareEvidenceInventories(expected, inventoryEvidence(expectedRoot));
    compareEvidenceInventories(actual, inventoryEvidence(actualRoot));
    assert.deepEqual([rootIdentity(expectedRoot), rootIdentity(actualRoot)], identities, 'comparison root replaced');
    references.assertUnchanged();
  };
  recheck();
  rechecks.set(report, recheck);
  return report;
}

// Reuse the original inventories, root identities and retained source/scope pins;
// a fresh comparison could bless drift (including a report written via an alias).
export function recheckCodegenParity(report) {
  const recheck = rechecks.get(report);
  assert.ok(recheck, 'original comparison report required for recheck');
  recheck();
}
