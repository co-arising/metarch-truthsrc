package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.KnowledgePatchEntity.KnowledgePatchState
import net.imadz.metarch.domain.entities.KnowledgePatchEntity._
import net.imadz.metarch.infrastructure.proto._

trait KnowledgePatchProtoConverters extends PrimitiveConverter {

  object KnowledgePatchStateConv extends ProtoConverter[KnowledgePatchState, KnowledgePatchStatePO] {
    override def toProto(d: KnowledgePatchState): KnowledgePatchStatePO = KnowledgePatchStatePO(
      tenantId = d.tenantId,
      status = d.status,
      sessionIds = d.sessionIds,
      catalogId = d.catalogId,
      contextId = d.contextId,
      createdBy = d.createdBy,
      parentPatchId = d.parentPatchId,
      patchHash = d.patchHash,
      concepts = d.concepts,
      relations = d.relations,
      createdAt = d.createdAt,
      mergedAt = d.mergedAt
    )

    override def fromProto(p: KnowledgePatchStatePO): KnowledgePatchState = KnowledgePatchState(
      tenantId = p.tenantId,
      status = p.status,
      sessionIds = p.sessionIds,
      catalogId = p.catalogId,
      contextId = p.contextId,
      createdBy = p.createdBy,
      parentPatchId = p.parentPatchId,
      patchHash = p.patchHash,
      concepts = p.concepts,
      relations = p.relations,
      createdAt = p.createdAt,
      mergedAt = p.mergedAt
    )
  }


  object KnowledgePatchSubmittedConv extends ProtoConverter[KnowledgePatchSubmitted, KnowledgePatchSubmittedPO] {
    override def toProto(d: KnowledgePatchSubmitted): KnowledgePatchSubmittedPO = KnowledgePatchSubmittedPO(
      patchId = d.patchId,
      sessionId = d.sessionId,
      catalogId = d.catalogId,
      contextId = d.contextId,
      parentPatchId = d.parentPatchId,
      parentPatchHash = d.parentPatchHash,
      concepts = d.concepts,
      relations = d.relations,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId,
      patchHash = d.patchHash
    )

    override def fromProto(p: KnowledgePatchSubmittedPO): KnowledgePatchSubmitted = KnowledgePatchSubmitted(
      patchId = p.patchId,
      sessionId = p.sessionId,
      catalogId = p.catalogId,
      contextId = p.contextId,
      parentPatchId = p.parentPatchId,
      parentPatchHash = p.parentPatchHash,
      concepts = p.concepts,
      relations = p.relations,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId,
      patchHash = p.patchHash
    )
  }


  object KnowledgePatchReadyToMergedConv extends ProtoConverter[KnowledgePatchReadyToMerged, KnowledgePatchReadyToMergedPO] {
    override def toProto(d: KnowledgePatchReadyToMerged): KnowledgePatchReadyToMergedPO = KnowledgePatchReadyToMergedPO(
      patchId = d.patchId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      sessionIds = d.sessionIds,
      tenantId = d.tenantId
    )

    override def fromProto(p: KnowledgePatchReadyToMergedPO): KnowledgePatchReadyToMerged = KnowledgePatchReadyToMerged(
      patchId = p.patchId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      sessionIds = p.sessionIds,
      tenantId = p.tenantId
    )
  }


  object KnowledgePatchMergedConv extends ProtoConverter[KnowledgePatchMerged, KnowledgePatchMergedPO] {
    override def toProto(d: KnowledgePatchMerged): KnowledgePatchMergedPO = KnowledgePatchMergedPO(
      patchId = d.patchId,
      catalogId = d.catalogId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId,
      patchHash = d.patchHash,
      parentPatchId = d.parentPatchId,
      changedFields = d.changedFields
    )

    override def fromProto(p: KnowledgePatchMergedPO): KnowledgePatchMerged = KnowledgePatchMerged(
      patchId = p.patchId,
      catalogId = p.catalogId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId,
      patchHash = p.patchHash,
      parentPatchId = p.parentPatchId,
      changedFields = p.changedFields
    )
  }


  object KnowledgePatchRejectedConv extends ProtoConverter[KnowledgePatchRejected, KnowledgePatchRejectedPO] {
    override def toProto(d: KnowledgePatchRejected): KnowledgePatchRejectedPO = KnowledgePatchRejectedPO(
      patchId = d.patchId,
      reason = d.reason,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: KnowledgePatchRejectedPO): KnowledgePatchRejected = KnowledgePatchRejected(
      patchId = p.patchId,
      reason = p.reason,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object KnowledgePatchMergeRequestedConv extends ProtoConverter[KnowledgePatchMergeRequested, KnowledgePatchMergeRequestedPO] {
    override def toProto(d: KnowledgePatchMergeRequested): KnowledgePatchMergeRequestedPO = KnowledgePatchMergeRequestedPO(
      patchId = d.patchId,
      catalogId = d.catalogId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: KnowledgePatchMergeRequestedPO): KnowledgePatchMergeRequested = KnowledgePatchMergeRequested(
      patchId = p.patchId,
      catalogId = p.catalogId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object KnowledgePatchMergeDeclinedConv extends ProtoConverter[KnowledgePatchMergeDeclined, KnowledgePatchMergeDeclinedPO] {
    override def toProto(d: KnowledgePatchMergeDeclined): KnowledgePatchMergeDeclinedPO = KnowledgePatchMergeDeclinedPO(
      patchId = d.patchId,
      reason = d.reason,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: KnowledgePatchMergeDeclinedPO): KnowledgePatchMergeDeclined = KnowledgePatchMergeDeclined(
      patchId = p.patchId,
      reason = p.reason,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object KnowledgeMergeConflictDetectedConv extends ProtoConverter[KnowledgeMergeConflictDetected, KnowledgeMergeConflictDetectedPO] {
    override def toProto(d: KnowledgeMergeConflictDetected): KnowledgeMergeConflictDetectedPO = KnowledgeMergeConflictDetectedPO(
      patchId = d.patchId,
      catalogId = d.catalogId,
      conflictSet = d.conflictSet,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: KnowledgeMergeConflictDetectedPO): KnowledgeMergeConflictDetected = KnowledgeMergeConflictDetected(
      patchId = p.patchId,
      catalogId = p.catalogId,
      conflictSet = p.conflictSet,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object KnowledgePatchMergeCommittedConv extends ProtoConverter[KnowledgePatchMergeCommitted, KnowledgePatchMergeCommittedPO] {
    override def toProto(d: KnowledgePatchMergeCommitted): KnowledgePatchMergeCommittedPO = KnowledgePatchMergeCommittedPO(
      patchId = d.patchId,
      catalogId = d.catalogId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId,
      patchHash = d.patchHash,
      parentPatchId = d.parentPatchId,
      changedFields = d.changedFields,
      concepts = d.concepts
    )

    override def fromProto(p: KnowledgePatchMergeCommittedPO): KnowledgePatchMergeCommitted = KnowledgePatchMergeCommitted(
      patchId = p.patchId,
      catalogId = p.catalogId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId,
      patchHash = p.patchHash,
      parentPatchId = p.parentPatchId,
      changedFields = p.changedFields,
      concepts = p.concepts
    )
  }

}
