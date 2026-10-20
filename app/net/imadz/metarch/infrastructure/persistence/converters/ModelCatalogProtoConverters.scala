package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.ModelCatalogEntity.ModelCatalogState
import net.imadz.metarch.domain.entities.ModelCatalogEntity._
import net.imadz.metarch.infrastructure.proto._

trait ModelCatalogProtoConverters extends PrimitiveConverter {

  object ModelCatalogStateConv extends ProtoConverter[ModelCatalogState, ModelCatalogStatePO] {
    override def toProto(d: ModelCatalogState): ModelCatalogStatePO = ModelCatalogStatePO(
      tenantId = d.tenantId,
      status = d.status,
      projectId = d.projectId,
      version = d.version,
      baseVersion = d.baseVersion,
      patchSessionIds = d.patchSessionIds,
      knowledgePackages = d.knowledgePackages,
      stateHash = d.stateHash,
      headPatchId = d.headPatchId,
      headPatchHash = d.headPatchHash,
      conflicts = d.conflicts,
      assembledAt = d.assembledAt,
      assembledBy = d.assembledBy,
      exportedAt = d.exportedAt,
      exportedBy = d.exportedBy,
      releasedAt = d.releasedAt,
      releasedBy = d.releasedBy,
      conflictId = d.conflictId,
      conflictType = d.conflictType,
      involvedSessionIds = d.involvedSessionIds,
      details = d.details,
      resolvedAt = d.resolvedAt,
      resolvedBy = d.resolvedBy,
      resolutionAction = d.resolutionAction,
      resolutionNote = d.resolutionNote,
      sessionId = d.sessionId,
      concepts = d.concepts,
      appliedAt = d.appliedAt,
      detectedAt = d.detectedAt,
      conceptIndex = d.conceptIndex
    )

    override def fromProto(p: ModelCatalogStatePO): ModelCatalogState = ModelCatalogState(
      tenantId = p.tenantId,
      status = p.status,
      projectId = p.projectId,
      version = p.version,
      baseVersion = p.baseVersion,
      patchSessionIds = p.patchSessionIds,
      knowledgePackages = p.knowledgePackages,
      stateHash = p.stateHash,
      headPatchId = p.headPatchId,
      headPatchHash = p.headPatchHash,
      conflicts = p.conflicts,
      assembledAt = p.assembledAt,
      assembledBy = p.assembledBy,
      exportedAt = p.exportedAt,
      exportedBy = p.exportedBy,
      releasedAt = p.releasedAt,
      releasedBy = p.releasedBy,
      conflictId = p.conflictId,
      conflictType = p.conflictType,
      involvedSessionIds = p.involvedSessionIds,
      details = p.details,
      resolvedAt = p.resolvedAt,
      resolvedBy = p.resolvedBy,
      resolutionAction = p.resolutionAction,
      resolutionNote = p.resolutionNote,
      sessionId = p.sessionId,
      concepts = p.concepts,
      appliedAt = p.appliedAt,
      detectedAt = p.detectedAt,
      conceptIndex = p.conceptIndex
    )
  }


  object CatalogVersionCreatedConv extends ProtoConverter[CatalogVersionCreated, CatalogVersionCreatedPO] {
    override def toProto(d: CatalogVersionCreated): CatalogVersionCreatedPO = CatalogVersionCreatedPO(
      catalogId = d.catalogId,
      tenantId = d.tenantId,
      projectId = d.projectId,
      version = d.version,
      baseVersion = d.baseVersion,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: CatalogVersionCreatedPO): CatalogVersionCreated = CatalogVersionCreated(
      catalogId = p.catalogId,
      tenantId = p.tenantId,
      projectId = p.projectId,
      version = p.version,
      baseVersion = p.baseVersion,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object KnowledgePatchedConv extends ProtoConverter[KnowledgePatched, KnowledgePatchedPO] {
    override def toProto(d: KnowledgePatched): KnowledgePatchedPO = KnowledgePatchedPO(
      catalogId = d.catalogId,
      patchSet = d.patchSet,
      patchId = d.patchId,
      patchHash = d.patchHash,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId,
      concepts = d.concepts
    )

    override def fromProto(p: KnowledgePatchedPO): KnowledgePatched = KnowledgePatched(
      catalogId = p.catalogId,
      patchSet = p.patchSet,
      patchId = p.patchId,
      patchHash = p.patchHash,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId,
      concepts = p.concepts
    )
  }


  object CatalogConflictDetectedConv extends ProtoConverter[CatalogConflictDetected, CatalogConflictDetectedPO] {
    override def toProto(d: CatalogConflictDetected): CatalogConflictDetectedPO = CatalogConflictDetectedPO(
      catalogId = d.catalogId,
      conflictSet = d.conflictSet,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: CatalogConflictDetectedPO): CatalogConflictDetected = CatalogConflictDetected(
      catalogId = p.catalogId,
      conflictSet = p.conflictSet,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object CatalogConflictResolvedConv extends ProtoConverter[CatalogConflictResolved, CatalogConflictResolvedPO] {
    override def toProto(d: CatalogConflictResolved): CatalogConflictResolvedPO = CatalogConflictResolvedPO(
      catalogId = d.catalogId,
      resolvedConflicts = d.resolvedConflicts,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: CatalogConflictResolvedPO): CatalogConflictResolved = CatalogConflictResolved(
      catalogId = p.catalogId,
      resolvedConflicts = p.resolvedConflicts,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object CatalogVersionReleasedConv extends ProtoConverter[CatalogVersionReleased, CatalogVersionReleasedPO] {
    override def toProto(d: CatalogVersionReleased): CatalogVersionReleasedPO = CatalogVersionReleasedPO(
      catalogId = d.catalogId,
      version = d.version,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: CatalogVersionReleasedPO): CatalogVersionReleased = CatalogVersionReleased(
      catalogId = p.catalogId,
      version = p.version,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object MetadataAssembledConv extends ProtoConverter[MetadataAssembled, MetadataAssembledPO] {
    override def toProto(d: MetadataAssembled): MetadataAssembledPO = MetadataAssembledPO(
      catalogId = d.catalogId,
      tenantId = d.tenantId,
      projectId = d.projectId,
      version = d.version,
      manifest = d.manifest,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: MetadataAssembledPO): MetadataAssembled = MetadataAssembled(
      catalogId = p.catalogId,
      tenantId = p.tenantId,
      projectId = p.projectId,
      version = p.version,
      manifest = p.manifest,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object MetadataExportedConv extends ProtoConverter[MetadataExported, MetadataExportedPO] {
    override def toProto(d: MetadataExported): MetadataExportedPO = MetadataExportedPO(
      catalogId = d.catalogId,
      manifest = d.manifest,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: MetadataExportedPO): MetadataExported = MetadataExported(
      catalogId = p.catalogId,
      manifest = p.manifest,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object MetadataVersionReleasedConv extends ProtoConverter[MetadataVersionReleased, MetadataVersionReleasedPO] {
    override def toProto(d: MetadataVersionReleased): MetadataVersionReleasedPO = MetadataVersionReleasedPO(
      catalogId = d.catalogId,
      version = d.version,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: MetadataVersionReleasedPO): MetadataVersionReleased = MetadataVersionReleased(
      catalogId = p.catalogId,
      version = p.version,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }

}
