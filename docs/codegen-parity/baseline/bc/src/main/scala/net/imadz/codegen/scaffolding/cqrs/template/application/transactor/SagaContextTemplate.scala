package net.imadz.codegen.scaffolding.cqrs.template.application.transactor

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.SagaContextModel

import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object SagaContextTemplate extends CodeTemplate[SagaContextModel] {
  def generate(model: SagaContextModel): String = {
    import model._

    // 1. 构建包声明
    val pkgDecl = packageDecl(selfType.packageName)

    // 2. 构建导入声明
    val importDecl = imports(
      dependencies
        .map(d => s"${d.packageName}.${d.name}")
        .toSeq
        .sorted
        .distinct: _*
    )

    // 3. 构建字段列表
    val fields =
      model.fields.map(f => s"${f.name}: ${f.typeRef.name}").mkString(",\n  ")

    // 4. 构建case class
    val classDef = caseClass(
      name = selfType.name,
      parameters = fields,
      body = ""
    )

    // 5. 构建源文件
    val sourceFile = SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = Seq(classDef)
    )

    // 6. 生成代码
    sourceFile.code
  }
}
