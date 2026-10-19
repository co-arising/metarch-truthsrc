package generated.command

import net.imadz.common.CborSerializable

/** 声明一个状态字段（含写血缘） */
final case class DeclareStateField(definitionId: String, fieldSpec: String, tenantId: String, triggeredBy: String) extends CborSerializable
