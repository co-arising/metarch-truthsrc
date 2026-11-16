package net.imadz.codegen.scaffolding.cqrs.projector

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.persistence._
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.repository._

object InfrastructurePersistenceProjectors {

  implicit object AdapterProjector extends ContextProjector[AdapterModel] {
    override def project(
        model: AdapterModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val mappings = model.mappings
        .map { m =>
          val from = m.scalaCaseName
          val to = m.protoMessageName
          s"// Mapping: $from <-> $to"
        }
        .mkString("\n  ")

      val content = s"""trait ${model.selfType.name} {
         |  // Adapter for ${model.scalaRootType.name} <-> ${model.protoRootType.name}
         |  $mappings
         |}""".stripMargin
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object AggregateConverterProjector
      extends ContextProjector[AggregateConverterModel] {
    override def project(
        model: AggregateConverterModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val defs = (model.valueObjects ++ model.events ++ model.state)
        .map { c =>
          s"// Convert: ${c.participantType.name} <-> ${c.poType.name}"
        }
        .mkString("\n  ")
      val content = s"trait ${model.selfType.name} {\n  $defs\n}"
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object AggregateRepositoryImplProjector
      extends ContextProjector[AggregateRepositoryImplModel] {
    override def project(
        model: AggregateRepositoryImplModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val content =
        s"""class ${model.selfType.name} extends ${model.interfaceType.name} {
         |  // Implementation using Akka Sharding (${model.entityTypeKey})
         |}""".stripMargin
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object ProjectionRepositoryImplProjector
      extends ContextProjector[ProjectionRepositoryImplModel] {
    override def project(
        model: ProjectionRepositoryImplModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val content =
        s"""class ${model.selfType.name} extends ${model.interfaceType.name} {
           |  // Slick/JDBC Implementation
           |}""".stripMargin
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }
}
