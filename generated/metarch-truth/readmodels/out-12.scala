package generated.readmodel

import scala.math.BigDecimal

/** Read model: InitiateProjectDecisionView — served by  */
final case class ReadModelInitiateProject(projectId: String, workgroupId: String, ownerUserId: String, name: String, description: String, createdAt: String, createdBy: String, startedAt: String, workshopName: String, completedAt: String)

object ReadModelInitiateProjectView {
  def empty: ReadModelInitiateProject = ReadModelInitiateProject("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
