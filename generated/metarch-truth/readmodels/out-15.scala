package generated.readmodel

import scala.math.BigDecimal

/** Read model: OnboardTenantDecisionView — served by undefined */
final case class ReadModelOnboardTenant(tenantId: String, name: String, ownerUserId: String, orgMemberIds: String, createdAt: String)

object ReadModelOnboardTenantView {
  def empty: ReadModelOnboardTenant = ReadModelOnboardTenant("", "", "", "", "")
  // TODO(intent): projection logic from 
}
