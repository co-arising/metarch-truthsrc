package generated.command

import net.imadz.common.CborSerializable

/** 从 PARKED 恢复为 ESTABLISHED */
final case class UnparkConcept(conceptId: String, triggeredBy: String) extends CborSerializable
