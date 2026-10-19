package generated.command

import net.imadz.common.CborSerializable

/** 物理删除概念（仅限 PARKED 或测试数据） */
final case class RemoveConcept(conceptId: String, reason: String, triggeredBy: String) extends CborSerializable
