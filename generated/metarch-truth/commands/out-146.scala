package generated.command

import net.imadz.common.CborSerializable

/** 元数据工程师驳回补丁（冲突未解决·人修改后重提） */
final case class RejectKnowledgePatch(patchId: String, reason: String, triggeredBy: String) extends CborSerializable
