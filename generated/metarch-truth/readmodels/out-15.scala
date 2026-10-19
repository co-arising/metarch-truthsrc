package generated.readmodel

import scala.math.BigDecimal

/** Read model: OnboardTenantDecisionView — served by  */
final case class ReadModelOnboardTenant(tenantId: String, name: String, ownerUserId: String, orgMemberIds: String, createdAt: String, createdBy: String, suspendedAt: String, archivedAt: String)

object ReadModelOnboardTenantView {
  def empty: ReadModelOnboardTenant = ReadModelOnboardTenant("", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
