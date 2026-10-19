package generated.command

import net.imadz.common.CborSerializable

/** 【新增】更新资料 */
final case class UpdateUserProfile(userId: String, displayName: String, email: String, triggeredBy: String) extends CborSerializable
