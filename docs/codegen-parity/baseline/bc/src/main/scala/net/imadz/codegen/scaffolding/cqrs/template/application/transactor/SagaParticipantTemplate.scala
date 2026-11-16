package net.imadz.codegen.scaffolding.cqrs.template.application.transactor

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.{
  ParticipantPhaseAskModel,
  SagaParticipantModel
}

import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

/** saga_v3 participant template: pure-data AskParticipant subclass.
  *
  * Regression contract (AC-3.4): no `???`, no `ParticipantEffect.success` stubs,
  * every bound phase maps reply.error -> Left and the result field -> SagaResult. */
object SagaParticipantTemplate extends CodeTemplate[SagaParticipantModel] {
  def generate(model: SagaParticipantModel): String = {
    import model._

    val pkgDecl = packageDecl(selfType.packageName)

    val baseImports = dependencies
      .map(d => s"${d.packageName}.${d.name}")
      .toSeq
      .sorted
      .distinct

    val additionalImports = Seq(
      "net.imadz.common.CommonTypes.{Id, iMadzError}",
      "net.imadz.common.Id",
      "net.imadz.infra.saga.SagaParticipant.SagaResult",
      "net.imadz.infra.saga.dsl.{AskParticipant, ErrorAction, ErrorRules, PhaseAsk}",
      "scala.concurrent.ExecutionContext",
      "scala.concurrent.duration._"
    )

    // Individual deps covered by the brace imports above are dropped to avoid duplicates.
    val coveredByAdditional = Set(
      "net.imadz.common.CommonTypes.Id",
      "net.imadz.common.CommonTypes.iMadzError",
      "scala.concurrent.ExecutionContext"
    )
    val importDecl = imports(
      (baseImports.filterNot(coveredByAdditional.contains) ++ additionalImports).distinct: _*
    )

    val params =
      constructorParams.map(p => s"${p.name}: ${p.typeRef.name}").mkString(", ")

    val aggregateIdField =
      constructorParams.headOption.map(_.name).getOrElse("userId")

    // ErrorRules live in a companion-object val: partial functions passed in
    // super-constructor args hit Scala 2.13 premature-access.
    val action = if (rules.retryable) "ErrorAction.Retryable" else "ErrorAction.NonRetryable"
    val codePatterns = rules.codes.distinct.map(c => s""""$c"""").mkString(" | ")
    val rulesDecl =
      if (rules.codes.isEmpty)
        "  private val Rules: ErrorRules[iMadzError] = ErrorRules.none[iMadzError]"
      else
        s"""  private val Rules: ErrorRules[iMadzError] = ErrorRules(
    business = { case ${rules.errorType}($codePatterns, _) => $action },
    describe = e => s"$${e.code}: $${e.message}"
  )"""

    def renderBinding(bindingOpt: Option[ParticipantPhaseAskModel]): String =
      bindingOpt match {
        case Some(b) =>
          val argsList = (b.commandArgs :+ "replyTo").mkString(", ")
          val resultExpr =
            if (b.resultFieldIsString) s"r.${b.resultField}"
            else s"r.${b.resultField}.toString"
          // Convention: repository exposes find<Base>ByUserId
          val baseName = b.repositoryFieldName
            .stripSuffix("Repository")
            .capitalize
          val findMethod = s"find${baseName}ByUserId"
          s"""Some(PhaseAsk.ask[${b.commandType.name}, ${b.replyType.name}, iMadzError, String, ${contextType.name}](
      ref = ctx => ctx.${b.repositoryFieldName}.$findMethod($aggregateIdField),
      command = (txId, replyTo) => ${b.commandType.name}($argsList),
      mapReply = r => r.error.map(Left(_)).getOrElse(Right(SagaResult($resultExpr)))
    ))"""
        case None => "None"
      }

    val body =
      s"""
  override protected val prepareBinding: Option[PhaseAsk[iMadzError, String, ${contextType.name}]] =
    ${renderBinding(prepareBinding)}

  override protected val commitBinding: Option[PhaseAsk[iMadzError, String, ${contextType.name}]] =
    ${renderBinding(commitBinding)}

  override protected val compensateBinding: Option[PhaseAsk[iMadzError, String, ${contextType.name}]] =
    ${renderBinding(compensateBinding)}
"""

    s"""${pkgDecl.code}

${importDecl.code}

/** saga_v3 TCC participant: pure data, never journaled. */
object ${selfType.name} {
$rulesDecl
}

case class ${selfType.name}($params)(implicit ec: ExecutionContext, scheduler: akka.actor.typed.Scheduler)
    extends AskParticipant[iMadzError, String, ${contextType.name}](
      rules = ${selfType.name}.Rules,
      askTimeout = $askTimeout
    ) {$body}
"""
  }
}
