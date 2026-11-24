package example.bankwealth.application.aggregates.behaviors

import akka.actor.typed.ActorRef
import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.application.aggregates.FundOrderProtocol._
import example.bankwealth.domain.entities.FundOrderEntity.{Event, State}
import example.bankwealth.domain.invariants.params.FundOrderRuleParams._

trait FundOrderCommandHelpers {
  protected def toRequestFundPurchaseSettlementParams(cmd: RequestFundPurchaseSettlement): RequestFundPurchaseSettlementParams =
    RequestFundPurchaseSettlementParams(cmd.operationId, cmd.fundOrderId, cmd.investorAccountId, cmd.fundCollectionAccountId, cmd.fundCode, cmd.amount)
  protected def toReserveFundSubscriptionParams(cmd: ReserveFundSubscription): ReserveFundSubscriptionParams =
    ReserveFundSubscriptionParams(cmd.txid, cmd.resource, cmd.amount)
  protected def toConfirmFundSubscriptionPaymentParams(cmd: ConfirmFundSubscriptionPayment): ConfirmFundSubscriptionPaymentParams =
    ConfirmFundSubscriptionPaymentParams(cmd.txid, cmd.resource, cmd.amount)
  protected def toCancelCashFundSubscriptionParams(cmd: CancelCashFundSubscription): CancelCashFundSubscriptionParams =
    CancelCashFundSubscriptionParams(cmd.txid, cmd.resource, cmd.amount)
  protected def toRecordFundCashPaymentSucceededParams(cmd: RecordFundCashPaymentSucceeded): RecordFundCashPaymentSucceededParams =
    RecordFundCashPaymentSucceededParams(cmd.txid)
  protected def toRecordFundCashPaymentRejectedBeforeEffectsParams(cmd: RecordFundCashPaymentRejectedBeforeEffects): RecordFundCashPaymentRejectedBeforeEffectsParams =
    RecordFundCashPaymentRejectedBeforeEffectsParams(cmd.txid)
  protected def toRecordFundCashPaymentCompensatedParams(cmd: RecordFundCashPaymentCompensated): RecordFundCashPaymentCompensatedParams =
    RecordFundCashPaymentCompensatedParams(cmd.txid)
  protected def toRecordFundCashPaymentRecoveryRequiredParams(cmd: RecordFundCashPaymentRecoveryRequired): RecordFundCashPaymentRecoveryRequiredParams =
    RecordFundCashPaymentRecoveryRequiredParams(cmd.txid)
  protected def toRecordFundCashPaymentOutcomeUnknownParams(cmd: RecordFundCashPaymentOutcomeUnknown): RecordFundCashPaymentOutcomeUnknownParams =
    RecordFundCashPaymentOutcomeUnknownParams(cmd.txid)
  protected def toRegisterFundTASubmissionParams(cmd: RegisterFundTASubmission): RegisterFundTASubmissionParams =
    RegisterFundTASubmissionParams(cmd.fundOrderId, cmd.paymentTxId)
  protected def toRecordFundTAAcceptedParams(cmd: RecordFundTAAccepted): RecordFundTAAcceptedParams =
    RecordFundTAAcceptedParams(cmd.fundOrderId, cmd.paymentTxId, cmd.taRequestId, cmd.taReference, cmd.receiptId, cmd.receiptBody, cmd.fundCode, cmd.currency)
  protected def toRecordFundTAConfirmedParams(cmd: RecordFundTAConfirmed): RecordFundTAConfirmedParams =
    RecordFundTAConfirmedParams(cmd.fundOrderId, cmd.paymentTxId, cmd.taRequestId, cmd.taReference, cmd.receiptId, cmd.receiptBody, cmd.fundCode, cmd.currency, cmd.shares)
  protected def toRecordFundTARejectedParams(cmd: RecordFundTARejected): RecordFundTARejectedParams =
    RecordFundTARejectedParams(cmd.fundOrderId, cmd.paymentTxId, cmd.taRequestId, cmd.taReference, cmd.receiptId, cmd.receiptBody, cmd.fundCode, cmd.currency, cmd.reason)
  protected def toRecordFundTAUnknownParams(cmd: RecordFundTAUnknown): RecordFundTAUnknownParams =
    RecordFundTAUnknownParams(cmd.fundOrderId, cmd.paymentTxId, cmd.taRequestId, cmd.taReference, cmd.receiptId, cmd.receiptBody, cmd.fundCode, cmd.currency)
  protected def toRequestFundPurchaseRefundParams(cmd: RequestFundPurchaseRefund): RequestFundPurchaseRefundParams =
    RequestFundPurchaseRefundParams(cmd.fundOrderId, cmd.paymentTxId)
  protected def toRecordFundRefundSucceededParams(cmd: RecordFundRefundSucceeded): RecordFundRefundSucceededParams =
    RecordFundRefundSucceededParams(cmd.refundTxId, cmd.refundOperationId, cmd.receiptId, cmd.receiptBody)
  protected def toRecordFundRefundRejectedBeforeEffectsParams(cmd: RecordFundRefundRejectedBeforeEffects): RecordFundRefundRejectedBeforeEffectsParams =
    RecordFundRefundRejectedBeforeEffectsParams(cmd.refundTxId, cmd.refundOperationId, cmd.receiptId, cmd.receiptBody)
  protected def toRecordFundRefundCompensatedParams(cmd: RecordFundRefundCompensated): RecordFundRefundCompensatedParams =
    RecordFundRefundCompensatedParams(cmd.refundTxId, cmd.refundOperationId, cmd.receiptId, cmd.receiptBody)
  protected def toRecordFundRefundRecoveryRequiredParams(cmd: RecordFundRefundRecoveryRequired): RecordFundRefundRecoveryRequiredParams =
    RecordFundRefundRecoveryRequiredParams(cmd.refundTxId, cmd.refundOperationId, cmd.receiptId, cmd.receiptBody)
  protected def toRecordFundRefundOutcomeUnknownParams(cmd: RecordFundRefundOutcomeUnknown): RecordFundRefundOutcomeUnknownParams =
    RecordFundRefundOutcomeUnknownParams(cmd.refundTxId, cmd.refundOperationId, cmd.receiptId, cmd.receiptBody)
  protected def toRecordCashRequestSourceParams(cmd: RecordCashRequestSource): RecordCashRequestSourceParams =
    RecordCashRequestSourceParams(cmd.original, cmd.source)

  protected def replyEffect(
    decision: Either[String, Vector[Event]],
    replyTo: ActorRef[Reply]
  ): Effect[Event, State] = decision match {
    case Left(code) =>
      Effect.none.thenRun((_: State) => replyTo ! Refused(code))
    case Right(events) =>
      Effect.persist(events).thenRun((_: State) => replyTo ! Accepted(events))
  }
}
