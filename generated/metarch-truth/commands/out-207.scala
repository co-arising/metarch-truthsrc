package generated.command

import net.imadz.common.CborSerializable

/** 元数据工程师提交知识补丁（Stage1-7 交付物 → Concepts/Relations 差异集，git commit 类比） */
final case class SubmitKnowledgePatch(patchId: String, sessionId: String, catalogId: String, contextId: String, parentPatchId: String, concepts: String, relations: String, tenantId: String) extends CborSerializable
