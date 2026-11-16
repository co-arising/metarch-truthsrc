import { q, scalarType, unwrap } from './syntax.mjs';

export function errorsTemplate(m, out) {
  out.append(`package ${m.names.errors.package}

import play.api.http.HttpErrorHandler
import play.api.libs.json.Json
import play.api.mvc._
import scala.concurrent.Future

final class ${m.names.errors.identifier} extends HttpErrorHandler {
  def onClientError(request: RequestHeader, statusCode: Int, message: String): Future[Result] = {
    val code = statusCode match { case 413 => "payload-too-large"; case 404 => "not-found"; case _ => "invalid-request" }
    Future.successful(Results.Status(statusCode)(Json.obj("code" -> code)))
  }
  def onServerError(request: RequestHeader, exception: Throwable): Future[Result] =
    Future.successful(Results.InternalServerError(Json.obj("code" -> "internal-error")))
}
`, [m.api.source]);
}
export function controllerTemplate(m, out) {
  const n = m.names, codec = n.codec.fqn;
  out.append(`package ${n.controller.package}

import ${n.api.fqn}._
import ${n.authority.package}.AuthorityUnavailable
import play.api.libs.json._
import play.api.mvc._
import akka.util.ByteString
import java.nio.charset.{CodingErrorAction, StandardCharsets}
import scala.concurrent.{ExecutionContext, Future}
import scala.util.control.NonFatal

final class ${n.controller.identifier}(cc: ControllerComponents, application: ${n.application.fqn})(implicit ec: ExecutionContext)
    extends AbstractController(cc) {
  private def error(value: Failure): Result = Status(${codec}.status(value))(Json.obj("code" -> value.code))
  private def secured(resourceId: String, write: Boolean)(operation: (${scalarType(m.resource)}, Request[ByteString]) => Future[Outcome[Result]]): Action[ByteString] =
    Action.async(parse.byteString(${m.composition.limits.bodyBytes})) { request =>
      application.admit {
        application.authority.authenticate(request).flatMap {
          case None => Future.successful(Left(NotAuthenticated))
          case Some(principal) if !(principal.roles.contains("operator") || !write && principal.roles.contains("reader")) ||
              !principal.resources.contains(resourceId) => Future.successful(Left(NotAuthorized))
          case Some(principal) =>
            val check = if (write) application.authority.csrf(request, principal) else Future.successful(true)
            check.flatMap { allowed =>
              if (!allowed) Future.successful(Left(CsrfDenied))
              else ${codec}.resource(resourceId) match {
                case Left(failure) => Future.successful(Left(failure))
                case Right(id) if application.directory.find(resourceId).isEmpty => Future.successful(Left(MissingResource))
                case Right(id) => operation(id, request)
              }
            }
        }
      }.map(_.fold(error, identity)).recover {
        case _: AuthorityUnavailable => error(Unavailable)
        case NonFatal(_) => error(InternalFailure)
      }.map(_.withHeaders("Cache-Control" -> "no-store", "X-Content-Type-Options" -> "nosniff", "Content-Security-Policy" -> "default-src 'none'; frame-ancestors 'none'"))
    }
  private def body[A](request: Request[ByteString])(decode: JsObject => Outcome[A])(run: A => Future[Outcome[Result]]): Future[Outcome[Result]] = {
    if (request.contentType != Some("application/json") || request.charset.exists(c => !c.equalsIgnoreCase("UTF-8")))
      return Future.successful(Right(UnsupportedMediaType(Json.obj("code" -> "unsupported-media-type"))))
    if (request.queryString.nonEmpty) return Future.successful(Left(InvalidRequest))
    val value = try {
      val text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(request.body.asByteBuffer).toString
      ${codec}.decodeBody(text).flatMap(decode)
    } catch { case NonFatal(_) => Left(InvalidRequest) }
    value match { case Left(failure) => Future.successful(Left(failure)); case Right(v) => run(v) }
  }
`, [m.api.source, m.composition.source]);
  for (const c of m.commands) out.append(`  def ${c.method.identifier}(resourceValue: String): Action[ByteString] = this.secured(resourceValue, write = true) { (id, request) =>
    body(request)(${codec}.${c.method.identifier}(id, _))(value => application.commands.${c.method.identifier}(value).map(_.map(result => Ok(${codec}.${c.method.name}Result(result)))))
  }
`, [c.source]);
  const parameter = m.query.resourceParameter;
  out.append(`  private def receipts(id: ${scalarType(m.resource)}, request: Request[ByteString])(render: ReceiptPage => Result): Future[Outcome[Result]] = {
    if (request.body.nonEmpty) return Future.successful(Left(InvalidRequest))
    ${codec}.query(${unwrap(m.resource, 'id')}, request.queryString) match {
      case Left(failure) => Future.successful(Left(failure))
      case Right((after, limit)) => application.queries.receipts(id, after, limit).map(_.map(render))
    }
  }
  def query(resourceValue: String): Action[ByteString] = this.secured(resourceValue, write = false) { (id, request) =>
    receipts(id, request)(page => Ok(${codec}.page(${unwrap(m.resource, 'id')}, page)))
  }
  def page(resourceValue: String): Action[ByteString] = this.secured(resourceValue, write = false) { (id, request) =>
    receipts(id, request) { page =>
      val limit = request.getQueryString("limit").getOrElse(${q(String(m.query.pageSize))})
      val resourceText = ${unwrap(m.resource, 'id')}
      val path = ${q(m.api.page.path)}.replace(${q(':' + parameter)}, java.net.URLEncoder.encode(resourceText, "UTF-8").replace("+", "%20"))
      val next = page.next.map(c => path + "?after=" + ${codec}.cursor(resourceText, c) + "&limit=" + limit)
      Ok(views.html.${m.view.name}(resourceText, page, next))
    }
  }
  def readiness: Action[AnyContent] = Action {
    if (application.accepting) Ok(Json.obj("status" -> "ready")) else ServiceUnavailable(Json.obj("status" -> "unavailable"))
  }
}
`, [m.query.source, m.api.page.source]);
}
export function routesTemplate(m, out) {
  for (const c of m.commands) out.append(`POST ${c.path.replace(':' + c.resource.field, ':resourceValue')} ${m.names.controller.fqn}.${c.method.identifier}(resourceValue: String)
`, [c.source]);
  const parameter = m.query.resourceParameter;
  out.append(`GET ${m.query.path.replace(':' + parameter, ':resourceValue')} ${m.names.controller.fqn}.query(resourceValue: String)
`, [m.query.source]);
  out.append(`GET ${m.api.page.path.replace(':' + parameter, ':resourceValue')} ${m.names.controller.fqn}.page(resourceValue: String)
`, [m.api.page.source]);
  out.append(`GET ${m.api.readinessPath} ${m.names.controller.fqn}.readiness
`, [m.api.source]);
}
const html = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll('@', '@@');
export function viewTemplate(m, out) {
  out.append(`@(resourceId: String, page: ${m.names.api.fqn}.ReceiptPage, next: Option[String])
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${html(m.api.page.title)}</title></head>
<body>
<h1>${html(m.api.page.title)} for @resourceId</h1>
<table><thead><tr><th>${html(m.query.output.key)}</th><th>${html(m.query.output.value)}</th></tr></thead><tbody>
@for(row <- page.rows) {
<tr><td>@${unwrap(m.query.keyCarrier, 'row.' + m.query.key.identifier)}</td><td>@${unwrap(m.query.valueCarrier, 'row.' + m.query.value.identifier)}</td></tr>
}
</tbody></table>
@if(page.rows.isEmpty) { <p>No receipts yet.</p> }
@for(link <- next) { <a rel="next" href="@link">Next page</a> }
</body>
</html>
`, [m.api.page.source, m.query.source]);
}
