package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.WorkshopEntity.WorkshopState
import net.imadz.metarch.domain.entities.WorkshopEntity._
import net.imadz.metarch.infrastructure.proto._

trait WorkshopProtoConverters extends PrimitiveConverter {

  object WorkshopStateConv extends ProtoConverter[WorkshopState, WorkshopStatePO] {
    override def toProto(d: WorkshopState): WorkshopStatePO = WorkshopStatePO(
      tenantId = d.tenantId,
      status = d.status,
      projectId = d.projectId,
      scheduledAt = d.scheduledAt,
      startedAt = d.startedAt,
      completedAt = d.completedAt,
      patchId = d.patchId,
      memberRoles = d.memberRoles
    )

    override def fromProto(p: WorkshopStatePO): WorkshopState = WorkshopState(
      tenantId = p.tenantId,
      status = p.status,
      projectId = p.projectId,
      scheduledAt = p.scheduledAt,
      startedAt = p.startedAt,
      completedAt = p.completedAt,
      patchId = p.patchId,
      memberRoles = p.memberRoles
    )
  }


  object WorkshopScheduledConv extends ProtoConverter[WorkshopScheduled, WorkshopScheduledPO] {
    override def toProto(d: WorkshopScheduled): WorkshopScheduledPO = WorkshopScheduledPO(
      workshopId = d.workshopId,
      tenantId = d.tenantId,
      projectId = d.projectId,
      scheduledAt = d.scheduledAt,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      patchId = d.patchId
    )

    override def fromProto(p: WorkshopScheduledPO): WorkshopScheduled = WorkshopScheduled(
      workshopId = p.workshopId,
      tenantId = p.tenantId,
      projectId = p.projectId,
      scheduledAt = p.scheduledAt,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      patchId = p.patchId
    )
  }


  object WorkshopStartedConv extends ProtoConverter[WorkshopStarted, WorkshopStartedPO] {
    override def toProto(d: WorkshopStarted): WorkshopStartedPO = WorkshopStartedPO(
      workshopId = d.workshopId,
      startedAt = d.startedAt,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: WorkshopStartedPO): WorkshopStarted = WorkshopStarted(
      workshopId = p.workshopId,
      startedAt = p.startedAt,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object WorkshopCompletedConv extends ProtoConverter[WorkshopCompleted, WorkshopCompletedPO] {
    override def toProto(d: WorkshopCompleted): WorkshopCompletedPO = WorkshopCompletedPO(
      workshopId = d.workshopId,
      completedAt = d.completedAt,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: WorkshopCompletedPO): WorkshopCompleted = WorkshopCompleted(
      workshopId = p.workshopId,
      completedAt = p.completedAt,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object WorkshopRoleAssignedConv extends ProtoConverter[WorkshopRoleAssigned, WorkshopRoleAssignedPO] {
    override def toProto(d: WorkshopRoleAssigned): WorkshopRoleAssignedPO = WorkshopRoleAssignedPO(
      workshopId = d.workshopId,
      userId = d.userId,
      role = d.role,
      tenantId = d.tenantId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: WorkshopRoleAssignedPO): WorkshopRoleAssigned = WorkshopRoleAssigned(
      workshopId = p.workshopId,
      userId = p.userId,
      role = p.role,
      tenantId = p.tenantId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }

}
