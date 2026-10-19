package generated.readmodel

import scala.math.BigDecimal

/** Read model: UpdateUserProfileDecisionView — served by  */
final case class ReadModelUpdateUserProfile(userId: String, email: String, authMethod: String, displayName: String, registeredAt: String, phoneNumber: String)

object ReadModelUpdateUserProfileView {
  def empty: ReadModelUpdateUserProfile = ReadModelUpdateUserProfile("", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
