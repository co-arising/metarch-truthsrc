package example.bankwealth.application.aggregates.behaviors

import example.bankwealth.application.aggregates.CreditBalanceProtocol._
import example.bankwealth.domain.entities.CreditBalanceEntity.State
import example.bankwealth.domain.invariants.params.CreditBalanceRuleParams._
import net.imadz.common.CommonTypes.iMadzError
import net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper

trait CreditBalanceCommandHelpers {

  implicit object InitializeAccountHelper extends CommandHelper[InitializeAccount, State, InitializeAccountParams, Reply] {
    override def toParam(state: State, command: InitializeAccount): InitializeAccountParams =
      InitializeAccountParams(command.resource, command.currency, command.amount)

    override def createFailureReply(param: InitializeAccountParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: InitializeAccountParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object ReserveFundsHelper extends CommandHelper[ReserveFunds, State, ReserveFundsParams, Reply] {
    override def toParam(state: State, command: ReserveFunds): ReserveFundsParams =
      ReserveFundsParams(command.txid, command.resource, command.amount)

    override def createFailureReply(param: ReserveFundsParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: ReserveFundsParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object DeductFundsHelper extends CommandHelper[DeductFunds, State, DeductFundsParams, Reply] {
    override def toParam(state: State, command: DeductFunds): DeductFundsParams =
      DeductFundsParams(command.txid, command.resource, command.amount)

    override def createFailureReply(param: DeductFundsParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: DeductFundsParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object ReleaseReservedFundsHelper extends CommandHelper[ReleaseReservedFunds, State, ReleaseReservedFundsParams, Reply] {
    override def toParam(state: State, command: ReleaseReservedFunds): ReleaseReservedFundsParams =
      ReleaseReservedFundsParams(command.txid, command.resource, command.amount)

    override def createFailureReply(param: ReleaseReservedFundsParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: ReleaseReservedFundsParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordIncomingCreditsHelper extends CommandHelper[RecordIncomingCredits, State, RecordIncomingCreditsParams, Reply] {
    override def toParam(state: State, command: RecordIncomingCredits): RecordIncomingCreditsParams =
      RecordIncomingCreditsParams(command.txid, command.resource, command.amount)

    override def createFailureReply(param: RecordIncomingCreditsParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordIncomingCreditsParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object CommitIncomingCreditsHelper extends CommandHelper[CommitIncomingCredits, State, CommitIncomingCreditsParams, Reply] {
    override def toParam(state: State, command: CommitIncomingCredits): CommitIncomingCreditsParams =
      CommitIncomingCreditsParams(command.txid, command.resource, command.amount)

    override def createFailureReply(param: CommitIncomingCreditsParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: CommitIncomingCreditsParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object CancelIncomingCreditHelper extends CommandHelper[CancelIncomingCredit, State, CancelIncomingCreditParams, Reply] {
    override def toParam(state: State, command: CancelIncomingCredit): CancelIncomingCreditParams =
      CancelIncomingCreditParams(command.txid, command.resource, command.amount)

    override def createFailureReply(param: CancelIncomingCreditParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: CancelIncomingCreditParams)(state: State): Reply =
      Accepted(Vector.empty)
  }
}
