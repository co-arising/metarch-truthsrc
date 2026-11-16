package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.connector

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

/** Connector 实现模型（infrastructure 层）——镜像 ProjectionRepositoryImplModel：
  * `injectedConstructorParams` 承载手写基建（NodeSubprocessRunner 等）的注入位。 */
case class ConnectorImplModel(
    override val selfType: TypeRef,
    interfaceType: TypeRef,
    methods: Seq[ConnectorImplMethodModel],
    injectedConstructorParams: Seq[FieldDef] = Nil,
    override val dependencies: Set[TypeRef],
    noteId: Option[String] = None
) extends ArtifactModel

/** 生成的 impl 方法：机械委托给注入的手写基建（真实调用写在 MANUAL 块）。 */
case class ConnectorImplMethodModel(
    name: String,
    parameters: Seq[FieldDef],
    returnType: TypeRef,
    // 手写基建调用表达式（生成物缺省；MANUAL 块里可改）。如 `nodeSubprocessRunner.run("scripts/kb_lint.mjs")`
    defaultBody: String,
    anchorNoteId: Option[String] = None
)
