package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.repository

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.repository.AggregateRepositoryImplModel

import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object AggregateRepositoryImplTemplate
    extends CodeTemplate[AggregateRepositoryImplModel] {

  def generate(model: AggregateRepositoryImplModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val additionalImports = Seq(
      "javax.inject.Inject",
      "javax.inject.Singleton",
      "akka.cluster.sharding.typed.scaladsl.ClusterSharding"
    )

    val importList = (model.dependencies.toList
      .sortBy(_.fqn)
      .map(_.fqn)
      .filterNot(p =>
        p.isEmpty || p == model.selfType.packageName || p.startsWith(
          "java.lang"
        )
      )
      .++(additionalImports))
      .distinct

    val importDecl = imports(importList: _*)

    // 3. 构建方法代码
    val methodsCode = model.methods
      .map { m =>
        val typeKeyRef = s"${model.aggregateType.name}.entityTypeKey"
        s"  override def ${m.name}(${m.paramName}: ${m.paramType.name}): ${m.returnType.signature} =\n    sharding.entityRefFor($typeKeyRef, ${m.paramName}.toString)"
      }
      .mkString("\n\n")

    // 4. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

/**
 * ${model.selfType.name}: Aggregate Repository Implementation
 * Implementation of ${model.interfaceType.name} interface
 */
@Singleton
class ${model.selfType.name} @Inject() (sharding: ClusterSharding) extends ${model.interfaceType.name} {

$methodsCode

}
"""

    // 5. 生成代码
    sourceCode
  }
}
