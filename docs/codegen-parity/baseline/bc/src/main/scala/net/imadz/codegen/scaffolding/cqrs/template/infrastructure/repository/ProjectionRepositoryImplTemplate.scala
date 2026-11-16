package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.repository

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.repository.ProjectionRepositoryImplModel

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object ProjectionRepositoryImplTemplate
    extends CodeTemplate[ProjectionRepositoryImplModel] {

  def generate(model: ProjectionRepositoryImplModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val baseImports = model.dependencies.toList
      .sortBy(_.fqn)
      .map(_.fqn)
      .filterNot(p =>
        p.isEmpty || p == model.selfType.packageName || p.startsWith(
          "java.lang"
        )
      )

    // 额外导入 Table Object
    val tableName = if (model.dtoType.name.endsWith("Repository")) model.dtoType.name.replace("Repository", "") else model.dtoType.name
    val tableObjImport =
      s"${model.interfaceType.packageName}.${tableName}Table._"

    // [M3 向量读模型] 注入式构造（PgVectorStore＋OllamaEmbeddingClient）；表路径零构造参数（零漂移）
    // 注入式构造必须 @Inject()——Guice 对无注解多参构造不实例化（9000 启动 CreationException 实证·批F）
    val hasInjectedCtor = model.injectedConstructorParams.nonEmpty
    val constructorParams = if (hasInjectedCtor)
      "(" + model.injectedConstructorParams.map(p => s"${p.name}: ${p.typeRef.signature}").mkString(", ") + ")"
    else ""

    val importList = (baseImports ++ Seq(
      tableObjImport,
      "scalikejdbc._",
      "scala.concurrent.ExecutionContext.Implicits.global",
      "javax.inject.Singleton"
    ) ++ (if (hasInjectedCtor) Seq("javax.inject.Inject") else Nil)).distinct

    val importDecl = imports(importList: _*)

    // 3. 构建方法代码
    // 2026-08-24 投影仓库模式（Task 45/46-71）：builder 确定性推导的完整实现放 MANUAL 区块内——
    // 默认即可运行（Spec 背书），用户手改后重生成按 MERGE 字节级保留。
    val methodsCode = model.methods
      .map { m =>
        val params =
          m.params.map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}").mkString(", ")
        // 2026-09-23 EP_GenerationTime_Code_Anchors B4（**形态③**）：impl 侧方法参数＝`ParameterMetadata` 落点
        // （`ProjectionRepositoryImplBuilder` 两处已补 noteId），在 `def` 前补 `@param … @knowledge` 块。
        val fieldDoc = net.imadz.codegen.scaffolding.cqrs.template.KnowledgeAnchorDoc.fieldDoc(m.params, "  ")
        val body = m.bodyLogic.split("\n").map(l => s"    $l").mkString("\n")

        s"""$fieldDoc  override def ${m.name}($params): ${m.returnType.signature} = {
    // ==== BEGIN MANUAL ====
$body
    // ==== END MANUAL ====
  }"""
      }
      .mkString("\n\n")

    // [M3 向量读模型] 额外成员（ViewColumns 列白名单＋rowToView 行→DTO 映射）；表路径无
    val extraMembersCode = model.extraMembers.map(m => s"\n$m\n").getOrElse("")

    // 4. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

/**
 * ${model.selfType.name}: Projection Repository Implementation
 */
@Singleton
class ${model.selfType.name}${if (hasInjectedCtor) " @Inject() " else ""}$constructorParams extends ${model.interfaceType.name} {

$methodsCode
$extraMembersCode
}
"""

    // 5. 生成代码
    sourceCode
  }
}
