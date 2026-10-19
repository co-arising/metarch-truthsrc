package generated.command

import net.imadz.common.CborSerializable

/** 【B5b】移除Event（写环补面） */
final case class RemoveEvent(definitionId: String, eventName: String, tenantId: String, triggeredBy: String) extends CborSerializable
