package generated.command

import net.imadz.common.CborSerializable

/** 邀请成员 */
final case class InviteTenantMember(invitationId: String, tenantId: String, userId: String, invitedBy: String, expiresAt: String, triggeredBy: String, displayName: String, email: String, phoneNumber: String) extends CborSerializable
