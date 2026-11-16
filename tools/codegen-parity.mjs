#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertCanonicalPath } from '../lib/verification/files.mjs';
import { compareCodegenParity, isWithinRoot, recheckCodegenParity } from '../lib/verification/codegen-parity.mjs';

const HELP = `Usage: node tools/codegen-parity.mjs --expected <root> --actual <root> --scope <json> [--report <absent-file>]
       node tools/codegen-parity.mjs --help

Requires Node >=22.13.0. All option paths must be canonical absolute paths.
Roots must be distinct, non-overlapping, owned/idle directories, without symlinks,
hardlinked files or mount aliases. No mount aliases is a caller precondition;
this tool does not perform platform-wide mount detection (including on Darwin).
All files, including hidden files, are inventoried; no ignores.

Scope JSON (strict UTF-8, unknown/duplicate keys rejected):
  {"schemaVersion":"truthsrc.codegen-parity-scope/v1",
   "paths":["app/Example.scala"],"expectedOnly":[],"actualOnly":[]}
All three arrays are required and mutually disjoint; paths must be nonempty.
Entries are safe relative slash-separated file paths, without duplicates or
case/Unicode aliases. Predeclare the complete inventories before comparison:
  expected inventory = paths + expectedOnly
  actual inventory   = paths + actualOnly
The *Only arrays declare ancillary outputs/receipts, NOT compared parity files.
Optional sourcePins: [{"file":"/absolute/source","sha256":"<lowercase SHA-256>","bytes":123}].
Pins are checked before and after comparison; omission makes no source-pin claim.

Only raw Buffer.equals decides file equality: no trim, decoding or normalization.
Scope and each present scope.path are bounded to 8 MiB, even with a missing peer.
Differing pairs together are limited to 16 MiB raw input (both sides, binary too).
Conservative complete report JSON is limited to 64 MiB, including metadata and
escaped diffs; a conservative estimate may block a smaller actual report.
Any exceeded limit blocks the WHOLE comparison, never skips or truncates files.
JSON stdout includes complete inventories, paths, sizes, hashes and differences.
Different files include a zero-based first-byte offset, hex context (null = EOF),
and a complete non-minimal unified text diff. Binary/non-UTF-8 files use hex only.
Diagnostics/diffs also go to stderr. This checks scope.paths, NOT whole-project
parity or generator correctness. Rechecks detect drift, but do not lock inputs.

--report writes the same JSON to a NEW file, outside both roots, in an existing
canonical directory; never overwrites. Invalid inputs do not write a report.
After writing, inventories, root identities and source/scope pins are rechecked
against the SAME comparison snapshot. Failed writes/rechecks leave any newly
created report in place as INVALID evidence. stdout/stderr I/O failures (including
EPIPE) also exit 2. A report or stdout with status=equal is NOT a PASS receipt when
the invocation fails I/O/recheck: only successful exit 0 signs scoped byte parity.
No positional arguments, unknown/duplicate flags, or --flag=value syntax.
--help (-h) must be used alone.
Exit codes: 0 = scoped bytes equal; 1 = bytes/inventory differ; 2 = blocked input/I/O.
`;

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index] === '-h' ? '--help' : argv[index];
    assert.ok(['--expected', '--actual', '--scope', '--report', '--help'].includes(flag), 'unknown argument: ' + flag);
    assert.ok(!Object.hasOwn(options, flag), 'duplicate flag: ' + flag);
    if (flag === '--help') options[flag] = true;
    else {
      const value = argv[++index];
      assert.ok(typeof value === 'string' && value.length > 0 && !value.startsWith('--'), 'missing value for ' + flag);
      options[flag] = value;
    }
  }
  if (options['--help']) assert.equal(Object.keys(options).length, 1, '--help must be used alone');
  else for (const flag of ['--expected', '--actual', '--scope']) assert.ok(options[flag], 'required flag: ' + flag);
  return options;
}

// Writable errors can arrive after the normal 0/1 result has been assigned.
// Keep listeners installed through stream drain, and never downgrade a failure.
let blocked = false, retainedReport;
function fail(error, channel = '') {
  blocked = true;
  process.exitCode = 2;
  const invalid = retainedReport === undefined ? '' :
    `\ncodegen-parity: INVALID report retained at ${retainedReport}; its status is NOT a PASS receipt (exit 2).`;
  // Synchronous best effort avoids recursive async stderr errors. A broken
  // stderr cannot deliver a diagnostic, but must still result in exit 2.
  try {
    fs.writeSync(2, `codegen-parity: blocked: ${channel}${error.code ? error.code + ': ' : ''}${error.message}${invalid}\n`);
  } catch { /* Preserve exit 2 even when stderr itself is unavailable. */ }
}
process.stdout.on('error', error => fail(error, 'stdout I/O: '));
process.stderr.on('error', error => fail(error, 'stderr I/O: '));

try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  assert.ok(major > 22 || major === 22 && minor >= 13, 'Node >=22.13.0 required');
  const options = parseArgs(process.argv.slice(2));
  if (options['--help']) process.stdout.write(HELP);
  else {
    const expectedRoot = options['--expected'], actualRoot = options['--actual'], reportFile = options['--report'];
    const checkReport = () => {
      if (reportFile === undefined) return;
      assertCanonicalPath(reportFile, { kind: 'new' });
      assert.ok(!isWithinRoot(expectedRoot, reportFile) && !isWithinRoot(actualRoot, reportFile), 'report must be outside both comparison roots');
    };
    checkReport();
    const report = compareCodegenParity({ expectedRoot, actualRoot, scopeFile: options['--scope'] });
    const json = JSON.stringify(report, null, 2) + '\n';
    if (reportFile !== undefined) {
      checkReport();
      const fd = fs.openSync(reportFile, 'wx', 0o600);
      retainedReport = reportFile;
      try { fs.writeFileSync(fd, json); }
      finally { fs.closeSync(fd); }
      recheckCodegenParity(report);
      assertCanonicalPath(reportFile, { kind: 'file' });
    }
    process.stdout.write(json);
    for (const [side, set] of Object.entries(report.membership)) {
      for (const file of set.missing) process.stderr.write(`${side}: missing ${file}\n`);
      for (const file of set.unexpected) process.stderr.write(`${side}: unexpected ${file}\n`);
    }
    for (const file of report.files) if (file.status === 'different') {
      const first = file.firstDifference;
      process.stderr.write(`${file.path}: first different byte at offset ${first.offset} (expected ${first.expected.byte ?? 'EOF'}, actual ${first.actual.byte ?? 'EOF'})\n`);
      for (const side of ['expected', 'actual']) process.stderr.write(`  ${side} [${first[side].start},${first[side].end}): ${first[side].hex}\n`);
      process.stderr.write(file.unifiedDiff ?? file.textDiffUnavailable + '\n');
    }
    if (!blocked) process.exitCode = report.status === 'equal' ? 0 : 1;
  }
} catch (error) {
  fail(error);
}
