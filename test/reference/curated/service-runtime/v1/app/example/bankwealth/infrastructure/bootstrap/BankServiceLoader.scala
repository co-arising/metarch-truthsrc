package example.bankwealth.infrastructure.bootstrap

import play.api.{Application, ApplicationLoader, BuiltInComponentsFromContext}
import play.api.libs.json._
import play.api.mvc._
import play.api.routing.Router
import scala.concurrent.{ExecutionContext, Future}
import scala.util.control.NonFatal
import BankServiceContract._

final class BankServiceLoader extends ApplicationLoader {
  def load(context: ApplicationLoader.Context): Application =
    ApplicationBootstrap.load(context)
}

object BankServiceComponents {
  private[bootstrap] final case class Response(status: Int, value: JsValue)
  private[bootstrap] final case class Route(
    method: String,
    pattern: scala.util.matching.Regex,
    parameters: Vector[String],
    audience: String,
    csrf: Boolean,
    endpointId: String,
    page: Boolean,
    run: (Principal, JsValue) => Future[Response]
  )
}

final class BankServiceComponents(context: ApplicationLoader.Context, composition: Composition)
  extends BuiltInComponentsFromContext(context) {
  import BankServiceComponents.{Response, Route}

  implicit private val ec: ExecutionContext = executionContext
  override lazy val httpFilters = Seq.empty[EssentialFilter]
  applicationLifecycle.addStopHook(() => Future(composition.close()))
  private val pageRenderer: PageRenderer = {
    requireInstalled(composition)
    composition.pages.get
  }
  private val staticHeaders = Vector("Cache-Control" -> "no-store", "X-Content-Type-Options" -> "nosniff", "Referrer-Policy" -> "no-referrer")
  private val htmlHeaders = staticHeaders :+ ("Content-Security-Policy" -> "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")
  private def unavailableHtml: Result = Results.ServiceUnavailable("<!doctype html><html><head><meta charset=\"utf-8\"><title>Service unavailable</title></head><body><p>Service unavailable</p></body></html>").as("text/html; charset=utf-8").withHeaders(htmlHeaders: _*)
  private def failure(error: Failure): Response = Response(error.status, Json.obj("code" -> error.code))
  private def renderResponse(row: Route, value: Response): Result =
    if (!row.page) Results.Status(value.status)(value.value)
    else try Results.Status(value.status)(pageRenderer.render(row.endpointId, value.status, value.value)).as("text/html; charset=utf-8").withHeaders(htmlHeaders: _*)
    catch { case NonFatal(_) => unavailableHtml }
  private def staticPage(script: Boolean): Result =
    try {
      if (script) Results.Ok(pageRenderer.script).as("application/javascript; charset=utf-8").withHeaders(staticHeaders: _*)
      else Results.Ok(pageRenderer.shell).as("text/html; charset=utf-8").withHeaders(htmlHeaders: _*)
    } catch { case NonFatal(_) =>
      if (script) Results.ServiceUnavailable("").as("application/javascript; charset=utf-8").withHeaders(staticHeaders: _*)
      else unavailableHtml
    }
  private def invoke[I, O](endpoint: Endpoint[I, O], principal: Principal, input: JsValue): Future[Response] =
    endpoint.reads.reads(input) match {
      case JsSuccess(value, _) => endpoint.run(principal, value).map {
        case Right(result) => Response(200, endpoint.writes.writes(result))
        case Left(error) => failure(error)
      }
      case _: JsError => Future.successful(failure(InvalidRequest))
    }
  private val apiActions: Vector[Route] = Vector(
    Route(
      method = "GET",
      pattern = "^/api/v1/accounts/me$".r,
      parameters = Vector(),
      audience = "customer",
      csrf = false,
      endpointId = "account-me",
      page = false,
      run = (principal: Principal, input: JsValue) => invoke(composition.bindings.BankAccountQuery, principal, input)
    ),
    Route(
      method = "POST",
      pattern = "^/api/v1/cash-requests$".r,
      parameters = Vector(),
      audience = "customer",
      csrf = true,
      endpointId = "cash-submit",
      page = false,
      run = (principal: Principal, input: JsValue) => invoke(composition.bindings.BankCashSubmitPort, principal, input)
    ),
    Route(
      method = "GET",
      pattern = "^/api/v1/cash-requests/([^/]+)$".r,
      parameters = Vector("clientRequestId"),
      audience = "customer",
      csrf = false,
      endpointId = "cash-original",
      page = false,
      run = (principal: Principal, input: JsValue) => invoke(composition.bindings.BankCashOriginalQuery, principal, input)
    ),
    Route(
      method = "GET",
      pattern = "^/api/v1/orders/([^/]+)$".r,
      parameters = Vector("orderId"),
      audience = "customer",
      csrf = false,
      endpointId = "order-detail",
      page = false,
      run = (principal: Principal, input: JsValue) => invoke(composition.bindings.BankOrderQuery, principal, input)
    ),
    Route(
      method = "POST",
      pattern = "^/api/v1/sip-plans$".r,
      parameters = Vector(),
      audience = "customer",
      csrf = true,
      endpointId = "sip-create",
      page = false,
      run = (principal: Principal, input: JsValue) => invoke(composition.bindings.BankSipCreatePort, principal, input)
    ),
    Route(
      method = "GET",
      pattern = "^/api/v1/sip-plans$".r,
      parameters = Vector(),
      audience = "customer",
      csrf = false,
      endpointId = "sip-list",
      page = false,
      run = (principal: Principal, input: JsValue) => invoke(composition.bindings.BankSipPlansQuery, principal, input)
    ),
    Route(
      method = "GET",
      pattern = "^/api/v1/sip-plans/([^/]+)$".r,
      parameters = Vector("planId"),
      audience = "customer",
      csrf = false,
      endpointId = "sip-detail",
      page = false,
      run = (principal: Principal, input: JsValue) => invoke(composition.bindings.BankSipPlanQuery, principal, input)
    ),
    Route(
      method = "POST",
      pattern = "^/api/v1/sip-plans/([^/]+)/revisions$".r,
      parameters = Vector("planId"),
      audience = "customer",
      csrf = true,
      endpointId = "sip-revise",
      page = false,
      run = (principal: Principal, input: JsValue) => invoke(composition.bindings.BankSipRevisePort, principal, input)
    ),
    Route(
      method = "POST",
      pattern = "^/api/v1/sip-plans/([^/]+)/pause$".r,
      parameters = Vector("planId"),
      audience = "customer",
      csrf = true,
      endpointId = "sip-pause",
      page = false,
      run = (principal: Principal, input: JsValue) => invoke(composition.bindings.BankSipPausePort, principal, input)
    ),
    Route(
      method = "POST",
      pattern = "^/api/v1/sip-plans/([^/]+)/resume$".r,
      parameters = Vector("planId"),
      audience = "customer",
      csrf = true,
      endpointId = "sip-resume",
      page = false,
      run = (principal: Principal, input: JsValue) => invoke(composition.bindings.BankSipResumePort, principal, input)
    ),
    Route(
      method = "GET",
      pattern = "^/api/v1/sip-plans/([^/]+)/occurrences$".r,
      parameters = Vector("planId"),
      audience = "customer",
      csrf = false,
      endpointId = "sip-occurrences",
      page = false,
      run = (principal: Principal, input: JsValue) => invoke(composition.bindings.BankSipOccurrencesQuery, principal, input)
    ),
    Route(
      method = "GET",
      pattern = "^/api/v1/operations/pending$".r,
      parameters = Vector(),
      audience = "operator",
      csrf = false,
      endpointId = "operations-pending",
      page = false,
      run = (principal: Principal, input: JsValue) => invoke(composition.bindings.BankPendingOperationsQuery, principal, input)
    ),
    Route(
      method = "POST",
      pattern = "^/api/v1/operations/([^/]+)/reconcile$".r,
      parameters = Vector("operationId"),
      audience = "operator",
      csrf = true,
      endpointId = "operation-reconcile",
      page = false,
      run = (principal: Principal, input: JsValue) => invoke(composition.bindings.BankReconcileExistingPort, principal, input)
    ),
    Route(
      method = "POST",
      pattern = "^/api/v1/business-clock/tick$".r,
      parameters = Vector(),
      audience = "operator",
      csrf = true,
      endpointId = "business-tick",
      page = false,
      run = (principal: Principal, input: JsValue) => invoke(composition.bindings.BankBusinessTickPort, principal, input)
    )
  )
  private val apiById: Map[String, Route] = apiActions.iterator.map(r => r.endpointId -> r).toMap
  private val pageActions: Vector[Route] = Vector(
    apiById("account-me").copy(pattern = "^/bank/v1/accounts/me$".r, page = true),
    apiById("cash-submit").copy(pattern = "^/bank/v1/cash-requests$".r, page = true),
    apiById("cash-original").copy(pattern = "^/bank/v1/cash-requests/([^/]+)$".r, page = true),
    apiById("order-detail").copy(pattern = "^/bank/v1/orders/([^/]+)$".r, page = true),
    apiById("sip-create").copy(pattern = "^/bank/v1/sip-plans$".r, page = true),
    apiById("sip-list").copy(pattern = "^/bank/v1/sip-plans$".r, page = true),
    apiById("sip-detail").copy(pattern = "^/bank/v1/sip-plans/([^/]+)$".r, page = true),
    apiById("sip-revise").copy(pattern = "^/bank/v1/sip-plans/([^/]+)/revisions$".r, page = true),
    apiById("sip-pause").copy(pattern = "^/bank/v1/sip-plans/([^/]+)/pause$".r, page = true),
    apiById("sip-resume").copy(pattern = "^/bank/v1/sip-plans/([^/]+)/resume$".r, page = true),
    apiById("sip-occurrences").copy(pattern = "^/bank/v1/sip-plans/([^/]+)/occurrences$".r, page = true),
    apiById("operations-pending").copy(pattern = "^/bank/v1/operations/pending$".r, page = true),
    apiById("operation-reconcile").copy(pattern = "^/bank/v1/operations/([^/]+)/reconcile$".r, page = true),
    apiById("business-tick").copy(pattern = "^/bank/v1/business-clock/tick$".r, page = true)
  )
  private val actions: Vector[Route] = apiActions ++ pageActions
  private def dispatchAuthorized(row: Route, matched: scala.util.matching.Regex.Match, request: Request[String], principal: Principal): Future[Response] = {
    val allowed = if (row.csrf) composition.authority.csrf(request) else Future.successful(true)
    allowed.flatMap { ok =>
      if (!ok) Future.successful(Response(403, Json.obj("code" -> "csrf-denied")))
      else {
        val params = JsObject(row.parameters.zipWithIndex.map { case (p, i) => p -> JsString(matched.group(i + 1)) })
        val body = if (row.method == "GET") Right(JsNull) else decodeBody(request.body)
        body match {
          case Left(error) => Future.successful(failure(error))
          case Right(value) =>
            val query = JsObject(request.queryString.toVector.map { case (k, v) => k -> JsArray(v.map(JsString)) })
            row.run(principal, Json.obj("path" -> params, "query" -> query, "body" -> value))
        }
      }
    }
  }
  private def action(row: Route, matched: scala.util.matching.Regex.Match): Handler = {
    val parser: BodyParser[String] = if (!row.page) controllerComponents.parsers.tolerantText(65536)
      else BodyParser("service-page-text") { request =>
        controllerComponents.parsers.tolerantText(65536)(request).map {
          _.left.map(result => renderResponse(row, Response(result.header.status, Json.obj("code" -> "invalid-request"))))
        }
      }
    controllerComponents.actionBuilder.async(parser) { request =>
      Future.successful(()).flatMap(_ => composition.ready).flatMap { _ =>
        composition.authority.authenticate(request).flatMap {
          case Some((id, roles)) if id != null && id.nonEmpty && roles != null && roles.contains(row.audience) =>
            dispatchAuthorized(row, matched, request, Principal(id, roles))
          case None => Future.successful(failure(NotAuthenticated))
          case _ => Future.successful(failure(NotAuthorized))
        }
      }.recover { case NonFatal(_) => failure(Unavailable) }.map(value => renderResponse(row, value))
    }
  }
  override lazy val router: Router = Router.from {
    case request if request.method == "GET" && request.path == "/bank/v1" =>
      controllerComponents.actionBuilder(controllerComponents.parsers.empty) { _ => staticPage(script = false) }
    case request if request.method == "GET" && request.path == "/bank/v1/client-script" =>
      controllerComponents.actionBuilder(controllerComponents.parsers.empty) { _ => staticPage(script = true) }
    case request if actions.exists(row => row.method == request.method && row.pattern.findFirstMatchIn(request.path).nonEmpty) =>
      val row = actions.find(r => r.method == request.method && r.pattern.findFirstMatchIn(request.path).nonEmpty).get
      action(row, row.pattern.findFirstMatchIn(request.path).get)
  }
}
