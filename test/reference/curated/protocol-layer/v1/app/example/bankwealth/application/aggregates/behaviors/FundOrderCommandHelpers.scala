package example.bankwealth.application.aggregates.behaviors

import example.bankwealth.application.aggregates.FundOrderProtocol._
import example.bankwealth.domain.entities.FundOrderEntity.State
import example.bankwealth.domain.invariants.params.FundOrderRuleParams._
import net.imadz.common.CommonTypes.iMadzError
import net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper

trait FundOrderCommandHelpers {

  implicit object RequestFundPurchaseSettlementHelper extends CommandHelper[RequestFundPurchaseSettlement, State, RequestFundPurchaseSettlementParams, Reply] {
    override def toParam(state: State, command: RequestFundPurchaseSettlement): RequestFundPurchaseSettlementParams =
      RequestFundPurchaseSettlementParams(command.operationId, command.fundOrderId, command.investorAccountId, command.fundCollectionAccountId, command.fundCode, command.amount)

    override def createFailureReply(param: RequestFundPurchaseSettlementParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RequestFundPurchaseSettlementParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object ReserveFundSubscriptionHelper extends CommandHelper[ReserveFundSubscription, State, ReserveFundSubscriptionParams, Reply] {
    override def toParam(state: State, command: ReserveFundSubscription): ReserveFundSubscriptionParams =
      ReserveFundSubscriptionParams(command.txid, command.resource, command.amount)

    override def createFailureReply(param: ReserveFundSubscriptionParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: ReserveFundSubscriptionParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object ConfirmFundSubscriptionPaymentHelper extends CommandHelper[ConfirmFundSubscriptionPayment, State, ConfirmFundSubscriptionPaymentParams, Reply] {
    override def toParam(state: State, command: ConfirmFundSubscriptionPayment): ConfirmFundSubscriptionPaymentParams =
      ConfirmFundSubscriptionPaymentParams(command.txid, command.resource, command.amount)

    override def createFailureReply(param: ConfirmFundSubscriptionPaymentParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: ConfirmFundSubscriptionPaymentParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object CancelCashFundSubscriptionHelper extends CommandHelper[CancelCashFundSubscription, State, CancelCashFundSubscriptionParams, Reply] {
    override def toParam(state: State, command: CancelCashFundSubscription): CancelCashFundSubscriptionParams =
      CancelCashFundSubscriptionParams(command.txid, command.resource, command.amount)

    override def createFailureReply(param: CancelCashFundSubscriptionParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: CancelCashFundSubscriptionParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordFundCashPaymentSucceededHelper extends CommandHelper[RecordFundCashPaymentSucceeded, State, RecordFundCashPaymentSucceededParams, Reply] {
    override def toParam(state: State, command: RecordFundCashPaymentSucceeded): RecordFundCashPaymentSucceededParams =
      RecordFundCashPaymentSucceededParams(command.txid)

    override def createFailureReply(param: RecordFundCashPaymentSucceededParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordFundCashPaymentSucceededParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordFundCashPaymentRejectedBeforeEffectsHelper extends CommandHelper[RecordFundCashPaymentRejectedBeforeEffects, State, RecordFundCashPaymentRejectedBeforeEffectsParams, Reply] {
    override def toParam(state: State, command: RecordFundCashPaymentRejectedBeforeEffects): RecordFundCashPaymentRejectedBeforeEffectsParams =
      RecordFundCashPaymentRejectedBeforeEffectsParams(command.txid)

    override def createFailureReply(param: RecordFundCashPaymentRejectedBeforeEffectsParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordFundCashPaymentRejectedBeforeEffectsParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordFundCashPaymentCompensatedHelper extends CommandHelper[RecordFundCashPaymentCompensated, State, RecordFundCashPaymentCompensatedParams, Reply] {
    override def toParam(state: State, command: RecordFundCashPaymentCompensated): RecordFundCashPaymentCompensatedParams =
      RecordFundCashPaymentCompensatedParams(command.txid)

    override def createFailureReply(param: RecordFundCashPaymentCompensatedParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordFundCashPaymentCompensatedParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordFundCashPaymentRecoveryRequiredHelper extends CommandHelper[RecordFundCashPaymentRecoveryRequired, State, RecordFundCashPaymentRecoveryRequiredParams, Reply] {
    override def toParam(state: State, command: RecordFundCashPaymentRecoveryRequired): RecordFundCashPaymentRecoveryRequiredParams =
      RecordFundCashPaymentRecoveryRequiredParams(command.txid)

    override def createFailureReply(param: RecordFundCashPaymentRecoveryRequiredParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordFundCashPaymentRecoveryRequiredParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordFundCashPaymentOutcomeUnknownHelper extends CommandHelper[RecordFundCashPaymentOutcomeUnknown, State, RecordFundCashPaymentOutcomeUnknownParams, Reply] {
    override def toParam(state: State, command: RecordFundCashPaymentOutcomeUnknown): RecordFundCashPaymentOutcomeUnknownParams =
      RecordFundCashPaymentOutcomeUnknownParams(command.txid)

    override def createFailureReply(param: RecordFundCashPaymentOutcomeUnknownParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordFundCashPaymentOutcomeUnknownParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RegisterFundTASubmissionHelper extends CommandHelper[RegisterFundTASubmission, State, RegisterFundTASubmissionParams, Reply] {
    override def toParam(state: State, command: RegisterFundTASubmission): RegisterFundTASubmissionParams =
      RegisterFundTASubmissionParams(command.fundOrderId, command.paymentTxId)

    override def createFailureReply(param: RegisterFundTASubmissionParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RegisterFundTASubmissionParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordFundTAAcceptedHelper extends CommandHelper[RecordFundTAAccepted, State, RecordFundTAAcceptedParams, Reply] {
    override def toParam(state: State, command: RecordFundTAAccepted): RecordFundTAAcceptedParams =
      RecordFundTAAcceptedParams(command.fundOrderId, command.paymentTxId, command.taRequestId, command.taReference, command.receiptId, command.receiptBody, command.fundCode, command.currency)

    override def createFailureReply(param: RecordFundTAAcceptedParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordFundTAAcceptedParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordFundTAConfirmedHelper extends CommandHelper[RecordFundTAConfirmed, State, RecordFundTAConfirmedParams, Reply] {
    override def toParam(state: State, command: RecordFundTAConfirmed): RecordFundTAConfirmedParams =
      RecordFundTAConfirmedParams(command.fundOrderId, command.paymentTxId, command.taRequestId, command.taReference, command.receiptId, command.receiptBody, command.fundCode, command.currency, command.shares)

    override def createFailureReply(param: RecordFundTAConfirmedParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordFundTAConfirmedParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordFundTARejectedHelper extends CommandHelper[RecordFundTARejected, State, RecordFundTARejectedParams, Reply] {
    override def toParam(state: State, command: RecordFundTARejected): RecordFundTARejectedParams =
      RecordFundTARejectedParams(command.fundOrderId, command.paymentTxId, command.taRequestId, command.taReference, command.receiptId, command.receiptBody, command.fundCode, command.currency, command.reason)

    override def createFailureReply(param: RecordFundTARejectedParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordFundTARejectedParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordFundTAUnknownHelper extends CommandHelper[RecordFundTAUnknown, State, RecordFundTAUnknownParams, Reply] {
    override def toParam(state: State, command: RecordFundTAUnknown): RecordFundTAUnknownParams =
      RecordFundTAUnknownParams(command.fundOrderId, command.paymentTxId, command.taRequestId, command.taReference, command.receiptId, command.receiptBody, command.fundCode, command.currency)

    override def createFailureReply(param: RecordFundTAUnknownParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordFundTAUnknownParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RequestFundPurchaseRefundHelper extends CommandHelper[RequestFundPurchaseRefund, State, RequestFundPurchaseRefundParams, Reply] {
    override def toParam(state: State, command: RequestFundPurchaseRefund): RequestFundPurchaseRefundParams =
      RequestFundPurchaseRefundParams(command.fundOrderId, command.paymentTxId)

    override def createFailureReply(param: RequestFundPurchaseRefundParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RequestFundPurchaseRefundParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordFundRefundSucceededHelper extends CommandHelper[RecordFundRefundSucceeded, State, RecordFundRefundSucceededParams, Reply] {
    override def toParam(state: State, command: RecordFundRefundSucceeded): RecordFundRefundSucceededParams =
      RecordFundRefundSucceededParams(command.refundTxId, command.refundOperationId, command.receiptId, command.receiptBody)

    override def createFailureReply(param: RecordFundRefundSucceededParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordFundRefundSucceededParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordFundRefundRejectedBeforeEffectsHelper extends CommandHelper[RecordFundRefundRejectedBeforeEffects, State, RecordFundRefundRejectedBeforeEffectsParams, Reply] {
    override def toParam(state: State, command: RecordFundRefundRejectedBeforeEffects): RecordFundRefundRejectedBeforeEffectsParams =
      RecordFundRefundRejectedBeforeEffectsParams(command.refundTxId, command.refundOperationId, command.receiptId, command.receiptBody)

    override def createFailureReply(param: RecordFundRefundRejectedBeforeEffectsParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordFundRefundRejectedBeforeEffectsParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordFundRefundCompensatedHelper extends CommandHelper[RecordFundRefundCompensated, State, RecordFundRefundCompensatedParams, Reply] {
    override def toParam(state: State, command: RecordFundRefundCompensated): RecordFundRefundCompensatedParams =
      RecordFundRefundCompensatedParams(command.refundTxId, command.refundOperationId, command.receiptId, command.receiptBody)

    override def createFailureReply(param: RecordFundRefundCompensatedParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordFundRefundCompensatedParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordFundRefundRecoveryRequiredHelper extends CommandHelper[RecordFundRefundRecoveryRequired, State, RecordFundRefundRecoveryRequiredParams, Reply] {
    override def toParam(state: State, command: RecordFundRefundRecoveryRequired): RecordFundRefundRecoveryRequiredParams =
      RecordFundRefundRecoveryRequiredParams(command.refundTxId, command.refundOperationId, command.receiptId, command.receiptBody)

    override def createFailureReply(param: RecordFundRefundRecoveryRequiredParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordFundRefundRecoveryRequiredParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordFundRefundOutcomeUnknownHelper extends CommandHelper[RecordFundRefundOutcomeUnknown, State, RecordFundRefundOutcomeUnknownParams, Reply] {
    override def toParam(state: State, command: RecordFundRefundOutcomeUnknown): RecordFundRefundOutcomeUnknownParams =
      RecordFundRefundOutcomeUnknownParams(command.refundTxId, command.refundOperationId, command.receiptId, command.receiptBody)

    override def createFailureReply(param: RecordFundRefundOutcomeUnknownParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordFundRefundOutcomeUnknownParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordCashRequestSourceHelper extends CommandHelper[RecordCashRequestSource, State, RecordCashRequestSourceParams, Reply] {
    override def toParam(state: State, command: RecordCashRequestSource): RecordCashRequestSourceParams =
      RecordCashRequestSourceParams(command.original, command.source)

    override def createFailureReply(param: RecordCashRequestSourceParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordCashRequestSourceParams)(state: State): Reply =
      Accepted(Vector.empty)
  }
}
