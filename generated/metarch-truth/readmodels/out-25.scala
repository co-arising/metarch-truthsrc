package generated.readmodel

import scala.math.BigDecimal

/** Read model: RevokeInvitationDecisionView — served by undefined */
final case class ReadModelRevokeInvitation(tenantId: String, userId: String, status: String, department: String, jobTitle: String)

object ReadModelRevokeInvitationView {
  def empty: ReadModelRevokeInvitation = ReadModelRevokeInvitation("", "", "", "", "")
  // TODO(intent): projection logic from 
}
