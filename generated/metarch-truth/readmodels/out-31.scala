package generated.readmodel

import scala.math.BigDecimal

/** Read model: UpdateUserProfileDecisionView — served by undefined */
final case class ReadModelUpdateUserProfile(userId: String, email: String, authMethod: String, displayName: String, registeredAt: String)

object ReadModelUpdateUserProfileView {
  def empty: ReadModelUpdateUserProfile = ReadModelUpdateUserProfile("", "", "", "", "")
  // TODO(intent): projection logic from 
}
