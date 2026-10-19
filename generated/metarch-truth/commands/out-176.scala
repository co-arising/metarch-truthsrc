package generated.command

import net.imadz.common.CborSerializable

/** 声明一个值对象定义（④层模板 valueObjects 面入库主口） */
final case class DeclareValueObject(definitionId: String, voName: String, members: String, tenantId: String, triggeredBy: String) extends CborSerializable
