package generated.readmodel

import scala.math.BigDecimal

/** Read model: RemoveTenantMemberDecisionView — served by undefined */
final case class ReadModelRemoveTenantMember(tenantId: String, userId: String, status: String, department: String, jobTitle: String)

object ReadModelRemoveTenantMemberView {
  def empty: ReadModelRemoveTenantMember = ReadModelRemoveTenantMember("", "", "", "", "")
  // TODO(intent): projection logic from 
}
