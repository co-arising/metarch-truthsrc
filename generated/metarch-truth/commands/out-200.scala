package generated.command

import net.imadz.common.CborSerializable

/** 为专项安排一次完整工作坊 */
final case class ScheduleWorkshop(workshopId: String, tenantId: String, projectId: String, scheduledAt: String, triggeredBy: String) extends CborSerializable
