package net.imadz.codegen.scaffolding.cqrs.builder.application.transactor

import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.{
  ParticipantErrorRulesModel,
  ParticipantPhaseAskModel,
  SagaParticipantModel
}
import net.imadz.codegen.scaffolding.cqrs.{
  FieldDef,
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.meta._
import net.imadz.codegen.structure.NamingConventions

/** saga_v3: builds an AskParticipant model — pure data, per-phase PhaseAsk bindings,
  * dual-track ErrorRules in the companion object. */
object SagaParticipantBuilder {

  def build(
      participantMeta: SagaParticipantMetadata,
      transactorMeta: SagaTransactorMetadata,
      ctx: GeneratorContext
  ): SagaParticipantModel = {
    val pkg = ctx.layout.application.services.transactor.root
    val selfType = ctx.typeResolver.sagaParticipant(participantMeta.name, pkg)

    val contextType = transactorMeta.context
      .map(c => ctx.typeResolver.sagaContext(c.name))
      .getOrElse(ctx.typeResolver.sagaContext(transactorMeta.name))

    val repoFieldName = resolveRepositoryFieldName(participantMeta, ctx)
    val constructorParams = buildConstructorParams(participantMeta, ctx)

    val (prepareBinding, commitBinding, compensateBinding) =
      resolveRelevantSteps(participantMeta, transactorMeta)

    val relevantSteps =
      transactorMeta.steps.filter(_.participantName == participantMeta.name)

    // askTimeout from the first step's timeoutPerAttempt (all steps validated consistent by H001)
    val askTimeout = relevantSteps.headOption
      .map(s => renderDuration(s.resilience.timeoutPerAttempt))
      .getOrElse("5.seconds")

    val errorRules = relevantSteps.flatMap(_.resilience.errorRules)
    val rules = ParticipantErrorRulesModel(
      errorType = errorRules.headOption.map(_.errorType).getOrElse("iMadzError"),
      codes = errorRules.map(_.codePattern).distinct,
      retryable = errorRules.headOption.exists(_.action == MarkAsRetryable)
    )

    val prepareAsk = buildPhaseAsk(prepareBinding, participantMeta, repoFieldName, ctx)
    val commitAsk = buildPhaseAsk(commitBinding, participantMeta, repoFieldName, ctx)
    val compensateAsk = buildPhaseAsk(compensateBinding, participantMeta, repoFieldName, ctx)

    val dependencies = collectDependencies(
      constructorParams,
      contextType,
      prepareBinding,
      commitBinding,
      compensateBinding,
      ctx,
      pkg
    )

    SagaParticipantModel(
      selfType,
      constructorParams,
      contextType,
      rules,
      askTimeout,
      prepareAsk,
      commitAsk,
      compensateAsk,
      dependencies
    )
  }

  /** "5 seconds" -> "5.seconds", "100 millis" -> "100.millis" */
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

  private def resolveRepositoryFieldName(
      participantMeta: SagaParticipantMetadata,
      ctx: GeneratorContext
  ): String = {
    val aggType = ctx.typeResolver.resolve(participantMeta.interactsWith)
    val aggBaseName = NamingConventions.getAggregateBaseName(aggType.name)
    val repoName =
      NamingConventions.aggregateRepositoryInterfaceName(aggBaseName)
    val repoType = ctx.typeResolver.resolve(AggregateRepositoryRef(repoName))
    repoType.name.head.toLower + repoType.name.tail
  }

  private def buildConstructorParams(
      participantMeta: SagaParticipantMetadata,
      ctx: GeneratorContext
  ): Seq[FieldDef] =
    participantMeta.fields
      .filterNot(f => isRepository(f.fieldType))
      .map(f => FieldDef(f.name, ctx.typeResolver.resolve(f.fieldType)))

  private def resolveRelevantSteps(
      participantMeta: SagaParticipantMetadata,
      transactorMeta: SagaTransactorMetadata
  ): (Option[CommandBinding], Option[CommandBinding], Option[CommandBinding]) = {
    val relevantSteps =
      transactorMeta.steps.filter(_.participantName == participantMeta.name)

    val prepareBinding =
      relevantSteps.flatMap(_.phaseLogic.prepareCommand).headOption
    val commitBinding = relevantSteps.flatMap(_.phaseLogic.commitCommand).headOption
    val compensateBinding =
      relevantSteps.flatMap(_.phaseLogic.compensateCommand).headOption

    (prepareBinding, commitBinding, compensateBinding)
  }

  /** Renders one PhaseAsk model: command args (symbols resolved against
    * {transactionId} ∪ participant fields, replyTo appended), reply mapped via
    * reply.error -> Left / first result field -> SagaResult. */
  private def buildPhaseAsk(
      cmdBindingOpt: Option[CommandBinding],
      participantMeta: SagaParticipantMetadata,
      repoFieldName: String,
      ctx: GeneratorContext
  ): Option[ParticipantPhaseAskModel] =
    cmdBindingOpt.map { cmdBinding =>
      val cmdRef = cmdBinding.commandRef
      val cmdType = ctx.typeResolver.resolve(cmdRef)
      val cmdMeta = ctx.metaRegistry
        .resolveByName[SubordinateCommandMetadata](cmdRef.targetName)
        .getOrElse(
          throw new RuntimeException(
            s"Cannot find metadata for command: ${cmdRef.targetName}"
          )
        )

      val participantFields = participantMeta.fields.map(_.name).toSet

      val args = cmdMeta.parameters
        .filterNot(p => p.name.toLowerCase == "replyto")
        .map { p =>
          val symbol = cmdBinding.mappings.getOrElse(p.name, p.name)
          val paramTypeName = p.parameterType match {
            case c: CustomType => c.typeName
            case _             => p.parameterType.toString
          }
          symbol match {
            case "transactionId" =>
              if (paramTypeName == "Id") "Id.of(txId)" else "txId"
            case field if participantFields.contains(field) => field
            case other                                       => other
          }
        }

      val replyType = cmdMeta.replyToType
        .map(r => ctx.typeResolver.resolve(r))
        .getOrElse(
          throw new RuntimeException(
            s"Command '${cmdRef.targetName}' has no replyToType (H001 should have caught this)"
          )
        )
      val replyMeta = cmdMeta.replyToType.flatMap { ref =>
        ctx.metaRegistry.resolveByName[SubordinateCommandReplyMetadata](ref.targetName)
      }
      val resultParam = replyMeta
        .flatMap(_.parameters.find(p => p.name != "error"))
        .getOrElse(
          throw new RuntimeException(
            s"Reply of '${cmdRef.targetName}' has no result field (H001 should have caught this)"
          )
        )
      val resultFieldIsString = resultParam.parameterType match {
        case StringType => true
        case _          => false
      }

      ParticipantPhaseAskModel(
        commandType = cmdType,
        replyType = replyType,
        commandArgs = args,
        repositoryFieldName = repoFieldName,
        resultField = resultParam.name,
        resultFieldIsString = resultFieldIsString
      )
    }

  private def collectDependencies(
      constructorParams: Seq[FieldDef],
      contextType: TypeRef,
      prepareBinding: Option[CommandBinding],
      commitBinding: Option[CommandBinding],
      compensateBinding: Option[CommandBinding],
      ctx: GeneratorContext,
      pkg: String
  ): Set[TypeRef] = {
    val baseDeps = Set(
      ctx.knownFrameworkTypes("ExecutionContext"),
      TypeRef("Scheduler", "akka.actor.typed"),
      ctx.types.iMadzError,
      contextType
    )

    val actionDeps = Seq(prepareBinding, commitBinding, compensateBinding).flatMap {
      binding =>
        val cmdDep = binding.map(b => ctx.typeResolver.resolve(b.commandRef))
        val replyDep = binding.flatMap { b =>
          ctx.metaRegistry
            .resolveByName[SubordinateCommandMetadata](b.commandRef.targetName)
            .flatMap(_.replyToType)
            .map(r => ctx.typeResolver.resolve(r))
        }
        cmdDep.toSeq ++ replyDep.toSeq
    }
    val paramDeps = constructorParams.flatMap(_.typeRef.collectAllDependencies)

    (baseDeps ++ actionDeps ++ paramDeps).filter(_.shouldImport(pkg))
  }

  private def isRepository(t: MetaType): Boolean = t match {
    case r: MetaRef  => r.targetName.endsWith("Repository")
    case d: DataType => d.fullQualifiedName.dottedPath.endsWith("Repository")
    case _           => false
  }
}
