package generated.command

import net.imadz.common.CborSerializable

/** 定义上下文关系 */
final case class DefineContextRelation(tenantId: String, relationId: String, upstreamContextId: String, downstreamContextId: String, kind: String, integration: String, description: String, triggeredBy: String) extends CborSerializable
