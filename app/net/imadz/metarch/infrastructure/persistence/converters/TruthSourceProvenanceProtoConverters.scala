package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.TruthSourceProvenanceEntity.TruthSourceProvenanceState
import net.imadz.metarch.domain.entities.TruthSourceProvenanceEntity._
import net.imadz.metarch.infrastructure.proto._

trait TruthSourceProvenanceProtoConverters extends PrimitiveConverter {

  object TruthSourceProvenanceStateConv extends ProtoConverter[TruthSourceProvenanceState, TruthSourceProvenanceStatePO] {
    override def toProto(d: TruthSourceProvenanceState): TruthSourceProvenanceStatePO = TruthSourceProvenanceStatePO(
      tenantId = d.tenantId,
      sourceKey = d.sourceKey,
      payloadJson = d.payloadJson,
      recordedAt = d.recordedAt,
      recordedBy = d.recordedBy
    )

    override def fromProto(p: TruthSourceProvenanceStatePO): TruthSourceProvenanceState = TruthSourceProvenanceState(
      tenantId = p.tenantId,
      sourceKey = p.sourceKey,
      payloadJson = p.payloadJson,
      recordedAt = p.recordedAt,
      recordedBy = p.recordedBy
    )
  }


  object TruthProvenanceRecordedConv extends ProtoConverter[TruthProvenanceRecorded, TruthProvenanceRecordedPO] {
    override def toProto(d: TruthProvenanceRecorded): TruthProvenanceRecordedPO = TruthProvenanceRecordedPO(
      provenanceId = d.provenanceId,
      sourceKey = d.sourceKey,
      payloadJson = d.payloadJson,
      recordedBy = d.recordedBy,
      tenantId = d.tenantId,
      recordedAt = d.recordedAt,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: TruthProvenanceRecordedPO): TruthProvenanceRecorded = TruthProvenanceRecorded(
      provenanceId = p.provenanceId,
      sourceKey = p.sourceKey,
      payloadJson = p.payloadJson,
      recordedBy = p.recordedBy,
      tenantId = p.tenantId,
      recordedAt = p.recordedAt,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }

}
