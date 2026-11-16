package net.imadz.codegen.scaffolding.cqrs.dsl

import net.imadz.codegen.scaffolding.cqrs.TypeRef

/**
 * DSL基础框架，用于类型安全地生成Scala代码
 */
object CodeGenerationDSL {
  
  /**
   * 包声明
   */
  case class PackageDeclaration(packageName: String) {
    def code: String = s"package $packageName"
  }

  /**
   * 导入声明
   */
  case class ImportDeclaration(imports: Seq[String]) {
    def code: String = imports.sorted.map("import " + _).mkString("\n")
  }

  /**
   * 类定义
   */
  case class ClassDefinition(
      name: String,
      parameters: String,
      extendsClause: Option[String] = None,
      implementsClause: Option[String] = None,
      body: String,
      finalModifier: Boolean = false
  ) {
    def code: String = {
      val extendsPart = extendsClause.map(" extends " + _).getOrElse("")
      val implementsPart = implementsClause.map(" with " + _).getOrElse("")
      val modifierPart = if (finalModifier) "final " else ""
      s"${modifierPart}case class $name($parameters)$extendsPart$implementsPart {\n$body\n}"
    }
  }

  // 更新辅助函数
  def caseClass(name: String, parameters: String, body: String): ClassDefinition = {
    ClassDefinition(name, parameters, None, None, body)
  }

  def caseClass(name: String, parameters: String, extendsClause: String, body: String): ClassDefinition = {
    ClassDefinition(name, parameters, Some(extendsClause), None, body)
  }

  /** BUG-016（批1-C 2026-09-06）：值对象不可变性硬约束——final case class 工厂 */
  def finalCaseClass(name: String, parameters: String, body: String): ClassDefinition = {
    ClassDefinition(name, parameters, None, None, body, finalModifier = true)
  }

  /**
   * 对象定义
   */
  case class ObjectDefinition(
      name: String,
      extendsClause: Option[String] = None,
      implementsClause: Option[String] = None,
      body: String
  ) {
    def code: String = {
      val extendsPart = extendsClause.map(" extends " + _).getOrElse("")
      val implementsPart = implementsClause.map(" with " + _).getOrElse("")
      s"object $name$extendsPart$implementsPart {\n$body\n}"
    }
  }

  /**
   * 完整的源文件
   */
  case class SourceFile(
      packageDecl: PackageDeclaration,
      importDecl: ImportDeclaration,
      definitions: Seq[Definition]
  ) {
    def code: String = {
      val parts = Seq(packageDecl.code, importDecl.code) ++ definitions.map(_.code)
      parts.mkString("\n\n") + "\n"
    }
  }

  /**
   * 定义类型
   */
  sealed trait Definition {
    def code: String
  }

  object Definition {
    implicit def fromClassDef(cd: ClassDefinition): Definition = {
      new Definition { def code = cd.code }
    }
    implicit def fromObjectDef(od: ObjectDefinition): Definition = {
      new Definition { def code = od.code }
    }
    /** 纯注释块定义（2026-09-20）：VO 等制品的概念级知识锚点注释——独立 Definition，
      * 渲染时与自己后面的定义以空行分隔（`SourceFile.code` 的 mkString("\n\n")）。 */
    final case class CommentBlock(text: String) extends Definition {
      def code: String = text
    }
  }

  // 辅助函数
  def packageDecl(packageName: String): PackageDeclaration = PackageDeclaration(packageName)
  def imports(imports: String*): ImportDeclaration = ImportDeclaration(imports)
  def objectDef(name: String, body: String): ObjectDefinition = ObjectDefinition(name, None, None, body)
  def objectDef(name: String, extendsClause: String, body: String): ObjectDefinition = ObjectDefinition(name, Some(extendsClause), None, body)

  /**
   * 字段生成辅助
   */
  def generateFields(fields: Seq[(String, TypeRef)]): String = {
    fields.map { case (name, typeRef) =>
      s"$name: ${typeRef.signature}"
    }.mkString(", ")
  }
}
