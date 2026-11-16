package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.application.AggregateRepositoryModel

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object AggregateRepositoryTemplate
    extends CodeTemplate[AggregateRepositoryModel] {

  def generate(model: AggregateRepositoryModel): String = {
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
          s"${model.aggregateType.fqn}._", // 导入 Aggregate Object 本身
          "javax.inject._",
          "com.google.inject.ImplementedBy"
        )
      )

    val importDecl = imports(importList: _*)

    // 3. 构建方法代码
    val methodsCode = model.methods
      .map { m =>
        val params = m.parameters
          .map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}")
          .mkString(", ")
        // 2026-09-23 EP_GenerationTime_Code_Anchors B4（**形态③**）：查询方法参数＝`ParameterMetadata`
        // 的落点（`AggregateRepositoryBuilder:139` 早已透传 noteId），在 `def` 前发 `@param … @knowledge` 块。
        // 合成的 `entityRef` 方法（`FieldDef("id", String)`·无 noteId）返回空串，零漂移。
        val fieldDoc = net.imadz.codegen.scaffolding.cqrs.template.KnowledgeAnchorDoc.fieldDoc(m.parameters, "  ")
        s"$fieldDoc  def ${m.name}($params): ${m.returnType.signature}\n  // Logic: ${m.logicIntent}"
      }
      .mkString("\n\n")

    // 4. 构建接口定义
    val annotation = s"@ImplementedBy(classOf[${model.isImplementedBy.name}])"
    // B4（2026-09-24）：接口**容器级**锚——`trait` 前发裸行 `@knowledge <聚合号>@<hash8>`
    // （形态：注释块＋trait → 推送侧概念锚 `pkg.<X>Repository`）。此前该号只进台账行、
    // in-file 零锚 ⇒ 「改聚合 ⇒ 哪些仓库接口要重生成」只答到文件级、答不到符号级。
    // 无号（合成）不发（不编造）。
    val containerDoc = net.imadz.codegen.scaffolding.cqrs.template.KnowledgeAnchorDoc
      .conceptLine(model.noteId)
      .map(l => net.imadz.codegen.scaffolding.cqrs.template.KnowledgeAnchorDoc.block(Seq(l)))
      .getOrElse("")
    val traitDefinition = s"""/**
 * ${model.selfType.name}: Application Layer Repository Interface for ${model.aggregateType.name}
 * The abstraction for interacting with the Aggregate via sharding and persistence.
 */
${containerDoc}$annotation
trait ${model.selfType.name} {

$methodsCode

}
"""

    // 5. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

$traitDefinition
"""

    // 6. 生成代码
    sourceCode
  }
}
