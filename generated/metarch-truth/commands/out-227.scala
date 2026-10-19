package generated.command

import net.imadz.common.CborSerializable

/** 开启一次会话 */
final case class OpenSession(tenantId: String, sessionId: String, stageId: String, workshopId: String, triggeredBy: String) extends CborSerializable
