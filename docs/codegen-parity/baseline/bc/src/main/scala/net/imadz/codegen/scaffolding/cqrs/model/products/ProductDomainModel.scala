package net.imadz.codegen.scaffolding.cqrs.model.products

import net.imadz.meta.products._

final case class ProductAggregateModel(declaration: ReferenceDeclaration, defaults: Vector[StateDefault],
                                       commands: Vector[CommandDependencies], decisions: Vector[CommandDecisions],
                                       events: Vector[EventSlots], folds: Vector[EventFolds],
                                       hosts: Vector[HostComputation], external: Vector[ExternalEventProducer])
final case class ProductWireField(name: String, carrier: ProductWireCarrier, repeated: Boolean = false)
sealed trait ProductWireCarrier
final case class ProductWirePrimitive(name: String) extends ProductWireCarrier
final case class ProductWireNested(node: ProductWireNode) extends ProductWireCarrier
final case class ProductWireNode(name: String, packageName: String, kind: String,
                                 valueType: Option[NominalType], ref: Option[QualifiedReference],
                                 fields: Vector[ProductWireField], sources: Vector[ProductSource],
                                 exact: Option[ExactType] = None, codec: Option[ExactCodec] = None)
final case class ProductDomainModel(layout: ReferenceLayout, exact: Vector[ExactType], codecs: Vector[ExactCodec],
                                    packages: Map[String, String], aggregates: Vector[ProductAggregateModel],
                                    footprint: Vector[ProductIdentity], wire: Vector[ProductWireNode] = Vector.empty,
                                    verificationCases: Vector[ProductVerificationCase] = Vector.empty)
final case class ProductSourceModel(path: String, content: String, kind: String, sources: Vector[ProductSource],
                                    footprint: Vector[ProductIdentity], dependencies: Vector[String] = Vector.empty)
