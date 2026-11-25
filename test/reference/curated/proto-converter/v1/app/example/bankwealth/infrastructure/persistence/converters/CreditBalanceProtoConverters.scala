package example.bankwealth.infrastructure.persistence.converters

import example.bankwealth.domain.entities._
import example.bankwealth.application.connectors.BankSipDispatchProtocol._
import example.bankwealth.application.connectors.BankTaEffectProtocol._
import example.bankwealth.application.process.BankPaymentMessages._
import example.bankwealth.application.process.BankRefundMessages._
import example.bankwealth.application.process.CreditFundCollectionStep._
import example.bankwealth.application.process.CreditOriginalInvestorStep._
import example.bankwealth.application.process.DebitFundCollectionStep._
import example.bankwealth.application.process.ReserveCashFundOrderStep._
import example.bankwealth.application.process.ReserveInvestorFundsStep._
import example.bankwealth.application.projection._
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.persistence._
import example.bankwealth.interfaces.api.ApiAcknowledgements._
import example.bankwealth.interfaces.api.ApiCommands._
import example.bankwealth.interfaces.api.ApiKeys._
import example.bankwealth.interfaces.api.ApiResponses._
import example.bankwealth.interfaces.api.ApiWire._
import example.bankwealth.infrastructure.{proto => pb}
import net.imadz.common.serialization.PrimitiveConverter
trait CreditBalanceProtoConverters extends PrimitiveConverter with SharedValueProtoConverters {
  def encodeCreditBalanceStatePO(value: CreditBalanceEntity.State): pb.CreditBalanceStatePO = pb.CreditBalanceStatePO(
    id = Some(encodeAccountIdPO(value.id)),
    initialized = value.initialized,
    accountBalance = value.accountBalance.map { case (k, v) => k -> encodeMoneyPO(v) },
    reservedAmount = value.reservedAmount.map { case (k, v) => k.value -> encodeMoneyPO(v) },
    incomingCredits = value.incomingCredits.map { case (k, v) => k.value -> encodeMoneyPO(v) },
    committedOutgoing = value.committedOutgoing.map { case (k, v) => k.value -> encodeMoneyPO(v) },
    committedIncoming = value.committedIncoming.map { case (k, v) => k.value -> encodeMoneyPO(v) },
    compensatedOutgoing = value.compensatedOutgoing.map { case (k, v) => k.value -> encodeMoneyPO(v) },
    compensatedIncoming = value.compensatedIncoming.map { case (k, v) => k.value -> encodeMoneyPO(v) }
  )
  def decodeCreditBalanceStatePO(value: pb.CreditBalanceStatePO): CreditBalanceEntity.State = CreditBalanceEntity.State(
    id = decodeAccountIdPO(req(value.id)),
    initialized = value.initialized,
    accountBalance = value.accountBalance.map { case (k, v) => k -> decodeMoneyPO(v) },
    reservedAmount = value.reservedAmount.map { case (k, v) => TxId(k) -> decodeMoneyPO(v) },
    incomingCredits = value.incomingCredits.map { case (k, v) => TxId(k) -> decodeMoneyPO(v) },
    committedOutgoing = value.committedOutgoing.map { case (k, v) => TxId(k) -> decodeMoneyPO(v) },
    committedIncoming = value.committedIncoming.map { case (k, v) => TxId(k) -> decodeMoneyPO(v) },
    compensatedOutgoing = value.compensatedOutgoing.map { case (k, v) => TxId(k) -> decodeMoneyPO(v) },
    compensatedIncoming = value.compensatedIncoming.map { case (k, v) => TxId(k) -> decodeMoneyPO(v) }
  )
  def encodeAccountInitializedPO(value: CreditBalanceEntity.AccountInitialized): pb.AccountInitializedPO = pb.AccountInitializedPO(resource = Some(encodeAccountIdPO(value.resource)), currency = value.currency, amount = Some(encodeMoneyPO(value.amount)))
  def decodeAccountInitializedPO(value: pb.AccountInitializedPO): CreditBalanceEntity.AccountInitialized = CreditBalanceEntity.AccountInitialized(resource = decodeAccountIdPO(req(value.resource)), currency = value.currency, amount = decodeMoneyPO(req(value.amount)))
  def encodeReserveFundsConfirmedPO(value: CreditBalanceEntity.ReserveFundsConfirmed): pb.ReserveFundsConfirmedPO = pb.ReserveFundsConfirmedPO(
    txid = Some(encodeTxIdPO(value.txid)),
    resource = Some(encodeAccountIdPO(value.resource)),
    amount = Some(encodeMoneyPO(value.amount)),
    currency = value.currency,
    available = Some(encodeMoneyPO(value.available))
  )
  def decodeReserveFundsConfirmedPO(value: pb.ReserveFundsConfirmedPO): CreditBalanceEntity.ReserveFundsConfirmed = CreditBalanceEntity.ReserveFundsConfirmed(
    txid = decodeTxIdPO(req(value.txid)),
    resource = decodeAccountIdPO(req(value.resource)),
    amount = decodeMoneyPO(req(value.amount)),
    currency = value.currency,
    available = decodeMoneyPO(req(value.available))
  )
  def encodeDeductFundsConfirmedPO(value: CreditBalanceEntity.DeductFundsConfirmed): pb.DeductFundsConfirmedPO = pb.DeductFundsConfirmedPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeDeductFundsConfirmedPO(value: pb.DeductFundsConfirmedPO): CreditBalanceEntity.DeductFundsConfirmed = CreditBalanceEntity.DeductFundsConfirmed(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))
  def encodeReleaseReservedFundsConfirmedPO(value: CreditBalanceEntity.ReleaseReservedFundsConfirmed): pb.ReleaseReservedFundsConfirmedPO = pb.ReleaseReservedFundsConfirmedPO(
    txid = Some(encodeTxIdPO(value.txid)),
    resource = Some(encodeAccountIdPO(value.resource)),
    amount = Some(encodeMoneyPO(value.amount)),
    currency = value.currency,
    available = Some(encodeMoneyPO(value.available))
  )
  def decodeReleaseReservedFundsConfirmedPO(value: pb.ReleaseReservedFundsConfirmedPO): CreditBalanceEntity.ReleaseReservedFundsConfirmed = CreditBalanceEntity.ReleaseReservedFundsConfirmed(
    txid = decodeTxIdPO(req(value.txid)),
    resource = decodeAccountIdPO(req(value.resource)),
    amount = decodeMoneyPO(req(value.amount)),
    currency = value.currency,
    available = decodeMoneyPO(req(value.available))
  )
  def encodeRecordIncomingCreditsConfirmedPO(value: CreditBalanceEntity.RecordIncomingCreditsConfirmed): pb.RecordIncomingCreditsConfirmedPO = pb.RecordIncomingCreditsConfirmedPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeRecordIncomingCreditsConfirmedPO(value: pb.RecordIncomingCreditsConfirmedPO): CreditBalanceEntity.RecordIncomingCreditsConfirmed = CreditBalanceEntity.RecordIncomingCreditsConfirmed(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))
  def encodeCommitIncomingCreditsConfirmedPO(value: CreditBalanceEntity.CommitIncomingCreditsConfirmed): pb.CommitIncomingCreditsConfirmedPO = pb.CommitIncomingCreditsConfirmedPO(
    txid = Some(encodeTxIdPO(value.txid)),
    resource = Some(encodeAccountIdPO(value.resource)),
    amount = Some(encodeMoneyPO(value.amount)),
    currency = value.currency,
    available = Some(encodeMoneyPO(value.available))
  )
  def decodeCommitIncomingCreditsConfirmedPO(value: pb.CommitIncomingCreditsConfirmedPO): CreditBalanceEntity.CommitIncomingCreditsConfirmed = CreditBalanceEntity.CommitIncomingCreditsConfirmed(
    txid = decodeTxIdPO(req(value.txid)),
    resource = decodeAccountIdPO(req(value.resource)),
    amount = decodeMoneyPO(req(value.amount)),
    currency = value.currency,
    available = decodeMoneyPO(req(value.available))
  )
  def encodeCancelIncomingCreditConfirmedPO(value: CreditBalanceEntity.CancelIncomingCreditConfirmed): pb.CancelIncomingCreditConfirmedPO = pb.CancelIncomingCreditConfirmedPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeCancelIncomingCreditConfirmedPO(value: pb.CancelIncomingCreditConfirmedPO): CreditBalanceEntity.CancelIncomingCreditConfirmed = CreditBalanceEntity.CancelIncomingCreditConfirmed(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))
  def encodeCreditBalanceEventPO(value: CreditBalanceEntity.Event): pb.CreditBalanceEventPO = value match {
    case e: CreditBalanceEntity.AccountInitialized => pb.CreditBalanceEventPO(pb.CreditBalanceEventPO.Event.AccountInitialized(encodeAccountInitializedPO(e)))
    case e: CreditBalanceEntity.ReserveFundsConfirmed => pb.CreditBalanceEventPO(pb.CreditBalanceEventPO.Event.ReserveFundsConfirmed(encodeReserveFundsConfirmedPO(e)))
    case e: CreditBalanceEntity.DeductFundsConfirmed => pb.CreditBalanceEventPO(pb.CreditBalanceEventPO.Event.DeductFundsConfirmed(encodeDeductFundsConfirmedPO(e)))
    case e: CreditBalanceEntity.ReleaseReservedFundsConfirmed => pb.CreditBalanceEventPO(pb.CreditBalanceEventPO.Event.ReleaseReservedFundsConfirmed(encodeReleaseReservedFundsConfirmedPO(e)))
    case e: CreditBalanceEntity.RecordIncomingCreditsConfirmed => pb.CreditBalanceEventPO(pb.CreditBalanceEventPO.Event.RecordIncomingCreditsConfirmed(encodeRecordIncomingCreditsConfirmedPO(e)))
    case e: CreditBalanceEntity.CommitIncomingCreditsConfirmed => pb.CreditBalanceEventPO(pb.CreditBalanceEventPO.Event.CommitIncomingCreditsConfirmed(encodeCommitIncomingCreditsConfirmedPO(e)))
    case e: CreditBalanceEntity.CancelIncomingCreditConfirmed => pb.CreditBalanceEventPO(pb.CreditBalanceEventPO.Event.CancelIncomingCreditConfirmed(encodeCancelIncomingCreditConfirmedPO(e)))
  }
  def decodeCreditBalanceEventPO(value: pb.CreditBalanceEventPO): CreditBalanceEntity.Event = value.event match {
    case pb.CreditBalanceEventPO.Event.AccountInitialized(e) => decodeAccountInitializedPO(e)
    case pb.CreditBalanceEventPO.Event.ReserveFundsConfirmed(e) => decodeReserveFundsConfirmedPO(e)
    case pb.CreditBalanceEventPO.Event.DeductFundsConfirmed(e) => decodeDeductFundsConfirmedPO(e)
    case pb.CreditBalanceEventPO.Event.ReleaseReservedFundsConfirmed(e) => decodeReleaseReservedFundsConfirmedPO(e)
    case pb.CreditBalanceEventPO.Event.RecordIncomingCreditsConfirmed(e) => decodeRecordIncomingCreditsConfirmedPO(e)
    case pb.CreditBalanceEventPO.Event.CommitIncomingCreditsConfirmed(e) => decodeCommitIncomingCreditsConfirmedPO(e)
    case pb.CreditBalanceEventPO.Event.CancelIncomingCreditConfirmed(e) => decodeCancelIncomingCreditConfirmedPO(e)
    case pb.CreditBalanceEventPO.Event.Empty => throw new IllegalArgumentException("empty CreditBalanceEventPO event")
  }
}
