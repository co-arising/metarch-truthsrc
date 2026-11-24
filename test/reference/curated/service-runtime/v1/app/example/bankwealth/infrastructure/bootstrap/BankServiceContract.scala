package example.bankwealth.infrastructure.bootstrap

import play.api.ApplicationLoader
import play.api.libs.json.{JsValue, Reads, Writes}
import play.api.mvc.{RequestHeader, Result}
import scala.concurrent.Future

object BankServiceContract {
  final case class Principal private[bootstrap] (id: String, roles: Set[String])

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

  final case class Endpoint[I, O](
    implementation: String,
    version: String,
    reads: Reads[I],
    writes: Writes[O],
    run: (Principal, I) => Future[Outcome[O]]
  )

  final case class Bindings(
    BankAccountQuery: Endpoint[example.bankwealth.domain.values.BankAccountKey, example.bankwealth.domain.values.BankAccountResponse],
    BankCashSubmitPort: Endpoint[example.bankwealth.domain.values.BankCashSubmit, example.bankwealth.domain.values.BankCashAcknowledgement],
    BankCashOriginalQuery: Endpoint[example.bankwealth.domain.values.BankCashRequestKey, example.bankwealth.domain.values.BankCashRequestResponse],
    BankOrderQuery: Endpoint[example.bankwealth.domain.values.BankOrderKey, example.bankwealth.domain.values.BankOrderResponse],
    BankSipCreatePort: Endpoint[example.bankwealth.domain.values.BankSipCreate, example.bankwealth.domain.values.BankSipAcknowledgement],
    BankSipPlansQuery: Endpoint[example.bankwealth.domain.values.BankPlanPageKey, example.bankwealth.domain.values.BankSipPlanPage],
    BankSipPlanQuery: Endpoint[example.bankwealth.domain.values.BankPlanKey, example.bankwealth.domain.values.BankSipPlanResponse],
    BankSipRevisePort: Endpoint[example.bankwealth.domain.values.BankSipRevisionInput, example.bankwealth.domain.values.BankSipAcknowledgement],
    BankSipPausePort: Endpoint[example.bankwealth.domain.values.BankPlanKey, example.bankwealth.domain.values.BankSipAcknowledgement],
    BankSipResumePort: Endpoint[example.bankwealth.domain.values.BankPlanKey, example.bankwealth.domain.values.BankSipAcknowledgement],
    BankSipOccurrencesQuery: Endpoint[example.bankwealth.domain.values.BankOccurrencePageKey, example.bankwealth.domain.values.BankSipOccurrencePage],
    BankPendingOperationsQuery: Endpoint[example.bankwealth.domain.values.BankPendingPageKey, example.bankwealth.domain.values.BankPendingResponse],
    BankReconcileExistingPort: Endpoint[example.bankwealth.domain.values.BankOperationKey, example.bankwealth.domain.values.BankRecoveryAcknowledgement],
    BankBusinessTickPort: Endpoint[example.bankwealth.domain.values.BankTick, example.bankwealth.domain.values.BankTickAcknowledgement]
  )

  trait PageRenderer {
    def implementation: String
    def version: String
    def shell: String
    def script: String
    def render(endpointId: String, status: Int, value: JsValue): String
  }
  trait Composition extends AutoCloseable {
    def authority: Authority
    def bindings: Bindings
    def ready: Future[Unit]
    def pages: Option[PageRenderer] = None
  }

  trait Factory {
    def implementation: String
    def version: String
    def create(context: ApplicationLoader.Context): Composition
  }

  private def requireEndpoint[I, O](endpoint: Endpoint[I, O], id: String, impl: String, version: String): Unit =
    require(
      endpoint != null && endpoint.implementation == impl && endpoint.version == version &&
        endpoint.reads != null && endpoint.writes != null && endpoint.run != null,
      "missing service endpoint " + id
    )

  def requireInstalled(value: Composition): Unit = {
    require(value != null && value.authority != null && value.bindings != null, "complete service composition required")
    requireEndpoint(value.bindings.BankAccountQuery, "account-me", "example.bankwealth.integration.BankServiceEndpoints.BankAccountQuery", "bank-v1-service-1")
    requireEndpoint(value.bindings.BankCashSubmitPort, "cash-submit", "example.bankwealth.integration.BankServiceEndpoints.BankCashSubmitPort", "bank-v1-service-1")
    requireEndpoint(value.bindings.BankCashOriginalQuery, "cash-original", "example.bankwealth.integration.BankServiceEndpoints.BankCashOriginalQuery", "bank-v1-service-1")
    requireEndpoint(value.bindings.BankOrderQuery, "order-detail", "example.bankwealth.integration.BankServiceEndpoints.BankOrderQuery", "bank-v1-service-1")
    requireEndpoint(value.bindings.BankSipCreatePort, "sip-create", "example.bankwealth.integration.BankServiceEndpoints.BankSipCreatePort", "bank-v1-service-1")
    requireEndpoint(value.bindings.BankSipPlansQuery, "sip-list", "example.bankwealth.integration.BankServiceEndpoints.BankSipPlansQuery", "bank-v1-service-1")
    requireEndpoint(value.bindings.BankSipPlanQuery, "sip-detail", "example.bankwealth.integration.BankServiceEndpoints.BankSipPlanQuery", "bank-v1-service-1")
    requireEndpoint(value.bindings.BankSipRevisePort, "sip-revise", "example.bankwealth.integration.BankServiceEndpoints.BankSipRevisePort", "bank-v1-service-1")
    requireEndpoint(value.bindings.BankSipPausePort, "sip-pause", "example.bankwealth.integration.BankServiceEndpoints.BankSipPausePort", "bank-v1-service-1")
    requireEndpoint(value.bindings.BankSipResumePort, "sip-resume", "example.bankwealth.integration.BankServiceEndpoints.BankSipResumePort", "bank-v1-service-1")
    requireEndpoint(value.bindings.BankSipOccurrencesQuery, "sip-occurrences", "example.bankwealth.integration.BankServiceEndpoints.BankSipOccurrencesQuery", "bank-v1-service-1")
    requireEndpoint(value.bindings.BankPendingOperationsQuery, "operations-pending", "example.bankwealth.integration.BankServiceEndpoints.BankPendingOperationsQuery", "bank-v1-service-1")
    requireEndpoint(value.bindings.BankReconcileExistingPort, "operation-reconcile", "example.bankwealth.integration.BankServiceEndpoints.BankReconcileExistingPort", "bank-v1-service-1")
    requireEndpoint(value.bindings.BankBusinessTickPort, "business-tick", "example.bankwealth.integration.BankServiceEndpoints.BankBusinessTickPort", "bank-v1-service-1")
    val installedPages = value.pages
    require(installedPages != null && installedPages.exists(p => p != null && p.implementation == "example.bankwealth.web.BankBrowserPages" && p.version == "1"), "page renderer pin mismatch")
  }
}
