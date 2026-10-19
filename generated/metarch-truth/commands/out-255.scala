package generated.command

import net.imadz.common.CborSerializable

/** 组装骨架元数据 */
final case class AssembleMetadata(tenantId: String, projectId: String, version: String, manifest: String, triggeredBy: String, catalogId: String) extends CborSerializable
