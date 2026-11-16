package net.imadz.codegen.scaffolding.cqrs.model.application

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

/** Connector 能力面模型（application 层）——与 AggregateRepositoryModel 同构：
  * trait + `@ImplementedBy(Impl)`。子进程机械不在本层（在 infrastructure impl 里）。 */
case class ConnectorModel(
    override val selfType: TypeRef,
    isImplementedBy: TypeRef,
    methods: Seq[ConnectorMethodModel],
    override val dependencies: Set[TypeRef],
    noteId: Option[String] = None
) extends ArtifactModel

/** Connector 方法：返回一个手写 case class（如 GateRunResult）。 */
case class ConnectorMethodModel(
    name: String,
    parameters: Seq[FieldDef],
    returnType: TypeRef,
    intent: String,
    noteId: Option[String] = None
)
