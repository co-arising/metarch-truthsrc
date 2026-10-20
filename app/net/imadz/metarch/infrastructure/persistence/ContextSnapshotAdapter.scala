package net.imadz.metarch.infrastructure.persistence

import akka.persistence.typed.SnapshotAdapter
import net.imadz.metarch.domain.entities.ContextEntity.ContextState
import net.imadz.metarch.infrastructure.persistence.converters.ContextProtoConverters
import net.imadz.metarch.infrastructure.proto.ContextStatePO

/**
 * ContextSnapshotAdapter: 快照适配器，负责在领域快照和protobuf快照之间进行转换
 */
class ContextSnapshotAdapter extends SnapshotAdapter[ContextState] with ContextProtoConverters {

  override def toJournal(state: ContextState): Any = {
    ContextStateConv.toProto(state)
  }

  override def fromJournal(from: Any): ContextState = {
    val proto = from.asInstanceOf[ContextStatePO]
    ContextStateConv.fromProto(proto)
  }

}
