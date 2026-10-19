package generated.readmodel

import scala.math.BigDecimal

/** Read model: InviteWorkgroupMemberDecisionView — served by  */
final case class ReadModelInviteWorkgroupMember(workgroupId: String, name: String, ownerUserId: String, memberUserIds: String, invitedUserIds: String, createdAt: String, createdBy: String, archivedAt: String, tenantId: String)

object ReadModelInviteWorkgroupMemberView {
  def empty: ReadModelInviteWorkgroupMember = ReadModelInviteWorkgroupMember("", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
