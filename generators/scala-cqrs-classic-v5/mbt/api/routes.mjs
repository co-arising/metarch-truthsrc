import { ProductError } from '../../../../lib/products/request.mjs';
import { signature } from '../../../../lib/classic-architecture/types.mjs';
import { RoutesFragmentModel, RoutesFileModel } from './models.mjs';

export const MarkerStart = '# >>> codegen:controllers (do not edit inside; regenerated) >>>';
export const MarkerEnd = '# <<< codegen:controllers <<<';
export const NewFileHeader = Object.freeze([
  '# Routes — marker-block managed by CodegenMain (S2-41 R7):',
  '# inside the codegen:controllers markers below is generated territory (regenerated wholesale);',
  '# anything outside the markers is manual territory (never modified by the generator).',
]);
export const AppendNotice = '# The codegen:controllers block below is managed by CodegenMain (inside markers = generated; outside = manual).';

function queryDefault(e, field) {
  // Preserve the source's substring test and lack of a GET condition. Do not
  // reinterpret parameters as tokens or honor a FieldDef defaultValue here.
  if (e.path.includes(`:${field.name}`)) return '';
  if (field.typeRef.name !== 'Int') return '';
  if (field.name === 'page') return ' ?= 1';
  return field.name === 'pageSize' ? ' ?= 20' : '';
}
function params(e) {
  if (!e.parameters.length) return '';
  return '(' + e.parameters.map(p => `${p.name}: ${signature(p.typeRef)}${queryDefault(e, p)}`).join(', ') + ')';
}
function routeLine(controller, endpoint) {
  // padTo(9) does not truncate longer methods or insert an extra tenth column.
  return endpoint.method.padEnd(9, ' ') + endpoint.path + '  controllers.' +
    controller.selfType.name + '.' + endpoint.actionName + params(endpoint);
}
function routesOf(controller) {
  if (!Array.isArray(controller.endpoints))
    throw new ProductError('CLASSIC_API_ROUTES_MODEL', 'ControllerModel.endpoints must be an explicit sequence');
  return controller.endpoints.flatMap(endpoint => {
    if (endpoint.gate === undefined || endpoint.skip === undefined)
      throw new ProductError('CLASSIC_API_ROUTES_MODEL', 'EndpointModel.gate/skip require explicit null or values');
    if (endpoint.gate === null || endpoint.skip !== null) return [];
    if (!Array.isArray(endpoint.parameters))
      throw new ProductError('CLASSIC_API_ROUTES_MODEL', 'EndpointModel.parameters must be an explicit sequence');
    return [routeLine(controller, endpoint)];
  });
}
export function buildClassicRoutesFragment(controllerModels) {
  if (!Array.isArray(controllerModels))
    throw new ProductError('CLASSIC_API_ROUTES_MODEL', 'controllerModels must be the ordered model sequence');
  const lines = controllerModels.flatMap(routesOf);
  return lines.length ? RoutesFragmentModel(lines) : null;
}
export function buildClassicRoutes(controllerModels, ctx) {
  const fragment = buildClassicRoutesFragment(controllerModels);
  if (fragment === null) return null; // No declaration -> no artifact, no deletion, no base dependency.
  if (!Object.hasOwn(ctx, 'routesBase'))
    throw new ProductError('CLASSIC_API_ROUTES_BASE',
      'Main must supply ctx.routesBase from custodied ORIGINAL scaffold/routes (or explicit original existing text/null); never expected output');
  if (ctx.routesBase !== null && typeof ctx.routesBase !== 'string')
    throw new ProductError('CLASSIC_API_ROUTES_BASE', 'ctx.routesBase must be original UTF-8 text or explicit null for an absent file');
  return RoutesFileModel(fragment, ctx.routesBase);
}
export function renderClassicRoutesFragment(model) {
  return [MarkerStart, ...model.routeLines, MarkerEnd].join('\n');
}
export function renderClassicRoutes(model) {
  const block = renderClassicRoutesFragment(model), original = model.existingRoutes;
  // Pure composition of MarkerBlockWriter.write's three text branches. No
  // filesystem access/private writer; the centralized raw descriptor applies it.
  if (original === null) return [...NewFileHeader, block].join('\n') + '\n';
  if (typeof original !== 'string')
    throw new ProductError('CLASSIC_API_ROUTES_BASE', 'whole routes renderer requires explicit ORIGINAL existingRoutes input');
  const start = original.indexOf(MarkerStart);
  const end = start < 0 ? -1 : original.indexOf(MarkerEnd, start + MarkerStart.length);
  if (start >= 0 && end >= 0)
    return original.slice(0, start) + block + original.slice(end + MarkerEnd.length);
  if (start < 0 && original.indexOf(MarkerEnd) < 0)
    // Java Pattern's default \s is ASCII [ \t\n\x0B\f\r], not JS Unicode \s.
    return original.replace(/[ \t\n\x0B\f\r]+$/u, '') + '\n\n' + AppendNotice + '\n' + block + '\n';
  throw new ProductError('CLASSIC_API_ROUTES_MARKERS',
    `[MarkerBlockWriter] conf/routes 标记态畸形（markerStart@${start} markerEnd@${original.indexOf(MarkerEnd)}）——半标记状态不可静默合并（追加会产生双起始标记，下轮段替换将吞掉手写领地）；请手工修复标记对后重跑`);
}
