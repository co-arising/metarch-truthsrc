package generated.command

import net.imadz.common.CborSerializable

/** 将尚未建立的概念停放（conceptNotYetEstablished），等待后续阶段解锁 */
final case class ParkConcept(conceptId: String, reason: String, triggeredBy: String) extends CborSerializable
