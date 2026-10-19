package generated.command

import net.imadz.common.CborSerializable

/** 撤回邀请 */
final case class RevokeInvitation(invitationId: String, triggeredBy: String) extends CborSerializable
