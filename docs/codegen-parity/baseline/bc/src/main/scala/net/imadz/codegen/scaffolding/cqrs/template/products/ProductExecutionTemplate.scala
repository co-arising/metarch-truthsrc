package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.TypeResolverDSL
import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.products._

/** Finite typed lowering; effects and Saga/child adapters are never guessed from a step position. */
object ProductExecutionTemplate {
  private def quote(s: String): String = ujson.write(s)
  private def sym(s: String): String = NamingConventions.strictSymbol(s)
  private def typeText(ref: net.imadz.codegen.scaffolding.cqrs.TypeRef): String = ref.fqn + (if (ref.typeParams.isEmpty) "" else ref.typeParams.map(typeText).mkString("[", ", ", "]"))
  def generate(model: ProductApplicationModel): Vector[ProductSourceModel] = model.pipelines.flatMap { p =>
    if (p.steps.exists(_.operation.isInstanceOf[ExecutionSagaOperation]) || model.effectHosts.exists(_.pipeline.ref.id == p.id)) ProductInvocationExecutionTemplate.generate(model, p)
    else {
    val declarations = model.domain.layout.declarations.filter(d => d.ref.kind == "pipeline" && d.ref.id == p.id)
    require(declarations.size == 1, "pipeline requires one exact qualified declaration")
    val declaration = declarations.head; val pkg = model.domain.packages(declaration.ref.context); val name = sym(p.id) + "Execution"
    def tpe(id: String): String = {
      require(p.binding.types.exists(_._1 == id), "execution type requires an explicit binding")
      val rows = model.domain.layout.declarations.filter(d => d.ref.context == declaration.ref.context && d.ref.kind == "type" && d.ref.id == id)
      require(rows.size == 1, "one exact nominal execution type required")
      typeText(TypeResolverDSL.productType(NominalType.Named(rows.head.ref), model.domain.packages))
    }
    require(p.bounds.runs == 1 && p.bounds.steps == 1 && p.bounds.chunks == 1, "finite single-run single-step single-chunk profile required")
    p.steps.foreach { s => s.operation match {
      case ExecutionPortOperation(id) => require(p.binding.ports.find(_.id == id).exists(_.effect == "pure"), "external stage requires an explicit effect adapter")
      case _ => throw new IllegalArgumentException("invokeSaga and awaitChildRun require their exact durable adapter profile")
    } }
    val fields = p.inputs.zipWithIndex.map { case (i, n) => ("input" + n, i.valueType, "state.inputs." + sym(i.id), false) } ++ p.steps.flatMap(s => s.writes.map(w => (s, w))).zipWithIndex.map { case ((s, w), n) => ("output" + n, w.valueType, "state." + sym(s.id + "_" + w.id), true) }
    val protoName = name.replace("_", "") + "StatePB"; val protoPkg = pkg + ".infrastructure.executionproto"
    val converters = pkg + ".infrastructure.serialization.DomainConverters"
    var text = "package " + pkg + ".application\n\nimport akka.actor.typed.Behavior\nimport akka.persistence.typed.PersistenceId\nimport net.imadz.monarch.{StageError, StageFailedException}\nimport net.imadz.monarch.persistence.{PersistentMonarch, RunObserver, StateCodec}\nimport scala.concurrent.{ExecutionContext, Future}\n\nobject " + name + " {\n"
    text += "  final case class Inputs(" + p.inputs.map(i => sym(i.id) + ": " + tpe(i.valueType)).mkString(", ") + ")\n"
    p.steps.foreach { s =>
      val n = sym(s.id)
      text += "  final case class " + n + "Request(" + s.reads.map(r => sym(r.slot) + ": " + tpe(r.valueType)).mkString(", ") + ")\n  sealed trait " + n + "Result\n"
      s.outcomes.foreach { o =>
        val constructor = n + "_" + sym(o.code)
        text += (if (o.action == "continue") "  final case class " + constructor + "(" + s.writes.map(w => sym(w.id) + ": " + tpe(w.valueType)).mkString(", ") + ") extends " + n + "Result\n" else "  case object " + constructor + " extends " + n + "Result\n")
      }
    }
    text += "  final case class State(inputs: Inputs" + p.steps.flatMap(s => s.writes.map(w => ", " + sym(s.id + "_" + w.id) + ": Option[" + tpe(w.valueType) + "] = None")).mkString + ")\n"
    text += "  final case class Outputs(" + p.outputs.map(o => sym(o.id) + ": " + tpe(o.valueType)).mkString(", ") + ")\n"
    def outputValue(ref: ExecutionValueReference): String = ref match {
      case ExecutionValueReference.Input(id) => "state.inputs." + sym(id)
      case ExecutionValueReference.Step(step, output) => "state." + sym(step + "_" + output) + ".getOrElse(throw new IllegalArgumentException(\"unconfirmed predecessor output\"))"
      case _ => throw new IllegalArgumentException("result references require an explicit completion adapter")
    }
    text += "  def outputs(state: State): Outputs = Outputs(" + p.outputs.map(o => outputValue(o.ref)).mkString(", ") + ")\n"
    text += "  trait Stages {\n" + p.steps.map(s => "    def " + sym(s.id) + "(request: " + sym(s.id) + "Request): Future[" + sym(s.id) + "Result]").mkString("\n") + "\n  }\n"
    text += "  val codec: StateCodec[State] = StateCodec[State](\n    state => " + protoPkg + "." + protoName + "(planversion = " + quote(p.recovery.planVersion) + ", " + fields.map { case (n, id, value, optional) => sym(n) + " = " + (if (optional) value + ".map(" + converters + ".encode" + id + "PB)" else "Some(" + converters + ".encode" + id + "PB(" + value + "))") }.mkString(", ") + ").toByteArray,\n"
    text += "    bytes => { val pb = " + protoPkg + "." + protoName + ".parseFrom(bytes); require(pb.planversion == " + quote(p.recovery.planVersion) + ", \"exact finite plan version required\"); State(Inputs(" + p.inputs.zipWithIndex.map { case (i, n) => converters + ".decode" + i.valueType + "PB(pb.input" + n + ".getOrElse(throw new IllegalArgumentException(" + quote("missing durable input " + i.id) + ")))" }.mkString(", ") + ")" + fields.filter(_._4).map { case (n, id, _, _) => ", pb." + n + ".map(" + converters + ".decode" + id + "PB)" }.mkString + ") }\n  )\n"
    def read(r: ExecutionRead): String = r.ref match {
      case ExecutionValueReference.Input(id) => "state.inputs." + sym(id)
      case ExecutionValueReference.Step(step, output) => "state." + sym(step + "_" + output) + ".getOrElse(throw new IllegalArgumentException(\"unconfirmed predecessor output\"))"
      case _ => throw new IllegalArgumentException("stage input cannot use completion result source")
    }
    text += "  def behavior(persistenceId: String, stages: Stages, observer: RunObserver[State])(implicit ec: ExecutionContext): Behavior[PersistentMonarch.Command[State]] = {\n    require(persistenceId != null && persistenceId.nonEmpty && stages != null && observer != null, \"explicit owned finite execution and required stage objects\")\n    val plan = Vector(" + p.steps.map(s => quote(s.id)).mkString(", ") + ")\n    PersistentMonarch.behavior[String, State](PersistenceId.ofUniqueId(persistenceId), plan, (step, state) => step match {\n"
    p.steps.foreach { s =>
      val n = sym(s.id)
      text += "      case " + quote(s.id) + " => stages." + n + "(" + n + "Request(" + s.reads.map(read).mkString(", ") + ")).map {\n"
      s.outcomes.foreach { o =>
        val constructor = n + "_" + sym(o.code)
        text += (if (o.action == "continue") "        case result: " + constructor + " => state.copy(" + s.writes.map(w => sym(s.id + "_" + w.id) + " = Some(result." + sym(w.id) + ")").mkString(", ") + ")\n" else "        case " + name + "." + constructor + " => throw StageFailedException(StageError(" + quote(s.id) + ", Some(" + quote(o.code) + "), " + quote(o.kind) + ", " + quote(o.kind + ":" + o.code + ":" + o.action) + "))\n")
      }
      text += "      }\n"
    }
    text += "      case _ => Future.failed(new IllegalArgumentException(\"unknown static step\"))\n    }, codec, identity[String], None, observer)\n  }\n}\n"
    val protoPath = "app/protobuf/" + sym(p.id) + "_execution.proto"
    val proto = "syntax = \"proto3\";\nimport \"scalapb/scalapb.proto\";\nimport \"" + pkg.replace(".", "_") + "_domain.proto\";\npackage " + protoPkg + ";\noption (scalapb.options) = { flat_package: true };\nmessage " + protoName + " {\n  string planversion = 1;\n" + fields.zipWithIndex.map { case ((n, id, _, _), i) => "  ." + pkg + ".infrastructure.proto." + id + "PB " + n + " = " + (i + 2) + ";" }.mkString("\n") + "\n}\n"
    Vector(ProductSourceModel(NamingConventions.productPackagePath(pkg, "application/" + name + ".scala"), text, "execution-plan", Vector(declaration.source), model.footprint), ProductSourceModel(protoPath, proto, "proto", Vector(declaration.source), model.footprint))
    }
  }
}
