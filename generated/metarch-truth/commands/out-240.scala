package generated.command

import net.imadz.common.CborSerializable

/** 暂停专项 */
final case class PauseProject(projectId: String, reason: String, triggeredBy: String) extends CborSerializable
