package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.NoteEntity.NoteState
import net.imadz.metarch.domain.entities.NoteEntity._
import net.imadz.metarch.infrastructure.proto._

trait NoteProtoConverters extends PrimitiveConverter {

  object NoteStateConv extends ProtoConverter[NoteState, NoteStatePO] {
    override def toProto(d: NoteState): NoteStatePO = NoteStatePO(
      tenantId = d.tenantId,
      status = d.status,
      externalId = d.externalId,
      boardId = d.boardId,
      sessionId = d.sessionId,
      content = d.content,
      type = d.type,
      timeline = d.timeline,
      pivotal = d.pivotal,
      name = d.name,
      links = d.links,
      createdAt = d.createdAt,
      createdBy = d.createdBy,
      collisionName = d.collisionName,
      removedAt = d.removedAt,
      knowledgeId = d.knowledgeId,
      info = d.info
    )

    override def fromProto(p: NoteStatePO): NoteState = NoteState(
      tenantId = p.tenantId,
      status = p.status,
      externalId = p.externalId,
      boardId = p.boardId,
      sessionId = p.sessionId,
      content = p.content,
      type = p.type,
      timeline = p.timeline,
      pivotal = p.pivotal,
      name = p.name,
      links = p.links,
      createdAt = p.createdAt,
      createdBy = p.createdBy,
      collisionName = p.collisionName,
      removedAt = p.removedAt,
      knowledgeId = p.knowledgeId,
      info = p.info
    )
  }


  object NoteCapturedConv extends ProtoConverter[NoteCaptured, NoteCapturedPO] {
    override def toProto(d: NoteCaptured): NoteCapturedPO = NoteCapturedPO(
      noteId = d.noteId,
      tenantId = d.tenantId,
      sessionId = d.sessionId,
      externalId = d.externalId,
      boardId = d.boardId,
      content = d.content,
      type = d.type,
      timeline = d.timeline,
      pivotal = d.pivotal,
      name = d.name,
      links = d.links,
      info = d.info,
      stage = d.stage,
      author = d.author,
      description = d.description,
      sourceCreatedAt = d.sourceCreatedAt,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      knowledgeId = d.knowledgeId
    )

    override def fromProto(p: NoteCapturedPO): NoteCaptured = NoteCaptured(
      noteId = p.noteId,
      tenantId = p.tenantId,
      sessionId = p.sessionId,
      externalId = p.externalId,
      boardId = p.boardId,
      content = p.content,
      type = p.type,
      timeline = p.timeline,
      pivotal = p.pivotal,
      name = p.name,
      links = p.links,
      info = p.info,
      stage = p.stage,
      author = p.author,
      description = p.description,
      sourceCreatedAt = p.sourceCreatedAt,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      knowledgeId = p.knowledgeId
    )
  }


  object CollisionDetectedConv extends ProtoConverter[CollisionDetected, CollisionDetectedPO] {
    override def toProto(d: CollisionDetected): CollisionDetectedPO = CollisionDetectedPO(
      noteId = d.noteId,
      name = d.name,
      conflictingNoteIds = d.conflictingNoteIds,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: CollisionDetectedPO): CollisionDetected = CollisionDetected(
      noteId = p.noteId,
      name = p.name,
      conflictingNoteIds = p.conflictingNoteIds,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object CollisionResolvedConv extends ProtoConverter[CollisionResolved, CollisionResolvedPO] {
    override def toProto(d: CollisionResolved): CollisionResolvedPO = CollisionResolvedPO(
      noteId = d.noteId,
      resolution = d.resolution,
      newName = d.newName,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId,
      targetKnowledgeId = d.targetKnowledgeId
    )

    override def fromProto(p: CollisionResolvedPO): CollisionResolved = CollisionResolved(
      noteId = p.noteId,
      resolution = p.resolution,
      newName = p.newName,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId,
      targetKnowledgeId = p.targetKnowledgeId
    )
  }


  object NoteContentUpdatedConv extends ProtoConverter[NoteContentUpdated, NoteContentUpdatedPO] {
    override def toProto(d: NoteContentUpdated): NoteContentUpdatedPO = NoteContentUpdatedPO(
      noteId = d.noteId,
      content = d.content,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId,
      description = d.description
    )

    override def fromProto(p: NoteContentUpdatedPO): NoteContentUpdated = NoteContentUpdated(
      noteId = p.noteId,
      content = p.content,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId,
      description = p.description
    )
  }


  object NoteRemovedConv extends ProtoConverter[NoteRemoved, NoteRemovedPO] {
    override def toProto(d: NoteRemoved): NoteRemovedPO = NoteRemovedPO(
      noteId = d.noteId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: NoteRemovedPO): NoteRemoved = NoteRemoved(
      noteId = p.noteId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object NoteInfoUpdatedConv extends ProtoConverter[NoteInfoUpdated, NoteInfoUpdatedPO] {
    override def toProto(d: NoteInfoUpdated): NoteInfoUpdatedPO = NoteInfoUpdatedPO(
      noteId = d.noteId,
      info = d.info,
      links = d.links,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: NoteInfoUpdatedPO): NoteInfoUpdated = NoteInfoUpdated(
      noteId = p.noteId,
      info = p.info,
      links = p.links,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }

}
