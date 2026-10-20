package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.ConceptEntity.ConceptState
import net.imadz.metarch.domain.entities.ConceptEntity._
import net.imadz.metarch.infrastructure.proto._

trait ConceptProtoConverters extends PrimitiveConverter {

  object ConceptStateConv extends ProtoConverter[ConceptState, ConceptStatePO] {
    override def toProto(d: ConceptState): ConceptStatePO = ConceptStatePO(
      tenantId = d.tenantId,
      status = d.status,
      version = d.version,
      contextId = d.contextId,
      name = d.name,
      kind = d.kind,
      description = d.description,
      sourceStage = d.sourceStage,
      sourceNoteIds = d.sourceNoteIds,
      hasConflictWarning = d.hasConflictWarning,
      establishedAt = d.establishedAt,
      establishedBy = d.establishedBy,
      parkedAt = d.parkedAt,
      parkedBy = d.parkedBy,
      removedAt = d.removedAt,
      removedBy = d.removedBy,
      createdAt = d.createdAt,
      createdBy = d.createdBy,
      modifiedAt = d.modifiedAt,
      modifiedBy = d.modifiedBy,
      machineSpec = d.machineSpec,
      metadata = d.metadata,
      sourceSessionId = d.sourceSessionId,
      contentHash = d.contentHash,
      anchors = d.anchors
    )

    override def fromProto(p: ConceptStatePO): ConceptState = ConceptState(
      tenantId = p.tenantId,
      status = p.status,
      version = p.version,
      contextId = p.contextId,
      name = p.name,
      kind = p.kind,
      description = p.description,
      sourceStage = p.sourceStage,
      sourceNoteIds = p.sourceNoteIds,
      hasConflictWarning = p.hasConflictWarning,
      establishedAt = p.establishedAt,
      establishedBy = p.establishedBy,
      parkedAt = p.parkedAt,
      parkedBy = p.parkedBy,
      removedAt = p.removedAt,
      removedBy = p.removedBy,
      createdAt = p.createdAt,
      createdBy = p.createdBy,
      modifiedAt = p.modifiedAt,
      modifiedBy = p.modifiedBy,
      machineSpec = p.machineSpec,
      metadata = p.metadata,
      sourceSessionId = p.sourceSessionId,
      contentHash = p.contentHash,
      anchors = p.anchors
    )
  }


  object ConceptParkedConv extends ProtoConverter[ConceptParked, ConceptParkedPO] {
    override def toProto(d: ConceptParked): ConceptParkedPO = ConceptParkedPO(
      conceptId = d.conceptId,
      reason = d.reason,
      lastVersion = d.lastVersion,
      newVersion = d.newVersion,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ConceptParkedPO): ConceptParked = ConceptParked(
      conceptId = p.conceptId,
      reason = p.reason,
      lastVersion = p.lastVersion,
      newVersion = p.newVersion,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object ConceptUnparkedConv extends ProtoConverter[ConceptUnparked, ConceptUnparkedPO] {
    override def toProto(d: ConceptUnparked): ConceptUnparkedPO = ConceptUnparkedPO(
      conceptId = d.conceptId,
      lastVersion = d.lastVersion,
      newVersion = d.newVersion,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ConceptUnparkedPO): ConceptUnparked = ConceptUnparked(
      conceptId = p.conceptId,
      lastVersion = p.lastVersion,
      newVersion = p.newVersion,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object ConceptEstablishedConv extends ProtoConverter[ConceptEstablished, ConceptEstablishedPO] {
    override def toProto(d: ConceptEstablished): ConceptEstablishedPO = ConceptEstablishedPO(
      conceptId = d.conceptId,
      conceptIds = d.conceptIds,
      tenantId = d.tenantId,
      contextId = d.contextId,
      name = d.name,
      noteId = d.noteId,
      kind = d.kind,
      description = d.description,
      sourceStage = d.sourceStage,
      sourceNoteIds = d.sourceNoteIds,
      machineSpec = d.machineSpec,
      metadata = d.metadata,
      lastVersion = d.lastVersion,
      newVersion = d.newVersion,
      createdAt = d.createdAt,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      sourceSessionId = d.sourceSessionId
    )

    override def fromProto(p: ConceptEstablishedPO): ConceptEstablished = ConceptEstablished(
      conceptId = p.conceptId,
      conceptIds = p.conceptIds,
      tenantId = p.tenantId,
      contextId = p.contextId,
      name = p.name,
      noteId = p.noteId,
      kind = p.kind,
      description = p.description,
      sourceStage = p.sourceStage,
      sourceNoteIds = p.sourceNoteIds,
      machineSpec = p.machineSpec,
      metadata = p.metadata,
      lastVersion = p.lastVersion,
      newVersion = p.newVersion,
      createdAt = p.createdAt,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      sourceSessionId = p.sourceSessionId
    )
  }


  object ConceptDeprecatedConv extends ProtoConverter[ConceptDeprecated, ConceptDeprecatedPO] {
    override def toProto(d: ConceptDeprecated): ConceptDeprecatedPO = ConceptDeprecatedPO(
      conceptId = d.conceptId,
      reason = d.reason,
      lastVersion = d.lastVersion,
      newVersion = d.newVersion,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ConceptDeprecatedPO): ConceptDeprecated = ConceptDeprecated(
      conceptId = p.conceptId,
      reason = p.reason,
      lastVersion = p.lastVersion,
      newVersion = p.newVersion,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object ConceptUpdatedConv extends ProtoConverter[ConceptUpdated, ConceptUpdatedPO] {
    override def toProto(d: ConceptUpdated): ConceptUpdatedPO = ConceptUpdatedPO(
      conceptId = d.conceptId,
      changedFields = d.changedFields,
      lastVersion = d.lastVersion,
      newVersion = d.newVersion,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ConceptUpdatedPO): ConceptUpdated = ConceptUpdated(
      conceptId = p.conceptId,
      changedFields = p.changedFields,
      lastVersion = p.lastVersion,
      newVersion = p.newVersion,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object ConceptConflictWarningCreatedConv extends ProtoConverter[ConceptConflictWarningCreated, ConceptConflictWarningCreatedPO] {
    override def toProto(d: ConceptConflictWarningCreated): ConceptConflictWarningCreatedPO = ConceptConflictWarningCreatedPO(
      conceptId = d.conceptId,
      conflictDetails = d.conflictDetails,
      lastVersion = d.lastVersion,
      newVersion = d.newVersion,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ConceptConflictWarningCreatedPO): ConceptConflictWarningCreated = ConceptConflictWarningCreated(
      conceptId = p.conceptId,
      conflictDetails = p.conflictDetails,
      lastVersion = p.lastVersion,
      newVersion = p.newVersion,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object ConceptConflictWarningResolvedConv extends ProtoConverter[ConceptConflictWarningResolved, ConceptConflictWarningResolvedPO] {
    override def toProto(d: ConceptConflictWarningResolved): ConceptConflictWarningResolvedPO = ConceptConflictWarningResolvedPO(
      conceptId = d.conceptId,
      resolution = d.resolution,
      lastVersion = d.lastVersion,
      newVersion = d.newVersion,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ConceptConflictWarningResolvedPO): ConceptConflictWarningResolved = ConceptConflictWarningResolved(
      conceptId = p.conceptId,
      resolution = p.resolution,
      lastVersion = p.lastVersion,
      newVersion = p.newVersion,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object ConceptRemovedConv extends ProtoConverter[ConceptRemoved, ConceptRemovedPO] {
    override def toProto(d: ConceptRemoved): ConceptRemovedPO = ConceptRemovedPO(
      conceptId = d.conceptId,
      reason = d.reason,
      lastVersion = d.lastVersion,
      newVersion = d.newVersion,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ConceptRemovedPO): ConceptRemoved = ConceptRemoved(
      conceptId = p.conceptId,
      reason = p.reason,
      lastVersion = p.lastVersion,
      newVersion = p.newVersion,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object ConceptsMergedConv extends ProtoConverter[ConceptsMerged, ConceptsMergedPO] {
    override def toProto(d: ConceptsMerged): ConceptsMergedPO = ConceptsMergedPO(
      sourceConceptId = d.sourceConceptId,
      targetConceptId = d.targetConceptId,
      lastVersion = d.lastVersion,
      newVersion = d.newVersion,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ConceptsMergedPO): ConceptsMerged = ConceptsMerged(
      sourceConceptId = p.sourceConceptId,
      targetConceptId = p.targetConceptId,
      lastVersion = p.lastVersion,
      newVersion = p.newVersion,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object ConceptLandingsRecordedConv extends ProtoConverter[ConceptLandingsRecorded, ConceptLandingsRecordedPO] {
    override def toProto(d: ConceptLandingsRecorded): ConceptLandingsRecordedPO = ConceptLandingsRecordedPO(
      conceptId = d.conceptId,
      anchors = d.anchors,
      lastVersion = d.lastVersion,
      newVersion = d.newVersion,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId,
      guards = d.guards,
      aggregateRuleRefs = d.aggregateRuleRefs,
      preconditionRefs = d.preconditionRefs,
      postconditionRefs = d.postconditionRefs,
      fields = d.fields,
      emits = d.emits,
      folds = d.folds,
      emissions = d.emissions,
      steps = d.steps,
      extensions = d.extensions,
      ucWrites = d.ucWrites,
      ucPublishes = d.ucPublishes
    )

    override def fromProto(p: ConceptLandingsRecordedPO): ConceptLandingsRecorded = ConceptLandingsRecorded(
      conceptId = p.conceptId,
      anchors = p.anchors,
      lastVersion = p.lastVersion,
      newVersion = p.newVersion,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId,
      guards = p.guards,
      aggregateRuleRefs = p.aggregateRuleRefs,
      preconditionRefs = p.preconditionRefs,
      postconditionRefs = p.postconditionRefs,
      fields = p.fields,
      emits = p.emits,
      folds = p.folds,
      emissions = p.emissions,
      steps = p.steps,
      extensions = p.extensions,
      ucWrites = p.ucWrites,
      ucPublishes = p.ucPublishes
    )
  }

}
