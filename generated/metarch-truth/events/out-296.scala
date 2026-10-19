package generated.event

import net.imadz.common.CborSerializable

/** 补丁合并已提交目录应用（**非终态**——catalog 确认后才由 ConfirmPatchMerged 发 KnowledgePatchMerged） */
final case class KnowledgePatchMergeCommitted() extends CborSerializable
