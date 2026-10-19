package generated.command

import net.imadz.common.CborSerializable

/** 将源概念合并到目标概念（预留，用于跨工作坊） */
final case class MergeConcepts(sourceConceptId: String, targetConceptId: String, triggeredBy: String) extends CborSerializable
