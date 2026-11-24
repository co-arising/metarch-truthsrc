package example.bankwealth.application.aggregates

import akka.actor.typed.ActorRef
import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.domain.entities.FundOrderEntity.{Event, State}
import example.bankwealth.application.saga._
import example.bankwealth.domain.values._

object FundOrderProtocol {

  sealed trait Command
  final case class RequestFundPurchaseSettlement(
    operationId: OperationId,
    fundOrderId: FundOrderId,
    investorAccountId: AccountId,
    fundCollectionAccountId: AccountId,
    fundCode: String,
    amount: Money,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class ReserveFundSubscription(
    txid: TxId,
    resource: FundOrderId,
    amount: Money,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class ConfirmFundSubscriptionPayment(
    txid: TxId,
    resource: FundOrderId,
    amount: Money,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class CancelCashFundSubscription(
    txid: TxId,
    resource: FundOrderId,
    amount: Money,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordFundCashPaymentSucceeded(txid: TxId, replyTo: ActorRef[Reply]) extends Command
  final case class RecordFundCashPaymentRejectedBeforeEffects(
    txid: TxId,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordFundCashPaymentCompensated(txid: TxId, replyTo: ActorRef[Reply]) extends Command
  final case class RecordFundCashPaymentRecoveryRequired(txid: TxId, replyTo: ActorRef[Reply]) extends Command
  final case class RecordFundCashPaymentOutcomeUnknown(txid: TxId, replyTo: ActorRef[Reply]) extends Command
  final case class RegisterFundTASubmission(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordFundTAAccepted(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordFundTAConfirmed(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String,
    shares: FundShare,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordFundTARejected(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String,
    reason: String,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordFundTAUnknown(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RequestFundPurchaseRefund(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordFundRefundSucceeded(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordFundRefundRejectedBeforeEffects(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordFundRefundCompensated(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordFundRefundRecoveryRequired(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordFundRefundOutcomeUnknown(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordCashRequestSource(
    original: BankCashOriginal,
    source: Option[BankCashOriginal],
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class GetState(replyTo: ActorRef[State]) extends Command
  final case class IngestBankPaymentResultCompensated(output: BankPaymentResult, authorization: String, replyTo: ActorRef[Reply]) extends Command
  final case class IngestBankPaymentResultOutcomeUnknown(output: BankPaymentResult, authorization: String, replyTo: ActorRef[Reply]) extends Command
  final case class IngestBankPaymentResultRecoveryRequired(output: BankPaymentResult, authorization: String, replyTo: ActorRef[Reply]) extends Command
  final case class IngestBankPaymentResultRejectedBeforeEffects(output: BankPaymentResult, authorization: String, replyTo: ActorRef[Reply]) extends Command
  final case class IngestBankPaymentResultSucceeded(output: BankPaymentResult, authorization: String, replyTo: ActorRef[Reply]) extends Command
  final case class IngestBankRefundResultCompensated(output: BankRefundResult, authorization: String, replyTo: ActorRef[Reply]) extends Command
  final case class IngestBankRefundResultOutcomeUnknown(output: BankRefundResult, authorization: String, replyTo: ActorRef[Reply]) extends Command
  final case class IngestBankRefundResultRecoveryRequired(output: BankRefundResult, authorization: String, replyTo: ActorRef[Reply]) extends Command
  final case class IngestBankRefundResultRejectedBeforeEffects(output: BankRefundResult, authorization: String, replyTo: ActorRef[Reply]) extends Command
  final case class IngestBankRefundResultSucceeded(output: BankRefundResult, authorization: String, replyTo: ActorRef[Reply]) extends Command
  final case class IngestBankTaReceiptObservation(output: TaReceipt, authorization: String, replyTo: ActorRef[Reply]) extends Command

  sealed trait Reply
  final case class Accepted(events: Vector[Event]) extends Reply
  final case class Refused(code: String) extends Reply

  trait ExternalAuthority {
    def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean
  }

  type CommandHandler = (State, Command) => Effect[Event, State]
}
