package generated.command

import net.imadz.common.CborSerializable

/** 停用账号 */
final case class DeactivateUser(userId: String, reason: String, triggeredBy: String) extends CborSerializable
