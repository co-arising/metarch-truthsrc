package generated.command

import net.imadz.common.CborSerializable

/** 修补边属性（归属聚合/判定来源/置信度） */
final case class PatchEdge(edgeId: String, aggregateName: String, sources: String, confidence: String, tenantId: String, triggeredBy: String) extends CborSerializable
