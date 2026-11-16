package net.imadz.codegen.scaffolding.cqrs.builder.products

import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.meta.products._

object ProductApplicationBuilder {
  def build(set: SemanticProductSet, domain: ProductDomainModel, artifact: ProductRuntimeArtifact): ProductApplicationModel = {
    val diagnostics = SemanticProductValidator.validate(set)
    require(diagnostics.isEmpty, diagnostics.mkString("\n"))
    val hosts = set.products.collectFirst { case SemanticProduct(_, _, SagaHostContractProduct(v)) => v }.getOrElse(throw new IllegalArgumentException("required finite host product missing"))
    val runtime = set.products.collectFirst { case SemanticProduct(_, _, SagaRuntimeContractProduct(v)) => v }.getOrElse(throw new IllegalArgumentException("required runtime contract missing"))
    require(artifact.coordinate == "net.imadz:saga-core_2.13:0.2.1-p23.20261027.1" && artifact.sha256 == "f20ad61eba670d2766cd39a1f75bd236351d0069b0480bb85d7335ffff93f8cf", "exact frozen P23 artifact required")
    require(artifact.symbolicTarget == runtime.target.artifact && artifact.repository.startsWith("file:///"), "explicit symbolic-to-actual runtime association required")
    require(hosts.nonEmpty && hosts.forall(h => Set("direct", "pipeline").contains(h.entry.startOwner.kind)), "explicit finite host ownership required; pipeline is not silently omitted")
    val rows = hosts.map { host =>
      val execution = runtime.sagas.find(s => s.execution.sagaId == host.saga.ref.id && s.execution.definitionVersion == host.saga.version).get.execution
      ProductApplicationHost(host, execution)
    }
    val pipelines = set.products.collectFirst { case SemanticProduct(_, _, ExecutionContractProduct(v)) => v.pipelines }.getOrElse(throw new IllegalArgumentException("explicit execution contract required"))
    val children = set.products.collectFirst { case SemanticProduct(_, _, ChildPlanProduct(v)) => v }.getOrElse(Vector.empty)
    val effects = set.products.collectFirst { case SemanticProduct(_, _, EffectHostProduct(v)) => v }.getOrElse(Vector.empty)
    def identity(id: String): ProductIdentity = set.products.find(_.requirement.identity.id == id).get.requirement.identity
    val footprint = domain.footprint ++ Vector(identity("saga-host-contract"), SemanticProductProtocol.RuntimeContract, identity("artifact-contract")) ++ (if (pipelines.nonEmpty) Vector(SemanticProductProtocol.ExecutionContract) else Vector.empty) ++ (if (children.nonEmpty) Vector(SemanticProductProtocol.ChildPlan) else Vector.empty) ++ (if (effects.nonEmpty) Vector(identity("effect-host-contract")) else Vector.empty)
    val selectedArtifacts = set.products.collectFirst { case SemanticProduct(_, _, ArtifactContractProduct(v)) => v.filter(_.status == "selected") }.get
    val ports = selectedArtifacts.flatMap(_.ports)
    ProductApplicationModel(domain, rows, artifact, ports, footprint, pipelines, children, selectedArtifacts, effects)
  }
}
