package generated.readmodel

import scala.math.BigDecimal

/** Read model: InitiateProjectDecisionView — served by undefined */
final case class ReadModelInitiateProject(projectId: String, workgroupId: String, ownerUserId: String, name: String, description: String)

object ReadModelInitiateProjectView {
  def empty: ReadModelInitiateProject = ReadModelInitiateProject("", "", "", "", "")
  // TODO(intent): projection logic from 
}
