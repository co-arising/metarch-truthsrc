package generated.command

import net.imadz.common.CborSerializable

/** 声明一条命令级状态门禁（④层 stateGates 键） */
final case class DeclareStateGate(definitionId: String, gateSpec: String, tenantId: String, triggeredBy: String) extends CborSerializable
