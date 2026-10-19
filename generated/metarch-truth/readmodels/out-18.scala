package generated.readmodel

import scala.math.BigDecimal

/** Read model: PauseProjectDecisionView — served by undefined */
final case class ReadModelPauseProject(projectId: String, workgroupId: String, ownerUserId: String, name: String, description: String)

object ReadModelPauseProjectView {
  def empty: ReadModelPauseProject = ReadModelPauseProject("", "", "", "", "")
  // TODO(intent): projection logic from 
}
