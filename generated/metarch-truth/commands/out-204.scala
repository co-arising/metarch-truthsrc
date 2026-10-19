package generated.command

import net.imadz.common.CborSerializable

/** 修复冲突 */
final case class ResolveCatalogConflict(catalogId: String, conflictId: String, resolutionAction: String, resolutionNote: String, triggeredBy: String) extends CborSerializable
