import { n, q, types, resultPayload } from './syntax.mjs';
import { sagaIdentityTemplate } from './saga-identity.mjs';
import { sagaPhasesTemplate } from './saga-phases.mjs';

export function sagaTemplate(m, out) {
  const t = types(m), cls = n(m.symbols.saga), codecs = n(m.symbols.codecs), req = n(m.request);
  out.append(`package ${m.packages.glue}

import akka.actor.typed.{ActorRef, ActorSystem}
import akka.actor.typed.scaladsl.AskPattern._
import akka.persistence.typed.PersistenceId
import akka.util.Timeout
import com.google.protobuf.ByteString
import net.imadz.infra.saga.strict._
import ${m.packages.kernel}._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

`, m.sources);
  sagaIdentityTemplate(m, out);
  out.append(`final class ${cls}(system: ActorSystem[_], namespace: String, ports: ${t.applicationPorts},
    settings: ${t.settings})(implicit ec: ExecutionContext) extends ${t.facade} {
  import ${cls}._
  require(namespace.nonEmpty)
  private implicit val scheduler: akka.actor.typed.Scheduler = system.scheduler
  private implicit val timeout: Timeout = Timeout(settings.interactionTimeout + scala.concurrent.duration.DurationInt(1).second)
  private val actors = scala.collection.mutable.Map.empty[String, ActorRef[StrictSagaCoordinator.Command]]
`, m.sources);
  sagaPhasesTemplate(m, out);
  out.append(`  private val authorizer = new ReconcileAuthorizer {
    def authorize(id: TransactionIdentity, token: String): Either[String, String] = ports.recoveryAuthorization.authorize(kernel(id), token)
  }
  def actor(identity: ${t.identity}): ActorRef[StrictSagaCoordinator.Command] = actors.synchronized {
    actors.getOrElseUpdate(identity.transactionId.value, {
      require(actors.size < settings.maxTransactions, "transaction capacity exceeded")
      system.systemActorOf(StrictSagaCoordinator(PersistenceId.ofUniqueId(namespace + "/saga/" + identity.transactionId.value),
        definition, authorizer, StrictSagaCoordinator.Settings(settings.interactionTimeout, settings.maxReconcileInteractions)),
        "saga-" + ${codecs}.digest((namespace + identity.transactionId.value).getBytes("UTF-8").toVector))
    })
  }
  def association(item: ${t.item}): Future[${t.association}] = ports.associations.query(item).map { found =>
    val value = found.getOrElse(throw new IllegalArgumentException("durable association missing"))
    require(value.item == item && value == expected(item, value.request), "association identity/bytes mismatch"); value
  }
  def classify(a: ${t.association}, reply: StrictSagaCoordinator.Reply): ${t.sagaResult} = {
    require(a == expected(a.item, a.request), "original association mismatch")
    val state = reply match {
      case StrictSagaCoordinator.Status(s) => s
      case other => throw new IllegalArgumentException("Saga rejected or unavailable: " + other)
    }
    require(state.identity.contains(runtime(a.saga)) && state.argsBytes == argsCodec.encode(a.request), "Saga identity/args mismatch")
    val expectedDescriptors = Vector(${m.saga.participants.map(p => `(${q(p.stepId)}, ${q(p.participantId)}, a.request.${p.resourceField}.value)`).join(', ')})
    require(state.participants.map(p => (p.stepId, p.participantId, p.resource)) == expectedDescriptors &&
      state.participants.forall(p => p.phases == Phase.all && p.receiptCodecs == Vector(
        ReceiptCodecPin(Phase.Prepare, prepareCodec.pin), ReceiptCodecPin(Phase.Commit, commitCodec.pin),
        ReceiptCodecPin(Phase.Compensate, compensateCodec.pin))), "Saga participant/codec plan mismatch")
    state.evidence.foreach { case (id, evidence) =>
      require(evidence.identity == id && id.transaction == runtime(a.saga) &&
        state.participants.exists(p => state.operation(p, id.phase) == id), "Saga evidence identity mismatch")
      evidence match {
        case Evidence.Confirmed(_, bytes) => id.phase match {
${['prepare', 'commit', 'compensate'].map(phase => `          case Phase.${phase[0].toUpperCase() + phase.slice(1)} =>
            val receipt = ${phase}Codec.decode(bytes).get
            require(receipt.identity == kernel(id), "phase receipt identity mismatch")
            checked(ports.evidence.${phase}(kernel(id), receipt))`).join('\n')}
        }
        case Evidence.Absent(_, proof, true) => checked(ports.evidence.absence(kernel(id), proof))
        case _ => ()
      }
    }
    val payload = ${resultPayload(m, 'a.saga.transactionId', 'a.request')}
    state.status match {
      case StrictStatus.Succeeded =>
        require(state.commitDecision && !state.abortRequested && state.pending.isEmpty &&
          state.participants.forall(p => state.confirmed(state.operation(p, Phase.Prepare)) && state.confirmed(state.operation(p, Phase.Commit))),
          "unconfirmed terminal success")
        ${t.sagaResult}.Succeeded(payload)
      case StrictStatus.Aborted =>
        require(!state.commitDecision && state.abortRequested && state.pending.isEmpty && state.participants.forall { p =>
          val prepare = state.operation(p, Phase.Prepare)
          if (state.confirmed(prepare)) state.confirmed(state.operation(p, Phase.Compensate))
          else !state.evidence.contains(prepare) || state.safelyAbsent(prepare)
        }, "unconfirmed terminal abort")
        if (state.evidence.exists { case (id, _: Evidence.Confirmed) => id.phase == Phase.Prepare; case _ => false })
          ${t.sagaResult}.Compensated(payload)
        else ${t.sagaResult}.RejectedBeforeEffects(payload)
      case StrictStatus.RecoveryRequired => ${t.sagaResult}.RecoveryRequired(payload)
      case _ => ${t.sagaResult}.OutcomeUnknown(payload)
    }
  }
  def start(item: ${t.item}, request: ${req}): Future[${t.sagaResult}] = {
    val a = expected(item, request)
    ports.associations.ensure(a).flatMap { saved =>
      require(saved == a, "association ensure mismatch")
      actor(a.saga).ask[StrictSagaCoordinator.Reply](StrictSagaCoordinator.Start(a.saga.transactionId.value, argsCodec.encode(request), _))
        .map(classify(a, _))
    }
  }
  def query(item: ${t.item}): Future[${t.sagaResult}] = association(item).flatMap { a =>
    actor(a.saga).ask[StrictSagaCoordinator.Reply](StrictSagaCoordinator.Attach(runtime(a.saga), _)).map(classify(a, _))
  }
  def reconcile(item: ${t.item}, authorization: String, maxInteractions: Int): Future[${t.sagaResult}] = association(item).flatMap { a =>
    checked(ports.recoveryAuthorization.authorize(a.saga, authorization))
    require(maxInteractions > 0 && maxInteractions <= settings.maxReconcileInteractions, "invalid recovery budget")
    actor(a.saga).ask[StrictSagaCoordinator.Reply](StrictSagaCoordinator.Reconcile(runtime(a.saga), authorization, maxInteractions, _))
      .map(classify(a, _))
  }
  def publish(item: ${t.item}): Future[${t.resultObservation}] = publication(item, deliver = true)
  def queryPublished(item: ${t.item}): Future[${t.resultObservation}] = publication(item, deliver = false)
  private def publication(item: ${t.item}, deliver: Boolean): Future[${t.resultObservation}] = association(item).flatMap { a =>
    query(item).flatMap { result =>
      if (!result.terminal) Future.successful(${t.resultObservation}.Unknown("Saga is nonterminal"))
      else {
        val envelope = ${t.resultEnvelope}(a.resultKey, a.saga, result, ${codecs}.result.pin, ${codecs}.result.encode(result))
        def validate(observation: ${t.resultObservation}): ${t.resultObservation} = observation match {
          case ${t.resultObservation}.Confirmed(receipt) =>
            require(receipt.key == envelope.key && receipt.identity == envelope.identity && receipt.bytes == envelope.bytes,
              "result stable key/identity/bytes mismatch")
            checked(ports.evidence.result(envelope, receipt)); observation
          case _ => observation
        }
        if (!deliver) ports.results.query(envelope).map(validate)
        else ports.results.deliver(envelope).recover {
          case scala.util.control.NonFatal(e) => ${t.resultObservation}.Unknown(e.getMessage)
        }.flatMap {
          case _: ${t.resultObservation}.Unknown => ports.results.query(envelope).map(validate)
          case other => Future.successful(validate(other))
        }
      }
    }
  }
}
`, [m.symbols.saga.source, ...m.sources]);
}
