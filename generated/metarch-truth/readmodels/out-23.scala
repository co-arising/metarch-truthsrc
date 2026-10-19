package generated.readmodel

import scala.math.BigDecimal

/** Read model: ResendInvitationDecisionView — served by undefined */
final case class ReadModelResendInvitation(tenantId: String, userId: String, status: String, department: String, jobTitle: String)

object ReadModelResendInvitationView {
  def empty: ReadModelResendInvitation = ReadModelResendInvitation("", "", "", "", "")
  // TODO(intent): projection logic from 
}
