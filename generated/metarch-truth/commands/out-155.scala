package generated.command

import net.imadz.common.CborSerializable

/** 声明一个事件（含载荷集） */
final case class DeclareEvent(definitionId: String, eventSpec: String, tenantId: String, triggeredBy: String) extends CborSerializable
