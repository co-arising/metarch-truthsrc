package generated.command

import net.imadz.common.CborSerializable

/** 指定成员本次会话角色 */
final case class AssignSessionRole(sessionId: String, userId: String, role: String, triggeredBy: String) extends CborSerializable
