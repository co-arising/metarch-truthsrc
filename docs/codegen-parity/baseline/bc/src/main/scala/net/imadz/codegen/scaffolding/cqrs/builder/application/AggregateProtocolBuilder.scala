package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.model.application._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef}
import net.imadz.meta._

object AggregateProtocolBuilder {

  def build(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): AggregateProtocolModel = {
    // 1. Determine Package (Same as Aggregate Root for now, or use a specific protocol package if defined)
    // Using 'aggregates.root' to keep it close, or maybe 'aggregates.protocols' if we want separation.
    // Given the cycle issue, 'aggregates.root' is fine as long as they are different files.
    // But to be safe and clean, let's assume it lives alongside the Aggregate.
    val pkg = ctx.layout.application.aggregates.root
    val protocolName = s"${NamingConventions.getBaseName(meta.name)}Protocol"
    val selfType = TypeRef(protocolName, pkg)

    // 2. Process Replies (Moved from AggregateRootBuilder)
    // S1 聚合面（2026-09-27 用户裁决）：序列化不放 domain/application——Get<X>StateReply 的
    // OWrites 在 controller 层逐字段手写，此处不带 jsonFormat。
    val replies = meta.replyFamily.replies.map { r =>
      CommandReplyModel(
        name = r.name,
        fields = r.parameters.map(f =>
          FieldDef(f.name, ctx.typeResolver.resolve(f.parameterType))
        ),
        superTypes = Seq(
          ctx.knownFrameworkTypes("CborSerializable")
        )
      )
    }

    // 3. Process Commands (Moved from AggregateRootBuilder)
    val commandFamilyType =
      ctx.typeResolver.commandFamily(
        meta.commandFamily.name
      ) // This type will now be defined HERE

    val commands = meta.commandFamily.commands.map { cmd =>
      val baseFields = cmd.parameters.map(p =>
        if (p.optional)
          // Controller 三可选参根治批 2026-10-05：optional 参数 → Option[T] = None 直译
          //（真源语义保真·S0 scala-cli 复现通过；聚合状态零 optional 字段零涟漪）
          FieldDef(p.name, TypeRef.Option(ctx.typeResolver.resolve(p.parameterType)),
            defaultValue = Some("None"), noteId = p.noteId, description = p.description)
        else
          FieldDef(p.name, ctx.typeResolver.resolve(p.parameterType), noteId = p.noteId, description = p.description)
      )

      // ReplyTo Logic
      val replyToField = cmd.replyToType.map { replyRef =>
        val replyType = ctx.typeResolver.resolve(
          replyRef
        ) // Resolve generically, usually points to Reply in this file
        val actorRefType =
          ctx.knownFrameworkTypes("ActorRef").copy(typeParams = Seq(replyType))
        FieldDef("replyTo", actorRefType)
      }

      CommandModel(
        name = cmd.name,
        fields = baseFields ++ replyToField,
        superTypes = Seq(commandFamilyType)
      )
    }

    val commandFamily = CommandFamilyModel(
      name = meta.commandFamily.name,
      commands = commands,
      superTypes = Seq(
        ctx.knownFrameworkTypes("CborSerializable")
      )
    )

    // 4. Dependencies
    val deps =
      replies.flatMap(_.fields.flatMap(_.typeRef.collectAllDependencies)) ++
        replies.flatMap(_.superTypes) ++
        commands.flatMap(_.fields.flatMap(_.typeRef.collectAllDependencies)) ++
        commands.flatMap(_.superTypes) ++
        commandFamily.superTypes

    // State and Event types for CommandHandler type alias (must be before dependencies)
    val stateType = Some(ctx.typeResolver.entityState(meta.stateRef))
    val eventType = Some(ctx.typeResolver.eventFamily(meta.eventFamilyRef))

    val dependencies = deps.filter(_.shouldImport(pkg)).toSet ++
      stateType.toSet.filter(_.shouldImport(pkg)) ++
      eventType.toSet.filter(
        _.shouldImport(pkg)
      ) // Add State/Event types for CommandHandler imports

    AggregateProtocolModel(
      selfType,
      commandFamily,
      replies,
      None, // State
      stateType,
      eventType,
      dependencies,
      noteIds = meta.noteId.toSeq
    )
  }
}
