package generated.command

import net.imadz.common.CborSerializable

/** 修补聚合状态面（statusEnum 值集＋状态迁移集） */
final case class PatchAggregateStatus(definitionId: String, statusEnumValues: String, statusTransitions: String, terminalStates: String, tenantId: String, triggeredBy: String) extends CborSerializable
