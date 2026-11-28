// API & Auth-Core Play Controller Bridge for scala-cqrs-play-service@2:
// Restores full 1.0 Play HTTP + auth-core Endpoint DSL + CommandDsl + AggregateStateApiController + conf/routes:
//   - #36 command-endpoint-dsl       -> infrastructure/api/CommandDsl.scala (OkReceipt, ViewListDto, IdGuard, InstantGuard)
//   - #34 aggregate-state-controller -> controllers/AggregateStateApiController.scala (via real 1.0 emitter/families/aggregate-state-controller.mjs)
//   - #35 http-controller            -> controllers/<Story>PlayController.scala (using auth-core Endpoint DSL: api.tenant/global/anonymous + RoleGate)
//   - #37 routes                     -> conf/routes (Play HTTP route table mounting PlayController + AggregateStateApiController + health)
import { resolveRuntimeProfile } from '../../runtime-profile.mjs';
import { deriveStoryHttpRoutes, toCamel, toPascal } from '../codegen/onion-routes.mjs';

function toKebab(name) {
  return String(name ?? '')
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .replace(/[^A-Za-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase();
}

function stripAggregateSuffix(name) {
  return String(name ?? '').replace(/Aggregate$/u, '');
}

function toPlayJsonBuiltinSignature(rt, exactNames) {
  if (!rt || typeof rt !== 'object') return 'String';
  switch (rt.kind) {
    case 'int': return 'Long';
    case 'bool': return 'Boolean';
    case 'string': return 'String';
    case 'decimal': return 'BigDecimal';
    case 'record':
      if (rt.typeName && exactNames.has(rt.typeName)) return 'BigDecimal';
      return null;
    default:
      return null;
  }
}

function buildAuthCoreEndpointCall(route) {
  const mode = route.authz?.mode ?? 'rbac';
  const scope = route.authz?.scope ?? 'global';
  const roles = (route.authz?.allowedRoles ?? []).map(r => JSON.stringify(r)).join(', ');
  const isRead = route.method === 'GET';
  if (mode === 'public' || route.callerKind === 'anonymous') {
    return isRead ? 'api.anonymous.read' : 'api.anonymous.write[JsObject]';
  }
  const scopeApi = scope === 'tenant' ? 'api.tenant' : 'api.global';
  if (isRead) {
    return roles ? `${scopeApi}.read(${roles})` : `${scopeApi}.read()`;
  }
  return roles ? `${scopeApi}.write[JsObject](${roles})` : `${scopeApi}.write[JsObject]()`;
}

/**
 * Emit #36 CommandDsl, #34 AggregateStateApiController, #35 PlayController (auth-core Endpoint DSL), and #37 conf/routes.
 */
export function emitV1ApiAuthSuite(canonicalV2, { packageName = 'example.v2', runtimeProfile = null } = {}) {
  const context = canonicalV2.context || canonicalV2.subdomain || 'core';
  const docId = `${canonicalV2.system || 'v2'}/${context}`;
  const rp = resolveRuntimeProfile({ runtimeProfile });
  const pkgDir = packageName.split('.').join('/');
  const aggregates = canonicalV2.structures?.aggregates ?? [];
  const exactNames = new Set((canonicalV2.structures?.exactTypes ?? []).map(e => e.name));
  const appBehaviors = (canonicalV2.behaviors ?? []).filter(b => b.layer === 'application');
  const routes = deriveStoryHttpRoutes(canonicalV2);
  const files = {};
  const handwrittenFiles = {};
  const familiesUsed = [];

  // 0. ServerSnapshotProvider port (compiler-owned) + non-overwriting handwritten isolation impl
  files[`app/${pkgDir}/infrastructure/api/ServerSnapshotProvider.scala`] = [
    `// @knowledge source:${docId}#/service/server-snapshot-provider`,
    `package ${packageName}.infrastructure.api`,
    '',
    'import scala.concurrent.Future',
    '',
    '/** Server-trusted snapshot loader resolving aggregate/read-model state on the server.',
    '  * Client HTTP payloads must NEVER supply `stateSnapshot` directly. */',
    'trait ServerSnapshotProvider {',
    '  def load(operation: String, payload: Map[String, Any], principal: Option[Map[String, Any]]): Future[Map[String, Any]]',
    '}',
    '',
    'object DefaultServerSnapshotProvider extends ServerSnapshotProvider {',
    '  override def load(operation: String, payload: Map[String, Any], principal: Option[Map[String, Any]]): Future[Map[String, Any]] =',
    '    Future.successful(Map.empty)',
    '}',
    '',
  ].join('\n');

  handwrittenFiles[`handwritten/scala/${pkgDir}/infrastructure/api/ServerSnapshotProviderImpl.scala`] = [
    '// Handwritten server-side trusted snapshot loader isolation zone for Play controllers.',
    '// Query aggregate/read-model repositories here based on `operation`, bound `payload`, and `principal`.',
    '// truthsrc generate-v2 will NEVER overwrite this file once created.',
    `package ${packageName}.infrastructure.api`,
    '',
    'import javax.inject.{Inject, Singleton}',
    'import scala.concurrent.Future',
    '',
    '@Singleton',
    'final class ServerSnapshotProviderImpl @Inject()() extends ServerSnapshotProvider {',
    '  override def load(operation: String, payload: Map[String, Any], principal: Option[Map[String, Any]]): Future[Map[String, Any]] =',
    '    Future.successful(Map.empty)',
    '}',
    '',
  ].join('\n');

  // 0b. Fail-closed AuthorizationPort isolation implementation (override in handwritten/scala for external PDP integration)
  handwrittenFiles[`app/${pkgDir}/infrastructure/api/AuthorizationPortImpl.scala`] = [
    `// @knowledge source:${docId}#/service/authorization-port`,
    `package ${packageName}.infrastructure.api`,
    '',
    'import javax.inject.{Inject, Singleton}',
    `import ${packageName}.interfaces.api.{AuthorizationPort, AuthzDecisionQuery}`,
    '',
    '/** Default fail-closed external PDP adapter; replace with real policy engine client for external-pdp routes. */',
    '@Singleton',
    'final class AuthorizationPortImpl @Inject()() extends AuthorizationPort {',
    '  override def decide(query: AuthzDecisionQuery): Boolean = false',
    '}',
    '',
  ].join('\n');

  // 1. #36 infrastructure/api/CommandDsl.scala + AuthEndpointDsl.scala (Play Endpoint DSL, ApiError, RoleGate & Id/Instant guards)
  files[`app/${pkgDir}/infrastructure/api/AuthEndpointDsl.scala`] = [
    `// @knowledge source:${docId}#/service/auth-endpoint-dsl`,
    `package ${packageName}.infrastructure.api`,
    '',
    'import javax.inject.{Inject, Singleton}',
    'import play.api.libs.json.{JsValue, Json, OWrites, Reads, Writes}',
    'import play.api.mvc.{AbstractController, Action, AnyContent, ControllerComponents, Request}',
    'import scala.concurrent.{ExecutionContext, Future}',
    '',
    'final case class ApiError(status: Int, code: String, message: String)',
    'object ApiError {',
    '  def badRequest(msg: String): ApiError = ApiError(400, "BAD_REQUEST", msg)',
    '  def unauthorized(msg: String): ApiError = ApiError(401, "NOT_AUTHENTICATED", msg)',
    '  def forbidden(msg: String): ApiError = ApiError(403, "NOT_AUTHORIZED", msg)',
    '  def notFound(msg: String): ApiError = ApiError(404, "NOT_FOUND", msg)',
    '  implicit val writes: OWrites[ApiError] = Json.writes[ApiError]',
    '}',
    '',
    'final case class AuthContext(',
    '  userId: String,',
    '  roles: Seq[String],',
    '  tenantId: Option[String],',
    '  entitlements: Set[String] = Set.empty,',
    '  attributes: Map[String, String] = Map.empty',
    ')',
    '',
    'object RoleGate {',
    '  def check(allowedRoles: Seq[String], ctx: AuthContext): Boolean =',
    '    allowedRoles.isEmpty || ctx.roles.exists(allowedRoles.contains)',
    '}',
    '',
    '/** Play Endpoint DSL trusting gateway-injected X-User-Id / X-Roles / X-Tenant-Id headers.',
    '  * Deploy strictly behind an authenticating API Gateway / BFF; never expose directly to untrusted public traffic.',
    '  */',
    '@Singleton',
    'final class Endpoint @Inject()(cc: ControllerComponents)(implicit ec: ExecutionContext) extends AbstractController(cc) {',
    '',
    '  private def extractContext(req: Request[AnyContent], requireAuth: Boolean, requireTenant: Boolean): Either[ApiError, AuthContext] = {',
    '    val userOpt = req.headers.get("X-User-Id").map(_.trim).filter(_.nonEmpty)',
    '    if (requireAuth && userOpt.isEmpty) {',
    '      Left(ApiError.unauthorized("missing X-User-Id authentication header"))',
    '    } else {',
    '      val roles = req.headers.get("X-Roles").toSeq.flatMap(_.split(",")).map(_.trim).filter(_.nonEmpty)',
    '      val tenantOpt = req.headers.get("X-Tenant-Id").map(_.trim).filter(_.nonEmpty)',
    '      val entitlements = req.headers.get("X-Entitlements").toSeq.flatMap(_.split(",")).map(_.trim).filter(_.nonEmpty).toSet',
    '      val attributes = req.headers.toSimpleMap.collect {',
    '        case (k, v) if k.toLowerCase.startsWith("x-principal-attr-") && v.trim.nonEmpty =>',
    '          k.substring("x-principal-attr-".length) -> v.trim',
    '      }',
    '      if (requireTenant && tenantOpt.isEmpty) Left(ApiError.forbidden("missing X-Tenant-Id for tenant-scoped endpoint"))',
    '      else Right(AuthContext(userOpt.getOrElse("anonymous"), roles, tenantOpt, entitlements, attributes))',
    '    }',
    '  }',
    '',
    '  private def foldResult[R: Writes](res: Future[Either[ApiError, R]]) = {',
    '    res.map {',
    '      case Left(err) => Status(err.status)(Json.obj("ok" -> false, "code" -> err.code, "message" -> err.message))',
    '      case Right(ok) => Ok(Json.toJson(ok))',
    '    }',
    '  }',
    '',
    '  final class AuthedReadBuilder(requireAuth: Boolean, requireTenant: Boolean, roles: Seq[String]) {',
    '    def apply[R: Writes](fn: (AuthContext, Request[AnyContent]) => Future[Either[ApiError, R]]): Action[AnyContent] =',
    '      Action.async { req =>',
    '        extractContext(req, requireAuth, requireTenant) match {',
    '          case Left(err) => Future.successful(Status(err.status)(Json.obj("ok" -> false, "code" -> err.code, "message" -> err.message)))',
    '          case Right(ctx) if !RoleGate.check(roles, ctx) =>',
    '            Future.successful(Forbidden(Json.obj("ok" -> false, "code" -> "NOT_AUTHORIZED", "message" -> "insufficient role")))',
    '          case Right(ctx) => foldResult(fn(ctx, req))',
    '        }',
    '      }',
    '  }',
    '',
    '  final class AuthedWriteBuilder[A](requireAuth: Boolean, requireTenant: Boolean, roles: Seq[String]) {',
    '    def apply[R](fn: (AuthContext, A) => Future[Either[ApiError, R]])(implicit reads: Reads[A], writes: Writes[R]): Action[AnyContent] =',
    '      Action.async { req =>',
    '        extractContext(req, requireAuth, requireTenant) match {',
    '          case Left(err) => Future.successful(Status(err.status)(Json.obj("ok" -> false, "code" -> err.code, "message" -> err.message)))',
    '          case Right(ctx) if !RoleGate.check(roles, ctx) =>',
    '            Future.successful(Forbidden(Json.obj("ok" -> false, "code" -> "NOT_AUTHORIZED", "message" -> "insufficient role")))',
    '          case Right(ctx) =>',
    '            req.body.asJson.getOrElse(Json.obj()).validate[A].asEither match {',
    '              case Left(errs) => Future.successful(BadRequest(Json.obj("ok" -> false, "code" -> "INVALID_JSON", "message" -> errs.toString)))',
    '              case Right(payload) => foldResult(fn(ctx, payload))',
    '            }',
    '        }',
    '      }',
    '  }',
    '',
    '  final class AnonymousReadBuilder {',
    '    def apply[R](fn: Request[AnyContent] => Future[Either[ApiError, R]])(implicit writes: Writes[R]): Action[AnyContent] =',
    '      Action.async { req => foldResult(fn(req)) }',
    '  }',
    '',
    '  final class AnonymousWriteBuilder[A] {',
    '    def apply[R](fn: (Request[AnyContent], A) => Future[Either[ApiError, R]])(implicit reads: Reads[A], writes: Writes[R]): Action[AnyContent] =',
    '      Action.async { req =>',
    '        req.body.asJson.getOrElse(Json.obj()).validate[A].asEither match {',
    '          case Left(errs) => Future.successful(BadRequest(Json.obj("ok" -> false, "code" -> "INVALID_JSON", "message" -> errs.toString)))',
    '          case Right(payload) => foldResult(fn(req, payload))',
    '        }',
    '      }',
    '  }',
    '',
    '  object global {',
    '    def read(roles: String*): AuthedReadBuilder = new AuthedReadBuilder(requireAuth = true, requireTenant = false, roles)',
    '    def write[A](roles: String*): AuthedWriteBuilder[A] = new AuthedWriteBuilder[A](requireAuth = true, requireTenant = false, roles)',
    '  }',
    '',
    '  object tenant {',
    '    def read(roles: String*): AuthedReadBuilder = new AuthedReadBuilder(requireAuth = true, requireTenant = true, roles)',
    '    def write[A](roles: String*): AuthedWriteBuilder[A] = new AuthedWriteBuilder[A](requireAuth = true, requireTenant = true, roles)',
    '  }',
    '',
    '  object anonymous {',
    '    def read: AnonymousReadBuilder = new AnonymousReadBuilder()',
    '    def write[A]: AnonymousWriteBuilder[A] = new AnonymousWriteBuilder[A]()',
    '  }',
    '}',
    '',
  ].join('\n');

  files[`app/${pkgDir}/infrastructure/api/CommandDsl.scala`] = [
    `// @knowledge source:${docId}#/service`,
    `package ${packageName}.infrastructure.api`,
    '',
    'import java.time.Instant',
    'import java.util.UUID',
    `import ${rp.commonPackage}.Id`,
    'import play.api.libs.json.{Json, JsValue, OFormat, OWrites, Writes}',
    'import scala.util.Try',
    '',
    'final case class OkReceipt(id: String, ruleId: String = "", status: String = "ok")',
    'object OkReceipt {',
    '  implicit val format: OFormat[OkReceipt] = Json.format[OkReceipt]',
    '}',
    '',
    'final case class ViewItem(id: String, data: JsValue)',
    'object ViewItem {',
    '  implicit val writes: OWrites[ViewItem] = Json.writes[ViewItem]',
    '}',
    '',
    'final case class ViewListDto[T](items: Seq[T], page: Int, pageSize: Int, total: Long)',
    'object ViewListDto {',
    '  implicit def writes[T: Writes]: OWrites[ViewListDto[T]] = Json.writes[ViewListDto[T]]',
    '}',
    '',
    'object IdGuard {',
    '  def parse(raw: String, field: String = "id"): Either[ApiError, String] = {',
    '    val trimmed = Option(raw).map(_.trim).getOrElse("")',
    '    if (trimmed.isEmpty) Left(ApiError.badRequest(s"$field must not be blank"))',
    '    else Right(trimmed)',
    '  }',
    '',
    '  def parseUuid(raw: String, field: String = "id"): Either[ApiError, UUID] =',
    '    Try(Id.of(raw)).toEither.left.map(_ => ApiError.badRequest(s"invalid UUID $field: $raw"))',
    '}',
    '',
    'object InstantGuard {',
    '  def parse(raw: String, field: String = "timestamp"): Either[ApiError, Instant] =',
    '    Try(Instant.parse(raw)).toEither.left.map(_ => ApiError.badRequest(s"invalid ISO-8601 $field: $raw"))',
    '}',
    '',
  ].join('\n');
  familiesUsed.push('command-endpoint-dsl');

  // 2. #34 controllers/AggregateStateApiController.scala (multi-aggregate safe: qualified <Agg>Entity.State + <Agg>Protocol.GetState)
  // A10 fix: disambiguate colliding AggregateStateApiController methods & route segments (e.g. Order vs OrderAggregate)
  const stateControllerAggs = [];
  const usedMethodNames = new Set();
  const usedRouteSegments = new Set();
  for (const agg of aggregates) {
    const base = stripAggregateSuffix(agg.name);
    let methodName = toCamel(base);
    let routeSegment = toKebab(base);
    if (usedMethodNames.has(methodName) || usedRouteSegments.has(routeSegment)) {
      methodName = toCamel(agg.name);
      routeSegment = toKebab(agg.name);
    }
    let suffix = 2;
    while (usedMethodNames.has(methodName) || usedRouteSegments.has(routeSegment)) {
      methodName = `${toCamel(agg.name)}${suffix}`;
      routeSegment = `${toKebab(agg.name)}-${suffix}`;
      suffix += 1;
    }
    usedMethodNames.add(methodName);
    usedRouteSegments.add(routeSegment);
    const scalarFields = (agg.stateFields ?? []).map(sf => ({
      name: sf.name,
      signature: toPlayJsonBuiltinSignature(sf.resolvedType, exactNames),
    }));
    stateControllerAggs.push({
      aggregateName: agg.name,
      base,
      methodName,
      routeSegment,
      repositoryName: `${toCamel(agg.name)}Repository`,
      repositoryType: `${packageName}.application.aggregates.repository.${agg.name}Repository`,
      protocolType: `${packageName}.application.aggregates.${agg.name}Protocol`,
      entityType: `${packageName}.domain.entities.${agg.name}Entity`,
      idParam: `${methodName}Id`,
      stateFields: scalarFields,
    });
  }

  let emittedAggregateStateController = false;
  if (stateControllerAggs.length > 0) {
    const aggImports = [...new Set(stateControllerAggs.flatMap(a => [
      `import ${a.protocolType}`,
      `import ${a.repositoryType}`,
      `import ${a.entityType}`,
    ]))].sort();
    const ascLines = [
      `// @knowledge source:${docId}#/service/aggregate-state-api`,
      'package controllers',
      '',
      'import akka.actor.typed.ActorRef',
      'import akka.util.Timeout',
      ...aggImports,
      `import ${packageName}.infrastructure.api.{ApiError, Endpoint, IdGuard}`,
      'import javax.inject.{Inject, Singleton}',
      'import play.api.libs.json.{JsArray, JsBoolean, JsNull, JsNumber, JsObject, JsString, JsValue, Json, OWrites}',
      'import play.api.mvc.{Action, AnyContent, BaseController, ControllerComponents}',
      'import scala.concurrent.{ExecutionContext, Future}',
      'import scala.concurrent.duration._',
      '',
      '/** Multi-aggregate write-side consistent state query controller (uses <Agg>Protocol.GetState + qualified <Agg>Entity.State). */',
      '@Singleton',
      'class AggregateStateApiController @Inject()(',
      '  api: Endpoint,',
      ...stateControllerAggs.map(a => `  ${a.repositoryName}: ${a.aggregateName}Repository,`),
      '  val cc: ControllerComponents',
      ')(implicit ec: ExecutionContext) extends BaseController {',
      '',
      '  override def controllerComponents: ControllerComponents = cc',
      '  private implicit val timeout: Timeout = Timeout(5.seconds)',
      '',
      '  private def anyToJson(v: Any): JsValue = v match {',
      '    case null             => JsNull',
      '    case None             => JsNull',
      '    case Some(inner)      => anyToJson(inner)',
      '    case s: String        => JsString(s)',
      '    case b: Boolean       => JsBoolean(b)',
      '    case n: Int           => JsNumber(BigDecimal(n))',
      '    case n: Long          => JsNumber(BigDecimal(n))',
      '    case n: BigDecimal    => JsNumber(n)',
      '    case m: Map[_, _]     => JsObject(m.map { case (k, vv) => k.toString -> anyToJson(vv) }.toSeq)',
      '    case seq: Iterable[_] => JsArray(seq.map(anyToJson).toSeq)',
      '    case other            => JsString(other.toString)',
      '  }',
      '',
    ];
    for (const a of stateControllerAggs) {
      const pairs = a.stateFields.length > 0
        ? a.stateFields.map(f => `    ${JSON.stringify(f.name)} -> anyToJson(st.${f.name})`).join(',\n')
        : `    "state" -> JsString(st.toString)`;
      ascLines.push(`  private implicit val writes${a.aggregateName}State: OWrites[${a.aggregateName}Entity.State] = (st: ${a.aggregateName}Entity.State) => Json.obj(`);
      ascLines.push(pairs);
      ascLines.push('  )', '');
    }
    for (const a of stateControllerAggs) {
      ascLines.push(`  def ${a.methodName}(id: String): Action[AnyContent] =`);
      ascLines.push(`    api.global.read().apply[${a.aggregateName}Entity.State] { (_, _) =>`);
      ascLines.push(`      IdGuard.parse(id, ${JSON.stringify(a.idParam)}) match {`);
      ascLines.push('        case Right(validId) =>');
      ascLines.push(`          ${a.repositoryName}.entityRefFor(validId).ask { (replyTo: ActorRef[${a.aggregateName}Entity.State]) =>`);
      ascLines.push(`            ${a.aggregateName}Protocol.GetState(replyTo)`);
      ascLines.push(`          }.map(st => Right(st): Either[ApiError, ${a.aggregateName}Entity.State])`);
      ascLines.push('        case Left(err) =>');
      ascLines.push(`          Future.successful(Left(err): Either[ApiError, ${a.aggregateName}Entity.State])`);
      ascLines.push('      }');
      ascLines.push('    }', '');
    }
    ascLines.push('}', '');
    files['app/controllers/AggregateStateApiController.scala'] = ascLines.join('\n');
    familiesUsed.push('aggregate-state-controller');
    emittedAggregateStateController = true;
  }

  // 3. #35 controllers/<Story>PlayController.scala (auth-core Endpoint DSL: api.tenant/global/anonymous + RoleGate)
  const routeLines = [
    `# Play HTTP routes for ${canonicalV2.system || 'app'}/${context}`,
    `GET     /health                                                     ${packageName}.interfaces.web.PlayHttpBridge.health`,
  ];

  const routesByStory = new Map();
  for (const r of routes) {
    if (!routesByStory.has(r.storyName)) routesByStory.set(r.storyName, []);
    routesByStory.get(r.storyName).push(r);
  }

  const storyMap = new Map((canonicalV2.structures?.stories ?? []).map(s => [s.name, s]));
  for (const beh of appBehaviors) {
    const storyName = beh.target;
    const pascal = toPascal(storyName);
    const storyRoutes = routesByStory.get(storyName) ?? [];
    if (storyRoutes.length === 0) continue;
    const storyStruct = storyMap.get(storyName) ?? null;
    const coveredUcs = Array.isArray(storyStruct?.coversUseCases) ? storyStruct.coversUseCases : [];
    const forbiddenFields = new Set(['stateSnapshot']);
    for (const ax of beh.axioms ?? []) {
      for (const act of ax.actions ?? []) {
        if (act.kind === 'supply' && act.modality === 'SHALL_NOT') {
          for (const f of act.fields ?? []) forbiddenFields.add(f);
        }
      }
    }
    for (const f of storyStruct?.callerContract?.forbiddenUntrustedFields ?? []) {
      forbiddenFields.add(f);
    }
    const forbiddenScalaExpr = `Set(${[...forbiddenFields].map(f => JSON.stringify(f)).join(', ')})`;

    const ctrlName = `${pascal}PlayController`;
    const lines = [
      `// @knowledge source:${docId}#/stories/${storyName}`,
      ...coveredUcs.map(ucId => `// @knowledge source:${docId}#/useCases/${ucId}`),
      'package controllers',
      '',
      'import javax.inject.{Inject, Singleton}',
      `import ${packageName}.application.services.{${pascal}EffectsPort, ${pascal}ExternPorts, ${pascal}Handler, ${pascal}Request}`,
      `import ${packageName}.infrastructure.api.{ApiError, AuthContext, Endpoint, OkReceipt, RoleGate, ServerSnapshotProvider}`,
      `import ${packageName}.interfaces.api.{AuthorizationPort, AuthzDecisionQuery, AuthzEntitlement, AuthzResource, HttpStatusMapper, Principal}`,
      'import play.api.libs.json.{JsArray, JsBoolean, JsNull, JsNumber, JsObject, JsString, JsValue, Json}',
      'import play.api.mvc.{AbstractController, Action, AnyContent, ControllerComponents}',
      'import scala.concurrent.{ExecutionContext, Future}',
      '',
      '@Singleton',
      `final class ${ctrlName} @Inject()(`,
      '  cc: ControllerComponents,',
      '  api: Endpoint,',
      `  handler: ${pascal}Handler,`,
      `  externs: ${pascal}ExternPorts,`,
      `  effects: ${pascal}EffectsPort,`,
      '  snapshots: ServerSnapshotProvider,',
      '  pdp: AuthorizationPort',
      ')(implicit ec: ExecutionContext) extends AbstractController(cc) {',
      '',
      '  private def jsValueToAny(v: JsValue): Any = v match {',
      '    case JsString(s)    => s',
      '    case JsNumber(n)    => n',
      '    case b: JsBoolean   => b.value',
      '    case obj: JsObject  => jsObjToMap(obj)',
      '    case arr: JsArray   => arr.value.map(jsValueToAny).toVector',
      '    case JsNull         => null',
      '  }',
      '',
      '  private def jsObjToMap(js: JsObject): Map[String, Any] =',
      '    js.value.map { case (k, v) => k -> jsValueToAny(v) }.toMap',
      '',
      '  private def coerceQueryValue(key: String, raw: String, queryTypes: Map[String, String]): Any =',
      '    queryTypes.get(key) match {',
      '      case Some("int") => scala.util.Try(raw.trim.toLong).getOrElse(raw)',
      '      case Some("bool") =>',
      '        raw.trim.toLowerCase match {',
      '          case "true"  => true',
      '          case "false" => false',
      '          case _       => raw',
      '        }',
      '      case Some("decimal") => scala.util.Try(BigDecimal(raw.trim)).getOrElse(raw)',
      '      case _ => raw',
      '    }',
      '',
      '  private def toJsValue(v: Any): JsValue = v match {',
      '    case null               => JsNull',
      '    case s: String          => JsString(s)',
      '    case b: Boolean         => JsBoolean(b)',
      '    case n: Int             => JsNumber(BigDecimal(n))',
      '    case n: Long            => JsNumber(BigDecimal(n))',
      '    case n: BigDecimal      => JsNumber(n)',
      '    case Some(inner)        => toJsValue(inner)',
      '    case None               => JsNull',
      '    case m: Map[_, _]       => JsObject(m.map { case (k, vv) => k.toString -> toJsValue(vv) }.toSeq)',
      '    case seq: Iterable[_]   => JsArray(seq.map(toJsValue).toSeq)',
      '    case p: Product         => JsObject(p.productElementNames.zip(p.productIterator).map { case (k, vv) => k -> toJsValue(vv) }.toSeq)',
      '    case other              => JsString(other.toString)',
      '  }',
      '',
      '  private def lookupAttr(ctx: AuthContext, key: String): Option[String] =',
      '    ctx.attributes.get(key).orElse(ctx.attributes.collectFirst { case (k, v) if k.equalsIgnoreCase(key) => v })',
      '',
      '  private def resolvePrincipalBinding(ctx: AuthContext, key: String): Option[Any] =',
      '    if (key == "id" || key == "principal.id") Some(ctx.userId)',
      '    else if (key == "tenantId" || key == "principal.tenantId") ctx.tenantId',
      '    else if (key == "roles" || key == "principal.roles") Some(ctx.roles)',
      '    else if (key.startsWith("principal.attributes.")) lookupAttr(ctx, key.drop(21))',
      '    else if (key.startsWith("attributes.")) lookupAttr(ctx, key.drop(11))',
      '    else lookupAttr(ctx, key)',
      '',
    ];

    const seenActions = new Set();
    for (const r of storyRoutes) {
      const baseAction = toCamel(`${r.portName}${toPascal(r.opName)}`);
      const actionName = seenActions.has(baseAction) ? `${baseAction}_${seenActions.size}` : baseAction;
      seenActions.add(actionName);

      const endpointExpr = buildAuthCoreEndpointCall(r);
      const isPublic = r.authz?.mode === 'public';
      const isRead = r.method === 'GET';
      let rolesDoc = isPublic ? 'public' : 'authenticated';
      if ((r.authz?.allowedRoles ?? []).length > 0) {
        rolesDoc = `roles=[${r.authz.allowedRoles.join(', ')}]`;
      }
      const bindBindings = r.authz?.bindPrincipal ?? [];
      const bindParamNames = bindBindings.map(b => b.param);
      const stripKeysExpr = bindParamNames.length > 0
        ? `(${forbiddenScalaExpr} ++ Set(${bindParamNames.map(p => JSON.stringify(p)).join(', ')}))`
        : forbiddenScalaExpr;
      const isExternalPdp = !isPublic && r.authz?.mode === 'external-pdp';

      lines.push(`  // @knowledge source:${docId}#/ports/${r.portName}/${r.opName}`);
      lines.push(`  /** ${r.method} ${r.path} — authz: ${r.authz?.mode ?? 'rbac'} (${rolesDoc}, scope=${r.authz?.scope ?? 'global'}) */`);
      if (isRead) {
        const qTypeEntries = Object.entries(r.queryParamTypes ?? {}).map(([k, v]) => `${JSON.stringify(k)} -> ${JSON.stringify(v)}`);
        const qTypesExpr = qTypeEntries.length > 0 ? `Map[String, String](${qTypeEntries.join(', ')})` : 'Map.empty[String, String]';
        if (isPublic) {
          lines.push(`  def ${actionName}(): Action[AnyContent] = ${endpointExpr} { req =>`);
          lines.push(`    val queryTypes: Map[String, String] = ${qTypesExpr}`);
          lines.push(`    val rawPayload: Map[String, Any] = req.queryString.collect { case (k, v) if v.nonEmpty => k -> (if (v.size == 1) coerceQueryValue(k, v.head, queryTypes) else v.map(x => coerceQueryValue(k, x, queryTypes)).toVector) } -- ${stripKeysExpr}`);
          lines.push('    val principal: Option[Map[String, Any]] = None');
        } else {
          lines.push(`  def ${actionName}(): Action[AnyContent] = ${endpointExpr} { (ctx, req) =>`);
          lines.push(`    val queryTypes: Map[String, String] = ${qTypesExpr}`);
          lines.push(`    val sanitized: Map[String, Any] = req.queryString.collect { case (k, v) if v.nonEmpty => k -> (if (v.size == 1) coerceQueryValue(k, v.head, queryTypes) else v.map(x => coerceQueryValue(k, x, queryTypes)).toVector) } -- ${stripKeysExpr}`);
          lines.push('    val principal: Option[Map[String, Any]] = Some(Map[String, Any]("id" -> ctx.userId, "roles" -> ctx.roles, "tenantId" -> ctx.tenantId.getOrElse(""), "entitlements" -> ctx.entitlements, "attributes" -> ctx.attributes))');
        }
      } else if (isPublic) {
        lines.push(`  def ${actionName}(): Action[AnyContent] = ${endpointExpr} { (_, body) =>`);
        lines.push(`    val rawPayload: Map[String, Any] = jsObjToMap(body) -- ${stripKeysExpr}`);
        lines.push('    val principal: Option[Map[String, Any]] = None');
      } else {
        lines.push(`  def ${actionName}(): Action[AnyContent] = ${endpointExpr} { (ctx, body) =>`);
        lines.push(`    val sanitized: Map[String, Any] = jsObjToMap(body) -- ${stripKeysExpr}`);
        lines.push('    val principal: Option[Map[String, Any]] = Some(Map[String, Any]("id" -> ctx.userId, "roles" -> ctx.roles, "tenantId" -> ctx.tenantId.getOrElse(""), "entitlements" -> ctx.entitlements, "attributes" -> ctx.attributes))');
      }
      if (!isPublic && bindBindings.length > 0) {
        const pairsExpr = bindBindings.map(b => `(${JSON.stringify(b.param)}, ${JSON.stringify(b.from)})`).join(', ');
        lines.push(`    val boundOrErr: Either[ApiError, Map[String, Any]] = Seq[(String, String)](${pairsExpr}).foldLeft[Either[ApiError, Map[String, Any]]](Right(sanitized)) {`);
        lines.push('      case (Left(err), _) => Left(err)');
        lines.push('      case (Right(acc), (param, from)) =>');
        lines.push('        resolvePrincipalBinding(ctx, from) match {');
        lines.push('          case Some(v) => Right(acc + (param -> v))');
        lines.push('          case None    => Left(ApiError(403, "PRINCIPAL_BINDING_MISSING", s"missing principal attribute for binding $param"))');
        lines.push('        }');
        lines.push('    }');
        lines.push('    boundOrErr match {');
        lines.push('      case Left(err) => Future.successful(Left(err))');
        lines.push('      case Right(rawPayload) =>');
      } else if (!isPublic) {
        lines.push('    val rawPayload: Map[String, Any] = sanitized');
      }
      const ownerField = r.authz?.resource?.ownerField ?? null;
      const ownerKey = r.authz?.resource?.ownerPrincipalKey ?? 'id';
      const entitlements = r.authz?.requiresEntitlement ?? [];
      const rowScope = r.rowScope?.kind && r.rowScope.kind !== 'global' && r.rowScope.matchField ? r.rowScope : null;

      lines.push(`    snapshots.load(${JSON.stringify(r.operation)}, rawPayload, principal).map { snap =>`);
      if (isExternalPdp) {
        const pdpScopeExpr = r.authz?.scope ? `Some(${JSON.stringify(r.authz.scope)})` : 'None';
        const pdpPolicyExpr = r.authz?.policyRef ? `Some(${JSON.stringify(r.authz.policyRef)})` : 'None';
        const pdpResExpr = r.authz?.resource?.type
          ? `Some(AuthzResource(resourceType = ${JSON.stringify(r.authz.resource.type)}, ownerField = ${ownerField ? `Some(${JSON.stringify(ownerField)})` : 'None'}, ownerId = ${ownerField ? `snap.get(${JSON.stringify(ownerField)}).map(_.toString)` : 'None'}))`
          : 'None';
        const pdpEntsExpr = entitlements.length > 0
          ? `Seq(${entitlements.map(e => `AuthzEntitlement(code = ${JSON.stringify(e.code)}, matchParam = ${e.matchParam ? `Some(${JSON.stringify(e.matchParam)})` : 'None'})`).join(', ')})`
          : 'Seq.empty';
        lines.push('      val pdpPrincipal = Principal(id = ctx.userId, roles = ctx.roles.toSet, tenantId = ctx.tenantId, attributes = ctx.attributes, entitlements = ctx.entitlements)');
        lines.push(`      val pdpQuery = AuthzDecisionQuery(principal = pdpPrincipal, callerKind = ${JSON.stringify(r.callerKind ?? 'user')}, action = ${JSON.stringify(r.operation)}, scope = ${pdpScopeExpr}, policyRef = ${pdpPolicyExpr}, context = rawPayload ++ snap, resource = ${pdpResExpr}, entitlements = ${pdpEntsExpr})`);
        lines.push('      if (!pdp.decide(pdpQuery)) {');
        lines.push('        Left(ApiError(403, "FORBIDDEN_PDP", "external PDP policy denied access"))');
        lines.push('      } else {');
      }
      if (!isPublic && ownerField) {
        lines.push(`      val expectedOwner = resolvePrincipalBinding(ctx, ${JSON.stringify(ownerKey)}).map(_.toString)`);
        lines.push(`      val actualOwner = snap.get(${JSON.stringify(ownerField)}).map(_.toString)`);
        lines.push('      if (expectedOwner.isEmpty || actualOwner.isEmpty || actualOwner != expectedOwner) {');
        lines.push('        Left(ApiError(403, "FORBIDDEN_RESOURCE", "resource ownership check failed"))');
        lines.push('      } else {');
      }
      if (!isPublic && entitlements.length > 0) {
        const entListExpr = entitlements.map(e => `(${JSON.stringify(e.code)}, ${e.matchParam ? `Some(${JSON.stringify(e.matchParam)})` : 'None'})`).join(', ');
        lines.push(`      val missingEnt = Seq[(String, Option[String])](${entListExpr}).exists { case (code, mp) =>`);
        lines.push('        val mv = mp.flatMap(rawPayload.get).map(_.toString)');
        lines.push('        !(ctx.entitlements.contains(code) || mv.exists(v => ctx.entitlements.contains(s"$code:$v") || ctx.entitlements.contains(s"$code:*")))');
        lines.push('      }');
        lines.push('      if (missingEnt) {');
        lines.push('        Left(ApiError(403, "ENTITLEMENT_REQUIRED", "missing required entitlement"))');
        lines.push('      } else {');
      }
      lines.push(`      val appReq = ${pascal}Request(operation = ${JSON.stringify(r.operation)}, payload = rawPayload, stateSnapshot = snap, principal = principal)`);
      lines.push('      handler.handle(appReq, externs, effects) match {');
      lines.push('        case Left(err)  => Left(ApiError(HttpStatusMapper.statusForRejection(err.code), err.code, err.message))');
      lines.push('        case Right(res) =>');
      if (!isPublic && rowScope) {
        lines.push(`          val rowScopeDenied = res.view.nonEmpty && {`);
        lines.push(`            val exp = resolvePrincipalBinding(ctx, ${JSON.stringify(rowScope.principalKey ?? 'id')}).map(_.toString)`);
        lines.push(`            val act = res.view.get(${JSON.stringify(rowScope.matchField)}).map(_.toString)`);
        lines.push('            exp.isEmpty || act.isEmpty || act != exp');
        lines.push('          }');
        lines.push('          if (rowScopeDenied) Left(ApiError(403, "FORBIDDEN_ROW_SCOPE", "row scope mismatch"))');
        lines.push('          else {');
        lines.push('            val receipt = OkReceipt(id = res.ruleId, ruleId = res.ruleId)');
        lines.push('            Right(Json.obj("ok" -> true, "receipt" -> Json.toJson(receipt), "response" -> toJsValue(res.response), "view" -> toJsValue(res.view)))');
        lines.push('          }');
      } else {
        lines.push('          val receipt = OkReceipt(id = res.ruleId, ruleId = res.ruleId)');
        lines.push('          Right(Json.obj("ok" -> true, "receipt" -> Json.toJson(receipt), "response" -> toJsValue(res.response), "view" -> toJsValue(res.view)))');
      }
      lines.push('      }');
      if (!isPublic && entitlements.length > 0) lines.push('      }');
      if (!isPublic && ownerField) lines.push('      }');
      if (isExternalPdp) lines.push('      }');
      lines.push('    }');
      if (!isPublic && bindBindings.length > 0) lines.push('    }');
      lines.push('  }');
      lines.push('');

      routeLines.push(`${r.method.padEnd(7)} ${r.path.padEnd(59)} controllers.${ctrlName}.${actionName}()`);
    }

    lines.push('}', '');
    files[`app/controllers/${ctrlName}.scala`] = lines.join('\n');
  }
  if (appBehaviors.length > 0) {
    familiesUsed.push('http-controller');
  }

  // Add AggregateStateApiController routes to conf/routes
  if (emittedAggregateStateController) {
    routeLines.push('');
    routeLines.push('# Write-side aggregate state query routes (family #34 AggregateStateApiController)');
    for (const a of stateControllerAggs) {
      const path = `/api/v1/${toKebab(context)}/aggregates/${a.routeSegment}/:${a.idParam}`;
      routeLines.push(`GET     ${path.padEnd(59)} controllers.AggregateStateApiController.${a.methodName}(${a.idParam}: String)`);
    }
  }

  // Fallback catch-all to PlayHttpBridge for any dynamic/subpath health or debug calls
  routeLines.push('');
  files['conf/routes'] = routeLines.join('\n');
  familiesUsed.push('routes');

  return { files, handwrittenFiles, familiesUsed };
}
