package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api.{
  AggregateStateControllerModel,
  AggregateStateEndpointModel
}
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef}
import net.imadz.meta.{AggregateRootMetadata, CommandRef, DomainEntityMetadata}

/** S1 聚合面（2026-09-27 用户拍板）：AggregateStateApiController 装配器。
  *
  * 单控制器、每聚合一方法：`repository.entityRef(id).ask(GetState)` →
  * 结果直接返回（implicit OWrites[GetStateReply] 序列化）；auth 简化 `api.global.read`。
  * GetState 命令由 AssemblyEngine 技术合成（每聚合恒在——此处只做解析，不存在即编程错误）。
  *
  * 产物两条：控制器文件 + routes 行（复用 RoutesBuilder 的行形态，独立标记块）。 */
object AggregateStateControllerBuilder {

  /** camelCase：ConceptState → conceptState（方法名） */
  private def camel(s: String): String = s.head.toLower + s.tail

  /** kebab-case 路由段（与 gen_api_controllers/core.mjs kebab 同形）：
    * DoR → do-r（先例＝routes 既有 /api/do-r/:dorId/... 行）。 */
  private def kebab(s: String): String =
    s.replaceAll("([a-z0-9])([A-Z])", "$1-$2").toLowerCase

  def build(aggregates: Seq[AggregateRootMetadata], ctx: GeneratorContext): AggregateStateControllerModel = {
    val pkg = ctx.layout.infrastructure.api.root
    // Play 惯例：controller 落 controllers 包（与 ControllerTemplate 同位——Route 引用 controllers.<Name>）
    val controllerPkg = "controllers"
    val selfType = TypeRef("AggregateStateApiController", controllerPkg)

    val entries = aggregates.map { agg =>
      val base = agg.name.replaceAll("Aggregate$", "")
      val repoType = ctx.typeResolver.aggregateRepository(agg.name)
      val cmdName = s"Get${base}State"
      val cmdType = ctx.typeResolver.command(CommandRef(cmdName))
      // reply 解析：Get<X>StateReply 与命令同包（protocol 文件）
      val replyType = TypeRef(s"${cmdName}Reply", s"${ctx.layout.application.aggregates.root}.${base}Protocol")
      // 状态形状：实体元数据（stateRef → <X>Entity）→ 字段清单（controller 层 OWrites 发射源）
      // 与 DomainEntityBuilder 同口径：排除 nature 字段（如 credential 密钥——不入状态签名，序列化面同步排除）
      val stateType = ctx.typeResolver.entityState(agg.stateRef.targetName)
      val stateFields: Seq[FieldDef] =
        ctx.metaRegistry.resolveByName[DomainEntityMetadata](agg.entityRef.targetName)
          .map(e => e.state.fields
            .filterNot(f => f.nature.nonEmpty && ctx.excludedStateFieldNatures.contains(f.nature))
            .map(f => FieldDef(f.name, ctx.typeResolver.resolve(f.fieldType))))
          .getOrElse(Nil)
      AggregateStateEndpointModel(
        methodName = camel(base),
        routeSegment = kebab(base),
        repository = FieldDef(camel(repoType.name), repoType),
        getIdCommand = cmdType,
        replyType = replyType,
        idParam = agg.identifier.name,
        stateFields = stateFields,
        stateType = Some(stateType),
        noteId = agg.noteId
      )
    }

    val deps = (entries
      .flatMap(e => Seq(e.repository.typeRef, e.getIdCommand, e.replyType))
      ++ entries.flatMap(e => e.stateFields.flatMap(_.typeRef.collectAllDependencies))
      ++ entries.flatMap(e => e.stateType.toSeq.flatMap(_.collectAllDependencies)))
      .filter(_.shouldImport(controllerPkg))
      .toSet

    AggregateStateControllerModel(selfType, "/api/state", entries, deps)
  }
}
