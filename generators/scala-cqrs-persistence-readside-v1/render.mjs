import { productionJobs } from '../scala-cqrs-aggregate-core-v1/render.mjs';
import { renderJobs } from '../scala-cqrs-domain-kernel-v1/render.mjs';
import { persistenceSourceEntry } from '../scala-cqrs-domain-kernel-v1/entry.mjs';
import { generatedTestArtifacts, generatedTestsTemplate } from '../scala-cqrs-domain-kernel-v1/templates/generated-tests.mjs';
import { generatedBehaviorArtifacts, generatedBehaviorTemplate } from '../scala-cqrs-aggregate-core-v1/templates/generated-tests.mjs';
import { frameTemplate, persistenceTemplate, adapterTemplate, configTemplate } from './templates/persistence.mjs';
import { envelopeTemplate } from './templates/envelope.mjs';
import { schemaTemplate, sqlTemplate } from './templates/schema.mjs';
import { repositoryTemplate, handlerTemplate } from './templates/repository.mjs';
import { sourceTemplate, runnerTemplate } from './templates/runner.mjs';
import { buildArtifacts, buildTemplate, generatedPersistenceTest } from './templates/build.mjs';

/** One complete job graph and one final-byte writer, including reused family2. */
export function render(m, footprint) {
  const jobs = productionJobs(m.family), n = m.names;
  const add = (path, kind, sources, directDeps, template) => jobs.push({ artifact: { path, kind, sources, directDeps }, template });
  const artifact = (key, kind, directDeps, template, sources = m.sources) => add(n[key].path, kind, sources, directDeps, template);
  add(m.frameProtoPath, 'proto', [m.product.wire.source], [], out => frameTemplate(m, out));
  artifact('persistence', 'persistence-runtime', [m.frameProtoPath, m.converter.path, m.aggregate.base.protocol.path, m.aggregate.base.state.path], out => persistenceTemplate(m, out));
  for (const [key, kind] of [['eventAdapter', 'event-adapter'], ['snapshotAdapter', 'snapshot-adapter'], ['serializer', 'serializer'], ['factory', 'aggregate-factory']]) {
    const deps = [n.persistence.path, m.frameProtoPath];
    if (key === 'factory') deps.push(n.eventAdapter.path, n.snapshotAdapter.path, m.aggregate.bootstrap.path);
    artifact(key, kind, deps, out => adapterTemplate(m, key, out));
  }
  artifact('envelope', 'read-model', [n.persistence.path, m.aggregate.base.state.path, ...m.index.keyCarrier.chain.map(c => c.path), ...m.index.valueCarrier.chain.map(c => c.path)], out => envelopeTemplate(m, out));
  artifact('schema', 'projection-schema', [], out => schemaTemplate(m, out));
  add(m.sqlPath, 'projection-schema', [m.product.store.bindingSource, m.index.source], [], out => sqlTemplate(m, out));
  artifact('repository', 'projection-repository', [n.schema.path, n.envelope.path, n.persistence.path], out => repositoryTemplate(m, out));
  artifact('handler', 'projection-handler', [n.repository.path, n.persistence.path, m.aggregate.eventHandler.path], out => handlerTemplate(m, out));
  artifact('source', 'event-source', [n.repository.path, n.envelope.path], out => sourceTemplate(m, out));
  artifact('runner', 'projection-runner', [n.source.path, n.handler.path, n.repository.path, n.envelope.path], out => runnerTemplate(m, out));
  add('modules/glue/src/main/resources/reference.conf', 'serialization-config', [m.product.wire.source, ...m.registrations.map(r => r.source)],
    [n.serializer.path, m.frameProtoPath], out => configTemplate(m, out));
  for (const a of buildArtifacts(m)) jobs.push({ artifact: a, template: out => buildTemplate(m, a, out) });
  for (const a of generatedTestArtifacts(m.family.kernel, m.family.serialization))
    jobs.push({ artifact: { ...a, kind: 'generated-test' }, template: out => generatedTestsTemplate(a, out) });
  for (const a of generatedBehaviorArtifacts(m.family)) jobs.push({ artifact: a, template: out => generatedBehaviorTemplate(a, out) });
  const testPath = 'modules/glue/src/test/scala/' + n.persistence.package.replaceAll('.', '/') + '/' + n.persistence.name + 'RoundTripSpec.scala';
  add(testPath, 'generated-test', [m.product.wire.source, m.aggregate.source], [n.persistence.path, m.frameProtoPath], out => generatedPersistenceTest(m, out));
  return renderJobs(jobs, footprint, persistenceSourceEntry);
}
