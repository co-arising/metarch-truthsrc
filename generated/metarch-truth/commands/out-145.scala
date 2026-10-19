package generated.command

import net.imadz.common.CborSerializable

/** 元数据工程师确认补丁就绪（PENDING→READY_TO_MERGE·多 session 累积完成） */
final case class ConfirmKnowledgeReady(patchId: String, triggeredBy: String) extends CborSerializable
