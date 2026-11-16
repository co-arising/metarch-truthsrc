package net.imadz.codegen.scaffolding.cqrs.template.domain

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.FieldDef
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.domain.DomainEntityModel

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate
import net.imadz.codegen.scaffolding.cqrs.template.KnowledgeAnchorDoc
import net.imadz.codegen.scaffolding.cqrs.builder.domain.DomainEntityBuilder

object DomainEntityTemplate extends CodeTemplate[DomainEntityModel] {

  def generate(model: DomainEntityModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    // [FIX] Use shouldImport to filter dependencies for code generation
    // The model.dependencies includes ALL deps for graph construction
    // But imports should only contain actually importable types
    val importDecl = imports(
      model.dependencies
        .filter(_.shouldImport(model.selfType.packageName))
        .toList
        .sortBy(_.fqn)
        .map(_.fqn): _*
    )

    // 3. 辅助：生成字段定义 (name: Type = Default)
    def renderField(f: FieldDef): String = {
      val defaultPart = f.defaultValue.map(v => s" = $v").getOrElse("")
      s"${NamingConventions.scalaIdentifier(f.name)}: ${f.typeRef.signature}$defaultPart"
    }

    /** 字段知识注释——实现已提到 `KnowledgeAnchorDoc`（EP_GenerationTime_Code_Anchors P1：
      * rm/pm/vo 三面同时要发同形态，避免四份漂移）；此处保留局部名以免改动下面所有调用点。 */
    def fieldDoc(fields: Seq[FieldDef], indent: String): String =
      net.imadz.codegen.scaffolding.cqrs.template.KnowledgeAnchorDoc.fieldDoc(fields, indent)

    // 4. 生成State类代码
    val stateFields = model.state.fields.map(renderField).mkString(", ")
    val stateCode = s"${fieldDoc(model.state.fields, "  ")}  case class ${model.state.name}($stateFields)"

    // 5. 生成empty工厂方法代码
    val emptyMethodCode = if (model.state.fields.nonEmpty) {
      val idField = model.state.fields.head
      val args = model.state.fields
        .map { f =>
          if (f.name == idField.name) f.name // ID 传参
          // 乐观锁版本计数器初值 0（EP_Catalog_Concept_Write_Model §3.5）：与 rules_domain_gen
          // 「版本参数取 state.version 计数」配合——创建类事件发 (0, 1)，与旧占位 literal:0/1 同值（零行为漂移）；
          // 若留中性值 1 则变 (1, 2)，等于谎报「已更新两次」。
          // ⚠️ 只对数值型 version 生效：ModelCatalogState.version 是**语义化版本串**（"1.0.0"），中性值 "" 正确。
          else if (f.name == "version" && Set("Int", "Integer", "Long").contains(f.typeRef.name))
            DomainEntityBuilder.neutralValueFor(f.typeRef).map(_ => if (f.typeRef.name == "Long") "0L" else "0").getOrElse("???")
          else DomainEntityBuilder.neutralValueFor(f.typeRef).getOrElse("???") // 中性默认值（S2-8）
        }
        .mkString(", ")
      s"  def empty(${idField.name}: ${idField.typeRef.signature}): ${model.state.name} = ${model.state.name}($args)"
    } else ""

    // 6. 生成事件族代码
    val superTypesCode = if (model.eventFamily.superTypes.nonEmpty) {
      s" extends ${model.eventFamily.superTypes.map(_.signature).mkString(" with ")}"
    } else ""

    val traitDef = s"  sealed trait ${model.eventFamily.name}$superTypesCode"

    val eventsDef = model.eventFamily.events
      .map { evt =>
        val evtFields = evt.fields.map(renderField).mkString(", ")
        val evtSuperTypesCode = if (evt.superTypes.nonEmpty) {
          s" extends ${evt.superTypes.map(_.signature).mkString(" with ")}"
        } else ""
        s"${fieldDoc(evt.fields, "  ")}  case class ${evt.name}($evtFields)$evtSuperTypesCode"
      }
      .mkString("\n")

    val familyCode = s"$traitDef\n\n$eventsDef"

    // 7. 生成EventHandler类型别名
    // [FIX] Use event family name to derive handler type alias, matching behavior file expectations
    // e.g., WorkflowEvent -> WorkflowEventHandler, TaskEvent -> TaskEventHandler
    val eventFamilyBaseName = if (model.eventFamily.name.endsWith("Event")) {
      model.eventFamily.name.substring(0, model.eventFamily.name.length - 5) // 去掉"Event"后缀
    } else {
      model.eventFamily.name
    }
    val eventHandlerTypeName = eventFamilyBaseName + "EventHandler"
    val eventHandlerCode =
      s"  type $eventHandlerTypeName = (${model.state.name}, ${model.eventFamily.name}) => ${model.state.name}"

    // 8. 构建对象定义
    val entityObj = objectDef(
      name = model.selfType.name,
      body =
        s"$stateCode\n\n$emptyMethodCode\n\n$familyCode\n\n$eventHandlerCode"
    )

    // 9. 构建源文件
    // ★ S7（用户裁定「类级不能没有 knowledge」）：`object <X>Entity` 之前发一条**容器级**锚
    //   （裸行 `@knowledge <id>`＝形态② 概念锚，id 继承所属聚合）——此前容器级零落点，
    //   导致「折叠出来的 status / 随命令来的 tenantId」这类状态字段的派生边无处可挂。
    //   与 VO 面同款（`ValueObjectTemplate`·独立 `CommentBlock` Definition，与后面的定义以空行分隔）。
    val entityDoc = KnowledgeAnchorDoc.conceptLine(model.noteId).toSeq match {
      case Nil  => Nil
      case line => Seq(Definition.CommentBlock(KnowledgeAnchorDoc.block(line).stripSuffix("\n")))
    }
    val sourceFile = SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = (entityDoc :+ (entityObj: Definition))
    )

    // 9. 生成代码
    sourceFile.code
  }
}
