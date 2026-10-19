package generated.readmodel

import scala.math.BigDecimal

/** Read model: ScheduleWorkshopDecisionView — served by  */
final case class ReadModelScheduleWorkshop(workshopId: String, projectId: String, scheduledAt: String, startedAt: String, completedAt: String, patchId: String, tenantId: String, memberRoles: String)

object ReadModelScheduleWorkshopView {
  def empty: ReadModelScheduleWorkshop = ReadModelScheduleWorkshop("", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
