package generated.command

import net.imadz.common.CborSerializable

/** 【S2-70 ③】批准一个工作坊阶段 */
final case class ApproveStage(stageId: String, triggeredBy: String) extends CborSerializable
