package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.model.products.ProductServiceModel
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.products.ServicePages

object ProductServicePagesTemplate {
  private def q(value: String): String = ujson.write(value)
  def contract: String = """  trait PageRenderer {
    def implementation: String
    def version: String
    def shell: String
    def script: String
    def render(endpointId: String, status: Int, value: JsValue): String
  }
"""
  def requirement(pages: ServicePages): String = s"""    val installedPages = value.pages
    require(installedPages != null && installedPages.exists(p => p != null && p.implementation == ${q(pages.renderer.id)} && p.version == ${q(pages.renderer.version)}), "page renderer pin mismatch")
"""
  def loader(m: ProductServiceModel): String = {
    val pkg = m.application.domain.packages(m.artifact.artifact.context)
    val name = NamingConventions.productSymbol(m.artifact.artifact.id)
    val pages = m.deployment.pages.get
    def pattern(path: String): String = "^/" + path.split("/").drop(1).map(p => if (p.startsWith(":")) "([^/]+)" else p).mkString("/") + "$"
    val rows = m.endpoints.map { row =>
      val e = row.endpoint
      val parameters = e.path.split("/").filter(_.startsWith(":")).map(p => q(p.drop(1))).mkString(", ")
      "    Route(" + q(e.method) + ", " + q(pattern(e.path)) + ".r, Vector(" + parameters + "), " + q(e.audience) + ", " + e.csrf + ", " + q(e.id) + ", false, (principal: Principal, input: JsValue) => invoke(composition.bindings." + NamingConventions.productSymbol(e.port.ref.id) + ", principal, input))"
    }.mkString(",\n")
    val aliases = pages.aliases.map(a => "    apiActions(" + m.endpoints.indexWhere(_.endpoint.id == a.endpointId) + ").copy(pattern = " + q(pattern(a.path)) + ".r, page = true)").mkString(",\n")
    val csp = "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
    val unavailable = "<!doctype html><html><head><meta charset=\"utf-8\"><title>Service unavailable</title></head><body><p>Service unavailable</p></body></html>"
    s"""package $pkg.service

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
    val factory = context.environment.classLoader.loadClass(${q(m.bootstrap.id)}).getDeclaredConstructor().newInstance().asInstanceOf[Factory]
    require(factory.implementation == ${q(m.bootstrap.id)} && factory.version == ${q(m.bootstrap.version)}, "composition factory pin mismatch")
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
  private val pageRenderer: PageRenderer = {
    requireInstalled(composition)
    composition.pages.get
  }
  private final case class Response(status: Int, value: JsValue)
  private final case class Route(method: String, pattern: scala.util.matching.Regex, parameters: Vector[String],
    audience: String, csrf: Boolean, endpointId: String, page: Boolean, run: (Principal, JsValue) => Future[Response])
  private val staticHeaders = Vector("Cache-Control" -> "no-store", "X-Content-Type-Options" -> "nosniff", "Referrer-Policy" -> "no-referrer")
  private val htmlHeaders = staticHeaders :+ ("Content-Security-Policy" -> ${q(csp)})
  private def unavailableHtml: Result = Results.ServiceUnavailable(${q(unavailable)}).as("text/html; charset=utf-8").withHeaders(htmlHeaders: _*)
  private def failure(error: Failure): Response = Response(error.status, Json.obj("code" -> error.code))
  private def response(row: Route, value: Response): Result = {
    if (!row.page) Results.Status(value.status)(value.value)
    else try {
      Results.Status(value.status)(pageRenderer.render(row.endpointId, value.status, value.value)).as("text/html; charset=utf-8").withHeaders(htmlHeaders: _*)
    } catch { case NonFatal(_) => unavailableHtml }
  }
  private def staticPage(script: Boolean): Result = {
    try {
      if (script) Results.Ok(pageRenderer.script).as("application/javascript; charset=utf-8").withHeaders(staticHeaders: _*)
      else Results.Ok(pageRenderer.shell).as("text/html; charset=utf-8").withHeaders(htmlHeaders: _*)
    } catch { case NonFatal(_) =>
      if (script) Results.ServiceUnavailable("").as("application/javascript; charset=utf-8").withHeaders(staticHeaders: _*)
      else unavailableHtml
    }
  }
  private def invoke[I, O](endpoint: Endpoint[I, O], principal: Principal, input: JsValue): Future[Response] = {
    endpoint.reads.reads(input) match {
      case JsSuccess(value, _) => endpoint.run(principal, value).map {
        case Right(result) => Response(200, endpoint.writes.writes(result))
        case Left(error) => failure(error)
      }
      case _: JsError => Future.successful(failure(InvalidRequest))
    }
  }
  private val apiActions = Vector(
$rows
  )
  private val pageActions = Vector(
$aliases
  )
  private val actions = apiActions ++ pageActions
  private def action(row: Route, matched: scala.util.matching.Regex.Match): Handler = {
    val parser: BodyParser[String] = if (!row.page) controllerComponents.parsers.tolerantText(65536)
      else BodyParser("service-page-text") { request =>
        controllerComponents.parsers.tolerantText(65536)(request).map { parsed =>
          parsed.left.map(result => response(row, Response(result.header.status, Json.obj("code" -> "invalid-request"))))
        }
      }
    controllerComponents.actionBuilder.async(parser) { request =>
      Future.successful(()).flatMap(_ => composition.ready).flatMap { _ =>
        composition.authority.authenticate(request).flatMap {
          case Some((id, roles)) if id != null && id.nonEmpty && roles != null && roles.contains(row.audience) =>
            val allowed = if (row.csrf) composition.authority.csrf(request) else Future.successful(true)
            allowed.flatMap { ok =>
              if (!ok) Future.successful(Response(403, Json.obj("code" -> "csrf-denied")))
              else {
                val params = JsObject(row.parameters.zipWithIndex.map { case (name, i) => name -> JsString(matched.group(i + 1)) })
                val body = if (row.method == "GET") Right(JsNull) else decodeBody(request.body)
                body match {
                  case Left(error) => Future.successful(failure(error))
                  case Right(value) =>
                    val input = Json.obj("path" -> params, "query" -> JsObject(request.queryString.toVector.map { case (k, v) => k -> JsArray(v.map(JsString)) }), "body" -> value)
                    row.run(Principal(id, roles), input)
                }
              }
            }
          case None => Future.successful(failure(NotAuthenticated))
          case _ => Future.successful(failure(NotAuthorized))
        }
      }.recover { case NonFatal(_) => failure(Unavailable) }.map(value => response(row, value))
    }
  }
  override lazy val router: Router = Router.from {
    case request if request.method == "GET" && request.path == ${q(pages.shellPath)} =>
      controllerComponents.actionBuilder(controllerComponents.parsers.empty) { _ => staticPage(false) }
    case request if request.method == "GET" && request.path == ${q(pages.scriptPath)} =>
      controllerComponents.actionBuilder(controllerComponents.parsers.empty) { _ => staticPage(true) }
    case request if actions.exists(row => row.method == request.method && row.pattern.findFirstMatchIn(request.path).nonEmpty) =>
      val row = actions.find(row => row.method == request.method && row.pattern.findFirstMatchIn(request.path).nonEmpty).get
      action(row, row.pattern.findFirstMatchIn(request.path).get)
  }
}
"""
  }
}
