import { copyImmutableData } from '../../../../lib/immutable-data.mjs';
import { fqn, typeRef } from '../../../../lib/classic-architecture/types.mjs';

// Frozen ControllerModel.scala value vocabulary. Scala None is null and Set is
// a structurally deduplicated immutable array. No model contains emitted files.
const immutable = value => copyImmutableData(value);
export const GateKind = Object.freeze({ Anonymous: 'Anonymous', Global: 'Global', Tenant: 'Tenant' });
export const Addressing = Object.freeze({ Path: 'Path', Factory: 'Factory' });
export const ViewForm = Object.freeze({ ListView: 'ListView', ItemView: 'ItemView' });
export const ServesTarget = Object.freeze({
  Command: command => immutable({ kind: 'Command', command }),
  UseCase: (useCase, flowMethod = null, flowArgs = []) => immutable({ kind: 'UseCase', useCase, flowMethod, flowArgs }),
  View: viewKey => immutable({ kind: 'View', viewKey }),
});
export const CtorArgRef = Object.freeze({
  FromPathId: (paramName, bindName) => immutable({ kind: 'FromPathId', paramName, bindName }),
  FromSessionUser: (paramName, gateKind) => immutable({ kind: 'FromSessionUser', paramName, gateKind }),
  FromSessionTenant: paramName => immutable({ kind: 'FromSessionTenant', paramName }),
  FromGeneratedId: paramName => immutable({ kind: 'FromGeneratedId', paramName }),
  FromGuard: (paramName, bindName) => immutable({ kind: 'FromGuard', paramName, bindName }),
  FromInstantGuard: (paramName, bindName) => immutable({ kind: 'FromInstantGuard', paramName, bindName }),
  FromBody: paramName => immutable({ kind: 'FromBody', paramName }),
  FromBodyOptional: paramName => immutable({ kind: 'FromBodyOptional', paramName }),
});
export function ReqVo(reqName, reqFields, hasEmptyBody, explicit = false) {
  return immutable({ reqName, reqFields, hasEmptyBody, explicit });
}
export function ErrorPayloadVo(errorCode, payloadName, payloadFields, conflictMessage = null) {
  return immutable({ errorCode, payloadName, payloadFields, conflictMessage });
}
export function GuardSpec(pairs, binds) { return immutable({ pairs, binds }); }
export function ViewReadModel(viewKey, constName, rowType, repository, form, singleKey) {
  return immutable({ viewKey, constName, rowType, repository, form, singleKey });
}
export function DslFlags(aggHasDsl = false, aggHasEmptyBody = false, needsParkRepo = false, needsRegisterFlow = false) {
  return immutable({ aggHasDsl, aggHasEmptyBody, needsParkRepo, needsRegisterFlow });
}
export function EndpointModel(method, path, actionName, parameters, serviceMethod, returnType, axis = {}) {
  return immutable({ method, path, actionName, parameters, serviceMethod, returnType,
    gate: axis.gate ?? null, gateKind: axis.gateKind ?? null, serves: axis.serves ?? null,
    reqVo: axis.reqVo ?? null, errorPayloads: axis.errorPayloads ?? [],
    idGuard: axis.idGuard ?? null, instantGuard: axis.instantGuard ?? null,
    ctorArgs: axis.ctorArgs ?? [], addressing: axis.addressing ?? null,
    readModel: axis.readModel ?? null, skip: axis.skip ?? null,
    sourceReferences: axis.sourceReferences ?? [] });
}
export function ControllerModel(selfType, basePath, injectedServices, endpoints, dependencies,
  dslFlags = DslFlags(), modulePkg = null, noteIds = []) {
  return immutable({ selfType, basePath, injectedServices, endpoints, dependencies,
    dslFlags, modulePkg, noteIds, morphisms: [], fqn: fqn(selfType) });
}
export function CommandDslModel(selfType, dependencies) {
  return immutable({ selfType, dependencies, morphisms: [], noteIds: [], fqn: fqn(selfType) });
}
export function RoutesFragmentModel(routeLines, selfType = typeRef('routes', 'conf'), dependencies = [], noteIds = []) {
  return immutable({ routeLines, selfType, dependencies, noteIds, morphisms: [], fqn: fqn(selfType) });
}
// Whole-file composition is separate from the frozen fragment. existingRoutes
// is ORIGINAL input text, not expected output. null explicitly means no file.
export function RoutesFileModel(fragment, existingRoutes) {
  return immutable({ ...fragment, existingRoutes });
}
