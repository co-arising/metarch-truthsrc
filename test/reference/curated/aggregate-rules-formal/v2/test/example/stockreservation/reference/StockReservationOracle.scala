package example.stockreservation.reference

import scala.util.control.NonFatal

import net.imadz.common.CommonTypes.iMadzError

import example.stockreservation.domain.entities.StockReservationEntity._
import example.stockreservation.domain.invariant.StockReservationRules._
import example.stockreservation.domain.services.ReservationIdentity
import example.stockreservation.domain.values._
import example.stockreservation.reference.StockReservationCases._

object StockReservationOracle {
  final case class ErrorRecord(code: String, message: String)
  final case class IdentityCall(warehouseId: WarehouseId, requestId: RequestId, sku: SkuId, quantity: Long)

  sealed trait Outcome
  final case class Returned(result: Either[ErrorRecord, List[StockReservationEvents]]) extends Outcome
  final case class Threw(error: Throwable) extends Outcome

  final case class Observation(outcome: Outcome, calls: Vector[IdentityCall], stateUnchanged: Boolean)

  trait ReserveDecision {
    def apply(
        state: StockReservationState,
        params: ReserveUnitsParams,
        identity: ReservationIdentity
    ): Either[iMadzError, List[StockReservationEvents]]
  }

  object ProductionReserve extends ReserveDecision {
    override def apply(
        state: StockReservationState,
        params: ReserveUnitsParams,
        identity: ReservationIdentity
    ): Either[iMadzError, List[StockReservationEvents]] = (new ReserveUnitsRule(identity))(state, params)
  }

  trait ConfirmDecision {
    def apply(
        state: StockReservationState,
        params: ConfirmReservationParams
    ): Either[iMadzError, List[StockReservationEvents]]
  }

  object ProductionConfirm extends ConfirmDecision {
    override def apply(
        state: StockReservationState,
        params: ConfirmReservationParams
    ): Either[iMadzError, List[StockReservationEvents]] = ConfirmReservationRule(state, params)
  }

  val sentinelId: ReservationId = ReservationId("independent-port-result")

  // Expected code/message pairs are independent records, not the production rejection adapter.
  def expectedReserve(sample: ReserveCase): Either[ErrorRecord, List[StockReservationEvents]] = sample.branch match {
    case NonPositive | SeveralFailures => Left(ErrorRecord(
      "STOCK_QUANTITY_NONPOSITIVE", "Requested quantity must be greater than zero."
    ))
    case DuplicateRequest | DuplicateWithMissingLocation => Left(ErrorRecord(
      "STOCK_REQUEST_ALREADY_RESERVED", "The request already has a reservation."
    ))
    case MissingLocation => Left(ErrorRecord(
      "STOCK_LOCATION_UNKNOWN", "Every requested location must be registered."
    ))
    case ShortStock | MissingSku => Left(ErrorRecord(
      "STOCK_UNAVAILABLE", "The SKU must exist with sufficient available quantity."
    ))
    case CanReserve => Right(List(
      UnitsReserved(
        sample.requestId, sentinelId, sample.sku, sample.quantity, sample.locations, sample.locationNotes
      ),
      ReservationReceiptIssued(sample.requestId, sentinelId)
    ))
  }

  def expectedConfirm(sample: ConfirmCase): Either[ErrorRecord, List[StockReservationEvents]] = sample.branch match {
    case MissingReservation => Left(ErrorRecord("STOCK_RESERVATION_MISSING", "The request has no reservation."))
    case WrongIdentity | WrongIdentityAlreadyConfirmed => Left(ErrorRecord(
      "STOCK_RESERVATION_ID_MISMATCH", "The reservation identity does not match the request."
    ))
    case AlreadyConfirmed => Right(Nil)
    case CanConfirm => Right(List(ReservationConfirmed(sample.requestId, sample.suppliedId)))
  }

  final class IdentityProbe(failure: Option[RuntimeException]) extends ReservationIdentity {
    private var recorded = Vector.empty[IdentityCall]
    def calls: Vector[IdentityCall] = recorded

    override def reservationId(
        warehouseId: WarehouseId,
        requestId: RequestId,
        sku: SkuId,
        quantity: Long
    ): ReservationId = {
      recorded :+= IdentityCall(warehouseId, requestId, sku, quantity)
      failure match {
        case Some(error) => throw error
        case None => sentinelId
      }
    }
  }

  private def capture(result: => Either[iMadzError, List[StockReservationEvents]]): Outcome =
    try Returned(result.left.map(error => ErrorRecord(error.code, error.message)))
    catch { case NonFatal(error) => Threw(error) }

  def observeReserve(
      sample: ReserveCase,
      decision: ReserveDecision,
      failure: Option[RuntimeException] = None
  ): Observation = {
    val original = sample.state.copy()
    val probe = new IdentityProbe(failure)
    val outcome = capture(decision(sample.state, sample.params, probe))
    Observation(outcome, probe.calls, sample.state == original)
  }

  def expectedCalls(sample: ReserveCase): Vector[IdentityCall] = sample.branch match {
    case CanReserve => Vector(IdentityCall(sample.warehouseId, sample.requestId, sample.sku, sample.quantity))
    case _ => Vector.empty
  }

  def reserveMatches(sample: ReserveCase, decision: ReserveDecision): Boolean = {
    val observed = observeReserve(sample, decision)
    reservePremise(sample) && observed.stateUnchanged &&
      observed.outcome == Returned(expectedReserve(sample)) && observed.calls == expectedCalls(sample)
  }

  def confirmMatches(sample: ConfirmCase, decision: ConfirmDecision = ProductionConfirm): Boolean = {
    val original = sample.state.copy()
    confirmPremise(sample) && capture(decision(sample.state, sample.params)) ==
      Returned(expectedConfirm(sample)) && sample.state == original
  }

  private def sameException(outcome: Outcome, expected: Throwable): Boolean = outcome match {
    case Threw(actual) => actual eq expected
    case _ => false
  }

  def exceptionMatches(sample: ReserveCase, decision: ReserveDecision): Boolean = {
    val expectedFailure = new IllegalStateException("independent computation failure")
    val observed = observeReserve(sample, decision, Some(expectedFailure))
    reservePremise(sample) && sample.branch == CanReserve && sameException(observed.outcome, expectedFailure) &&
      observed.stateUnchanged && observed.calls == expectedCalls(sample)
  }

  /** Test-only state projection. This is not a generated or production event handler. */
  def project(state: StockReservationState, events: List[StockReservationEvents]): StockReservationState =
    events.foldLeft(state) {
      case (current, event: UnitsReserved) =>
        val remaining = (BigInt(current.available(event.sku)) - event.quantity).toLong
        current.copy(
          available = current.available.updated(event.sku, remaining),
          reservations = current.reservations.updated(event.requestId, StoredReservation(
            event.reservationId, event.sku, event.quantity, event.locations, event.locationNotes
          ))
        )
      case (current, _: ReservationReceiptIssued) => current
      case (current, event: ReservationConfirmed) =>
        current.copy(confirmedRequests = current.confirmedRequests + event.requestId)
    }
}
