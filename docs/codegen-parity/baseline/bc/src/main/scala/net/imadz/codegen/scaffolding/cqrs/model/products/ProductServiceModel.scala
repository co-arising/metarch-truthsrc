package net.imadz.codegen.scaffolding.cqrs.model.products

import net.imadz.meta.products._

final case class ProductServiceEndpoint(endpoint: ServiceEndpoint, implementation: ArtifactImplementation)
final case class ProductServiceModel(application: ProductApplicationModel, artifact: ArtifactContract,
                                     deployment: ServiceDeployment, bootstrap: ArtifactImplementation,
                                     endpoints: Vector[ProductServiceEndpoint], externalSourceRoots: Vector[String])
