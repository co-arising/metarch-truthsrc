import { entry, key, packageFor, pathFor, symbol, typeName } from '../scala-cqrs-domain/naming.mjs';
import { fail } from '../../lib/products/request.mjs';
import { pageRendererContract, pageRendererRequirement, renderPageLoader } from './render-service-pages.mjs';

export function serviceSelection(products, options) {
  const mapping = options.service;
  if (!mapping || Object.keys(mapping).sort().join(',') !== 'artifact,externalSourceRoots' ||
      typeof mapping.artifact !== 'string' || !Array.isArray(mapping.externalSourceRoots) ||
      mapping.externalSourceRoots.some(p => typeof p !== 'string' || !p.startsWith('/') || p.includes('\\') || p.includes('\0') || p.split('/').some(x => x === '.' || x === '..')) ||
      new Set(mapping.externalSourceRoots).size !== mapping.externalSourceRoots.length)
    fail('SERVICE_OPTIONS', 'explicit service artifact and canonical external source roots required');
  const rows = products['artifact-contract'].artifacts.filter(a => a.id === mapping.artifact && a.status === 'selected' && a.deployment.service);
  if (rows.length !== 1 || products['artifact-contract'].artifacts.filter(a => a.deployment.service).length !== 1)
    fail('SERVICE_OPTIONS', 'one selected complete service deployment required');
  if (!/^[A-Za-z][A-Za-z0-9_]{0,99}$/u.test(rows[0].artifact.id) || symbol(rows[0].artifact.id).includes('`'))
    fail('SERVICE_OPTIONS', 'bounded non-keyword service class stem required');
  return rows[0];
}

export function renderService({ products, options }, footprint) {
  const artifact = serviceSelection(products, options), service = artifact.deployment.service;
  const hasPages = Object.hasOwn(service, 'pages');
  const pkg = packageFor(artifact.artifact.context, options), name = symbol(artifact.artifact.id);
  const q = JSON.stringify;
  const bootstrap = artifact.implementations.find(i => key(i.port) === key(service.bootstrap.ref));
  if (!bootstrap || !/^[a-z][a-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/u.test(bootstrap.id))
    fail('SERVICE_BOOTSTRAP', 'bootstrap implementation must name an explicit qualified composition factory');
  const endpoints = service.endpoints.map(e => ({ ...e, name: symbol(e.port.ref.id),
    implementation: artifact.implementations.find(i => key(i.port) === key(e.port.ref)) }));
  if (new Set(endpoints.map(e => e.port.ref.id)).size !== endpoints.length) fail('SERVICE_PORT', 'one HTTP endpoint per explicit port required');
  const contract = `package ${pkg}.service

import play.api.ApplicationLoader
import play.api.libs.json.{JsValue, Reads, Writes}
import play.api.mvc.{RequestHeader, Result}
import scala.concurrent.Future

object ${name}Service {
  final case class Principal private[service] (id: String, roles: Set[String])
  trait Authority {
    def authenticate(request: RequestHeader): Future[Option[(String, Set[String])]]
    def csrf(request: RequestHeader): Future[Boolean]
  }
  sealed trait Failure { def status: Int; def code: String }
  case object InvalidRequest extends Failure { val status = 400; val code = "invalid-request" }
  case object NotAuthenticated extends Failure { val status = 401; val code = "not-authenticated" }
  case object NotAuthorized extends Failure { val status = 403; val code = "not-authorized" }
  case object MissingResource extends Failure { val status = 404; val code = "not-found" }
  case object RequestConflict extends Failure { val status = 409; val code = "request-conflict" }
  case object Unavailable extends Failure { val status = 503; val code = "service-unavailable" }
  type Outcome[A] = Either[Failure, A]
  def decodeBody(text: String): Outcome[JsValue] = {
    val factory = new com.fasterxml.jackson.core.JsonFactory()
    factory.enable(com.fasterxml.jackson.core.JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
    try {
      val parser = factory.createParser(text)
      try {
        var depth = 0
        var roots = 0
        var token = parser.nextToken()
        while (token != null) {
          if (depth == 0) roots += 1
          if (token.isStructStart) depth += 1
          if (token.isStructEnd) depth -= 1
          require(depth >= 0 && depth <= 64 && roots == 1, "bounded single JSON value required")
          token = parser.nextToken()
        }
        require(depth == 0 && roots == 1, "complete JSON required")
        Right(play.api.libs.json.Json.parse(text))
      } finally parser.close()
    } catch { case scala.util.control.NonFatal(_) => Left(InvalidRequest) }
  }
  final case class Endpoint[I, O](implementation: String, version: String, reads: Reads[I], writes: Writes[O],
    run: (Principal, I) => Future[Outcome[O]])
  final case class Bindings(
${endpoints.map(e => `    ${e.name}: Endpoint[${typeName(e.inputType, options)}, ${typeName(e.outputType, options)}]`).join(',\n')}
  )
${hasPages ? pageRendererContract() : ''}  trait Composition extends AutoCloseable {
    def authority: Authority
    def bindings: Bindings
    def ready: Future[Unit]
${hasPages ? '    def pages: Option[PageRenderer] = None\n' : ''}  }
  trait Factory {
    def implementation: String
    def version: String
    def create(context: ApplicationLoader.Context): Composition
  }
  def requireInstalled(value: Composition): Unit = {
    require(value != null && value.authority != null && value.bindings != null, "complete service composition required")
${endpoints.map(e => `    require(value.bindings.${e.name} != null && value.bindings.${e.name}.implementation == ${q(e.implementation.id)} && value.bindings.${e.name}.version == ${q(e.implementation.version)} && value.bindings.${e.name}.reads != null && value.bindings.${e.name}.writes != null && value.bindings.${e.name}.run != null, ${q('missing service endpoint ' + e.id)})`).join('\n')}
${hasPages ? pageRendererRequirement(service.pages) : ''}  }
}
`;
  const routeRows = endpoints.map(e => {
    const parts = e.path.split('/').slice(1);
    const regex = '^/' + parts.map(x => x.startsWith(':') ? '([^/]+)' : x).join('/') + '$';
    const parameters = parts.filter(x => x.startsWith(':')).map(x => x.slice(1));
    return `    (${q(e.method)}, ${q(regex)}.r, Vector(${parameters.map(q).join(', ')}), ${q(e.audience)}, ${e.csrf}, (principal: Principal, input: JsValue) => invoke(composition.bindings.${e.name}, principal, input))`;
  });
  const loader = hasPages ? renderPageLoader({ pkg, name, bootstrap, endpoints, pages: service.pages }) : `package ${pkg}.service

import play.api.{Application, ApplicationLoader, BuiltInComponentsFromContext}
import play.api.libs.json._
import play.api.mvc._
import play.api.routing.Router
import scala.concurrent.{ExecutionContext, Future}
import scala.util.control.NonFatal
import ${name}Service._

final class ${name}Loader extends ApplicationLoader {
  def load(context: ApplicationLoader.Context): Application = {
    ${name}Configuration.validate(context.initialConfiguration)
    val factory = context.environment.classLoader.loadClass(${q(bootstrap.id)}).getDeclaredConstructor().newInstance().asInstanceOf[Factory]
    require(factory.implementation == ${q(bootstrap.id)} && factory.version == ${q(bootstrap.version)}, "composition factory pin mismatch")
    val composition = factory.create(context)
    try {
      requireInstalled(composition)
      new ${name}Components(context, composition).application
    } catch { case NonFatal(error) =>
      context.lifecycle.stop()
      composition.close()
      throw error
    }
  }
}
final class ${name}Components(context: ApplicationLoader.Context, composition: Composition)
  extends BuiltInComponentsFromContext(context) {
  implicit private val ec: ExecutionContext = executionContext
  override lazy val httpFilters = Seq.empty[EssentialFilter]
  applicationLifecycle.addStopHook(() => Future(composition.close()))
  private def invoke[I, O](endpoint: Endpoint[I, O], principal: Principal, input: JsValue): Future[Result] = {
    endpoint.reads.reads(input) match {
      case JsSuccess(value, _) => endpoint.run(principal, value).map {
        case Right(result) => Results.Ok(endpoint.writes.writes(result))
        case Left(error) => Results.Status(error.status)(Json.obj("code" -> error.code))
      }
      case _: JsError => Future.successful(Results.BadRequest(Json.obj("code" -> "invalid-request")))
    }
  }
  private val actions = Vector(
${routeRows.join(',\n')}
  )
  private def action(row: (String, scala.util.matching.Regex, Vector[String], String, Boolean, (Principal, JsValue) => Future[Result]), matched: scala.util.matching.Regex.Match): Handler = {
    controllerComponents.actionBuilder.async(controllerComponents.parsers.tolerantText(65536)) { request =>
      composition.ready.flatMap { _ =>
        composition.authority.authenticate(request).flatMap {
          case Some((id, roles)) if id != null && id.nonEmpty && roles != null && roles.contains(row._4) =>
            val allowed = if (row._5) composition.authority.csrf(request) else Future.successful(true)
            allowed.flatMap { ok =>
              if (!ok) Future.successful(Results.Forbidden(Json.obj("code" -> "csrf-denied")))
              else {
                val params = JsObject(row._3.zipWithIndex.map { case (name, i) => name -> JsString(matched.group(i + 1)) })
                val body = if (row._1 == "GET") Right(JsNull) else decodeBody(request.body)
                body match {
                  case Left(error) => Future.successful(Results.Status(error.status)(Json.obj("code" -> error.code)))
                  case Right(value) =>
                    val input = Json.obj("path" -> params, "query" -> JsObject(request.queryString.toVector.map { case (k, v) => k -> JsArray(v.map(JsString)) }), "body" -> value)
                    row._6(Principal(id, roles), input)
                }
              }
            }
          case None => Future.successful(Results.Unauthorized(Json.obj("code" -> "not-authenticated")))
          case _ => Future.successful(Results.Forbidden(Json.obj("code" -> "not-authorized")))
        }
      }.recover { case NonFatal(_) => Results.ServiceUnavailable(Json.obj("code" -> "service-unavailable")) }
    }
  }
  override lazy val router: Router = Router.from {
    case request if actions.exists(row => row._1 == request.method && row._2.findFirstMatchIn(request.path).nonEmpty) =>
      val row = actions.find(row => row._1 == request.method && row._2.findFirstMatchIn(request.path).nonEmpty).get
      action(row, row._2.findFirstMatchIn(request.path).get)
  }
}
`;
  const config = 'play.application.loader = ' + q(pkg + '.service.' + artifact.artifact.id + 'Loader') + '\n' +
    'play.http.secret.key = ${PLAY_SECRET}\n' +
    'service.connections.' + q(service.journal.connectionRef) + ' = ${MONGO_URI}\n' +
    'service.connections.' + q(service.readSide.connectionRef) + ' = ${MYSQL_JDBC_URL}\n' +
    'akka.persistence.journal.plugin = "akka-contrib-mongodb-persistence-journal"\n' +
    'akka.persistence.snapshot-store.plugin = "akka-contrib-mongodb-persistence-snapshot"\n' +
    'akka.contrib.persistence.mongodb.mongo.mongouri = ${service.connections.' + q(service.journal.connectionRef) + '}\n' +
    'db.default.driver = "com.mysql.cj.jdbc.Driver"\n' +
    'db.default.url = ${service.connections.' + q(service.readSide.connectionRef) + '}\n' +
    'db.default.username = ${MYSQL_USER}\ndb.default.password = ${MYSQL_PASSWORD}\n';
  return [entry(pathFor(pkg, 'service/' + artifact.artifact.id + 'Service.scala'), contract, 'service-port', [artifact.source], footprint),
    entry(pathFor(pkg, 'service/' + artifact.artifact.id + 'Loader.scala'), loader, 'service-runtime', [artifact.source], footprint),
    { ...entry('conf/service.conf', config, 'service-config', [artifact.source], footprint), content: config },
    { ...entry('conf/application.conf', 'include "serialization.conf"\ninclude "service.conf"\n', 'service-config', [artifact.source], footprint), content: 'include "serialization.conf"\ninclude "service.conf"\n' }];
}
