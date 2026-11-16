package net.imadz.codegen.scaffolding.cqrs.projector

import net.imadz.codegen.scaffolding.cqrs.{
  ArtifactModel,
  GeneratorContext,
  MetadataRegistry
}
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.proto.ProtoFileModel
import net.imadz.codegen.scaffolding.cqrs.builder.application._
import net.imadz.codegen.scaffolding.cqrs.builder.application.transactor._
import net.imadz.codegen.scaffolding.cqrs.builder.domain._
import net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.api.{
  CommandDslBuilder,
  ControllerBuilder,
  RoutesBuilder
}
import net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.bootstrap.{
  ApplicationBootstrapBuilder,
  BootstrapBuilder
}
import net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.persistence._
import net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.proto.AggregateRootProtoBuilder
import net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.repository._
import net.imadz.meta._
import net.imadz.codegen.scaffolding.cqrs.model.domain._
import net.imadz.codegen.scaffolding.cqrs.model.application._
import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.{
  SagaContextModel,
  SagaDefinitionModel,
  SagaParticipantModel
}
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api.{
  CommandDslModel,
  ControllerModel,
  RoutesFragmentModel
}
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.bootstrap.{
  ApplicationBootstrapModel,
  BootstrapModel
}
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.persistence._
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.repository._
import net.imadz.codegen.scaffolding.cqrs.template.application._
import net.imadz.codegen.scaffolding.cqrs.template.application.transactor.{
  SagaContextTemplate,
  SagaDefinitionTemplate,
  SagaParticipantTemplate
}
import net.imadz.codegen.scaffolding.cqrs.template.domain._
import net.imadz.codegen.scaffolding.cqrs.template.infrastructure.api.{
  CommandDslTemplate,
  ControllerTemplate,
  RoutesTemplate
}
import net.imadz.codegen.scaffolding.cqrs.template.infrastructure.bootstsrap.{
  ApplicationBootstrapTemplate,
  BootstrapTemplate
}
import net.imadz.codegen.scaffolding.cqrs.template.infrastructure.persistence._
import net.imadz.codegen.scaffolding.cqrs.template.infrastructure.proto.ProtoTemplate
import net.imadz.codegen.scaffolding.cqrs.template.infrastructure.repository._

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Path, Paths}

/**
  * Golden master verification for the template layer.
  *
  * Compares the REAL template output (the exact bytes CodegenMain writes, minus the
  * `// @generated` fingerprint header) against checked-in snapshots under
  * `golden_master/`. First run on a new artifact anchors the baseline ([BASELINE],
  * file written); subsequent runs diff against it. This makes template edits —
  * intentional or accidental — visible as a reviewable golden diff, which is the
  * AC-0.3 gate ("GoldenMaster diff 无意外差异").
  *
  * Replaces the pre-saga_v3 design that diffed ContextProver SKELETON projections
  * against the hand-adapted reference_project (permanently red: skeletons can never
  * equal hand-written code). The reference_project now serves as the compile target
  * for the generator; snapshots serve as the byte-level regression net.
  */
object GoldenMasterVerifier extends App {

  println(">>> Golden Master Verification (template output vs golden_master/ snapshots)...")
  System.setOut(new java.io.PrintStream(System.out, true, "UTF-8"))

  /** Snapshot root, relative to the repo working directory. */
  val snapshotRoot: Path = Paths.get("golden_master")

  val system = Examples.bankingSystem

  // Same registry as the real generator (flattened, so nested commands/replies
  // resolve inside saga builders), but the historical golden-master coordinates
  // (root net.imadz, empty module) so snapshot paths stay stable.
  val allMetas: Seq[DomainDrivenMetadata] =
    net.imadz.codegen.logic.graph.EnhancedDependencyGraphBuilder.flattenAllComponents(system)

  val ctx = GeneratorContext(
    rootPackage = "net.imadz",
    frameworkPackage = "net.imadz.framework",
    moduleName = "",
    metaRegistry = MetadataRegistry(allMetas)
  )

  Files.createDirectories(snapshotRoot)

  var passed = 0
  var baseline = 0
  var failed = 0

  /** model -> (snapshot-relative path, template-rendered content). The pairings
    * mirror CQRSApplicationGenerator.writeArtifact exactly. */
  def render(model: ArtifactModel): Option[(String, String)] = model match {
    case m: ValueObjectModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), ValueObjectTemplate.generate(m)))
    case m: DomainEntityModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), DomainEntityTemplate.generate(m)))
    case m: DomainServiceModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), DomainServiceTemplate.generate(m)))
    case m: InvariantRuleModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), InvariantRuleTemplate.generate(m)))
    case m: EntityBehaviorModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), EntityBehaviorTemplate.generate(m)))
    case m: ApplicationServiceModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), ApplicationServiceTemplate.generate(m)))
    case m: QueryServiceModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), QueryServiceTemplate.generate(m)))
    case m: AggregateRootModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), AggregateRootTemplate.generate(m)))
    case m: AggregateBehaviorModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), AggregateBehaviorTemplate.generate(m)))
    case m: AggregateFactoryModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), AggregateFactoryTemplate.generate(m)))
    case m: AggregateProtocolModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), AggregateProtocolTemplate.generate(m)))
    case m: CommandHelpersModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), CommandHelpersTemplate.generate(m)))
    case m: AggregateRepositoryModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), AggregateRepositoryTemplate.generate(m)))
    case m: ProjectionRepositoryModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), ProjectionRepositoryTemplate.generate(m)))
    case m: ProjectionModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), ProjectionTemplate.generate(m)))
    case m: AdapterModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"),
        if (m.isSnapshot) SnapshotAdapterTemplate.generate(m) else EventAdapterTemplate.generate(m)))
    case m: AggregateConverterModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), AggregateConverterTemplate.generate(m)))
    case m: AggregateRepositoryImplModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), AggregateRepositoryImplTemplate.generate(m)))
    case m: ProjectionRepositoryImplModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), ProjectionRepositoryImplTemplate.generate(m)))
    case m: ControllerModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), ControllerTemplate.generate(m)))
    // S2-32 R5d：CommandDsl 信封支撑件（R5c 挂接 CQRSApplicationGenerator interface 层，
    // 此前 verifier 无 render 配对＝支撑件发射从未被验证——controller 验证激活收口件）。
    case m: CommandDslModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), CommandDslTemplate.generate(m)))
    // S2-41 R7：routes 标记块（generateInterfaceLayer 同一配对；golden 锚＝标记块全文
    // ——快照位 golden_master/conf/routes，ProtoFileModel 非 .scala 件同款 relPath 形态）。
    case m: RoutesFragmentModel =>
      Some((relPath("conf", "routes"), RoutesTemplate.generate(m)))
    case m: BootstrapModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), BootstrapTemplate.generate(m)))
    case m: ApplicationBootstrapModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), ApplicationBootstrapTemplate.generate(m)))
    // saga_v3
    case m: SagaDefinitionModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), SagaDefinitionTemplate.generate(m)))
    case m: SagaContextModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), SagaContextTemplate.generate(m)))
    case m: SagaParticipantModel =>
      Some((relPath(m.selfType.packageName, s"${m.selfType.name}.scala"), SagaParticipantTemplate.generate(m)))
    case m: ProtoFileModel =>
      Some((relPath("protobuf", m.fileName), ProtoTemplate.generate(m)))
    case _ => None
  }

  private def relPath(pkg: String, fileName: String): String = {
    // Module-less contexts produce a trailing dot ("net.imadz.") — drop empty segments.
    val segments = Option(pkg).toList.flatMap(_.split('.')).filter(_.nonEmpty)
    (segments :+ fileName).mkString("/")
  }

  def verify(name: String)(logic: => ArtifactModel): Unit = {
    try {
      print(s"Verifying $name... ".padTo(60, ' '))
      val model = logic
      render(model) match {
        case None =>
          println("[NO-TEMPLATE] (model has no template pairing — skipped)")
        case Some((rel, content)) =>
          val snapshot = snapshotRoot.resolve(rel)
          if (!Files.exists(snapshot)) {
            Files.createDirectories(snapshot.getParent)
            Files.write(snapshot, content.getBytes(StandardCharsets.UTF_8))
            baseline += 1
            println(s"[BASELINE] ($rel anchored)")
          } else {
            val expected = new String(Files.readAllBytes(snapshot), StandardCharsets.UTF_8)
            if (normalize(expected) == normalize(content)) {
              passed += 1
              println("[OK]")
            } else {
              failed += 1
              println("[MISMATCH]")
              println(s"  Snapshot: $snapshot")
              println(
                s"  Sizes - Snapshot: ${expected.length}, Rendered: ${content.length}"
              )
              // Write the rendered output next to the snapshot for easy diffing.
              val actual = snapshotRoot.resolve(rel + ".actual")
              Files.write(actual, content.getBytes(StandardCharsets.UTF_8))
            }
          }
      }
    } catch {
      case e: Exception =>
        failed += 1
        println(s"[ERROR] ${e.getMessage}")
        e.printStackTrace()
    }
  }

  def normalize(s: String): String =
    // Loose comparison: strip all whitespace (CRLF/BOM/formatting insensitive).
    s.replaceAll("\\s+", "")

  // --- Verification Loop (same coverage as the pre-saga_v3 verifier, plus
  //     protocols/helpers/snapshot-adapters/bootstrap that it skipped) ---

  println("\n--- Domain Layer ---")
  system.domain.valueObjects.foreach { m =>
    verify(s"VO: ${m.name}")(ValueObjectBuilder.build(m, ctx))
  }
  system.domain.entities.foreach { m =>
    verify(s"Entity: ${m.name}")(DomainEntityBuilder.build(m, ctx))
  }
  system.domain.services.foreach { m =>
    verify(s"DomainSvc: ${m.name}")(DomainServiceBuilder.build(m, ctx))
  }
  system.domain.invariants.foreach { m =>
    verify(s"Policy: ${m.name}")(InvariantRuleBuilder.build(m, ctx))
  }
  system.domain.behaviors.foreach { m =>
    verify(s"Behavior: ${m.name}")(EntityBehaviorBuilder.build(m, ctx))
  }

  println("\n--- Application Layer ---")
  system.application.services.foreach { m =>
    verify(s"AppSvc: ${m.name}")(ApplicationServiceBuilder.build(m, ctx))
  }
  system.application.queries.foreach { m =>
    verify(s"Query: ${m.name}")(QueryServiceBuilder.build(m, ctx))
  }

  system.application.aggregates.foreach { agg =>
    verify(s"AggRoot: ${agg.name}")(AggregateRootBuilder.build(agg, ctx))
    verify(s"AggProto: ${agg.name}")(AggregateRootProtoBuilder.build(agg, ctx))
    verify(s"AggBehavior: ${agg.name}")(AggregateBehaviorBuilder.build(agg, ctx))
    verify(s"AggFactory: ${agg.name}")(AggregateFactoryBuilder.build(agg, ctx))
    verify(s"AggProtocol: ${agg.name}")(AggregateProtocolBuilder.build(agg, ctx))
    verify(s"AggHelpers: ${agg.name}")(CommandHelpersBuilder.build(agg, ctx))
    verify(s"AggEventAdapter: ${agg.name}")(
      AggregateAdapterBuilder.buildEventAdapter(agg, ctx)
    )
    verify(s"AggSnapshotAdapter: ${agg.name}")(
      AggregateAdapterBuilder.buildSnapshotAdapter(agg, ctx)
    )
    verify(s"AggConverter: ${agg.name}")(AggregateConverterBuilder.build(agg, ctx))
  }

  system.application.repositories.foreach {
    case m: AggregateRepositoryMetadata =>
      verify(s"AggRepo: ${m.name}")(AggregateRepositoryBuilder.build(m, ctx))
      verify(s"AggRepoImpl: ${m.name}")(
        AggregateRepositoryImplBuilder.build(m, ctx)
      )

    case m: ProjectionRepositoryMetadata =>
      verify(s"ProjRepo: ${m.name}")(
        ProjectionRepositoryBuilder.build(m, ctx)
      )
      verify(s"ProjRepoImpl: ${m.name}")(
        ProjectionRepositoryImplBuilder.build(m, ctx)
      )

    case _ =>
  }

  system.application.sagas.foreach { m =>
    verify(s"SagaDefinition: ${m.name}")(SagaDefinitionBuilder.build(m, ctx))
    verify(s"SagaContext: ${m.name}")(SagaContextBuilder.build(m, ctx))
    m.participants.foreach { p =>
      verify(s"SagaPart: ${p.name}")(SagaParticipantBuilder.build(p, m, ctx))
    }
  }

  println("\n--- Infrastructure Layer ---")
  val controllerModels = system.interfaces.controllers.map { m =>
    val model = ControllerBuilder.build(m, ctx)
    verify(s"Controller: ${m.name}")(model)
    model
  }
  // S2-32 R5d：CommandDsl 信封支撑件——与 CQRSApplicationGenerator.generateInterfaceLayer
  // 同一配对（gate 声明存在才发射）；DSL 控制器（banking opt-in 后）与支撑件同批入锚。
  CommandDslBuilder.build(system.interfaces).foreach { model =>
    verify("ControllerDsl: CommandDsl")(model)
  }
  // S2-41 R7：routes 标记块——与 generateInterfaceLayer 同一配对（gate 声明端点才产行）；
  // HomeController gate=None 零路由不入集（零漂移红线）；banking＝deposit＋monthlySummaries 两行。
  RoutesBuilder.build(controllerModels).foreach { model =>
    verify("Routes: conf/routes")(model)
  }
  system.infrastructure.projections.foreach { m =>
    verify(s"Projection: ${m.name}")(ProjectionBuilder.build(m, ctx))
  }
  verify("Bootstrap: ApplicationBootstrap")(
    ApplicationBootstrapBuilder.build(system, ctx)
  )
  verify("Bootstrap: SagaCoordinator")(
    BootstrapBuilder.buildSagaCoordinator(system.application.sagas, ctx)
  )
  system.application.sagas.foreach { m =>
    verify(s"Bootstrap: ${m.name}")(BootstrapBuilder.buildSagaTransactor(m, ctx))
  }
  system.application.aggregates.foreach { agg =>
    verify(s"Bootstrap: ${agg.name}")(BootstrapBuilder.buildAggregate(agg, ctx))
  }
  system.infrastructure.projections.foreach { m =>
    verify(s"Bootstrap: ${m.name}")(BootstrapBuilder.buildProjection(m, ctx))
  }

  println(
    s"\n>>> Verification Results: $passed Passed, $baseline Anchored(new baseline), $failed Failed."
  )
  if (failed > 0) {
    println(">>> Mismatches are reviewable via the .actual files written next to each snapshot.")
    sys.exit(1)
  }
}
