package generated.command

import net.imadz.common.CborSerializable

/** 【S2-70 ③】跳过一个工作坊阶段 */
final case class SkipStage(stageId: String, triggeredBy: String) extends CborSerializable
