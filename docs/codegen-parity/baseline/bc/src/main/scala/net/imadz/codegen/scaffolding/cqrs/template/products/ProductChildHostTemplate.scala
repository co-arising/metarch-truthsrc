package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.products._

object ProductChildHostTemplate {
  private def sym(s: String): String = NamingConventions.strictSymbol(s)
  private def q(s: String): String = ujson.write(s)
  def generate(m: ProductApplicationModel): Vector[ProductSourceModel] = m.pipelines.flatMap { p => p.steps.collect {
    case s if s.operation.isInstanceOf[ExecutionChildOperation] =>
      val op = s.operation.asInstanceOf[ExecutionChildOperation]
      val child = m.childPlans.find(_.ref.id == op.plan).get
      val pkg = m.domain.packages(child.ref.context); val parent = sym(p.id) + "Execution"; val plan = sym(child.ref.id) + "Execution"
      val name = sym(p.id + "_" + s.id) + "ChildHost"; val n = sym(s.id)
      def value(ref: ExecutionValueReference): String = ref match {
        case ExecutionValueReference.Input(id) => "input.inputs." + sym(id)
        case _ => throw new IllegalArgumentException("child payload requires durable initial input")
      }
      def textual(v: String, t: NominalType): String = t match {
        case NominalType.Named(r) => textual(v + ".value", m.domain.layout.declarations.find(_.ref == r).get.valueType.get)
        case NominalType.Primitive("string") => v
        case NominalType.Primitive("integer") => "java.lang.Long.toString(" + v + ")"
        case _ => throw new IllegalArgumentException("exact textual or integer child identity required")
      }
      def token(r: ExecutionRead): String = {
        val d = m.domain.layout.declarations.find(d => d.ref.context == child.ref.context && d.ref.kind == "type" && d.ref.id == r.valueType).get
        textual(value(r.ref), NominalType.Named(d.ref))
      }
      val parts = Vector(q("truthsrc-child-run-v1"), q(child.ref.context), q(p.id), q(p.recovery.planVersion), q(child.ref.id), q(child.version), token(op.source), q(s.id), token(op.occurrence), q("chunk"), q(if (op.chunk.nonEmpty) "present" else "absent")) ++ op.chunk.map(token)
      val binding = p.binding.children.get.find(_.step == s.id).get
      val initial = plan + ".State(" + plan + ".Inputs(" + op.payload.map(r => value(r.ref)).mkString(", ") + "))"
      val success = op.results.find(_.kind == "succeeded").get; val recovery = op.results.find(_.kind == "recovery-required").get
      val values = s.writes.map { w => "output." + sym(success.outputs.find(_.slot == w.slot).get.ref.asInstanceOf[ExecutionValueReference.Result].field) }.mkString(", ")
      val exactPlan = child.pipeline.steps.zipWithIndex.map { case (s, i) => q(s.id + "#" + i) }.mkString(", ")
      val identityParts = parts.mkString(", ")
      val text = s"""package $pkg.application

import akka.actor.typed.{ActorRef, Behavior}
import akka.actor.typed.scaladsl.Behaviors
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import akka.serialization.SerializerWithStringManifest
import com.google.protobuf.ByteString
import net.imadz.monarch.persistence.PersistentMonarch
import scala.concurrent.{ExecutionContext, Future}

object $name {
  sealed trait Request
  final case class Invoke(input: $parent.State, replyTo: ActorRef[Reply]) extends Request
  private final case class Observed(value: ChildJournal.Observation[$plan.State], replyTo: ActorRef[Reply]) extends Request
  private final case class Started(value: PersistentMonarch.RunReply, replyTo: ActorRef[Reply]) extends Request
  sealed trait Reply
  final case class Pending(reason: String) extends Reply
  final case class Conflict(reason: String) extends Reply
  final case class Completed(result: $parent.${n}Result) extends Reply
  sealed trait Event
  final case class Intent(parent: ByteString, initial: ByteString, operation: String, childPid: String, version: String) extends Event
  final case class Confirmed(snapshot: ByteString) extends Event
  final case class State(parent: ByteString = ByteString.EMPTY, initial: ByteString = ByteString.EMPTY, operation: String = "", childPid: String = "", result: Option[ByteString] = None)
  def initial(input: $parent.State): $plan.State = $initial
  def operationIdentity(input: $parent.State): String = {
    val buffer = new java.io.ByteArrayOutputStream
    val out = new java.io.DataOutputStream(buffer)
    val parts = Vector($identityParts)
    parts.foreach { part => require(part != null && part.nonEmpty, "durable child identity required"); val bytes = part.getBytes(java.nio.charset.StandardCharsets.UTF_8); out.writeInt(bytes.length); out.write(bytes) }
    out.flush()
    "sha256:" + java.security.MessageDigest.getInstance("SHA-256").digest(buffer.toByteArray).iterator.map(b => f"$${b & 0xff}%02x").mkString
  }
  def childPersistenceId(input: $parent.State): String = ${q(binding.journal + ":")} + operationIdentity(input)
  private val exactPlan = Vector($exactPlan)
  private def completed(snapshot: ByteString): Reply = {
    val output = $plan.outputs($plan.codec.decode(snapshot.toByteArray))
    Completed($parent.${n}_${sym(success.code)}($values))
  }
  def apply(persistenceId: String, child: ActorRef[PersistentMonarch.Command[$plan.State]], journal: ChildJournal.Reader): Behavior[Request] = Behaviors.setup { context =>
    require(persistenceId != null && persistenceId.nonEmpty && child != null && journal != null, "actual child actor and authoritative journal implementation required")
    implicit val ec: ExecutionContext = context.executionContext
    def observe(state: State, replyTo: ActorRef[Reply]): Unit = context.pipeToSelf(journal.events(state.childPid).map(rows => ChildJournal.observe(rows, state.operation, state.initial, exactPlan, $plan.codec))) { result => Observed(result.getOrElse(ChildJournal.Conflict("child journal query failed; no authoritative result")), replyTo) }
    EventSourcedBehavior[Request, Event, State](PersistenceId.ofUniqueId(persistenceId), State(), (state, request) => request match {
      case Invoke(input, replyTo) =>
        val original = ByteString.copyFrom($parent.codec.encode(input))
        val bytes = ByteString.copyFrom($plan.codec.encode(initial(input)))
        val operation = operationIdentity(input)
        val pid = childPersistenceId(input)
        if (state.operation.nonEmpty && (state.parent != original || state.initial != bytes || state.operation != operation || state.childPid != pid)) Effect.none.thenRun((_: State) => replyTo ! Conflict("different child payload or original input under existing identity"))
        else if (state.result.nonEmpty) Effect.none.thenRun((s: State) => replyTo ! completed(s.result.get))
        else if (state.operation.nonEmpty) Effect.none.thenRun((s: State) => observe(s, replyTo))
        else Effect.persist(Intent(original, bytes, operation, pid, ${q(child.version)})).thenRun((s: State) => observe(s, replyTo))
      case Observed(ChildJournal.Missing, replyTo) => Effect.none.thenRun { s: State =>
        val adapter = context.spawnAnonymous(Behaviors.receiveMessage[PersistentMonarch.RunReply] { reply => context.self ! Started(reply, replyTo); Behaviors.stopped })
        child ! PersistentMonarch.StartRun(s.operation, $plan.codec.decode(s.initial.toByteArray), adapter)
      }
      case Started(_, replyTo) => Effect.none.thenRun((s: State) => observe(s, replyTo))
      case Observed(ChildJournal.Running(_), replyTo) => Effect.none.thenRun((_: State) => replyTo ! Pending("awaiting authoritative child terminal"))
      case Observed(ChildJournal.Completed(childState), replyTo) => Effect.persist(Confirmed(ByteString.copyFrom($plan.codec.encode(childState)))).thenRun((s: State) => replyTo ! completed(s.result.get))
      case Observed(ChildJournal.Failed(_), replyTo) => Effect.none.thenRun((_: State) => replyTo ! Completed($parent.${n}_${sym(recovery.code)}))
      case Observed(ChildJournal.Conflict(reason), replyTo) => Effect.none.thenRun((_: State) => replyTo ! Conflict(reason))
    }, (state, event) => event match {
      case Intent(original, initial, operation, pid, version) => require(version == ${q(child.version)}, "exact durable child plan version required"); state.copy(parent = original, initial = initial, operation = operation, childPid = pid)
      case Confirmed(snapshot) => state.copy(result = Some(snapshot))
    })
  }
}
final class ${name}Serializer extends SerializerWithStringManifest {
  override val identifier: Int = ${746000 + m.pipelines.flatMap(_.steps).indexOf(s)}
  def manifest(value: AnyRef): String = { require(value.isInstanceOf[$name.Event], "child host event required"); "child-event-v1" }
  def toBinary(value: AnyRef): Array[Byte] = {
    manifest(value)
    val pb = value match {
      case $name.Intent(parent, initial, operation, pid, version) => $pkg.infrastructure.childproto.ChildHostEventPB(kind = "intent", parent = parent, initial = initial, operation = operation, childpid = pid, version = version)
      case $name.Confirmed(snapshot) => $pkg.infrastructure.childproto.ChildHostEventPB(kind = "confirmed", initial = snapshot)
    }
    pb.toByteArray
  }
  def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = {
    require(manifest == "child-event-v1", "exact child event version required")
    val pb = $pkg.infrastructure.childproto.ChildHostEventPB.parseFrom(bytes)
    pb.kind match {
      case "intent" => $name.Intent(pb.parent, pb.initial, pb.operation, pb.childpid, pb.version)
      case "confirmed" => $name.Confirmed(pb.initial)
      case _ => throw new IllegalArgumentException("unknown child host event")
    }
  }
}
"""
      ProductSourceModel(NamingConventions.productPackagePath(pkg, "application/" + name + ".scala"), text, "invocation-host", Vector(child.source), m.footprint)
  } }
}
