import { classicArtifact } from '../../../../lib/classic-architecture/paths.mjs';
import { buildClassicSagaParticipant } from './participant-builder.mjs';
import { buildClassicSagaDefinition } from './definition-builder.mjs';
import { buildClassicSagaContext } from './context-builder.mjs';
import { renderClassicSagaParticipant, renderClassicSagaDefinition, renderClassicSagaContext } from './templates.mjs';
import { sequence } from './shared.mjs';

export * from './models.mjs';
export {
  buildClassicSagaParticipant, renderClassicSagaParticipant,
  buildClassicSagaDefinition, renderClassicSagaDefinition,
  buildClassicSagaContext, renderClassicSagaContext,
};

function location(source, sagaIndex, suffix = '') {
  return { document: source.document, pointer: source.pointer + '/application/sagas/' + sagaIndex + suffix };
}

function participantReferences(model) {
  const asks = [model.prepareBinding, model.commitBinding, model.compensateBinding].filter(ask => ask !== null);
  return [model.contextType, ...model.constructorParams.map(field => field.typeRef),
    ...asks.flatMap(ask => [ask.commandType, ask.replyType])];
}

function definitionReferences(model) {
  return [model.contextType, ...model.argsFields.map(field => field.typeRef),
    ...model.steps.map(step => step.participantType)];
}

/** Unstamped descriptors only. Preserve the original collection indices and
 * application participants -> definition order, then the later Context pass.
 * No strict, trigger, bootstrap, engine adapter or top-level Args outputs.
 */
export function buildArtifacts(product, ctx) {
  const sagas = sequence(product.system.application.sagas, 'application.sagas');
  const artifacts = [];
  sagas.forEach((saga, sagaIndex) => {
    sequence(saga.participants, 'saga.participants').forEach((participant, participantIndex) => {
      const model = buildClassicSagaParticipant(participant, saga, ctx);
      artifacts.push(classicArtifact(
        model, renderClassicSagaParticipant, 'saga-participant',
        location(product.source, sagaIndex, '/participants/' + participantIndex), ctx, participantReferences(model),
      ));
    });
    const definition = buildClassicSagaDefinition(saga, ctx);
    artifacts.push(classicArtifact(
      definition, renderClassicSagaDefinition, 'saga-definition', location(product.source, sagaIndex),
      ctx, definitionReferences(definition),
    ));
  });
  sagas.forEach((saga, sagaIndex) => {
    const model = buildClassicSagaContext(saga, ctx);
    artifacts.push(classicArtifact(
      model, renderClassicSagaContext, 'saga-context', location(product.source, sagaIndex),
      ctx, model.fields.map(field => field.typeRef),
    ));
  });
  return artifacts;
}
