package net.imadz.codegen.scaffolding.cqrs.model.application


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

case class AggregateRepositoryModel(
                                     override val selfType: TypeRef,
                                     superInterface: TypeRef,
                                     isImplementedBy: TypeRef,
                                     aggregateType: TypeRef,
                                     methods: Seq[RepositoryMethodModel],
                                     override val dependencies: Set[TypeRef],
                                     /** S7（EP §二 G1）：台账 artifacts[] 文件级落点由此可查。 */
                                     override val noteIds: Seq[String] = Nil,
                                     /** B4（EP_GenerationTime_Code_Anchors·2026-09-24）：接口**容器级**锚。
                                       * 仓库接口是聚合的派生容器（`AggregateRepositoryBuilder.noteIds = meta.noteId`），
                                       * 此前该号只进台账行、in-file 零锚 ⇒ `trait <X>Repository` 在图上无落点。
                                       * 与实体容器同法（`DomainEntityTemplate` 的 `object <X>Entity` 裸行锚）：
                                       * 模板在 `trait` 前发裸行 `@knowledge`（形态：注释块＋trait → 概念锚）。 */
                                     noteId: Option[String] = None
                                   ) extends ArtifactModel

case class RepositoryMethodModel(
                                  name: String,
                                  parameters: Seq[FieldDef],
                                  returnType: TypeRef,
                                  logicIntent: String
                                )

