package generated.command

import net.imadz.common.CborSerializable

/** 知识管理员批准合并请求（正式合并知识进目录·解决冲突后落盘） */
final case class MergeKnowledgePatch(patchId: String, catalogId: String) extends CborSerializable
