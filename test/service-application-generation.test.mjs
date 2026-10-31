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
