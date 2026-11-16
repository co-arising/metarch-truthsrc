package net.imadz.codegen.scaffolding.cqrs.template.domain

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.domain.DomainServiceModel

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object DomainServiceTemplate extends CodeTemplate[DomainServiceModel] {

  def generate(model: DomainServiceModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val importDecl = imports(
      model.dependencies.toList
        .sortBy(_.fqn)
        .map(_.fqn)
        .filterNot(p =>
          p.isEmpty || p == model.selfType.packageName || p.startsWith(
            "java.lang"
          )
        ): _*
    )

    // 3. 构建方法代码
    val methodsCode = model.methods
      .map { m =>
        val params = m.parameters
          .map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}")
          .mkString(", ")
        s"  def ${m.name}($params): ${m.returnType.signature} = {\n  /*\n    ${m.logicCode}\n    */\n    ???\n  }"
      }
      .mkString("\n\n")

    // 4. 构建对象定义
    val domainServiceObj = objectDef(
      name = model.selfType.name,
      extendsClause = model.superInterface.signature,
      body = methodsCode
    )

    // 5. 构建源文件
    val sourceFile = SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = Seq(domainServiceObj)
    )

    // 6. 生成代码
    sourceFile.code
  }
}
