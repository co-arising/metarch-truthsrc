package generated.command

import net.imadz.common.CborSerializable

/** 【新增】重新激活 */
final case class ReactivateUser(userId: String, triggeredBy: String) extends CborSerializable
