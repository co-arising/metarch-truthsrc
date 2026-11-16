package net.imadz.codegen.scaffolding.cqrs.model.application.transactor

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

case class SagaContextModel(
                             override val selfType: TypeRef,
                             fields: Seq[FieldDef],
                             override val dependencies: Set[TypeRef]
                           ) extends ArtifactModel
