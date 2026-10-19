package generated.readmodel

import scala.math.BigDecimal

/** Read model: CreateWorkgroupDecisionView — served by  */
final case class ReadModelCreateWorkgroup(workgroupId: String, name: String, ownerUserId: String, memberUserIds: String, invitedUserIds: String, createdAt: String, createdBy: String, archivedAt: String, tenantId: String)

object ReadModelCreateWorkgroupView {
  def empty: ReadModelCreateWorkgroup = ReadModelCreateWorkgroup("", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
