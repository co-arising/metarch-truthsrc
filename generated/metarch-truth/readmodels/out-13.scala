package generated.readmodel

import scala.math.BigDecimal

/** Read model: InviteTenantMemberDecisionView — served by undefined */
final case class ReadModelInviteTenantMember(tenantId: String, userId: String, status: String, department: String, jobTitle: String)

object ReadModelInviteTenantMemberView {
  def empty: ReadModelInviteTenantMember = ReadModelInviteTenantMember("", "", "", "", "")
  // TODO(intent): projection logic from 
}
