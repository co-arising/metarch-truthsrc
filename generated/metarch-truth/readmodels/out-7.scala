package generated.readmodel

import scala.math.BigDecimal

/** Read model: DeactivateUserDecisionView — served by undefined */
final case class ReadModelDeactivateUser(userId: String, email: String, authMethod: String, displayName: String, registeredAt: String)

object ReadModelDeactivateUserView {
  def empty: ReadModelDeactivateUser = ReadModelDeactivateUser("", "", "", "", "")
  // TODO(intent): projection logic from 
}
