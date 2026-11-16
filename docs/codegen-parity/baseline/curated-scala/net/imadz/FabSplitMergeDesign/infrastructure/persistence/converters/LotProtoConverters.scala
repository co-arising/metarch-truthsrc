package net.imadz.FabSplitMergeDesign.infrastructure.persistence.converters

import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.CancelAddWaferConfirmed
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.CommitAddWaferConfirmed
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.CommitWaferRemovalConfirmed
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.LotState
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.ReleaseReservedWaferConfirmed
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.ReserveAddWaferConfirmed
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.ReserveWaferRemovalConfirmed
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.TransferRequested
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.result_compensated
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.result_outcome_unknown
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.result_recovery_required
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.result_rejected_before_effects
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.result_succeeded
import net.imadz.FabSplitMergeDesign.infrastructure.proto.lot.CancelAddWaferConfirmedPO
import net.imadz.FabSplitMergeDesign.infrastructure.proto.lot.CommitAddWaferConfirmedPO
import net.imadz.FabSplitMergeDesign.infrastructure.proto.lot.CommitWaferRemovalConfirmedPO
import net.imadz.FabSplitMergeDesign.infrastructure.proto.lot.LotStatePO
import net.imadz.FabSplitMergeDesign.infrastructure.proto.lot.ReleaseReservedWaferConfirmedPO
import net.imadz.FabSplitMergeDesign.infrastructure.proto.lot.ReserveAddWaferConfirmedPO
import net.imadz.FabSplitMergeDesign.infrastructure.proto.lot.ReserveWaferRemovalConfirmedPO
import net.imadz.FabSplitMergeDesign.infrastructure.proto.lot.TransferRequestedPO
import net.imadz.FabSplitMergeDesign.infrastructure.proto.lot.result_compensatedPO
import net.imadz.FabSplitMergeDesign.infrastructure.proto.lot.result_outcome_unknownPO
import net.imadz.FabSplitMergeDesign.infrastructure.proto.lot.result_recovery_requiredPO
import net.imadz.FabSplitMergeDesign.infrastructure.proto.lot.result_rejected_before_effectsPO
import net.imadz.FabSplitMergeDesign.infrastructure.proto.lot.result_succeededPO
import net.imadz.common.serialization.PrimitiveConverter
import scala.collection.immutable.Map
import scala.collection.immutable.Vector

trait LotProtoConverters extends PrimitiveConverter {

  object ReserveWaferRemovalConfirmedConv extends ProtoConverter[ReserveWaferRemovalConfirmed, ReserveWaferRemovalConfirmedPO] {
    override def toProto(d: ReserveWaferRemovalConfirmed): ReserveWaferRemovalConfirmedPO = ReserveWaferRemovalConfirmedPO(
      txid = d.txid,
      reservation = d.reservation,
      wafers = d.wafers.map(StringConv.toProto)
    )

    override def fromProto(p: ReserveWaferRemovalConfirmedPO): ReserveWaferRemovalConfirmed = ReserveWaferRemovalConfirmed(
      txid = p.txid,
      reservation = p.reservation,
      wafers = p.wafers.map(StringConv.fromProto).toVector
    )
  }


  object CommitWaferRemovalConfirmedConv extends ProtoConverter[CommitWaferRemovalConfirmed, CommitWaferRemovalConfirmedPO] {
    override def toProto(d: CommitWaferRemovalConfirmed): CommitWaferRemovalConfirmedPO = CommitWaferRemovalConfirmedPO(
      txid = d.txid,
      receiptId = d.receiptId
    )

    override def fromProto(p: CommitWaferRemovalConfirmedPO): CommitWaferRemovalConfirmed = CommitWaferRemovalConfirmed(
      txid = p.txid,
      receiptId = p.receiptId
    )
  }


  object ReleaseReservedWaferConfirmedConv extends ProtoConverter[ReleaseReservedWaferConfirmed, ReleaseReservedWaferConfirmedPO] {
    override def toProto(d: ReleaseReservedWaferConfirmed): ReleaseReservedWaferConfirmedPO = ReleaseReservedWaferConfirmedPO(
      txid = d.txid,
      wafers = d.wafers.map(StringConv.toProto)
    )

    override def fromProto(p: ReleaseReservedWaferConfirmedPO): ReleaseReservedWaferConfirmed = ReleaseReservedWaferConfirmed(
      txid = p.txid,
      wafers = p.wafers.map(StringConv.fromProto).toVector
    )
  }


  object ReserveAddWaferConfirmedConv extends ProtoConverter[ReserveAddWaferConfirmed, ReserveAddWaferConfirmedPO] {
    override def toProto(d: ReserveAddWaferConfirmed): ReserveAddWaferConfirmedPO = ReserveAddWaferConfirmedPO(
      txid = d.txid,
      reservation = d.reservation,
      wafers = d.wafers.map(StringConv.toProto)
    )

    override def fromProto(p: ReserveAddWaferConfirmedPO): ReserveAddWaferConfirmed = ReserveAddWaferConfirmed(
      txid = p.txid,
      reservation = p.reservation,
      wafers = p.wafers.map(StringConv.fromProto).toVector
    )
  }


  object CommitAddWaferConfirmedConv extends ProtoConverter[CommitAddWaferConfirmed, CommitAddWaferConfirmedPO] {
    override def toProto(d: CommitAddWaferConfirmed): CommitAddWaferConfirmedPO = CommitAddWaferConfirmedPO(
      txid = d.txid,
      receiptId = d.receiptId,
      wafers = d.wafers.map(StringConv.toProto)
    )

    override def fromProto(p: CommitAddWaferConfirmedPO): CommitAddWaferConfirmed = CommitAddWaferConfirmed(
      txid = p.txid,
      receiptId = p.receiptId,
      wafers = p.wafers.map(StringConv.fromProto).toVector
    )
  }


  object CancelAddWaferConfirmedConv extends ProtoConverter[CancelAddWaferConfirmed, CancelAddWaferConfirmedPO] {
    override def toProto(d: CancelAddWaferConfirmed): CancelAddWaferConfirmedPO = CancelAddWaferConfirmedPO(
      txid = d.txid
    )

    override def fromProto(p: CancelAddWaferConfirmedPO): CancelAddWaferConfirmed = CancelAddWaferConfirmed(
      txid = p.txid
    )
  }


  object TransferRequestedConv extends ProtoConverter[TransferRequested, TransferRequestedPO] {
    override def toProto(d: TransferRequested): TransferRequestedPO = TransferRequestedPO(
      operationId = d.operationId,
      from = d.from,
      to = d.to,
      wafers = d.wafers.map(StringConv.toProto),
      manifest = d.manifest
    )

    override def fromProto(p: TransferRequestedPO): TransferRequested = TransferRequested(
      operationId = p.operationId,
      from = p.from,
      to = p.to,
      wafers = p.wafers.map(StringConv.fromProto).toVector,
      manifest = p.manifest
    )
  }


  object result_succeededConv extends ProtoConverter[result_succeeded, result_succeededPO] {
    override def toProto(d: result_succeeded): result_succeededPO = result_succeededPO(
      txid = d.txid
    )

    override def fromProto(p: result_succeededPO): result_succeeded = result_succeeded(
      txid = p.txid
    )
  }


  object result_rejected_before_effectsConv extends ProtoConverter[result_rejected_before_effects, result_rejected_before_effectsPO] {
    override def toProto(d: result_rejected_before_effects): result_rejected_before_effectsPO = result_rejected_before_effectsPO(
      txid = d.txid
    )

    override def fromProto(p: result_rejected_before_effectsPO): result_rejected_before_effects = result_rejected_before_effects(
      txid = p.txid
    )
  }


  object result_compensatedConv extends ProtoConverter[result_compensated, result_compensatedPO] {
    override def toProto(d: result_compensated): result_compensatedPO = result_compensatedPO(
      txid = d.txid
    )

    override def fromProto(p: result_compensatedPO): result_compensated = result_compensated(
      txid = p.txid
    )
  }


  object result_recovery_requiredConv extends ProtoConverter[result_recovery_required, result_recovery_requiredPO] {
    override def toProto(d: result_recovery_required): result_recovery_requiredPO = result_recovery_requiredPO(
      txid = d.txid
    )

    override def fromProto(p: result_recovery_requiredPO): result_recovery_required = result_recovery_required(
      txid = p.txid
    )
  }


  object result_outcome_unknownConv extends ProtoConverter[result_outcome_unknown, result_outcome_unknownPO] {
    override def toProto(d: result_outcome_unknown): result_outcome_unknownPO = result_outcome_unknownPO(
      txid = d.txid
    )

    override def fromProto(p: result_outcome_unknownPO): result_outcome_unknown = result_outcome_unknown(
      txid = p.txid
    )
  }


  object LotStateConv extends ProtoConverter[LotState, LotStatePO] {
    override def toProto(d: LotState): LotStatePO = LotStatePO(
      id = d.id,
      phase = d.phase,
      carried = toProtoMap(d.carried, StringConv, StringConv),
      reservedRemovals = toProtoMap(d.reservedRemovals, StringConv, StringConv),
      reservedAdditions = toProtoMap(d.reservedAdditions, StringConv, StringConv),
      committed = toProtoMap(d.committed, StringConv, StringConv),
      compensated = toProtoMap(d.compensated, StringConv, StringConv),
      sagaResults = toProtoMap(d.sagaResults, StringConv, StringConv)
    )

    override def fromProto(p: LotStatePO): LotState = LotState(
      id = p.id,
      phase = p.phase,
      carried = fromProtoMap(p.carried, StringConv, StringConv),
      reservedRemovals = fromProtoMap(p.reservedRemovals, StringConv, StringConv),
      reservedAdditions = fromProtoMap(p.reservedAdditions, StringConv, StringConv),
      committed = fromProtoMap(p.committed, StringConv, StringConv),
      compensated = fromProtoMap(p.compensated, StringConv, StringConv),
      sagaResults = fromProtoMap(p.sagaResults, StringConv, StringConv)
    )
  }


  object ListConv {
    def toProto[D, P](domain: List[D])(implicit c: ProtoConverter[D, P]): Seq[P] = domain.map(c.toProto)
    def fromProto[D, P](proto: Seq[P])(implicit c: ProtoConverter[D, P]): List[D] = proto.map(c.fromProto).toList
  }

  object InstantConv {
    def toProto(domain: java.time.Instant): Long = Option(domain).fold(0L)(_.toEpochMilli)
    def fromProto(proto: Long): java.time.Instant = java.time.Instant.ofEpochMilli(proto)
  }

}

/** S2-82-B3（2026-09-11）：self-companion——trait 嵌套 Conv object 的静态寻址口。
  * Scala trait 无 term（TraitName.NestedObject 编译红「no companion object」）——
  * 投影 handler/读端经 LotProtoConverters.XxxConv.fromProto 静态调用需要本伴生；
  * EventAdapter/SnapshotAdapter 等 mixin 消费方不受影响（trait 本体原样）。 */
object LotProtoConverters extends LotProtoConverters
