package generated.command

import net.imadz.common.CborSerializable

/** 取消专项 */
final case class CancelProject(projectId: String, reason: String, triggeredBy: String) extends CborSerializable
