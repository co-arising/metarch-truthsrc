package generated.command

import net.imadz.common.CborSerializable

/** 将概念标记为 DEPRECATED */
final case class DeprecateConcept(conceptId: String, reason: String, triggeredBy: String) extends CborSerializable
