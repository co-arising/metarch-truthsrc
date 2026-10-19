package generated.command

import net.imadz.common.CborSerializable

/** 【新增】更新关系 */
final case class UpdateContextRelation(relationId: String, kind: String, integration: String, description: String, triggeredBy: String) extends CborSerializable
