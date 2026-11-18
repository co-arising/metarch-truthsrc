import { ProductError } from '../../../../lib/products/request.mjs';
import { typeRef, collectDependencies } from '../../../../lib/classic-architecture/types.mjs';
import { firstLower, getBaseName } from '../../../../lib/classic-architecture/naming.mjs';
import { FieldDef } from '../../../scala-cqrs-domain/models/domain-entity.mjs';
import { ControllerModel, EndpointModel, DslFlags, GateKind, Addressing, ViewForm,
  ServesTarget, ReqVo, ErrorPayloadVo, GuardSpec, CtorArgRef, ViewReadModel } from './models.mjs';

function fail(message) { throw new ProductError('CLASSIC_API_METADATA', message); }
function record(value, kind) {
  if (!value || value._type !== kind) fail(`expected original ${kind}`);
  return value;
}
function seq(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an original sequence`);
  return value;
}
function text(value, label) {
  if (typeof value !== 'string') fail(`${label} must be a string`);
  return value;
}
function option(value, label) {
  if (value === undefined) fail(`${label} requires explicit null or an original value`);
  return value;
}
function distinct(values, key = value => JSON.stringify(value)) {
  const seen = new Set();
  return values.filter(value => {
    const identity = key(value);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
// These are the frozen Builder's API-specific lexical operations, not the
// broader NamingConventions keyword set. Main supplies the shared exact API.
function apiName(ctx, operation, value) {
  if (typeof ctx.apiNaming?.[operation] !== 'function')
    fail(`Main must supply ctx.apiNaming.${operation} (frozen ControllerBuilder semantics)`);
  return ctx.apiNaming[operation](value);
}
function resolveCommand(name, ctx) {
  for (const aggregate of ctx.metaRegistry.resolveAll('AggregateRootMetadata')) {
    const command = seq(aggregate.commandFamily.commands, 'commandFamily.commands').find(c => c.name === name);
    if (command) return { command, aggregate };
  }
  return null;
}
function requireCommand(name, ctx) {
  const result = resolveCommand(name, ctx);
  if (!result) fail(`serves=ServesCommand(${name}) is not declared in any aggregate command family`);
  return result;
}
function tierOf(name, actionName, ctx) {
  const gate = ctx.metaRegistry.resolveByName('GateDefinition', name);
  if (!gate) fail(`H053: Endpoint('${actionName}') references unregistered gate [${name}]`);
  if (gate.requiresIdentity === false && gate.requiresTenant === false) return GateKind.Anonymous;
  if (gate.requiresIdentity === true && gate.requiresTenant === false) return GateKind.Global;
  if (gate.requiresIdentity === true && gate.requiresTenant === true) return GateKind.Tenant;
  fail(`H053: gate [${name}] has contradictory or untyped identity/tenant declarations`);
}
function toServesTarget(target, ctx) {
  if (target === null) return null;
  switch (target?._type) {
    case 'ServesCommand': return ServesTarget.Command(text(target.command, 'ServesCommand.command'));
    case 'ServesView': return ServesTarget.View(text(target.viewKey, 'ServesView.viewKey'));
    case 'ServesUseCase': {
      const name = text(target.useCase, 'ServesUseCase.useCase');
      const uc = ctx.metaRegistry.resolveByName('UseCaseMetadata', name);
      // The original UseCase lookup is deliberately tolerant, not essential
      // command/repository resolution: None/Nil keep the declared default flow.
      return ServesTarget.UseCase(name, uc ? option(uc.flowMethod, 'UseCase.flowMethod') : null,
        uc ? seq(uc.flowArgs, 'UseCase.flowArgs') : []);
    }
    default: fail('unsupported original EndpointTarget');
  }
}
function errorPayload(spec, ctx) {
  record(spec, 'ErrorPayloadSpec');
  const code = text(spec.errorCode, 'errorCode');
  const condition = ctx.metaRegistry.resolveAll('InvariantRuleMetadata')
    .flatMap(rule => seq(rule.conditions, 'invariant.conditions')).find(c => c.errorCode === code);
  const pairs = seq(spec.payloadFields, 'errorPayload.payloadFields').map(pair => {
    record(pair, 'Tuple2');
    return [text(pair._1, 'payload field name'), text(pair._2, 'payload source expression')];
  });
  const message = condition ? text(condition.logic?.intent, 'invariant condition.logic.intent') : null;
  return ErrorPayloadVo(code, apiName(ctx, 'pascalCaseOf', code), pairs, message);
}
function isIdType(t) { return t._type === 'CustomType' && t.typeName === 'Id'; }
function isInstantType(t) { return t._type === 'CustomType' && t.typeName.includes('Instant'); }
function isVoList(p) {
  const t = p.parameterType;
  if (t._type !== 'CustomType' || t.typeName !== 'List') return false;
  const args = seq(t.typeParameters, 'List.typeParameters');
  return !(args.length === 1 && args[0]._type === 'StringType');
}
function skipOf(command) {
  const parameter = seq(command.parameters, 'command.parameters').find(isVoList);
  if (parameter) return `${command.name}(${parameter.name}: List[...])——VO-List 嵌套 VO 命令暂缓（B4 邻接余量）`;
  if (typeof command.isReadOnly !== 'boolean') fail('command.isReadOnly must be a boolean');
  return command.isReadOnly ? `${command.name}（查询型 Reply——读侧契约归 R5c 形态 5·暂缓）` : null;
}
function sameIdentity(p, aggregate) { return p.name.toLowerCase() === aggregate.identifier.name.toLowerCase(); }
function sessionOrFactoryField(p, kind, aggregate) {
  if (p.name === 'triggeredBy') return true;
  if (kind === GateKind.Tenant && p.name === 'tenantId') return true;
  return kind === GateKind.Global && sameIdentity(p, aggregate) && isIdType(p.parameterType);
}
const primitiveKinds = new Set(['StringType', 'IntType', 'LongType', 'DoubleType', 'BooleanType', 'BigDecimalType', 'UnitType']);
function jsonTypeOf(t, ctx) {
  if (primitiveKinds.has(t._type) && t._type !== 'UnitType') return ctx.typeResolver.resolve(t);
  if (t._type === 'CustomType') return customJsonType(t, ctx);
  if (typeof t.targetName === 'string') {
    // Preserve the frozen bare-name loss, but do not fabricate unknown refs.
    ctx.typeResolver.resolve(t);
    return typeRef(t.targetName);
  }
  fail(`unsupported Req field type: ${t._type}`);
}
function customJsonType(t, ctx) {
  if (isIdType(t) || isInstantType(t)) return typeRef('String');
  const args = seq(t.typeParameters, 'CustomType.typeParameters');
  if (t.typeName === 'List' && args.length) return typeRef('List', '', [jsonTypeOf(args[0], ctx)]);
  return typeRef(text(t.typeName, 'CustomType.typeName'), text(t.packagePath, 'CustomType.packagePath'));
}
function reqField(p, ctx) {
  if (typeof p.optional !== 'boolean') fail('command parameter.optional must be boolean');
  const mapped = jsonTypeOf(p.parameterType, ctx);
  // TypeRef.Option in this Builder is the empty-package constructor, NOT the
  // TypeResolverDSL.option overload (which uses scala).
  return FieldDef(apiName(ctx, 'scalaId', p.name), p.optional ? typeRef('Option', '', [mapped]) : mapped);
}
function explicitReq(body, ctx) {
  if (body._type === 'CustomType') return ReqVo(text(body.typeName, 'requestBody.typeName'), [], false, true);
  ctx.typeResolver.resolve(body); // essential unknown type input fails
  const simpleName = primitiveKinds.has(body._type) ? `${body._type}$` : body._type;
  return ReqVo(simpleName, [], false, true);
}
function derivedReq(command, strictFields, ctx) {
  return strictFields.length ? ReqVo(`${command.name}Req`, strictFields.map(p => reqField(p, ctx)), false)
    : ReqVo('play.api.libs.json.JsObject', [], true);
}
function idGuardOf(command, kind, aggregate, pathKey, ctx) {
  const refs = command.parameters.filter(p => {
    if (!isIdType(p.parameterType)) return false;
    if (kind === GateKind.Tenant && p.name === 'tenantId' && p !== pathKey) return false;
    return !(kind === GateKind.Global && sameIdentity(p, aggregate));
  });
  if (!refs.length) return null;
  return GuardSpec(refs.map(p => [p.name, p === pathKey ? 'id' : `req.${apiName(ctx, 'scalaId', p.name)}`]),
    refs.map(p => apiName(ctx, 'cidNameOf', p.name)));
}
function instantGuardOf(strictFields, ctx) {
  const refs = strictFields.filter(p => isInstantType(p.parameterType));
  if (!refs.length) return null;
  return GuardSpec(refs.map(p => [p.name, `req.${apiName(ctx, 'scalaId', p.name)}`]),
    refs.map(p => apiName(ctx, 'instantBindOf', p.name)));
}
function ctorArg(p, kind, aggregate, pathKey, ctx) {
  if (p === pathKey) return CtorArgRef.FromPathId(p.name, apiName(ctx, 'cidNameOf', p.name));
  if (p.name === 'triggeredBy') return CtorArgRef.FromSessionUser(p.name, kind);
  if (p.name === 'tenantId' && kind === GateKind.Tenant) return CtorArgRef.FromSessionTenant(p.name);
  if (kind === GateKind.Global && sameIdentity(p, aggregate) && isIdType(p.parameterType)) return CtorArgRef.FromGeneratedId(p.name);
  return bodyCtorArg(p, ctx);
}
function bodyCtorArg(p, ctx) {
  if (isIdType(p.parameterType)) return CtorArgRef.FromGuard(p.name, apiName(ctx, 'cidNameOf', p.name));
  if (isInstantType(p.parameterType)) return CtorArgRef.FromInstantGuard(p.name, apiName(ctx, 'instantBindOf', p.name));
  return p.optional ? CtorArgRef.FromBodyOptional(p.name) : CtorArgRef.FromBody(p.name);
}
function commandAxis(ep, gate, kind, serves, payloads, ctx) {
  const { command, aggregate } = requireCommand(serves.command, ctx);
  const skip = skipOf(command);
  if (skip !== null) return { gate, gateKind: kind, serves, errorPayloads: payloads, skip };
  const pathKey = kind === GateKind.Tenant
    ? command.parameters.find(p => isIdType(p.parameterType) && sameIdentity(p, aggregate)) ?? null : null;
  const strictFields = command.parameters.filter(p => p !== pathKey && !sessionOrFactoryField(p, kind, aggregate));
  const body = option(ep.requestBody, 'endpoint.requestBody');
  return { gate, gateKind: kind, serves, errorPayloads: payloads,
    reqVo: body === null ? derivedReq(command, strictFields, ctx) : explicitReq(body, ctx),
    sourceReferences: [...command.parameters.map(p => ctx.typeResolver.resolveField(p.parameterType, p.optional)),
      ...(body === null ? [] : [ctx.typeResolver.resolve(body)])],
    idGuard: idGuardOf(command, kind, aggregate, pathKey, ctx), instantGuard: instantGuardOf(strictFields, ctx),
    ctorArgs: command.parameters.map(p => ctorArg(p, kind, aggregate, pathKey, ctx)),
    addressing: pathKey === null ? Addressing.Factory : Addressing.Path };
}
function viewFormOf(ep) {
  const ps = seq(ep.parameters, 'endpoint.parameters');
  if (ps.length === 2 && ps[0].name === 'page' && ps[0].parameterType._type === 'IntType' &&
    ps[1].name === 'pageSize' && ps[1].parameterType._type === 'IntType') return ViewForm.ListView;
  if (ps.length === 1 && ps[0].name === 'entityId' && ps[0].parameterType._type === 'StringType') return ViewForm.ItemView;
  fail(`Endpoint('${ep.actionName}') ServesView requires (page: Int, pageSize: Int) or (entityId: String), in that order`);
}
function viewAxis(ep, gate, kind, viewKey, ctx) {
  const definition = ctx.metaRegistry.resolveByName('ViewKeyDefinition', viewKey);
  if (!definition) fail(`H052: unregistered ServesView(${viewKey})`);
  if (kind === GateKind.Anonymous) fail(`ServesView(${viewKey}) does not support anonymous reads`);
  const form = viewFormOf(ep);
  if (typeof definition.singleKey !== 'boolean') fail('ViewKeyDefinition.singleKey must be boolean');
  if (form === ViewForm.ItemView && !definition.singleKey && kind !== GateKind.Tenant)
    fail('composite-key view item requires the Tenant gate kind');
  const ref = record(definition.repository, 'ProjectionRepositoryRef');
  const repository = ctx.metaRegistry.resolveByName('ProjectionRepositoryMetadata', ref.targetName);
  if (!repository) fail(`ServesView(${viewKey}) has unresolved repository ${ref.targetName}`);
  const repoType = ctx.typeResolver.projectionRepository(repository.name);
  const base = getBaseName(repository.name);
  const rowType = ctx.typeResolver.projectionDtoType(base, `${base}Table`, ctx.layout.application.projection.repository.root);
  return { gate, gateKind: kind, serves: ServesTarget.View(viewKey),
    readModel: ViewReadModel(viewKey, apiName(ctx, 'viewConstName', viewKey), rowType,
      FieldDef(firstLower(repoType.name), repoType), form, definition.singleKey) };
}
function dslAxis(ep, ctx) {
  const ref = option(ep.gate, 'endpoint.gate');
  if (ref === null) return {}; // DO NOT inspect serves/body/error declarations on the legacy path.
  record(ref, 'GateRef');
  const gate = text(ref.value, 'GateRef.value');
  const kind = tierOf(gate, ep.actionName, ctx);
  const serves = toServesTarget(option(ep.serves, 'endpoint.serves'), ctx);
  const payloads = seq(ep.errorPayloads, 'endpoint.errorPayloads').map(spec => errorPayload(spec, ctx));
  if (serves?.kind === 'Command') return commandAxis(ep, gate, kind, serves, payloads, ctx);
  if (serves?.kind === 'View') return viewAxis(ep, gate, kind, serves.viewKey, ctx);
  const body = option(ep.requestBody, 'endpoint.requestBody');
  return { gate, gateKind: kind, serves, errorPayloads: payloads,
    reqVo: body === null ? null : explicitReq(body, ctx),
    sourceReferences: body === null ? [] : [ctx.typeResolver.resolve(body)] };
}
function endpoint(meta, ctx) {
  record(meta, 'EndpointMetadata');
  const axis = dslAxis(meta, ctx);
  const parameters = seq(meta.parameters, 'endpoint.parameters').map(p =>
    FieldDef(text(p.name, 'endpoint parameter.name'), ctx.typeResolver.resolve(p.parameterType)));
  // The original Builder ignores parameter.optional and all parameter docs here.
  return EndpointModel(text(meta.method, 'endpoint.method'), text(meta.path, 'endpoint.path'),
    text(meta.actionName, 'endpoint.actionName'), parameters, text(meta.logic?.intent, 'endpoint.logic.intent'),
    ctx.typeResolver.resolve(meta.responseType), axis);
}
function flags(endpoints) {
  return DslFlags(endpoints.some(e => e.gate !== null && e.skip === null),
    endpoints.some(e => e.skip === null && e.reqVo?.hasEmptyBody === true),
    endpoints.some(e => e.errorPayloads.length > 0), endpoints.some(e => e.serves?.kind === 'UseCase'));
}
function baseDependencies(ctx) {
  return ['ControllerComponents', 'BaseController', 'Action', 'AnyContent', 'Request', 'Json', 'ExecutionContext', 'Future'].map(name => {
    const ref = ctx.knownFrameworkTypes[name];
    if (!ref) fail(`missing ctx.knownFrameworkTypes.${name}`);
    return ref;
  });
}
function dependenciesOf(endpoints, services, ctx) {
  const refs = [...baseDependencies(ctx), ...endpoints.flatMap(e => [...e.parameters.map(p => p.typeRef), e.returnType]),
    ...services.map(s => s.typeRef)];
  return collectDependencies(refs).filter(ref => !/^[\x00-\x20]*$/u.test(ref.packageName) &&
    !['Any', 'String', 'Int', 'Long', 'Boolean', 'Unit'].includes(ref.name) &&
    ref.packageName !== 'scala' && ref.packageName !== 'java.lang');
}
function commandAggregatesOf(endpoints, ctx) {
  return distinct(endpoints.filter(e => e.serves?.kind === 'Command').map(e => requireCommand(e.serves.command, ctx).aggregate));
}
function parkRepository(active, commandAggregates, ctx) {
  const aggregates = commandAggregatesOf(active.filter(e => e.errorPayloads.length), ctx);
  if (!aggregates.length) return null;
  const aggregate = aggregates[0];
  if (!commandAggregates.some(a => a.name === aggregate.name)) fail('409 aggregate differs from controller command aggregate');
  if (typeof ctx.effectiveProjectionAggregates !== 'function')
    fail('Main must supply ctx.effectiveProjectionAggregates(meta), the original computed ProjectionMetadata.effectiveAggregates member');
  const projections = ctx.metaRegistry.resolveAll('ProjectionMetadata')
    .filter(p => seq(ctx.effectiveProjectionAggregates(p), 'projection.effectiveAggregates').includes(aggregate.name));
  if (projections.length !== 1) fail(`409 precheck requires exactly one projection for ${aggregate.name}; found ${projections.length}`);
  const ref = projections[0].repositoryRef;
  if (ref === null || ref === undefined) fail('409 projection requires repositoryRef');
  // Original string overload, not a second repository-resolution policy.
  const repoType = ctx.typeResolver.projectionRepository(ref.targetName);
  return FieldDef(firstLower(repoType.name), repoType);
}
function backfill(endpoints, services, deps, ctx) {
  const active = endpoints.filter(e => e.gate !== null && e.skip === null);
  const aggregates = commandAggregatesOf(active, ctx);
  if (aggregates.length > 1) fail('DSL controller command repository injection supports one aggregate only');
  const repository = aggregates.length ? FieldDef('repository', ctx.typeResolver.aggregateRepository(aggregates[0].name)) : null;
  const park = parkRepository(active, aggregates, ctx);
  const views = distinct(active.flatMap(e => e.readModel === null ? [] : [e.readModel.repository]), f => f.typeRef.name);
  const flows = distinct(active.filter(e => e.serves?.kind === 'UseCase').map(e => e.serves.useCase))
    .map(name => FieldDef(`${firstLower(name)}Flow`, typeRef(`${name}Flow`, ctx.layout.application.root)));
  // Preserve park/view duplicates and old dependency entries. Only metadata
  // services with the same short repository type names are removed.
  const repos = [repository, park].filter(v => v !== null);
  const repoNames = new Set([...repos, ...views].map(f => f.typeRef.name));
  const finalServices = [...repos, ...views, ...flows, ...services.filter(s => !repoNames.has(s.typeRef.name))];
  const protocols = aggregates.map(a => typeRef(`${getBaseName(a.name)}Protocol`, ctx.layout.application.aggregates.root));
  return { services: finalServices, dependencies: distinct([...deps, ...repos.map(f => f.typeRef),
    ...views.map(f => f.typeRef), ...flows.map(f => f.typeRef), ...protocols]) };
}
function noteIdsOf(endpoints, ctx) {
  const owners = distinct(endpoints.filter(e => e.serves?.kind === 'Command')
    .map(e => resolveCommand(e.serves.command, ctx)?.aggregate).filter(Boolean), a => a.name);
  const commandNotes = owners.flatMap(a => a.noteId === null || a.noteId === undefined ? [] : [a.noteId]);
  const viewNotes = endpoints.flatMap(e => {
    if (e.readModel === null) return [];
    const name = e.readModel.repository.typeRef.name;
    const repo = ctx.metaRegistry.resolveAll('DomainDrivenMetadata')
      .find(m => m.name === name && m._type === 'ProjectionRepositoryMetadata');
    if (!repo) return [];
    const projection = ctx.metaRegistry.resolveAll('ProjectionMetadata').find(p => p.repositoryRef?.targetName === name);
    return projection?.noteId === null || projection?.noteId === undefined ? [] : [projection.noteId];
  });
  return distinct([...commandNotes, ...viewNotes]);
}
export function buildClassicController(meta, ctx) {
  record(meta, 'ControllerMetadata');
  const selfType = ctx.typeResolver.controller(text(meta.name, 'controller.name'));
  const endpoints = seq(meta.endpoints, 'controller.endpoints').map(ep => endpoint(ep, ctx));
  const noteIds = noteIdsOf(endpoints, ctx);
  const services = seq(meta.dependencies, 'controller.dependencies').map(dep => {
    const ref = ctx.typeResolver.resolve(dep);
    if (!ref.name.length) fail('injected service type requires a nonempty name');
    return FieldDef(firstLower(ref.name), ref);
  });
  const deps = dependenciesOf(endpoints, services, ctx);
  const dslFlags = flags(endpoints);
  const final = dslFlags.aggHasDsl ? backfill(endpoints, services, deps, ctx) : { services, dependencies: deps };
  return ControllerModel(selfType, text(meta.basePath, 'controller.basePath'), final.services, endpoints,
    final.dependencies, dslFlags, text(ctx.basePackage, 'ctx.basePackage'), noteIds);
}
