package generated.readmodel

import scala.math.BigDecimal

/** Read model: AcceptTenantInvitationDecisionView — served by undefined */
final case class ReadModelAcceptTenantInvitation(tenantId: String, userId: String, status: String, department: String, jobTitle: String)

object ReadModelAcceptTenantInvitationView {
  def empty: ReadModelAcceptTenantInvitation = ReadModelAcceptTenantInvitation("", "", "", "", "")
  // TODO(intent): projection logic from 
}
