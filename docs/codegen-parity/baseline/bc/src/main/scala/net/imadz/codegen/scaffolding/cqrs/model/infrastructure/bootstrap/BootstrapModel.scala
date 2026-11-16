package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.bootstrap


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

sealed trait BootstrapType
case object AggregateBootstrapType extends BootstrapType
case object SagaCoordinatorBootstrapType extends BootstrapType
case object ProjectionBootstrapType extends BootstrapType
case object SagaTransactorBootstrapType extends BootstrapType

case class BootstrapModel(
                           override val selfType: TypeRef,
                           bootstrapType: BootstrapType,
                           targetName: String,
                           commandName: String,

                           // Aggregate Specific
                           entityName: Option[String],
                           // [FIX] 新增: EventHandler 类型 (e.g. CreditBalanceEventHandler)
                           eventHandlerType: Option[TypeRef],

                           // Aggregate/Saga Specific
                           entityTypeKey: Option[String],
                           tags: Option[Seq[String]],
                           sagaRepositories: Seq[TypeRef],

                           // Transactor Specific
                           transactorRepo: Option[TypeRef],
                           transactorContext: Option[TypeRef],
                           transactorContextInit: Option[String],

                           // Projection Specific
                           projectionRepo: Option[TypeRef],
                           sourceAggregateType: Option[TypeRef],
                           // [M3 多聚合投影] sourceAggregates>1：各聚合对象（.tags 枚举）——
                           // numberOfInstances=各聚合 tags 之和，index 按聚合顺序偏移分派
                           projectionAggregateTags: Seq[TypeRef] = Nil,

                           // Sharding info
                           shards: Int,
                           override val dependencies: Set[TypeRef],

                           /** S7 #1c（EP §二 G1）：知识身份＝**母元素号**（与 behavior/aggregation 面同口径）：
                             * 聚合 bootstrap → 聚合号；投影 bootstrap → 投影号（多聚合投影按声明序取首号＋全号）。
                             * 调用点（generateBootstraps）meta 在手、以 attribution 为唯一事实源挂号——
                             * 本模型不另开参数（saga/global 两族无号，如实留空）。 */
                           override val noteIds: Seq[String] = Nil,

                           /** Gate-2（2026-10-23）：聚合空状态初始化表达式右目。框架 Id 标识符
                             * （banking 先例）→ "Id.of(entityId)"；String 标识符（strict 契约
                             * dtype 规则）→ "entityId"。None 渲染按框架 Id 先例回退。 */
                           emptyStateArg: Option[String] = None
                         ) extends ArtifactModel

