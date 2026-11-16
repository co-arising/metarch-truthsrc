package net.imadz.codegen.scaffolding.cqrs.model.products

import net.imadz.meta.execution.StrictSagaExecutionMetadata
import net.imadz.meta.products._

final case class ProductRuntimeArtifact(coordinate: String, sha256: String, repository: String, symbolicTarget: String)
final case class ProductApplicationHost(contract: SagaHostContract, runtime: StrictSagaExecutionMetadata)
final case class ProductApplicationModel(domain: ProductDomainModel, hosts: Vector[ProductApplicationHost],
                                         artifact: ProductRuntimeArtifact, ports: Vector[ArtifactPort], footprint: Vector[ProductIdentity],
                                         pipelines: Vector[ExecutionPipeline] = Vector.empty,
                                         childPlans: Vector[ChildPlan] = Vector.empty,
                                         selectedArtifacts: Vector[ArtifactContract] = Vector.empty,
                                         effectHosts: Vector[EffectHost] = Vector.empty)
