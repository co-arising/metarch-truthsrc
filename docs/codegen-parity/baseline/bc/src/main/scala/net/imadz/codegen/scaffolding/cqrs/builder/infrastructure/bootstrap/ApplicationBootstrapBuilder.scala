package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.bootstrap

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.bootstrap.ApplicationBootstrapModel
import net.imadz.codegen.scaffolding.cqrs.{
  FieldDef,
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.meta._
import net.imadz.codegen.structure.NamingConventions

object ApplicationBootstrapBuilder {

  def build(
      system: SystemMetadata,
      ctx: GeneratorContext,
      strictEntries: Seq[String] = Nil
  ): ApplicationBootstrapModel = {
    val pkg = ctx.layout.infrastructure.bootstrap
    val selfType = ctx.typeResolver.applicationBootstrap

    val aggregates = system.application.aggregates
    val sagas = system.application.sagas
    val projections = system.infrastructure.projections

    var extraDeps = scala.collection.mutable.Set[TypeRef]()
    var importOnlyDeps = scala.collection.mutable.Set[TypeRef]()
    var initCalls = scala.collection.mutable.Buffer[String]()

    // 1. [v3] Saga Init: per-saga definition registration + engine coordinator sharding.
    //    Participants are pure data (never journaled) — no serialization strategies.
    sagas.foreach { sagaMeta =>
      // SagaDefinition is an object used by the trait's init method — import
      // only, never a Guice-injected constructor param.
      importOnlyDeps += TypeRef(
        s"${sagaMeta.name.replace("SagaTransactor", "")}SagaDefinition",
        ctx.layout.application.services.transactor.root
      )
      initCalls += s"init${sagaMeta.name}(ec, system.scheduler)"
    }
    if (sagas.nonEmpty) {
      val sagaMeta = sagas.head
      // Executor-factory context: built from the first participant's aggregate repo.
      // The context type is referenced inline in the initSagaEngine call — import
      // only; the instance is constructed here, not injected.
      val participantMeta = sagaMeta.participants.head
      val aggName = participantMeta.interactsWith.targetName
      val repoRef = ctx.metaRegistry
        .resolveByName[AggregateRootMetadata](aggName)
        .flatMap(_.repository)
        .getOrElse(throw new IllegalStateException(s"Repo not found"))
      val repoType = ctx.typeResolver.resolve(repoRef)
      extraDeps += repoType
      importOnlyDeps += ctx.typeResolver.sagaContext(
        sagaMeta.context.map(_.name).getOrElse(sagaMeta.name)
      )
      val repoParam = repoType.name.head.toLower + repoType.name.tail
      val contextName =
        sagaMeta.context.map(_.name).getOrElse(s"${sagaMeta.name}Context")
      initCalls += s"initSagaEngine(sharding, $contextName($repoParam), system)"
    }

    // 2. Aggregates Init
    // 2026-08-21 摄入侧适配：调用名与 BootstrapTemplate 的 targetName 一致（<Base>Aggregate）
    aggregates.foreach { meta =>
      val aggName = NamingConventions.aggregateRootName(NamingConventions.getBaseName(meta.name))
      initCalls += s"${NamingConventions.getAggregateInitMethodNameFromAggregateName(aggName)}(sharding)"
    }

    // 3. Projections Init
    projections.foreach { meta =>
      val repoRef = meta.repositoryRef.get
      val repoType = ctx.typeResolver.resolve(repoRef)
      extraDeps += repoType
      val repoParam = repoType.name.head.toLower + repoType.name.tail
      initCalls += s"${NamingConventions.getProjectionInitMethodName(meta.name)}(system, sharding, $repoParam)"
    }

    val frameworkFields = Seq(
      FieldDef("classicSystem", ctx.typeResolver.classicActorSystem),
      FieldDef("sharding", ctx.knownFrameworkTypes("ClusterSharding"))
    )

    val repoFields = extraDeps
      .map { t =>
        FieldDef(t.name.head.toLower + t.name.tail, t)
      }
      .toSeq
      .sortBy(_.name)

    val injectedFields = frameworkFields ++ repoFields

    val frameworkDeps = Set(
      ctx.knownFrameworkTypes("Inject"),
      ctx.knownFrameworkTypes("Singleton"),
      ctx.typeResolver.actorSystem,
      ctx.typeResolver.actorSystemTyped,
      ctx.knownFrameworkTypes("adapter"),
      ctx.typeResolver.executionContext,
      ctx.typeResolver.extendedActorSystem
    )

    val allTraits = (aggregates.map(m =>
      ctx.typeResolver.bootstrap(
        s"${NamingConventions.getAggregateBaseName(m.name)}Bootstrap"
      )
    ) ++
      (if (sagas.nonEmpty)
         Seq(ctx.typeResolver.sagaCoordinatorBootstrap)
       else Nil) ++
      sagas.map(m => ctx.typeResolver.bootstrap(s"${m.name}Bootstrap")) ++
      projections.map(m =>
        ctx.typeResolver.bootstrap(
          NamingConventions.getBootstrapNameFromProjectionName(m.name)
        )
      )).distinct

    // [FIX] 移除了 Context 的依赖，因为不再需要手动构建
    val dependencies =
      (frameworkDeps ++ allTraits ++ extraDeps ++ importOnlyDeps ++ frameworkFields.map(
        _.typeRef
      ))
        .filter(t => t.shouldImport(pkg))

    ApplicationBootstrapModel(
      selfType,
      allTraits,
      initCalls.toSeq,
      injectedFields,
      strictEntries,
      dependencies
    )
  }
}
