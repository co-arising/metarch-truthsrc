import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cases, fullBComplete, referenceBComplete } from './reference/saga-monarch/cases.mjs';
import { continuationFailure, mutationAssertions } from './reference/saga-monarch/continuation-outcomes.mjs';
import { classpaths, expectedFailure, journalPin, referenceRoot, verifyReference } from './reference/saga-monarch/verify.mjs';

const read = name => fs.readFileSync(path.join(referenceRoot, name), 'utf8');
test('saga-monarch verifier distinguishes completed reference B from pending public A-F lanes', () => {
  assert.equal(cases.length, 62);
  assert.equal(new Set(cases.map(c => c.id)).size, cases.length);
  assert.deepEqual([...new Set(cases.map(c => c.family))], ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.equal(fullBComplete, false);
  assert.equal(referenceBComplete, true);
  assert.equal(cases.filter(c => ['B', 'C', 'D', 'E'].includes(c.family) && c.coverage === 'covered').length, 42);
  assert(cases.some(c => c.coverage === 'pending'));
  assert.equal(cases.filter(c => c.family === 'D').length, 10);
  assert.equal(cases.filter(c => c.family === 'E').length, 8);
});
test('saga-monarch case pointers name real independent oracle assertions', () => {
  const oracle = read('oracle/InventoryOracle.scala');
  for (const entry of cases) {
    for (const name of entry.tests) assert(oracle.includes(`test("${name}`), entry.id + ': missing ' + name);
    for (const assertion of entry.assertions) {
      const source = read(assertion.source);
      for (const name of assertion.tests) assert(source.includes(`test("${name}`), entry.id + ': missing ' + name);
      for (const window of entry.windows) assert(source.includes('"' + window + '"'), entry.id + ': missing window ' + window);
    }
  }
  for (const name of ['verify.mjs', 'oracle/InventoryOracle.scala', 'oracle/RecoveryOracle.scala',
    'oracle/R2Support.scala', 'oracle/R2Oracle.scala', 'oracle/RecoveryMatrix.scala', 'oracle/MutationOracle.scala', 'oracle/RetryRestartOracle.scala']) {
    assert(!/from\s+['"][^'"]*generators\//.test(read(name)));
    assert(!/buildModels|renderJobs/.test(read(name)));
  }
});
test('saga-monarch coherent test supply rejects mixed ScalaTest versions', () => {
  const cp = { runtime: ['runtime.jar'], compiler: ['/scala-library/2.13.14/scala-library.jar'],
    testLibraries: ['/org/scalatest/scalatest-core_2.13/3.2.15/a.jar'], actorTestLibraries: ['runtime.jar'] };
  assert.deepEqual(classpaths(cp).test, ['runtime.jar', cp.testLibraries[0]]);
  assert.throws(() => classpaths({ ...cp, testLibraries: ['/org/scalatest/scalatest-core_2.13/3.2.19/a.jar'] }), /mixed ScalaTest/);
  assert.equal(journalPin.sha256, '45d030d264d011dfa92ddd6fe18b7e67ea8b355c486e1c1a50d1b0fcd312f2be');
});
test('saga-monarch intended failure requires its exact assertion not arbitrary exit or timeout', () => {
  const result = { status: 73, signal: null, error: null, stdout: 'EXPECTED_CRASH PARTICIPANT-ACK durable-before-ack\n', stderr: '' };
  assert(expectedFailure(result, { caseId: 'PARTICIPANT-ACK' }).accepted);
  assert(!expectedFailure({ ...result, status: 1 }, { caseId: 'PARTICIPANT-ACK' }).accepted);
  assert(!expectedFailure({ ...result, error: { code: 'TIMEOUT' } }, { caseId: 'PARTICIPANT-ACK' }).accepted);
  assert(!expectedFailure({ ...result, stderr: 'ClassNotFoundException' }, { caseId: 'PARTICIPANT-ACK' }).accepted);
  assert(!expectedFailure({ ...result, status: 1, stdout: 'unrelated failed test' }, { caseId: 'IDENTITY-MISMATCH' }).accepted);
  const mutation = { ...result, status: 1, stdout: '- RUN-IDENTITY: six fields *** FAILED ***\ncondition was false\nTotal number of tests run: 1\nTests: succeeded 0, failed 1, canceled 0, ignored 0, pending 0\nSuites: completed 1, aborted 0\n' };
  assert(expectedFailure(mutation, { caseId: 'IDENTITY-MISMATCH' }).accepted);
});
test('saga-monarch kernel and external implementation retain module direction', () => {
  for (const name of ['kernel/Inventory.scala', 'kernel/BinaryCodecs.scala', 'ext/FileInventoryPorts.scala']) {
    assert(!/^import\s+(?:akka|com\.google\.protobuf|net\.imadz|reference\.inventory\.(?:glue|root|oracle))/m.test(read(name)), name);
  }
  assert(read('root/InventoryApplication.scala').includes('case SystemOwnership.CallerOwned => Future.successful(())'));
  assert(read('glue/InventoryWorkflow.scala').includes('extends WorkflowProgram'));
});
test('saga-monarch continuation controls accept only exact compiled-mutant assertions', () => {
  for (const [caseId, marker] of Object.entries(mutationAssertions)) {
    for (const detail of ['condition was false', 'value.terminal was true', '2 did not equal 1', 'Released("id") was not instance of Resource.Rejected']) {
      const stdout = `- ${marker}: independent condition *** FAILED ***\n  ${detail} ${marker} (MutationOracle.scala:44)\nTotal number of tests run: 1\nTests: succeeded 0, failed 1, canceled 0, ignored 0, pending 0\nSuites: completed 1, aborted 0\n`;
      const result = { status: 1, signal: null, error: null, stdout, stderr: '' };
      const expected = { family: 'mutation', caseId };
      assert(continuationFailure(result, expected).accepted, caseId);
      for (const delta of [{ status: 0 }, { error: { code: 'TIMEOUT' } }, { signal: 'SIGKILL' },
        { stderr: 'ClassNotFoundException' }, { stdout: stdout.replace(` ${marker} (MutationOracle.scala:44)`, ' unrelated assertion') },
        { stdout: stdout.replace('aborted 0', 'aborted 1') }, { stdout: stdout.replace('tests run: 1', 'tests run: 2') }]) {
        assert(!continuationFailure({ ...result, ...delta }, expected).accepted, caseId + JSON.stringify(delta));
      }
    }
  }
});
test('saga-monarch retry force fault remains a failed process independently classified', () => {
  const result = { status: 77, signal: null, error: null, stdout: 'EXPECTED_RETRY_FORCE_BEFORE_ACK code=77\n', stderr: '' };
  assert(continuationFailure(result, { family: 'retry-restart' }).accepted);
  assert(!continuationFailure({ ...result, status: 0 }, { family: 'retry-restart' }).accepted);
  assert(!continuationFailure({ ...result, error: { code: 'TIMEOUT' } }, { family: 'retry-restart' }).accepted);
  assert(!continuationFailure(result, { family: 'mutation', caseId: 'DROP-ITEM' }).accepted);
});
test('saga-monarch recovery fixtures retain forced files and the fixed journal hooks', () => {
  const matrix = read('oracle/RecoveryMatrix.scala'); const support = read('oracle/R2Support.scala');
  assert(matrix.includes('pending.fail(') && matrix.includes('SerializedValidationJournal.forceMarkers.put'));
  assert(support.includes('channel.force(true)'));
  assert(support.includes('akka.persistence.snapshot-store.plugin = "akka.persistence.no-snapshot-store"'));
  for (const source of [matrix, support, read('oracle/RetryRestartOracle.scala')]) {
    assert(!/SerializedValidationJournal\.(?:clear|storage)|TRUNCATE_EXISTING|Files\.delete|TrieMap/.test(source));
  }
});
test('saga-monarch default Node discovery never starts a JVM or creates output', async () => {
  await assert.rejects(verifyReference({ round: '/must-not-read', out: '/must-not-create' }), /default test discovery must not execute JVM/);
});
