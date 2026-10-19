package generated.command

import net.imadz.common.CborSerializable

/** 重命名聚合描述 */
final case class RenameDescription(definitionId: String, description: String, tenantId: String, triggeredBy: String) extends CborSerializable
