package generated.command

import net.imadz.common.CborSerializable

/** 创建新版本 */
final case class CreateCatalogVersion(tenantId: String, projectId: String, version: String, baseVersion: String, triggeredBy: String, catalogId: String) extends CborSerializable
