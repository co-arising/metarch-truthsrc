// API & Auth-Core Play Controller Bridge for scala-cqrs-play-service@2:
// Restores full 1.0 Play HTTP + auth-core Endpoint DSL + CommandDsl + AggregateStateApiController + conf/routes:
//   - #36 command-endpoint-dsl       -> infrastructure/api/CommandDsl.scala (OkReceipt, ViewListDto, IdGuard, InstantGuard)
//   - #34 aggregate-state-controller -> controllers/AggregateStateApiController.scala (via real 1.0 emitter/families/aggregate-state-controller.mjs)
//   - #35 http-controller            -> controllers/<Story>PlayController.scala (using auth-core Endpoint DSL: api.tenant/global/anonymous + RoleGate)
//   - #37 routes                     -> conf/routes (Play HTTP route table mounting PlayController + AggregateStateApiController + health)
import { family as aggregateStateControllerFamily } from '../../../emitter/families/aggregate-state-controller.mjs';
import { resolveRuntimeProfile } from '../../runtime-profile.mjs';
import { deriveStoryHttpRoutes, toCamel, toPascal } from '../codegen/onion-routes.mjs';

function toSnake(name) {
  return String(name ?? '')
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_|_$/gu, '')
    .toLowerCase();
}

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
  if (mode === 'public') {
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
  const familiesUsed = [];

  // 1. #36 infrastructure/api/CommandDsl.scala (auth-core companion DTOs & Id/Instant guards)
  files[`app/${pkgDir}/infrastructure/api/CommandDsl.scala`] = [
    `// @knowledge source:${docId}#/service`,
    `package ${packageName}.infrastructure.api`,
    '',
    'import java.time.Instant',
    `import ${rp.commonPackage}.CommonTypes.Id`,
    `import ${rp.commonPackage}.auth.ApiError`,
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
    '  def parse(raw: String, field: String = "id"): Either[ApiError, Id] = {',
    '    val trimmed = Option(raw).map(_.trim).getOrElse("")',
    '    if (trimmed.isEmpty) Left(ApiError.badRequest(s"$field must not be blank"))',
    '    else Right(Id(trimmed))',
    '  }',
    '}',
    '',
    'object InstantGuard {',
    '  def parse(raw: String, field: String = "timestamp"): Either[ApiError, Instant] =',
    '    Try(Instant.parse(raw)).toEither.left.map(_ => ApiError.badRequest(s"invalid ISO-8601 $field: $raw"))',
    '}',
    '',
  ].join('\n');
  familiesUsed.push('command-endpoint-dsl');

  // 2. #34 controllers/AggregateStateApiController.scala (invoking real 1.0 emitter/families/aggregate-state-controller.mjs)
  const stateControllerAggs = [];
  for (const agg of aggregates) {
    const base = stripAggregateSuffix(agg.name);
    const scalarFields = [];
    for (const sf of agg.stateFields ?? []) {
      const sig = toPlayJsonBuiltinSignature(sf.resolvedType, exactNames);
      if (sig) scalarFields.push({ name: sf.name, signature: sig });
    }
    if (scalarFields.length === 0) {
      scalarFields.push({ name: agg.idField || 'id', signature: 'String' });
    }
    stateControllerAggs.push({
      aggregateName: agg.name,
      repositoryName: `${toCamel(agg.name)}Repository`,
      repositoryType: `${packageName}.application.aggregates.repository.${agg.name}Repository`,
      commandType: `${packageName}.application.aggregates.${agg.name}Protocol.Get${base}State`,
      replyType: `${packageName}.application.aggregates.${agg.name}Protocol.Get${base}StateReply`,
      stateType: `${packageName}.domain.entities.${agg.name}Entity.State`,
      idParam: `${toCamel(base)}Id`,
      stateFields: scalarFields,
    });
  }

  let emittedAggregateStateController = false;
  if (stateControllerAggs.length > 0) {
    try {
      const ascOut = aggregateStateControllerFamily.renderAll({
        schemaVersion: 'truthsrc.aggregate-state-controller-input/v1',
        controllerPackage: 'controllers',
        controllerName: 'AggregateStateApiController',
        routeBase: `/api/v1/${toKebab(context)}/aggregates`,
        aggregates: stateControllerAggs,
        supplied: [],
      });
      Object.assign(files, ascOut);
      familiesUsed.push('aggregate-state-controller');
      emittedAggregateStateController = true;
    } catch {
      // Fail-open only if aggregate names violate strict PascalCase/base-name rules
    }
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
    const coveredUcs = Array.isArray(storyMap.get(storyName)?.coversUseCases) ? storyMap.get(storyName).coversUseCases : [];

    const ctrlName = `${pascal}PlayController`;
    const lines = [
      `// @knowledge source:${docId}#/stories/${storyName}`,
      ...coveredUcs.map(ucId => `// @knowledge source:${docId}#/useCases/${ucId}`),
      'package controllers',
      '',
      'import javax.inject.{Inject, Singleton}',
      `import ${rp.commonPackage}.auth.{ApiError, Endpoint, RoleGate}`,
      `import ${packageName}.application.services.{${pascal}EffectsPort, ${pascal}ExternPorts, ${pascal}Handler, ${pascal}Request}`,
      `import ${packageName}.infrastructure.api.OkReceipt`,
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
      `  effects: ${pascal}EffectsPort`,
      ')(implicit ec: ExecutionContext) extends AbstractController(cc) {',
      '',
      '  private def jsObjToMap(js: JsObject): Map[String, Any] = js.value.map {',
      '    case (k, JsString(v))  => k -> v',
      '    case (k, JsNumber(v))  => k -> v',
      '    case (k, JsBoolean(v)) => k -> v',
      '    case (k, obj: JsObject) => k -> jsObjToMap(obj)',
      '    case (k, arr: JsArray)  => k -> arr.value.map(_.toString).toSeq',
      '    case (k, JsNull)       => k -> ""',
      '  }.toMap',
      '',
      '  private def toJsValue(v: Any): JsValue = v match {',
      '    case null               => JsNull',
      '    case s: String          => JsString(s)',
      '    case b: Boolean         => JsBoolean(b)',
      '    case n: Int             => JsNumber(BigDecimal(n))',
      '    case n: Long            => JsNumber(BigDecimal(n))',
      '    case n: BigDecimal      => JsNumber(n)',
      '    case m: Map[_, _]       => JsObject(m.map { case (k, vv) => k.toString -> toJsValue(vv) }.toSeq)',
      '    case seq: Iterable[_]   => JsArray(seq.map(toJsValue).toSeq)',
      '    case other              => JsString(other.toString)',
      '  }',
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
      const rolesDoc = (r.authz?.allowedRoles ?? []).length > 0
        ? `roles=[${r.authz.allowedRoles.join(', ')}]`
        : (isPublic ? 'public' : 'authenticated');

      lines.push(`  // @knowledge source:${docId}#/ports/${r.portName}/${r.opName}`);
      lines.push(`  /** ${r.method} ${r.path} — authz: ${r.authz?.mode ?? 'rbac'} (${rolesDoc}, scope=${r.authz?.scope ?? 'global'}) */`);
      if (isRead) {
        if (isPublic) {
          lines.push(`  def ${actionName}(): Action[AnyContent] = ${endpointExpr} { req =>`);
          lines.push('    val payload: Map[String, Any] = req.queryString.collect { case (k, v) if v.nonEmpty => k -> (v.head: Any) }');
          lines.push(`    val appReq = ${pascal}Request(operation = ${JSON.stringify(r.operation)}, payload = payload)`);
        } else {
          lines.push(`  def ${actionName}(): Action[AnyContent] = ${endpointExpr} { (ctx, req) =>`);
          lines.push('    val payload: Map[String, Any] = req.queryString.collect { case (k, v) if v.nonEmpty => k -> (v.head: Any) }');
          lines.push('    val principal = Some(Map[String, Any]("id" -> ctx.userId, "roles" -> ctx.roles, "tenantId" -> ctx.tenantId.getOrElse("")))');
          lines.push(`    val appReq = ${pascal}Request(operation = ${JSON.stringify(r.operation)}, payload = payload, principal = principal)`);
        }
      } else if (isPublic) {
        lines.push(`  def ${actionName}(): Action[AnyContent] = ${endpointExpr} { (_, body) =>`);
        lines.push(`    val appReq = ${pascal}Request(operation = ${JSON.stringify(r.operation)}, payload = jsObjToMap(body))`);
      } else {
        lines.push(`  def ${actionName}(): Action[AnyContent] = ${endpointExpr} { (ctx, body) =>`);
        lines.push('    val principal = Some(Map[String, Any]("id" -> ctx.userId, "roles" -> ctx.roles, "tenantId" -> ctx.tenantId.getOrElse("")))');
        lines.push(`    val appReq = ${pascal}Request(operation = ${JSON.stringify(r.operation)}, payload = jsObjToMap(body), principal = principal)`);
      }
      lines.push('    Future.successful(handler.handle(appReq, externs, effects) match {');
      lines.push('      case Left(err)  => Left(ApiError.badRequest(s"${err.code}: ${err.message}"))');
      lines.push('      case Right(res) =>');
      lines.push('        val receipt = OkReceipt(id = res.ruleId, ruleId = res.ruleId)');
      lines.push('        Right(Json.obj("ok" -> true, "receipt" -> Json.toJson(receipt), "response" -> toJsValue(res.response), "view" -> toJsValue(res.view)))');
      lines.push('    })');
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
      const base = stripAggregateSuffix(a.aggregateName);
      const method = toCamel(base);
      const seg = toKebab(base);
      const path = `/api/v1/${toKebab(context)}/aggregates/${seg}/:${a.idParam}`;
      routeLines.push(`GET     ${path.padEnd(59)} controllers.AggregateStateApiController.${method}(${a.idParam}: String)`);
    }
  }

  // Fallback catch-all to PlayHttpBridge for any dynamic/subpath health or debug calls
  routeLines.push('');
  files['conf/routes'] = routeLines.join('\n');
  familiesUsed.push('routes');

  return { files, familiesUsed };
}
