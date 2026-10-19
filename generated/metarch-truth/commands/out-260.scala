package generated.command

import net.imadz.common.CborSerializable

/** 邀请用户加入工作组 */
final case class InviteWorkgroupMember(workgroupId: String, userId: String, triggeredBy: String, displayName: String, email: String, phoneNumber: String) extends CborSerializable
