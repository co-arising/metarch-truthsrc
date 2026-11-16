import { entry } from '../scala-cqrs-domain/naming.mjs';
import { renderAggregate } from '../scala-cqrs-domain/render-domain.mjs';
import { buildAggregateModels } from './build-aggregate-models.mjs';
import { legacyTemplate, protocolTemplate } from './templates/aggregate-protocol.mjs';
import { behaviorTemplate } from './templates/aggregate-behavior.mjs';
import { aggregateTemplate, factoryTemplate } from './templates/aggregate-factory.mjs';
import { bootstrapTemplate } from './templates/aggregate-bootstrap.mjs';
import { repositoryTemplate } from './templates/aggregate-repository.mjs';

const templates = Object.freeze({
  legacy: legacyTemplate,
  protocol: protocolTemplate,
  behavior: behaviorTemplate,
  aggregate: aggregateTemplate,
  factory: factoryTemplate,
  bootstrap: bootstrapTemplate,
  repository: repositoryTemplate
});

export function renderAggregateLayers(context, footprint) {
  const entries = buildAggregateModels(context).map(model => {
    const render = templates[model.role];
    if (!render) throw new TypeError('unsupported aggregate artifact role');
    const output = render(model, context.options);
    const { path, kind, sources, dependencies } = model.artifact;
    return entry(path, typeof output === 'string' ? output : output.content, kind, sources, footprint,
      dependencies, typeof output === 'string' ? [] : output.codeMappings);
  });
  return [...renderAggregate(context, footprint, true), ...entries];
}
