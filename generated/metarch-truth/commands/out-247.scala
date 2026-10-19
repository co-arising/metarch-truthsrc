package generated.command

import net.imadz.common.CborSerializable

/** 激活一个工作坊阶段 */
final case class ActivateStage(tenantId: String, stageId: String, workshopId: String, order: String, name: String, triggeredBy: String) extends CborSerializable
