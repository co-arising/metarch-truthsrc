package generated.command

import net.imadz.common.CborSerializable

/** 移除成员 */
final case class RemoveWorkgroupMember(workgroupId: String, userId: String, triggeredBy: String) extends CborSerializable
