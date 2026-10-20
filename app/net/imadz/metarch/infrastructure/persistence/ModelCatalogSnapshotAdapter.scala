package net.imadz.metarch.infrastructure.persistence

import akka.persistence.typed.SnapshotAdapter
import net.imadz.metarch.domain.entities.ModelCatalogEntity.ModelCatalogState
import net.imadz.metarch.infrastructure.persistence.converters.ModelCatalogProtoConverters
import net.imadz.metarch.infrastructure.proto.ModelCatalogStatePO

/**
 * ModelCatalogSnapshotAdapter: 快照适配器，负责在领域快照和protobuf快照之间进行转换
 */
class ModelCatalogSnapshotAdapter extends SnapshotAdapter[ModelCatalogState] with ModelCatalogProtoConverters {

  override def toJournal(state: ModelCatalogState): Any = {
    ModelCatalogStateConv.toProto(state)
  }

  override def fromJournal(from: Any): ModelCatalogState = {
    val proto = from.asInstanceOf[ModelCatalogStatePO]
    ModelCatalogStateConv.fromProto(proto)
  }

}
