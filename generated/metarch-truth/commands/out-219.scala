package generated.command

import net.imadz.common.CborSerializable

/** 完成参会者账号/权限配置 + 系统外人员协调 */
final case class PrepareSession(sessionId: String, participantUserIds: String, observerUserIds: String, triggeredBy: String) extends CborSerializable
