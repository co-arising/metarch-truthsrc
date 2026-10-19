package generated.command

import net.imadz.common.CborSerializable

/** 接受邀请 */
final case class AcceptTenantInvitation(invitationId: String, triggeredBy: String) extends CborSerializable
