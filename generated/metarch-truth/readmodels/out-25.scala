package generated.readmodel

import scala.math.BigDecimal

/** Read model: RevokeInvitationDecisionView — served by  */
final case class ReadModelRevokeInvitation(tenantId: String, userId: String, status: String, department: String, jobTitle: String, displayName: String, email: String, phoneNumber: String, joinedAt: String, removedAt: String)

object ReadModelRevokeInvitationView {
  def empty: ReadModelRevokeInvitation = ReadModelRevokeInvitation("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
