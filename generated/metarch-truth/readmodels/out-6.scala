package generated.readmodel

import scala.math.BigDecimal

/** Read model: CreateWorkgroupDecisionView — served by undefined */
final case class ReadModelCreateWorkgroup(workgroupId: String, name: String, ownerUserId: String, memberUserIds: String, invitedUserIds: String)

object ReadModelCreateWorkgroupView {
  def empty: ReadModelCreateWorkgroup = ReadModelCreateWorkgroup("", "", "", "", "")
  // TODO(intent): projection logic from 
}
