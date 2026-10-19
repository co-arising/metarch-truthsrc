package generated.command

import net.imadz.common.CborSerializable

/** 更新概念属性（描述、类型、机器规格、元数据等） */
final case class UpdateConcept(conceptId: String, description: String, kind: String, machineSpec: String, metadata: String, triggeredBy: String) extends CborSerializable
