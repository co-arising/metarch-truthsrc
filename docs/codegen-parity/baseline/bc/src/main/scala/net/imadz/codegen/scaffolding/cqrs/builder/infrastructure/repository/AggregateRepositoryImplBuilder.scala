package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.repository

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.repository.{
  AggregateRepositoryImplModel,
  ShardedMethodModel
}
import net.imadz.codegen.scaffolding.cqrs.{
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.{AggregateRepositoryMetadata, AggregateRootMetadata, QueryMethod}

object AggregateRepositoryImplBuilder {

  def build(
      meta: AggregateRepositoryMetadata,
      ctx: GeneratorContext
  ): AggregateRepositoryImplModel = {
    // 1. Package & Type
    val pkg = ctx.layout.infrastructure.persistence.repositories.aggregate
    val selfType = ctx.typeResolver.aggregateRepositoryImpl(meta)

    val interfaceType = ctx.typeResolver.aggregateRepository(meta.name)

    // [FIXED] 2. Aggregate Protocol
    // 强制指向 Aggregate 包 (application.aggregates)，而不是依赖 TypeResolver 自动解析 (可能误判为 domain.values)
    val aggType = ctx.typeResolver.aggregateRoot(meta.aggregate.targetName)

    val entityTypeKey = NamingConventions.entityTypeKeyName(aggType.name)

    // 3. Methods
    // R6（泳道终局原则·2026-08-28 用户裁决）：entityRef 为 sharding 型聚合的隐式契约——与 trait 侧同步合成，
    // 置于首位（ImplTemplate 已内建 sharding.entityRefFor 方法体）；元数据声明的同名方法由合成位取代。
    val aggBaseName = aggType.name.stripSuffix("Aggregate") // ConceptAggregate → Concept（Protocol/CommandFamily 命名基）
    val commandFamily = TypeRef(
      s"${aggBaseName}CommandFamily",
      s"${aggType.packageName}.$aggBaseName" + "Protocol"
    )
    val entityRefMethod = ShardedMethodModel(
      name = "entityRef",
      paramName = "id",
      paramType = TypeRef.String,
      returnType = TypeRef("EntityRef", "akka.cluster.sharding.typed.scaladsl", Seq(commandFamily))
    )
    val methods = entityRefMethod +: meta.methods.collect { case q: QueryMethod =>
      val param = q.parameters.head
      ShardedMethodModel(
        name = q.name,
        paramName = param.name,
        paramType = ctx.typeResolver.resolve(param.parameterType),
        returnType = ctx.typeResolver.resolve(q.returnType)
      )
    }.filter(_.name != "entityRef")

    // 4. Dependencies
    val deps = Set(
      ctx.knownFrameworkTypes("Inject"),
      ctx.knownFrameworkTypes("ClusterSharding"),
      ctx.knownFrameworkTypes("EntityRef"),
      aggType,
      interfaceType
    ) ++ methods.flatMap(m =>
      m.paramType.collectAllDependencies ++ m.returnType.collectAllDependencies
    )

    val dependencies = deps.filter(t => t.shouldImport(pkg))

    AggregateRepositoryImplModel(
      selfType,
      interfaceType,
      entityTypeKey,
      aggType,
      methods,
      dependencies,
      // S7（EP §二 G1）：repo Impl 的知识身份＝**聚合号**（repo 是聚合的派生容器·
      // 真源 0 条 repository 便签——实名核实后挂聚合；AggregateRef 只揣名，故经 registry 解引用）
      noteIds = ctx.metaRegistry
        .resolveByName[AggregateRootMetadata](meta.aggregate.targetName)
        .flatMap(_.noteId)
        .toSeq
    )
  }
}
