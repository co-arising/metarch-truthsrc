package net.imadz.meta.filesystem

import ujson.{Arr, Obj}

/** Formal-path aggregate behavioral semantics, assembled from the real truth
  * canonical alongside the SystemMetadata the generator consumes today.
  *
  * This is the bridge artifact for BOTH generators: the js side (truthsrc
  * behavior/rules generators) reads `formal-semantics.json`; the scala side can
  * consume it typed. ArchitectMetadata case classes are deliberately untouched —
  * the semantic declarations ride beside the AST.
  *
  * v2 (2026-10-23, P4 state deepening): folds carry structured op rows and
  * guards stay the raw structured declarations from the tree. Emission rows are
  * unchanged (slot, expr) pairs — P4 rewrote the serial tree's bindings to real
  * value origins (param.*), so the receipt derivation of v1 no longer appears.
  *
  * Expr forms are the truth-tree V13 set: `param.<p>`, `state.<f>`,
  * `receipt.<slot>`, `event.<slot>` (folds only), `state.<f>[<key>]` (folds
  * only), `literal:<v>`.
  */
final case class FormalEmission(event: String, bindings: Vector[(String, String)])

/** One fold assignment row. `op` mirrors the truth-tree closed vocabulary:
  * `set` (expr), `put` (key/value), `remove` (key), `money-apply` (delta, sign).
  * Field presence follows op; the adapter fail-closes on unknown ops. */
final case class FormalFoldRow(
    slot: String,
    op: String,
    expr: Option[String] = None,
    key: Option[String] = None,
    value: Option[String] = None,
    delta: Option[String] = None,
    sign: Option[Int] = None
)
final case class FormalFold(event: String, assignments: Vector[FormalFoldRow])
final case class FormalGuards(command: String, guards: Vector[ujson.Value])
final case class FormalAggregateSemantics(
    aggregate: String,
    emissions: Vector[FormalEmission],
    folds: Vector[FormalFold],
    guards: Vector[FormalGuards]
)
final case class FormalSemantics(systemName: String, aggregates: Vector[FormalAggregateSemantics])

object FormalSemantics {

  def toJson(fs: FormalSemantics): ujson.Value = Obj(
    "schemaVersion" -> "truthsrc.formal-semantics/v2",
    "system" -> fs.systemName,
    "aggregates" -> Arr.from(fs.aggregates.map { a =>
      Obj(
        "aggregate" -> a.aggregate,
        "emissions" -> Arr.from(a.emissions.map { e =>
          Obj("event" -> e.event, "bindings" -> pairs(e.bindings))
        }),
        "folds" -> Arr.from(a.folds.map { f =>
          Obj("event" -> f.event, "assignments" -> Arr.from(f.assignments.map(foldRow)))
        }),
        "guards" -> Arr.from(a.guards.map { g =>
          Obj("command" -> g.command, "guards" -> Arr.from(g.guards))
        })
      )
    })
  )

  private def pairs(xs: Vector[(String, String)]): ujson.Value =
    Arr.from(xs.map { case (slot, expr) => Obj("slot" -> slot, "expr" -> expr) })

  private def foldRow(r: FormalFoldRow): ujson.Value = {
    val base = scala.collection.mutable.LinkedHashMap.empty[String, ujson.Value]
    base("slot") = r.slot
    base("op") = r.op
    r.expr.foreach(v => base("expr") = v)
    r.key.foreach(v => base("key") = v)
    r.value.foreach(v => base("value") = v)
    r.delta.foreach(v => base("delta") = v)
    r.sign.foreach(v => base("sign") = v)
    ujson.Obj.from(base)
  }
}
