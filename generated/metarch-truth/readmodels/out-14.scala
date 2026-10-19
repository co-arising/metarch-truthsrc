package generated.readmodel

import scala.math.BigDecimal

/** Read model: InviteWorkgroupMemberDecisionView — served by undefined */
final case class ReadModelInviteWorkgroupMember(workgroupId: String, name: String, ownerUserId: String, memberUserIds: String, invitedUserIds: String)

object ReadModelInviteWorkgroupMemberView {
  def empty: ReadModelInviteWorkgroupMember = ReadModelInviteWorkgroupMember("", "", "", "", "")
  // TODO(intent): projection logic from 
}
