// Read-only admission gate. An independent shell captures the lock AFTER these
// tests were implemented; the main reviewer pins its hash BEFORE any execution.
// This is not, and must never be described as, a pre-implementation oracle freeze.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { absolutePath, files, hash, snapshot, within } from '../compiler-tools.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const oracleLockSchema = 'truthsrc.persistence-readside-oracle-lock/v1';
export const oracleLockStage = 'post-implementation-pre-execution';

// Complete membership, not just the previously known Scala filenames. Also pin
// the local verifier/control/reference helpers that interpret the oracle. No lock
// may live in this tree (which would create a self-referential inventory).
export function oracleLockInventory() {
  const records = snapshot(files(here)).map(row => ({ path: relative(here, row.path), sha256: row.sha256 }));
  return {
    oracle: records.filter(row => row.path.startsWith('oracle/')),
    harnessAndReference: records.filter(row => !row.path.startsWith('oracle/')),
  };
}

export function assertOracleLock(lockPath, expectedSha256) {
  absolutePath(lockPath, '--oracle-lock');
  assert(!within(lockPath, here), 'Independent oracle lock must be outside the reference tree');
  assert.match(expectedSha256 ?? '', /^[a-f0-9]{64}$/, 'Explicit independently reviewed oracle lock SHA-256 required');
  assert.equal(hash(lockPath), expectedSha256, 'Oracle lock differs from the externally fixed pin');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  assert.deepEqual(Object.keys(lock).sort(), ['schemaVersion', 'stage', 'capturedAt', 'inventory'].sort());
  assert.equal(lock.schemaVersion, oracleLockSchema);
  assert.equal(lock.stage, oracleLockStage, 'Do not relabel an implemented oracle as a pre-implementation freeze');
  assert(typeof lock.capturedAt === 'string' && Number.isFinite(Date.parse(lock.capturedAt)), 'Capture time required');
  const current = oracleLockInventory();
  assert(current.oracle.length > 0 && current.harnessAndReference.length > 0, 'Empty oracle/reference inventory');
  assert.deepEqual(current, lock.inventory, 'Complete oracle/reference inventory or hash differs from the reviewed lock');
  assert.equal(hash(lockPath), expectedSha256, 'Oracle lock changed during admission');
  return { path: lockPath, sha256: expectedSha256, schemaVersion: lock.schemaVersion, stage: lock.stage,
    capturedAt: lock.capturedAt, oracleFiles: current.oracle.length, harnessAndReferenceFiles: current.harnessAndReference.length,
    preImplementationFreeze: false, passed: true };
}

// Explicit, zero-child-process preflight; never captures, writes or refreshes pins.
if (!process.env.NODE_TEST_CONTEXT && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [flag, path, shaFlag, sha] = process.argv.slice(2);
  assert(process.argv.length === 6 && flag === '--lock' && shaFlag === '--sha256',
    'Usage: node oracle-lock.mjs --lock /absolute/reviewed-lock.json --sha256 <reviewed-sha256>');
  console.log(JSON.stringify(assertOracleLock(path, sha)));
}
