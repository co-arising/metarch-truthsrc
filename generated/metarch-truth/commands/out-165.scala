package generated.command

import net.imadz.common.CborSerializable

/** 补写血缘（追加一条 writtenBy·去重） */
final case class AddWrittenBy(definitionId: String, fieldName: String, writtenBy: String, tenantId: String, triggeredBy: String) extends CborSerializable
