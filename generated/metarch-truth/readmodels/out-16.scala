package generated.readmodel

import scala.math.BigDecimal

/** Read model: OpenSessionDecisionView — served by  */
final case class ReadModelOpenSession(stageId: String, workshopId: String, order: String, name: String, activatedAt: String, approvedAt: String, rejectedAt: String, rejectionReason: String, sessionId: String, participantUserIds: String)

object ReadModelOpenSessionView {
  def empty: ReadModelOpenSession = ReadModelOpenSession("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
