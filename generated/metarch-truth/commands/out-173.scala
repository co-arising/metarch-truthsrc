package generated.command

import net.imadz.common.CborSerializable

/** 【B5b】移除Relation（写环补面） */
final case class RemoveRelation(definitionId: String, toAggregate: String, foreignKey: String, tenantId: String, triggeredBy: String) extends CborSerializable
