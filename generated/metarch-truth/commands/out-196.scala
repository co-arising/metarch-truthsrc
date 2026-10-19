package generated.command

import net.imadz.common.CborSerializable

/** 【新增】转交组织所有权 */
final case class AssignTenantOwner(tenantId: String, newOwnerUserId: String, triggeredBy: String) extends CborSerializable
