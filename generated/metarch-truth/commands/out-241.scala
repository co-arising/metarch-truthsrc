package generated.command

import net.imadz.common.CborSerializable

/** 暂停组织 */
final case class SuspendTenant(tenantId: String, reason: String, triggeredBy: String) extends CborSerializable
