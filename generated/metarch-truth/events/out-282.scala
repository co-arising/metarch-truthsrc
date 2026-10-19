package generated.event

import net.imadz.common.CborSerializable

/** 确立概念时发现冲突（如聚合同名跨 subdomain），产生修复警告 */
final case class ConceptConflictWarningCreated() extends CborSerializable
