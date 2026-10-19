package generated.command

import net.imadz.common.CborSerializable

/** 邀请成员进入本次会话 */
final case class InviteParticipant(sessionId: String, userId: String, triggeredBy: String, displayName: String, email: String, phoneNumber: String) extends CborSerializable
