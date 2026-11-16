package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.repository


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

case class AggregateRepositoryImplModel(
                                         override val selfType: TypeRef,
                                         interfaceType: TypeRef,
                                         entityTypeKey: String,          // e.g. CreditBalanceEntityTypeKey
                                         aggregateType: TypeRef,         // e.g. CreditBalanceAggregate (Protocol Object)
                                         methods: Seq[ShardedMethodModel],
                                         override val dependencies: Set[TypeRef],

                                         /** S7（EP §二 G1）：台账 artifacts[] 文件级落点由此可查。 */
                                         override val noteIds: Seq[String] = Nil
                                       ) extends ArtifactModel

// [FIX] Rename SimpleShardedMethodModel -> ShardedMethodModel
case class ShardedMethodModel(
                               name: String,
                               paramName: String,
                               paramType: TypeRef,
                               returnType: TypeRef
                             )

