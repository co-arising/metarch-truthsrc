package generated.command

import net.imadz.common.CborSerializable

/** 登记一个真源键的包装/裁决面（per-key 不可再生成文本） */
final case class RecordTruthProvenance(provenanceId: String, sourceKey: String, payloadJson: String, tenantId: String, triggeredBy: String) extends CborSerializable
