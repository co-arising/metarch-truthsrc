package net.imadz.codegen.scaffolding.cqrs.projector

object ContextGenDSL {

  def renderCaseClass(name: String, fields: Seq[(String, String)]): String = {
    val fieldStr = fields.map { case (n, t) => s"$n: $t" }.mkString(",\n  ")
    s"""case class $name(
       |  $fieldStr
       |)""".stripMargin
  }

  def renderSealedTrait(name: String, methods: Seq[String] = Nil): String = {
    val body =
      if (methods.isEmpty) "" else " {\n  " + methods.mkString("\n  ") + "\n}"
    s"sealed trait $name$body"
  }

  def renderTrait(name: String, methods: Seq[String] = Nil): String = {
    val body =
      if (methods.isEmpty) "" else " {\n  " + methods.mkString("\n  ") + "\n}"
    s"trait $name$body"
  }

  def renderMethod(
      name: String,
      params: Seq[(String, String)],
      retType: String
  ): String = {
    val paramStr = params.map { case (n, t) => s"$n: $t" }.mkString(", ")
    s"def $name($paramStr): $retType"
  }
}
