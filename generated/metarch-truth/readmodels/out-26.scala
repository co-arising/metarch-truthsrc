package generated.readmodel

import scala.math.BigDecimal

/** Read model: RoleCommandBindingDecisionView — served by  */
final case class ReadModelRoleCommandBinding(bindingId: String, boundAt: String, boundBy: String, commandName: String, roleName: String, ruling: String, status: String, systemCommand: String, tenantId: String, unboundAt: String)

object ReadModelRoleCommandBindingView {
  def empty: ReadModelRoleCommandBinding = ReadModelRoleCommandBinding("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
