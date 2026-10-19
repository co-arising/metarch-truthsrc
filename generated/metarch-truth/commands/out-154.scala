package generated.command

import net.imadz.common.CborSerializable

/** 剪除一条写血缘（✂ 断来源） */
final case class CutWrittenBy(definitionId: String, fieldName: String, writtenBy: String, tenantId: String, triggeredBy: String) extends CborSerializable
