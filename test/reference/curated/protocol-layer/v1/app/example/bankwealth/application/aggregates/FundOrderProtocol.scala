package example.bankwealth.application.aggregates

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.domain.entities.FundOrderEntity.{Event, State}

object FundOrderProtocol {

  type Command = example.bankwealth.domain.FundOrderAggregate.Request
  type Reply = example.bankwealth.domain.FundOrderAggregate.Reply
  type CommandPayload = example.bankwealth.domain.FundOrderProtocol.Command
  type CommandHandler = (State, Command) => Effect[Event, State]

  type Execute = example.bankwealth.domain.FundOrderAggregate.Execute
  val Execute: example.bankwealth.domain.FundOrderAggregate.Execute.type =
    example.bankwealth.domain.FundOrderAggregate.Execute

  type GetState = example.bankwealth.domain.FundOrderAggregate.GetState
  val GetState: example.bankwealth.domain.FundOrderAggregate.GetState.type =
    example.bankwealth.domain.FundOrderAggregate.GetState

  type Accepted = example.bankwealth.domain.FundOrderAggregate.Accepted
  val Accepted: example.bankwealth.domain.FundOrderAggregate.Accepted.type =
    example.bankwealth.domain.FundOrderAggregate.Accepted

  type Refused = example.bankwealth.domain.FundOrderAggregate.Refused
  val Refused: example.bankwealth.domain.FundOrderAggregate.Refused.type =
    example.bankwealth.domain.FundOrderAggregate.Refused

  type IngestBankPaymentResultCompensated = example.bankwealth.domain.FundOrderAggregate.IngestBankPaymentResultCompensated
  val IngestBankPaymentResultCompensated: example.bankwealth.domain.FundOrderAggregate.IngestBankPaymentResultCompensated.type =
    example.bankwealth.domain.FundOrderAggregate.IngestBankPaymentResultCompensated

  type IngestBankPaymentResultOutcomeUnknown = example.bankwealth.domain.FundOrderAggregate.IngestBankPaymentResultOutcomeUnknown
  val IngestBankPaymentResultOutcomeUnknown: example.bankwealth.domain.FundOrderAggregate.IngestBankPaymentResultOutcomeUnknown.type =
    example.bankwealth.domain.FundOrderAggregate.IngestBankPaymentResultOutcomeUnknown

  type IngestBankPaymentResultRecoveryRequired = example.bankwealth.domain.FundOrderAggregate.IngestBankPaymentResultRecoveryRequired
  val IngestBankPaymentResultRecoveryRequired: example.bankwealth.domain.FundOrderAggregate.IngestBankPaymentResultRecoveryRequired.type =
    example.bankwealth.domain.FundOrderAggregate.IngestBankPaymentResultRecoveryRequired

  type IngestBankPaymentResultRejectedBeforeEffects = example.bankwealth.domain.FundOrderAggregate.IngestBankPaymentResultRejectedBeforeEffects
  val IngestBankPaymentResultRejectedBeforeEffects: example.bankwealth.domain.FundOrderAggregate.IngestBankPaymentResultRejectedBeforeEffects.type =
    example.bankwealth.domain.FundOrderAggregate.IngestBankPaymentResultRejectedBeforeEffects

  type IngestBankPaymentResultSucceeded = example.bankwealth.domain.FundOrderAggregate.IngestBankPaymentResultSucceeded
  val IngestBankPaymentResultSucceeded: example.bankwealth.domain.FundOrderAggregate.IngestBankPaymentResultSucceeded.type =
    example.bankwealth.domain.FundOrderAggregate.IngestBankPaymentResultSucceeded

  type IngestBankRefundResultCompensated = example.bankwealth.domain.FundOrderAggregate.IngestBankRefundResultCompensated
  val IngestBankRefundResultCompensated: example.bankwealth.domain.FundOrderAggregate.IngestBankRefundResultCompensated.type =
    example.bankwealth.domain.FundOrderAggregate.IngestBankRefundResultCompensated

  type IngestBankRefundResultOutcomeUnknown = example.bankwealth.domain.FundOrderAggregate.IngestBankRefundResultOutcomeUnknown
  val IngestBankRefundResultOutcomeUnknown: example.bankwealth.domain.FundOrderAggregate.IngestBankRefundResultOutcomeUnknown.type =
    example.bankwealth.domain.FundOrderAggregate.IngestBankRefundResultOutcomeUnknown

  type IngestBankRefundResultRecoveryRequired = example.bankwealth.domain.FundOrderAggregate.IngestBankRefundResultRecoveryRequired
  val IngestBankRefundResultRecoveryRequired: example.bankwealth.domain.FundOrderAggregate.IngestBankRefundResultRecoveryRequired.type =
    example.bankwealth.domain.FundOrderAggregate.IngestBankRefundResultRecoveryRequired

  type IngestBankRefundResultRejectedBeforeEffects = example.bankwealth.domain.FundOrderAggregate.IngestBankRefundResultRejectedBeforeEffects
  val IngestBankRefundResultRejectedBeforeEffects: example.bankwealth.domain.FundOrderAggregate.IngestBankRefundResultRejectedBeforeEffects.type =
    example.bankwealth.domain.FundOrderAggregate.IngestBankRefundResultRejectedBeforeEffects

  type IngestBankRefundResultSucceeded = example.bankwealth.domain.FundOrderAggregate.IngestBankRefundResultSucceeded
  val IngestBankRefundResultSucceeded: example.bankwealth.domain.FundOrderAggregate.IngestBankRefundResultSucceeded.type =
    example.bankwealth.domain.FundOrderAggregate.IngestBankRefundResultSucceeded

  type IngestBankTaReceiptObservation = example.bankwealth.domain.FundOrderAggregate.IngestBankTaReceiptObservation
  val IngestBankTaReceiptObservation: example.bankwealth.domain.FundOrderAggregate.IngestBankTaReceiptObservation.type =
    example.bankwealth.domain.FundOrderAggregate.IngestBankTaReceiptObservation

  type ExternalAuthority = example.bankwealth.domain.FundOrderAggregate.ExternalAuthority
}
