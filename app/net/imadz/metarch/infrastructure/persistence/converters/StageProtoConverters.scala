package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.StageEntity.StageState
import net.imadz.metarch.domain.entities.StageEntity._
import net.imadz.metarch.infrastructure.proto._

trait StageProtoConverters extends PrimitiveConverter {

  object StageStateConv extends ProtoConverter[StageState, StageStatePO] {
    override def toProto(d: StageState): StageStatePO = StageStatePO(
      tenantId = d.tenantId,
      status = d.status,
      workshopId = d.workshopId,
      order = d.order,
      name = d.name,
      activatedAt = d.activatedAt,
      approvedAt = d.approvedAt,
      rejectedAt = d.rejectedAt,
      rejectionReason = d.rejectionReason,
      sessionId = d.sessionId
    )

    override def fromProto(p: StageStatePO): StageState = StageState(
      tenantId = p.tenantId,
      status = p.status,
      workshopId = p.workshopId,
      order = p.order,
      name = p.name,
      activatedAt = p.activatedAt,
      approvedAt = p.approvedAt,
      rejectedAt = p.rejectedAt,
      rejectionReason = p.rejectionReason,
      sessionId = p.sessionId
    )
  }


  object StageActivatedConv extends ProtoConverter[StageActivated, StageActivatedPO] {
    override def toProto(d: StageActivated): StageActivatedPO = StageActivatedPO(
      tenantId = d.tenantId,
      stageId = d.stageId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      sessionId = d.sessionId,
      workshopId = d.workshopId,
      order = d.order,
      name = d.name
    )

    override def fromProto(p: StageActivatedPO): StageActivated = StageActivated(
      tenantId = p.tenantId,
      stageId = p.stageId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      sessionId = p.sessionId,
      workshopId = p.workshopId,
      order = p.order,
      name = p.name
    )
  }


  object StageApprovedConv extends ProtoConverter[StageApproved, StageApprovedPO] {
    override def toProto(d: StageApproved): StageApprovedPO = StageApprovedPO(
      tenantId = d.tenantId,
      stageId = d.stageId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: StageApprovedPO): StageApproved = StageApproved(
      tenantId = p.tenantId,
      stageId = p.stageId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object StageRejectedConv extends ProtoConverter[StageRejected, StageRejectedPO] {
    override def toProto(d: StageRejected): StageRejectedPO = StageRejectedPO(
      tenantId = d.tenantId,
      rejectionReason = d.rejectionReason,
      stageId = d.stageId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: StageRejectedPO): StageRejected = StageRejected(
      tenantId = p.tenantId,
      rejectionReason = p.rejectionReason,
      stageId = p.stageId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object StageSkippedConv extends ProtoConverter[StageSkipped, StageSkippedPO] {
    override def toProto(d: StageSkipped): StageSkippedPO = StageSkippedPO(
      tenantId = d.tenantId,
      stageId = d.stageId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: StageSkippedPO): StageSkipped = StageSkipped(
      tenantId = p.tenantId,
      stageId = p.stageId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }

}
