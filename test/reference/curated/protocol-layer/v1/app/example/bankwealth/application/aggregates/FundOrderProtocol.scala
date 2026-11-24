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

  type Ingestbank_payment_result_compensated = example.bankwealth.domain.FundOrderAggregate.Ingestbank_payment_result_compensated
  val Ingestbank_payment_result_compensated: example.bankwealth.domain.FundOrderAggregate.Ingestbank_payment_result_compensated.type =
    example.bankwealth.domain.FundOrderAggregate.Ingestbank_payment_result_compensated

  type Ingestbank_payment_result_outcome_unknown = example.bankwealth.domain.FundOrderAggregate.Ingestbank_payment_result_outcome_unknown
  val Ingestbank_payment_result_outcome_unknown: example.bankwealth.domain.FundOrderAggregate.Ingestbank_payment_result_outcome_unknown.type =
    example.bankwealth.domain.FundOrderAggregate.Ingestbank_payment_result_outcome_unknown

  type Ingestbank_payment_result_recovery_required = example.bankwealth.domain.FundOrderAggregate.Ingestbank_payment_result_recovery_required
  val Ingestbank_payment_result_recovery_required: example.bankwealth.domain.FundOrderAggregate.Ingestbank_payment_result_recovery_required.type =
    example.bankwealth.domain.FundOrderAggregate.Ingestbank_payment_result_recovery_required

  type Ingestbank_payment_result_rejected_before_effects = example.bankwealth.domain.FundOrderAggregate.Ingestbank_payment_result_rejected_before_effects
  val Ingestbank_payment_result_rejected_before_effects: example.bankwealth.domain.FundOrderAggregate.Ingestbank_payment_result_rejected_before_effects.type =
    example.bankwealth.domain.FundOrderAggregate.Ingestbank_payment_result_rejected_before_effects

  type Ingestbank_payment_result_succeeded = example.bankwealth.domain.FundOrderAggregate.Ingestbank_payment_result_succeeded
  val Ingestbank_payment_result_succeeded: example.bankwealth.domain.FundOrderAggregate.Ingestbank_payment_result_succeeded.type =
    example.bankwealth.domain.FundOrderAggregate.Ingestbank_payment_result_succeeded

  type Ingestbank_refund_result_compensated = example.bankwealth.domain.FundOrderAggregate.Ingestbank_refund_result_compensated
  val Ingestbank_refund_result_compensated: example.bankwealth.domain.FundOrderAggregate.Ingestbank_refund_result_compensated.type =
    example.bankwealth.domain.FundOrderAggregate.Ingestbank_refund_result_compensated

  type Ingestbank_refund_result_outcome_unknown = example.bankwealth.domain.FundOrderAggregate.Ingestbank_refund_result_outcome_unknown
  val Ingestbank_refund_result_outcome_unknown: example.bankwealth.domain.FundOrderAggregate.Ingestbank_refund_result_outcome_unknown.type =
    example.bankwealth.domain.FundOrderAggregate.Ingestbank_refund_result_outcome_unknown

  type Ingestbank_refund_result_recovery_required = example.bankwealth.domain.FundOrderAggregate.Ingestbank_refund_result_recovery_required
  val Ingestbank_refund_result_recovery_required: example.bankwealth.domain.FundOrderAggregate.Ingestbank_refund_result_recovery_required.type =
    example.bankwealth.domain.FundOrderAggregate.Ingestbank_refund_result_recovery_required

  type Ingestbank_refund_result_rejected_before_effects = example.bankwealth.domain.FundOrderAggregate.Ingestbank_refund_result_rejected_before_effects
  val Ingestbank_refund_result_rejected_before_effects: example.bankwealth.domain.FundOrderAggregate.Ingestbank_refund_result_rejected_before_effects.type =
    example.bankwealth.domain.FundOrderAggregate.Ingestbank_refund_result_rejected_before_effects

  type Ingestbank_refund_result_succeeded = example.bankwealth.domain.FundOrderAggregate.Ingestbank_refund_result_succeeded
  val Ingestbank_refund_result_succeeded: example.bankwealth.domain.FundOrderAggregate.Ingestbank_refund_result_succeeded.type =
    example.bankwealth.domain.FundOrderAggregate.Ingestbank_refund_result_succeeded

  type Ingestbank_ta_receipt_observation = example.bankwealth.domain.FundOrderAggregate.Ingestbank_ta_receipt_observation
  val Ingestbank_ta_receipt_observation: example.bankwealth.domain.FundOrderAggregate.Ingestbank_ta_receipt_observation.type =
    example.bankwealth.domain.FundOrderAggregate.Ingestbank_ta_receipt_observation

  type ExternalAuthority = example.bankwealth.domain.FundOrderAggregate.ExternalAuthority
}
