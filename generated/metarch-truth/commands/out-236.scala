package generated.command

import net.imadz.common.CborSerializable

/** 捕获一张领域便签（业务事实）入库 */
final case class CaptureNote(tenantId: String, sessionId: String, sourceSystem: String, externalId: String, boardId: String, content: String, type: String, timeline: String, pivotal: String, triggeredBy: String, noteId: String) extends CborSerializable
