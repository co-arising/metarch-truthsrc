package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.application.AggregateFactoryModel

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object AggregateFactoryTemplate extends CodeTemplate[AggregateFactoryModel] {

  def generate(model: AggregateFactoryModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val importList = model.dependencies.toList
      .sortBy(_.fqn)
      .map(_.fqn)
      .filterNot(p =>
        p.isEmpty || p == model.selfType.packageName || p.startsWith(
          "java.lang"
        )
      )
      .++(
        Seq(
          "javax.inject.Inject",
          "akka.cluster.sharding.typed.scaladsl.ClusterSharding",
          "akka.util.Timeout",
          "scala.concurrent.duration._",
          "scala.concurrent.ExecutionContext",
          model.aggregateType.fqn // 导入 Aggregate Object
        )
      )

    val importDecl = imports(importList: _*)

    // 3. 构建工厂方法
    val methods = model.factoryMethods
      .map { m =>
        val params = m.parameters
          .map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}")
          .mkString(", ")
        // 2026-09-23 EP_GenerationTime_Code_Anchors B4（**形态③**）：工厂方法参数是知识元素的落点
        // （聚合标识符／初始化命令参数），有 noteId 者在此发 `@param … @knowledge` 块——
        // 解析器认「注释块后**紧跟 `def`**」这一形态（本模板无 case class，形态① 结构上认不出）。
        // 无 noteId（合成/注入）时返回空串，零漂移。
        val fieldDoc = net.imadz.codegen.scaffolding.cqrs.template.KnowledgeAnchorDoc.fieldDoc(m.parameters, "  ")
        // [FIX] 引用 EntityTypeKey 时加上 Aggregate 前缀
        val keyRef = s"${model.aggregateType.name}.${model.entityTypeKey}"
        // 替换 bodyLogic 中的 key 引用 (如果 Builder 传过来的是短名)
        val fixedLogic = m.bodyLogic.replace(model.entityTypeKey, keyRef)

        s"""$fieldDoc  def ${m.name}($params): ${m.returnType.signature} = {
    $fixedLogic
  }"""
      }
      .mkString("\n\n")

    // 4. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

/**
 * ${model.selfType.name}: Aggregate Factory for ${model.aggregateType.name}
 * Creates and manages aggregate instances via cluster sharding
 */
class ${model.selfType.name} @Inject() (clusterSharding: ClusterSharding)(implicit ec: ExecutionContext) {
  implicit val askTimeout: Timeout = Timeout(10.seconds)

$methods

}
"""

    // 5. 生成代码
    sourceCode
  }
}
