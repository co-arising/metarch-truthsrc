package generated.command

import net.imadz.common.CborSerializable

/** 声明读模型定义（③层入库主口·重复声明即整体替换） */
final case class DeclareReadModel(definitionId: String, viewName: String, parentAggregate: String, description: String, fields: String, decisionCommands: String, tenantId: String, triggeredBy: String) extends CborSerializable
