package net.imadz.codegen.scaffolding.cqrs.builder.products

import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.products._

object ProductSerializationBuilder {
  def build(model: ProductDomainModel): Vector[ProductWireNode] = {
    model.layout.contexts.flatMap { context =>
      val pkg = model.packages(context)
      val nodes = scala.collection.mutable.ArrayBuffer.empty[ProductWireNode]
      val nominalNodes = scala.collection.mutable.Map.empty[QualifiedReference, ProductWireNode]
      def declaration(ref: QualifiedReference): ReferenceDeclaration = model.layout.declarations.find(_.ref == ref).get
      def carrier(value: NominalType, name: String, sources: Vector[ProductSource]): ProductWireCarrier = value match {
        case NominalType.Primitive(n) => ProductWirePrimitive(n)
        case NominalType.Named(ref) =>
          require(ref.context == context, "cross-context wire values require an explicit target profile")
          ProductWireNested(nominal(declaration(ref)))
        case NominalType.Optional(element) =>
          val node = ProductWireNode(name, pkg, "optional", Some(value), None, Vector(ProductWireField("value", carrier(element, name + "Value", sources))), sources)
          nodes += node; ProductWireNested(node)
        case NominalType.Sequence(element) =>
          val node = ProductWireNode(name, pkg, "sequence", Some(value), None, Vector(ProductWireField("values", carrier(element, name + "Element", sources), repeated = true)), sources)
          nodes += node; ProductWireNested(node)
        case NominalType.Mapping(k, v) =>
          val row = ProductWireNode(name + "Entry", pkg, "map-entry", None, None,
            Vector(ProductWireField("key", carrier(k, name + "Key", sources)), ProductWireField("value", carrier(v, name + "Value", sources))), sources)
          nodes += row
          val node = ProductWireNode(name, pkg, "map", Some(value), None, Vector(ProductWireField("entries", ProductWireNested(row), repeated = true)), sources)
          nodes += node; ProductWireNested(node)
        case _ => throw new IllegalArgumentException("unsupported wire value")
      }
      def nominal(d: ReferenceDeclaration): ProductWireNode = nominalNodes.getOrElseUpdate(d.ref, {
        val exact = model.exact.find(_.domain == d.ref)
        val codec = model.codecs.find(_.domain == d.ref)
        val name = d.ref.id + "PB"
        val fields = exact match {
          case Some(t) =>
            require(codec.isDefined, "complete exact codec required")
            Vector(ProductWireField("amount", ProductWirePrimitive("string"))) ++
              (if (t.form == "unit-decimal") Vector(ProductWireField("unit", ProductWirePrimitive("string"))) else Vector.empty)
          case None => d.valueType.get match {
            case NominalType.Record(members) => members.zipWithIndex.map { case (r, i) => ProductWireField(r.id, carrier(declaration(r).valueType.get, name + "Field" + i, Vector(declaration(r).source))) }
            case value => Vector(ProductWireField("value", carrier(value, name + "Value", Vector(d.source))))
          }
        }
        val node = ProductWireNode(name, pkg, if (exact.isDefined) "exact" else "nominal", Some(NominalType.Named(d.ref)), Some(d.ref), fields, Vector(d.source), exact, codec)
        nodes += node; node
      })
      model.layout.declarations.filter(d => d.ref.kind == "type" && d.ref.context == context).foreach(nominal)
      model.aggregates.filter(_.declaration.ref.context == context).foreach { a =>
        val name = a.declaration.ref.id + "StatePB"
        nodes += ProductWireNode(name, pkg, "state", None, Some(a.declaration.ref), a.defaults.zipWithIndex.map { case (d, i) =>
          ProductWireField(d.target.id, carrier(d.valueType, name + "Field" + i, Vector(d.source)))
        }, Vector(a.declaration.source) ++ a.defaults.map(_.source))
        a.events.foreach { e =>
          val name = a.declaration.ref.id + e.event.id + "PB"
          nodes += ProductWireNode(name, pkg, "event", None, Some(e.event), e.declaredSlots.zipWithIndex.map { case (s, i) =>
            ProductWireField(s.ref.id, carrier(s.valueType, name + "Field" + i, Vector(s.source)))
          }, Vector(e.source))
        }
      }
      require(nodes.map(_.name).distinct.size == nodes.size, "wire source name collision")
      nodes.foreach(n => NamingConventions.productSymbol(n.name))
      nodes.toVector
    }
  }
}
