package generated.command

import net.imadz.common.CborSerializable

/** 绑定角色到命令（role_command_map 入库主口） */
final case class BindCommand(bindingId: String, roleName: String, commandName: String, ruling: String, systemCommand: String, tenantId: String, triggeredBy: String) extends CborSerializable
