package net.imadz.codegen.scaffolding.cqrs.template.application.transactor

import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.SagaDefinitionModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

/** saga_v3 SagaDefinition template: the single artifact a business developer writes. */
object SagaDefinitionTemplate extends CodeTemplate[SagaDefinitionModel] {
  def generate(model: SagaDefinitionModel): String = {
    import model._

    val baseImports = dependencies
      .map(d => s"${d.packageName}.${d.name}")
      .toSeq
      .sorted
      .distinct

    val additionalImports = Seq(
      "akka.actor.typed.ActorSystem",
      "akka.actor.typed.Scheduler",
      "akka.cluster.sharding.typed.scaladsl.EntityRef",
      "net.imadz.common.CommonTypes.iMadzError",
      "net.imadz.infra.saga.SagaTransactionCoordinator",
      "net.imadz.infra.saga.StepExecutor.CircuitBreakerSettings",
      "net.imadz.infra.saga.dsl.{ArgsCodec, RecoveryBehavior, ResiliencePolicy, SagaDefinition, SagaRegistry, SagaRunner, SagaStep}",
      "net.imadz.common.Id",
      "scala.concurrent.duration._",
      "scala.concurrent.ExecutionContext"
    )

    val importDecl = (baseImports ++ additionalImports).distinct.sorted
      .map(i => s"import $i")
      .mkString("\n")

    val argsFieldList =
      argsFields.map(f => s"${f.name}: ${f.typeRef.name}").mkString(", ")

    val moneyHelper =
      if (needsMoneyHelper)
        "        val money = Money(args.amount, java.util.Currency.getInstance(args.currency))\n"
      else ""

    val stepsCode = steps
      .map { s =>
        val args = s.participantArgs.mkString(", ")
        s"""          SagaStep("${s.stepId}",
            ${s.participantType.name}($args),
            ${s.resilienceCode},
            stepGroup = ${s.stepGroup})"""
      }
      .mkString(",\n")

    s"""package ${selfType.packageName}

$importDecl

/** saga_v3 declarative saga — participants are pure functions of (definition, args);
  * the journal never stores them. */
object ${selfType.name} {

  val Name = "$sagaName"
  val Version = $version

  final case class ${argsType.name}($argsFieldList)
  object ${argsType.name} {
    implicit val format: play.api.libs.json.Format[${argsType.name}] = play.api.libs.json.Json.format[${argsType.name}]
  }

  def definition(implicit ec: ExecutionContext, scheduler: Scheduler): SagaDefinition[iMadzError, ${contextType.name}, ${argsType.name}] =
    SagaDefinition[iMadzError, ${contextType.name}, ${argsType.name}](
      name = Name,
      version = Version,
      argsCodec = ArgsCodec.playJson[${argsType.name}],
      steps = args => {
$moneyHelper        Seq(
$stepsCode)
      },
      preCheck = args => Right(args),
      errorText = e => (e.code, e.message),
      onResult = (args, result) => Nil,
      defaultResilience = ResiliencePolicy.defaults
    )

  /** Registers the definition on this node — must run before sharding recovers any entity. */
  def register(implicit ec: ExecutionContext, scheduler: Scheduler): SagaDefinition[iMadzError, ${contextType.name}, ${argsType.name}] = {
    val defn = definition
    SagaRegistry.register(defn)
    defn
  }

  /** One runner per node for this saga. `coordinatorRef` resolves the sharded coordinator by txId. */
  def runner(system: ActorSystem[_], coordinatorRef: String => EntityRef[SagaTransactionCoordinator.Command])(
      implicit ec: ExecutionContext, scheduler: Scheduler): SagaRunner[iMadzError, ${argsType.name}] =
    new SagaRunner(definition, coordinatorRef, system)
}
"""
  }
}
