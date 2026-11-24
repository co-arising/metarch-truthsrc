package example.bankwealth.application.aggregates

import akka.actor.typed.{ActorRef, Behavior}
import example.bankwealth.application.aggregates.FundOrderProtocol.CommandHandler
import example.bankwealth.domain.entities.FundOrderEntity.{Event, State}
import example.bankwealth.domain.events.FundOrderEvents
import example.bankwealth.domain.services.FundOrderComputations

object FundOrderAggregate {
  sealed trait Request
  final case class Execute(command: FundOrderEvents.Command, replyTo: ActorRef[Reply]) extends Request
  final case class GetState(replyTo: ActorRef[State]) extends Request
  sealed trait Reply
  final case class Accepted(events: Vector[Event]) extends Reply
  final case class Refused(code: String) extends Reply
  final case class IngestBankPaymentResultCompensated(output: example.bankwealth.application.saga.BankPaymentResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankPaymentResultOutcomeUnknown(output: example.bankwealth.application.saga.BankPaymentResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankPaymentResultRecoveryRequired(output: example.bankwealth.application.saga.BankPaymentResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankPaymentResultRejectedBeforeEffects(output: example.bankwealth.application.saga.BankPaymentResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankPaymentResultSucceeded(output: example.bankwealth.application.saga.BankPaymentResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankRefundResultCompensated(output: example.bankwealth.application.saga.BankRefundResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankRefundResultOutcomeUnknown(output: example.bankwealth.application.saga.BankRefundResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankRefundResultRecoveryRequired(output: example.bankwealth.application.saga.BankRefundResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankRefundResultRejectedBeforeEffects(output: example.bankwealth.application.saga.BankRefundResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankRefundResultSucceeded(output: example.bankwealth.application.saga.BankRefundResult, authorization: String, replyTo: ActorRef[Reply]) extends Request
  final case class IngestBankTaReceiptObservation(output: example.bankwealth.domain.values.TaReceipt, authorization: String, replyTo: ActorRef[Reply]) extends Request
  trait ExternalAuthority { def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean }

  def commandHandler(hosts: FundOrderComputations, authority: ExternalAuthority): CommandHandler =
    behaviors.FundOrderBehaviors(hosts, authority)

  def apply(persistenceId: String, initial: State, hosts: FundOrderComputations, authority: ExternalAuthority): Behavior[Request] =
    example.bankwealth.infrastructure.bootstrap.FundOrderBootstrap.create(persistenceId, initial, hosts, authority)
}
