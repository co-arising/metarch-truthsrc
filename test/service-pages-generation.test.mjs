import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { generate } from '../generators/scala-cqrs-play-service/generate.mjs';
import { serviceApplicationFixture } from './service-application-fixture.mjs';
import { servicePagesFixture } from './service-pages-fixture.mjs';

const manifest = JSON.parse(readFileSync(new URL('../generators/scala-cqrs-play-service/generator.json', import.meta.url), 'utf8'));
const plan = fixture => {
  const compilation = compileProductSet(fixture.request);
  assert.deepEqual(compilation.diagnostics, []);
  assert.ok(compilation.result);
  const output = generate({ compilation, manifest, options: fixture.options });
  assert.deepEqual(output.diagnostics, []);
  assert.ok(output.plan);
  return output;
};
const source = (output, kind) => output.plan.entries.find(e => e.kind === kind && (kind !== 'service-runtime' || e.path.endsWith('Loader.scala'))).content;
const artifact = fixture => fixture.request.documents.find(d => d.id === 'domain').value.artifactContracts.find(a => a.id === fixture.options.service.artifact);
const synchronize = fixture => {
  const canonical = fixture.request.documents.find(d => d.id === 'domain').value;
  fixture.request.documents.find(d => d.id === 'artifacts').value.artifacts.artifacts = canonical.artifactContracts.map((a, i) => ({
    ...structuredClone(a), source: { document: 'domain', pointer: '/artifactContracts/' + i }
  }));
};
const occurrences = (text, part) => text.split(part).length - 1;

for (const variant of ['inventory-mixed-effect-products', 'inventory-effect-products']) test('formally compiled ' + variant + ' emits optional installed pages without target writes', () => {
  const fixture = servicePagesFixture(variant), before = structuredClone(fixture);
  const first = plan(fixture);
  assert.deepEqual(first, plan(fixture));
  assert.deepEqual(fixture, before);
  const contract = source(first, 'service-port');
  assert.ok(contract.includes(`  trait PageRenderer {
    def implementation: String
    def version: String
    def shell: String
    def script: String
    def render(endpointId: String, status: Int, value: JsValue): String
  }`));
  assert.ok(contract.includes('def pages: Option[PageRenderer] = None'));
  assert.ok(contract.includes('val installedPages = value.pages'));
  assert.ok(contract.includes('installedPages != null && installedPages.exists(p => p != null && p.implementation == "example.inventory.InventoryPages" && p.version == "1")'));
  assert.ok(contract.includes('"page renderer pin mismatch"'));
  assert.ok(contract.includes('STRICT_DUPLICATE_DETECTION'));
  assert.ok(contract.includes('bounded single JSON value required'));
  const runtime = source(first, 'service-runtime');
  assert.ok(runtime.includes('private val pageRenderer: PageRenderer = {\n    requireInstalled(composition)\n    composition.pages.get'));
  assert.ok(!runtime.includes('loadClass("example.inventory.InventoryPages")'));
  const bootstrap = first.plan.entries.find(e => e.path.endsWith('/bootstrap/ApplicationBootstrap.scala')).content;
  assert.ok(runtime.includes('infrastructure.bootstrap.ApplicationBootstrap.load(context)'));
  assert.equal(occurrences(runtime, '.loadClass('), 0);
  assert.equal(occurrences(bootstrap, '.loadClass('), 1, 'only the existing composition factory is reflectively loaded');
  assert.ok(!bootstrap.includes('loadClass("example.inventory.InventoryPages")'));
});

test('API and aliases copy one typed action and retain endpoint identity and path parameters', () => {
  const runtime = source(plan(servicePagesFixture()), 'service-runtime');
  assert.ok(runtime.includes('Route("GET", "^/api/v1/allocations/([^/]+)$".r, Vector("id"), "customer", false, "allocation-query", false,'));
  assert.ok(runtime.includes('Route("POST", "^/api/v1/allocations$".r, Vector(), "customer", true, "allocation-record", false,'));
  assert.ok(runtime.includes('apiActions(0).copy(pattern = "^/inventory/v1/allocations/([^/]+)$".r, page = true)'));
  assert.ok(runtime.includes('apiActions(1).copy(pattern = "^/inventory/v1/allocations$".r, page = true)'));
  assert.ok(runtime.includes('private val actions = apiActions ++ pageActions'));
  assert.equal(occurrences(runtime, 'invoke(composition.bindings.ReadAllocation'), 1);
  assert.equal(occurrences(runtime, 'invoke(composition.bindings.RecordAllocation'), 1);
  assert.equal(occurrences(runtime, 'composition.authority.authenticate(request)'), 1);
  assert.equal(occurrences(runtime, 'composition.authority.csrf(request)'), 1);
  assert.equal(occurrences(runtime, 'endpoint.reads.reads(input)'), 1);
  assert.equal(occurrences(runtime, 'endpoint.run(principal, value)'), 1);
  const action = runtime.slice(runtime.indexOf('  private def action('), runtime.indexOf('  override lazy val router:'));
  assert.ok(action.indexOf('composition.ready') < action.indexOf('composition.authority.authenticate'));
  assert.ok(action.indexOf('composition.authority.authenticate') < action.indexOf('decodeBody(request.body)'));
  assert.ok(action.indexOf('composition.authority.csrf') < action.indexOf('decodeBody(request.body)'));
  assert.ok(action.includes('if (row.method == "GET") Right(JsNull) else decodeBody(request.body)'));
  assert.ok(action.includes('row.run(Principal(id, roles), input)'));
});

test('success, DTO, auth, CSRF, conflict and unavailable responses retain status through HTML formatting', () => {
  const output = plan(servicePagesFixture());
  const contract = source(output, 'service-port'), runtime = source(output, 'service-runtime');
  for (const [name, status] of [['InvalidRequest', 400], ['NotAuthenticated', 401], ['NotAuthorized', 403], ['MissingResource', 404], ['RequestConflict', 409], ['Unavailable', 503]]) {
    assert.ok(contract.includes('case object ' + name + ' extends Failure { val status = ' + status));
  }
  assert.ok(runtime.includes('private final case class Response(status: Int, value: JsValue)'));
  assert.ok(runtime.includes('Response(error.status, Json.obj("code" -> error.code))'));
  assert.ok(runtime.includes('case Right(result) => Response(200, endpoint.writes.writes(result))'));
  assert.ok(runtime.includes('case Left(error) => failure(error)'));
  assert.ok(runtime.includes('case _: JsError => Future.successful(failure(InvalidRequest))'));
  assert.ok(runtime.includes('Response(403, Json.obj("code" -> "csrf-denied"))'));
  assert.ok(runtime.includes('case None => Future.successful(failure(NotAuthenticated))'));
  assert.ok(runtime.includes('case _ => Future.successful(failure(NotAuthorized))'));
  assert.ok(runtime.includes('case Left(error) => Future.successful(failure(error))'));
  assert.ok(runtime.includes('.recover { case NonFatal(_) => failure(Unavailable) }.map(value => response(row, value))'));
  assert.ok(runtime.includes('if (!row.page) Results.Status(value.status)(value.value)'));
  assert.ok(runtime.includes('Results.Status(value.status)(pageRenderer.render(row.endpointId, value.status, value.value)).as("text/html; charset=utf-8").withHeaders(htmlHeaders: _*)'));
  assert.ok(runtime.includes('parsed.left.map(result => response(row, Response(result.header.status, Json.obj("code" -> "invalid-request"))))'));
  assert.ok(runtime.includes('if (!row.page) controllerComponents.parsers.tolerantText(65536)'));
  assert.ok(runtime.includes('catch { case NonFatal(_) => unavailableHtml }'));
});

test('only static shell and script GETs are public with fixed safety headers and no business arguments', () => {
  const runtime = source(plan(servicePagesFixture()), 'service-runtime');
  const staticPage = runtime.slice(runtime.indexOf('  private def staticPage('), runtime.indexOf('  private def invoke['));
  assert.ok(staticPage.includes('Results.Ok(pageRenderer.script).as("application/javascript; charset=utf-8").withHeaders(staticHeaders: _*)'));
  assert.ok(staticPage.includes('Results.Ok(pageRenderer.shell).as("text/html; charset=utf-8").withHeaders(htmlHeaders: _*)'));
  for (const forbidden of ['RequestHeader', 'composition.ready', 'composition.authority', 'composition.bindings', 'Principal', 'configuration']) {
    assert.ok(!staticPage.includes(forbidden), forbidden);
  }
  assert.ok(runtime.includes('"Cache-Control" -> "no-store"'));
  assert.ok(runtime.includes('"X-Content-Type-Options" -> "nosniff"'));
  assert.ok(runtime.includes('"Referrer-Policy" -> "no-referrer"'));
  assert.ok(runtime.includes('"Content-Security-Policy" -> "default-src \'none\'; script-src \'self\'; connect-src \'self\'; style-src \'unsafe-inline\'; base-uri \'none\'; frame-ancestors \'none\'; form-action \'none\'"'));
  const router = runtime.slice(runtime.indexOf('  override lazy val router:'));
  assert.equal(occurrences(router, 'request.method == "GET" && request.path =='), 2);
  assert.ok(router.includes('request.path == "/inventory/v1"'));
  assert.ok(router.includes('request.path == "/inventory/v1/client-script"'));
  assert.ok(router.includes('controllerComponents.actionBuilder(controllerComponents.parsers.empty) { _ => staticPage(false) }'));
  assert.ok(router.includes('controllerComponents.actionBuilder(controllerComponents.parsers.empty) { _ => staticPage(true) }'));
  assert.ok(!router.includes('case _ =>'), 'unknown paths and unsupported methods remain unhandled');
  assert.ok(!runtime.includes('extraRouter') && !runtime.includes('withFallback'));
});

test('page renderer pin changes are compiled from synchronized full source before generation', () => {
  const fixture = servicePagesFixture();
  artifact(fixture).deployment.service.pages.renderer = { id: 'example.inventory.OtherPages', version: 'pages-2' };
  synchronize(fixture);
  const output = plan(fixture);
  const contract = source(output, 'service-port');
  assert.ok(contract.includes('p.implementation == "example.inventory.OtherPages" && p.version == "pages-2"'));
  assert.ok(!contract.includes('example.inventory.InventoryPages'));
});

for (const variant of ['inventory-mixed-effect-products', 'inventory-effect-products']) test('without pages ' + variant + ' keeps the old complete plan byte-identical with no placeholders', () => {
  const old = serviceApplicationFixture(variant), restored = servicePagesFixture(variant);
  delete artifact(restored).deployment.service.pages;
  synchronize(restored);
  assert.deepEqual(restored, old);
  const expected = plan(old), actual = plan(restored);
  assert.deepEqual(actual, expected);
  assert.deepEqual(actual.plan.entries.map(e => Buffer.from(e.content, 'utf8')), expected.plan.entries.map(e => Buffer.from(e.content, 'utf8')));
  for (const entry of actual.plan.entries) {
    assert.ok(!entry.content.includes('PageRenderer'), entry.path);
    assert.ok(!entry.content.includes('def pages:'), entry.path);
    assert.ok(!entry.content.includes('pageRenderer'), entry.path);
    assert.ok(!entry.content.includes('/inventory/v1'), entry.path);
  }
});

test('page-enabled output changes only the selected service contract and loader sources', () => {
  const old = plan(serviceApplicationFixture()), enabled = plan(servicePagesFixture());
  assert.deepEqual(enabled.plan.entries.map(e => e.path), old.plan.entries.map(e => e.path));
  const changed = [];
  for (const entry of enabled.plan.entries) {
    const baseline = old.plan.entries.find(e => e.path === entry.path);
    if (entry.content !== baseline.content) changed.push(entry.kind);
    assert.deepEqual({ ...entry, content: '' }, { ...baseline, content: '' });
  }
  assert.deepEqual(changed.sort(), ['service-port', 'service-runtime']);
});
