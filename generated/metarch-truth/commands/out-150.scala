package generated.command

import net.imadz.common.CborSerializable

/** 为命令追加/替换一个参数 */
final case class AddCommandParameter(definitionId: String, commandName: String, paramSpec: String, tenantId: String, triggeredBy: String) extends CborSerializable
