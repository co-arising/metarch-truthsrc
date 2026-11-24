package example.bankwealth.infrastructure.serialization

import akka.persistence.typed.{EventAdapter, EventSeq, SnapshotAdapter}
import example.bankwealth.domain._
import example.bankwealth.domain.FundOrderProtocol._
import example.bankwealth.infrastructure.proto._
import scala.reflect.ClassTag
import scalapb.GeneratedMessage

object FundOrderEventAdapter extends EventAdapter[Event, GeneratedMessage] {
  private final case class CodecEntry(
    eventClass: Class[_],
    manifest: String,
    encode: Event => GeneratedMessage,
    decode: GeneratedMessage => Event
  )

  private def entry[E <: Event, P <: GeneratedMessage](
    name: String,
    encode: E => P,
    decode: P => E
  )(implicit ec: ClassTag[E], pc: ClassTag[P]): CodecEntry =
    CodecEntry(
      ec.runtimeClass,
      name,
      e => encode(e.asInstanceOf[E]),
      p => {
        require(pc.runtimeClass.isInstance(p), "event manifest and payload mismatch")
        decode(p.asInstanceOf[P])
      }
    )

  private val registry: Vector[CodecEntry] = Vector(
    entry[FundPurchaseSettlementRequested, FundOrderFundPurchaseSettlementRequestedPB]("FundOrderFundPurchaseSettlementRequestedPB", DomainConverters.encodeFundOrderFundPurchaseSettlementRequestedPB, DomainConverters.decodeFundOrderFundPurchaseSettlementRequestedPB),
    entry[ReserveFundSubscriptionConfirmed, FundOrderReserveFundSubscriptionConfirmedPB]("FundOrderReserveFundSubscriptionConfirmedPB", DomainConverters.encodeFundOrderReserveFundSubscriptionConfirmedPB, DomainConverters.decodeFundOrderReserveFundSubscriptionConfirmedPB),
    entry[FundSubscriptionPaymentConfirmed, FundOrderFundSubscriptionPaymentConfirmedPB]("FundOrderFundSubscriptionPaymentConfirmedPB", DomainConverters.encodeFundOrderFundSubscriptionPaymentConfirmedPB, DomainConverters.decodeFundOrderFundSubscriptionPaymentConfirmedPB),
    entry[CashFundSubscriptionCanceled, FundOrderCashFundSubscriptionCanceledPB]("FundOrderCashFundSubscriptionCanceledPB", DomainConverters.encodeFundOrderCashFundSubscriptionCanceledPB, DomainConverters.decodeFundOrderCashFundSubscriptionCanceledPB),
    entry[FundCashPaymentSucceeded, FundOrderFundCashPaymentSucceededPB]("FundOrderFundCashPaymentSucceededPB", DomainConverters.encodeFundOrderFundCashPaymentSucceededPB, DomainConverters.decodeFundOrderFundCashPaymentSucceededPB),
    entry[FundCashPaymentRejectedBeforeEffects, FundOrderFundCashPaymentRejectedBeforeEffectsPB]("FundOrderFundCashPaymentRejectedBeforeEffectsPB", DomainConverters.encodeFundOrderFundCashPaymentRejectedBeforeEffectsPB, DomainConverters.decodeFundOrderFundCashPaymentRejectedBeforeEffectsPB),
    entry[FundCashPaymentCompensated, FundOrderFundCashPaymentCompensatedPB]("FundOrderFundCashPaymentCompensatedPB", DomainConverters.encodeFundOrderFundCashPaymentCompensatedPB, DomainConverters.decodeFundOrderFundCashPaymentCompensatedPB),
    entry[FundCashPaymentRecoveryRequired, FundOrderFundCashPaymentRecoveryRequiredPB]("FundOrderFundCashPaymentRecoveryRequiredPB", DomainConverters.encodeFundOrderFundCashPaymentRecoveryRequiredPB, DomainConverters.decodeFundOrderFundCashPaymentRecoveryRequiredPB),
    entry[FundCashPaymentOutcomeUnknown, FundOrderFundCashPaymentOutcomeUnknownPB]("FundOrderFundCashPaymentOutcomeUnknownPB", DomainConverters.encodeFundOrderFundCashPaymentOutcomeUnknownPB, DomainConverters.decodeFundOrderFundCashPaymentOutcomeUnknownPB),
    entry[FundTASubmissionRegistered, FundOrderFundTASubmissionRegisteredPB]("FundOrderFundTASubmissionRegisteredPB", DomainConverters.encodeFundOrderFundTASubmissionRegisteredPB, DomainConverters.decodeFundOrderFundTASubmissionRegisteredPB),
    entry[FundTAAccepted, FundOrderFundTAAcceptedPB]("FundOrderFundTAAcceptedPB", DomainConverters.encodeFundOrderFundTAAcceptedPB, DomainConverters.decodeFundOrderFundTAAcceptedPB),
    entry[FundTASharesConfirmed, FundOrderFundTASharesConfirmedPB]("FundOrderFundTASharesConfirmedPB", DomainConverters.encodeFundOrderFundTASharesConfirmedPB, DomainConverters.decodeFundOrderFundTASharesConfirmedPB),
    entry[FundTARejected, FundOrderFundTARejectedPB]("FundOrderFundTARejectedPB", DomainConverters.encodeFundOrderFundTARejectedPB, DomainConverters.decodeFundOrderFundTARejectedPB),
    entry[FundTAUnknown, FundOrderFundTAUnknownPB]("FundOrderFundTAUnknownPB", DomainConverters.encodeFundOrderFundTAUnknownPB, DomainConverters.decodeFundOrderFundTAUnknownPB),
    entry[FundPurchaseRefundRequested, FundOrderFundPurchaseRefundRequestedPB]("FundOrderFundPurchaseRefundRequestedPB", DomainConverters.encodeFundOrderFundPurchaseRefundRequestedPB, DomainConverters.decodeFundOrderFundPurchaseRefundRequestedPB),
    entry[FundRefundSucceeded, FundOrderFundRefundSucceededPB]("FundOrderFundRefundSucceededPB", DomainConverters.encodeFundOrderFundRefundSucceededPB, DomainConverters.decodeFundOrderFundRefundSucceededPB),
    entry[FundRefundRejectedBeforeEffects, FundOrderFundRefundRejectedBeforeEffectsPB]("FundOrderFundRefundRejectedBeforeEffectsPB", DomainConverters.encodeFundOrderFundRefundRejectedBeforeEffectsPB, DomainConverters.decodeFundOrderFundRefundRejectedBeforeEffectsPB),
    entry[FundRefundCompensated, FundOrderFundRefundCompensatedPB]("FundOrderFundRefundCompensatedPB", DomainConverters.encodeFundOrderFundRefundCompensatedPB, DomainConverters.decodeFundOrderFundRefundCompensatedPB),
    entry[FundRefundRecoveryRequired, FundOrderFundRefundRecoveryRequiredPB]("FundOrderFundRefundRecoveryRequiredPB", DomainConverters.encodeFundOrderFundRefundRecoveryRequiredPB, DomainConverters.decodeFundOrderFundRefundRecoveryRequiredPB),
    entry[FundRefundOutcomeUnknown, FundOrderFundRefundOutcomeUnknownPB]("FundOrderFundRefundOutcomeUnknownPB", DomainConverters.encodeFundOrderFundRefundOutcomeUnknownPB, DomainConverters.decodeFundOrderFundRefundOutcomeUnknownPB),
    entry[FundTAReceiptObserved, FundOrderFundTAReceiptObservedPB]("FundOrderFundTAReceiptObservedPB", DomainConverters.encodeFundOrderFundTAReceiptObservedPB, DomainConverters.decodeFundOrderFundTAReceiptObservedPB),
    entry[BankPaymentResultSucceeded, FundOrderBankPaymentResultSucceededPB]("FundOrderBankPaymentResultSucceededPB", DomainConverters.encodeFundOrderBankPaymentResultSucceededPB, DomainConverters.decodeFundOrderBankPaymentResultSucceededPB),
    entry[BankPaymentResultRejectedBeforeEffects, FundOrderBankPaymentResultRejectedBeforeEffectsPB]("FundOrderBankPaymentResultRejectedBeforeEffectsPB", DomainConverters.encodeFundOrderBankPaymentResultRejectedBeforeEffectsPB, DomainConverters.decodeFundOrderBankPaymentResultRejectedBeforeEffectsPB),
    entry[BankPaymentResultCompensated, FundOrderBankPaymentResultCompensatedPB]("FundOrderBankPaymentResultCompensatedPB", DomainConverters.encodeFundOrderBankPaymentResultCompensatedPB, DomainConverters.decodeFundOrderBankPaymentResultCompensatedPB),
    entry[BankPaymentResultRecoveryRequired, FundOrderBankPaymentResultRecoveryRequiredPB]("FundOrderBankPaymentResultRecoveryRequiredPB", DomainConverters.encodeFundOrderBankPaymentResultRecoveryRequiredPB, DomainConverters.decodeFundOrderBankPaymentResultRecoveryRequiredPB),
    entry[BankPaymentResultOutcomeUnknown, FundOrderBankPaymentResultOutcomeUnknownPB]("FundOrderBankPaymentResultOutcomeUnknownPB", DomainConverters.encodeFundOrderBankPaymentResultOutcomeUnknownPB, DomainConverters.decodeFundOrderBankPaymentResultOutcomeUnknownPB),
    entry[BankRefundResultSucceeded, FundOrderBankRefundResultSucceededPB]("FundOrderBankRefundResultSucceededPB", DomainConverters.encodeFundOrderBankRefundResultSucceededPB, DomainConverters.decodeFundOrderBankRefundResultSucceededPB),
    entry[BankRefundResultRejectedBeforeEffects, FundOrderBankRefundResultRejectedBeforeEffectsPB]("FundOrderBankRefundResultRejectedBeforeEffectsPB", DomainConverters.encodeFundOrderBankRefundResultRejectedBeforeEffectsPB, DomainConverters.decodeFundOrderBankRefundResultRejectedBeforeEffectsPB),
    entry[BankRefundResultCompensated, FundOrderBankRefundResultCompensatedPB]("FundOrderBankRefundResultCompensatedPB", DomainConverters.encodeFundOrderBankRefundResultCompensatedPB, DomainConverters.decodeFundOrderBankRefundResultCompensatedPB),
    entry[BankRefundResultRecoveryRequired, FundOrderBankRefundResultRecoveryRequiredPB]("FundOrderBankRefundResultRecoveryRequiredPB", DomainConverters.encodeFundOrderBankRefundResultRecoveryRequiredPB, DomainConverters.decodeFundOrderBankRefundResultRecoveryRequiredPB),
    entry[BankRefundResultOutcomeUnknown, FundOrderBankRefundResultOutcomeUnknownPB]("FundOrderBankRefundResultOutcomeUnknownPB", DomainConverters.encodeFundOrderBankRefundResultOutcomeUnknownPB, DomainConverters.decodeFundOrderBankRefundResultOutcomeUnknownPB),
    entry[CashRequestSourceRecorded, FundOrderCashRequestSourceRecordedPB]("FundOrderCashRequestSourceRecordedPB", DomainConverters.encodeFundOrderCashRequestSourceRecordedPB, DomainConverters.decodeFundOrderCashRequestSourceRecordedPB)
  )

  private val byClass: Map[Class[_], CodecEntry] =
    registry.iterator.map(e => e.eventClass -> e).toMap

  private val byManifest: Map[String, CodecEntry] =
    registry.iterator.map(e => e.manifest -> e).toMap

  override def manifest(event: Event): String =
    byClass.getOrElse(event.getClass, throw new IllegalArgumentException("unregistered event")).manifest

  override def toJournal(event: Event): GeneratedMessage =
    byClass.getOrElse(event.getClass, throw new IllegalArgumentException("unregistered event")).encode(event)

  override def fromJournal(event: GeneratedMessage, manifest: String): EventSeq[Event] =
    byManifest.get(manifest) match {
      case Some(codec) => EventSeq.single(codec.decode(event))
      case None => throw new IllegalArgumentException("event manifest and payload mismatch")
    }
}

object FundOrderSnapshotAdapter extends SnapshotAdapter[FundOrderState] {
  override def toJournal(state: FundOrderState): Any = DomainConverters.encodeFundOrderStatePB(state)
  override def fromJournal(value: Any): FundOrderState = value match {
    case state: FundOrderStatePB => DomainConverters.decodeFundOrderStatePB(state)
    case _ => throw new IllegalArgumentException("snapshot type mismatch")
  }
}
