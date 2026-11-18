import { classicArtifact } from '../../../../lib/classic-architecture/paths.mjs';
import { buildClassicProjection } from './build.mjs';
import { ProjectionHandlerModel } from './models.mjs';
import { renderClassicProjection } from './projection-template.mjs';
import { renderClassicProjectionHandler } from './handler-template.mjs';

export { ApplyEventFunction, ProjectionAggregateSource, ProjectionHandlerModel, ProjectionModel } from './models.mjs';
export { buildClassicProjection, renderClassicProjection, renderClassicProjectionHandler };

function projectionReferences(model) {
  return [
    model.sourceAggregate, model.sourceProtoEventType, model.repository,
    ...model.handlers.map(handler => handler.selfType),
    ...model.aggregateSources.flatMap(source => [source.aggregate, source.protoEventType]),
  ];
}

/** Frozen raw dispatcher order: projection, then every model.handlers entry.
 * Main owns stamping, ownership/dependency assembly, and all actual writes.
 * The same complete meta/typed ctx is shared with projection-repository; no DTO
 * builder, type resolver or sink implementation is copied into this owner.
 */
export function buildArtifacts(product, ctx) {
  const { system, source } = product;
  return system.infrastructure.projections.flatMap((meta, index) => {
    const model = buildClassicProjection(meta, ctx);
    const location = {
      document: source.document,
      pointer: source.pointer + '/infrastructure/projections/' + index,
    };
    const projection = classicArtifact(model, renderClassicProjection, 'projection', location, ctx, projectionReferences(model));
    const handlers = model.handlers.map(handler => {
      // CQRSApplicationGenerator:890–896 supplies the owning projection's IDs,
      // NOT handler-local IDs. Neither the builder nor this collector stamps text.
      const stamped = ProjectionHandlerModel({ ...handler, noteIds: model.noteIds });
      const handlerSource = {
        document: source.document,
        pointer: location.pointer + '/handlers/' + handler.sourceIndex,
      };
      return classicArtifact(stamped, renderClassicProjectionHandler, 'projection-handler', handlerSource, ctx,
        [stamped.event, stamped.repository, stamped.entityEventType]);
    });
    return [projection, ...handlers];
  });
}
