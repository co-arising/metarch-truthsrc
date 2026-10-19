package generated.command

import net.imadz.common.CborSerializable

/** 指定专项 Owner（默认创建者，可转交） */
final case class AssignProjectOwner(projectId: String, ownerUserId: String, triggeredBy: String) extends CborSerializable
