package example.bankwealth.domain

import akka.actor.typed.{ActorRef, Behavior}
import FundOrderProtocol._

object FundOrderAggregate {
  sealed trait Request
  final case class Execute(command: Command, replyTo: ActorRef[Reply]) extends Request
  final case class GetState(replyTo: ActorRef[FundOrderState]) extends Request
  sealed trait Reply
  final case class Accepted(events: Vector[Event]) extends Reply
  final case class Refused(code: String) extends Reply
  final case class IngestBankPaymentResultCompensated(output: example.bankwealth.domain.values.BankPaymentResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankPaymentResultOutcomeUnknown(output: example.bankwealth.domain.values.BankPaymentResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankPaymentResultRecoveryRequired(output: example.bankwealth.domain.values.BankPaymentResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankPaymentResultRejectedBeforeEffects(output: example.bankwealth.domain.values.BankPaymentResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankPaymentResultSucceeded(output: example.bankwealth.domain.values.BankPaymentResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankRefundResultCompensated(output: example.bankwealth.domain.values.BankRefundResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankRefundResultOutcomeUnknown(output: example.bankwealth.domain.values.BankRefundResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankRefundResultRecoveryRequired(output: example.bankwealth.domain.values.BankRefundResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankRefundResultRejectedBeforeEffects(output: example.bankwealth.domain.values.BankRefundResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankRefundResultSucceeded(output: example.bankwealth.domain.values.BankRefundResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankTaReceiptObservation(output: example.bankwealth.domain.values.TaReceipt, authorization: String, replyTo: ActorRef[Reply]) extends Request
  trait ExternalAuthority { def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean }
  def apply(persistenceId: String, initial: FundOrderState, hosts: FundOrderComputations, authority: ExternalAuthority): Behavior[Request] =
    example.bankwealth.infrastructure.bootstrap.FundOrderBootstrap.create(persistenceId, initial, hosts, authority)
}
object FundOrderAggregateFactory {
  def create(persistenceId: String, initial: FundOrderState, hosts: FundOrderComputations, authority: FundOrderAggregate.ExternalAuthority): Behavior[FundOrderAggregate.Request] = FundOrderAggregate(persistenceId, initial, hosts, authority)
}
