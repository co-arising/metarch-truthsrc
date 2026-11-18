import { artifact, rawArtifact } from '../../../../lib/classic-architecture/assembly.mjs';
import { typeRef } from '../../../../lib/classic-architecture/types.mjs';
import { buildClassicController } from './build-controller.mjs';
import { renderClassicController } from './controller-template.mjs';
import { buildClassicCommandDsl, renderClassicCommandDsl, CommandDslPackage } from './command-dsl.mjs';
import { buildClassicRoutes, renderClassicRoutes } from './routes.mjs';

export { buildClassicController, renderClassicController, buildClassicCommandDsl, renderClassicCommandDsl,
  buildClassicRoutes, renderClassicRoutes };
export { buildClassicRoutesFragment, renderClassicRoutesFragment } from './routes.mjs';
export * from './models.mjs';

// This is a hold declaration, not an empty successful collector for a fourth
// family. Main's scope gate must retain ORACLE_MISSING until custody supplies it.
export const heldFamilies = Object.freeze([
  Object.freeze({ key: 'aggregate-state-controller', status: 'ORACLE_MISSING', implemented: false }),
]);
function location(product, suffix) {
  return { document: product.source.document, pointer: product.source.pointer + suffix };
}
function controllerReferences(model) {
  const fields = model.endpoints.flatMap(e => [
    ...e.parameters.map(p => p.typeRef), e.returnType, ...e.sourceReferences,
    ...(e.reqVo === null ? [] : e.reqVo.reqFields.map(f => f.typeRef)),
    ...(e.readModel === null ? [] : [e.readModel.rowType, e.readModel.repository.typeRef]),
  ]);
  // File association for the five top-level support constructs in CommandDsl,
  // NOT an extra import or a fabricated runtime type named CommandDsl.
  return [...fields, ...(model.dslFlags.aggHasDsl ? [typeRef('CommandDsl', CommandDslPackage)] : [])];
}
export function buildArtifacts(product, ctx) {
  const interfaces = product.system.interfaces;
  const models = interfaces.controllers.map(meta => buildClassicController(meta, ctx));
  const controllers = models.map((model, index) => artifact(model, renderClassicController,
    'http-controller', location(product, `/interfaces/controllers/${index}`), controllerReferences(model)));
  const dsl = buildClassicCommandDsl(interfaces, ctx);
  const routes = buildClassicRoutes(models, ctx);
  const globals = [];
  if (dsl !== null) globals.push(artifact(dsl, renderClassicCommandDsl, 'command-endpoint-dsl', location(product, '/interfaces')));
  if (routes !== null) {
    const referencedControllers = models.filter(model => model.endpoints.some(e => e.gate !== null && e.skip === null));
    globals.push(rawArtifact(routes, renderClassicRoutes, 'route-definition', location(product, '/interfaces'),
      { path: 'conf/routes', stamp: 'none', ownerType: null }, referencedControllers.map(model => model.selfType)));
  }
  // Original generateInterfaceLayer order: controllers, global support, routes.
  // Main alone selects/stamps/applies these descriptors and manages source maps.
  return [...controllers, ...globals];
}
