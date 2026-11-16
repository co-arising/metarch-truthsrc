package net.imadz.codegen.scaffolding.cqrs.builder.application.transactor

import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.{
  DefinitionStepModel,
  SagaDefinitionModel
}
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef, TypeResolver}
import net.imadz.meta._

/** saga_v3: builds the declarative SagaDefinition model — args case class,
  * steps as pure functions of args, per-step full ResiliencePolicy. */
object SagaDefinitionBuilder {

  def build(
      meta: SagaTransactorMetadata,
      ctx: GeneratorContext
  ): SagaDefinitionModel = {
    val pkg = ctx.layout.application.services.transactor.root
    val baseName = meta.name.replace("SagaTransactor", "")
    val selfType = TypeRef(s"${baseName}SagaDefinition", pkg)
    val contextType = meta.context
      .map(c => ctx.typeResolver.sagaContext(c.name))
      .getOrElse(ctx.typeResolver.sagaContext(meta.name))

    val argsMeta = meta.args.getOrElse(
      throw new RuntimeException(
        s"Saga '${meta.name}' has no args metadata (saga_v3 requires SagaArgsMetadata)"
      )
    )
    val argsType = TypeRef(argsMeta.name, pkg)
    val argsFields = argsMeta.fields.map { f =>
      FieldDef(f.name, ctx.typeResolver.resolve(f.fieldType))
    }
    val argsFieldNames = argsMeta.fields.map(_.name).toSet
    val argsFieldTypes = argsMeta.fields.map(f => f.name -> f.fieldType).toMap

    val needsMoneyHelper = meta.participants.exists { p =>
      p.fields.exists { f =>
        f.fieldType match {
          case StructRef("Money") => true
          case _                  => false
        }
      }
    } && argsFieldNames.contains("amount") && argsFieldNames.contains("currency")

    // One logical step per participant: stepId from its first metadata step,
    // phases come from the participant's PhaseAsk bindings.
    val steps = meta.participants.map { p =>
      val participantSteps = meta.steps.filter(_.participantName == p.name)
      val stepId = participantSteps.headOption
        .map(_.stepId)
        .getOrElse(p.name)
      val resilience = participantSteps.headOption
        .map(_.resilience)
        .getOrElse(throw new RuntimeException(s"Participant '${p.name}' has no steps"))

      val participantArgs = p.fields.map { f =>
        val symbol = p.argMappings.getOrElse(f.name, f.name)
        f.fieldType match {
          case StructRef("Money") =>
            "money"
          case CustomType("Id", _, _) if argsFieldTypes.get(symbol).contains(StringType) =>
            s"Id.of(args.$symbol)"
          case _ =>
            s"args.$symbol"
        }
      }

      DefinitionStepModel(
        stepId = stepId,
        participantType = ctx.typeResolver.sagaParticipant(p.name, pkg),
        participantArgs = participantArgs,
        resilienceCode = renderResilience(resilience),
        stepGroup = participantSteps.headOption.map(_.stepGroup).getOrElse(1)
      )
    }

    val deps = (steps.map(_.participantType).toSet + contextType ++ participantValueDeps(meta, ctx))
      .filter(_.shouldImport(pkg))

    SagaDefinitionModel(
      selfType = selfType,
      sagaName = kebab(baseName),
      version = meta.version,
      argsType = argsType,
      argsFields = argsFields,
      contextType = contextType,
      steps = steps,
      needsMoneyHelper = needsMoneyHelper,
      dependencies = deps
    )
  }

  /** Full-field ResiliencePolicy (AC-3.3): maxRetries / timeoutPerAttempt /
    * recovery / circuitBreaker all surface in the artifact. */
  private def renderResilience(r: ResiliencePolicy): String = {
    val maxRetries = r.retryStrategy match {
      case e: ExponentialBackoff => e.maxRetries
      case _                     => 3
    }
    val recovery = r.recoveryBehavior match {
      case RetryIfOngoing => "RecoveryBehavior.RetryIfOngoing"
      case FailIfOngoing  => "RecoveryBehavior.FailIfOngoing"
    }
    val cb = r.circuitBreaker
      .map(c =>
        s"Some(CircuitBreakerSettings(${c.maxFailures}, ${renderDuration(c.callTimeout)}, ${renderDuration(c.resetTimeout)}))"
      )
      .getOrElse("None")
    s"ResiliencePolicy(maxRetries = $maxRetries, timeoutPerAttempt = ${renderDuration(r.timeoutPerAttempt)}, recovery = $recovery, circuitBreaker = $cb)"
  }

  /** "5 seconds" -> "5.seconds", "30 seconds" -> "30.seconds" */
  private def renderDuration(raw: String): String = {
    val parts = raw.trim.split("\\s+")
    if (parts.length == 2) {
      val unit = parts(1).toLowerCase.takeWhile(_.isLetter) match {
        case "milli" | "millis" | "millisecond" | "milliseconds" => "millis"
        case "second" | "seconds"                                 => "seconds"
        case "minute" | "minutes"                                 => "minutes"
        case "hour" | "hours"                                     => "hours"
        case other                                                => other
      }
      s"${parts(0)}.$unit"
    } else raw
  }

  private def participantValueDeps(
      meta: SagaTransactorMetadata,
      ctx: GeneratorContext
  ): Set[TypeRef] =
    meta.participants.flatMap { p =>
      p.fields.map(f => ctx.typeResolver.resolve(f.fieldType))
    }.toSet

  private def kebab(name: String): String =
    name.replaceAll("([a-z])([A-Z])", "$1-$2").toLowerCase
}
