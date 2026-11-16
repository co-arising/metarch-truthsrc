package net.imadz.codegen.scaffolding.cqrs.model.products

import net.imadz.meta.products._

final case class DesignProjectionSource(artifact: QualifiedReference, node: Option[DesignNodeReference],
                                         relation: Option[String], role: String, source: ProductSource,
                                         related: Vector[ProductSource], references: Vector[QualifiedReference])
final case class ProductDesignModel(designs: Vector[ProductDesign], sources: Vector[DesignProjectionSource],
                                    footprint: Vector[ProductIdentity], layout: ReferenceLayout)
