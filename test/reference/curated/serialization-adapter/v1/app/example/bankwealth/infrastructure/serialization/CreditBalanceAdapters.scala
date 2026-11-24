package example.bankwealth.infrastructure.serialization

import akka.persistence.typed.{EventAdapter, EventSeq, SnapshotAdapter}
import example.bankwealth.domain._
import example.bankwealth.domain.CreditBalanceProtocol._
import example.bankwealth.infrastructure.proto._
import scala.reflect.ClassTag
import scalapb.GeneratedMessage

object CreditBalanceEventAdapter extends EventAdapter[Event, GeneratedMessage] {
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
    entry[AccountInitialized, CreditBalanceAccountInitializedPB]("CreditBalanceAccountInitializedPB", DomainConverters.encodeCreditBalanceAccountInitializedPB, DomainConverters.decodeCreditBalanceAccountInitializedPB),
    entry[ReserveFundsConfirmed, CreditBalanceReserveFundsConfirmedPB]("CreditBalanceReserveFundsConfirmedPB", DomainConverters.encodeCreditBalanceReserveFundsConfirmedPB, DomainConverters.decodeCreditBalanceReserveFundsConfirmedPB),
    entry[DeductFundsConfirmed, CreditBalanceDeductFundsConfirmedPB]("CreditBalanceDeductFundsConfirmedPB", DomainConverters.encodeCreditBalanceDeductFundsConfirmedPB, DomainConverters.decodeCreditBalanceDeductFundsConfirmedPB),
    entry[ReleaseReservedFundsConfirmed, CreditBalanceReleaseReservedFundsConfirmedPB]("CreditBalanceReleaseReservedFundsConfirmedPB", DomainConverters.encodeCreditBalanceReleaseReservedFundsConfirmedPB, DomainConverters.decodeCreditBalanceReleaseReservedFundsConfirmedPB),
    entry[RecordIncomingCreditsConfirmed, CreditBalanceRecordIncomingCreditsConfirmedPB]("CreditBalanceRecordIncomingCreditsConfirmedPB", DomainConverters.encodeCreditBalanceRecordIncomingCreditsConfirmedPB, DomainConverters.decodeCreditBalanceRecordIncomingCreditsConfirmedPB),
    entry[CommitIncomingCreditsConfirmed, CreditBalanceCommitIncomingCreditsConfirmedPB]("CreditBalanceCommitIncomingCreditsConfirmedPB", DomainConverters.encodeCreditBalanceCommitIncomingCreditsConfirmedPB, DomainConverters.decodeCreditBalanceCommitIncomingCreditsConfirmedPB),
    entry[CancelIncomingCreditConfirmed, CreditBalanceCancelIncomingCreditConfirmedPB]("CreditBalanceCancelIncomingCreditConfirmedPB", DomainConverters.encodeCreditBalanceCancelIncomingCreditConfirmedPB, DomainConverters.decodeCreditBalanceCancelIncomingCreditConfirmedPB)
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

object CreditBalanceSnapshotAdapter extends SnapshotAdapter[CreditBalanceState] {
  override def toJournal(state: CreditBalanceState): Any = DomainConverters.encodeCreditBalanceStatePB(state)
  override def fromJournal(value: Any): CreditBalanceState = value match {
    case state: CreditBalanceStatePB => DomainConverters.decodeCreditBalanceStatePB(state)
    case _ => throw new IllegalArgumentException("snapshot type mismatch")
  }
}
