package generated.command

import net.imadz.common.CborSerializable

/** 【新增】完成会话，触发知识沉淀 */
final case class CompleteSession(sessionId: String, triggeredBy: String) extends CborSerializable
