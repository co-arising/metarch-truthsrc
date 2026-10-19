package generated.readmodel

import scala.math.BigDecimal

/** Read model: RemoveTenantMemberDecisionView — served by  */
final case class ReadModelRemoveTenantMember(tenantId: String, userId: String, status: String, department: String, jobTitle: String, displayName: String, email: String, phoneNumber: String, joinedAt: String, removedAt: String)

object ReadModelRemoveTenantMemberView {
  def empty: ReadModelRemoveTenantMember = ReadModelRemoveTenantMember("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
