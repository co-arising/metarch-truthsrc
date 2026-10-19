package generated.command

import net.imadz.common.CborSerializable

/** 【新增】更新上下文范围 */
final case class UpdateContextScope(contextId: String, subdomainIds: String, triggeredBy: String) extends CborSerializable
