package net.imadz.codegen.scaffolding.cqrs.projector

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.codegen.scaffolding.cqrs.model.application._
import net.imadz.codegen.scaffolding.cqrs.model.application.transactor._

object ApplicationProjectors {

  implicit object ApplicationServiceProjector
      extends ContextProjector[ApplicationServiceModel] {
    override def project(
        model: ApplicationServiceModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val methods = model.methods.map { m =>
        val params = m.parameters.map(p => p.name -> p.typeRef.name)
        ContextGenDSL.renderMethod(m.name, params, m.returnType.name)
      }
      val content = ContextGenDSL.renderTrait(model.selfType.name, methods)
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object QueryServiceProjector
      extends ContextProjector[QueryServiceModel] {
    override def project(
        model: QueryServiceModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val methods = model.methods.map { m =>
        val params = m.parameters.map(p => p.name -> p.typeRef.name)
        ContextGenDSL.renderMethod(m.name, params, m.returnType.name)
      }
      val content = ContextGenDSL.renderTrait(model.selfType.name, methods)
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object AggregateRepositoryProjector
      extends ContextProjector[AggregateRepositoryModel] {
    override def project(
        model: AggregateRepositoryModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val content =
        s"trait ${model.selfType.name} {\n  // Repository Interface for ${model.aggregateType.name}\n}"
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object ProjectionRepositoryProjector
      extends ContextProjector[ProjectionRepositoryModel] {
    override def project(
        model: ProjectionRepositoryModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val content =
        s"trait ${model.selfType.name} {\n  // Projection Repository Interface\n}"
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object AggregateRootProjector
      extends ContextProjector[AggregateRootModel] {
    override def project(
        model: AggregateRootModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val stateSnippet = CodeSnippet(
        model.stateType.name + ".scala",
        s"// State: ${model.stateType.name}",
        "Dependency"
      )
      val eventSnippet = CodeSnippet(
        model.eventType.name + ".scala",
        s"// Event: ${model.eventType.name}",
        "Dependency"
      )
      val commandSnippet = CodeSnippet(
        model.commandFamilyType.name + ".scala",
        s"// Protocol: ${model.commandFamilyType.name}",
        "Dependency"
      )

      val content = s"""trait ${model.selfType.name} {
         |  // State: ${model.stateType.name}
         |  // Event: ${model.eventType.name}
         |  // Command: ${model.commandFamilyType.name}
         |  def handleCommand(state: State, cmd: Command): ReplyEffect
         |  def onEvent(state: State, event: Event): State
         |}""".stripMargin

      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Seq(stateSnippet, eventSnippet, commandSnippet)
      )
    }
  }

  implicit object AggregateBehaviorProjector
      extends ContextProjector[AggregateBehaviorModel] {
    override def project(
        model: AggregateBehaviorModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val content =
        s"""object ${model.selfType.name} {
         |  // Behavior definitions
         |  def apply(persistenceId: PersistenceId): Behavior[Command]
         |}""".stripMargin
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object AggregateFactoryProjector
      extends ContextProjector[AggregateFactoryModel] {
    override def project(
        model: AggregateFactoryModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val content =
        s"""trait ${model.selfType.name} {
         |  // Factory methods
         |  ${model.factoryMethods.map(m => s"def ${m.name}").mkString("\n  ")}
         |}""".stripMargin
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object CommandHelpersProjector
      extends ContextProjector[CommandHelpersModel] {
    override def project(
        model: CommandHelpersModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val content =
        s"""trait ${model.selfType.name} {
         |  // Command Helpers for ${model.selfType.name}
         |}""".stripMargin
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object ProjectionProjector
      extends ContextProjector[ProjectionModel] {
    override def project(
        model: ProjectionModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val handlers =
        model.handlers.map(h => s"// Handle ${h.event.name}").mkString("\n  ")
      val content = s"""object ${model.selfType.name} {
       |  // Projection Logic
       |  $handlers
       |}""".stripMargin
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object SagaParticipantProjector
      extends ContextProjector[SagaParticipantModel] {
    override def project(
        model: SagaParticipantModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val content =
        s"""class ${model.selfType.name} {
         |  // Saga Participant Actions
         |  // Prepare, Commit, Compensate
         |}""".stripMargin
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object SagaContextProjector
      extends ContextProjector[SagaContextModel] {
    override def project(
        model: SagaContextModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val content =
        s"""case class ${model.selfType.name} (
         |  ${model.fields
             .map(f => s"${f.name}: ${f.typeRef.name}")
             .mkString(",\n  ")}
         |)""".stripMargin
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object SagaDefinitionProjector
      extends ContextProjector[SagaDefinitionModel] {
    override def project(
        model: SagaDefinitionModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val content =
        s"""object ${model.selfType.name} {
           |  val Name = "${model.sagaName}"
           |  val Version = ${model.version}
           |  // Steps: ${model.steps.map(s => s"${s.stepId}(${s.participantType.name})").mkString(", ")}
           |}""".stripMargin
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object AggregateProtocolProjector
      extends ContextProjector[AggregateProtocolModel] {
    override def project(
        model: AggregateProtocolModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val content = s"""object ${model.selfType.name} {
       |  // Protocol Definitions
       |  // Commands: ${model.commandFamily.commands
                         .map(_.name)
                         .mkString(", ")}
       |  // Events: ${model.eventType.map(_.name).getOrElse("N/A")}
       |  // State: ${model.stateType.map(_.name).getOrElse("N/A")}
       |}""".stripMargin
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }
}
