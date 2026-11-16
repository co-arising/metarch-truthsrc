package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.bootstsrap

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.bootstrap.ApplicationBootstrapModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object ApplicationBootstrapTemplate
    extends CodeTemplate[ApplicationBootstrapModel] {
  def generate(model: ApplicationBootstrapModel): String = {
    import model._

    // 1. 构建包声明
    val pkgDecl = packageDecl(selfType.packageName)

    // 2. 构建导入声明
    val baseImports = dependencies
      .filterNot(_.name == "ActorSystem")
      .map(d => s"${d.packageName}.${d.name}")
      .toSeq
      .sorted
      .distinct

    val akkaImports = Seq(
      "akka.actor.typed.scaladsl.adapter._",
      "akka.actor.ExtendedActorSystem",
      "akka.actor.ActorSystem", // Classic
      "akka.actor.typed.{ActorSystem => TypedActorSystem}",
      "javax.inject.{Inject, Singleton}"
    )

    val importDecl = imports((baseImports ++ akkaImports).distinct: _*)

    // 3. 构建类继承的traits
    val traitsExtends =
      if (model.traits.isEmpty) ""
      else model.traits.map(_.name).mkString(" with ")

    // 4. 构建注入的字段
    val injections = model.injectedFields
      .map(f => s"${f.name}: ${f.typeRef.name}")
      .mkString(",\n  ")

    // 5. 构建初始化块
    val initBlock = model.initCalls.mkString("\n  ")

    // 6. 构建类体
    // P5: strict saga coordinator wiring — one cluster singleton per strict fixture
    // entry; the reconcile token is deployment configuration (missing key fails the
    // start honestly, never a lenient default).
    // P12: the deployment-face event-stream source rides the shared journal — it
    // triggers the saga from persisted events and owns the terminal result publication.
    val strictWiring = model.strictEntries.zipWithIndex.map { case (entryFqn, i) =>
      val valName = if (model.strictEntries.size == 1) "strictSagaCoordinator" else s"strictSagaCoordinator$i"
      s"""  // strict saga coordinator (independent namespace; explicit deployment reconcile token)
  private val $valName: akka.actor.typed.ActorRef[net.imadz.infra.saga.strict.StrictSagaCoordinator.Command] =
    $entryFqn.spawnClusterSingleton(system, sharding,
      classicSystem.settings.config.getString("net.imadz.strict-saga.reconcile-token"))

  // deployment-face event-stream source: the shared journal's live event stream
  // triggers the saga from persisted events and owns the terminal result publication
  $entryFqn.installEventSource(system, sharding, $valName)""".stripMargin
    }.mkString("\n\n")

    val classBody = s"""
  // 隐式转换环境
  private implicit val system: TypedActorSystem[Nothing] = classicSystem.toTyped
  private implicit val ec: scala.concurrent.ExecutionContext = system.executionContext

  // Initializations
  $initBlock
$strictWiring
"""

    // 7. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

/**
 * ApplicationBootstrap: 应用引导类，负责初始化所有CQRS组件
 */
@Singleton
class ApplicationBootstrap @Inject()($injections) extends $traitsExtends {

$classBody

}
"""

    // 8. 生成代码
    sourceCode
  }
}
