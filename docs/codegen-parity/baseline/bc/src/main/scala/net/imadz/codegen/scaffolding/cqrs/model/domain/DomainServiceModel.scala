package net.imadz.codegen.scaffolding.cqrs.model.domain


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

case class DomainServiceModel(
                               override val selfType: TypeRef,
                               superInterface: TypeRef, // e.g. net.imadz.common.CommonTypes.DomainService
                               methods: Seq[DomainServiceMethodModel],
                               override val dependencies: Set[TypeRef]
                             ) extends ArtifactModel

case class DomainServiceMethodModel(
                               name: String,
                               parameters: Seq[FieldDef], // 使用 FieldDef 复用 name: Type 结构
                               returnType: TypeRef,
                               logicCode: String
                             )


