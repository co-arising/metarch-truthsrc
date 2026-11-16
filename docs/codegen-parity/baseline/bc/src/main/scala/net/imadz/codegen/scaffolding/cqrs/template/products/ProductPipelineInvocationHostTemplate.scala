package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.TypeResolverDSL
import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.execution._
import net.imadz.meta.products._

/** Pipeline-only invocation: whole checkpoint and args persist before Start; only the runtime supplies identity. */
object ProductPipelineInvocationHostTemplate {
  private def sym(s: String): String = NamingConventions.strictSymbol(s)
  private def q(s: String): String = ujson.write(s)
  private def typeText(t: net.imadz.codegen.scaffolding.cqrs.TypeRef): String = t.fqn + (if (t.typeParams.isEmpty) "" else t.typeParams.map(typeText).mkString("[", ", ", "]"))
  def generate(m: ProductApplicationModel, row: ProductApplicationHost): ProductSourceModel = {
    val h = row.contract; val rt = row.runtime; val pkg = m.domain.packages(h.saga.ref.context); val stem = sym(h.id); val host = stem + "Host"
    val p = m.pipelines.find(_.id == h.entry.startOwner.ref.get.id).get
    val step = p.steps.find(_.id == h.entry.startOwner.stepId.get).get
    val op = step.operation.asInstanceOf[ExecutionSagaOperation]
    require(op.id == h.saga.ref.id && op.version == h.saga.version, "exact admitted pipeline invocation required")
    val execution = sym(p.id) + "Execution"; val n = sym(step.id)
    def field(r: QualifiedReference): ReferenceDeclaration = m.domain.layout.declarations.find(_.ref == r).get
    def tpe(t: NominalType): String = typeText(TypeResolverDSL.productType(t, m.domain.packages))
    def value(ref: ExecutionValueReference): String = ref match {
      case ExecutionValueReference.Input(id) => "state.inputs." + sym(id)
      case ExecutionValueReference.Step(step, output) => "state." + sym(step + "_" + output) + ".getOrElse(throw new IllegalArgumentException(\"unconfirmed predecessor output\"))"
      case _ => throw new IllegalArgumentException("explicit durable invocation reference required")
    }
    val trigger = rt.triggers.find(_.declaration.id == h.entry.triggerId).get.declaration
    val members = field(h.entry.inputType.asInstanceOf[NominalType.Named].ref).valueType.get.asInstanceOf[NominalType.Record].members
    val originalValues = members.map { r =>
      val arg = trigger.args.find(_.source == SagaValueSource.SourceField(r.id))
      val mapping = arg.flatMap(a => op.args.find(_.slot == a.slot)).orElse(if (r.id == trigger.idempotency.sourceSlot) Some(op.identity.source) else None)
      value(mapping.map(_.ref).getOrElse { require(p.inputs.exists(_.id == r.id), "complete original input lineage required"); ExecutionValueReference.Input(r.id) })
    }
    def textual(v: String, t: NominalType): String = t match {
      case NominalType.Named(r) => textual(v + ".value", field(r).valueType.get)
      case NominalType.Primitive("integer") => "java.lang.Long.toString(" + v + ")"
      case NominalType.Primitive("string") => v
      case _ => throw new IllegalArgumentException("exact textual or integer identity token required")
    }
    def token(r: ExecutionRead): String = {
      require(p.binding.types.exists(_._1 == r.valueType), "explicit identity binding required")
      val descriptor = rt.args.types.find(_.id == r.valueType)
      val types = m.domain.layout.declarations.filter(d => d.ref.context == h.saga.ref.context && d.ref.kind == "type" && d.ref.id == descriptor.map(_.canonicalType).getOrElse(r.valueType))
      require(types.size == 1, "one complete nominal identity type required")
      textual(value(r.ref), NominalType.Named(types.head.ref))
    }
    val parts = Vector(q("truthsrc-pipeline-invocation-v1"), q(h.saga.ref.context), q(op.id), q(op.version), q(p.id), q(p.recovery.planVersion), q(step.id), token(op.identity.source), token(op.identity.occurrence)) ++ Vector("iteration" -> op.identity.iteration, "chunk" -> op.identity.chunk).flatMap { case (label, v) => Vector(q(label), q(if (v.isDefined) "present" else "absent")) ++ v.map(token) }
    def originalArg(slot: String): String = trigger.args.find(_.slot == slot).get.source match { case SagaValueSource.SourceField(id) => "original." + sym(id); case _ => throw new IllegalArgumentException("original source required") }
    def resultValue(param: HostParameter): String = param.input match {
      case SagaValueSource.TransactionId => field(param.parameter).valueType.get match { case t: NominalType.Named => tpe(t) + "(identity.transactionId)"; case _ => "identity.transactionId" }
      case SagaValueSource.Args(slot) => originalArg(slot)
      case _ => throw new IllegalArgumentException("explicit receipt result adapter required")
    }
    var text = "package " + pkg + ".application\n\nimport akka.actor.typed.{ActorRef, Behavior}\nimport akka.actor.typed.scaladsl.Behaviors\nimport akka.persistence.typed.PersistenceId\nimport akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}\nimport com.google.protobuf.ByteString\nimport net.imadz.infra.saga.strict._\nimport scala.concurrent.{ExecutionContext, Future}\n\nobject " + host + " {\n"
    text += "  sealed trait Request\n  final case class Invoke(state: " + execution + ".State, replyTo: ActorRef[Reply]) extends Request\n  private final case class Observed(reply: StrictSagaCoordinator.Reply, replyTo: ActorRef[Reply]) extends Request\n  private final case class Delivered(kind: String, ok: Boolean, replyTo: ActorRef[Reply]) extends Request\n  sealed trait Reply\n  final case class Pending(reason: String) extends Reply\n  final case class Conflict(reason: String) extends Reply\n  final case class Completed(result: " + execution + "." + n + "Result) extends Reply\n  sealed trait Event\n  final case class Associated(original: ByteString, args: ByteString, operation: String) extends Event\n  final case class IdentityObserved(identity: TransactionIdentity) extends Event\n  final case class ResultIntent(kind: String) extends Event\n  final case class DeliveryAcknowledged(kind: String) extends Event\n  final case class State(original: ByteString = ByteString.EMPTY, args: ByteString = ByteString.EMPTY, operation: String = \"\", identity: Option[TransactionIdentity] = None, result: Option[String] = None, delivered: Boolean = false)\n"
    text += "  def originalInput(state: " + execution + ".State): " + tpe(h.entry.inputType) + " = " + tpe(h.entry.inputType) + originalValues.mkString("(", ", ", ")") + "\n  def invocationArgs(state: " + execution + ".State): " + tpe(h.argsType) + " = " + tpe(h.argsType) + rt.args.slots.map(a => value(op.args.find(_.slot == a.slot).get.ref)).mkString("(", ", ", ")") + "\n"
    text += "  def operationIdentity(state: " + execution + ".State): String = {\n    val buffer = new java.io.ByteArrayOutputStream\n    val out = new java.io.DataOutputStream(buffer)\n    val parts = Vector(" + parts.mkString(", ") + ")\n    parts.foreach { part => require(part != null && part.nonEmpty, \"durable identity token required\"); val bytes = part.getBytes(java.nio.charset.StandardCharsets.UTF_8); out.writeInt(bytes.length); out.write(bytes) }\n    out.flush()\n    \"sha256:\" + java.security.MessageDigest.getInstance(\"SHA-256\").digest(buffer.toByteArray).iterator.map(b => f\"${b & 0xff}%02x\").mkString\n  }\n"
    text += "  private val terminalResults = Set(\"succeeded\", \"rejected-before-effects\", \"compensated\")\n  private def classify(status: StrictState): Option[String] = status.status match {\n    case StrictStatus.Succeeded => Some(\"succeeded\")\n    case StrictStatus.Aborted => Some(if (status.evidence.values.exists { case Evidence.Confirmed(id, _) => id.phase == Phase.Prepare; case _ => false }) \"compensated\" else \"rejected-before-effects\")\n    case StrictStatus.RecoveryRequired => Some(if (status.evidence.values.exists(_.isInstanceOf[Evidence.Uncertain])) \"outcome-unknown\" else \"recovery-required\")\n    case _ => None\n  }\n  private def validStatus(state: State, status: StrictState): Boolean = status.argsBytes == state.args && status.identity.exists { identity =>\n    val digest = java.security.MessageDigest.getInstance(\"SHA-256\").digest(state.args.toByteArray).iterator.map(b => f\"${b & 0xff}%02x\").mkString\n    identity.transactionId == state.operation && identity.definitionName == " + q(rt.runtimeIdentity.name) + " && identity.definitionVersion == " + rt.runtimeIdentity.version + " && identity.definitionDigest == " + q(rt.definitionDigest) + " && identity.argsCodec == " + stem + "Definition.argsCodec.pin && identity.argsDigest == digest && state.identity.forall(_ == identity) && scala.util.Try(StrictSagaProtoConverters.stateToProto(status)).isSuccess\n  }\n"
    text += "  private def parent(state: State): " + execution + ".State = " + execution + ".codec.decode(state.original.toByteArray)\n  private def completed(state: State, kind: String): Reply = {\n    val identity = state.identity.get\n    val original = originalInput(parent(state))\n    kind match {\n"
    h.results.foreach { r =>
      val mapping = op.results.find(_.kind == r.kind.wire).get; val outcome = step.outcomes.find(_.code == mapping.code).get
      val values = if (outcome.action == "continue") step.writes.map { w =>
        val output = mapping.outputs.find(_.slot == w.slot).get.ref.asInstanceOf[ExecutionValueReference.Result].field
        resultValue(r.inputs.find(_.parameter.id == output).get)
      } else Vector.empty
      text += "      case " + q(r.kind.wire) + " => " + (if (Set("recovery-required", "outcome-unknown")(r.kind.wire)) "Pending(" + q(r.kind.wire) + ")" else "Completed(" + execution + "." + sym(step.id + "_" + mapping.code) + (if (outcome.action == "continue") values.mkString("(", ", ", ")") else "") + ")") + "\n"
    }
    text += "      case _ => Conflict(\"unmapped result kind\")\n    }\n  }\n  trait Delivery {\n"
    h.results.foreach(r => text += "    def " + sym(r.kind.wire) + "(destination: " + tpe(field(r.destination.resourceInput).valueType.get) + ", event: " + pkg + ".domain." + sym(r.event.owner.head) + "Protocol." + sym(r.event.id) + ", identity: TransactionIdentity): Future[Boolean]\n")
    text += "  }\n  def apply(persistenceId: String, coordinator: ActorRef[StrictSagaCoordinator.Command], delivery: Delivery): Behavior[Request] = Behaviors.setup { context =>\n    require(persistenceId != null && persistenceId.nonEmpty && coordinator != null && delivery != null, \"explicit owned pipeline invocation implementations required\")\n    implicit val ec: ExecutionContext = context.executionContext\n    def observe(state: State, replyTo: ActorRef[Reply]): Unit = {\n      val adapter = context.spawnAnonymous(Behaviors.receiveMessage[StrictSagaCoordinator.Reply] { reply => context.self ! Observed(reply, replyTo); Behaviors.stopped })\n      state.identity match { case Some(identity) => coordinator ! StrictSagaCoordinator.Attach(identity, adapter); case None => coordinator ! StrictSagaCoordinator.Start(state.operation, state.args, adapter) }\n    }\n    def deliver(state: State, kind: String, replyTo: ActorRef[Reply]): Unit = {\n      val original = originalInput(parent(state))\n      val identity = state.identity.get\n      val result = kind match {\n"
    h.results.foreach(r => text += "        case " + q(r.kind.wire) + " => delivery." + sym(r.kind.wire) + "(original." + sym(r.destination.resourceInput.id) + ", " + pkg + ".domain." + sym(r.event.owner.head) + "Protocol." + sym(r.event.id) + r.inputs.map(resultValue).mkString("(", ", ", ")") + ", identity)\n")
    text += "        case _ => Future.failed(new IllegalArgumentException(\"unmapped result kind\"))\n      }\n      context.pipeToSelf(result)(value => Delivered(kind, value.getOrElse(false), replyTo))\n    }\n    EventSourcedBehavior[Request, Event, State](PersistenceId.ofUniqueId(persistenceId), State(), (state, request) => request match {\n      case Invoke(input, replyTo) =>\n        val original = ByteString.copyFrom(" + execution + ".codec.encode(input))\n        val args = " + stem + "Definition.argsCodec.encode(invocationArgs(input))\n        val operation = operationIdentity(input)\n        if (state.operation.nonEmpty && (state.operation != operation || state.original != original || state.args != args)) Effect.none.thenRun((_: State) => replyTo ! Conflict(\"different complete parent input or args under existing invocation\"))\n        else if (state.delivered && state.result.exists(terminalResults)) Effect.none.thenRun((s: State) => replyTo ! completed(s, s.result.get))\n        else if (state.operation.nonEmpty) Effect.none.thenRun((s: State) => observe(s, replyTo))\n        else Effect.persist(Associated(original, args, operation)).thenRun((s: State) => observe(s, replyTo))\n      case Observed(StrictSagaCoordinator.Status(status), replyTo) if !validStatus(state, status) => Effect.none.thenRun((_: State) => replyTo ! Conflict(\"authoritative identity conflict\"))\n      case Observed(StrictSagaCoordinator.Status(status), replyTo) =>\n        val observed = classify(status)\n        val next = if (state.result.exists(terminalResults)) None else observed.filterNot(state.result.contains)\n        val events = (if (state.identity.isEmpty) Vector[Event](IdentityObserved(status.identity.get)) else Vector.empty) ++ next.map(ResultIntent).toVector\n        Effect.persist(events).thenRun { s: State => s.result match { case Some(kind) if !s.delivered => deliver(s, kind, replyTo); case Some(kind) => replyTo ! completed(s, kind); case None => replyTo ! Pending(\"awaiting authoritative result\") } }\n      case Observed(StrictSagaCoordinator.Denied(reason), replyTo) => Effect.none.thenRun((_: State) => replyTo ! Pending(reason))\n      case Observed(StrictSagaCoordinator.ConflictingIdentity, replyTo) => Effect.none.thenRun((_: State) => replyTo ! Conflict(\"coordinator identity conflict\"))\n      case Delivered(kind, true, replyTo) if state.result.contains(kind) => Effect.persist(DeliveryAcknowledged(kind)).thenRun((s: State) => replyTo ! completed(s, kind))\n      case Delivered(_, _, replyTo) => Effect.none.thenRun((_: State) => replyTo ! Pending(\"delivery unacknowledged\"))\n    }, (state, event) => event match {\n      case Associated(original, args, operation) => state.copy(original = original, args = args, operation = operation)\n      case IdentityObserved(identity) => state.copy(identity = Some(identity))\n      case ResultIntent(kind) => state.copy(result = Some(kind), delivered = false)\n      case DeliveryAcknowledged(_) => state.copy(delivered = true)\n    })\n  }\n}\n"
    text = ProductHostIOTemplate.wire(text, stem, "originalInput(parent(state))", "Pending", ProductHostIOTemplate.resourcePolicy(h).isDefined)
    ProductSourceModel(NamingConventions.productPackagePath(pkg, "application/" + stem + "Host.scala"), "// @generated by CodegenMain:semantic-products-application-1\n" + text, "invocation-host", Vector(h.source), m.footprint)
  }
}
