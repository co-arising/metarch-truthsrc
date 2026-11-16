package net.imadz.codegen.scaffolding.cqrs.builder.products

import java.nio.file.{Files, LinkOption, Path, Paths}
import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.products._

object ProductServiceBuilder {
  def build(application: ProductApplicationModel, options: ujson.Value, target: Path): ProductServiceModel = {
    require(options.obj.keySet == Set("artifact", "externalSourceRoots"), "closed service options required")
    val required = Vector(SemanticProductProtocol.ArtifactV3, SemanticProductProtocol.SagaHostV2, SemanticProductProtocol.EffectHostV2)
    require(required.forall(application.footprint.contains), "explicit artifact@3 and host@2 service products required")
    val artifacts = application.selectedArtifacts.filter(_.deployment.service.nonEmpty)
    require(artifacts.size == 1 && artifacts.head.id == options("artifact").str, "one selected complete service deployment required")
    val artifact = artifacts.head
    require(artifact.artifact.id.matches("[A-Za-z][A-Za-z0-9_]{0,99}") && !NamingConventions.productSymbol(artifact.artifact.id).contains("`"), "bounded non-keyword service class stem required")
    val deployment = artifact.deployment.service.get
    val bootstrap = artifact.implementations.find(_.port == deployment.bootstrap.ref).get
    require(bootstrap.id.matches("[a-z][a-z0-9_]*(?:\\.[A-Za-z][A-Za-z0-9_]*)+"), "explicit qualified composition factory required")
    val endpoints = deployment.endpoints.map { e =>
      NamingConventions.productSymbol(e.port.ref.id)
      ProductServiceEndpoint(e, artifact.implementations.find(_.port == e.port.ref).get)
    }
    require(endpoints.map(_.endpoint.port.ref.id).distinct.size == endpoints.size, "one HTTP endpoint per explicit port required")
    val roots = options("externalSourceRoots").arr.toVector.map(_.str)
    require(roots.distinct.size == roots.size, "duplicate external source root")
    roots.foreach { value =>
      val path = Paths.get(value)
      require(path.isAbsolute && path.normalize == path && path.toString == value && !value.contains("\\"), "canonical absolute external source root required")
      require(Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS) && path.toRealPath() == path, "existing non-symlink external source root required")
      require(!path.startsWith(target) && !target.startsWith(path), "external source root must be disjoint from generated target")
    }
    ProductServiceModel(application, artifact, deployment, bootstrap, endpoints, roots)
  }
}
