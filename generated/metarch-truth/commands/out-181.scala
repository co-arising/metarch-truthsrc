package generated.command

import net.imadz.common.CborSerializable

/** 【S2-70 ③】关闭一次会话（closed 态自此可达） */
final case class CloseSession(sessionId: String, triggeredBy: String) extends CborSerializable
