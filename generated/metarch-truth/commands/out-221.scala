package generated.command

import net.imadz.common.CborSerializable

/** 导出元数据 JSON（多 schema + manifest） */
final case class ExportMetadata(catalogId: String, manifest: String, triggeredBy: String) extends CborSerializable
