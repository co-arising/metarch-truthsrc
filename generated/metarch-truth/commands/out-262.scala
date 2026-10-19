package generated.command

import net.imadz.common.CborSerializable

/** 重新打开评审 */
final case class ReopenDoR(dorId: String, reason: String, triggeredBy: String) extends CborSerializable
