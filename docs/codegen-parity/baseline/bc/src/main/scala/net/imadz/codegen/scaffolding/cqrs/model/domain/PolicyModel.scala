package net.imadz.codegen.scaffolding.cqrs.model.domain

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

case class PolicyModel(
    override val selfType: TypeRef,
    sourceAggregate: TypeRef,
    targetAggregate: TypeRef,
    command: TypeRef,
    triggerEvent: TypeRef,
    entityIdField: String,
    idempotencyKey: String,
    logicCode: String,
    override val dependencies: Set[TypeRef]
) extends ArtifactModel
