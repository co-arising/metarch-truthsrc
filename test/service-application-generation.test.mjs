import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { generate } from '../generators/scala-cqrs-play-service/generate.mjs';
import { serviceApplicationFixture } from './service-application-fixture.mjs';
const manifest = JSON.parse(readFileSync(new URL('../generators/scala-cqrs-play-service/generator.json', import.meta.url), 'utf8'));

test('complete explicit service profile retains finite execution and emits Play source without target writes', () => {
  const { request, options } = serviceApplicationFixture(), compilation = compileProductSet(request);
  assert.deepEqual(compilation.diagnostics, []);
  const first = generate({ compilation, manifest, options });
  assert.deepEqual(first.diagnostics, []);
  assert.deepEqual(first, generate({ compilation, manifest, options }));
  const entries = first.plan.entries;
  assert.ok(entries.find(e => e.path === 'build.sbt').content.includes('enablePlugins(PlayScala)'));
  assert.ok(entries.find(e => e.path === 'conf/application.conf').content.includes('include "service.conf"'));
  assert.ok(entries.some(e => e.kind === 'service-port' && e.content.includes('trait Factory')));
  assert.ok(entries.some(e => e.kind === 'service-runtime' && e.content.includes('composition.authority.authenticate')));
  assert.ok(entries.some(e => e.kind === 'effect-host'));
  const config = entries.find(e => e.path === 'src/test/resources/service-unit.conf').content;
  assert.ok(config.includes('akka.persistence.snapshot-store.plugin = "akka.persistence.testkit.snapshotstore.pluginid"'));
  assert.ok(config.includes('akka.persistence.journal.plugin = "akka.persistence.testkit.journal"'));
  assert.ok(!config.includes('service.conf'));
  assert.ok(!entries.find(e => e.path === 'conf/serialization.conf').content.includes('akka.persistence.snapshot-store.plugin'));
  const build = entries.find(e => e.path === 'build.sbt').content;
  assert.ok(build.includes('Test / fork := true') && build.includes('-Dconfig.resource=service-unit.conf'));
  assert.ok(build.includes('UnitTestMain') && build.includes('definedTests'));
  assert.ok(build.includes('d.organization == "net.imadz" && d.name == "saga-core"'));
  assert.ok(build.includes('.exclude("com.github.scullxbones", "akka-persistence-mongo-scala_2.13")'));
  assert.ok(build.includes('.exclude("org.reactivemongo", "reactivemongo_2.13")'));
  const guard = entries.find(e => e.path === 'src/test/scala/UnitConfigurationCheck.scala').content;
  assert.ok(guard.includes('checkConnect') && guard.includes('checkListen'));
  const service = entries.find(e => e.path === 'conf/service.conf').content;
  assert.ok(service.includes('${MONGO_URI}') && service.includes('${MYSQL_JDBC_URL}') && !service.includes('${?'));
  const host = entries.find(e => e.path.endsWith('GeneratedFiniteHostSpec.scala')).content;
  assert.ok(host.includes('"workflow-effect-" + mode, auditBindings'));
  for (const entry of entries) for (const pin of entry.productFootprint) {
    if (pin.id === 'artifact-contract') assert.equal(pin.version, '3');
    if (['saga-host-contract', 'effect-host-contract'].includes(pin.id)) assert.equal(pin.version, '2');
  }
});

for (const hosted of [true, false]) test(`service test isolation declares artifact input for ${hosted ? 'hosted' : 'unhosted'} inspection`, () => {
  const { request, options } = serviceApplicationFixture('inventory-effect-products');
  if (!hosted) {
    request.documents.find(d => d.id === 'domain').value.effectHosts = [];
    request.documents.find(d => d.id === 'effects').value.effects.hosts = [];
    const inspection = request.documents.find(d => d.id === 'execution').value.pipelines[0].ports.find(p => p.id === 'InspectAssociation');
    Object.assign(inspection, { effect: 'pure', confirmation: 'checkpoint', idempotency: { mode: 'none' } });
    for (const document of request.documents) {
      const replaceProvenance = value => {
        if (!value || typeof value !== 'object') return;
        if (value.document === 'domain' && value.pointer === '/effectHosts/0') value.pointer = '/pipelines/0';
        for (const child of Object.values(value)) replaceProvenance(child);
      };
      replaceProvenance(document.value);
    }
  }
  const compilation = compileProductSet(request);
  assert.deepEqual(compilation.diagnostics, []);
  const incomplete = structuredClone(manifest);
  const producer = incomplete.producers.find(p => p.id === (hosted ? 'durable-effect-host-dsl' : 'finite-execution-dsl'));
  producer.products = producer.products.filter(p => p !== 'artifact-contract');
  const rejected = generate({ compilation, manifest: incomplete, options });
  assert.equal(rejected.plan, null);
  assert.ok(rejected.diagnostics.some(d => d.code === 'PRODUCT_UNDECLARED'));
  const result = generate({ compilation, manifest, options });
  assert.deepEqual(result.diagnostics, []);
  const name = hosted ? 'GeneratedEffectHostSpec.scala' : 'GeneratedExecutionSpec.scala';
  const spec = result.plan.entries.find(e => e.path.endsWith(name));
  assert.ok(spec, name);
  assert.ok(spec.content.includes('UnitConfigurationCheck.main(Array.empty)'));
  assert.ok(spec.productFootprint.some(p => p.id === 'artifact-contract' && p.version === '3'));
});

test('service configuration test uses literal dotted connection references', () => {
  const { request, options } = serviceApplicationFixture();
  const domain = request.documents.find(d => d.id === 'domain').value;
  const artifact = domain.artifactContracts.find(a => a.id === options.service.artifact);
  const journal = artifact.deployment.service.journal;
  const readSide = artifact.deployment.service.readSide;
  const names = { [journal.connectionRef]: 'journal.primary', [readSide.connectionRef]: 'read.primary' };
  for (const ref of artifact.deployment.secretRefs) if (names[ref.id]) ref.id = names[ref.id];
  journal.connectionRef = 'journal.primary';
  readSide.connectionRef = 'read.primary';
  request.documents.find(d => d.id === 'artifacts').value.artifacts.artifacts = domain.artifactContracts.map((a, i) => ({ ...structuredClone(a), source: { document: 'domain', pointer: '/artifactContracts/' + i } }));
  const compilation = compileProductSet(request);
  assert.deepEqual(compilation.diagnostics, []);
  const result = generate({ compilation, manifest, options });
  assert.deepEqual(result.diagnostics, []);
  const spec = result.plan.entries.find(e => e.path.endsWith('GeneratedUnitStorageSpec.scala')).content;
  for (const ref of ['journal.primary', 'read.primary']) assert.ok(spec.includes('ConfigUtil.joinPath("service", "connections", "' + ref + '")'));
});
