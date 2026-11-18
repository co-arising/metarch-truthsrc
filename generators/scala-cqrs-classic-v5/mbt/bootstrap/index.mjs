import { classicArtifact } from '../../../../lib/classic-architecture/paths.mjs';
import {
  buildClassicAggregateBootstrap, buildClassicProjectionBootstrap,
  buildClassicSagaCoordinatorBootstrap, buildClassicSagaTransactorBootstrap,
} from './bootstrap-builder.mjs';
import { buildClassicApplicationBootstrap } from './application-bootstrap-builder.mjs';
import { renderClassicBootstrap } from './bootstrap-template.mjs';
import { renderClassicApplicationBootstrap } from './application-bootstrap-template.mjs';

export {
  ClassicBootstrapModel, AggregateBootstrapType, SagaCoordinatorBootstrapType,
  ProjectionBootstrapType, SagaTransactorBootstrapType,
} from './bootstrap-model.mjs';
export { ClassicApplicationBootstrapModel } from './application-bootstrap-model.mjs';
export {
  SagaRegistrationStartupModel, SagaEngineStartupModel,
  AggregateStartupModel, ProjectionStartupModel,
} from './startup-models.mjs';
export {
  buildClassicAggregateBootstrap, buildClassicProjectionBootstrap,
  buildClassicSagaCoordinatorBootstrap, buildClassicSagaTransactorBootstrap,
  buildClassicApplicationBootstrap, renderClassicBootstrap, renderClassicApplicationBootstrap,
};
export {
  renderClassicAggregateBootstrap, renderClassicProjectionBootstrap,
  renderClassicSagaCoordinatorBootstrap, renderClassicSagaTransactorBootstrap,
} from './bootstrap-template.mjs';
export { renderClassicStartup } from './application-bootstrap-template.mjs';

/** CQRSApplicationGenerator.generateBootstraps L1140–1194 in original order.
 * The optional third argument is for Main's future admitted strict entry facts
 * lowered to the original Seq[String]. Default F1 is [], never guessed from
 * retained strictInput. The dispatcher, not the standalone builder, suppresses
 * strict wiring in multi-project mode (runCommon L216–220).
 */
export function buildArtifacts(product, ctx, strictEntries = []) {
  const { system, source } = product;
  const location = pointer => ({ document: source.document, pointer: source.pointer + pointer });
  const entries = [];
  system.application.aggregates.forEach((meta, i) => {
    const model = buildClassicAggregateBootstrap(meta, ctx);
    entries.push(classicArtifact(model, renderClassicBootstrap, 'bootstrap',
      location(`/application/aggregates/${i}`), ctx, model.references));
  });
  if (system.application.sagas.length > 0) {
    const model = buildClassicSagaCoordinatorBootstrap(ctx, system.application.sagas);
    entries.push(classicArtifact(model, renderClassicBootstrap, 'bootstrap',
      location('/application/sagas'), ctx, model.references));
  }
  system.application.sagas.forEach((meta, i) => {
    const model = buildClassicSagaTransactorBootstrap(meta, ctx);
    entries.push(classicArtifact(model, renderClassicBootstrap, 'bootstrap',
      location(`/application/sagas/${i}`), ctx, model.references));
  });
  system.infrastructure.projections.forEach((meta, i) => {
    const model = buildClassicProjectionBootstrap(meta, ctx);
    entries.push(classicArtifact(model, renderClassicBootstrap, 'bootstrap',
      location(`/infrastructure/projections/${i}`), ctx, model.references));
  });
  const model = buildClassicApplicationBootstrap(system, ctx, ctx.multiProject ? [] : strictEntries);
  // Global bootstrap is a different comparison family, but its ORIGINAL writer
  // attribution is still kind=bootstrap (glue). Let classicArtifact own that
  // physical path/stamp, then expose the v5 family key without a second writer.
  const application = classicArtifact(model, renderClassicApplicationBootstrap, 'bootstrap',
    location(''), ctx, model.references);
  entries.push({ ...application, kind: 'application-bootstrap' });
  return entries;
}
