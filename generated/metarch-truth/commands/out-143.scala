package generated.command

import net.imadz.common.CborSerializable

/** 维护租户成员名册（Tenant.orgMemberIds 联动·Policy〔成员加入后维护租户名册〕触发） */
final case class UpdateTenantMemberRoster(tenantId: String, userId: String, triggeredBy: String) extends CborSerializable
