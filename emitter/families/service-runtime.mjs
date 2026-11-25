// Unified emitter family #38: service-runtime (Wave 1B curated service &
// readside runtime). Emits headerless BankServiceService (with extracted
// requireEndpoint helper), BankServiceLoader (companion-owned Response/Route
// eliminating scalac outer-reference warnings + byId lookup eliminating
// positional apiActions(i)), ApplicationBootstrap, BankServiceConfiguration,
// BankJournalReadside* (with PascalCase query methods), and service conf/sql.
// Zero hardcoded business identifiers; fail-closed (SR_INPUT).
import { scalaSubpackagePath } from '../../lib/layout/layout-strategy.mjs';

const SCHEMA = 'truthsrc.service-runtime-input/v1';
const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/u;
const TYPE_NAME_RE = /^[A-Z][A-Za-z0-9_]*$/u;
const KINDS = new Set(['service-port', 'service-runtime', 'service-config']);

const fail = message => { throw new Error('SR_INPUT: ' + message); };

function checkObject(value, what) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(what + ' must be an object');
  return value;
}

function checkNoExtraKeys(obj, allowed, what) {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) fail(what + ' has unexpected key: ' + key);
  }
}

function checkSource(source, what) {
  checkObject(source, what);
  checkNoExtraKeys(source, new Set(['document', 'pointer']), what);
  if (typeof source.document !== 'string' || !source.document) fail(what + '.document invalid');
  if (typeof source.pointer !== 'string' || !source.pointer.startsWith('/')) fail(what + '.pointer invalid');
}

export function checkInput(input) {
  checkObject(input, 'input');
  checkNoExtraKeys(input, new Set([
    'schemaVersion', 'package', 'serviceName', 'bootstrap', 'journalConnection',
    'readSideConnection', 'endpoints', 'pages', 'artifactSource', 'configurationScala',
    'aggregates', 'readsideProjections', 'readsideFiles',
  ]), 'input');
  if (input.schemaVersion !== SCHEMA) fail('schemaVersion must be ' + SCHEMA);
  if (typeof input.package !== 'string' || !PACKAGE_RE.test(input.package)) fail('package invalid');
  if (typeof input.serviceName !== 'string' || !TYPE_NAME_RE.test(input.serviceName)) fail('serviceName invalid');
  checkObject(input.bootstrap, 'bootstrap');
  checkNoExtraKeys(input.bootstrap, new Set(['id', 'version']), 'bootstrap');
  if (typeof input.bootstrap.id !== 'string' || !input.bootstrap.id) fail('bootstrap.id invalid');
  if (typeof input.bootstrap.version !== 'string' || !input.bootstrap.version) fail('bootstrap.version invalid');
  if (typeof input.journalConnection !== 'string' || !input.journalConnection) fail('journalConnection invalid');
  if (typeof input.readSideConnection !== 'string' || !input.readSideConnection) fail('readSideConnection invalid');
  checkSource(input.artifactSource, 'artifactSource');
  if (typeof input.configurationScala !== 'string' || !input.configurationScala.includes('object '))
    {fail('configurationScala must be non-empty Scala');}
  if (!Array.isArray(input.endpoints) || !input.endpoints.length) fail('endpoints must be non-empty');
  const seenEndpoints = new Set();
  for (let i = 0; i < input.endpoints.length; i++) {
    const ep = checkObject(input.endpoints[i], 'endpoints[' + i + ']');
    checkNoExtraKeys(ep, new Set([
      'id', 'name', 'method', 'path', 'audience', 'csrf', 'inputType', 'outputType', 'implId', 'implVersion',
    ]), 'endpoints[' + i + ']');
    if (typeof ep.id !== 'string' || !ep.id) fail('endpoints[' + i + '].id invalid');
    if (seenEndpoints.has(ep.id)) fail('duplicate endpoint id: ' + ep.id);
    seenEndpoints.add(ep.id);
    if (typeof ep.name !== 'string' || !ep.name) fail('endpoints[' + i + '].name invalid');
    if (typeof ep.method !== 'string' || !ep.method) fail('endpoints[' + i + '].method invalid');
    if (typeof ep.path !== 'string' || !ep.path.startsWith('/')) fail('endpoints[' + i + '].path invalid');
    if (typeof ep.audience !== 'string' || !ep.audience) fail('endpoints[' + i + '].audience invalid');
    if (typeof ep.csrf !== 'boolean') fail('endpoints[' + i + '].csrf must be boolean');
    if (typeof ep.inputType !== 'string' || !ep.inputType) fail('endpoints[' + i + '].inputType invalid');
    if (typeof ep.outputType !== 'string' || !ep.outputType) fail('endpoints[' + i + '].outputType invalid');
    if (typeof ep.implId !== 'string' || !ep.implId) fail('endpoints[' + i + '].implId invalid');
    if (typeof ep.implVersion !== 'string' || !ep.implVersion) fail('endpoints[' + i + '].implVersion invalid');
  }
  if (input.pages !== null) {
    checkObject(input.pages, 'pages');
    checkNoExtraKeys(input.pages, new Set(['rendererId', 'rendererVersion', 'shellPath', 'scriptPath', 'aliases']), 'pages');
    if (typeof input.pages.rendererId !== 'string' || !input.pages.rendererId) fail('pages.rendererId invalid');
    if (typeof input.pages.rendererVersion !== 'string' || !input.pages.rendererVersion) fail('pages.rendererVersion invalid');
    if (typeof input.pages.shellPath !== 'string' || !input.pages.shellPath.startsWith('/')) fail('pages.shellPath invalid');
    if (typeof input.pages.scriptPath !== 'string' || !input.pages.scriptPath.startsWith('/')) fail('pages.scriptPath invalid');
    if (input.pages.shellPath === input.pages.scriptPath) fail('pages.shellPath and pages.scriptPath must be distinct');
    if (!Array.isArray(input.pages.aliases)) fail('pages.aliases must be array');
    for (let i = 0; i < input.pages.aliases.length; i++) {
      const a = checkObject(input.pages.aliases[i], 'pages.aliases[' + i + ']');
      checkNoExtraKeys(a, new Set(['endpointId', 'path']), 'pages.aliases[' + i + ']');
      if (!seenEndpoints.has(a.endpointId)) fail('pages.aliases[' + i + '] unknown endpointId: ' + a.endpointId);
      if (typeof a.path !== 'string' || !a.path.startsWith('/')) fail('pages.aliases[' + i + '].path invalid');
    }
  }
  if (input.aggregates !== undefined) {
    if (!Array.isArray(input.aggregates)) fail('aggregates must be an array');
    for (let i = 0; i < input.aggregates.length; i++) {
      const a = checkObject(input.aggregates[i], 'aggregates[' + i + ']');
      checkNoExtraKeys(a, new Set(['name', 'authority']), 'aggregates[' + i + ']');
      if (typeof a.name !== 'string' || !TYPE_NAME_RE.test(a.name)) fail('aggregates[' + i + '].name invalid');
      if (typeof a.authority !== 'boolean') fail('aggregates[' + i + '].authority must be boolean');
    }
  }
  if (input.readsideProjections !== undefined) {
    if (!Array.isArray(input.readsideProjections)) fail('readsideProjections must be an array');
    for (let i = 0; i < input.readsideProjections.length; i++) {
      const rp = checkObject(input.readsideProjections[i], 'readsideProjections[' + i + ']');
      checkNoExtraKeys(rp, new Set(['name', 'subpackage']), 'readsideProjections[' + i + ']');
      if (typeof rp.name !== 'string' || !TYPE_NAME_RE.test(rp.name)) fail('readsideProjections[' + i + '].name invalid');
      if (typeof rp.subpackage !== 'string' || !PACKAGE_RE.test(rp.subpackage)) fail('readsideProjections[' + i + '].subpackage invalid');
    }
  }
  if (!Array.isArray(input.readsideFiles)) fail('readsideFiles must be an array');
  const seenReadside = new Set();
  for (let i = 0; i < input.readsideFiles.length; i++) {
    const rf = checkObject(input.readsideFiles[i], 'readsideFiles[' + i + ']');
    checkNoExtraKeys(rf, new Set(['path', 'kind', 'content', 'deps', 'sources', 'codeMappings']), 'readsideFiles[' + i + ']');
    if (typeof rf.path !== 'string' || !rf.path) fail('readsideFiles[' + i + '].path invalid');
    if (seenReadside.has(rf.path)) fail('duplicate readside path: ' + rf.path);
    seenReadside.add(rf.path);
    if (!KINDS.has(rf.kind)) fail('readsideFiles[' + i + '].kind invalid');
    if (typeof rf.content !== 'string' || !rf.content) fail('readsideFiles[' + i + '].content invalid');
    if (!Array.isArray(rf.deps)) fail('readsideFiles[' + i + '].deps must be array');
    if (!Array.isArray(rf.sources) || !rf.sources.length) fail('readsideFiles[' + i + '].sources must be non-empty');
    for (let s = 0; s < rf.sources.length; s++) checkSource(rf.sources[s], 'readsideFiles[' + i + '].sources[' + s + ']');
    if (!Array.isArray(rf.codeMappings)) fail('readsideFiles[' + i + '].codeMappings must be array');
  }
}

const q = JSON.stringify;
const routePattern = p => '^/' + p.split('/').slice(1).map(s => s.startsWith(':') ? '([^/]+)' : s).join('/') + '$';

function renderServiceContract(input) {
  const { package: pkg, serviceName: name, endpoints, pages } = input;
  const pageTrait = pages ? [
    '  trait PageRenderer {',
    '    def implementation: String',
    '    def version: String',
    '    def shell: String',
    '    def script: String',
    '    def render(endpointId: String, status: Int, value: JsValue): String',
    '  }',
    '',
  ].join('\n') : '';
  const pageCheck = pages ? [
    '    val installedPages = value.pages',
    `    require(installedPages != null && installedPages.exists(p => p != null && p.implementation == ${q(pages.rendererId)} && p.version == ${q(pages.rendererVersion)}), "page renderer pin mismatch")`,
  ].join('\n') : '';

  return [
    `package ${pkg}.infrastructure.bootstrap`,
    '',
    'import play.api.ApplicationLoader',
    'import play.api.libs.json.{JsValue, Reads, Writes}',
    'import play.api.mvc.{RequestHeader, Result}',
    'import scala.concurrent.Future',
    '',
    `object ${name}Contract {`,
    '  final case class Principal private[bootstrap] (id: String, roles: Set[String])',
    '',
    '  trait Authority {',
    '    def authenticate(request: RequestHeader): Future[Option[(String, Set[String])]]',
    '    def csrf(request: RequestHeader): Future[Boolean]',
    '  }',
    '',
    '  sealed trait Failure { def status: Int; def code: String }',
    '  case object InvalidRequest extends Failure { val status = 400; val code = "invalid-request" }',
    '  case object NotAuthenticated extends Failure { val status = 401; val code = "not-authenticated" }',
    '  case object NotAuthorized extends Failure { val status = 403; val code = "not-authorized" }',
    '  case object MissingResource extends Failure { val status = 404; val code = "not-found" }',
    '  case object RequestConflict extends Failure { val status = 409; val code = "request-conflict" }',
    '  case object Unavailable extends Failure { val status = 503; val code = "service-unavailable" }',
    '',
    '  type Outcome[A] = Either[Failure, A]',
    '',
    '  def decodeBody(text: String): Outcome[JsValue] = {',
    '    val factory = new com.fasterxml.jackson.core.JsonFactory()',
    '    factory.enable(com.fasterxml.jackson.core.JsonParser.Feature.STRICT_DUPLICATE_DETECTION)',
    '    try {',
    '      val parser = factory.createParser(text)',
    '      try {',
    '        var depth = 0',
    '        var roots = 0',
    '        var token = parser.nextToken()',
    '        while (token != null) {',
    '          if (depth == 0) roots += 1',
    '          if (token.isStructStart) depth += 1',
    '          if (token.isStructEnd) depth -= 1',
    '          require(depth >= 0 && depth <= 64 && roots == 1, "bounded single JSON value required")',
    '          token = parser.nextToken()',
    '        }',
    '        require(depth == 0 && roots == 1, "complete JSON required")',
    '        Right(play.api.libs.json.Json.parse(text))',
    '      } finally parser.close()',
    '    } catch { case scala.util.control.NonFatal(_) => Left(InvalidRequest) }',
    '  }',
    '',
    '  final case class Endpoint[I, O](',
    '    implementation: String,',
    '    version: String,',
    '    reads: Reads[I],',
    '    writes: Writes[O],',
    '    run: (Principal, I) => Future[Outcome[O]]',
    '  )',
    '',
    '  final case class Bindings(',
    endpoints.map(e => `    ${e.name}: Endpoint[${e.inputType}, ${e.outputType}]`).join(',\n'),
    '  )',
    '',
    pageTrait + '  trait Composition extends AutoCloseable {',
    '    def authority: Authority',
    '    def bindings: Bindings',
    '    def ready: Future[Unit]',
    ...(pages ? ['    def pages: Option[PageRenderer] = None'] : []),
    '  }',
    '',
    '  trait Factory {',
    '    def implementation: String',
    '    def version: String',
    '    def create(context: ApplicationLoader.Context): Composition',
    '  }',
    '',
    '  private def requireEndpoint[I, O](endpoint: Endpoint[I, O], id: String, impl: String, version: String): Unit =',
    '    require(',
    '      endpoint != null && endpoint.implementation == impl && endpoint.version == version &&',
    '        endpoint.reads != null && endpoint.writes != null && endpoint.run != null,',
    '      "missing service endpoint " + id',
    '    )',
    '',
    '  def requireInstalled(value: Composition): Unit = {',
    '    require(value != null && value.authority != null && value.bindings != null, "complete service composition required")',
    ...endpoints.map(e => `    requireEndpoint(value.bindings.${e.name}, ${q(e.id)}, ${q(e.implId)}, ${q(e.implVersion)})`),
    ...(pageCheck ? [pageCheck] : []),
    '  }',
    '}',
    '',
  ].join('\n');
}

function renderServiceLoader(input) {
  const { package: pkg, serviceName: name, endpoints, pages } = input;
  const csp = "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
  const unavailable = '<!doctype html><html><head><meta charset="utf-8"><title>Service unavailable</title></head><body><p>Service unavailable</p></body></html>';

  const routeRows = endpoints.map(e => {
    const params = e.path.split('/').filter(p => p.startsWith(':')).map(p => p.slice(1));
    return [
      '    Route(',
      `      method = ${q(e.method)},`,
      `      pattern = ${q(routePattern(e.path))}.r,`,
      `      parameters = Vector(${params.map(q).join(', ')}),`,
      `      audience = ${q(e.audience)},`,
      `      csrf = ${e.csrf},`,
      `      endpointId = ${q(e.id)},`,
      '      page = false,',
      `      run = (principal: Principal, input: JsValue) => invoke(composition.bindings.${e.name}, principal, input)`,
      '    )',
    ].join('\n');
  });

  const aliasRows = (pages?.aliases ?? []).map(a =>
    `    apiById(${q(a.endpointId)}).copy(pattern = ${q(routePattern(a.path))}.r, page = true)`
  );

  return [
    `package ${pkg}.infrastructure.bootstrap`,
    '',
    'import play.api.{Application, ApplicationLoader, BuiltInComponentsFromContext}',
    'import play.api.libs.json._',
    'import play.api.mvc._',
    'import play.api.routing.Router',
    'import scala.concurrent.{ExecutionContext, Future}',
    'import scala.util.control.NonFatal',
    `import ${name}Contract._`,
    '',
    `final class ${name}Loader extends ApplicationLoader {`,
    '  def load(context: ApplicationLoader.Context): Application =',
    '    ApplicationBootstrap.load(context)',
    '}',
    '',
    `object ${name}Components {`,
    '  private[bootstrap] final case class Response(status: Int, value: JsValue)',
    '  private[bootstrap] final case class Route(',
    '    method: String,',
    '    pattern: scala.util.matching.Regex,',
    '    parameters: Vector[String],',
    '    audience: String,',
    '    csrf: Boolean,',
    '    endpointId: String,',
    '    page: Boolean,',
    '    run: (Principal, JsValue) => Future[Response]',
    '  )',
    '}',
    '',
    `final class ${name}Components(context: ApplicationLoader.Context, composition: Composition)`,
    '  extends BuiltInComponentsFromContext(context) {',
    `  import ${name}Components.{Response, Route}`,
    '',
    '  implicit private val ec: ExecutionContext = executionContext',
    '  override lazy val httpFilters = Seq.empty[EssentialFilter]',
    '  applicationLifecycle.addStopHook(() => Future(composition.close()))',
    ...(pages ? [
      '  private val pageRenderer: PageRenderer = {',
      '    requireInstalled(composition)',
      '    composition.pages.get',
      '  }',
      '  private val staticHeaders = Vector("Cache-Control" -> "no-store", "X-Content-Type-Options" -> "nosniff", "Referrer-Policy" -> "no-referrer")',
      `  private val htmlHeaders = staticHeaders :+ ("Content-Security-Policy" -> ${q(csp)})`,
      `  private def unavailableHtml: Result = Results.ServiceUnavailable(${q(unavailable)}).as("text/html; charset=utf-8").withHeaders(htmlHeaders: _*)`,
    ] : []),
    '  private def failure(error: Failure): Response = Response(error.status, Json.obj("code" -> error.code))',
    ...(pages ? [
      '  private def renderResponse(row: Route, value: Response): Result =',
      '    if (!row.page) Results.Status(value.status)(value.value)',
      '    else try Results.Status(value.status)(pageRenderer.render(row.endpointId, value.status, value.value)).as("text/html; charset=utf-8").withHeaders(htmlHeaders: _*)',
      '    catch { case NonFatal(_) => unavailableHtml }',
      '  private def staticPage(script: Boolean): Result =',
      '    try {',
      '      if (script) Results.Ok(pageRenderer.script).as("application/javascript; charset=utf-8").withHeaders(staticHeaders: _*)',
      '      else Results.Ok(pageRenderer.shell).as("text/html; charset=utf-8").withHeaders(htmlHeaders: _*)',
      '    } catch { case NonFatal(_) =>',
      '      if (script) Results.ServiceUnavailable("").as("application/javascript; charset=utf-8").withHeaders(staticHeaders: _*)',
      '      else unavailableHtml',
      '    }',
    ] : [
      '  private def renderResponse(row: Route, value: Response): Result = Results.Status(value.status)(value.value)',
    ]),
    '  private def invoke[I, O](endpoint: Endpoint[I, O], principal: Principal, input: JsValue): Future[Response] =',
    '    endpoint.reads.reads(input) match {',
    '      case JsSuccess(value, _) => endpoint.run(principal, value).map {',
    '        case Right(result) => Response(200, endpoint.writes.writes(result))',
    '        case Left(error) => failure(error)',
    '      }',
    '      case _: JsError => Future.successful(failure(InvalidRequest))',
    '    }',
    '  private val apiActions: Vector[Route] = Vector(',
    routeRows.join(',\n'),
    '  )',
    '  private val apiById: Map[String, Route] = apiActions.iterator.map(r => r.endpointId -> r).toMap',
    ...(pages ? [
      '  private val pageActions: Vector[Route] = Vector(',
      aliasRows.join(',\n'),
      '  )',
      '  private val actions: Vector[Route] = apiActions ++ pageActions',
    ] : [
      '  private val actions: Vector[Route] = apiActions',
    ]),
    '  private def dispatchAuthorized(row: Route, matched: scala.util.matching.Regex.Match, request: Request[String], principal: Principal): Future[Response] = {',
    '    val allowed = if (row.csrf) composition.authority.csrf(request) else Future.successful(true)',
    '    allowed.flatMap { ok =>',
    '      if (!ok) Future.successful(Response(403, Json.obj("code" -> "csrf-denied")))',
    '      else {',
    '        val params = JsObject(row.parameters.zipWithIndex.map { case (p, i) => p -> JsString(matched.group(i + 1)) })',
    '        val body = if (row.method == "GET") Right(JsNull) else decodeBody(request.body)',
    '        body match {',
    '          case Left(error) => Future.successful(failure(error))',
    '          case Right(value) =>',
    '            val query = JsObject(request.queryString.toVector.map { case (k, v) => k -> JsArray(v.map(JsString)) })',
    '            row.run(principal, Json.obj("path" -> params, "query" -> query, "body" -> value))',
    '        }',
    '      }',
    '    }',
    '  }',
    '  private def action(row: Route, matched: scala.util.matching.Regex.Match): Handler = {',
    '    val parser: BodyParser[String] = if (!row.page) controllerComponents.parsers.tolerantText(65536)',
    '      else BodyParser("service-page-text") { request =>',
    '        controllerComponents.parsers.tolerantText(65536)(request).map {',
    '          _.left.map(result => renderResponse(row, Response(result.header.status, Json.obj("code" -> "invalid-request"))))',
    '        }',
    '      }',
    '    controllerComponents.actionBuilder.async(parser) { request =>',
    '      Future.successful(()).flatMap(_ => composition.ready).flatMap { _ =>',
    '        composition.authority.authenticate(request).flatMap {',
    '          case Some((id, roles)) if id != null && id.nonEmpty && roles != null && roles.contains(row.audience) =>',
    '            dispatchAuthorized(row, matched, request, Principal(id, roles))',
    '          case None => Future.successful(failure(NotAuthenticated))',
    '          case _ => Future.successful(failure(NotAuthorized))',
    '        }',
    '      }.recover { case NonFatal(_) => failure(Unavailable) }.map(value => renderResponse(row, value))',
    '    }',
    '  }',
    '  override lazy val router: Router = Router.from {',
    ...(pages ? [
      `    case request if request.method == "GET" && request.path == ${q(pages.shellPath)} =>`,
      '      controllerComponents.actionBuilder(controllerComponents.parsers.empty) { _ => staticPage(script = false) }',
      `    case request if request.method == "GET" && request.path == ${q(pages.scriptPath)} =>`,
      '      controllerComponents.actionBuilder(controllerComponents.parsers.empty) { _ => staticPage(script = true) }',
    ] : []),
    '    case request if actions.exists(row => row.method == request.method && row.pattern.findFirstMatchIn(request.path).nonEmpty) =>',
    '      val row = actions.find(r => r.method == request.method && r.pattern.findFirstMatchIn(request.path).nonEmpty).get',
    '      action(row, row.pattern.findFirstMatchIn(request.path).get)',
    '  }',
    '}',
    '',
  ].join('\n');
}

const lowerFirst = s => (s ? s[0].toLowerCase() + s.slice(1) : s);

function renderBootstrapModule(input) {
  const { package: pkg } = input;
  const aggregates = input.aggregates ?? [];
  const repoImports = aggregates.flatMap(a => [
    `import ${pkg}.application.aggregates.repository.${a.name}Repository`,
    `import ${pkg}.infrastructure.repositories.aggregate.${a.name}RepositoryImpl`,
  ]).sort();
  const repoBinds = aggregates.map(a =>
    `    bind(classOf[${a.name}Repository]).to(classOf[${a.name}RepositoryImpl])`
  );
  return [
    `package ${pkg}.modules`,
    '',
    'import akka.actor.{ActorSystem, ExtendedActorSystem}',
    'import akka.actor.typed.scaladsl.adapter._',
    'import akka.cluster.sharding.typed.scaladsl.ClusterSharding',
    'import com.google.inject.{AbstractModule, Module, Provides}',
    ...repoImports,
    `import ${pkg}.infrastructure.bootstrap.ApplicationBootstrap`,
    'import javax.inject.Singleton',
    '',
    'final class BootstrapModule extends AbstractModule {',
    '  override def configure(): Unit = {',
    ...repoBinds,
    `    installOptionalModule(${q(pkg + '.modules.HandwrittenBindingsModule')})`,
    '    bind(classOf[ApplicationBootstrap]).asEagerSingleton()',
    '  }',
    '',
    '  private def installOptionalModule(className: String): Unit =',
    '    try {',
    '      val cls = Class.forName(className)',
    '      install(cls.getDeclaredConstructor().newInstance().asInstanceOf[Module])',
    '    } catch {',
    '      case _: ClassNotFoundException => ()',
    '    }',
    '',
    '  @Provides',
    '  @Singleton',
    '  def provideExtendedSystem(system: ActorSystem): ExtendedActorSystem =',
    '    system.asInstanceOf[ExtendedActorSystem]',
    '',
    '  @Provides',
    '  @Singleton',
    '  def provideClusterSharding(system: ActorSystem): ClusterSharding =',
    '    ClusterSharding(system.toTyped)',
    '}',
    '',
  ].join('\n');
}

function renderApplicationBootstrap(input) {
  const { package: pkg, serviceName: name, bootstrap } = input;
  const aggregates = input.aggregates ?? [];
  const readsideProjections = input.readsideProjections ?? [];
  const traits = [
    ...aggregates.map(a => `${a.name}Bootstrap`),
    ...readsideProjections.map(rp => `${rp.name}Bootstrap`),
  ];
  const extendsClause = traits.length ? ' extends ' + traits.join('\n  with ') : '';

  const aggImports = aggregates.flatMap(a => [
    `import ${pkg}.application.aggregates.${a.name}Aggregate`,
    ...(a.authority ? [`import ${pkg}.application.aggregates.${a.name}Protocol`] : []),
    `import ${pkg}.domain.services.${a.name}Computations`,
  ]);
  const projImports = readsideProjections.flatMap(rp => [
    `import ${pkg}.${rp.subpackage}.${rp.name}ProjectionHandler`,
    `import ${pkg}.${rp.subpackage}.repository.${rp.name}Repository`,
  ]);

  const injectedParams = [
    '  classicSystem: akka.actor.ActorSystem,',
    '  sharding: ClusterSharding,',
    ...aggregates.flatMap(a => [
      `  ${lowerFirst(a.name)}Computations: ${a.name}Computations,`,
      ...(a.authority ? [`  ${lowerFirst(a.name)}Authority: ${a.name}Protocol.ExternalAuthority,`] : []),
    ]),
    ...readsideProjections.flatMap(rp => [
      `  ${lowerFirst(rp.name)}Repository: ${rp.name}Repository,`,
      `  ${lowerFirst(rp.name)}Bindings: ${rp.name}ProjectionHandler.Bindings,`,
    ]),
  ];
  if (injectedParams.length) {
    injectedParams[injectedParams.length - 1] = injectedParams[injectedParams.length - 1].replace(/,$/, '');
  }

  const initCalls = [
    ...aggregates.map(a =>
      a.authority
        ? `  init${a.name}Aggregate(sharding, ${lowerFirst(a.name)}Computations, ${lowerFirst(a.name)}Authority)`
        : `  init${a.name}Aggregate(sharding, ${lowerFirst(a.name)}Computations)`
    ),
    ...readsideProjections.map(rp => {
      const tagsExpr = aggregates.length
        ? aggregates.map(a => `${a.name}Aggregate.tags`).join(' ++ ')
        : 'Vector.empty[String]';
      return [
        `  init${rp.name}Projection(`,
        '    system = system,',
        '    readJournalPluginId = classicSystem.settings.config.getString("akka.persistence.query.journal.id"),',
        `    tags = ${tagsExpr},`,
        `    repository = ${lowerFirst(rp.name)}Repository,`,
        `    bindings = ${lowerFirst(rp.name)}Bindings`,
        '  )',
      ].join('\n');
    }),
  ];

  return [
    `package ${pkg}.infrastructure.bootstrap`,
    '',
    'import akka.actor.typed.ActorSystem',
    'import akka.actor.typed.scaladsl.adapter._',
    'import akka.cluster.sharding.typed.scaladsl.ClusterSharding',
    ...aggImports,
    ...projImports,
    'import javax.inject.{Inject, Singleton}',
    'import play.api.{Application, ApplicationLoader}',
    'import scala.concurrent.ExecutionContext',
    'import scala.util.control.NonFatal',
    `import ${name}Contract._`,
    '',
    '/** Guice eager-singleton application bootstrap mounting all CQRS aggregates and projections. */',
    '@Singleton',
    'class ApplicationBootstrap @Inject()(',
    ...injectedParams,
    `)${extendsClause} {`,
    '  private implicit val system: ActorSystem[Nothing] = classicSystem.toTyped',
    '  private implicit val ec: ExecutionContext = system.executionContext',
    ...(initCalls.length ? ['', ...initCalls] : []),
    '}',
    '',
    'object ApplicationBootstrap {',
    '  def load(context: ApplicationLoader.Context): Application = {',
    `    ${name}Configuration.validate(context.initialConfiguration)`,
    `    val factory = context.environment.classLoader.loadClass(${q(bootstrap.id)}).getDeclaredConstructor().newInstance().asInstanceOf[Factory]`,
    `    require(factory.implementation == ${q(bootstrap.id)} && factory.version == ${q(bootstrap.version)}, "composition factory pin mismatch")`,
    '    val composition = factory.create(context)',
    '    try {',
    '      requireInstalled(composition)',
    `      new ${name}Components(context, composition).application`,
    '    } catch { case NonFatal(error) =>',
    '      context.lifecycle.stop()',
    '      composition.close()',
    '      throw error',
    '    }',
    '  }',
    '}',
    '',
  ].join('\n');
}

function renderClusterConf() {
  return [
    'akka {',
    '  actor {',
    '    provider = cluster',
    '  }',
    '',
    '  min-nr-of-member = 1',
    '',
    '  remote.artery {',
    '    canonical {',
    '      hostname = ${clustering.ip}',
    '      port = ${clustering.port}',
    '    }',
    '    bind {',
    '      hostname = ${clustering.ip}',
    '      port = ${clustering.port}',
    '    }',
    '  }',
    '',
    '  cluster {',
    '    seed-nodes = ["akka://"${clustering.cluster.name}"@"${clustering.seed-ip}":"${clustering.seed-port}]',
    '    downing-provider-class = "akka.cluster.sbr.SplitBrainResolverProvider"',
    '    shutdown-after-unsuccessful-join-seed-nodes = 120s',
    '',
    '    sharding {',
    '      remember-entities = on',
    '      remember-entities-store = eventsourced',
    '      number-of-shards = 10',
    '      least-shard-allocation-strategy.rebalance-absolute-limit = 20',
    '      passivation {',
    '        strategy = custom-lru-strategy',
    '        custom-lru-strategy {',
    '          active-entity-limit = 1000000',
    '          replacement.policy = least-recently-used',
    '        }',
    '      }',
    '    }',
    '  }',
    '}',
    '',
    'clustering {',
    '  ip = "127.0.0.1"',
    '  ip = ${?CLUSTER_IP}',
    '  port = 25561',
    '  port = ${?CLUSTER_PORT}',
    '  seed-ip = "127.0.0.1"',
    '  seed-ip = ${?SEED_IP}',
    '  seed-port = 25561',
    '  seed-port = ${?SEED_PORT}',
    '  cluster.name = application',
    '}',
    '',
  ].join('\n');
}

function renderPersistenceConf(input) {
  const { journalConnection } = input;
  return [
    'akka {',
    '  persistence {',
    '    journal.plugin = "akka-contrib-mongodb-persistence-journal"',
    '    snapshot-store.plugin = "akka-contrib-mongodb-persistence-snapshot"',
    '    query.journal.id = "akka-contrib-mongodb-persistence-readjournal"',
    '  }',
    '',
    '  contrib.persistence.mongodb.mongo {',
    `    mongouri = \${service.connections.${q(journalConnection)}}`,
    '  }',
    '}',
    '',
  ].join('\n');
}

function renderProjectionConf() {
  return [
    'akka {',
    '  projection {',
    '    jdbc {',
    '      blocking-jdbc-dispatcher.thread-pool-executor.fixed-pool-size = 8',
    '      dialect = mysql-dialect',
    '    }',
    '  }',
    '}',
    '',
    'jdbc-connection-settings {',
    '  driver = ${db.default.driver}',
    '  url = ${db.default.url}',
    '  user = ${db.default.username}',
    '  password = ${db.default.password}',
    '',
    '  connection-pool {',
    '    max-pool-size = 16',
    '    timeout = 5000ms',
    '    transactionIsolation = TRANSACTION_READ_COMMITTED',
    '  }',
    '}',
    '',
    'scalikejdbc.global {',
    '  loggingSQLAndTime.enabled = false',
    '  loggingSQLAndTime.singleLineMode = false',
    '  loggingSQLAndTime.logLevel = debug',
    '  loggingSQLAndTime.warningEnabled = true',
    '  loggingSQLAndTime.warningThresholdMillis = 5',
    '  loggingSQLAndTime.warningLogLevel = warn',
    '}',
    '',
  ].join('\n');
}

function renderServiceConf(input) {
  const { package: pkg, serviceName: name, journalConnection, readSideConnection } = input;
  return [
    'include "persistence.conf"',
    `play.application.loader = ${q(pkg + '.infrastructure.bootstrap.' + name + 'Loader')}`,
    'play.http.secret.key = ${PLAY_SECRET}',
    `service.connections.${q(journalConnection)} = \${MONGO_URI}`,
    `service.connections.${q(readSideConnection)} = \${MYSQL_JDBC_URL}`,
    'db.default.driver = "com.mysql.cj.jdbc.Driver"',
    `db.default.url = \${service.connections.${q(readSideConnection)}}`,
    'db.default.username = ${MYSQL_USER}',
    'db.default.password = ${MYSQL_PASSWORD}',
    '',
  ].join('\n');
}

function renderApplicationConf(input) {
  const { package: pkg } = input;
  return [
    'include "cluster.conf"',
    'include "persistence.conf"',
    'include "projection.conf"',
    'include "serialization.conf"',
    'include "service.conf"',
    '',
    `play.modules.enabled += ${q(pkg + '.modules.BootstrapModule')}`,
    'play.modules.enabled += "scalikejdbc.PlayModule"',
    'play.modules.disabled += "play.api.db.DBModule"',
    '',
  ].join('\n');
}

export function renderServiceRuntimeFiles(input) {
  checkInput(input);
  const pkg = input.package;
  const name = input.serviceName;
  const src = [{ document: input.artifactSource.document, pointer: input.artifactSource.pointer }];
  const servicePath = scalaSubpackagePath(pkg, 'infrastructure.bootstrap', name + 'Contract.scala');
  const loaderPath = scalaSubpackagePath(pkg, 'infrastructure.bootstrap', name + 'Loader.scala');
  const configPath = scalaSubpackagePath(pkg, 'infrastructure.bootstrap', name + 'Configuration.scala');
  const bootstrapPath = scalaSubpackagePath(pkg, 'infrastructure.bootstrap', 'ApplicationBootstrap.scala');
  const modulePath = scalaSubpackagePath(pkg, 'modules', 'BootstrapModule.scala');
  const aggDeps = (input.aggregates ?? []).flatMap(a => [
    scalaSubpackagePath(pkg, 'infrastructure.bootstrap', `${a.name}Bootstrap.scala`),
    scalaSubpackagePath(pkg, 'application.aggregates', `${a.name}Aggregate.scala`),
    ...(a.authority ? [scalaSubpackagePath(pkg, 'application.aggregates', `${a.name}Protocol.scala`)] : []),
    scalaSubpackagePath(pkg, 'domain.services', `${a.name}Computations.scala`),
  ]);
  const projDeps = (input.readsideProjections ?? []).flatMap(rp => [
    scalaSubpackagePath(pkg, 'infrastructure.bootstrap', `${rp.name}Bootstrap.scala`),
    scalaSubpackagePath(pkg, rp.subpackage, `${rp.name}ProjectionHandler.scala`),
    scalaSubpackagePath(pkg, `${rp.subpackage}.repository`, `${rp.name}Repository.scala`),
  ]);

  const repoDeps = (input.aggregates ?? []).flatMap(a => [
    scalaSubpackagePath(pkg, 'application.aggregates.repository', `${a.name}Repository.scala`),
    scalaSubpackagePath(pkg, 'infrastructure.repositories.aggregate', `${a.name}RepositoryImpl.scala`),
  ]);

  return [
    { path: servicePath, content: renderServiceContract(input), kind: 'service-port', deps: [], sources: src, codeMappings: [] },
    { path: loaderPath, content: renderServiceLoader(input), kind: 'service-runtime', deps: [bootstrapPath], sources: src, codeMappings: [] },
    { path: bootstrapPath, content: renderApplicationBootstrap(input), kind: 'service-runtime', deps: [servicePath, loaderPath, configPath, ...aggDeps, ...projDeps], sources: src, codeMappings: [] },
    { path: modulePath, content: renderBootstrapModule(input), kind: 'service-runtime', deps: [bootstrapPath, ...repoDeps], sources: src, codeMappings: [] },
    { path: configPath, content: input.configurationScala, kind: 'service-runtime', deps: [], sources: src, codeMappings: [] },
    { path: 'conf/cluster.conf', content: renderClusterConf(), kind: 'service-config', deps: [], sources: src, codeMappings: [] },
    { path: 'conf/persistence.conf', content: renderPersistenceConf(input), kind: 'service-config', deps: [], sources: src, codeMappings: [] },
    { path: 'conf/projection.conf', content: renderProjectionConf(), kind: 'service-config', deps: [], sources: src, codeMappings: [] },
    { path: 'conf/service.conf', content: renderServiceConf(input), kind: 'service-config', deps: ['conf/persistence.conf'], sources: src, codeMappings: [] },
    { path: 'conf/application.conf', content: renderApplicationConf(input), kind: 'service-config', deps: ['conf/cluster.conf', 'conf/persistence.conf', 'conf/projection.conf', 'conf/serialization.conf', 'conf/service.conf'], sources: src, codeMappings: [] },
    ...input.readsideFiles.map(rf => ({
      path: rf.path,
      content: rf.content,
      kind: rf.kind,
      deps: [...rf.deps],
      sources: rf.sources.map(s => ({ document: s.document, pointer: s.pointer })),
      codeMappings: rf.codeMappings.map(m => ({ ...m })),
    })),
  ];
}

export function renderAll(input) {
  return Object.fromEntries(renderServiceRuntimeFiles(input).map(f => [f.path, f.content]));
}

export function runNegatives(baseInput) {
  const clone = () => JSON.parse(JSON.stringify(baseInput));
  const cases = [
    ['non-object input', () => null],
    ['wrong schemaVersion', () => { const x = clone(); x.schemaVersion = 'wrong/v1'; return x; }],
    ['unexpected top-level key', () => { const x = clone(); x.extra = true; return x; }],
    ['invalid package', () => { const x = clone(); x.package = 'Bad.Pkg'; return x; }],
    ['invalid serviceName', () => { const x = clone(); x.serviceName = 'badName'; return x; }],
    ['empty bootstrap.id', () => { const x = clone(); x.bootstrap.id = ''; return x; }],
    ['empty journalConnection', () => { const x = clone(); x.journalConnection = ''; return x; }],
    ['empty readSideConnection', () => { const x = clone(); x.readSideConnection = ''; return x; }],
    ['empty endpoints', () => { const x = clone(); x.endpoints = []; return x; }],
    ['duplicate endpoint id', () => { const x = clone(); x.endpoints.push(clone().endpoints[0]); return x; }],
    ['non-boolean csrf', () => { const x = clone(); x.endpoints[0].csrf = 'yes'; return x; }],
    ['bad endpoint path', () => { const x = clone(); x.endpoints[0].path = 'no-slash'; return x; }],
    ['empty configurationScala', () => { const x = clone(); x.configurationScala = ''; return x; }],
    ['malformed artifactSource', () => { const x = clone(); x.artifactSource.pointer = 'bad'; return x; }],
    ['unknown page alias endpoint', () => { const x = clone(); if (x.pages) x.pages.aliases[0].endpointId = 'missing'; else x.pages = { rendererId: 'a', rendererVersion: '1', shellPath: '/ui', scriptPath: '/ui/app.js', aliases: [{ endpointId: 'missing', path: '/x' }] }; return x; }],
    ['bad page shellPath', () => { const x = clone(); if (x.pages) x.pages.shellPath = 'no-slash'; else x.pages = { rendererId: 'a', rendererVersion: '1', shellPath: 'no-slash', scriptPath: '/ui/app.js', aliases: [] }; return x; }],
    ['duplicate page shellPath and scriptPath', () => { const x = clone(); if (x.pages) x.pages.scriptPath = x.pages.shellPath; else x.pages = { rendererId: 'a', rendererVersion: '1', shellPath: '/ui', scriptPath: '/ui', aliases: [] }; return x; }],
    ['duplicate readside path', () => { const x = clone(); if (x.readsideFiles.length) x.readsideFiles.push(clone().readsideFiles[0]); else x.readsideFiles = [{ path: 'a', kind: 'bad', content: 'x', deps: [], sources: [], codeMappings: [] }]; return x; }],
  ];
  let rejected = 0;
  const failures = [];
  for (const [label, build] of cases) {
    try {
      checkInput(build());
      failures.push(label + ': unexpectedly accepted');
    } catch (err) {
      if (!String(err.message || '').startsWith('SR_INPUT:')) {
        failures.push(label + ': wrong error prefix (' + err.message + ')');
      } else {
        rejected++;
      }
    }
  }
  return { expected: cases.length, rejected, failures };
}

export const family = Object.freeze({
  id: 'service-runtime',
  familyNumber: 38,
  inputSchema: SCHEMA,
  provenance: 'handwritten-golden',
  toolsRef: null,
  goldenRoot: 'test/reference/curated/service-runtime/v1',
  fixtureDir: 'test/fixtures/service-runtime-v1',
  checkInput,
  renderAll,
  runNegatives,
});
