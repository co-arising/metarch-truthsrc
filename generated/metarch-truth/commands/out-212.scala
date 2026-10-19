package generated.command

import net.imadz.common.CborSerializable

/** 发布版本 */
final case class ReleaseCatalogVersion(catalogId: String, version: String, triggeredBy: String) extends CborSerializable
