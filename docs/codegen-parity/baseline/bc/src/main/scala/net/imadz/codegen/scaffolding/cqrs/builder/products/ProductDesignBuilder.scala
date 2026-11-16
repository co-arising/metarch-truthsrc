package net.imadz.codegen.scaffolding.cqrs.builder.products

import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.meta.products._

object ProductDesignBuilder {
  val Required: Vector[ProductIdentity] = Vector(SemanticProductProtocol.Layout, SemanticProductProtocol.Design)
  def build(set: SemanticProductSet): ProductDesignModel = {
    val diagnostics = SemanticProductValidator.validate(set)
    require(diagnostics.isEmpty, diagnostics.mkString("\n"))
    val products = set.products.map(p => p.requirement.identity -> p.payload).toMap
    require(Required.forall(products.contains), "complete explicit product design profile required")
    val layout = products(SemanticProductProtocol.Layout).asInstanceOf[ReferenceLayout]
    val designs = products(SemanticProductProtocol.Design).asInstanceOf[ProductDesignProduct].designs
    val sources = designs.flatMap { d =>
      val definition = DesignProjectionSource(d.artifact, None, None, "design", d.source,
        d.provenance ++ d.approvalSource.toVector, d.references)
      val nodes = d.nodes.flatMap { n =>
        val definition = DesignProjectionSource(d.artifact, Some(n.ref), None, "node", n.source, Vector.empty, n.references)
        val actions = n.action.toVector.map(a => DesignProjectionSource(d.artifact, Some(n.ref), None, "action", a.source,
          Vector.empty, Vector(a.command)))
        val parameters = n.action.toVector.flatMap(_.parameters).map { p =>
          DesignProjectionSource(d.artifact, Some(n.ref), None, "action-parameter", p.source, Vector(p.parameterSource),
            Vector(p.parameter) ++ p.from.toVector)
        }
        val feedback = n.feedback.toVector.flatMap { f =>
          val definition = DesignProjectionSource(d.artifact, Some(n.ref), None, "feedback", f.source, Vector.empty, f.event.toVector)
          val keys = f.resourceKeys.map(k => DesignProjectionSource(d.artifact, Some(n.ref), None, "feedback-resource-key", f.source,
            Vector(k.source), Vector(k.ref)))
          Vector(definition) ++ keys ++ f.watermark.map(w => DesignProjectionSource(d.artifact, Some(n.ref), None, "feedback-watermark", f.source,
            Vector(w.source), Vector(w.slot))).toVector
        }
        Vector(definition) ++ actions ++ parameters ++ feedback
      }
      val relations = d.relations.map(r => DesignProjectionSource(d.artifact, None, Some(r.id), "relation", r.source, Vector.empty, Vector.empty))
      Vector(definition) ++ nodes ++ relations
    }
    val definitions = designs.flatMap { design =>
      def closure(refs: Vector[QualifiedReference]): Vector[QualifiedReference] = {
        var queue = refs
        var index = 0
        var seen = Set.empty[QualifiedReference]
        val result = Vector.newBuilder[QualifiedReference]
        while (index < queue.size) {
          val ref = queue(index)
          index += 1
          if (!seen(ref)) {
            seen += ref
            result += ref
            queue ++= layout.declarations.find(_.ref == ref).get.dependencies
          }
        }
        result.result()
      }
      closure(design.references).map { r =>
        val declaration = layout.declarations.find(_.ref == r).get
        DesignProjectionSource(design.artifact, None, None, "domain-reference", declaration.source, Vector.empty, Vector(r))
      }
    }
    ProductDesignModel(designs, sources ++ definitions, Required, layout)
  }
}
