package generated.command

import net.imadz.common.CborSerializable

/** 声明聚合字段模型骨架（名/实体/描述/标识/租户作用域） */
final case class DeclareFieldModel(definitionId: String, aggregateName: String, entityName: String, description: String, identifierName: String, identifierType: String, tenantScoped: String, tenantId: String, triggeredBy: String) extends CborSerializable
