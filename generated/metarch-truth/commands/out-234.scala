package generated.command

import net.imadz.common.CborSerializable

/** 指定工作组 Owner */
final case class AssignWorkgroupOwner(workgroupId: String, ownerUserId: String, triggeredBy: String) extends CborSerializable
