package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.TypeResolverDSL
import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.products._

object ProductEffectHostTemplate {
  private def sym(v: String): String = NamingConventions.strictSymbol(v)
  private def q(v: String): String = ujson.write(v)
  private def typeText(t: net.imadz.codegen.scaffolding.cqrs.TypeRef): String = t.fqn + (if (t.typeParams.isEmpty) "" else t.typeParams.map(typeText).mkString("[", ", ", "]"))
  def generate(model: ProductApplicationModel): Vector[ProductSourceModel] = model.effectHosts.map { h =>
    val pkg = model.domain.packages(h.pipeline.ref.context)
    val parent = sym(h.pipeline.ref.id) + "Execution"
    val stem = sym(h.id) + "EffectHost"
    val pipeline = model.pipelines.find(_.id == h.pipeline.ref.id).get
    val step = pipeline.steps.find(_.id == h.stepId).get
    def tpe(t: NominalType): String = typeText(TypeResolverDSL.productType(t, model.domain.packages))
    val request = tpe(h.requestType); val result = tpe(h.resultType); val operation = tpe(h.operationType)
    val observation = tpe(h.observationType); val reconcile = tpe(h.reconcileType)
    val observationId = h.observationType.asInstanceOf[NominalType.Named].ref.id
    val converters = pkg + ".infrastructure.serialization.DomainConverters"
    def read(r: ExecutionValueReference): String = r match {
      case ExecutionValueReference.Input(id) => "input.inputs." + sym(id)
      case ExecutionValueReference.Step(id, output) => "input." + sym(id + "_" + output) + ".getOrElse(throw new IllegalArgumentException(\"unconfirmed predecessor output\"))"
      case _ => throw new IllegalArgumentException("effect request requires original or confirmed predecessor source")
    }
    def textual(value: String, t: NominalType): String = t match {
      case NominalType.Named(r) => textual(value + ".value", model.domain.layout.declarations.find(_.ref == r).get.valueType.get)
      case NominalType.Primitive("string") => value
      case _ => throw new IllegalArgumentException("exact textual external identity required")
    }
    val key = textual("input.inputs." + sym(h.identity.input), h.identity.valueType)
    val identityParts = Vector(h.pipeline.ref.context, h.pipeline.ref.id, h.pipeline.version, h.id, h.version, h.stepId, h.port).map(q) :+ key
    val confirmed = h.outcomes.find(_.status == "confirmed").get.code
    val rejected = h.outcomes.find(_.status == "rejected").get.code
    val failed = h.outcomes.find(_.status == "failed").get.code
    val successFields = step.writes.map(w => "value.result.get." + sym(w.slot)).mkString(", ")
    val bindings = h.technicalPorts.map(p => "    " + sym(p.role) + ": Implementation[" + (p.role match {
      case "reconcile" => reconcile
      case _ => operation
    }) + ", " + (p.role match {
      case "execute" => observation
      case "query" => "Option[" + observation + "]"
      case _ => "Boolean"
    }) + "]").mkString(",\n")
    val checks = h.technicalPorts.map(p => "    require(bindings." + sym(p.role) + " != null && bindings." + sym(p.role) + ".id == " + q(p.implementation.id) + " && bindings." + sym(p.role) + ".version == " + q(p.implementation.version) + " && bindings." + sym(p.role) + ".run != null, " + q("missing exact effect implementation " + p.port.ref.id) + ")").mkString("\n")
    val owners = h.technicalPorts.map(p => "(" + Vector(p.port.ref.id, p.role, p.owner.ref.id, p.owner.version, p.implementation.id, p.implementation.version, "handwritten-composition-root").map(q).mkString(", ") + ")").mkString(", ")
    val source = s"""package $pkg.application

import akka.actor.typed.{ActorRef, Behavior}
import akka.actor.typed.scaladsl.Behaviors
import akka.persistence.typed.{PersistenceId, RecoveryCompleted}
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import com.google.protobuf.ByteString
import scala.concurrent.{ExecutionContext, Future}
import scala.util.{Failure, Success}
import scala.util.control.NonFatal

object $stem {
  // Static authored ownership only. Supply these exact callbacks in the handwritten composition root.
  val bindingOwnership = Vector($owners)
  final case class Implementation[I, O](id: String, version: String, run: I => Future[O])
  final case class Bindings(
$bindings
  )
  final class Installed private[$stem] (private val bindings: Bindings) {
    def execute(input: $operation): Future[$observation] = bindings.execute.run(input)
    def query(input: $operation): Future[Option[$observation]] = bindings.query.run(input)
    def reconcile(input: $reconcile): Future[Boolean] = bindings.reconcile.run(input)
  }
  def install(bindings: Bindings): Installed = {
    require(bindings != null, "complete effect callback objects required")
$checks
    new Installed(bindings)
  }
  sealed trait Request
  final case class Invoke(input: $parent.State, replyTo: ActorRef[Reply]) extends Request
  final case class Reconcile(input: $parent.State, decision: String, authorization: String, replyTo: ActorRef[Reply]) extends Request
  private final case class Observed(operation: String, round: Long, value: Option[$observation], query: Boolean) extends Request
  private final case class Authorized(operation: String, round: Long, allowed: Boolean, decision: String, authorization: String, proof: ByteString) extends Request
  sealed trait Reply
  final case class Pending(reason: String) extends Reply
  final case class Conflict(reason: String) extends Reply
  final case class Completed(result: $parent.${sym(h.stepId)}Result) extends Reply
  sealed trait Event
  final case class Intent(original: ByteString, operation: String) extends Event
  final case class ObservationStored(value: ByteString) extends Event
  final case class RetryAuthorized(authorization: String, evidence: ByteString) extends Event
  final case class State(original: ByteString = ByteString.EMPTY, operation: String = "", observation: ByteString = ByteString.EMPTY)

  def request(input: $parent.State): $request = $request(${step.reads.map(r => read(r.ref)).mkString(", ")})
  def operationIdentity(input: $parent.State): String = {
    require(input != null && input.inputs != null, "complete durable external input required")
    val stream = new java.io.ByteArrayOutputStream()
    val out = new java.io.DataOutputStream(stream)
    Vector(${identityParts.mkString(", ")}).foreach { part =>
      require(part != null && part.nonEmpty, "stable initial external identity required")
      val bytes = part.getBytes(java.nio.charset.StandardCharsets.UTF_8)
      out.writeInt(bytes.length); out.write(bytes)
    }
    out.flush()
    java.security.MessageDigest.getInstance("SHA-256").digest(stream.toByteArray).map(b => f"$${b & 0xff}%02x").mkString
  }
  private def decode(bytes: ByteString): Option[$observation] =
    if (bytes.isEmpty) None else Some($converters.decode${observationId}PB($pkg.infrastructure.proto.${observationId}PB.parseFrom(bytes.toByteArray)))
  private def encode(value: $observation): ByteString = $converters.encode${observationId}PB(value).toByteString
  private def checked(value: $observation, expected: $operation): $observation = {
    require(value != null && value.operation == expected.operation && value.request == expected.request && value.result != null && value.evidence != null, "complete same-operation same-request effect observation required")
    value.status match {
      case "confirmed" => require(value.result.nonEmpty && value.result.get != null && value.evidence.nonEmpty, "full durable confirmed result and evidence required")
      case "rejected" | "failed" | "absent" => require(value.result.isEmpty && value.evidence.nonEmpty, "authoritative non-success or absent evidence required")
      case "unknown" => require(value.result.isEmpty, "unknown is not a result")
      case _ => throw new IllegalArgumentException("unknown external observation status")
    }
    value
  }
  private def terminal(state: State): Option[$parent.${sym(h.stepId)}Result] = decode(state.observation).flatMap { value =>
    value.status match {
      case "confirmed" => Some($parent.${sym(h.stepId + "_" + confirmed)}($successFields))
      case "rejected" => Some($parent.${sym(h.stepId + "_" + rejected)})
      case "failed" => Some($parent.${sym(h.stepId + "_" + failed)})
      case _ => None
    }
  }
  def apply(persistenceId: String, installed: Installed): Behavior[Request] = Behaviors.setup { context =>
    require(persistenceId != null && persistenceId.nonEmpty && installed != null, "owned effect persistence and all installed callbacks required")
    implicit val ec: ExecutionContext = context.executionContext
    var pending = false
    var round = 0L
    var waiters = Vector.empty[ActorRef[Reply]]
    def operation(state: State): $operation = $operation(state.operation, request($parent.codec.decode(state.original.toByteArray)))
    def answer(reply: Reply): Unit = { waiters.distinct.foreach(_ ! reply); waiters = Vector.empty }
    def safe[A](body: => Future[A]): Future[A] = try { val f = body; require(f != null, "effect callback future required"); f } catch { case NonFatal(e) => Future.failed(e) }
    def execute(state: State): Unit = {
      pending = true; round += 1; val current = round; val expected = operation(state)
      context.pipeToSelf(safe(installed.execute(expected)).map(v => Some(checked(v, expected)))) {
        case Success(value) => Observed(state.operation, current, value, query = false)
        case Failure(_) => Observed(state.operation, current, None, query = false)
      }
    }
    def query(state: State): Unit = {
      pending = true; round += 1; val current = round; val expected = operation(state)
      context.pipeToSelf(safe(installed.query(expected)).map { value => require(value != null, "optional query observation required"); value.map(v => checked(v, expected)) }) {
        case Success(value) => Observed(state.operation, current, value, query = true)
        case Failure(_) => Observed(state.operation, current, None, query = true)
      }
    }
    def afterObservation(state: State, fromQuery: Boolean): Unit = terminal(state) match {
      case Some(result) => answer(Completed(result))
      case None if !fromQuery => query(state)
      case None => answer(Pending("effect outcome remains unknown or absent; no implicit retry"))
    }
    EventSourcedBehavior[Request, Event, State](PersistenceId.ofUniqueId(persistenceId), State(),
      (state, command) => command match {
        case Invoke(input, replyTo) =>
          val original = ByteString.copyFrom($parent.codec.encode(input)); val op = operationIdentity(input)
          if (state.operation.nonEmpty && (state.original != original || state.operation != op)) Effect.none.thenRun((_: State) => replyTo ! Conflict("different complete original input under effect identity"))
          else {
            waiters :+= replyTo
            if (state.operation.isEmpty) Effect.persist(Intent(original, op)).thenRun((s: State) => execute(s))
            else terminal(state) match {
              case Some(value) => Effect.none.thenRun((_: State) => answer(Completed(value)))
              case None => if (!pending) query(state); Effect.none
            }
          }
        case Observed(op, observedRound, value, fromQuery) if pending && op == state.operation && observedRound == round =>
          pending = false
          val bytes = value.map(encode).getOrElse(ByteString.EMPTY)
          if (bytes != state.observation) Effect.persist(ObservationStored(bytes)).thenRun((s: State) => afterObservation(s, fromQuery))
          else Effect.none.thenRun((s: State) => afterObservation(s, fromQuery))
        case Reconcile(input, decision, authorization, replyTo) =>
          val original = ByteString.copyFrom($parent.codec.encode(input)); val op = operationIdentity(input)
          val proof = decode(state.observation)
          if (op != state.operation || original != state.original) Effect.none.thenRun((_: State) => replyTo ! Conflict("reconcile must retain the exact durable original and operation"))
          else if (pending || terminal(state).nonEmpty || authorization == null || authorization.isEmpty || !Set("query", "retry")(decision) || (decision == "retry" && !proof.exists(v => v.status == "absent" && v.evidence.nonEmpty)))
            Effect.none.thenRun((_: State) => replyTo ! Pending("reconcile requires authority and durable absent evidence before retry"))
          else {
            waiters :+= replyTo; pending = true; round += 1; val current = round; val evidence = state.observation
            val call = $reconcile(op, request(input), decision, proof, authorization)
            context.pipeToSelf(safe(installed.reconcile(call))) {
              case Success(allowed) => Authorized(op, current, allowed, decision, authorization, evidence)
              case Failure(_) => Authorized(op, current, false, decision, authorization, evidence)
            }
            Effect.none
          }
        case Authorized(op, observedRound, allowed, decision, authorization, proof) if pending && op == state.operation && observedRound == round =>
          pending = false
          if (!allowed || proof != state.observation) Effect.none.thenRun((_: State) => answer(Pending("reconciliation not authorized")))
          else if (decision == "query") Effect.none.thenRun((s: State) => query(s))
          else Effect.persist(RetryAuthorized(authorization, proof)).thenRun((s: State) => execute(s))
        case _ => Effect.none
      },
      (state, event) => event match {
        case Intent(original, op) => state.copy(original = original, operation = op)
        case ObservationStored(value) => state.copy(observation = value)
        case RetryAuthorized(_, _) => state.copy(observation = ByteString.EMPTY)
      }).receiveSignal {
        case (state, RecoveryCompleted) if state.operation.nonEmpty && terminal(state).isEmpty => query(state)
      }
  }
}
"""
    val sources = Vector(h.source) ++ h.provenance ++ h.technicalPorts.map(p => model.domain.layout.declarations.find(_.ref == p.port.ref).get.source)
    ProductSourceModel(NamingConventions.productPackagePath(pkg, "application/" + stem + ".scala"), source, "effect-host", sources.distinct, model.footprint)
  }
}
