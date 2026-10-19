package generated.command

import net.imadz.common.CborSerializable

/** 【S2-70 ③】驳回一个工作坊阶段 */
final case class RejectStage(stageId: String, rejectionReason: String, triggeredBy: String) extends CborSerializable
