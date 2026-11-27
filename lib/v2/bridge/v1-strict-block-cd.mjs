// Block C & Block D Bridge: canonical-v2.json -> 1.0 Strict-Governance Families
//   Block C (7 curated 1.0 families):
//     - protocol-layer (#7)          -> domain/services/*Computations, application/aggregates/*Protocol, *CommandHelpers
//     - aggregate-layer (#6)         -> domain/*Aggregate, application/aggregates/*Aggregate, *Factory, *Behaviors
//     - aggregate-repository (#12)   -> application/aggregates/repository/*Repository, infrastructure/persistence/*RepositoryImpl
//     - aggregate-bootstrap (#47)    -> infrastructure/bootstrap/*Bootstrap
//     - proto-schema (#29)           -> protobuf/shared_value_objects.proto, protobuf/<agg>.proto
//     - proto-converter (#30)        -> infrastructure/persistence/converters/DomainProtoConverters, <Agg>ProtoConverter
//     - serialization-adapter (#31)  -> infrastructure/persistence/DomainProtoSerializer, <Agg>EventAdapter, <Agg>SnapshotAdapter
//   Block D (Play service runtime, project scaffold, ReadSide projection, 5-layer Authz PEP/PDP, DI Bootstrap):
//     - service-runtime (#38)        -> service/<Service>Service, <Service>Loader, ApplicationBootstrap, <Service>Configuration, conf/routes, conf/application.conf
//     - project-scaffold (#39)       -> conf/serialization.conf, build.sbt, project/build.properties, project/plugins.sbt
//     - projection-apply-event (#26) -> infrastructure/readside/*ApplyEvent, *Semantics, *ProjectionModule (when readModels map events)
//     - authz-pep-dsl (v2)           -> interfaces/api/ApiDto (5-layer Authz PEP/PDP), interfaces/http/*Controller, HttpRouter, interfaces/web/PlayHttpBridge,
//                                       application/connectors/OutboundConnectors, infrastructure/persistence/InMemoryStore, infrastructure/connectors/DefaultOutboundConnectors, modules/BootstrapModule
import { resolveCanonicalEventFields } from '../structure-loader.mjs';
import { resolveRuntimeProfile } from '../../runtime-profile.mjs';
import { deriveStoryHttpRoutes, toCamel, toPascal } from '../codegen/onion-routes.mjs';
import { family as protocolLayerFamily } from '../../../emitter/families/protocol-layer.mjs';
import { family as aggregateLayerFamily } from '../../../emitter/families/aggregate-layer.mjs';
import { family as aggregateRepositoryFamily } from '../../../emitter/families/aggregate-repository.mjs';
import { family as aggregateBootstrapFamily } from '../../../emitter/families/aggregate-bootstrap.mjs';
import { family as protoSchemaFamily } from '../../../emitter/families/proto-schema.mjs';
import { family as protoConverterFamily } from '../../../emitter/families/proto-converter.mjs';
import { family as serializationAdapterFamily } from '../../../emitter/families/serialization-adapter.mjs';
import { family as serviceRuntimeFamily } from '../../../emitter/families/service-runtime.mjs';
import { family as projectScaffoldFamily } from '../../../emitter/families/project-scaffold.mjs';
import { family as projectionApplyEventFamily } from '../../../emitter/families/projection-apply-event.mjs';

function toSnake(name) {
  return String(name ?? '')
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_|_$/gu, '')
    .toLowerCase();
}

function buildNominalIndex(canonicalV2) {
  const exactByName = new Map();
  for (const ex of canonicalV2.structures?.exactTypes ?? []) exactByName.set(ex.name, ex);
  const voByName = new Map();
  for (const vo of canonicalV2.structures?.valueObjects ?? []) voByName.set(vo.name, vo);
  return { exactByName, voByName };
}

function toV1TypeTree(rt, context, nominalIdx) {
  if (!rt || typeof rt !== 'object') return { form: 'primitive', name: 'string' };
  switch (rt.kind) {
    case 'int': return { form: 'primitive', name: 'integer' };
    case 'bool': return { form: 'primitive', name: 'boolean' };
    case 'string': return { form: 'primitive', name: 'string' };
    case 'decimal': return { form: 'primitive', name: 'decimal' };
    case 'optional': return { form: 'optional', element: toV1TypeTree(rt.element, context, nominalIdx) };
    case 'sequence': return { form: 'sequence', element: toV1TypeTree(rt.element, context, nominalIdx) };
    case 'map':
      return { form: 'map', key: { form: 'primitive', name: 'string' }, value: toV1TypeTree(rt.value, context, nominalIdx) };
    case 'record':
      if (rt.typeName && (nominalIdx.exactByName.has(rt.typeName) || nominalIdx.voByName.has(rt.typeName))) {
        return { form: 'nominal', context, name: rt.typeName };
      }
      return { form: 'primitive', name: 'string' };
    default: return { form: 'primitive', name: 'string' };
  }
}

function protoScalarType(kind) {
  switch (kind) {
    case 'int': return 'int64';
    case 'bool': return 'bool';
    case 'decimal': return 'string';
    case 'string':
    default: return 'string';
  }
}

function toProtoFieldSpec(fieldName, rt, number, nominalIdx) {
  if (!rt || typeof rt !== 'object') return { modifier: '', type: 'string', name: fieldName, number };
  switch (rt.kind) {
    case 'int':
    case 'bool':
    case 'string':
    case 'decimal':
      return { modifier: '', type: protoScalarType(rt.kind), name: fieldName, number };
    case 'optional': {
      const inner = rt.element;
      if (inner?.kind === 'record' && (nominalIdx.exactByName.has(inner.typeName) || nominalIdx.voByName.has(inner.typeName))) {
        return { modifier: 'optional', type: `${inner.typeName}PO`, name: fieldName, number };
      }
      return { modifier: 'optional', type: protoScalarType(inner?.kind), name: fieldName, number };
    }
    case 'sequence': {
      const inner = rt.element;
      if (inner?.kind === 'record' && (nominalIdx.exactByName.has(inner.typeName) || nominalIdx.voByName.has(inner.typeName))) {
        return { modifier: 'repeated', type: `${inner.typeName}PO`, name: fieldName, number };
      }
      return { modifier: 'repeated', type: protoScalarType(inner?.kind), name: fieldName, number };
    }
    case 'map': {
      const v = rt.value;
      const vProto = (v?.kind === 'record' && (nominalIdx.exactByName.has(v.typeName) || nominalIdx.voByName.has(v.typeName)))
        ? `${v.typeName}PO`
        : protoScalarType(v?.kind);
      return { modifier: '', type: `map<string, ${vProto}>`, name: fieldName, number };
    }
    case 'record':
      if (rt.typeName && (nominalIdx.exactByName.has(rt.typeName) || nominalIdx.voByName.has(rt.typeName))) {
        return { modifier: '', type: `${rt.typeName}PO`, name: fieldName, number };
      }
      return { modifier: '', type: 'string', name: fieldName, number };
    default:
      return { modifier: '', type: 'string', name: fieldName, number };
  }
}

function toConverterTypeInfo(rt, nominalIdx) {
  if (!rt || typeof rt !== 'object') return { kind: 'primitive', primitive: 'string' };
  const primName = k => (k === 'int' ? 'integer' : k === 'bool' ? 'boolean' : k === 'decimal' ? 'decimal' : 'string');
  switch (rt.kind) {
    case 'int':
    case 'bool':
    case 'string':
    case 'decimal':
      return { kind: 'primitive', primitive: primName(rt.kind) };
    case 'record':
      if (rt.typeName && (nominalIdx.exactByName.has(rt.typeName) || nominalIdx.voByName.has(rt.typeName))) {
        return { kind: 'nominal', poName: `${rt.typeName}PO`, typeId: rt.typeName };
      }
      return { kind: 'primitive', primitive: 'string' };
    case 'optional': {
      const el = rt.element;
      if (el?.kind === 'record' && (nominalIdx.exactByName.has(el.typeName) || nominalIdx.voByName.has(el.typeName))) {
        return { kind: 'optional-nominal', poName: `${el.typeName}PO`, typeId: el.typeName };
      }
      return { kind: 'optional-primitive', primitive: primName(el?.kind) };
    }
    case 'sequence': {
      const el = rt.element;
      if (el?.kind === 'record' && (nominalIdx.exactByName.has(el.typeName) || nominalIdx.voByName.has(el.typeName))) {
        return { kind: 'repeated-nominal', poName: `${el.typeName}PO`, typeId: el.typeName };
      }
      return { kind: 'repeated-primitive', primitive: primName(el?.kind) };
    }
    case 'map': {
      const v = rt.value;
      const valueInfo = (v?.kind === 'record' && (nominalIdx.exactByName.has(v.typeName) || nominalIdx.voByName.has(v.typeName)))
        ? { kind: 'nominal', poName: `${v.typeName}PO`, typeId: v.typeName }
        : { kind: 'primitive', primitive: primName(v?.kind) };
      return { kind: 'map', keyInfo: { kind: 'primitive', primitive: 'string' }, valueInfo };
    }
    default:
      return { kind: 'primitive', primitive: 'string' };
  }
}

/**
 * Block C: Emit all 7 curated 1.0 Aggregate + Protocol + Repository + Bootstrap + Protobuf families.
 */
export function emitV1BlockC(canonicalV2, { packageName = 'example.v2', runtimeProfile = null } = {}) {
  const context = canonicalV2.context || canonicalV2.subdomain || 'core';
  const docId = `${canonicalV2.system || 'v2'}/${context}`;
  const nominalIdx = buildNominalIndex(canonicalV2);
  const aggregates = canonicalV2.structures?.aggregates ?? [];
  const files = {};
  const familiesUsed = [];

  if (aggregates.length === 0) return { files, familiesUsed, protoPaths: [] };

  const aggsWithCmds = aggregates.filter(a => (a.commands ?? []).length > 0);
  const aggsWithEvents = aggregates.filter(a => (a.events ?? []).length > 0);

  // 1. protocol-layer (#7) -> domain/services/<Agg>Computations, application/aggregates/<Agg>Protocol & <Agg>CommandHelpers
  if (aggsWithCmds.length > 0) {
    const plInput = {
      schemaVersion: 'truthsrc.protocol-layer-input/v1',
      ...(runtimeProfile ? { runtimeProfile } : {}),
      packages: [{ context, package: packageName }],
      aggregates: aggsWithCmds.map((agg, aIdx) => ({
        context,
        name: agg.name,
        source: { document: docId, pointer: `/aggregates/${aIdx}` },
        commands: (agg.commands ?? []).map((cmd, cIdx) => ({
          name: cmd.name,
          source: { document: docId, pointer: `/aggregates/${aIdx}/commands/${cIdx}` },
          parameters: (cmd.parameters ?? []).map(p => ({
            name: p.name,
            valueType: toV1TypeTree(p.resolvedType, context, nominalIdx),
          })),
        })),
        hosts: [],
        externalProducers: [],
      })),
    };
    Object.assign(files, protocolLayerFamily.renderAll(plInput));
    familiesUsed.push('protocol-layer');
  }

  // 2. aggregate-layer (#6) -> domain/<Agg>Aggregate, application/aggregates/<Agg>Aggregate, factories/<Agg>AggregateFactory, behaviors/<Agg>Behaviors
  if (aggsWithCmds.length > 0) {
    const alInput = {
      schemaVersion: 'truthsrc.aggregate-layer-input/v1',
      ...(runtimeProfile ? { runtimeProfile } : {}),
      packages: [{ context, package: packageName }],
      aggregates: aggsWithCmds.map((agg, aIdx) => ({
        context,
        name: agg.name,
        source: { document: docId, pointer: `/aggregates/${aIdx}` },
        commands: (agg.commands ?? []).map((cmd, cIdx) => ({
          name: cmd.name,
          source: { document: docId, pointer: `/aggregates/${aIdx}/commands/${cIdx}` },
        })),
        externalProducers: [],
      })),
    };
    Object.assign(files, aggregateLayerFamily.renderAll(alInput));
    familiesUsed.push('aggregate-layer');
  }

  // 3. aggregate-repository (#12) -> application/aggregates/repository/<Agg>Repository, infrastructure/persistence/<Agg>RepositoryImpl
  const arInput = {
    schemaVersion: 'truthsrc.aggregate-repository-input/v1',
    packages: [{ context, package: packageName }],
    repositories: aggregates.map((agg, aIdx) => ({
      context,
      name: agg.name,
      lookup: 'owned-local-actor-cache',
      source: { document: docId, pointer: `/aggregates/${aIdx}` },
    })),
  };
  Object.assign(files, aggregateRepositoryFamily.renderAll(arInput));
  familiesUsed.push('aggregate-repository');

  // 4. aggregate-bootstrap (#47) -> infrastructure/bootstrap/<Agg>Bootstrap
  const abInput = {
    schemaVersion: 'truthsrc.aggregate-bootstrap-input/v1',
    packages: [{ context, package: packageName }],
    bootstraps: aggregates.map((agg, aIdx) => ({
      context,
      name: agg.name,
      persistenceIdentity: 'unique-id',
      authority: false,
      source: { document: docId, pointer: `/aggregates/${aIdx}` },
    })),
  };
  Object.assign(files, aggregateBootstrapFamily.renderAll(abInput));
  familiesUsed.push('aggregate-bootstrap');

  // 5. proto-schema (#29) -> app/protobuf/shared_value_objects.proto + app/protobuf/<agg>.proto
  const protoPackage = `${packageName}.infrastructure.proto`;
  const protoFiles = [];
  const sharedVoMessages = [];
  const serializerEntries = [];
  const converterVos = [];

  (canonicalV2.structures?.exactTypes ?? []).forEach((ex, idx) => {
    const poName = `${ex.name}PO`;
    const amountField = ex.amountField ?? (ex.form === 'unit-decimal' ? 'amount' : 'value');
    const unitField = ex.form === 'unit-decimal' ? (ex.unitField ?? 'currency') : null;
    const fields = [{ modifier: '', type: 'string', name: amountField, number: 1 }];
    if (unitField) fields.push({ modifier: '', type: 'string', name: unitField, number: 2 });
    sharedVoMessages.push({ name: poName, fields });
    const src = { document: docId, pointer: `/exactTypes/${idx}` };
    serializerEntries.push({ poName, sources: [src] });
    converterVos.push({
      kind: 'exact',
      poName,
      typeId: ex.name,
      sources: [src],
      exact: {
        domainName: ex.name[0].toLowerCase() + ex.name.slice(1),
        amountField,
        ...(unitField ? { unitField } : {}),
        scale: Number.isInteger(ex.scale) && ex.scale > 0 ? ex.scale : 2,
        minor: false,
        representations: [{ capital: 'PO' }],
      },
    });
  });

  (canonicalV2.structures?.valueObjects ?? []).forEach((vo, idx) => {
    const poName = `${vo.name}PO`;
    const voFields = (vo.fields ?? []).length > 0
      ? vo.fields
      : [{ name: 'value', resolvedType: { kind: 'string' } }];
    sharedVoMessages.push({
      name: poName,
      fields: voFields.map((f, fi) => toProtoFieldSpec(f.name, f.resolvedType, fi + 1, nominalIdx)),
    });
    const src = { document: docId, pointer: `/valueObjects/${idx}` };
    serializerEntries.push({ poName, sources: [src] });
    converterVos.push({
      kind: 'record',
      poName,
      typeId: vo.name,
      sources: [src],
      fields: voFields.map(f => ({ name: f.name, typeInfo: toConverterTypeInfo(f.resolvedType, nominalIdx) })),
    });
  });

  const hasSharedVos = sharedVoMessages.length > 0;
  if (hasSharedVos) {
    protoFiles.push({
      path: 'app/protobuf/shared_value_objects.proto',
      kind: 'proto',
      packageName: protoPackage,
      imports: ['scalapb/scalapb.proto'],
      messages: sharedVoMessages,
      deps: [],
      sources: [{ document: docId, pointer: '/structures' }],
    });
  }

  const converterAggs = [];
  const adapterSpecs = [];

  aggsWithEvents.forEach((agg, aIdx) => {
    const aggSnake = toSnake(agg.name);
    const aggProtoPath = `app/protobuf/${aggSnake}.proto`;
    const stateFieldsRaw = (agg.stateFields ?? []).length > 0
      ? agg.stateFields
      : [{ name: agg.idField || 'id', resolvedType: { kind: 'string' } }];
    const statePoName = `${agg.name}StatePO`;
    const eventUnionPoName = `${agg.name}EventPO`;
    const aggSource = { document: docId, pointer: `/aggregates/${aIdx}` };

    const messages = [
      {
        name: statePoName,
        fields: stateFieldsRaw.map((sf, fi) => toProtoFieldSpec(sf.name, sf.resolvedType, fi + 1, nominalIdx)),
      },
    ];
    serializerEntries.push({ poName: statePoName, sources: [aggSource] });

    const oneofFields = [];
    const convEvents = [];
    const adapterEvents = [];

    (agg.events ?? []).forEach((ev, eIdx) => {
      const evPoName = `${agg.name}${ev.name}PO`;
      const evFields = resolveCanonicalEventFields(agg, ev);
      const evSource = { document: docId, pointer: `/aggregates/${aIdx}/events/${eIdx}` };
      messages.push({
        name: evPoName,
        fields: evFields.map((f, fi) => toProtoFieldSpec(f.name, f.resolvedType, fi + 1, nominalIdx)),
      });
      oneofFields.push({ modifier: '', type: evPoName, name: toSnake(ev.name), number: eIdx + 1 });
      serializerEntries.push({ poName: evPoName, sources: [evSource] });
      convEvents.push({
        eventId: ev.name,
        poName: evPoName,
        fields: evFields.map(f => ({ name: f.name, typeInfo: toConverterTypeInfo(f.resolvedType, nominalIdx) })),
      });
      adapterEvents.push({ eventName: ev.name, poName: evPoName, source: evSource });
    });

    messages.push({
      name: eventUnionPoName,
      fields: [],
      oneofs: [{ name: 'event', fields: oneofFields }],
    });
    serializerEntries.push({ poName: eventUnionPoName, sources: [aggSource] });

    protoFiles.push({
      path: aggProtoPath,
      kind: 'proto',
      packageName: protoPackage,
      imports: hasSharedVos ? ['scalapb/scalapb.proto', 'shared_value_objects.proto'] : ['scalapb/scalapb.proto'],
      messages,
      deps: [],
      sources: [aggSource],
    });

    converterAggs.push({
      aggId: agg.name,
      statePoName,
      eventUnionPoName,
      stateSources: [aggSource],
      stateFields: stateFieldsRaw.map(sf => ({ name: sf.name, typeInfo: toConverterTypeInfo(sf.resolvedType, nominalIdx) })),
      events: convEvents,
    });

    adapterSpecs.push({
      context,
      aggregate: agg.name,
      eventUnionPoName,
      statePoName,
      aggregateSource: aggSource,
      events: adapterEvents,
    });
  });

  const protoPaths = protoFiles.map(f => f.path);
  if (protoFiles.length > 0) {
    Object.assign(files, protoSchemaFamily.renderAll({
      schemaVersion: 'truthsrc.proto-schema-input/v1',
      files: protoFiles,
    }));
    familiesUsed.push('proto-schema');
  }

  // 6. proto-converter (#30) -> infrastructure/persistence/converters/*
  if (converterAggs.length > 0) {
    const vosForConverter = converterVos.length > 0
      ? converterVos
      : [{
          kind: 'record',
          poName: `${toPascal(context)}MarkerPO`,
          typeId: `${toPascal(context)}Marker`,
          sources: [{ document: docId, pointer: '/structures' }],
          fields: [{ name: 'value', typeInfo: { kind: 'primitive', primitive: 'string' } }],
        }];
    if (converterVos.length > 0) {
      Object.assign(files, protoConverterFamily.renderAll({
        schemaVersion: 'truthsrc.proto-converter-input/v1',
        ...(runtimeProfile ? { runtimeProfile } : {}),
        packages: [{ context, package: packageName }],
        contexts: [{
          context,
          deps: protoPaths,
          valueObjects: vosForConverter,
          aggregates: converterAggs,
        }],
      }));
      familiesUsed.push('proto-converter');
    }
  }

  // 7. serialization-adapter (#31) -> infrastructure/persistence/DomainProtoSerializer, <Agg>EventAdapter, <Agg>SnapshotAdapter
  if (adapterSpecs.length > 0 && serializerEntries.length > 0 && protoPaths.length > 0) {
    Object.assign(files, serializationAdapterFamily.renderAll({
      schemaVersion: 'truthsrc.serialization-adapter-input/v1',
      packages: [{ context, package: packageName }],
      serializers: [{
        context,
        identifier: 741000,
        protoPaths,
        entries: serializerEntries,
      }],
      adapters: adapterSpecs,
    }));
    familiesUsed.push('serialization-adapter');
  }

  return { files, familiesUsed, protoPaths };
}

function emitStrictInterfacesAndAuthz(canonicalV2, packageName, commonPackage) {
  const pkgDir = packageName.split('.').join('/');
  const routes = deriveStoryHttpRoutes(canonicalV2);
  const appBehaviors = (canonicalV2.behaviors ?? []).filter(b => b.layer === 'application');
  const out = {};

  // 1. application/connectors/OutboundConnectors.scala
  const connLines = [
    `package ${packageName}.application.connectors`,
    '',
    'final case class OutboundEffectRecord(kind: String, target: String, payload: Map[String, Any])',
    '',
    'trait OutboundConnectorsPort {',
  ];
  for (const beh of appBehaviors) {
    const pascal = toPascal(beh.target);
    const camel = toCamel(pascal);
    connLines.push(`  def ${camel}Externs: ${packageName}.application.services.${pascal}ExternPorts`);
    connLines.push(`  def ${camel}Effects: ${packageName}.application.services.${pascal}EffectsPort`);
  }
  connLines.push('  def recordedEffects: Seq[OutboundEffectRecord]', '}', '');
  out[`app/${pkgDir}/application/connectors/OutboundConnectors.scala`] = connLines.join('\n');

  // 2. interfaces/api/ApiDto.scala (full 2.0 5-layer Authz PEP/PDP: IDOR, bindPrincipal, EntitlementPort, rowScope, External PDP + CSRF)
  out[`app/${pkgDir}/interfaces/api/ApiDto.scala`] = [
    `package ${packageName}.interfaces.api`,
    '',
    'final case class Principal(',
    '  id: String,',
    '  roles: Set[String] = Set.empty,',
    '  tenantId: Option[String] = None,',
    '  attributes: Map[String, Any] = Map.empty,',
    '  entitlements: Set[String] = Set.empty',
    ')',
    '',
    'final case class AuthzResource(',
    '  resourceType: String,',
    '  id: Option[String] = None,',
    '  ownerField: Option[String] = None,',
    '  ownerId: Option[String] = None,',
    '  relation: Option[String] = None',
    ')',
    '',
    'final case class AuthzEntitlement(',
    '  code: String,',
    '  source: Option[String] = None,',
    '  matchParam: Option[String] = None',
    ')',
    '',
    'final case class AuthzDecisionQuery(',
    '  principal: Principal,',
    '  callerKind: String,',
    '  action: String,',
    '  scope: Option[String] = None,',
    '  policyRef: Option[String] = None,',
    '  context: Map[String, Any] = Map.empty,',
    '  resource: Option[AuthzResource] = None,',
    '  entitlements: Seq[AuthzEntitlement] = Seq.empty',
    ')',
    '',
    'final case class AuthzDecisionResult(allowed: Boolean, code: Option[String] = None)',
    '',
    'trait AuthorizationPort { def decide(query: AuthzDecisionQuery): Boolean }',
    'trait EntitlementPort { def hasEntitlement(principal: Principal, entitlement: AuthzEntitlement, matchValue: Option[Any]): Boolean }',
    '',
    'trait HttpAuthority {',
    '  def authenticate(req: HttpRequest): Option[Principal]',
    '  def authorize(principal: Principal, route: RouteDescriptor): Boolean',
    '  def authorizeWithRequest(principal: Principal, route: RouteDescriptor, req: HttpRequest): Boolean = authorize(principal, route)',
    '  def authorizeDetailed(principal: Principal, route: RouteDescriptor, req: HttpRequest): AuthzDecisionResult =',
    '    if (authorizeWithRequest(principal, route, req)) AuthzDecisionResult(allowed = true)',
    '    else AuthzDecisionResult(allowed = false, code = Some("NOT_AUTHORIZED"))',
    '  def verifyCsrf(req: HttpRequest): Boolean = true',
    '}',
    '',
    'object PrincipalResolver {',
    '  def resolveField(principal: Principal, key: String): Option[Any] = {',
    '    if (key == "id" || key == "principal.id") Some(principal.id)',
    '    else if (key == "tenantId" || key == "principal.tenantId") principal.tenantId',
    '    else if (key == "roles" || key == "principal.roles") Some(principal.roles)',
    '    else if (key.startsWith("principal.attributes.")) principal.attributes.get(key.drop(21))',
    '    else if (key.startsWith("attributes.")) principal.attributes.get(key.drop(11))',
    '    else principal.attributes.get(key)',
    '  }',
    '}',
    '',
    'object AllowAllAuthority extends HttpAuthority {',
    '  override def authenticate(req: HttpRequest): Option[Principal] = Some(Principal("system-default", Set("*")))',
    '  override def authorize(principal: Principal, route: RouteDescriptor): Boolean = true',
    '}',
    '',
    'final class RoleBasedAuthority(',
    '  authFn: HttpRequest => Option[Principal],',
    '  pdp: Option[AuthorizationPort] = None,',
    '  csrfFn: HttpRequest => Boolean = _ => true,',
    '  entitlementPort: Option[EntitlementPort] = None',
    ') extends HttpAuthority {',
    '  override def authenticate(req: HttpRequest): Option[Principal] = authFn(req)',
    '  override def verifyCsrf(req: HttpRequest): Boolean = csrfFn(req)',
    '  override def authorize(principal: Principal, route: RouteDescriptor): Boolean =',
    '    authorizeWithRequest(principal, route, HttpRequest(route.method, route.path))',
    '  override def authorizeWithRequest(principal: Principal, route: RouteDescriptor, req: HttpRequest): Boolean =',
    '    authorizeDetailed(principal, route, req).allowed',
    '  private def extractContext(principal: Principal, route: RouteDescriptor, req: HttpRequest): Map[String, Any] = {',
    '    val payload: Map[String, Any] = req.query.map { case (k, v) => k -> (v: Any) } ++ req.body',
    '    route.contextParams.flatMap { case (name, from) =>',
    '      if (from.startsWith("param.")) payload.get(from.drop(6)).map(v => name -> v)',
    '      else if (from == "token.tenantId") principal.tenantId.map(v => name -> (v: Any))',
    '      else if (from.startsWith("token.")) principal.attributes.get(from.drop(6)).map(v => name -> v)',
    '      else if (from.startsWith("header.")) req.headers.get(from.drop(7)).map(v => name -> (v: Any))',
    '      else None',
    '    }.toMap',
    '  }',
    '  private def extractResource(principal: Principal, route: RouteDescriptor, req: HttpRequest): Option[AuthzResource] = {',
    '    val payload: Map[String, Any] = req.query.map { case (k, v) => k -> (v: Any) } ++ req.body',
    '    route.resource.map { rSpec =>',
    '      val resId: Option[String] = rSpec.idFrom.flatMap { from =>',
    '        if (from.startsWith("param.")) payload.get(from.drop(6)).map(_.toString)',
    '        else if (from.startsWith("header.")) req.headers.get(from.drop(7))',
    '        else if (from == "token.tenantId") principal.tenantId',
    '        else if (from.startsWith("token.")) principal.attributes.get(from.drop(6)).map(_.toString)',
    '        else None',
    '      }',
    '      val ownerId: Option[String] = rSpec.ownerField.flatMap(f => req.stateSnapshot.get(f).map(_.toString))',
    '      AuthzResource(rSpec.resourceType, resId, rSpec.ownerField, ownerId, rSpec.relation)',
    '    }',
    '  }',
    '  override def authorizeDetailed(principal: Principal, route: RouteDescriptor, req: HttpRequest): AuthzDecisionResult = {',
    '    if (route.authzMode.contains("public")) return AuthzDecisionResult(allowed = true)',
    '    val resourceOpt = extractResource(principal, route, req)',
    '    val entitlements = route.requiresEntitlement',
    '    if (route.authzMode.contains("external-pdp")) {',
    '      val ok = pdp.exists(_.decide(AuthzDecisionQuery(principal, route.callerKind, route.action.getOrElse(route.operation), route.scope, route.policyRef, extractContext(principal, route, req), resourceOpt, entitlements)))',
    '      return if (ok) AuthzDecisionResult(allowed = true) else AuthzDecisionResult(allowed = false, code = Some("NOT_AUTHORIZED"))',
    '    }',
    '    val isWildcard = principal.roles.contains("*")',
    '    if (route.allowedRoles.nonEmpty && !isWildcard && !principal.roles.exists(route.allowedRoles.contains)) {',
    '      return AuthzDecisionResult(allowed = false, code = Some("NOT_AUTHORIZED"))',
    '    }',
    '    if (!isWildcard && route.resource.nonEmpty) {',
    '      val rSpec = route.resource.get',
    '      if (rSpec.ownerField.nonEmpty) {',
    '        val expectedOwner = PrincipalResolver.resolveField(principal, rSpec.ownerPrincipalKey).map(_.toString)',
    '        val actualOwner = req.stateSnapshot.get(rSpec.ownerField.get).map(_.toString)',
    '        if (expectedOwner.isEmpty || actualOwner.isEmpty || actualOwner != expectedOwner) {',
    '          return AuthzDecisionResult(allowed = false, code = Some("FORBIDDEN_RESOURCE"))',
    '        }',
    '      }',
    '      if (route.authzMode.contains("resource-policy") && (route.policyRef.nonEmpty || rSpec.ownerField.isEmpty)) {',
    '        val ok = pdp.exists(_.decide(AuthzDecisionQuery(principal, route.callerKind, route.action.getOrElse(route.operation), route.scope, route.policyRef, extractContext(principal, route, req), resourceOpt, entitlements)))',
    '        if (!ok) return AuthzDecisionResult(allowed = false, code = Some("FORBIDDEN_RESOURCE"))',
    '      }',
    '    }',
    '    if (!isWildcard && entitlements.nonEmpty) {',
    '      val payload: Map[String, Any] = req.query.map { case (k, v) => k -> (v: Any) } ++ req.body',
    '      val missing = entitlements.exists { ent =>',
    '        val matchVal = ent.matchParam.flatMap(payload.get)',
    '        val has = entitlementPort match {',
    '          case Some(ep) => ep.hasEntitlement(principal, ent, matchVal)',
    '          case None =>',
    '            principal.entitlements.contains(ent.code) ||',
    '              matchVal.exists(v => principal.entitlements.contains(s"${ent.code}:${v.toString}") || principal.entitlements.contains(s"${ent.code}:*"))',
    '        }',
    '        !has',
    '      }',
    '      if (missing) return AuthzDecisionResult(allowed = false, code = Some("ENTITLEMENT_REQUIRED"))',
    '    }',
    '    AuthzDecisionResult(allowed = true)',
    '  }',
    '}',
    '',
    'final case class HttpRequest(method: String, path: String, headers: Map[String, String] = Map.empty, query: Map[String, String] = Map.empty, body: Map[String, Any] = Map.empty, stateSnapshot: Map[String, Any] = Map.empty, principal: Option[Principal] = None)',
    'final case class HttpResponse(status: Int, body: Map[String, Any], headers: Map[String, String] = Map("content-type" -> "application/json; charset=utf-8"))',
    'final case class RouteResourceSpec(resourceType: String, idFrom: Option[String] = None, ownerField: Option[String] = None, ownerPrincipalKey: String = "id", relation: Option[String] = None)',
    'final case class RouteRowScopeSpec(kind: String, matchField: Option[String] = None, principalKey: String = "id")',
    'final case class RouteDescriptor(method: String, path: String, story: String, operation: String, callerKind: String = "human", authzMode: Option[String] = None, action: Option[String] = None, scope: Option[String] = None, allowedRoles: Seq[String] = Seq.empty, policyRef: Option[String] = None, contextParams: Seq[(String, String)] = Seq.empty, resource: Option[RouteResourceSpec] = None, bindPrincipal: Seq[(String, String)] = Seq.empty, requiresEntitlement: Seq[AuthzEntitlement] = Seq.empty, rowScope: Option[RouteRowScopeSpec] = None)',
    '',
    'object HttpStatusMapper {',
    '  def statusForRejection(code: String): Int = {',
    '    val upper = Option(code).getOrElse("").toUpperCase',
    '    if (upper.contains("UNAUTHORIZED") || upper.contains("CSRF") || upper.contains("AUTH")) 401',
    '    else if (upper.contains("FORBIDDEN")) 403',
    '    else if (upper.contains("CONFLICT") || upper.contains("ALREADY")) 409',
    '    else if (upper.contains("NOT_FOUND") || upper.contains("UNKNOWN")) 404',
    '    else 400',
    '  }',
    '}',
    '',
  ].join('\n');

  // 3. interfaces/http/<Story>Controller.scala (wired to application.services.<Story>Handler + iMadzError)
  for (const beh of appBehaviors) {
    const pascal = toPascal(beh.target);
    out[`app/${pkgDir}/interfaces/http/${pascal}Controller.scala`] = [
      `// @ProvenanceId(interfaces:http:${beh.target})`,
      `package ${packageName}.interfaces.http`,
      '',
      `import ${packageName}.application.services.{${pascal}EffectsPort, ${pascal}ExternPorts, ${pascal}Handler, ${pascal}Request}`,
      `import ${packageName}.interfaces.api.{HttpRequest, HttpResponse, HttpStatusMapper, PrincipalResolver, RouteDescriptor}`,
      '',
      `final class ${pascal}Controller(handler: ${pascal}Handler, externs: ${pascal}ExternPorts, effects: ${pascal}EffectsPort) {`,
      '  def handleOperation(operation: String, req: HttpRequest, routeDesc: Option[RouteDescriptor] = None): HttpResponse = {',
      '    val mergedPayload: Map[String, Any] = req.query.map { case (k, v) => k -> (v: Any) } ++ req.body',
      '    val principalMap: Option[Map[String, Any]] = req.principal.map(p => Map[String, Any]("id" -> p.id, "roles" -> p.roles, "tenantId" -> p.tenantId.getOrElse(""), "entitlements" -> p.entitlements, "attributes" -> p.attributes))',
      `    val appReq = ${pascal}Request(operation = operation, payload = mergedPayload, stateSnapshot = req.stateSnapshot, principal = principalMap)`,
      '    handler.handle(appReq, externs, effects) match {',
      '      case Left(err) =>',
      '        HttpResponse(status = HttpStatusMapper.statusForRejection(err.code), body = Map("ok" -> false, "code" -> err.code, "message" -> err.message))',
      '      case Right(res) =>',
      '        val rowScopeDenied = routeDesc.flatMap(_.rowScope).exists { rs =>',
      '          rs.kind != "global" && rs.matchField.nonEmpty && req.principal.exists { p =>',
      '            if (p.roles.contains("*")) false',
      '            else {',
      '              val expected = PrincipalResolver.resolveField(p, rs.principalKey).map(_.toString)',
      '              val actual = res.view.get(rs.matchField.get).map(_.toString)',
      '              res.view.nonEmpty && (expected.isEmpty || actual.isEmpty || actual != expected)',
      '            }',
      '          }',
      '        }',
      '        if (rowScopeDenied) HttpResponse(status = 403, body = Map("ok" -> false, "code" -> "FORBIDDEN_ROW_SCOPE", "route" -> routeDesc.map(_.path).getOrElse("")))',
      '        else {',
      '          val base: Map[String, Any] = Map("ok" -> true, "ruleId" -> res.ruleId)',
      '          val withResp = res.responseType.map(rt => base + ("responseType" -> rt) + ("response" -> res.response)).getOrElse(base)',
      '          val withView = res.viewName.map(vn => withResp + ("viewName" -> vn) + ("view" -> res.view)).getOrElse(withResp)',
      '          HttpResponse(status = 200, body = withView)',
      '        }',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n');
  }

  // 4. interfaces/http/HttpRouter.scala
  const routerLines = [
    `package ${packageName}.interfaces.http`,
    '',
    `import ${packageName}.interfaces.api.{AllowAllAuthority, AuthzEntitlement, HttpAuthority, HttpRequest, HttpResponse, PrincipalResolver, RouteDescriptor, RouteResourceSpec, RouteRowScopeSpec}`,
    '',
    'final class HttpRouter(',
    ...[
      ...appBehaviors.map(b => `  ${toCamel(toPascal(b.target))}Controller: Option[${toPascal(b.target)}Controller] = None`),
      '  authority: HttpAuthority = AllowAllAuthority',
    ].join(',\n').split('\n'),
    ') {',
    '  val declaredRoutes: Seq[RouteDescriptor] = Seq(',
  ];
  routes.forEach((r, i) => {
    const comma = i + 1 < routes.length ? ',' : '';
    const optStr = v => (v ? `Some(${JSON.stringify(v)})` : 'None');
    const rolesExpr = `Seq(${(r.authz?.allowedRoles ?? []).map(x => JSON.stringify(x)).join(', ')})`;
    const ctxExpr = `Seq(${(r.authz?.contextParams ?? []).map(c => `(${JSON.stringify(c.name)}, ${JSON.stringify(c.from)})`).join(', ')})`;
    const resExpr = r.authz?.resource
      ? `Some(RouteResourceSpec(${JSON.stringify(r.authz.resource.type)}, ${optStr(r.authz.resource.idFrom)}, ${optStr(r.authz.resource.ownerField)}, ${JSON.stringify(r.authz.resource.ownerPrincipalKey ?? 'id')}, ${optStr(r.authz.resource.relation)}))`
      : 'None';
    const bindExpr = `Seq(${(r.authz?.bindPrincipal ?? []).map(b => `(${JSON.stringify(b.param)}, ${JSON.stringify(b.from)})`).join(', ')})`;
    const entExpr = `Seq(${(r.authz?.requiresEntitlement ?? []).map(e => `AuthzEntitlement(${JSON.stringify(e.code)}, ${optStr(e.source)}, ${optStr(e.matchParam)})`).join(', ')})`;
    const rowScopeExpr = r.rowScope
      ? `Some(RouteRowScopeSpec(${JSON.stringify(r.rowScope.kind)}, ${optStr(r.rowScope.matchField)}, ${JSON.stringify(r.rowScope.principalKey ?? 'id')}))`
      : 'None';
    routerLines.push(
      `    RouteDescriptor(${JSON.stringify(r.method)}, ${JSON.stringify(r.path)}, ${JSON.stringify(r.storyName)}, ${JSON.stringify(r.operation)}, ${JSON.stringify(r.callerKind ?? 'human')}, ${optStr(r.authz?.mode)}, ${optStr(r.authz?.action)}, ${optStr(r.authz?.scope)}, ${rolesExpr}, ${optStr(r.authz?.policyRef)}, ${ctxExpr}, ${resExpr}, ${bindExpr}, ${entExpr}, ${rowScopeExpr})${comma}`,
    );
  });
  routerLines.push(
    '  )',
    '  val commandRoleMap: Map[String, Seq[String]] = declaredRoutes.map(r => r.operation -> r.allowedRoles).toMap',
    '  private def enforceAuth(routeDesc: RouteDescriptor, req: HttpRequest): Either[HttpResponse, HttpRequest] = {',
    '    if (routeDesc.authzMode.contains("public")) return Right(req)',
    '    authority.authenticate(req) match {',
    '      case None => Left(HttpResponse(401, Map("ok" -> false, "code" -> "NOT_AUTHENTICATED", "route" -> routeDesc.path)))',
    '      case Some(principal) =>',
    '        val decision = authority.authorizeDetailed(principal, routeDesc, req)',
    '        if (!decision.allowed) Left(HttpResponse(403, Map("ok" -> false, "code" -> decision.code.getOrElse("NOT_AUTHORIZED"), "route" -> routeDesc.path)))',
    '        else if (routeDesc.method == "POST" && !authority.verifyCsrf(req)) Left(HttpResponse(403, Map("ok" -> false, "code" -> "CSRF_INVALID", "route" -> routeDesc.path)))',
    '        else {',
    '          val withPrincipal = req.copy(principal = Some(principal))',
    '          if (routeDesc.bindPrincipal.nonEmpty && !principal.roles.contains("*")) {',
    '            val nextBody = routeDesc.bindPrincipal.foldLeft(withPrincipal.body) { case (acc, (param, from)) => PrincipalResolver.resolveField(principal, from).map(v => acc + (param -> v)).getOrElse(acc) }',
    '            val nextQuery = routeDesc.bindPrincipal.foldLeft(withPrincipal.query) { case (acc, (param, from)) => PrincipalResolver.resolveField(principal, from).map(v => acc + (param -> v.toString)).getOrElse(acc) }',
    '            Right(withPrincipal.copy(body = nextBody, query = nextQuery))',
    '          } else Right(withPrincipal)',
    '        }',
    '    }',
    '  }',
    '  def route(req: HttpRequest): HttpResponse = {',
    '    val method = req.method.toUpperCase',
    '    val path = req.path.split("\\\\?")(0)',
    '    (method, path) match {',
    `      case ("GET", "/health") => HttpResponse(200, Map("status" -> "ok", "system" -> ${JSON.stringify(canonicalV2.system)}, "context" -> ${JSON.stringify(canonicalV2.context)}, "routes" -> declaredRoutes.size))`,
  );
  routes.forEach((r, i) => {
    const ctrlParam = `${toCamel(r.storyPascal)}Controller`;
    routerLines.push(
      `      case (${JSON.stringify(r.method)}, ${JSON.stringify(r.path)}) =>`,
      `        enforceAuth(declaredRoutes(${i}), req) match {`,
      '          case Left(denied) => denied',
      `          case Right(authedReq) => ${ctrlParam}.map(_.handleOperation(${JSON.stringify(r.operation)}, authedReq, Some(declaredRoutes(${i})))).getOrElse(HttpResponse(501, Map("ok" -> false, "code" -> "HANDLER_NOT_WIRED", "story" -> ${JSON.stringify(r.storyName)})))`,
      '        }',
    );
  });
  routerLines.push(
    '      case _ => HttpResponse(404, Map("ok" -> false, "code" -> "ROUTE_NOT_FOUND", "method" -> method, "path" -> path))',
    '    }',
    '  }',
    '}',
    '',
  );
  out[`app/${pkgDir}/interfaces/http/HttpRouter.scala`] = routerLines.join('\n');

  // 5. interfaces/web/PlayHttpBridge.scala (Play AbstractController bridge)
  out[`app/${pkgDir}/interfaces/web/PlayHttpBridge.scala`] = [
    `package ${packageName}.interfaces.web`,
    '',
    'import javax.inject._',
    'import play.api.libs.json._',
    'import play.api.mvc._',
    `import ${packageName}.interfaces.api.{HttpRequest, HttpResponse}`,
    `import ${packageName}.interfaces.http.HttpRouter`,
    '',
    '@Singleton',
    'final class PlayHttpBridge @Inject()(cc: ControllerComponents, router: HttpRouter) extends AbstractController(cc) {',
    '  private def toAnyMap(js: JsObject): Map[String, Any] = js.value.map {',
    '    case (k, JsString(v)) => k -> v',
    '    case (k, JsNumber(v)) => k -> v',
    '    case (k, JsBoolean(v)) => k -> v',
    '    case (k, obj: JsObject) => k -> toAnyMap(obj)',
    '    case (k, arr: JsArray) => k -> arr.value.map(_.toString).toSeq',
    '    case (k, JsNull) => k -> ""',
    '  }.toMap',
    '  private def toJsValue(v: Any): JsValue = v match {',
    '    case null => JsNull',
    '    case s: String => JsString(s)',
    '    case b: Boolean => JsBoolean(b)',
    '    case n: Int => JsNumber(BigDecimal(n))',
    '    case n: Long => JsNumber(BigDecimal(n))',
    '    case n: BigDecimal => JsNumber(n)',
    '    case m: Map[_, _] => JsObject(m.map { case (k, vv) => k.toString -> toJsValue(vv) }.toSeq)',
    '    case seq: Iterable[_] => JsArray(seq.map(toJsValue).toSeq)',
    '    case other => JsString(other.toString)',
    '  }',
    '  private def render(resp: HttpResponse): Result = Status(resp.status)(toJsValue(resp.body))',
    '  def health: Action[AnyContent] = Action { render(router.route(HttpRequest("GET", "/health"))) }',
    '  def dispatch(path: String): Action[AnyContent] = Action { req =>',
    '    val bodyMap = req.body.asJson match { case Some(obj: JsObject) => toAnyMap(obj); case _ => Map.empty[String, Any] }',
    '    val queryMap = req.queryString.collect { case (k, v) if v.nonEmpty => k -> v.head }',
    '    val headersMap = req.headers.toSimpleMap',
    '    val normalized = if (path.startsWith("/")) path else s"/$path"',
    '    render(router.route(HttpRequest(req.method, normalized, headersMap, queryMap, bodyMap)))',
    '  }',
    '}',
    '',
  ].join('\n');

  // 6. infrastructure/persistence/InMemoryStore.scala
  out[`app/${pkgDir}/infrastructure/persistence/InMemoryStore.scala`] = [
    `package ${packageName}.infrastructure.persistence`,
    '',
    'import scala.collection.mutable',
    '',
    'final case class PinnedRecord(artifact: String, inputs: Map[String, Any])',
    'final case class DispatchedRecord(target: String, payload: Map[String, Any])',
    '',
    'final class InMemoryStore {',
    '  private val pinsBuf = mutable.LinkedHashMap.empty[String, PinnedRecord]',
    '  private val dispatchesBuf = mutable.ListBuffer.empty[DispatchedRecord]',
    '  def pin(artifact: String, inputs: Map[String, Any]): Unit = {',
    '    val key = s"$artifact:${inputs.toSeq.sortBy(_._1).mkString(",")}"',
    '    if (!pinsBuf.contains(key)) pinsBuf.put(key, PinnedRecord(artifact, inputs))',
    '  }',
    '  def recordDispatch(target: String, payload: Map[String, Any]): Unit = { dispatchesBuf += DispatchedRecord(target, payload) }',
    '  def pins: Seq[PinnedRecord] = pinsBuf.values.toSeq',
    '  def dispatches: Seq[DispatchedRecord] = dispatchesBuf.toSeq',
    '}',
    '',
  ].join('\n');

  // 7. infrastructure/connectors/DefaultOutboundConnectors.scala
  const adaptLines = [
    `package ${packageName}.infrastructure.connectors`,
    '',
    'import scala.collection.mutable',
    `import ${packageName}.application.connectors.{OutboundConnectorsPort, OutboundEffectRecord}`,
    `import ${packageName}.infrastructure.persistence.InMemoryStore`,
    '',
    'final class DefaultOutboundConnectors(store: InMemoryStore) extends OutboundConnectorsPort {',
    '  private val recorded = mutable.ListBuffer.empty[OutboundEffectRecord]',
  ];
  for (const beh of appBehaviors) {
    const pascal = toPascal(beh.target);
    const camel = toCamel(pascal);
    adaptLines.push(`  override val ${camel}Externs: ${packageName}.application.services.${pascal}ExternPorts = new ${packageName}.application.services.${pascal}ExternPorts {`);
    for (const ext of beh.externs ?? []) {
      const defVal = /exists|recorded|already/iu.test(ext.name) ? 'false' : 'true';
      const sig = (ext.params ?? []).map(p => `${p}: Any`).join(', ');
      adaptLines.push(`    override def ${ext.name}(${sig}): Boolean = ${defVal}`);
    }
    adaptLines.push('  }');
    adaptLines.push(`  override val ${camel}Effects: ${packageName}.application.services.${pascal}EffectsPort = new ${packageName}.application.services.${pascal}EffectsPort {`);
    adaptLines.push('    override def pin(artifact: String, inputs: Map[String, Any]): Unit = { store.pin(artifact, inputs); recorded += OutboundEffectRecord("pin", artifact, inputs) }');
    adaptLines.push('    override def dispatch(target: String, payload: Map[String, Any]): Unit = { store.recordDispatch(target, payload); recorded += OutboundEffectRecord("dispatch", target, payload) }');
    adaptLines.push('  }');
  }
  adaptLines.push('  override def recordedEffects: Seq[OutboundEffectRecord] = recorded.toSeq', '}', '');
  out[`app/${pkgDir}/infrastructure/connectors/DefaultOutboundConnectors.scala`] = adaptLines.join('\n');

  // 8. modules/OnionBootstrap.scala (pure-Scala DI Composition Root for standalone scalac/ScalaTest & runtime wiring;
  //    coexists alongside 1.0 service-runtime's Guice modules/BootstrapModule.scala)
  const bootLines = [
    `package ${packageName}.modules`,
    '',
    `import ${packageName}.application.connectors.OutboundConnectorsPort`,
    `import ${packageName}.infrastructure.connectors.DefaultOutboundConnectors`,
    `import ${packageName}.infrastructure.persistence.InMemoryStore`,
    `import ${packageName}.interfaces.api.{AllowAllAuthority, HttpAuthority}`,
    `import ${packageName}.interfaces.http.HttpRouter`,
    '',
    'final case class OnionRuntime(router: HttpRouter, store: InMemoryStore, connectors: OutboundConnectorsPort)',
    '',
    'object OnionBootstrap {',
    '  def createRuntime(',
  ];
  const params = [];
  for (const beh of appBehaviors) {
    const pascal = toPascal(beh.target);
    const camel = toCamel(pascal);
    params.push(`    ${camel}Handler: Option[${packageName}.application.services.${pascal}Handler] = None`);
    params.push(`    ${camel}Externs: Option[${packageName}.application.services.${pascal}ExternPorts] = None`);
  }
  params.push('    authority: HttpAuthority = AllowAllAuthority');
  params.push('    store: InMemoryStore = new InMemoryStore()');
  bootLines.push(params.join(',\n'), '  ): OnionRuntime = {', '    val connectors = new DefaultOutboundConnectors(store)', '    val router = new HttpRouter(');
  const ctrlArgs = [
    ...appBehaviors.map(b => {
      const pascal = toPascal(b.target);
      const camel = toCamel(pascal);
      return `      ${camel}Controller = ${camel}Handler.map(h => new ${packageName}.interfaces.http.${pascal}Controller(h, ${camel}Externs.getOrElse(connectors.${camel}Externs), connectors.${camel}Effects))`;
    }),
    '      authority = authority',
  ];
  bootLines.push(ctrlArgs.join(',\n'), '    )', '    OnionRuntime(router = router, store = store, connectors = connectors)', '  }', '}', '');
  out[`app/${pkgDir}/modules/OnionBootstrap.scala`] = bootLines.join('\n');

  return out;
}

/**
 * Block D: Play service-runtime (#38), project-scaffold (#39), projection-apply-event (#26), and 5-layer Authz PEP/PDP.
 */
export function emitV1BlockD(canonicalV2, { packageName = 'example.v2', runtimeProfile = null, protoPaths = [] } = {}) {
  const context = canonicalV2.context || canonicalV2.subdomain || 'core';
  const docId = `${canonicalV2.system || 'v2'}/${context}`;
  const rp = resolveRuntimeProfile({ runtimeProfile });
  const serviceName = `${toPascal(context)}Service`;
  const files = {};
  const familiesUsed = [];

  // 1. 2.0 5-layer Authz PEP/PDP + Pure-Scala Runnable Onion Interfaces + PlayHttpBridge
  Object.assign(files, emitStrictInterfacesAndAuthz(canonicalV2, packageName, rp.commonPackage));
  familiesUsed.push('authz-pep-dsl');

  // 2. service-runtime (#38) -> infrastructure/bootstrap/*Contract, *Loader, ApplicationBootstrap, *Configuration, modules/BootstrapModule, conf/*.conf
  const routes = deriveStoryHttpRoutes(canonicalV2);
  const seenEndpointIds = new Set();
  const endpoints = routes.length > 0
    ? routes.map((r, idx) => {
        const baseId = `${toSnake(r.portName)}-${toSnake(r.opName)}`.replaceAll('_', '-') || `op-${idx}`;
        const id = seenEndpointIds.has(baseId) ? `${baseId}-${idx}` : baseId;
        seenEndpointIds.add(id);
        return {
          id,
          name: `${r.portName}${toPascal(r.opName)}${seenEndpointIds.size > 1 && id !== baseId ? idx : ''}`,
          method: r.method,
          path: r.path,
          audience: r.callerKind || 'human',
          csrf: r.method === 'POST',
          inputType: 'JsValue',
          outputType: 'JsValue',
          implId: `${packageName}.interfaces.http.${r.storyPascal}Controller`,
          implVersion: 'v2-service-1',
        };
      })
    : [{
        id: 'health',
        name: `${toPascal(context)}HealthEndpoint`,
        method: 'GET',
        path: `/api/v1/${toSnake(context).replaceAll('_', '-')}/health`,
        audience: 'public',
        csrf: false,
        inputType: 'JsValue',
        outputType: 'JsValue',
        implId: `${packageName}.interfaces.web.PlayHttpBridge`,
        implVersion: 'v2-service-1',
      }];

  const configScala = [
    `package ${packageName}.infrastructure.bootstrap`,
    '',
    `object ${serviceName}Configuration {`,
    `  val serviceName: String = ${JSON.stringify(serviceName)}`,
    `  val system: String = ${JSON.stringify(canonicalV2.system || 'app')}`,
    `  val context: String = ${JSON.stringify(context)}`,
    '}',
    '',
  ].join('\n');

  const srInput = {
    schemaVersion: 'truthsrc.service-runtime-input/v1',
    package: packageName,
    serviceName,
    bootstrap: { id: `${packageName}.modules.BootstrapModule`, version: 'v2-service-1' },
    journalConnection: `${context}-journal`,
    readSideConnection: `${context}-readside`,
    endpoints,
    pages: null,
    artifactSource: { document: docId, pointer: '/service' },
    configurationScala: configScala,
    aggregates: (canonicalV2.structures?.aggregates ?? []).map(a => ({ name: a.name, authority: false })),
    readsideProjections: [],
    readsideFiles: [],
  };
  Object.assign(files, serviceRuntimeFamily.renderAll(srInput));
  familiesUsed.push('service-runtime');

  // 3. project-scaffold (#39) -> conf/serialization.conf, build.sbt, project/build.properties, project/plugins.sbt
  const aggs = canonicalV2.structures?.aggregates ?? [];
  const scaffoldSources = aggs.length > 0
    ? aggs.map((_, idx) => ({ document: docId, pointer: `/aggregates/${idx}` }))
    : [{ document: docId, pointer: '/structures' }];
  const buildSbt = [
    `name := ${JSON.stringify(`${canonicalV2.system || 'app'}-${context}`)}`,
    'version := "0.1.0-SNAPSHOT"',
    'scalaVersion := "2.13.14"',
    '',
    'lazy val root = (project in file("."))',
    '  .enablePlugins(PlayScala)',
    '  .settings(',
    '    Compile / unmanagedSourceDirectories ++= Seq(',
    '      baseDirectory.value / "scala",',
    '      baseDirectory.value.getParentFile / "handwritten" / "scala"',
    '    ),',
    '    Compile / PB.protoSources := Seq(baseDirectory.value / "protobuf"),',
    '    Compile / PB.targets := Seq(scalapb.gen() -> (Compile / sourceManaged).value),',
    '    Test / unmanagedSourceDirectories += baseDirectory.value.getParentFile / "generated-tests" / "scala",',
    '    libraryDependencies ++= Seq(',
    '      guice,',
    '      jdbc,',
    `      ${JSON.stringify(rp.organization)} %% ${JSON.stringify(rp.commonCoreArtifact)} % ${JSON.stringify(rp.commonCoreVersion)},`,
    '      "com.typesafe.akka" %% "akka-persistence-typed" % "2.6.20",',
    '      "com.typesafe.akka" %% "akka-cluster-sharding-typed" % "2.6.20",',
    '      "com.thesamet.scalapb" %% "scalapb-runtime" % "0.11.14" % "protobuf",',
    '      "org.scalatest" %% "scalatest" % "3.2.19" % Test',
    '    )',
    '  )',
    '',
  ].join('\n');

  const pscInput = {
    schemaVersion: 'truthsrc.project-scaffold-input/v1',
    ...(runtimeProfile ? { runtimeProfile } : {}),
    serialization: {
      domainSerializers: [{ key: 'domainProto0', className: `${packageName}.infrastructure.persistence.DomainProtoSerializer` }],
      hosts: [],
      effects: [],
      sources: scaffoldSources,
    },
    files: [
      { path: 'build.sbt', kind: 'build', content: buildSbt, deps: [], sources: scaffoldSources },
      { path: 'project/build.properties', kind: 'build', content: 'sbt.version=1.9.9\n', deps: [], sources: scaffoldSources },
      {
        path: 'project/plugins.sbt',
        kind: 'build',
        content: [
          'addSbtPlugin("com.thesamet" % "sbt-protoc" % "1.0.6")',
          'libraryDependencies += "com.thesamet.scalapb" %% "compilerplugin" % "0.11.14"',
          'addSbtPlugin("com.typesafe.play" % "sbt-plugin" % "2.8.18")',
          'addSbtPlugin("org.scoverage" % "sbt-scoverage" % "2.0.11")',
          '',
        ].join('\n'),
        deps: [],
        sources: scaffoldSources,
      },
    ],
  };
  Object.assign(files, projectScaffoldFamily.renderAll(pscInput));
  familiesUsed.push('project-scaffold');

  // 4. projection-apply-event (#26) -> infrastructure/readside/* when readModels map aggregate events
  const readModels = canonicalV2.structures?.readModels ?? [];
  const validViews = [];
  for (const rm of readModels) {
    const viewName = toPascal(rm.name).replace(/View$/u, '') + 'View';
    const stem = viewName.replace(/View$/u, '');
    const evMap = new Map();
    for (const f of rm.fields ?? []) {
      const src = String(f.source ?? '');
      const m = src.match(/^eventField:(?:([A-Za-z0-9_]+)\.)?([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)$/u);
      if (!m) continue;
      let aggName = m[1] || rm.sourceAggregate;
      const evName = m[2];
      const evField = m[3];
      if (!aggName) {
        aggName = (canonicalV2.structures?.aggregates ?? []).find(a => (a.events ?? []).some(e => e.name === evName))?.name;
      }
      if (!aggName) continue;
      const key = `${aggName}.${evName}`;
      if (!evMap.has(key)) {
        evMap.set(key, {
          name: evName,
          fqn: `${packageName}.domain.entities.${aggName}Entity.${evName}`,
          applyForm: 'create',
          columns: [],
        });
      }
      evMap.get(key).columns.push({ name: f.name, value: `e.${evField}` });
    }
    const events = [...evMap.values()].filter(ev => ev.columns.length > 0);
    if (events.length > 0 && /^[a-z][a-zA-Z0-9]*$/u.test(packageName.split('.')[0]) && packageName.split('.').every(p => /^[a-z][a-zA-Z0-9]*$/u.test(p))) {
      validViews.push({
        viewLabel: rm.description || viewName,
        viewName,
        tableObject: `${stem}Table`,
        kernelClass: `${stem}ApplyEvent`,
        semanticsFace: `${stem}ApplyEventSemantics`,
        semanticsImpl: `${stem}ApplyEventSemanticsImpl`,
        identityScheme: null,
        hooks: ['emptyRow'],
        kernelHelpers: [],
        events,
      });
    }
  }
  if (validViews.length > 0) {
    try {
      const paeOut = projectionApplyEventFamily.renderAll({
        schemaVersion: 'truthsrc.projection-apply-event-input/v1',
        basePackage: packageName,
        moduleName: `${toPascal(context)}ProjectionModule`,
        views: validViews,
        supplied: [],
      });
      Object.assign(files, paeOut);
      familiesUsed.push('projection-apply-event');
    } catch {
      // Fail-open only when readModel lacks complete projection semantics hooks; domain/service remain unaffected.
    }
  }

  return { files, familiesUsed, protoPaths };
}
