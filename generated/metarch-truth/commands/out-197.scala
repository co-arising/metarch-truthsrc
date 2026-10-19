package generated.command

import net.imadz.common.CborSerializable

/** 【新增】重发邀请 */
final case class ResendInvitation(invitationId: String, newExpiresAt: String, triggeredBy: String) extends CborSerializable
