package example.inventory.controllers

import example.inventory.application.api.WarehouseApi._
import example.inventory.composition.WarehouseApplication
import example.inventory.domain.values.WarehouseId
import example.inventory.infrastructure.web._
import play.api.http.HttpErrorHandler
import play.api.libs.json._
import play.api.mvc._
import akka.util.ByteString
import java.nio.charset.{CodingErrorAction, StandardCharsets}
import scala.concurrent.{ExecutionContext, Future}
import scala.util.control.NonFatal

final class WarehouseHttpErrors extends HttpErrorHandler {
  def onClientError(request: RequestHeader, statusCode: Int, message: String): Future[Result] = {
    val code = statusCode match { case 413 => "payload-too-large"; case 404 => "not-found"; case _ => "invalid-request" }
    Future.successful(Results.Status(statusCode)(Json.obj("code" -> code)))
  }
  def onServerError(request: RequestHeader, exception: Throwable): Future[Result] =
    Future.successful(Results.InternalServerError(Json.obj("code" -> "internal-error")))
}
final class WarehouseController(cc: ControllerComponents, application: WarehouseApplication)(implicit ec: ExecutionContext)
    extends AbstractController(cc) {
  private def error(value: Failure): Result = Status(WarehouseHttpCodec.status(value))(Json.obj("code" -> value.code))
  private def secured(warehouseId: String, write: Boolean)(operation: (WarehouseId, Request[ByteString]) => Future[Outcome[Result]]): Action[ByteString] =
    Action.async(parse.byteString(65536)) { request =>
      application.admit {
        application.authority.authenticate(request).flatMap {
          case None => Future.successful(Left(NotAuthenticated))
          case Some(principal) if !(principal.roles.contains("operator") || !write && principal.roles.contains("reader")) ||
              !principal.resources.contains(warehouseId) => Future.successful(Left(NotAuthorized))
          case Some(principal) =>
            val check = if (write) application.authority.csrf(request, principal) else Future.successful(true)
            check.flatMap { allowed =>
              if (!allowed) Future.successful(Left(CsrfDenied))
              else WarehouseHttpCodec.warehouse(warehouseId) match {
                case Left(failure) => Future.successful(Left(failure))
                case Right(id) if application.directory.find(id.value).isEmpty => Future.successful(Left(MissingResource))
                case Right(id) => operation(id, request)
              }
            }
        }
      }.map(_.fold(error, identity)).recover {
        case _: AuthorityUnavailable => error(Unavailable)
        case NonFatal(_) => error(InternalFailure)
      }
        .map(_.withHeaders("Cache-Control" -> "no-store", "X-Content-Type-Options" -> "nosniff", "Content-Security-Policy" -> "default-src 'none'; frame-ancestors 'none'"))
    }
  private def body[A](request: Request[ByteString])(decode: JsObject => Outcome[A])(run: A => Future[Outcome[Result]]): Future[Outcome[Result]] = {
    if (request.contentType != Some("application/json") || request.charset.exists(c => !c.equalsIgnoreCase("UTF-8")))
      return Future.successful(Right(UnsupportedMediaType(Json.obj("code" -> "unsupported-media-type"))))
    if (request.queryString.nonEmpty) return Future.successful(Left(InvalidRequest))
    val value = try {
      val text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(request.body.asByteBuffer).toString
      WarehouseHttpCodec.decodeBody(text).flatMap(decode)
    } catch { case NonFatal(_) => Left(InvalidRequest) }
    value match { case Left(failure) => Future.successful(Left(failure)); case Right(v) => run(v) }
  }
  def reserve(warehouseId: String): Action[ByteString] = secured(warehouseId, write = true) { (id, request) =>
    body(request)(WarehouseHttpCodec.reserve(id, _))(value => application.commands.reserve(value).map(_.map(result => Ok(WarehouseHttpCodec.reserveResult(result)))))
  }
  def commit(warehouseId: String): Action[ByteString] = secured(warehouseId, write = true) { (id, request) =>
    body(request)(WarehouseHttpCodec.commit(id, _))(value => application.commands.commit(value).map(_.map(result => Ok(WarehouseHttpCodec.commitResult(result)))))
  }
  private def receipts(id: WarehouseId, request: Request[ByteString])(render: ReceiptPage => Result): Future[Outcome[Result]] = {
    if (request.body.nonEmpty) return Future.successful(Left(InvalidRequest))
    WarehouseHttpCodec.query(id.value, request.queryString) match {
      case Left(failure) => Future.successful(Left(failure))
      case Right((after, limit)) => application.queries.receipts(id, after, limit).map(_.map(render))
    }
  }
  def query(warehouseId: String): Action[ByteString] = secured(warehouseId, write = false) { (id, request) =>
    receipts(id, request)(page => Ok(WarehouseHttpCodec.page(id.value, page)))
  }
  def page(warehouseId: String): Action[ByteString] = secured(warehouseId, write = false) { (id, request) =>
    receipts(id, request) { page =>
      val limit = request.getQueryString("limit").getOrElse("20")
      val next = page.next.map(c => "/warehouses/" + java.net.URLEncoder.encode(id.value, "UTF-8").replace("+", "%20") +
        "/receipts?after=" + WarehouseHttpCodec.cursor(id.value, c) + "&limit=" + limit)
      Ok(views.html.warehouseReceipts(id.value, page, next))
    }
  }
  def readiness: Action[AnyContent] = Action {
    if (application.accepting) Ok(Json.obj("status" -> "ready")) else ServiceUnavailable(Json.obj("status" -> "unavailable"))
  }
}
