package generated.command

import net.imadz.common.CborSerializable

/** 声明一个命令（含参数集） */
final case class DeclareCommand(definitionId: String, commandSpec: String, tenantId: String, triggeredBy: String) extends CborSerializable
