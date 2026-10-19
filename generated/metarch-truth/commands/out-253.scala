package generated.command

import net.imadz.common.CborSerializable

/** 移除组织成员（ACTIVE → REMOVED，reason 可选） */
final case class RemoveTenantMember(tenantId: String, userId: String, reason: String) extends CborSerializable
