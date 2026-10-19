package generated.command

import net.imadz.common.CborSerializable

/** 组织在平台完成入驻 */
final case class OnboardTenant(tenantId: String, name: String, ownerUserId: String, triggeredBy: String) extends CborSerializable
