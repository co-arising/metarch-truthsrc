package generated.command

import net.imadz.common.CborSerializable

/** 应用知识补丁 */
final case class ApplyKnowledgePatch(catalogId: String, sessionId: String, patchId: String, patchHash: String, parentPatchId: String, concepts: String, triggeredBy: String) extends CborSerializable
