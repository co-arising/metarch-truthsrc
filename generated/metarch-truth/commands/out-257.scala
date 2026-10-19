package generated.command

import net.imadz.common.CborSerializable

/** 识别一个限界上下文 */
final case class DiscoverContext(tenantId: String, contextId: String, name: String, description: String, subdomainIds: String, triggeredBy: String) extends CborSerializable
