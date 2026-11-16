import { entry, packageFor, pathFor, typeName } from '../scala-cqrs-domain/naming.mjs';

const name = id => id.replaceAll('-', '_');
const quote = JSON.stringify;
export function renderEffectHosts({ products, options }, footprint) {
  const layout = products['reference-layout'];
  return products['effect-host-contract'].hosts.map(h => {
    const pkg = packageFor(h.pipeline.ref.context, options), host = name(h.id) + 'EffectHost', parent = name(h.pipeline.ref.id) + 'Execution';
    const pipeline = products['execution-contract'].pipelines.find(p => p.id === h.pipeline.ref.id), step = pipeline.steps.find(s => s.id === h.stepId);
    const request = typeName(h.requestType, options), result = typeName(h.resultType, options), operation = typeName(h.operationType, options), observation = typeName(h.observationType, options), reconcile = typeName(h.reconcileType, options);
    const converters = pkg + '.infrastructure.serialization.DomainConverters', observationId = h.observationType.ref.id;
    const read = ref => ref.startsWith('input:') ? 'input.inputs.' + ref.slice(6) : 'input.' + ref.slice(5).replaceAll(':', '_').replaceAll('-', '_') + '.getOrElse(throw new IllegalArgumentException("unconfirmed predecessor output"))';
    const textual = (value, type) => type.form === 'nominal' ? textual(value + '.value', layout.declarations.find(d => JSON.stringify(d.ref) === JSON.stringify(type.ref)).valueType) : value;
    const identity = [h.pipeline.ref.context, h.pipeline.ref.id, h.pipeline.version, h.id, h.version, h.stepId, h.port].map(quote).concat(textual('input.inputs.' + h.identity.input, h.identity.valueType)).join(', ');
    const rows = h.technicalPorts.map(p => [p, p.role === 'reconcile' ? reconcile : operation, p.role === 'execute' ? observation : p.role === 'query' ? 'Option[' + observation + ']' : 'Boolean']);
    const bindings = rows.map(([p, input, output]) => '    ' + p.role + ': Implementation[' + input + ', ' + output + ']').join(',\n');
    const checks = rows.map(([p]) => '    require(bindings.' + p.role + ' != null && bindings.' + p.role + '.id == ' + quote(p.implementation.id) + ' && bindings.' + p.role + '.version == ' + quote(p.implementation.version) + ' && bindings.' + p.role + '.run != null, ' + quote('missing exact effect implementation ' + p.port.ref.id) + ')').join('\n');
    const owners = h.technicalPorts.map(p => '(' + [p.port.ref.id, p.role, p.owner.ref.id, p.owner.version, p.implementation.id, p.implementation.version, 'handwritten-composition-root'].map(quote).join(', ') + ')').join(', ');
    const terminal = h.outcomes.filter(o => o.status !== 'unknown').map(o => '      case ' + quote(o.status) + ' => Some(' + parent + '.' + name(h.stepId + '_' + o.code) + (o.status === 'confirmed' ? '(' + step.writes.map(w => 'value.result.get.' + w.slot).join(', ') + ')' : '') + ')').join('\n');
    const content = `package ${pkg}.application

import akka.actor.typed.{ActorRef, Behavior}
import akka.actor.typed.scaladsl.Behaviors
import akka.persistence.typed.{PersistenceId, RecoveryCompleted}
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import com.google.protobuf.ByteString
import scala.concurrent.{ExecutionContext, Future}
import scala.util.{Failure, Success}
import scala.util.control.NonFatal

object ${host} {
  // Supply exact callbacks in the handwritten composition root; static ownership is not an authority certificate.
  val bindingOwnership = Vector(${owners})
  final case class Implementation[I, O](id: String, version: String, run: I => Future[O])
  final case class Bindings(
${bindings}
  )
  final class Installed private[${host}] (private val bindings: Bindings) {
    def execute(input: ${operation}): Future[${observation}] = bindings.execute.run(input)
    def query(input: ${operation}): Future[Option[${observation}]] = bindings.query.run(input)
    def reconcile(input: ${reconcile}): Future[Boolean] = bindings.reconcile.run(input)
  }
  def install(bindings: Bindings): Installed = {
    require(bindings != null, "complete effect callback objects required")
${checks}
    new Installed(bindings)
  }
  sealed trait Request
  final case class Invoke(input: ${parent}.State, replyTo: ActorRef[Reply]) extends Request
  final case class Reconcile(input: ${parent}.State, decision: String, authorization: String, replyTo: ActorRef[Reply]) extends Request
  private final case class Observed(operation: String, round: Long, value: Option[${observation}], query: Boolean) extends Request
  private final case class Authorized(operation: String, round: Long, allowed: Boolean, decision: String, authorization: String, proof: ByteString) extends Request
  sealed trait Reply
  final case class Pending(reason: String) extends Reply
  final case class Conflict(reason: String) extends Reply
  final case class Completed(result: ${parent}.${name(h.stepId)}Result) extends Reply
  sealed trait Event
  final case class Intent(original: ByteString, operation: String) extends Event
  final case class ObservationStored(value: ByteString) extends Event
  final case class RetryAuthorized(authorization: String, evidence: ByteString) extends Event
  final case class State(original: ByteString = ByteString.EMPTY, operation: String = "", observation: ByteString = ByteString.EMPTY)
  def request(input: ${parent}.State): ${request} = ${request}(${step.reads.map(r => read(r.ref)).join(', ')})
  def operationIdentity(input: ${parent}.State): String = {
    require(input != null && input.inputs != null, "complete durable external input required")
    val buffer = new java.io.ByteArrayOutputStream()
    val out = new java.io.DataOutputStream(buffer)
    Vector(${identity}).foreach { part =>
      require(part != null && part.nonEmpty, "stable initial external identity required")
      val bytes = part.getBytes(java.nio.charset.StandardCharsets.UTF_8)
      out.writeInt(bytes.length); out.write(bytes)
    }
    out.flush()
    java.security.MessageDigest.getInstance("SHA-256").digest(buffer.toByteArray).map(b => f"\${b & 0xff}%02x").mkString
  }
  private def decode(bytes: ByteString): Option[${observation}] = if (bytes.isEmpty) None else Some(${converters}.decode${observationId}PB(${pkg}.infrastructure.proto.${observationId}PB.parseFrom(bytes.toByteArray)))
  private def encode(value: ${observation}): ByteString = ${converters}.encode${observationId}PB(value).toByteString
  private def checked(value: ${observation}, expected: ${operation}): ${observation} = {
    require(value != null && value.operation == expected.operation && value.request == expected.request && value.result != null && value.evidence != null, "complete same-operation same-request effect observation required")
    value.status match {
      case "confirmed" => require(value.result.nonEmpty && value.result.get != null && value.evidence.nonEmpty, "full durable result and evidence required")
      case "rejected" | "failed" | "absent" => require(value.result.isEmpty && value.evidence.nonEmpty, "authoritative non-success or absent evidence required")
      case "unknown" => require(value.result.isEmpty, "unknown is not a result")
      case _ => throw new IllegalArgumentException("unknown external observation status")
    }
    value
  }
  private def terminal(state: State): Option[${parent}.${name(h.stepId)}Result] = decode(state.observation).flatMap { value => value.status match {
${terminal}
      case _ => None
    }
  }
  def apply(persistenceId: String, installed: Installed): Behavior[Request] = Behaviors.setup { context =>
    require(persistenceId != null && persistenceId.nonEmpty && installed != null, "owned effect persistence and all installed callbacks required")
    implicit val ec: ExecutionContext = context.executionContext
    var pending = false
    var round = 0L
    var waiters = Vector.empty[ActorRef[Reply]]
    def operation(state: State): ${operation} = ${operation}(state.operation, request(${parent}.codec.decode(state.original.toByteArray)))
    def answer(value: Reply): Unit = { waiters.distinct.foreach(_ ! value); waiters = Vector.empty }
    def safe[A](body: => Future[A]): Future[A] = try { val future = body; require(future != null, "effect callback future required"); future } catch { case NonFatal(e) => Future.failed(e) }
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
    def completed(state: State, fromQuery: Boolean): Unit = terminal(state) match {
      case Some(value) => answer(Completed(value))
      case None if !fromQuery => query(state)
      case None => answer(Pending("effect outcome remains unknown or absent; no implicit retry"))
    }
    EventSourcedBehavior[Request, Event, State](PersistenceId.ofUniqueId(persistenceId), State(),
      (state, command) => command match {
        case Invoke(input, replyTo) =>
          val original = ByteString.copyFrom(${parent}.codec.encode(input)); val op = operationIdentity(input)
          if (state.operation.nonEmpty && (state.operation != op || state.original != original)) Effect.none.thenRun((_: State) => replyTo ! Conflict("different complete original input under effect identity"))
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
          if (bytes != state.observation) Effect.persist(ObservationStored(bytes)).thenRun((s: State) => completed(s, fromQuery))
          else Effect.none.thenRun((s: State) => completed(s, fromQuery))
        case Reconcile(input, decision, authorization, replyTo) =>
          val original = ByteString.copyFrom(${parent}.codec.encode(input)); val op = operationIdentity(input); val proof = decode(state.observation)
          if (state.operation != op || state.original != original) Effect.none.thenRun((_: State) => replyTo ! Conflict("reconcile must retain exact durable original and operation"))
          else if (pending || terminal(state).nonEmpty || authorization == null || authorization.isEmpty || !Set("query", "retry")(decision) || (decision == "retry" && !proof.exists(v => v.status == "absent" && v.evidence.nonEmpty))) Effect.none.thenRun((_: State) => replyTo ! Pending("reconcile requires authority and durable absent evidence before retry"))
          else {
            waiters :+= replyTo; pending = true; round += 1; val current = round; val evidence = state.observation
            context.pipeToSelf(safe(installed.reconcile(${reconcile}(op, request(input), decision, proof, authorization)))) {
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
      }).receiveSignal { case (state, RecoveryCompleted) if state.operation.nonEmpty && terminal(state).isEmpty => query(state) }
  }
}
`;
    return entry(pathFor(pkg, 'application/' + host + '.scala'), content, 'effect-host', [h.source, ...h.provenance], footprint,
      [pathFor(pkg, 'application/' + parent + '.scala'), pathFor(pkg, 'infrastructure/serialization/DomainConverters.scala')]);
  });
}
