import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, delimiter } from 'node:path';
import { modules, parcelClasspaths } from './contract.mjs';

export function replaceOnce(text, from, to) {
  assert.equal(text.split(from).length, 2, 'Missing or ambiguous finite mutation anchor');
  assert.notEqual(from, to); return text.replace(from, to);
}
export const mutationCases = Object.freeze([
  { id: 'bridge-parcels', module: 'kernel', file: 'CapacityPolicyBridge.scala',
    from: 'CapacityRule.assess(route, parcels)', to: 'CapacityRule.assess(route, _root_.scala.collection.immutable.Vector.empty)',
    suite: 'example.parcel.domain.CapacityRuleSpec', test: 'the bridge implements the port and preserves success and each refusal', diagnostic: /EmptyParcels|Right\(Load/ },
  { id: 'root-routes', module: 'root', file: 'ParcelModule.scala',
    from: 'InMemoryRouteRepository(routes)', to: 'InMemoryRouteRepository(_root_.scala.collection.immutable.Map.empty)',
    suite: 'example.parcel.composition.ParcelModuleSpec', test: 'root binding returns a port backed by the explicit routes and capacity bridge', diagnostic: /UnknownRoute|Right\(Quote/ },
].map(Object.freeze));

export async function runSeamControls({ io, tools, copied, classes, cp, stagedOracle, compile, jvm, check, classShadow }) {
  const completed = [];
  const root = copied.root[0], rootText = readFileSync(root.staged, 'utf8');
  const bridge = copied.kernel.find(s => basename(s.staged) === 'CapacityPolicyBridge.scala');
  const bridgeText = readFileSync(bridge.staged, 'utf8');
  const emit = (id, side, file, text) => io.write(`extended/${id}/${side}/${file}`, text);
  async function pair(id, file, positive, negative, positiveCP, negativeCP, symbol, diagnostics) {
    await compile(id + '-positive', [emit(id, 'positive', file, positive)], positiveCP, io.directory('classes/extended/' + id + '-positive'));
    await compile(id + '-negative', [emit(id, 'negative', file, negative)], negativeCP, io.directory('classes/extended/' + id + '-negative'),
      { kind: 'compiler-rejection', file, symbol, diagnostics });
    completed.push(id);
  }
  await pair('constructor-order', 'ParcelModule.scala', rootText,
    replaceOnce(rootText, 'DefaultQuoteFlow(inMemoryRouteRepository, capacityPolicyBridge)', 'DefaultQuoteFlow(capacityPolicyBridge, inMemoryRouteRepository)'),
    cp.root, cp.root, 'DefaultQuoteFlow', [/type mismatch/]);
  await pair('wrong-explicit-ec', 'ParcelModule.scala', rootText,
    replaceOnce(rootText, '(executionContext)', '("not-an-execution-context")'), cp.root, cp.root, 'ExecutionContext', [/type mismatch/]);
  const ec = implicit => `package example.parcel.composition
import example.parcel.application.DefaultQuoteFlow
import example.parcel.application.ports.RouteRepository
import example.parcel.domain.ports.CapacityPolicy
import scala.concurrent.ExecutionContext
object MissingExecutionContext {
  def create(repository: RouteRepository, capacity: CapacityPolicy)${implicit ? '(implicit ec: ExecutionContext)' : ''}: DefaultQuoteFlow =
    new DefaultQuoteFlow(repository, capacity)
}
`;
  await pair('missing-implicit-ec', 'MissingExecutionContext.scala', ec(true), ec(false), cp.root, cp.root,
    'ExecutionContext', [/implicit.*ExecutionContext|execution context|executionContext/i]);
  await pair('delegate-member', 'CapacityPolicyBridge.scala', bridgeText,
    replaceOnce(bridgeText, 'CapacityRule.assess(', 'CapacityRule.unknownMember('), cp.glue, cp.glue,
    'unknownMember', [/not a member/]);
  await pair('delegate-parameter', 'CapacityPolicyBridge.scala', bridgeText,
    replaceOnce(bridgeText, 'assess(route, parcels)', 'assess(parcels, route)'), cp.glue, cp.glue,
    'assess', [/type mismatch/]);
  await pair('delegate-result', 'CapacityPolicyBridge.scala', bridgeText,
    replaceOnce(bridgeText, '_root_.example.parcel.domain.CapacityRule.assess(route, parcels)', '1L'), cp.glue, cp.glue,
    'Either', [/type mismatch/]);
  for (const module of ['glue', 'ext']) await pair('missing-' + module + '-implementation', 'ParcelModule.scala', rootText, rootText,
    cp.root, cp.root.filter(path => path !== classes[module]), module === 'glue' ? 'InMemoryRouteRepository' : 'DefaultQuoteFlow', [/not a member|not found/]);
  const kernelWithout = copied.kernel.filter(s => basename(s.staged) !== 'CapacityRule.scala').map(s => s.staged);
  await compile('missing-kernel-implementation-positive', copied.kernel.map(s => s.staged), cp.kernel, io.directory('classes/extended/kernel-positive'));
  await compile('missing-kernel-implementation-negative', kernelWithout, cp.kernel, io.directory('classes/extended/kernel-negative'), {
    kind: 'compiler-rejection', file: 'CapacityPolicyBridge.scala', symbol: 'CapacityRule', diagnostics: [/not a member|not found/],
  }); completed.push('missing-kernel-implementation');
  const duplicate = emit('same-module-shadow', 'negative', 'DuplicateBridge.scala', bridgeText);
  await compile('same-module-shadow-positive', copied.kernel.map(s => s.staged), cp.kernel, io.directory('classes/extended/shadow-positive'));
  await compile('same-module-shadow-negative', [...copied.kernel.map(s => s.staged), duplicate], cp.kernel, io.directory('classes/extended/shadow-negative'), {
    kind: 'compiler-rejection', file: 'DuplicateBridge.scala', symbol: 'CapacityPolicyBridge', diagnostics: [/already defined/],
  }); completed.push('same-module-shadow');

  for (const mutation of mutationCases) {
    const suite = stagedOracle.find(s => s.suite === mutation.suite), positiveClasses = io.directory('classes/mutation/' + mutation.id + '/positive-oracle');
    await compile(mutation.id + '-oracle-positive-compile', [suite.staged], cp.rootTests, positiveClasses);
    const args = (testCP, target) => ['-cp', [...testCP, target].join(delimiter), 'org.scalatest.tools.Runner', '-R', target, '-oW', '-s', suite.suite, '-t', mutation.test];
    await jvm(mutation.id + '-oracle-positive', args(cp.rootTests, positiveClasses), { kind: 'suites', suites: [suite.suite], tests: 1, testNames: [mutation.test] });
    const mutatedClasses = Object.fromEntries(modules.map(m => [m, mutation.module === 'root' && m !== 'root' ? classes[m] : io.directory('classes/mutation/' + mutation.id + '/' + m)]));
    const mutatedCP = parcelClasspaths(tools, mutatedClasses);
    for (const module of modules) {
      if (mutation.module === 'root' && module !== 'root') continue;
      const sources = copied[module].map(s => basename(s.staged) === mutation.file ? emit(mutation.id, 'negative', mutation.file,
        replaceOnce(readFileSync(s.staged, 'utf8'), mutation.from, mutation.to)) : s.staged);
      await compile(mutation.id + '-' + module + '-compile', sources, mutatedCP[module], mutatedClasses[module]);
    }
    classShadow(mutatedClasses);
    const oracleClasses = io.directory('classes/mutation/' + mutation.id + '/negative-oracle');
    await compile(mutation.id + '-oracle-negative-compile', [suite.staged], mutatedCP.rootTests, oracleClasses);
    await jvm(mutation.id + '-oracle-negative', args(mutatedCP.rootTests, oracleClasses), {
      kind: 'suite-rejection', suite: suite.suite, testNames: [mutation.test], failedTestName: mutation.test, diagnostic: mutation.diagnostic,
    });
    completed.push(mutation.id);
  }
  check();
  assert.equal(completed.length, 12);
  return completed;
}
