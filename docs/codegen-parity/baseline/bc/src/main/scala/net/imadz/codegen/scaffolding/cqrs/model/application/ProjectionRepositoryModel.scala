package net.imadz.codegen.scaffolding.cqrs.model.application


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}
import net.imadz.meta.MappingMorphism

case class ProjectionRepositoryModel(
                                      override val selfType: TypeRef,
                                      isImplementedBy: TypeRef,
                                      dtoModel: StructModel,
                                      methods: Seq[RepositoryMethodModel],
                                      override val dependencies: Set[TypeRef],
                                      /** rm 面态射（S2）：视图字段**从哪来**——builder 显式构造。
                                        * 默认 Nil ⇒ 未接的面零改动。 */
                                      override val morphisms: Seq[MappingMorphism] = Nil,
                                      /** S7（EP §二 G1）：读模型号——台账 artifacts[] 文件级落点由此可查。 */
                                      override val noteIds: Seq[String] = Nil
                                    ) extends ArtifactModel

case class StructModel(name: String, companionName: String, fields: Seq[FieldDef])

