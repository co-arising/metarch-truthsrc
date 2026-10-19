package generated.command

import net.imadz.common.CborSerializable

/** 受邀用户接受邀请 */
final case class AcceptWorkgroupInvitation(workgroupId: String, userId: String, triggeredBy: String) extends CborSerializable
