// Finite Parcel compiler contract; the independent reference remains read-only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { absolutePath, regular, within } from '../compiler-tools.mjs';

export const modules = Object.freeze(['kernel', 'glue', 'ext', 'root']);
const kernel = 'modules/kernel/src/main/scala/example/parcel/';
export const generatedInventory = Object.freeze({
  kernel: Object.freeze([kernel + 'domain/values/ParcelValues.scala', kernel + 'domain/QuoteError.scala',
    kernel + 'domain/ports/CapacityPolicy.scala', kernel + 'application/ports/RouteRepository.scala',
    kernel + 'application/ports/QuoteFlow.scala', kernel + 'domain/ports/CapacityPolicyBridge.scala']),
  glue: Object.freeze([]), ext: Object.freeze([]),
  root: Object.freeze(['src/main/scala/example/parcel/composition/ParcelModule.scala']),
});
export const handwrittenInventory = Object.freeze({
  kernel: Object.freeze([{ id: 'capacity-rule', reference: kernel + 'domain/CapacityRule.scala', file: 'CapacityRule.scala' }]),
  glue: Object.freeze([{ id: 'repository', reference: 'modules/glue/src/main/scala/example/parcel/infrastructure/InMemoryRouteRepository.scala', file: 'InMemoryRouteRepository.scala' }]),
  ext: Object.freeze([{ id: 'flow', reference: 'modules/ext/src/main/scala/example/parcel/application/DefaultQuoteFlow.scala', file: 'DefaultQuoteFlow.scala' }]),
  root: Object.freeze([]),
});
export const buildInventory = Object.freeze(['build.sbt', 'project/build.properties']);
export const supportInventory = Object.freeze([
  'modules/kernel/src/test/scala/example/parcel/verification/ModuleSeamsValueShapeSpec.scala',
  'src/test/scala/example/parcel/verification/ModuleSeamsRootShapeSpec.scala',
]);
export const evidenceInventory = Object.freeze(['canonical', 'request', 'compiled', 'inputs'].map(name => '.truthsrc/' + name + '.json'));
export const writerInventory = Object.freeze([...modules.flatMap(m => generatedInventory[m]), ...buildInventory, ...supportInventory, ...evidenceInventory]);
export const referenceInventory = Object.freeze(modules.flatMap(m => [...generatedInventory[m], ...handwrittenInventory[m].map(row => row.reference)]));
export const variantIds = Object.freeze(['main', 'split-parcel', 'all-separate', 'same-name-sum', 'same-name-root', 'direct']);
export function variantInventory(variant = 'main') {
  assert(variantIds.includes(variant), 'Unknown finite Parcel variant');
  const production = Object.fromEntries(modules.map(m => [m, [...generatedInventory[m]]]));
  if (variant === 'split-parcel') production.kernel.push(kernel + 'domain/values/Parcel.scala');
  if (variant === 'all-separate') production.kernel = production.kernel.filter(p => !p.endsWith('/ParcelValues.scala')).concat(
    ['RouteId', 'ParcelId', 'Parcel', 'Route', 'Load', 'QuoteRequest', 'Quote'].map(name => kernel + 'domain/values/' + name + '.scala'));
  if (variant === 'same-name-sum') production.kernel.push(kernel + 'domain/ModuleSeamsValueShapeSpec.scala');
  if (variant === 'same-name-root') production.root = ['src/main/scala/example/parcel/composition/ModuleSeamsRootShapeSpec.scala'];
  if (variant === 'direct') production.kernel = production.kernel.filter(p => !p.endsWith('/CapacityPolicyBridge.scala'));
  return { production, writer: [...modules.flatMap(m => production[m]), ...buildInventory, ...supportInventory, ...evidenceInventory] };
}
export const oraclePaths = Object.freeze([
  'modules/kernel/src/test/scala/example/parcel/domain/CapacityRuleSpec.scala',
  'src/test/scala/example/parcel/application/QuoteFlowSpec.scala',
  'src/test/scala/example/parcel/composition/ParcelModuleSpec.scala',
]);
export function readOracle(reference, lock) {
  assert.equal(lock.schemaVersion, 'truthsrc.module-seams-oracle-lock/v1');
  assert.deepEqual(lock.suites.map(s => s.path), oraclePaths);
  assert.deepEqual(lock.suites.map(s => s.tests), [20, 9, 5]);
  return lock.suites.map(s => {
    const path = regular(join(reference, s.path)), bytes = readFileSync(path);
    assert.equal(bytes.length, s.bytes, 'Independent oracle length drifted');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), s.sha256, 'Independent oracle bytes drifted');
    assert.deepEqual([...bytes.toString().matchAll(/test\("([^"\n]+)"\)/g)].map(m => m[1]), s.testNames, 'Independent oracle cases drifted');
    return { ...s, absolutePath: path };
  });
}
export function parcelClasspaths(tools, classes) {
  assert.deepEqual(Object.keys(classes).sort(), [...modules].sort(), 'Exactly four production class directories required');
  const dirs = modules.map(m => absolutePath(classes[m], m + ' class directory'));
  for (const [i, dir] of dirs.entries()) for (const other of dirs.slice(0, i))
    assert(!within(dir, other) && !within(other, dir), 'Production class directories must be disjoint');
  absolutePath(tools.library, 'Scala library');
  for (const jar of [...tools.compiler, ...tools.testLibraries]) {
    absolutePath(jar, 'Tool JAR');
    assert(!dirs.some(dir => within(jar, dir) || within(dir, jar)), 'Tool supply overlaps class outputs');
  }
  const cp = { kernel: [tools.library], glue: [tools.library, classes.kernel],
    ext: [tools.library, classes.kernel, classes.glue], root: [tools.library, classes.kernel, classes.glue, classes.ext] };
  cp.kernelTests = [...new Set([...tools.testLibraries, tools.library, classes.kernel])];
  cp.rootTests = [...new Set([...tools.testLibraries, ...cp.root, classes.root])];
  return cp;
}

// The original seven positive/negative pairs, now with explicit expected symbols.
// rootSource is the admitted final root bytes, never a regenerated substitute.
export function compilerControls(rootSource) {
  assert(typeof rootSource === 'string' && rootSource.includes('object ParcelModule'), 'Admitted Parcel root required');
  const same = (name, file, source, positive, negative, symbol, diagnostics) =>
    ({ name, file, control: source, negative: source, controlCP: positive, negativeCP: negative, symbol, diagnostics });
  const missingExt = /(?:object|type) DefaultQuoteFlow is not a member/;
  const imported = name => `package example.parcel.domain
import example.parcel.application.DefaultQuoteFlow
object ${name} { def implementation: Class[DefaultQuoteFlow] = classOf[DefaultQuoteFlow] }
`;
  const constructor = capacity => `package example.parcel.composition
import example.parcel.application.DefaultQuoteFlow
import example.parcel.application.ports.{QuoteFlow, RouteRepository}
import example.parcel.domain.ports.CapacityPolicy
import scala.concurrent.ExecutionContext
object MissingConstructorParameter {
  def create(repository: RouteRepository, capacity: CapacityPolicy)(implicit ec: ExecutionContext): QuoteFlow =
    new DefaultQuoteFlow(repository${capacity ? ', capacity' : ''})
}
`;
  const result = correct => `package example.parcel.application
import example.parcel.application.ports.QuoteFlow
import example.parcel.domain.QuoteError
import example.parcel.domain.values._
import scala.concurrent.Future
final class WrongResultType extends QuoteFlow {
  override def quote(request: QuoteRequest): Future[Either[QuoteError, ${correct ? 'Quote' : 'Load'}]] =
    Future.successful(Right(${correct ? 'Quote(request.routeId, Load(1))' : 'Load(1)'}))
}
`;
  return [
    same('kernel-imports-ext', 'KernelImportsExt.scala', imported('KernelImportsExt'), 'root', 'glue', 'DefaultQuoteFlow', [missingExt]),
    same('nested-signature-closure', 'OuterSignaturePort.scala', `package example.parcel.domain.ports
import scala.concurrent.Future
trait OuterSignaturePort { def candidates: Future[Option[Vector[example.parcel.application.DefaultQuoteFlow]]] }
`, 'root', 'glue', 'DefaultQuoteFlow', [/type DefaultQuoteFlow is not a member/]),
    same('glue-imports-ext', 'GlueImportsExt.scala', imported('GlueImportsExt').replace('package example.parcel.domain', 'package example.parcel.infrastructure'), 'root', 'ext', 'DefaultQuoteFlow', [missingExt]),
    same('kernel-bridge-delegates-ext', 'ExtDelegatingCapacityBridge.scala', `package example.parcel.domain.ports
import example.parcel.application.DefaultQuoteFlow
import example.parcel.domain.QuoteError
import example.parcel.domain.values._
import scala.concurrent.Await
import scala.concurrent.duration.Duration
final class ExtDelegatingCapacityBridge(flow: DefaultQuoteFlow) extends CapacityPolicy {
  override def assess(route: Route, parcels: Vector[Parcel]): Either[QuoteError, Load] =
    Await.result(flow.quote(QuoteRequest(route.id, parcels)), Duration.Zero).map(_.load)
}
`, 'root', 'glue', 'DefaultQuoteFlow', [missingExt]),
    same('root-omits-implementations', 'ParcelModule.scala', rootSource, 'root', 'glue', 'InMemoryRouteRepository',
      [/DefaultQuoteFlow/, /InMemoryRouteRepository/]),
    { name: 'root-omits-constructor-parameter', file: 'MissingConstructorParameter.scala', control: constructor(true), negative: constructor(false),
      controlCP: 'root', negativeCP: 'root', symbol: 'capacity', diagnostics: [/not enough arguments for constructor DefaultQuoteFlow/, /Unspecified value parameter capacity/] },
    { name: 'wrong-implementation-result', file: 'WrongResultType.scala', control: result(true), negative: result(false),
      controlCP: 'glue', negativeCP: 'glue', symbol: 'quote', diagnostics: [/(?:incompatible type in overriding|method quote has incompatible type)/, /(?:def|method) quote/] },
  ];
}
