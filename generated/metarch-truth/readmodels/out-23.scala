package generated.readmodel

import scala.math.BigDecimal

/** Read model: ResendInvitationDecisionView — served by  */
final case class ReadModelResendInvitation(tenantId: String, userId: String, status: String, department: String, jobTitle: String, displayName: String, email: String, phoneNumber: String, joinedAt: String, removedAt: String)

object ReadModelResendInvitationView {
  def empty: ReadModelResendInvitation = ReadModelResendInvitation("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
