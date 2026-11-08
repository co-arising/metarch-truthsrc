import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { absolutePath, privateOutput, offlineJvmToolchain, jvmCompilerSession, files, snapshot } from '../compiler-tools.mjs';
import { acquireFileLease, abandonFileLease } from '../../../lib/verification/lease.mjs';
import { modules, supportInventory } from './contract.mjs';
import { parcelClasspaths } from './contract.mjs';
import { admitMixedInputs, stageInputs } from './inputs.mjs';
import { createVariant } from './variants.mjs';
import { classShadow } from './verify.mjs';
import { replaceOnce } from './controls.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const cases = ['split-parcel', 'all-separate', 'same-name-sum', 'same-name-root', 'direct'];
const directSuite = `package example.parcel.verification
import org.scalatest.funsuite.AnyFunSuite
import example.parcel.domain.values._
import example.parcel.domain.QuoteError._
import example.parcel.domain.ports.CapacityPolicy
import example.parcel.domain.CapacityRule
import example.parcel.composition.ParcelModule
import scala.concurrent.{Await, ExecutionContext}
import scala.concurrent.duration._
final class DirectImplementationSpec extends AnyFunSuite {
  test("direct implementation preserves port and root selection") {
    val policy: CapacityPolicy = CapacityRule
    val id = RouteId("direct")
    val route = Route(id, 5)
    val parcels = Vector(Parcel(ParcelId("a"), 3), Parcel(ParcelId("b"), 2))
    assert(policy.assess(route, parcels) == Right(Load(5)))
    assert(policy.assess(route, Vector.empty) == Left(EmptyParcels))
    implicit val ec: ExecutionContext = ExecutionContext.parasitic
    assert(Await.result(ParcelModule.create(Map(id -> route)).quote(QuoteRequest(id, parcels)), 2.seconds) == Right(Quote(id, Load(5))))
  }
}
`;

export async function main({ producerRoot, java, cache, registry, out, runId }) {
  assert(!process.env.NODE_TEST_CONTEXT, 'NODE_TEST_CONTEXT forbids JVM execution');
  for (const value of [producerRoot, java, cache, registry, out]) absolutePath(value, 'variant input');
  assert(/^[a-z0-9-]+$/.test(runId));
  const tools = offlineJvmToolchain(java, cache), variants = [];
  for (const variant of cases) variants.push(await createVariant(producerRoot, variant));
  const admitted = [];
  for (const v of variants) admitted.push(await admitMixedInputs(v));
  const io = privateOutput(out, [producerRoot, tools.cache, tools.javaHome, ...variants.map(v => v.parent)]);
  const pins = snapshot([...files(here), ...['compiler-tools.mjs', 'compiler-pom.mjs', 'jvm-toolchain.mjs', 'compiler-results.mjs'].map(p => join(here, '..', p))]);
  const session = jvmCompilerSession(io, tools), stagePins = [], completed = [];
  let lease, unrecorded = false, failure = null, released = false;
  const put = (name, bytes) => { const p = io.write(name, bytes); stagePins.push(...snapshot([p])); return p; };
  const check = () => {
    lease?.assertHeld(); admitted.forEach(a => a.close());
    assert.deepEqual(snapshot(pins.map(p => p.path)), pins);
    assert.deepEqual(snapshot(stagePins.map(p => p.path)), stagePins);
  };
  const execute = async action => {
    check(); const n = session.runs.length; unrecorded = true;
    try { return await action(); } finally { if (session.runs.length === n + 1) unrecorded = false; if (!unrecorded) check(); }
  };
  const compile = (...args) => execute(() => session.compile(...args));
  const jvm = (...args) => execute(() => session.jvm(...args));
  io.json('variants.json', variants); io.json('supply.json', tools); io.json('verifier-pins.json', pins);
  try {
    lease = await acquireFileLease({ registry, lockNames: ['jvm-slot'], usedName: runId + '-used', record: { owner: 'module-seams-20261108', runId, out }, preflight: () => { check(); return true; } });
    await jvm('java-version', ['-version'], { kind: 'success', pattern: /version "11\./ });
    for (const [index, v] of variants.entries()) {
      const a = admitted[index];
      const copied = stageInputs({ ...io, write: (name, bytes) => put(v.variant + '/' + name, bytes) }, a.sets, a.sourcePins);
      const classes = Object.fromEntries(modules.map(m => [m, io.directory('classes/' + v.variant + '/' + m)]));
      const cp = parcelClasspaths(tools, classes);
      for (const m of modules) await compile(v.variant + '-' + m, copied[m].map(s => s.staged), cp[m], classes[m]);
      classShadow(classes);
      const support = supportInventory.map(path => {
        const bytes = readFileSync(join(v.source, path));
        const sourcePin = a.outputPins.find(p => p.path === join(v.source, path));
        assert.equal(createHash('sha256').update(bytes).digest('hex'), sourcePin.sha256, 'Support staging differs from admitted bytes');
        return put(v.variant + '/support/' + path, bytes);
      });
      const tests = io.directory('classes/' + v.variant + '/support');
      await compile(v.variant + '-support-compile', support, cp.rootTests, tests);
      const suites = ['ModuleSeamsValueShapeSpec', 'ModuleSeamsRootShapeSpec'].map(name => 'example.parcel.verification.' + name);
      await jvm(v.variant + '-support-suites', ['-cp', [...cp.rootTests, tests].join(delimiter), 'org.scalatest.tools.Runner', '-R', tests, '-oW',
        ...suites.flatMap(s => ['-s', s])], { kind: 'suites', suites, tests: 2 });
      if (v.variant === 'direct') {
        assert(!a.plan.entries.some(e => e.path.endsWith('/CapacityPolicyBridge.scala')));
        const suite = put('direct/DirectImplementationSpec.scala', directSuite), target = io.directory('classes/direct/behavior');
        await compile('direct-behavior-compile', [suite], cp.rootTests, target);
        await jvm('direct-behavior-suite', ['-cp', [...cp.rootTests, target].join(delimiter), 'org.scalatest.tools.Runner', '-R', target, '-oW',
          '-s', 'example.parcel.verification.DirectImplementationSpec'], { kind: 'suites', suites: ['example.parcel.verification.DirectImplementationSpec'], tests: 1,
          testNames: ['direct implementation preserves port and root selection'] });
        const wrongClasses = io.directory('classes/direct/wrong-kernel');
        const wrongSources = copied.kernel.map(s => s.role === 'handwritten' ? put('direct/negative/CapacityRule.scala',
          replaceOnce(readFileSync(s.staged, 'utf8'), ' extends example.parcel.domain.ports.CapacityPolicy', '')) : s.staged);
        await compile('direct-wrong-kernel-compile', wrongSources, cp.kernel, wrongClasses);
        await compile('direct-not-port-negative', copied.root.map(s => s.staged), cp.root.map(p => p === classes.kernel ? wrongClasses : p),
          io.directory('classes/direct/wrong-root'), { kind: 'compiler-rejection', file: 'ParcelModule.scala', symbol: 'CapacityPolicy', diagnostics: [/type mismatch/] });
      }
      completed.push(v.variant);
    }
    assert.equal(session.runs.length, 35);
  } catch (error) { failure = error.stack; }
  finally {
    let safe = !unrecorded;
    try {
      check(); assert.deepEqual(snapshot(tools.paths), tools.supplyHashes);
      for (const r of session.runs) {
        const p = JSON.parse(readFileSync(r.lifecycle));
        assert(p.directChildReaped && !p.groupAliveAfter && !p.leftoverGroup && !p.timedOut && !p.cancelled && p.signal === null);
      }
    } catch (error) { failure = [failure, error.stack].filter(Boolean).join('\n'); safe = false; }
    if (lease) {
      if (safe) { lease.release(); released = true; } else abandonFileLease(lease);
    }
    const result = { passed: !failure && completed.length === cases.length && released, completed, failure, leaseReleased: released,
      runs: session.runs, cases: variants, original34OracleClaimed: false, CComplete: false };
    io.json('execution.json', result); console.log(JSON.stringify({ passed: result.passed, out, failure }));
    if (!result.passed) process.exitCode = 1;
    return result;
  }
}
