package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.model.application.{
  AggregateRepositoryModel,
  RepositoryMethodModel
}
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef}
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.{
  AggregateRepositoryMetadata,
  AggregateRootMetadata,
  QueryMethod
}

object AggregateRepositoryBuilder {

  def build(
      meta: AggregateRepositoryMetadata,
      ctx: GeneratorContext
  ): AggregateRepositoryModel = {
    val pkg = ctx.layout.application.aggregates.repository
    val selfType = ctx.typeResolver.aggregateRepository(meta.name)

    // 解析聚合类型
    val (aggregateType, aggName) = resolveAggregateType(meta, ctx)

    // 解析实现类类型
    val implementationType = resolveImplementationType(meta, ctx)

    // 构建仓库方法
    val methods = buildRepositoryMethods(meta, ctx, aggName, aggregateType)

    // 收集依赖
    val dependencies = collectDependencies(
      meta,
      selfType,
      implementationType,
      aggregateType,
      methods,
      ctx,
      pkg
    )

    AggregateRepositoryModel(
      selfType,
      selfType,
      implementationType,
      aggregateType,
      methods,
      dependencies,
      // S7（EP §二 G1）：repo trait 的知识身份＝**聚合号**（`meta.noteId` 恒空——AggregateRepositoryMetadata
      // 是派生容器不在裁决4 八型内；真源 0 条 repository 便签，实名核实后挂聚合。
      // 同批根修 repo-impl 面同款误配。AggregateRef 只揣名，故经 registry 解引用）
      noteIds = ctx.metaRegistry
        .resolveByName[AggregateRootMetadata](meta.aggregate.targetName)
        .flatMap(_.noteId)
        .toSeq,
      // B4（2026-09-24）：容器级锚单号（模板据此在 `trait` 前发裸行 `@knowledge`）——
      // 与 `noteIds` 同一来源（聚合号），此处单列一份供模板取用。
      noteId = ctx.metaRegistry
        .resolveByName[AggregateRootMetadata](meta.aggregate.targetName)
        .flatMap(_.noteId)
    )
  }

  /** 解析聚合类型引用（返回聚合 TypeRef 与聚合名——后者供 Protocol/CommandFamily 引用构造）
    */
  private def resolveAggregateType(
      meta: AggregateRepositoryMetadata,
      ctx: GeneratorContext
  ): (TypeRef, String) = {
    val aggMeta = ctx.metaRegistry
      .resolve[AggregateRootMetadata](meta.aggregate)
      .getOrElse(
        throw new IllegalStateException(
          s"AggregateRootMetadata '${meta.aggregate.targetName}' not found."
        )
      )
    (ctx.typeResolver.aggregateRoot(aggMeta.name), aggMeta.name)
  }

  /** 解析仓库实现类类型
    */
  private def resolveImplementationType(
      meta: AggregateRepositoryMetadata,
      ctx: GeneratorContext
  ): TypeRef = {
    val implName =
      NamingConventions.getRepositoryImplNameFromInterfaceName(meta.name)
    ctx.typeResolver.aggregateRepositoryImpl(implName)
  }

  /** 构建仓库方法模型列表
    * R6（泳道终局原则·2026-08-28 用户裁决）：entityRef(id) 为 sharding 型聚合的隐式契约，
    * 无需 SystemMetadata 显式声明——Builder 恒合成默认方法并置于首位；元数据声明的同名方法由合成位取代。
    */
  private def buildRepositoryMethods(
      meta: AggregateRepositoryMetadata,
      ctx: GeneratorContext,
      aggName: String,
      aggregateType: TypeRef
  ): Seq[RepositoryMethodModel] = {
    val entityRefMethod = synthesizeEntityRefMethod(aggName, aggregateType)
    val declaredMethods = meta.methods.flatMap {
      case q: QueryMethod => buildQueryMethod(q, ctx)
      case _              => None
    }.filter(_.name != "entityRef")
    entityRefMethod +: declaredMethods
  }

  /** 合成默认 entityRef 方法模型（EntityRef[<Agg>CommandFamily]，Protocol 对象内嵌套类型） */
  private def synthesizeEntityRefMethod(
      aggName: String,
      aggregateType: TypeRef
  ): RepositoryMethodModel = {
    val commandFamily =
      TypeRef(s"${aggName}CommandFamily", s"${aggregateType.packageName}.$aggName" + "Protocol")
    val entityRefReturn =
      TypeRef("EntityRef", "akka.cluster.sharding.typed.scaladsl", Seq(commandFamily))
    RepositoryMethodModel(
      name = "entityRef",
      parameters = Seq(FieldDef("id", TypeRef.String)),
      returnType = entityRefReturn,
      logicIntent = "sharding 实体引用（聚合隐式契约——对齐 gen_api_layer entityRef，2026-08-28 终局原则）"
    )
  }

  /** 构建查询方法模型
    */
  private def buildQueryMethod(
      query: QueryMethod,
      ctx: GeneratorContext
  ): Option[RepositoryMethodModel] = {
    Some(
      RepositoryMethodModel(
        name = query.name,
        parameters = buildMethodParameters(query, ctx),
        returnType = ctx.typeResolver.resolve(query.returnType),
        logicIntent = query.logic.intent
      )
    )
  }

  /** 构建方法参数列表
    */
  private def buildMethodParameters(
      query: QueryMethod,
      ctx: GeneratorContext
  ): Seq[FieldDef] = {
    query.parameters.map(p =>
      FieldDef(p.name, ctx.typeResolver.parameterType(p.parameterType), noteId = p.noteId, description = p.description)
    )
  }

  /** 收集并过滤依赖
    */
  private def collectDependencies(
      meta: AggregateRepositoryMetadata,
      selfType: TypeRef,
      implementationType: TypeRef,
      aggregateType: TypeRef,
      methods: Seq[RepositoryMethodModel],
      ctx: GeneratorContext,
      pkg: String
  ): Set[TypeRef] = {
    val methodDeps = collectMethodDependencies(methods)
    val baseDeps = Set(
      ctx.knownFrameworkTypes("Inject"),
      ctx.knownFrameworkTypes("ImplementedBy")
    )

    val allDeps = methodDeps ++
      implementationType.collectAllDependencies ++
      baseDeps + aggregateType

    allDeps.filter(_.shouldImport(pkg))
  }

  /** 收集方法相关的依赖
    */
  private def collectMethodDependencies(
      methods: Seq[RepositoryMethodModel]
  ): Set[TypeRef] = {
    methods.flatMap { m =>
      m.returnType.collectAllDependencies ++ m.parameters.flatMap(
        _.typeRef.collectAllDependencies
      )
    }.toSet
  }
}
