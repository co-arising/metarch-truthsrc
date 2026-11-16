package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.FieldDef
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.application.AggregateProtocolModel

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate
import net.imadz.codegen.scaffolding.cqrs.template.KnowledgeAnchorDoc

object AggregateProtocolTemplate extends CodeTemplate[AggregateProtocolModel] {

  def generate(model: AggregateProtocolModel): String = {
    // 1. Package Declaration
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. Import Declaration
    val importList = model.dependencies.toList.sortBy(_.fqn).map(_.fqn).distinct
    // Add CborSerializable implicitly if not present, though dependencies should cover it
    val importDecl = imports(importList: _*)

    def renderFields(fields: Seq[FieldDef]): String = {
      fields
        .map(f =>
          s"${NamingConventions.scalaIdentifier(f.name)}: ${f.typeRef.signature}${f.defaultValue.map(d => s" = $d").getOrElse("")}"
        )
        .mkString(", ")
    }

    // 3. Command Family Trait
    val commandFamilyDef =
      s"  sealed trait ${model.commandFamily.name} extends ${model.commandFamily.superTypes.map(_.name).mkString(" with ")}"

    // 4. Commands
    // EP_GenerationTime_Code_Anchors P1（pm 面本体锚）：命令参数的知识 id **builder 早已透传**
    // （`AggregateProtocolBuilder:43` 把 `p.noteId` 放进 `FieldDef`），缺的一直只是这里发射——
    // 故 pm 面 `codeFqn` 长期恒 0（图上仅 3 条还是 FQN 构造错配生出的假锚）。
    // 无 noteId 的合成参数（replyTo／triggeredBy／tenantId）不发行，零漂移。
    val commandsCode = model.commandFamily.commands
      .map { c =>
        val fields = renderFields(c.fields)
        val doc = KnowledgeAnchorDoc.fieldDoc(c.fields, "  ")
        val extendsClause = (c.superTypes :+ model.selfType.copy(name =
          model.commandFamily.name
        )).distinct.map(_.name).mkString(" with ")
        // Note: model.commandFamily.name is technically the trait name, but here we can just use the name directly
        // However, generic extends approach:
        // Actually c.superTypes should already contain the family type from the builder.
        // Let's rely on what Builder prepared or simple logic:
        s"$doc  case class ${c.name}($fields) extends ${model.commandFamily.name}"
      }
      .mkString("\n")

    // 5. Replies
    val repliesCode = model.replies
      .map(r =>
        s"  case class ${r.name}(${renderFields(r.fields)}) extends ${r.superTypes.map(_.name).mkString(" with ")}"
      )
      .mkString("\n")

    // 6. State & Events (Optional)
    val stateCode = model.state
      .map { state =>
        val evName = "TransactionEvent" // Default for Saga
        s"""
  // --- Inline State & Events ---
  sealed trait $evName extends CborSerializable

  sealed trait Status extends CborSerializable
  object Status { case object New extends Status; case object Initiated extends Status; case object Prepared extends Status; case object Completed extends Status; case class Failed(reason: String) extends Status }

  case class ${state.name}(${renderFields(
            state.fields
          )}, status: Status = Status.New) extends CborSerializable {
    def applyEvent(event: $evName): ${state.name} = ???
  }

  object ${state.name} {
     def empty(id: String): ${state.name} = ${state.name}(id = Some(id))
  }
"""
      }
      .getOrElse("")

    // 7. Body
    val body = s"""
  // Commands
$commandFamilyDef
$commandsCode

  // Replies
$repliesCode

$stateCode
${model.stateType
        .zip(model.eventType)
        .map { case (st, ev) =>
          val handlerTypeName =
            model.commandFamily.name.replace("Command", "CommandHandler")
          s"""
  // CommandHandler type alias (moved from Aggregate to break circular dependency)
  type $handlerTypeName = (${st.name}, ${model.commandFamily.name}) => akka.persistence.typed.scaladsl.Effect[${ev.name}, ${st.name}]
"""
        }
        .getOrElse("")}
"""

    // 7. Object Definition
    val objectDef = ObjectDefinition(
      name = model.selfType.name,
      body = body
    )

    // 8. Source File
    val sourceFile = SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = Seq(objectDef)
    )

    sourceFile.code
  }
}
