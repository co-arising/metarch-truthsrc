package net.imadz.codegen.scaffolding.cqrs.builder.application.transactor

import net.imadz.codegen.scaffolding.cqrs._
import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.SagaContextModel
import net.imadz.meta._
import net.imadz.codegen.structure.NamingConventions

object SagaContextBuilder {
  def build(
      meta: SagaTransactorMetadata,
      ctx: GeneratorContext
  ): SagaContextModel = {
    val pkg = ctx.layout.application.services.transactor.context
    // 放在 transactor 包下以匹配黄金样例
    val transactorPkg = ctx.layout.application.services.transactor.root

    val selfType = ctx.typeResolver.sagaContext(meta.name)

    // 1. 获取用户在 DSL 中定义的字段 (如果有)
    val userFields = meta.context
      .map(_.fields)
      .getOrElse(Nil)
      .map(f => FieldDef(f.name, ctx.typeResolver.resolve(f.fieldType)))

    // 2. 扫描所有 Participant 依赖的 Repository
    val requiredRepos = meta.participants.map { p =>
      val aggName = p.interactsWith.targetName
      val repoRef = ctx.metaRegistry
        .resolveByName[AggregateRootMetadata](aggName)
        .flatMap(_.repository)
        .getOrElse(
          throw new IllegalStateException(s"No repository for $aggName")
        )
      ctx.typeResolver.resolve(repoRef)
    }.distinct

    // 3. 智能合并 Repository 字段
    // 检查 userFields 中是否已存在对应类型的字段
    val missingRepoFields = requiredRepos
      .filterNot { repoType =>
        userFields.exists(_.typeRef.name == repoType.name)
      }
      .map { repoType =>
        FieldDef(repoType.name.head.toLower + repoType.name.tail, repoType)
      }

    // 4. saga_v3: no auto ClusterSharding — participants resolve aggregate
    //    EntityRefs through their repositories (ctx.<repo>.findXxxByUserId).
    val allFields = (userFields ++ missingRepoFields).distinct

    // 5. 依赖
    val deps = requiredRepos.toSet ++ userFields.flatMap(
      _.typeRef.collectAllDependencies
    )

    SagaContextModel(selfType, allFields, deps)
  }
}
