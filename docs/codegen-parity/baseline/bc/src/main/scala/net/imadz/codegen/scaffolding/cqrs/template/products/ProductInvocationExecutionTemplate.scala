package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.TypeResolverDSL
import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.products._
import net.imadz.meta.execution.SagaTypeShape

/** Independent typed lowering for mixed finite plans; invocation functions are closed over durable host actors. */
object ProductInvocationExecutionTemplate {
  private def sym(s: String): String = NamingConventions.strictSymbol(s)
  private def q(s: String): String = ujson.write(s)
  private def typeText(t: net.imadz.codegen.scaffolding.cqrs.TypeRef): String = t.fqn + (if (t.typeParams.isEmpty) "" else t.typeParams.map(typeText).mkString("[", ", ", "]"))
  def generate(m: ProductApplicationModel, p: ExecutionPipeline): Vector[ProductSourceModel] = {
    val rows = m.domain.layout.declarations.filter(d => d.ref.kind == "pipeline" && d.ref.id == p.id)
    require(rows.size == 1, "exact qualified pipeline declaration required")
    val d = rows.head; val context = d.ref.context; val pkg = m.domain.packages(context); val name = sym(p.id) + "Execution"
    require(p.bounds.runs == 1 && p.bounds.steps == 1 && p.bounds.chunks == 1, "finite single-run single-step single-chunk ownership required")
    val hosts = p.steps.collect { case s if s.operation.isInstanceOf[ExecutionSagaOperation] =>
      val op = s.operation.asInstanceOf[ExecutionSagaOperation]
      val candidates = m.hosts.filter(h => h.contract.saga.ref.context == context && h.contract.saga.ref.id == op.id && h.contract.saga.version == op.version && h.contract.entry.startOwner == HostStartOwner("pipeline", Some(d.ref), Some(s.id)))
      require(candidates.size == 1, "one exact pipeline-owned durable host required")
      s -> sym(candidates.head.contract.id)
    } ++ p.steps.collect { case s if s.operation.isInstanceOf[ExecutionChildOperation] =>
      val op = s.operation.asInstanceOf[ExecutionChildOperation]
      require(m.childPlans.exists(_.ref.id == op.plan), "whole admitted child plan required")
      s -> (sym(p.id + "_" + s.id) + "Child")
    } ++ p.steps.collect { case s if m.effectHosts.exists(h => h.pipeline.ref == d.ref && h.stepId == s.id) =>
      val effect = m.effectHosts.find(h => h.pipeline.ref == d.ref && h.stepId == s.id).get
      s -> (sym(effect.id) + "Effect")
    }
    p.steps.foreach { step => step.operation match {
      case ExecutionPortOperation(id) => require(p.binding.ports.find(_.id == id).exists(_.effect == "pure") || m.effectHosts.exists(h => h.pipeline.ref == d.ref && h.stepId == step.id && h.port == id), "external effect requires exact reconciliation adapter")
      case _: ExecutionSagaOperation => ()
      case _: ExecutionChildOperation => require(m.childPlans.nonEmpty, "child run requires complete durable plan adapter")
      case _ => throw new IllegalArgumentException("child run requires complete durable plan adapter")
    } }
    def nominal(id: String): NominalType = {
      val pin = p.binding.types.find(_._1 == id).getOrElse(throw new IllegalArgumentException("explicit execution type binding required"))
      val declarations = m.domain.layout.declarations.filter(d => d.ref.context == context && d.ref.kind == "type" && d.ref.id == id)
      if (declarations.size == 1) NominalType.Named(declarations.head.ref)
      else {
        val descriptors = m.hosts.flatMap(_.runtime.args.types).filter(_.id == id)
        require(descriptors.nonEmpty && descriptors.forall(_.implementation.toString == pin._2), "complete consistent runtime descriptor required")
        if (descriptors.forall(t => t.shape.isInstanceOf[SagaTypeShape.Integer] && t.canonicalType == "Int")) NominalType.Primitive("integer")
        else {
          require(descriptors.forall(t => t.shape.isInstanceOf[SagaTypeShape.Text] && t.canonicalType == "String"), "explicit integer or string descriptor required")
          NominalType.Primitive("string")
        }
      }
    }
    def tpe(id: String): String = typeText(TypeResolverDSL.productType(nominal(id), m.domain.packages))
    def value(ref: ExecutionValueReference): String = ref match {
      case ExecutionValueReference.Input(id) => "state.inputs." + sym(id)
      case ExecutionValueReference.Step(step, output) => "state." + sym(step + "_" + output) + ".getOrElse(throw new IllegalArgumentException(\"unconfirmed predecessor output\"))"
      case _ => throw new IllegalArgumentException("exact result adapter required")
    }
    var text = "package " + pkg + ".application\n\nimport akka.actor.typed.{ActorRef, Behavior, PostStop}\nimport akka.actor.typed.scaladsl.Behaviors\nimport akka.persistence.typed.PersistenceId\nimport net.imadz.monarch.{StageError, StageFailedException}\nimport net.imadz.monarch.persistence.{PersistentMonarch, RunObserver, StateCodec}\nimport scala.concurrent.{ExecutionContext, Future, Promise}\nimport scala.concurrent.duration._\n\nobject " + name + " {\n"
    text += "  final case class Inputs(" + p.inputs.map(i => sym(i.id) + ": " + tpe(i.valueType)).mkString(", ") + ")\n"
    p.steps.foreach { s =>
      text += "  final case class " + sym(s.id) + "Request(" + s.reads.map(r => sym(r.slot) + ": " + tpe(r.valueType)).mkString(", ") + ")\n  sealed trait " + sym(s.id) + "Result\n"
      s.outcomes.foreach(o => text += (if (o.action == "continue") "  final case class " + sym(s.id + "_" + o.code) + "(" + s.writes.map(w => sym(w.id) + ": " + tpe(w.valueType)).mkString(", ") + ") extends " + sym(s.id) + "Result\n" else "  case object " + sym(s.id + "_" + o.code) + " extends " + sym(s.id) + "Result\n"))
    }
    text += "  final case class State(inputs: Inputs" + p.steps.flatMap(s => s.writes.map(w => ", " + sym(s.id + "_" + w.id) + ": Option[" + tpe(w.valueType) + "] = None")).mkString + ")\n  final case class Outputs(" + p.outputs.map(o => sym(o.id) + ": " + tpe(o.valueType)).mkString(", ") + ")\n  def outputs(state: State): Outputs = Outputs(" + p.outputs.map(o => value(o.ref)).mkString(", ") + ")\n"
    val fields = p.inputs.zipWithIndex.map { case (i, n) => ("input" + n, i.valueType, "state.inputs." + sym(i.id), false) } ++ p.steps.flatMap(s => s.writes.map(w => s -> w)).zipWithIndex.map { case ((s, w), n) => ("output" + n, w.valueType, "state." + sym(s.id + "_" + w.id), true) }
    val pb = pkg + ".infrastructure.executionproto." + name.replace("_", "") + "StatePB"
    def conversion(id: String, direction: String): String = nominal(id) match { case _: NominalType.Named => pkg + ".infrastructure.serialization.DomainConverters." + direction + id + "PB"; case NominalType.Primitive("string") => "identity[String]"; case _ => "identity[Long]" }
    text += "  val codec: StateCodec[State] = StateCodec[State](\n    state => " + pb + "(planversion = " + q(p.recovery.planVersion) + ", " + fields.map { case (n, id, v, optional) => n + " = " + (if (optional) v + ".map(" + conversion(id, "encode") + ")" else "Some(" + conversion(id, "encode") + "(" + v + "))") }.mkString(", ") + ").toByteArray,\n    bytes => { val pb = " + pb + ".parseFrom(bytes); require(pb.planversion == " + q(p.recovery.planVersion) + ", \"exact finite plan version required\"); State(Inputs(" + fields.filterNot(_._4).map { case (n, id, _, _) => conversion(id, "decode") + "(pb." + n + ".getOrElse(throw new IllegalArgumentException(" + q("missing durable input " + n) + ")))" }.mkString(", ") + ")" + fields.filter(_._4).map { case (n, id, _, _) => ", pb." + n + ".map(" + conversion(id, "decode") + ")" }.mkString + ") }\n  )\n"
    val pure = p.steps.filter(s => s.operation.isInstanceOf[ExecutionPortOperation] && !m.effectHosts.exists(h => h.pipeline.ref == d.ref && h.stepId == s.id))
    text += "  trait PureStages {\n" + pure.map(s => "    def " + sym(s.id) + "(request: " + sym(s.id) + "Request): Future[" + sym(s.id) + "Result]").mkString("\n") + "\n  }\n  final class Installed private[" + name + "] (val pure: PureStages" + hosts.map { case (s, stem) => ", val " + sym(s.id) + "Host: ActorRef[" + stem + "Host.Request]" }.mkString + ")\n"
    text += "  def install(pure: PureStages" + hosts.map { case (s, stem) => ", " + sym(s.id) + "Host: ActorRef[" + stem + "Host.Request]" }.mkString + "): Installed = {\n    require(pure != null" + hosts.map { case (s, _) => " && " + sym(s.id) + "Host != null" }.mkString + ", \"all exact finite stage and invocation objects required\")\n    new Installed(pure" + hosts.map { case (s, _) => ", " + sym(s.id) + "Host" }.mkString + ")\n  }\n"
    text += "  def behavior(persistenceId: String, installed: Installed, observer: RunObserver[State])(implicit ec: ExecutionContext): Behavior[PersistentMonarch.Command[State]] = Behaviors.setup { context =>\n    require(persistenceId != null && persistenceId.nonEmpty && installed != null && observer != null, \"explicit owned finite execution and installed objects required\")\n"
    hosts.foreach { case (s, stem) =>
      val n = sym(s.id)
      text += "    final case class " + n + "Call(state: State, promise: Promise[" + n + "Result])\n    val " + n + "Bridge = context.spawnAnonymous(Behaviors.setup[" + n + "Call] { bridgeContext => Behaviors.receiveMessage[" + n + "Call] { call =>\n      bridgeContext.spawnAnonymous(Behaviors.setup[" + stem + "Host.Reply] { replyContext =>\n        installed." + n + "Host ! " + stem + "Host.Invoke(call.state, replyContext.self)\n        Behaviors.receiveMessage[" + stem + "Host.Reply] {\n          case " + stem + "Host.Completed(result) => call.promise.trySuccess(result); Behaviors.stopped\n          case " + stem + "Host.Conflict(reason) => call.promise.tryFailure(new IllegalArgumentException(reason)); Behaviors.stopped\n          case " + stem + "Host.Pending(_) => replyContext.scheduleOnce(20.millis, installed." + n + "Host, " + stem + "Host.Invoke(call.state, replyContext.self)); Behaviors.same\n        }.receiveSignal { case (_, PostStop) => call.promise.tryFailure(new IllegalStateException(\"owned invocation observer stopped\")); Behaviors.same }\n      })\n      Behaviors.same\n    } })\n    def invoke" + n + "(state: State): Future[" + n + "Result] = {\n      val promise = Promise[" + n + "Result]()\n      " + n + "Bridge ! " + n + "Call(state, promise)\n      promise.future\n    }\n"
    }
    text += "    val plan = Vector(" + p.steps.map(s => q(s.id)).mkString(", ") + ")\n    PersistentMonarch.behavior[String, State](PersistenceId.ofUniqueId(persistenceId), plan, (step, state) => step match {\n"
    p.steps.foreach { s =>
      val call = if (hosts.exists(_._1.id == s.id)) "invoke" + sym(s.id) + "(state)" else "installed.pure." + sym(s.id) + "(" + sym(s.id) + "Request(" + s.reads.map(r => value(r.ref)).mkString(", ") + "))"
      text += "      case " + q(s.id) + " => " + call + ".map {\n"
      s.outcomes.foreach(o => text += (if (o.action == "continue") "        case result: " + sym(s.id + "_" + o.code) + " => state.copy(" + s.writes.map(w => sym(s.id + "_" + w.id) + " = Some(result." + sym(w.id) + ")").mkString(", ") + ")\n" else "        case " + name + "." + sym(s.id + "_" + o.code) + " => throw StageFailedException(StageError(" + q(s.id) + ", Some(" + q(o.code) + "), " + q(o.kind) + ", " + q(o.kind + ":" + o.code + ":" + o.action) + "))\n"))
      text += "      }\n"
    }
    text += "      case _ => Future.failed(new IllegalArgumentException(\"unknown static step\"))\n    }, codec, identity[String], None, observer)\n  }\n}\n"
    val protoPath = "app/protobuf/" + sym(p.id) + "_execution.proto"
    val proto = "syntax = \"proto3\";\nimport \"scalapb/scalapb.proto\";\nimport \"" + pkg.replace(".", "_") + "_domain.proto\";\npackage " + pkg + ".infrastructure.executionproto;\noption (scalapb.options) = { flat_package: true };\nmessage " + name.replace("_", "") + "StatePB {\n  string planversion = 1;\n" + fields.zipWithIndex.map { case ((n, id, _, _), i) => "  " + (nominal(id) match { case _: NominalType.Named => "." + pkg + ".infrastructure.proto." + id + "PB"; case NominalType.Primitive("string") => "optional string"; case _ => "optional int64" }) + " " + n + " = " + (i + 2) + ";" }.mkString("\n") + "\n}\n"
    Vector(ProductSourceModel(NamingConventions.productPackagePath(pkg, "application/" + name + ".scala"), text, "execution-plan", Vector(d.source), m.footprint), ProductSourceModel(protoPath, proto, "proto", Vector(d.source), m.footprint))
  }
}
