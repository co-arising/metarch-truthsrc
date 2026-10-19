package generated.command

import net.imadz.common.CborSerializable

/** 声明一条聚合间关系（④层 relations 键） */
final case class DeclareRelation(definitionId: String, relationSpec: String, tenantId: String, triggeredBy: String) extends CborSerializable
