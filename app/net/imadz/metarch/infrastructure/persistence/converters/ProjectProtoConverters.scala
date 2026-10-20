package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.ProjectEntity.ProjectState
import net.imadz.metarch.domain.entities.ProjectEntity._
import net.imadz.metarch.infrastructure.proto._

trait ProjectProtoConverters extends PrimitiveConverter {

  object ProjectStateConv extends ProtoConverter[ProjectState, ProjectStatePO] {
    override def toProto(d: ProjectState): ProjectStatePO = ProjectStatePO(
      tenantId = d.tenantId,
      status = d.status,
      workgroupId = d.workgroupId,
      ownerUserId = d.ownerUserId,
      name = d.name,
      description = d.description,
      createdAt = d.createdAt,
      createdBy = d.createdBy,
      startedAt = d.startedAt,
      completedAt = d.completedAt,
      pausedAt = d.pausedAt,
      cancelledAt = d.cancelledAt,
      catalogId = d.catalogId
    )

    override def fromProto(p: ProjectStatePO): ProjectState = ProjectState(
      tenantId = p.tenantId,
      status = p.status,
      workgroupId = p.workgroupId,
      ownerUserId = p.ownerUserId,
      name = p.name,
      description = p.description,
      createdAt = p.createdAt,
      createdBy = p.createdBy,
      startedAt = p.startedAt,
      completedAt = p.completedAt,
      pausedAt = p.pausedAt,
      cancelledAt = p.cancelledAt,
      catalogId = p.catalogId
    )
  }


  object ProjectInitiatedConv extends ProtoConverter[ProjectInitiated, ProjectInitiatedPO] {
    override def toProto(d: ProjectInitiated): ProjectInitiatedPO = ProjectInitiatedPO(
      projectId = d.projectId,
      tenantId = d.tenantId,
      workgroupId = d.workgroupId,
      name = d.name,
      description = d.description,
      projectOwnerUserId = d.projectOwnerUserId,
      workshopName = d.workshopName,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      catalogId = d.catalogId
    )

    override def fromProto(p: ProjectInitiatedPO): ProjectInitiated = ProjectInitiated(
      projectId = p.projectId,
      tenantId = p.tenantId,
      workgroupId = p.workgroupId,
      name = p.name,
      description = p.description,
      projectOwnerUserId = p.projectOwnerUserId,
      workshopName = p.workshopName,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      catalogId = p.catalogId
    )
  }


  object ProjectOwnerAssignedConv extends ProtoConverter[ProjectOwnerAssigned, ProjectOwnerAssignedPO] {
    override def toProto(d: ProjectOwnerAssigned): ProjectOwnerAssignedPO = ProjectOwnerAssignedPO(
      projectId = d.projectId,
      ownerUserId = d.ownerUserId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ProjectOwnerAssignedPO): ProjectOwnerAssigned = ProjectOwnerAssigned(
      projectId = p.projectId,
      ownerUserId = p.ownerUserId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object ProjectCompletedConv extends ProtoConverter[ProjectCompleted, ProjectCompletedPO] {
    override def toProto(d: ProjectCompleted): ProjectCompletedPO = ProjectCompletedPO(
      projectId = d.projectId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ProjectCompletedPO): ProjectCompleted = ProjectCompleted(
      projectId = p.projectId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object ProjectPausedConv extends ProtoConverter[ProjectPaused, ProjectPausedPO] {
    override def toProto(d: ProjectPaused): ProjectPausedPO = ProjectPausedPO(
      projectId = d.projectId,
      reason = d.reason,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ProjectPausedPO): ProjectPaused = ProjectPaused(
      projectId = p.projectId,
      reason = p.reason,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object ProjectResumedConv extends ProtoConverter[ProjectResumed, ProjectResumedPO] {
    override def toProto(d: ProjectResumed): ProjectResumedPO = ProjectResumedPO(
      projectId = d.projectId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ProjectResumedPO): ProjectResumed = ProjectResumed(
      projectId = p.projectId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object ProjectCancelledConv extends ProtoConverter[ProjectCancelled, ProjectCancelledPO] {
    override def toProto(d: ProjectCancelled): ProjectCancelledPO = ProjectCancelledPO(
      projectId = d.projectId,
      reason = d.reason,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ProjectCancelledPO): ProjectCancelled = ProjectCancelled(
      projectId = p.projectId,
      reason = p.reason,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object ProjectDescriptionUpdatedConv extends ProtoConverter[ProjectDescriptionUpdated, ProjectDescriptionUpdatedPO] {
    override def toProto(d: ProjectDescriptionUpdated): ProjectDescriptionUpdatedPO = ProjectDescriptionUpdatedPO(
      projectId = d.projectId,
      description = d.description,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ProjectDescriptionUpdatedPO): ProjectDescriptionUpdated = ProjectDescriptionUpdated(
      projectId = p.projectId,
      description = p.description,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }

}
