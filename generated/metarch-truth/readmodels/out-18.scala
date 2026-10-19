package generated.readmodel

import scala.math.BigDecimal

/** Read model: PauseProjectDecisionView — served by  */
final case class ReadModelPauseProject(projectId: String, workgroupId: String, ownerUserId: String, name: String, description: String, createdAt: String, createdBy: String, startedAt: String, completedAt: String, pausedAt: String)

object ReadModelPauseProjectView {
  def empty: ReadModelPauseProject = ReadModelPauseProject("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
