package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

/** S1 聚合面（2026-09-27 用户拍板）：写侧聚合状态强一致查询控制器模型。
  *
  * 单控制器 `AggregateStateApiController`，每聚合一个方法：
  * `repository.entityRef(id).ask(GetState)` → 结果直接返回（implicit OWrites 序列化）。
  * auth 简化走 `api.global.read`。GET /api/state/<kebab-agg>/:id。
  *
  * 每聚合条目：
  * @param methodName   控制器方法名（camelCase 聚合基名，如 concept）
  * @param repository   仓库注入字段（name＝<X>Repository·typeRef＝仓库 trait）
  * @param entityTypeKey 聚合分片键（entityRefFor 用——经 repository.entityRef 封装）
  * @param getIdCommand GetState 命令类型（FQN 解析后的 TypeRef）
  * @param replyType    GetStateReply 类型
  * @param idParam      寻址参数名（聚合 identifier 字段名，如 conceptId）
  */
case class AggregateStateControllerModel(
    override val selfType: TypeRef,
    routeBase: String,
    entries: Seq[AggregateStateEndpointModel],
    override val dependencies: Set[TypeRef]
) extends ArtifactModel

case class AggregateStateEndpointModel(
    methodName: String,
    routeSegment: String,
    repository: FieldDef,
    getIdCommand: TypeRef,
    replyType: TypeRef,
    idParam: String,
    /** 状态字段形状（序列化面——controller 层逐字段 OWrites 的发射源；typeRef.signature 即 Scala 类型） */
    stateFields: Seq[FieldDef] = Nil,
    /** 状态类型（如 ConceptState——OWrites[X] 与 Json.toJson(s.<f>) 的目标类型） */
    stateType: Option[TypeRef] = None,
    /** 聚合知识 id（容器锚——清单/台账面） */
    noteId: Option[String] = None
)
