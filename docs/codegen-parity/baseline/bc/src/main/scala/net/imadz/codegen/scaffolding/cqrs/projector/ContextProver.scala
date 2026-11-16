package net.imadz.codegen.scaffolding.cqrs.projector

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, GeneratorContext}
import net.imadz.codegen.scaffolding.cqrs.model.domain._
import net.imadz.codegen.scaffolding.cqrs.model.application._
import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.{
  SagaDefinitionModel,
  SagaParticipantModel,
  SagaContextModel
}
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api.ControllerModel
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.bootstrap.BootstrapModel
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.persistence._
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.repository._
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.proto._

object ContextProver {

  def prove(model: ArtifactModel, ctx: GeneratorContext): ContextBundle =
    model match {
      // 1. Domain
      case m: EntityBehaviorModel => EntityBehaviorProjector.project(m, ctx)
      case m: DomainEntityModel   =>
        DomainProjectors.DomainEntityProjector.project(m, ctx)
      case m: ValueObjectModel =>
        DomainProjectors.ValueObjectProjector.project(m, ctx)
      case m: DomainServiceModel =>
        DomainProjectors.DomainServiceProjector.project(m, ctx)
      case m: InvariantRuleModel =>
        DomainProjectors.InvariantRuleProjector.project(m, ctx)

      // 2. Application
      case m: AggregateRootModel =>
        ApplicationProjectors.AggregateRootProjector.project(m, ctx)
      case m: AggregateBehaviorModel =>
        ApplicationProjectors.AggregateBehaviorProjector.project(m, ctx)
      case m: AggregateFactoryModel =>
        ApplicationProjectors.AggregateFactoryProjector.project(m, ctx)
      case m: CommandHelpersModel =>
        ApplicationProjectors.CommandHelpersProjector.project(m, ctx)
      case m: AggregateProtocolModel =>
        ApplicationProjectors.AggregateProtocolProjector.project(m, ctx)
      case m: ProjectionModel =>
        ApplicationProjectors.ProjectionProjector.project(m, ctx)
      case m: ApplicationServiceModel =>
        ApplicationProjectors.ApplicationServiceProjector.project(m, ctx)
      case m: QueryServiceModel =>
        ApplicationProjectors.QueryServiceProjector.project(m, ctx)
      case m: AggregateRepositoryModel =>
        ApplicationProjectors.AggregateRepositoryProjector.project(m, ctx)
      case m: ProjectionRepositoryModel =>
        ApplicationProjectors.ProjectionRepositoryProjector.project(m, ctx)

      // 3. Application (Saga)
      case m: SagaParticipantModel =>
        ApplicationProjectors.SagaParticipantProjector.project(m, ctx)
      case m: SagaContextModel =>
        ApplicationProjectors.SagaContextProjector.project(m, ctx)
      case m: SagaDefinitionModel =>
        ApplicationProjectors.SagaDefinitionProjector.project(m, ctx)

      // 4. Infrastructure
      case m: ControllerModel =>
        InfrastructureProjectors.ControllerProjector.project(m, ctx)
      case m: BootstrapModel =>
        InfrastructureProjectors.BootstrapProjector.project(m, ctx)

      // 5. Infrastructure (Persistence)
      case m: AdapterModel =>
        InfrastructurePersistenceProjectors.AdapterProjector.project(m, ctx)
      case m: AggregateConverterModel =>
        InfrastructurePersistenceProjectors.AggregateConverterProjector.project(
          m,
          ctx
        )
      case m: AggregateRepositoryImplModel =>
        InfrastructurePersistenceProjectors.AggregateRepositoryImplProjector
          .project(m, ctx)
      case m: ProjectionRepositoryImplModel =>
        InfrastructurePersistenceProjectors.ProjectionRepositoryImplProjector
          .project(m, ctx)

      // 6. Infrastructure (Proto)
      case m: ProtoFileModel =>
        InfrastructureProtoProjectors.ProtoFileProjector.project(m, ctx)

      case _ =>
        val content =
          s"// Context Projection not supported for ${model.getClass.getSimpleName}"
        ContextBundle(CodeSnippet("Unknown.scala", content, "Target"), Nil)
    }
}
