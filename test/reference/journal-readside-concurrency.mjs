// Explicit pending #169 lane, not R2/family qualification or default Node discovery.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, delimiter, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Same completion predicate as the public runner, independent of exit/acceptance.
// Only processFailureState(error) can attest a thrown pre-spawn failure.
function processStopped(receipt, failure) {
  return receipt ? receipt.directChildClosed === true && receipt.directChildReaped === true &&
    receipt.groupAliveAfter === false && receipt.barrier?.settled === true : failure?.spawnAttempted === false;
}
function settleLease(lease, jobs, abandon) {
  const resourcesStopped = jobs.every(job => job.stopped === true);
  let leaseReleased = false;
  const errors = [];
  if (resourcesStopped) {
    try { lease.release(); leaseReleased = true; } catch (error) { errors.push(error.message); }
  }
  if (!leaseReleased) {
    try { abandon(lease); } catch (error) { errors.push(error.message); }
  }
  return { resourcesStopped, leaseReleased, errors };
}

if (process.env.NODE_TEST_CONTEXT) {
  const { test } = await import('node:test');
  const stopped = { passed: false, code: 1, directChildClosed: true, directChildReaped: true,
    groupAliveAfter: false, barrier: { settled: true } };
  test('lease return accepts a rejected compile only when public cleanup barriers are complete', () => {
    let released = 0, abandoned = 0;
    const result = settleLease({ release() { released++; } }, [{ stopped: processStopped(stopped) }], () => { abandoned++; });
    assert.deepEqual(result, { resourcesStopped: true, leaseReleased: true, errors: [] });
    assert.equal(released, 1); assert.equal(abandoned, 0);
  });
  test('lease return retains the slot on unknown cleanup even after earlier verified phases', () => {
    for (const receipt of [null, {}, { ...stopped, directChildClosed: false }, { ...stopped, directChildReaped: false },
      { ...stopped, groupAliveAfter: true }, { ...stopped, barrier: { settled: false } }]) {
      let abandoned = 0;
      const result = settleLease({ release() { assert.fail('unverified process must retain the slot'); } },
        [{ stopped: true }, { stopped: processStopped(receipt) }], () => { abandoned++; });
      assert.equal(result.leaseReleased, false); assert.equal(result.resourcesStopped, false); assert.equal(abandoned, 1);
    }
  });
  test('thrown process admission permits release only with a public no-spawn attestation', async () => {
    const { runVerifiedProcess, processFailureState } = await import('../../lib/verification/process.mjs');
    await assert.rejects(runVerifiedProcess({}), error => {
      const failure = processFailureState(error);
      assert.deepEqual(failure, { spawnAttempted: false });
      assert.equal(processStopped(null, failure), true);
      return true;
    });
    assert.equal(processStopped(null, processFailureState(new Error('unknown'))), false);
    assert.equal(processStopped(null, { spawnAttempted: true }), false);
  });
  test('lease release failure does not claim the slot was returned', () => {
    let abandoned = 0;
    const result = settleLease({ release() { throw new Error('changed lease'); } }, [], () => { abandoned++; });
    assert.deepEqual(result, { resourcesStopped: true, leaseReleased: false, errors: ['changed lease'] });
    assert.equal(abandoned, 1);
  });
} else {
  const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
  const [mode, round, out, runId, supplyPath, baselinePath] = process.argv.slice(2);
  assert(['capture', 'baseline', 'corrected', 'error-regression', 'node'].includes(mode));
  assert(round && out && /^concurrency-[a-z0-9-]+$/.test(runId));
  for (const path of [round, out, supplyPath]) assert(path && resolve(path) === path);
  const digest = path => createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  const receiptPath = join(round, runId + '.json');
  assert(!fs.existsSync(receiptPath), 'Never overwrite a receipt');
  // Pin the transitive local source actually imported, including the shared process
  // helper. Do not run the unrelated source-pin heavy reference lane.
  const sourcePaths = new Set();
  function imports(path) {
    if (sourcePaths.has(path)) return;
    sourcePaths.add(path);
    const text = fs.readFileSync(path, 'utf8');
    for (const match of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+\.mjs)['"]/g))
      imports(resolve(dirname(path), match[1]));
  }
  for (const relative of ['test/reference/compiler-tools.mjs', 'test/reference/compiler-results.mjs',
    'test/reference/aggregate-core/toolchain.mjs', 'lib/verification/lease.mjs', 'lib/verification/process.mjs',
    'lib/products/compile.mjs', 'lib/products/cli.mjs',
    'generators/scala-cqrs-play-service/render-journal-readside.mjs', 'test/journal-readside-generation.test.mjs']) imports(join(root, relative));
  sourcePaths.add(fileURLToPath(import.meta.url));
  sourcePaths.add(join(here, 'journal-readside-concurrency.scala'));
  function tree(path) {
    for (const entry of fs.readdirSync(path, { withFileTypes: true })) {
      assert(!entry.isSymbolicLink());
      const file = join(path, entry.name);
      if (entry.isDirectory()) tree(file); else sourcePaths.add(file);
    }
  }
  tree(join(root, 'test/fixtures/tickets-domain-v4-products'));
  tree(join(root, 'schema'));
  const pins = [...sourcePaths].sort().map(path => ({ path, sha256: digest(path) }));
  const stable = () => { for (const row of pins) assert.equal(digest(row.path), row.sha256, 'Read manifest drift: ' + row.path); };
  const load = relative => import(pathToFileURL(join(root, relative)).href);
  const { privateOutput, snapshot, hash, jvmCompilerSession } = await load('test/reference/compiler-tools.mjs');
  const { compileProductSet } = await load('lib/products/compile.mjs');
  const { readProductRequest } = await load('lib/products/cli.mjs');
  const { renderJournalReadside } = await load('generators/scala-cqrs-play-service/render-journal-readside.mjs');
  const fixture = join(root, 'test/fixtures/tickets-domain-v4-products');
  const compilation = compileProductSet(readProductRequest(join(fixture, 'files.json')));
  assert.deepEqual(compilation.diagnostics, []);
  const products = Object.fromEntries(compilation.result.products.map(p => [p.id, structuredClone(p.payload)]));
  const options = JSON.parse(fs.readFileSync(join(fixture, 'options.json')));
  options.service = { artifact: 'ticket-service', externalSourceRoots: [] };
  const ref = (kind, id, owner = []) => ({ context: 'tickets', kind, owner, id });
  const store = { schemaVersion: 'truthsrc.journal-readside/v1', id: 'TicketReadside', version: 'concurrency-v1',
    tablePrefix: 'ticket_view', pollIntervalMillis: 1730, closeTimeoutMillis: 23456,
    streams: [{ kind: 'booking', aggregate: ref('aggregate', 'Booking'), identity: ref('state-field', 'type', ['Booking']),
      allowEmptyIdentity: false, eventIdentities: [] }], technicalKinds: ['audit-run'], indexes: [] };
  products['artifact-contract'] = { artifacts: [{ id: 'ticket-service', artifact: ref('artifact', 'TicketService'),
    status: 'selected', source: { document: 'domain', pointer: '/artifactContracts/0' }, deployment: { service: { projectionStore: store } } }] };
  const entries = renderJournalReadside({ products, options }, []).filter(e => /(?:Schema|Repository|Projection)\.scala$/.test(e.path));
  assert.equal(entries.length, 3);
  stable();
  if (mode === 'capture') {
    assert(entries.find(e => e.path.endsWith('Projection.scala')).content.includes('def catchUp(pid: String): Future[Unit] = tracked() {'));
    assert(entries.find(e => e.path.endsWith('Repository.scala')).content.includes('if (current.last == high) Some(high) else None'));
    fs.writeFileSync(receiptPath, JSON.stringify({ mode, entries, pins, passed: true }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(receiptPath);
  } else {
    const raw = privateOutput(out, [root]);
    raw.json('read-manifest-before.json', pins);
    const io = { ...raw, write(name, bytes, mode) {
      if (name === 'sandbox.sb') bytes += `(deny file-write* (subpath ${JSON.stringify(join(out, 'logs'))}) (literal ${JSON.stringify(join(out, 'sandbox.sb'))}))\n`;
      return raw.write(name, bytes, mode);
    } };
    const { acquireFileLease, abandonFileLease } = await load('lib/verification/lease.mjs');
    const { runVerifiedProcess, processFailureState } = await load('lib/verification/process.mjs');
    let lease, session, result;
    const jobs = [];
    // The compiler helper records its phase before asserting acceptance. A compile
    // rejection can therefore have complete cleanup evidence despite throwing.
    // Missing session.runs plus no public no-spawn attestation is UNKNOWN, not safe.
    async function attested(label, action, receiptFor) {
      const job = { label, stopped: false };
      jobs.push(job);
      let value, failure;
      try { value = await action(); return value; }
      catch (error) { failure = processFailureState(error); throw error; }
      finally {
        try {
          const receipt = receiptFor(value);
          job.stopped = processStopped(receipt, failure);
          job.receipt = receipt?.paths.receipt ?? null;
          job.failureState = failure ?? null;
          job.barriers = receipt ? { directChildClosed: receipt.directChildClosed, directChildReaped: receipt.directChildReaped,
            groupAliveAfter: receipt.groupAliveAfter, callbackSettled: receipt.barrier?.settled } : null;
        } catch (error) { job.attestationError = error.message; }
      }
    }
    function sessionReceipt(label) {
      const phase = session.runs.find(run => run.label === label);
      if (!phase) return null;
      assert(phase.lifecycle.startsWith(join(out, 'logs') + '/'));
      const receipt = JSON.parse(fs.readFileSync(phase.lifecycle));
      assert.equal(receipt.schemaVersion, 'truthsrc.verified-process/v1');
      assert.equal(receipt.paths.receipt, phase.lifecycle);
      assert.equal(receipt.cwd, out);
      return receipt;
    }
    const sessionPhase = (label, action) => attested(label, action, () => sessionReceipt(label));
    try {
      stable();
      lease = await acquireFileLease({ registry: join(root, '.rounds/shared-jvm-leases'), lockNames: ['jvm-slot'], usedName: runId + '-used',
        record: { owner: 'journal-readside-concurrency', pid: process.pid, runId, out } });
      io.json('lease-acquired.json', lease.record);
      if (mode === 'node') {
        const tmp = io.directory('tmp'); io.directory('logs');
        const profile = io.write('sandbox.sb', `(version 1)\n(allow default)\n(deny network*)\n(deny file-write* (require-not (subpath ${JSON.stringify(out)})))\n(allow file-write* (literal "/dev/null"))\n`);
        const processReceipt = await attested('node', () => runVerifiedProcess({ executable: fs.realpathSync(process.execPath),
          args: ['--test', '--test-concurrency=1', join(root, 'test/journal-readside-generation.test.mjs'), fileURLToPath(import.meta.url)], cwd: root,
          env: { HOME: io.directory('home'), TMPDIR: tmp, PATH: '/usr/bin:/bin' }, base: join(out, 'logs/node'), timeoutMs: 120000,
          sandbox: { executable: '/usr/bin/sandbox-exec', profile, profileSha256: hash(profile) } }), receipt => receipt);
        assert.equal(processReceipt.passed, true);
        result = { passed: true, mode, processReceipt, tap: fs.readFileSync(processReceipt.paths.stdout, 'utf8') };
      } else {
        const supply = JSON.parse(fs.readFileSync(supplyPath));
        const javaHome = dirname(dirname(supply.java.path));
        const admitted = supply.finiteSupplyFiles.filter(row => row.path.startsWith(javaHome + '/') || row.path.startsWith(supply.cache + '/') || row.path === '/usr/bin/sandbox-exec');
        for (const row of [...admitted, supply.h2.jar, supply.h2.pom]) assert.equal(hash(row.path), row.sha256, 'Supply drift: ' + row.path);
        const { actorToolchain } = await load('test/reference/aggregate-core/toolchain.mjs');
        const tools = actorToolchain(supply.java.path, supply.cache, admitted.find(row => row.path.endsWith('/protoc-3.21.9-osx-x86_64.exe')).path);
        for (const path of tools.paths) assert(admitted.some(row => row.path === path), 'Unadmitted input: ' + path);
        const supplyPins = snapshot([...tools.paths, supply.h2.jar.path, supply.h2.pom.path]);
        io.json('offline-supply.json', { receipt: supplyPath, receiptSha256: hash(supplyPath), pins: supplyPins,
          downloads: false, bankHistoricalScratch: false, bankFrozenJars: false });
        const { runtimeMutationAcceptance } = await load('test/reference/compiler-results.mjs');
        session = jvmCompilerSession(io, tools, { suiteRejectionAcceptance: runtimeMutationAcceptance });
        let sources = entries;
        if (mode === 'baseline') {
          assert(baselinePath && resolve(baselinePath) === baselinePath);
          const baseline = JSON.parse(fs.readFileSync(baselinePath));
          assert.equal(baseline.mode, 'capture'); assert.equal(baseline.passed, true);
          assert.deepEqual(baseline.entries.map(e => e.path), entries.map(e => e.path));
          sources = baseline.entries;
          io.json('baseline-source-receipt.json', { path: baselinePath, sha256: hash(baselinePath), pins: baseline.pins });
        }
        if (mode === 'error-regression') {
          const fixed = `        }.recoverWith { case NonFatal(error) =>
          invalidate(pid).recover { case NonFatal(cleanup) =>
            if (cleanup ne error) error.addSuppressed(cleanup)
          }.flatMap(_ => Future.failed(error))
        }`;
          const previous = '        }.recoverWith { case NonFatal(error) => invalidate(pid).flatMap(_ => Future.failed(error)) }';
          sources = entries.map(entry => {
            if (!entry.path.endsWith('Projection.scala')) return entry;
            assert.equal(entry.content.split(fixed).length, 2, 'Exact reviewed recovery must occur once');
            return { ...entry, content: entry.content.replace(fixed, previous) };
          });
          io.json('error-preservation-regression.json', { fixed, previous, mechanism: 'exclusive rendered candidate only; no source rewrite',
            generated: sources.map(entry => ({ path: entry.path, sha256: createHash('sha256').update(entry.content).digest('hex') })) });
        }
        const generated = sources.map(e => io.write('sources/' + basename(e.path), e.content));
        const oracle = io.write('sources/JournalReadsideConcurrency.scala', fs.readFileSync(join(here, 'journal-readside-concurrency.scala')));
        const classes = io.directory('classes');
        const productionCp = [...new Set([...tools.runtime, ...tools.actorLibraries, supply.h2.jar.path])];
        const testCp = [...new Set([...productionCp, ...tools.testLibraries])];
        stable(); lease.assertHeld();
        const compileLabel = 'compile-' + mode;
        await sessionPhase(compileLabel, () => session.compile(compileLabel, [...generated, oracle], testCp, classes));
        const suitePrefix = 'example.tickets.infrastructure.projection.';
        const preservationTests = [
          'initialization and cleanup failure retain the original exception and suppress cleanup',
          'the same initialization and cleanup exception is never self-suppressed',
        ];
        const historicalCases = [
          ['OverlapSpec', 1, 'same PID catchups share one in-flight sample and different PIDs proceed', /same PID must share the in-flight Future/],
          ['ObservationSpec', 1, 'late successful low observation preserves a newer valid frontier', /late successful observation must preserve frontier 2/],
          ['FailureInvalidationSpec', 1, 'one failed shared sample invalidates prior freshness before retry is admitted', /failed sample must invalidate prior freshness/],
          ['LifecycleSpec', 5, null, null],
        ];
        // The previous sixth Lifecycle test merely drained everything. Its stronger
        // boundary replacement and the new init/cleanup tests are NOT baseline passes.
        const reviewCases = [['CleanupBoundarySpec', 1, null, null], ['ErrorPreservationSpec', 2, null, null]];
        const cases = mode === 'error-regression' ? [reviewCases[1]] : mode === 'baseline' ? historicalCases : [...historicalCases, ...reviewCases];
        for (const [name, tests, failedTestName, diagnostic] of cases) {
          stable(); lease.assertHeld();
          const suite = suitePrefix + name;
          const expected = mode === 'baseline' && failedTestName
            ? { kind: 'suite-rejection', suite, testNames: [failedTestName], failedTestName, diagnostic }
            : mode === 'error-regression'
              ? { kind: 'suite-rejection', suite, testNames: preservationTests, failedTestName: preservationTests[0],
                diagnostic: /catchUp must retain original initialization exception identity when cleanup fails/ }
              : { kind: 'suites', suites: [suite], tests, ...(name === 'ErrorPreservationSpec' ? { testNames: preservationTests } : {}) };
          const label = mode + '-' + name.toLowerCase();
          await sessionPhase(label, () => session.jvm(label, ['-cp', [...testCp, classes].join(delimiter),
            'org.scalatest.tools.Runner', '-R', classes, '-oW', '-s', suite], expected));
        }
        assert.deepEqual(snapshot(supplyPins.map(row => row.path)), supplyPins, 'Offline supply changed');
        const tests = cases.reduce((sum, row) => sum + row[1], 0);
        const expectedBaselineFailures = mode === 'baseline' ? 3 : 0;
        const expectedErrorPreservationFailures = mode === 'error-regression' ? 1 : 0;
        result = { passed: true, mode, runs: session.runs, supplyUnchanged: true,
          tests, successfulTests: tests - expectedBaselineFailures - expectedErrorPreservationFailures,
          expectedBaselineFailures, expectedErrorPreservationFailures,
          historicalBaseline: mode === 'baseline' ? { tests: 8, successfulTests: 5, expectedFailures: 3,
            excludedReviewTests: reviewCases.map(([suite, tests]) => ({ suite, tests })) } : null,
          errorPreservation: mode === 'corrected' ? '2 tests passed' : mode === 'error-regression' ? 'exact original-error guard rejected previous recovery; nonself case passed' : 'not run',
          service02RootCauseProven: false, scope: 'compatible v1 generated projection/repository; controlled Journal API, real Scala/Akka/H2 only' };
      }
      stable(); result.readManifestUnchanged = true;
    } catch (error) {
      result = { passed: false, mode, runs: session?.runs ?? [], error: { name: error.name, message: error.message, stack: error.stack } };
      process.exitCode = 1;
    } finally {
      if (lease) {
        result.lease = settleLease(lease, jobs, abandonFileLease);
        if (!result.lease.leaseReleased) { result.passed = false; process.exitCode = 1; }
        io.json(result.lease.leaseReleased ? 'lease-released.json' : 'lease-retained.json', { runId, ...result.lease, jobs });
      }
    }
    result.processAttestations = jobs;
    result.out = out;
    io.json('result.json', result);
    fs.writeFileSync(receiptPath, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ passed: result.passed, mode, out, receiptPath, error: result.error }));
  }
}
