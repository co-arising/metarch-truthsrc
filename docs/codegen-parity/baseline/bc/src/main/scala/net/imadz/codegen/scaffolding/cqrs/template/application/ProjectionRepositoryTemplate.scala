package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.FieldDef
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.application.ProjectionRepositoryModel

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object ProjectionRepositoryTemplate
    extends CodeTemplate[ProjectionRepositoryModel] {

  /** 多项目模式（M2a/EP Phase 2 增量③）：摘 @ImplementedBy（Impl 住 glue·kernel 接口
    * import glue Impl＝方向违规）——装配改 root RepositoryBindingModule（di-poc 判例）。 */
  @volatile var multiProject: Boolean = sys.props.get("codegen.multiProject").contains("true")

  // 辅助: 渲染字段
  def renderFields(fields: Seq[FieldDef]): String = {
    fields.map(f => s"${NamingConventions.scalaIdentifier(f.name)}: ${f.typeRef.signature}").mkString(", ")
  }

  def generate(model: ProjectionRepositoryModel): String = {
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
        (if (multiProject) Seq("javax.inject.Inject")
         else Seq("com.google.inject.ImplementedBy", "javax.inject.Inject"))
      )
      .distinct // Future[List]/Future[Option] 等不同泛型形态的 TypeRef 各渲染一行 import——按 fqn 去重

    val importDecl = imports(importList: _*)

    // 3. 构建DTO代码
    // EP_GenerationTime_Code_Anchors P1（rm 面本体锚）：有 noteId 的视图字段发 `@param … @knowledge`，
    // 解析器（形态①：doc 块紧跟 case class）据此把读模型字段接回知识图——此前 rm 面 codeFqn 恒 0。
    // 缩进空串：本文件的 DTO 由 ObjectDefinition 原样内联，`case class` 就在第 0 列。
    val dtoFields = renderFields(model.dtoModel.fields)
    val dtoDoc = net.imadz.codegen.scaffolding.cqrs.template.KnowledgeAnchorDoc.fieldDoc(model.dtoModel.fields)
    val dtoClass = caseClass(
      name = model.dtoModel.name,
      parameters = dtoFields,
      body = ""
    )
    val dtoCompanion = ObjectDefinition(
      name = model.dtoModel.companionName,
      body = dtoDoc + dtoClass.code
    )

    // 4. 构建方法代码
    val methodsCode = model.methods
      .map { m =>
        val params = m.parameters
          .map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}")
          .mkString(", ")
        // 2026-09-23 EP_GenerationTime_Code_Anchors B4（**形态③**）：本模板此前只给 DTO 发锚（形态①），
        // 方法参数面（`ParameterMetadata` 落点）没有出口 ⇒ 在 `def` 前补 `@param … @knowledge` 块。
        val fieldDoc = net.imadz.codegen.scaffolding.cqrs.template.KnowledgeAnchorDoc.fieldDoc(m.parameters, "  ")
        s"$fieldDoc  def ${m.name}($params): ${m.returnType.signature}\n  // Logic: ${m.logicIntent}"
      }
      .mkString("\n\n")

    // 5. 构建接口定义（multi 摘注·root bind）
    val annotation =
      if (multiProject) ""
      else s"@ImplementedBy(classOf[${model.isImplementedBy.name}])"
    val traitDefinition = s"""/**
 * ${model.selfType.name}: Projection Layer Repository Interface (Read Side)
 * DTOs are defined in the companion object.
 */

$annotation
trait ${model.selfType.name} {

  import ${model.dtoModel.companionName}._

$methodsCode

}
"""

    // 6. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

${dtoCompanion.code}

$traitDefinition
"""

    // 7. 生成代码
    sourceCode
  }
}
