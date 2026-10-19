package generated.command

import net.imadz.common.CborSerializable

/** 更新关系属性（condition/mapping/order/metadata） */
final case class UpdateRelation(edgeId: String, condition: String, mapping: String, order: String, metadata: String, triggeredBy: String) extends CborSerializable
