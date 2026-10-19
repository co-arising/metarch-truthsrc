package generated.readmodel

import scala.math.BigDecimal

/** Read model: OpenSessionDecisionView — served by undefined */
final case class ReadModelOpenSession(stageId: String, workshopId: String, order: String, name: String, activatedAt: String)

object ReadModelOpenSessionView {
  def empty: ReadModelOpenSession = ReadModelOpenSession("", "", "", "", "")
  // TODO(intent): projection logic from 
}
