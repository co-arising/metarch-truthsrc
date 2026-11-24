package example.bankwealth.application.aggregates

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.domain.entities.FundOrderEntity.{Event, State}
import example.bankwealth.domain.events.FundOrderEvents

object FundOrderProtocol {

  type Command = FundOrderAggregate.Request
  type Reply = FundOrderAggregate.Reply
  type CommandPayload = FundOrderEvents.Command
  type CommandHandler = (State, Command) => Effect[Event, State]

  type Execute = FundOrderAggregate.Execute
  val Execute: FundOrderAggregate.Execute.type =
    FundOrderAggregate.Execute

  type GetState = FundOrderAggregate.GetState
  val GetState: FundOrderAggregate.GetState.type =
    FundOrderAggregate.GetState

  type Accepted = FundOrderAggregate.Accepted
  val Accepted: FundOrderAggregate.Accepted.type =
    FundOrderAggregate.Accepted

  type Refused = FundOrderAggregate.Refused
  val Refused: FundOrderAggregate.Refused.type =
    FundOrderAggregate.Refused

  type IngestBankPaymentResultCompensated = FundOrderAggregate.IngestBankPaymentResultCompensated
  val IngestBankPaymentResultCompensated: FundOrderAggregate.IngestBankPaymentResultCompensated.type =
    FundOrderAggregate.IngestBankPaymentResultCompensated

  type IngestBankPaymentResultOutcomeUnknown = FundOrderAggregate.IngestBankPaymentResultOutcomeUnknown
  val IngestBankPaymentResultOutcomeUnknown: FundOrderAggregate.IngestBankPaymentResultOutcomeUnknown.type =
    FundOrderAggregate.IngestBankPaymentResultOutcomeUnknown

  type IngestBankPaymentResultRecoveryRequired = FundOrderAggregate.IngestBankPaymentResultRecoveryRequired
  val IngestBankPaymentResultRecoveryRequired: FundOrderAggregate.IngestBankPaymentResultRecoveryRequired.type =
    FundOrderAggregate.IngestBankPaymentResultRecoveryRequired

  type IngestBankPaymentResultRejectedBeforeEffects = FundOrderAggregate.IngestBankPaymentResultRejectedBeforeEffects
  val IngestBankPaymentResultRejectedBeforeEffects: FundOrderAggregate.IngestBankPaymentResultRejectedBeforeEffects.type =
    FundOrderAggregate.IngestBankPaymentResultRejectedBeforeEffects

  type IngestBankPaymentResultSucceeded = FundOrderAggregate.IngestBankPaymentResultSucceeded
  val IngestBankPaymentResultSucceeded: FundOrderAggregate.IngestBankPaymentResultSucceeded.type =
    FundOrderAggregate.IngestBankPaymentResultSucceeded

  type IngestBankRefundResultCompensated = FundOrderAggregate.IngestBankRefundResultCompensated
  val IngestBankRefundResultCompensated: FundOrderAggregate.IngestBankRefundResultCompensated.type =
    FundOrderAggregate.IngestBankRefundResultCompensated

  type IngestBankRefundResultOutcomeUnknown = FundOrderAggregate.IngestBankRefundResultOutcomeUnknown
  val IngestBankRefundResultOutcomeUnknown: FundOrderAggregate.IngestBankRefundResultOutcomeUnknown.type =
    FundOrderAggregate.IngestBankRefundResultOutcomeUnknown

  type IngestBankRefundResultRecoveryRequired = FundOrderAggregate.IngestBankRefundResultRecoveryRequired
  val IngestBankRefundResultRecoveryRequired: FundOrderAggregate.IngestBankRefundResultRecoveryRequired.type =
    FundOrderAggregate.IngestBankRefundResultRecoveryRequired

  type IngestBankRefundResultRejectedBeforeEffects = FundOrderAggregate.IngestBankRefundResultRejectedBeforeEffects
  val IngestBankRefundResultRejectedBeforeEffects: FundOrderAggregate.IngestBankRefundResultRejectedBeforeEffects.type =
    FundOrderAggregate.IngestBankRefundResultRejectedBeforeEffects

  type IngestBankRefundResultSucceeded = FundOrderAggregate.IngestBankRefundResultSucceeded
  val IngestBankRefundResultSucceeded: FundOrderAggregate.IngestBankRefundResultSucceeded.type =
    FundOrderAggregate.IngestBankRefundResultSucceeded

  type IngestBankTaReceiptObservation = FundOrderAggregate.IngestBankTaReceiptObservation
  val IngestBankTaReceiptObservation: FundOrderAggregate.IngestBankTaReceiptObservation.type =
    FundOrderAggregate.IngestBankTaReceiptObservation

  type ExternalAuthority = FundOrderAggregate.ExternalAuthority
}
