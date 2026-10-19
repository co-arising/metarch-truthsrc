package generated.command

import net.imadz.common.CborSerializable

/** 提出一个热点疑问 */
final case class RaiseQuestion(tenantId: String, sessionId: String, externalId: String, boardId: String, content: String, linkedNoteIds: String, triggeredBy: String, questionId: String) extends CborSerializable
