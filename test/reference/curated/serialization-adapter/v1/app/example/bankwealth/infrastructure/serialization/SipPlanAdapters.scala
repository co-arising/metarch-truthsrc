package example.bankwealth.infrastructure.serialization

import akka.persistence.typed.{EventAdapter, EventSeq, SnapshotAdapter}
import example.bankwealth.domain._
import example.bankwealth.domain.SipPlanProtocol._
import example.bankwealth.infrastructure.proto._
import scala.reflect.ClassTag
import scalapb.GeneratedMessage

object SipPlanEventAdapter extends EventAdapter[Event, GeneratedMessage] {
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
    entry[SipPlanCreated, SipPlanSipPlanCreatedPB]("SipPlanSipPlanCreatedPB", DomainConverters.encodeSipPlanSipPlanCreatedPB, DomainConverters.decodeSipPlanSipPlanCreatedPB),
    entry[SipDueSlotAppended, SipPlanSipDueSlotAppendedPB]("SipPlanSipDueSlotAppendedPB", DomainConverters.encodeSipPlanSipDueSlotAppendedPB, DomainConverters.decodeSipPlanSipDueSlotAppendedPB),
    entry[SipScheduleSealed, SipPlanSipScheduleSealedPB]("SipPlanSipScheduleSealedPB", DomainConverters.encodeSipPlanSipScheduleSealedPB, DomainConverters.decodeSipPlanSipScheduleSealedPB),
    entry[SipPlanRevised, SipPlanSipPlanRevisedPB]("SipPlanSipPlanRevisedPB", DomainConverters.encodeSipPlanSipPlanRevisedPB, DomainConverters.decodeSipPlanSipPlanRevisedPB),
    entry[SipClockAdvanced, SipPlanSipClockAdvancedPB]("SipPlanSipClockAdvancedPB", DomainConverters.encodeSipPlanSipClockAdvancedPB, DomainConverters.decodeSipPlanSipClockAdvancedPB),
    entry[SipPlanPaused, SipPlanSipPlanPausedPB]("SipPlanSipPlanPausedPB", DomainConverters.encodeSipPlanSipPlanPausedPB, DomainConverters.decodeSipPlanSipPlanPausedPB),
    entry[SipPlanResumed, SipPlanSipPlanResumedPB]("SipPlanSipPlanResumedPB", DomainConverters.encodeSipPlanSipPlanResumedPB, DomainConverters.decodeSipPlanSipPlanResumedPB),
    entry[SipDueSlotObserved, SipPlanSipDueSlotObservedPB]("SipPlanSipDueSlotObservedPB", DomainConverters.encodeSipPlanSipDueSlotObservedPB, DomainConverters.decodeSipPlanSipDueSlotObservedPB),
    entry[SipPausedDueSlotSkipped, SipPlanSipPausedDueSlotSkippedPB]("SipPlanSipPausedDueSlotSkippedPB", DomainConverters.encodeSipPlanSipPausedDueSlotSkippedPB, DomainConverters.decodeSipPlanSipPausedDueSlotSkippedPB),
    entry[SipSkippedSlotAdvanced, SipPlanSipSkippedSlotAdvancedPB]("SipPlanSipSkippedSlotAdvancedPB", DomainConverters.encodeSipPlanSipSkippedSlotAdvancedPB, DomainConverters.decodeSipPlanSipSkippedSlotAdvancedPB),
    entry[SipInstallmentTriggered, SipPlanSipInstallmentTriggeredPB]("SipPlanSipInstallmentTriggeredPB", DomainConverters.encodeSipPlanSipInstallmentTriggeredPB, DomainConverters.decodeSipPlanSipInstallmentTriggeredPB),
    entry[SipInstallmentPending, SipPlanSipInstallmentPendingPB]("SipPlanSipInstallmentPendingPB", DomainConverters.encodeSipPlanSipInstallmentPendingPB, DomainConverters.decodeSipPlanSipInstallmentPendingPB),
    entry[SipInstallmentOutcomeUnknown, SipPlanSipInstallmentOutcomeUnknownPB]("SipPlanSipInstallmentOutcomeUnknownPB", DomainConverters.encodeSipPlanSipInstallmentOutcomeUnknownPB, DomainConverters.decodeSipPlanSipInstallmentOutcomeUnknownPB),
    entry[SipInstallmentRecoveryRequired, SipPlanSipInstallmentRecoveryRequiredPB]("SipPlanSipInstallmentRecoveryRequiredPB", DomainConverters.encodeSipPlanSipInstallmentRecoveryRequiredPB, DomainConverters.decodeSipPlanSipInstallmentRecoveryRequiredPB),
    entry[SipInstallmentRefundInProgress, SipPlanSipInstallmentRefundInProgressPB]("SipPlanSipInstallmentRefundInProgressPB", DomainConverters.encodeSipPlanSipInstallmentRefundInProgressPB, DomainConverters.decodeSipPlanSipInstallmentRefundInProgressPB),
    entry[SipInstallmentSucceeded, SipPlanSipInstallmentSucceededPB]("SipPlanSipInstallmentSucceededPB", DomainConverters.encodeSipPlanSipInstallmentSucceededPB, DomainConverters.decodeSipPlanSipInstallmentSucceededPB),
    entry[SipInstallmentFailed, SipPlanSipInstallmentFailedPB]("SipPlanSipInstallmentFailedPB", DomainConverters.encodeSipPlanSipInstallmentFailedPB, DomainConverters.decodeSipPlanSipInstallmentFailedPB),
    entry[SipCreateIntentRecorded, SipPlanSipCreateIntentRecordedPB]("SipPlanSipCreateIntentRecordedPB", DomainConverters.encodeSipPlanSipCreateIntentRecordedPB, DomainConverters.decodeSipPlanSipCreateIntentRecordedPB)
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

object SipPlanSnapshotAdapter extends SnapshotAdapter[SipPlanState] {
  override def toJournal(state: SipPlanState): Any = DomainConverters.encodeSipPlanStatePB(state)
  override def fromJournal(value: Any): SipPlanState = value match {
    case state: SipPlanStatePB => DomainConverters.decodeSipPlanStatePB(state)
    case _ => throw new IllegalArgumentException("snapshot type mismatch")
  }
}
