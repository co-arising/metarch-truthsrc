package generated.readmodel

import scala.math.BigDecimal

/** Read model: RoleCommandBindingDecisionView — served by undefined */
final case class ReadModelRoleCommandBinding(bindingId: String, boundAt: String, boundBy: String, commandName: String, roleName: String)

object ReadModelRoleCommandBindingView {
  def empty: ReadModelRoleCommandBinding = ReadModelRoleCommandBinding("", "", "", "", "")
  // TODO(intent): projection logic from 
}
