package generated.command

import net.imadz.common.CborSerializable

/** 为事件追加/替换一个载荷字段 */
final case class AddEventPayload(definitionId: String, eventName: String, payloadSpec: String, tenantId: String, triggeredBy: String) extends CborSerializable
