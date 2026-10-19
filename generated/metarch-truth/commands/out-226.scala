package generated.command

import net.imadz.common.CborSerializable

/** 建立协作工作组 */
final case class CreateWorkgroup(workgroupId: String, tenantId: String, name: String, triggeredBy: String) extends CborSerializable
