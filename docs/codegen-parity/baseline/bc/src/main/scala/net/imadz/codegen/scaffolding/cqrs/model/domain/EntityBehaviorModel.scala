package net.imadz.codegen.scaffolding.cqrs.model.domain

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

case class EntityBehaviorModel(
    override val selfType: TypeRef, // e.g. behaviors.CreditBalanceEventHandler (Object)
    handlerTypeAlias: TypeRef, // e.g. entities.CreditBalanceEntity.CreditBalanceEventHandler (Type Alias)
    stateType: TypeRef, // [NEW] 显式引用 State 类型
    eventFamilyType: TypeRef, // [NEW] 显式引用 EventFamily 类型
    mutations: Seq[StateMutationModel], // 事件处理逻辑
    helperMethods: Seq[MethodModel], // 私有辅助方法
    override val dependencies: Set[TypeRef]
) extends ArtifactModel

case class StateMutationModel(
    eventType: TypeRef, // e.g. BalanceChanged
    logicCode: String, // e.g. "state.copy(...)"
    collectionFolds: Vector[net.imadz.meta.filesystem.FormalFoldRow] = Vector.empty
)

case class MethodModel(
    name: String,
    params: Seq[FieldDef],
    returnType: TypeRef,
    logicCode: String
)
