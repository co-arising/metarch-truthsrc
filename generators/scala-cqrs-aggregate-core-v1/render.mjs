import { productionJobs, renderJobs } from '../scala-cqrs-domain-kernel-v1/render.mjs';
import { aggregateSourceEntry } from '../scala-cqrs-domain-kernel-v1/entry.mjs';
import { generatedTestArtifacts, generatedTestsTemplate } from '../scala-cqrs-domain-kernel-v1/templates/generated-tests.mjs';
import { rulesTemplate } from './templates/rules.mjs';
import { commandHelpersTemplate } from './templates/command-helpers.mjs';
import { eventHandlerTemplate } from './templates/event-handler.mjs';
import { actorProtocolTemplate } from './templates/actor-protocol.mjs';
import { aggregateTemplate } from './templates/aggregate.mjs';
import { factoryTemplate } from './templates/factory.mjs';
import { bootstrapTemplate } from './templates/bootstrap.mjs';
import { repositoryTemplate, repositoryImplementationTemplate } from './templates/repository.mjs';
import { buildArtifacts, buildTemplate } from './templates/build.mjs';
import { generatedBehaviorArtifacts, generatedBehaviorTemplate } from './templates/generated-tests.mjs';

export function render(model, footprint) {
  const jobs = productionJobs(model.kernel, model.serialization);
  for (const aggregate of model.aggregates) {
    for (const [role, template] of [
      ['rules', rulesTemplate], ['helpers', commandHelpersTemplate], ['eventHandler', eventHandlerTemplate],
      ['actorProtocol', actorProtocolTemplate], ['aggregate', aggregateTemplate], ['factory', factoryTemplate],
      ['bootstrap', bootstrapTemplate], ['repository', repositoryTemplate], ['repositoryImplementation', repositoryImplementationTemplate],
    ]) jobs.push({ artifact: aggregate[role], template: out => template(aggregate, model, out) });
  }
  for (const artifact of buildArtifacts(model)) jobs.push({ artifact, template: out => buildTemplate(artifact, out) });
  for (const artifact of generatedTestArtifacts(model.kernel, model.serialization))
    jobs.push({ artifact: { ...artifact, kind: 'generated-test' }, template: out => generatedTestsTemplate(artifact, out) });
  for (const artifact of generatedBehaviorArtifacts(model))
    jobs.push({ artifact, template: out => generatedBehaviorTemplate(artifact, out) });
  return renderJobs(jobs, footprint, aggregateSourceEntry);
}
