package net.imadz.codegen.scaffolding.cqrs.model.application


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

// 聚合根工厂模型
case class AggregateFactoryModel(
                                  override val selfType: TypeRef, // e.g. CreditBalanceAggregateFactory
                                  aggregateType: TypeRef, // e.g. CreditBalanceAggregate (用于引用 Protocol)

                                  // 核心 Sharding/Akka 配置
                                  entityTypeKey: String, // e.g. CreditBalanceEntityTypeKey
                                  commandFamily: TypeRef, // e.g. CreditBalanceCommand

                                  // 工厂方法
                                  factoryMethods: Seq[FactoryMethodModel],

                                  override val dependencies: Set[TypeRef],
                                  /** S7（EP §二 G1）：聚合号——台账 artifacts[] 文件级落点由此可查。 */
                                  override val noteIds: Seq[String] = Nil
                                ) extends ArtifactModel

case class FactoryMethodModel(
                               name: String, // 方法名，如 createCreditBalanceWithDefaultBalance
                               parameters: Seq[FieldDef], // 输入参数，如 userId: Id, initial: Money
                               returnType: TypeRef, // 返回类型
                               bodyLogic: String, // 方法体代码 (这里是重点)
                               isInitialization: Boolean = false // 是否是 Akka Ask 初始化的特殊方法
                             )

