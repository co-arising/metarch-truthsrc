package generated.command

import net.imadz.common.CborSerializable

/** 教练发起工作坊级就绪评审（圈定评审范围 targetSessionIds 与工作坊补丁·Workshop:DoR:Patch=1:1:1） */
final case class RequestDoR(dorId: String, tenantId: String, workshopId: String, patchId: String, projectId: String, targetSessionIds: String, triggeredBy: String) extends CborSerializable
