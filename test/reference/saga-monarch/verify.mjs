import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { privateOutput, files, hash, jvmCompilerSession, acceptance } from '../compiler-tools.mjs';
import { acquireFileLease } from '../../../lib/verification/lease.mjs';

export const referenceRoot = path.dirname(fileURLToPath(import.meta.url));
export const journalPin = Object.freeze({
  path: '/Users/zhongdj/Workspaces/mad-polaris/monarch-persistence/src/test/scala/net/imadz/monarch/persistence/SerializedValidationJournal.scala',
  sha256: '45d030d264d011dfa92ddd6fe18b7e67ea8b355c486e1c1a50d1b0fcd312f2be',
});
export function classpaths(cp) {
  const unique = xs => [...new Set(xs)];
  const test = unique([...cp.runtime, ...cp.testLibraries, ...cp.actorTestLibraries]);
  assert(test.filter(p => /\/(?:scalatest|scalactic)[^/]*\/\d/.test(p)).every(p => p.includes('/3.2.15/')),
    'mixed ScalaTest supply is not allowed');
  return { runtime: cp.runtime, test, kernel: cp.compiler.filter(p => /\/scala-library\/2\.13\.14\//.test(p)) };
}
export function expectedFailure(result, expected) {
  const output = (result.stdout ?? '') + '\n' + (result.stderr ?? '');
  const environmentError = acceptance(result).environmentError;
  const crash = expected.caseId === 'PARTICIPANT-ACK' && result.status === 73 &&
    /^EXPECTED_CRASH PARTICIPANT-ACK durable-before-ack$/m.test(output);
  const mutation = expected.caseId === 'IDENTITY-MISMATCH' && result.status === 1 &&
    /RUN-IDENTITY:.*\*\*\* FAILED \*\*\*/.test(output) && /was false/.test(output) &&
    /Total number of tests run: 1\s/.test(output) &&
    /Tests: succeeded 0, failed 1, canceled 0, ignored 0, pending 0/.test(output) &&
    /Suites: completed 1, aborted 0/.test(output);
  return { accepted: !result.error && result.signal === null && !environmentError && (crash || mutation), environmentError };
}
export async function verifyReference({ round, out, compileOnly = false }) {
  assert(!process.env.NODE_TEST_CONTEXT, 'default test discovery must not execute JVM');
  const js = path.resolve(referenceRoot, '../../..');
  const cp = JSON.parse(fs.readFileSync(path.join(round, 'supply-classpaths.json')));
  const pins = new Map(JSON.parse(fs.readFileSync(path.join(round, 'supply-inputs.json'))).map(r => [r.path, r.sha256]));
  const paths = classpaths(cp);
  assert.equal(hash(journalPin.path), journalPin.sha256, 'fixed journal changed');
  const runtimeInputs = [...new Set([cp.java, cp.sandbox, ...cp.compiler, ...paths.test, journalPin.path])];
  for (const input of runtimeInputs) assert.equal(hash(input), pins.get(input), 'unrecorded or changed supply: ' + input);
  const sources = files(referenceRoot).filter(p => p.endsWith('.scala'));
  const before = [...sources, fileURLToPath(import.meta.url)].map(p => ({ path: p, sha256: hash(p) }));
  const ps = spawnSync('/bin/ps', ['-axo', 'pid,ppid,pgid,comm'], { encoding: 'utf8' });
  assert.equal(ps.status, 0);
  const processes = ps.stdout.trim().split('\n').slice(1).map(line => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/); assert(match);
    return { pid: +match[1], ppid: +match[2], pgid: +match[3], comm: match[4] };
  });
  assert(!processes.some(p => /(?:^|\/)java$/.test(p.comm)), 'unowned JVM present; no signals or takeover');
  const stat = fs.statfsSync('/private/tmp'); assert(stat.bavail * stat.bsize > 2304 * 1024 * 1024, 'disk reserve insufficient');
  const registry = path.join(js, '.rounds/shared-jvm-leases');
  assert(!fs.existsSync(path.join(registry, 'jvm-slot')), 'common JVM lease occupied');
  const io = privateOutput(out, [js, ...runtimeInputs]);
  io.json('inputs.json', { sources: before, supply: runtimeInputs.map(p => ({ path: p, sha256: pins.get(p) })), classpaths: paths,
    journalPin, constraints: { network: 'deny network*', xmx: '512m', cpu: 2, timeoutMs: 120000 }, processes });
  let lease, session;
  const result = { passed: false, completeB: false, out, tests: 0, phases: [], leaseReleased: false };
  try {
    const record = { owner: 'REFERENCE-SHELL', pid: process.pid, runId: path.basename(out), round, out, token: randomUUID() };
    lease = await acquireFileLease({ registry, lockNames: ['jvm-slot'], record }); io.json('lease-acquired.json', record);
    session = jvmCompilerSession(io, cp, { suiteRejectionAcceptance: expectedFailure });
    const classes = Object.fromEntries(['kernel', 'glue', 'ext', 'root', 'fixture', 'oracle'].map(m => [m, io.directory('classes/' + m)]));
    const src = module => sources.filter(p => p.startsWith(referenceRoot + '/' + module + '/'));
    await session.compile('kernel', src('kernel'), paths.kernel, classes.kernel);
    await session.compile('glue', src('glue'), [classes.kernel, ...paths.runtime], classes.glue);
    await session.compile('ext', src('ext'), [classes.kernel, ...paths.kernel], classes.ext);
    await session.compile('root', src('root'), [classes.kernel, classes.glue, ...paths.runtime], classes.root);
    const bad = io.write('negative/KernelMustNotDependOnAkka.scala',
      'final class KernelMustNotDependOnAkka { val system: akka.actor.ActorSystem = null }\n');
    await session.compile('module-negative', [bad], [classes.kernel, ...paths.kernel], io.directory('classes/negative'),
      { kind: 'compiler-rejection', file: 'KernelMustNotDependOnAkka.scala', symbol: 'akka', diagnostics: [/not found: (?:value|object) akka/] });
    if (!compileOnly) {
      const copiedFixture = io.write('fixture/SerializedValidationJournal.scala', fs.readFileSync(journalPin.path));
      await session.compile('fixture', [copiedFixture], paths.test, classes.fixture);
      const production = [classes.kernel, classes.glue, classes.ext, classes.root];
      await session.compile('oracle', src('oracle'), [...production, classes.fixture, ...paths.test], classes.oracle);
      const data = io.directory('oracle-data');
      await session.jvm('oracle-tests', ['-Dinventory.oracle.directory=' + data, '-cp',
        [classes.oracle, classes.fixture, ...production, ...paths.test].join(':'), 'org.scalatest.tools.Runner',
        '-oW', '-s', 'reference.inventory.oracle.InventoryOracle'],
        { kind: 'suites', tests: 18, suites: ['reference.inventory.oracle.InventoryOracle'] });
      result.tests = 18;
      const recovery = io.directory('recovery-data');
      const recoveryArgs = ['-cp', [classes.oracle, classes.fixture, ...production, ...paths.test].join(':'),
        'reference.inventory.oracle.RecoveryOracle'];
      await session.jvm('participant-ack-crash', [...recoveryArgs, 'crash', recovery],
        { kind: 'suite-rejection', caseId: 'PARTICIPANT-ACK' });
      await session.jvm('participant-ack-recover', [...recoveryArgs, 'recover', recovery],
        { kind: 'success', pattern: /^RECOVERY_PASS PARTICIPANT-ACK original-identities authorized-forward$/m });
      const durableBefore = files(recovery).map(p => ({ path: p, sha256: hash(p) }));
      await session.jvm('third-read', [...recoveryArgs, 'read', recovery],
        { kind: 'success', pattern: /^RECOVERY_PASS THIRD-READ inert-terminal$/m });
      assert.deepEqual(files(recovery).map(p => ({ path: p, sha256: hash(p) })), durableBefore,
        'third replay/query produced durable writes or additional external effects');
      result.recovery = { windows: 1, jvmPhases: 3, thirdReadUnchanged: true };
      const runSource = fs.readFileSync(path.join(referenceRoot, 'glue/PublicRuntime.scala'), 'utf8');
      const condition = 'v.identity.contains(expected(submission)) && v.runId.contains(submission.runId)';
      assert.equal(runSource.split(condition).length, 2, 'mutation point missing or ambiguous');
      const mutant = io.write('mutation/PublicRuntime.scala', runSource.replace(condition, 'v.runId.contains(submission.runId)'));
      const mutantClasses = io.directory('classes/mutant');
      await session.compile('identity-mutant', [mutant], [classes.kernel, ...paths.runtime], mutantClasses);
      await session.jvm('identity-negative', ['-Dinventory.oracle.directory=' + io.directory('mutation-data'), '-cp',
        [classes.oracle, classes.fixture, mutantClasses, ...production, ...paths.test].join(':'), 'org.scalatest.tools.Runner',
        '-oW', '-s', 'reference.inventory.oracle.InventoryOracle', '-z', 'RUN-IDENTITY:'],
        { kind: 'suite-rejection', caseId: 'IDENTITY-MISMATCH' });
      result.negativeControls = { compiled: 1, behavior: 1 };
    }
    for (const input of before) assert.equal(hash(input.path), input.sha256, 'reference input changed during run');
    lease.assertHeld(); result.passed = true;
    result.note = 'Targeted reference gate only; mandatory cases and cross-JVM recovery remain pending.';
  } catch (error) { result.error = error.message; }
  finally {
    result.phases = session?.runs ?? [];
    if (lease) { lease.release(); result.leaseReleased = true; io.json('lease-released.json', { released: true }); }
    io.json('result.json', result);
  }
  return result;
}
if (!process.env.NODE_TEST_CONTEXT && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2); assert(args.length === 4 && args[0] === '--round' && args[2] === '--out');
  const result = await verifyReference({ round: args[1], out: args[3] });
  console.log(JSON.stringify({ passed: result.passed, completeB: result.completeB, tests: result.tests, out: result.out,
    phases: result.phases.map(p => ({ label: p.label, accepted: p.accepted, exitCode: p.exitCode })), error: result.error, leaseReleased: result.leaseReleased }));
  if (!result.passed) process.exitCode = 1;
}
