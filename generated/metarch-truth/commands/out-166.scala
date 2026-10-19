package generated.command

import net.imadz.common.CborSerializable

/** 解绑一条角色-命令绑定（记录原因） */
final case class UnbindCommand(bindingId: String, reason: String, tenantId: String, triggeredBy: String) extends CborSerializable
