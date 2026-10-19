package generated.command

import net.imadz.common.CborSerializable

/** 【B5b】移除Command（写环补面） */
final case class RemoveCommand(definitionId: String, commandName: String, tenantId: String, triggeredBy: String) extends CborSerializable
