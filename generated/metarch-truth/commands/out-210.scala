package generated.command

import net.imadz.common.CborSerializable

/** 删除一条关系边 */
final case class UnrelateConcept(edgeId: String, reason: String, triggeredBy: String) extends CborSerializable
