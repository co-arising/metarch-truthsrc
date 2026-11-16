package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.application.{AggregateRulesModel, RuleModel}
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

/** P4 形式路径规则文件（<mod>.domain.invariant.<Agg>Rules.scala）：
  * params case class + 规则对象（InvariantRule），守卫按真源声明序 if/else-if 链；
  * `succeed-empty` 守卫失败臂＝Right(Nil)（幂等空事件成功），`reject`＝Left(iMadzError)；
  * 成功臂＝Right(List(<owner>.<Event>(<args>)))——事件值引用走实体对象 owner（Slice 2 教训）。 */
object AggregateRulesTemplate extends CodeTemplate[AggregateRulesModel] {

  def generate(model: AggregateRulesModel): String = {
    val pkgDecl = packageDecl(model.selfType.packageName)

    val importDecl = imports(
      (model.dependencies.toList.sortBy(_.fqn).map(_.fqn).distinct): _*)

    val eventType = model.eventType.name
    val stateType = model.stateType.name
    val ownerName = model.ownerType.name
    val rulesBody = model.rules.map(r => renderRule(r, eventType, stateType, ownerName)).mkString("\n\n")

    val objectDef = ObjectDefinition(
      name = model.selfType.name,
      extendsClause = None,
      body =
        s"""|/** Formal-path rules from the truth tree (P4 state deepening; golden-master
            |  * semantics transcribed mechanically). Guards evaluate in declaration
            |  * order; succeed-empty failures reply success with no events. */
            |$rulesBody""".stripMargin
    )

    SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = Seq(objectDef)
    ).code
  }

  private def renderRule(rule: RuleModel, eventType: String, stateType: String, ownerName: String): String = {
    val paramsDef =
      rule.paramFields.map { case (n, t) => s"$n: ${t.signature}" }.mkString(", ")
    val paramsLine =
      if (paramsDef.isEmpty) s"final case class ${rule.paramsName}()"
      else s"final case class ${rule.paramsName}($paramsDef)"

    val emissionExpr = rule.emission.map { e =>
      if (e.args.isEmpty) s"Right(List($ownerName.${e.name}()))"
      else s"Right(List($ownerName.${e.name}(${e.args.mkString(", ")})))"
    }.getOrElse("Right(Nil)")

    val guardLines = rule.guards.zipWithIndex.map { case (g, i) =>
      val failure = if (g.onFail == "succeed-empty") "Right(Nil)"
      else s"""Left(iMadzError("${g.errCode}", "${escape(g.desc)}"))"""
      // 失败检查＝成功条件的否定；cond 以 ! 开头时直接剥壳（避免 !(!...) 双重否定）
      val failureCond = if (g.cond.startsWith("!")) g.cond.drop(1) else s"!(${g.cond})"
      val note = if (g.desc.nonEmpty) s" // ${escape(g.desc)}" else ""
      val prefix = if (i == 0) "      if" else "      else if"
      s"""$prefix ($failureCond) $failure$note"""
    }.mkString("\n")

    val body =
      if (rule.guards.isEmpty) s"      $emissionExpr"
      else s"""$guardLines
              |      else $emissionExpr""".stripMargin

    s"""  $paramsLine
       |
       |  object ${rule.name} extends InvariantRule[$eventType, $stateType, ${rule.paramsName}] {
       |    def apply(state: $stateType, p: ${rule.paramsName}): Either[iMadzError, List[$eventType]] = {
       |$body
       |    }
       |  }"""
  }

  private def escape(s: String): String = s.replace("\\", "\\\\").replace("\"", "\\\"")
}
