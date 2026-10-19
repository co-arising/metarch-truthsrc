package generated.command

import net.imadz.common.CborSerializable

/** 知识管理员退回合并请求（MERGE_REQUESTED→READY_TO_MERGE·需追加先退回） */
final case class DeclineKnowledgeMerge(patchId: String, reason: String, triggeredBy: String) extends CborSerializable
