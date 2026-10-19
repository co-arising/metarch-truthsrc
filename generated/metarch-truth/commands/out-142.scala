package generated.command

import net.imadz.common.CborSerializable

/** 检测概念冲突（确立后自动触发·产生冲突预警） */
final case class DetectConceptConflict(conceptId: String, triggeredBy: String) extends CborSerializable
