package net.imadz.codegen.scaffolding.cqrs.builder.products

import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.products._

object ProductDomainBuilder {
  val Required: Vector[ProductIdentity] = Vector(SemanticProductProtocol.Layout, SemanticProductProtocol.DecisionV3,
    SemanticProductProtocol.DependenciesV4, SemanticProductProtocol.FoldsV4, SemanticProductProtocol.ExactTypes,
    SemanticProductProtocol.ExactCodecs, SemanticProductProtocol.ExternalEvents)
  val ApplicationRequired: Vector[ProductIdentity] = Vector(SemanticProductProtocol.Layout, SemanticProductProtocol.DecisionV3,
    SemanticProductProtocol.DependenciesV5, SemanticProductProtocol.FoldsV5, SemanticProductProtocol.ExactTypes,
    SemanticProductProtocol.ExactCodecs, SemanticProductProtocol.ExternalEventsV2)
  val V2Required: Vector[ProductIdentity] = Vector(SemanticProductProtocol.Layout, SemanticProductProtocol.DecisionV4,
    SemanticProductProtocol.DependenciesV6, SemanticProductProtocol.FoldsV6, SemanticProductProtocol.ExactTypes,
    SemanticProductProtocol.ExactCodecs, SemanticProductProtocol.ExternalEventsV2)
  def build(set: SemanticProductSet, packages: Map[String, String], application: Boolean = false, nominalText: Boolean = false): ProductDomainModel = {
    val diagnostics = SemanticProductValidator.validate(set)
    require(diagnostics.isEmpty, diagnostics.mkString("\n"))
    val products = set.products.map(p => p.requirement.identity -> p.payload).toMap
    val required = if (nominalText) V2Required else if (application) ApplicationRequired else Required
    require(required.forall(products.contains), "complete domain source product profile required")
    val layout = products(SemanticProductProtocol.Layout).asInstanceOf[ReferenceLayout]
    require(packages.keySet == layout.contexts.toSet, "one explicit package for every context required")
    packages.values.foreach(NamingConventions.productPackage)
    require(packages.values.toVector.distinct.size == packages.size, "context package aliases refused")
    layout.declarations.foreach { d =>
      if (application && Set("saga", "pipeline", "artifact")(d.ref.kind)) NamingConventions.strictSymbol(d.ref.id)
      else NamingConventions.productSymbol(d.ref.id)
    }
    val dependencies = products(if (nominalText) SemanticProductProtocol.DependenciesV6 else if (application) SemanticProductProtocol.DependenciesV5 else SemanticProductProtocol.DependenciesV4).asInstanceOf[DomainDependencyProduct]
    val decisions = products(if (nominalText) SemanticProductProtocol.DecisionV4 else SemanticProductProtocol.DecisionV3).asInstanceOf[DomainDecisions]
    val folds = products(if (nominalText) SemanticProductProtocol.FoldsV6 else if (application) SemanticProductProtocol.FoldsV5 else SemanticProductProtocol.FoldsV4).asInstanceOf[DomainFoldProduct]
    val exact = products(SemanticProductProtocol.ExactTypes).asInstanceOf[ExactValueTypes].types
    val codecs = products(SemanticProductProtocol.ExactCodecs).asInstanceOf[ExactValueCodecs].codecs
    val aggregates = layout.declarations.filter(_.ref.kind == "aggregate").map { a =>
      def belongs(r: QualifiedReference): Boolean = r.context == a.ref.context && r.owner.headOption.contains(a.ref.id)
      val commands = dependencies.commands.filter(c => belongs(c.command))
      ProductAggregateModel(a, folds.defaults.filter(d => belongs(d.target)), commands,
        decisions.commands.filter(c => belongs(c.command)), dependencies.events.filter(e => belongs(e.event)),
        folds.events.filter(e => belongs(e.event)), dependencies.hosts.filter(h => commands.exists(_.command == h.command)),
        dependencies.externalProducers.getOrElse(Vector.empty).filter(p => belongs(p.event)))
    }
    require(aggregates.nonEmpty, "domain source profile requires declared aggregates")
    ProductDomainModel(layout, exact, codecs, packages, aggregates, required)
  }
}
