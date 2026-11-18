import { classicArtifact } from '../../../../lib/classic-architecture/paths.mjs';
import {
  buildClassicSagaTriggerProtocol, buildClassicSagaTriggerEntity,
  buildClassicSagaTriggerRoot, buildClassicSagaTriggerBehaviors,
} from './build.mjs';
import { renderClassicSagaTriggerProtocol } from './templates/protocol.mjs';
import { renderClassicSagaTriggerEntity } from './templates/entity.mjs';
import { renderClassicSagaTriggerRoot } from './templates/root.mjs';
import { renderClassicSagaTriggerBehaviors } from './templates/behaviors.mjs';

export {
  SagaTriggerCommandModel, SagaTriggerProtocolModel, SagaTriggerEntityModel,
  SagaTriggerRootModel, SagaTriggerBehaviorsModel,
} from './models.mjs';
export {
  buildClassicSagaTriggerProtocol, buildClassicSagaTriggerEntity,
  buildClassicSagaTriggerRoot, buildClassicSagaTriggerBehaviors,
  renderClassicSagaTriggerProtocol, renderClassicSagaTriggerEntity,
  renderClassicSagaTriggerRoot, renderClassicSagaTriggerBehaviors,
};

// CQRSApplicationGenerator.scala:759–770: every original application.sagas
// member, Protocol -> Entity -> Root -> Behaviors. No strict protocol fallback,
// participant/definition/bootstrap generation, fixture lookup, stamp or I/O.
export function buildArtifacts(product, ctx) {
  return product.system.application.sagas.flatMap((meta, index) => {
    const source = {
      document: product.source.document,
      pointer: product.source.pointer + '/application/sagas/' + index,
    };
    const protocol = buildClassicSagaTriggerProtocol(meta, ctx);
    const entity = buildClassicSagaTriggerEntity(meta, ctx);
    const root = buildClassicSagaTriggerRoot(meta, ctx);
    const behaviors = buildClassicSagaTriggerBehaviors(meta, ctx);
    return [
      classicArtifact(protocol, renderClassicSagaTriggerProtocol, 'saga-trigger-protocol', source, ctx, [
        protocol.confirmationType, protocol.statusCommandType,
        protocol.transactionResultType, protocol.tracingStepType,
        ...protocol.triggerCommands.flatMap(command => command.params.map(parameter => parameter.typeRef)),
      ]),
      classicArtifact(entity, renderClassicSagaTriggerEntity, 'saga-trigger-entity', source, ctx, [
        entity.stateType, entity.statusType, ...entity.argsFields.map(field => field.typeRef),
      ]),
      classicArtifact(root, renderClassicSagaTriggerRoot, 'saga-trigger-root', source, ctx, [
        protocol.selfType, root.commandType, root.coordinatorType, root.contextType, root.behaviorsType,
      ]),
      classicArtifact(behaviors, renderClassicSagaTriggerBehaviors, 'saga-trigger-behaviors', source, ctx, [
        protocol.selfType, entity.selfType, behaviors.stateType, behaviors.eventType,
        behaviors.commandType, behaviors.definitionType, behaviors.argsType,
        behaviors.confirmationType, behaviors.statusCommandType,
        behaviors.coordinatorType, behaviors.contextType, behaviors.transactionResultType,
        ...behaviors.argsFields.map(field => field.typeRef),
        ...behaviors.triggerCommands.flatMap(command => command.params.map(parameter => parameter.typeRef)),
      ]),
    ];
  });
}
