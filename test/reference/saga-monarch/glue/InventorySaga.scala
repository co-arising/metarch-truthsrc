package reference.inventory.glue

import akka.actor.typed.{ActorRef, ActorSystem}
import akka.actor.typed.scaladsl.AskPattern._
import akka.persistence.typed.PersistenceId
import akka.util.Timeout
import com.google.protobuf.ByteString
import net.imadz.infra.saga.strict._
import reference.inventory.kernel._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

object InventorySaga {
  val DefinitionName = "inventory-reservation"
  val DefinitionVersion = 1
  // Semantics, not display names or a source-file position, define this version.
  val DefinitionDigest: String = "sha256:" + BinaryCodecs.digest(
    "inventory-reservation-v1:serial-prepare-a-b:commit-decision:serial-commit-a-b:reverse-confirmed-compensation:explicit-reconcile"
      .getBytes(java.nio.charset.StandardCharsets.UTF_8).toVector)
  def protobuf[A](codec: BinaryCodec[A]): PayloadCodec[A] = new PayloadCodec[A] {
    val pin = CodecPin(codec.pin.id, codec.pin.version)
    def encode(value: A): ByteString = ByteString.copyFrom(codec.encode(value).toArray)
    def decode(bytes: ByteString): Try[A] = codec.decode(bytes.toByteArray.toVector)
  }
  val argsCodec: PayloadCodec[ReservationRequest] = protobuf(BinaryCodecs.request)
  val prepareCodec: PayloadCodec[PrepareReceipt] = protobuf(BinaryCodecs.prepare)
  val commitCodec: PayloadCodec[CommitReceipt] = protobuf(BinaryCodecs.commit)
  val compensateCodec: PayloadCodec[CompensateReceipt] = protobuf(BinaryCodecs.compensate)
  def kernel(id: TransactionIdentity): SagaIdentity = SagaIdentity(TransactionId(id.transactionId), id.definitionName,
    id.definitionVersion, id.argsDigest, id.definitionDigest, CodecIdentity(id.argsCodec.id, id.argsCodec.version), id.planDigest)
  def runtime(id: SagaIdentity): TransactionIdentity = TransactionIdentity(id.transactionId.value, id.definitionName,
    id.definitionVersion, id.argsDigest, id.definitionDigest, CodecPin(id.argsCodec.id, id.argsCodec.version), id.planDigest)
  def kernel(id: OperationIdentity): PhaseIdentity = PhaseIdentity(kernel(id.transaction), id.participantId,
    Warehouse(id.resource), id.stepId, id.phase match {
      case Phase.Prepare => ReservationPhase.Prepare; case Phase.Commit => ReservationPhase.Commit
      case Phase.Compensate => ReservationPhase.Compensate
    })
  /** Public ABI plan digest uses the fixed Strict v2 length-framed protocol, not inaccessible engine state. */
  def expected(item: ItemIdentity, request: ReservationRequest): Association = {
    val buffer = new java.io.ByteArrayOutputStream; val out = new java.io.DataOutputStream(buffer)
    def text(v: String): Unit = { val b = v.getBytes(java.nio.charset.StandardCharsets.UTF_8); out.writeInt(b.length); out.write(b) }
    text("strict-saga-plan-v2"); out.writeInt(2)
    Vector(("reserve-a", "warehouse-a", request.warehouseA), ("reserve-b", "warehouse-b", request.warehouseB)).foreach {
      case (step, participant, resource) =>
        text(step); text(participant); text(resource.value); out.writeInt(3)
        Vector("prepare", "commit", "compensate").foreach(text); out.writeInt(3)
        Vector("prepare" -> prepareCodec.pin, "commit" -> commitCodec.pin, "compensate" -> compensateCodec.pin).foreach {
          case (phase, pin) => text(phase); text(pin.id); out.writeInt(pin.version)
        }
    }
    out.flush()
    val stable = BinaryCodecs.digest(BinaryCodecs.item.encode(item))
    val identity = SagaIdentity(TransactionId("inventory-tx/" + stable), DefinitionName, DefinitionVersion,
      BinaryCodecs.digest(BinaryCodecs.request.encode(request)), DefinitionDigest, BinaryCodecs.request.pin,
      "sha256:" + BinaryCodecs.digest(buffer.toByteArray.toVector))
    Association(item, request, identity, "inventory-result/" + stable)
  }
}

final class InventorySaga(system: ActorSystem[_], namespace: String, ports: ApplicationPorts,
    settings: ApplicationSettings)(implicit ec: ExecutionContext) extends ReservationFacade {
  import InventorySaga._
  private implicit val scheduler: akka.actor.typed.Scheduler = system.scheduler
  private implicit val timeout: Timeout = Timeout(settings.interactionTimeout + scala.concurrent.duration.DurationInt(1).second)
  private val actors = scala.collection.mutable.Map.empty[String, ActorRef[StrictSagaCoordinator.Command]]
  private def checked[A](v: Either[String, A]): A = v.fold(e => throw new IllegalArgumentException(e), identity)
  private def outcome[A](expected: PhaseIdentity, value: ParticipantObservation[A],
      validate: A => Either[String, Unit]): PhaseOutcome[A] = {
    require(value.identity == expected, "participant observation identity mismatch")
    val id = OperationIdentity(runtime(expected.saga), expected.participantId, expected.resource.value, expected.stepId,
      expected.phase match { case ReservationPhase.Prepare => Phase.Prepare; case ReservationPhase.Commit => Phase.Commit; case ReservationPhase.Compensate => Phase.Compensate })
    value match {
      case ParticipantObservation.Confirmed(_, receipt) => checked(validate(receipt)); ConfirmedReceipt(id, receipt)
      case ParticipantObservation.SafeAbsent(_, proof) => checked(ports.evidence.absence(expected, proof)); NotExecuted(id, proof, safeToRetry = true)
      case ParticipantObservation.NotFound(_) => Unknown(id, "not found is not fenced absence")
      case ParticipantObservation.Unknown(_, reason) => Unknown(id, reason)
      case ParticipantObservation.Rejected(_, reason) => Rejected(id, reason)
    }
  }
  private def producer(r: OperationRequest[ReservationRequest], a: Boolean, phase: Phase): OperationIdentity =
    OperationIdentity(r.identity.transaction, if (a) "warehouse-a" else "warehouse-b",
      (if (a) r.args.warehouseA else r.args.warehouseB).value, if (a) "reserve-a" else "reserve-b", phase)
  private def prepared(r: OperationRequest[ReservationRequest], a: Boolean): PrepareReceipt = {
    val id = producer(r, a, Phase.Prepare); val receipt = r.receipt(id, prepareCodec.pin, prepareCodec).get
    checked(ports.evidence.prepare(kernel(id), receipt)); receipt
  }
  private def committedA(r: OperationRequest[ReservationRequest]): CommitReceipt = {
    val id = producer(r, true, Phase.Commit); val receipt = r.receipt(id, commitCodec.pin, commitCodec).get
    checked(ports.evidence.commit(kernel(id), receipt)); receipt
  }
  private def participant(a: Boolean, request: ReservationRequest): StrictParticipant[ReservationRequest] = {
    val external = if (a) ports.warehouseA else ports.warehouseB
    val prepare = new PhasePort[ReservationRequest, PrepareReceipt] {
      val receiptCodec = prepareCodec; val querySafety = QuerySafety.DeclaredReadOnly
      private def call(r: OperationRequest[ReservationRequest], query: Boolean): Future[PhaseOutcome[PrepareReceipt]] = {
        val id = kernel(r.identity); val command = PrepareCommand(id, r.args, if (a) None else Some(prepared(r, true)))
        (if (query) external.queryPrepare(command) else external.prepare(command)).map(outcome(id, _, ports.evidence.prepare(id, _)))
      }
      def execute(r: OperationRequest[ReservationRequest]): Future[PhaseOutcome[PrepareReceipt]] = call(r, false)
      def query(r: OperationRequest[ReservationRequest]): Future[PhaseOutcome[PrepareReceipt]] = call(r, true)
    }
    val commit = new PhasePort[ReservationRequest, CommitReceipt] {
      val receiptCodec = commitCodec; val querySafety = QuerySafety.DeclaredReadOnly
      private def call(r: OperationRequest[ReservationRequest], query: Boolean): Future[PhaseOutcome[CommitReceipt]] = {
        val id = kernel(r.identity)
        val command = CommitCommand(id, r.args, prepared(r, true), prepared(r, false), if (a) None else Some(committedA(r)))
        (if (query) external.queryCommit(command) else external.commit(command)).map(outcome(id, _, ports.evidence.commit(id, _)))
      }
      def execute(r: OperationRequest[ReservationRequest]): Future[PhaseOutcome[CommitReceipt]] = call(r, false)
      def query(r: OperationRequest[ReservationRequest]): Future[PhaseOutcome[CommitReceipt]] = call(r, true)
    }
    val compensate = new PhasePort[ReservationRequest, CompensateReceipt] {
      val receiptCodec = compensateCodec; val querySafety = QuerySafety.DeclaredReadOnly
      private def call(r: OperationRequest[ReservationRequest], query: Boolean): Future[PhaseOutcome[CompensateReceipt]] = {
        val id = kernel(r.identity); val command = CompensateCommand(id, r.args, prepared(r, a))
        (if (query) external.queryCompensate(command) else external.compensate(command)).map(outcome(id, _, ports.evidence.compensate(id, _)))
      }
      def execute(r: OperationRequest[ReservationRequest]): Future[PhaseOutcome[CompensateReceipt]] = call(r, false)
      def query(r: OperationRequest[ReservationRequest]): Future[PhaseOutcome[CompensateReceipt]] = call(r, true)
    }
    StrictParticipant(if (a) "reserve-a" else "reserve-b", if (a) "warehouse-a" else "warehouse-b",
      (if (a) request.warehouseA else request.warehouseB).value,
      Map(Phase.Prepare -> PhaseBinding(prepare), Phase.Commit -> PhaseBinding(commit), Phase.Compensate -> PhaseBinding(compensate)))
  }
  val definition: StrictSagaDefinition[ReservationRequest] = StrictSagaDefinition(DefinitionName, DefinitionVersion,
    DefinitionDigest, argsCodec, r => Vector(participant(true, r), participant(false, r)))
  private val authorizer = new ReconcileAuthorizer {
    def authorize(id: TransactionIdentity, token: String): Either[String, String] = ports.recoveryAuthorization.authorize(kernel(id), token)
  }
  def actor(identity: SagaIdentity): ActorRef[StrictSagaCoordinator.Command] = actors.synchronized {
    actors.getOrElseUpdate(identity.transactionId.value, {
      require(actors.size < settings.maxTransactions, "transaction capacity exceeded")
      system.systemActorOf(StrictSagaCoordinator(PersistenceId.ofUniqueId(namespace + "/saga/" + identity.transactionId.value),
        definition, authorizer, StrictSagaCoordinator.Settings(settings.interactionTimeout, settings.maxReconcileInteractions)),
        "saga-" + BinaryCodecs.digest((namespace + identity.transactionId.value).getBytes("UTF-8").toVector))
    })
  }
  def association(item: ItemIdentity): Future[Association] = ports.associations.query(item).map { found =>
    val value = found.getOrElse(throw new IllegalArgumentException("durable association missing"))
    require(value.item == item && value == expected(item, value.request), "association identity/bytes mismatch"); value
  }
  def classify(a: Association, reply: StrictSagaCoordinator.Reply): SagaResult = {
    val state = reply match {
      case StrictSagaCoordinator.Status(s) => s
      case other => throw new IllegalArgumentException("Saga rejected or unavailable: " + other)
    }
    require(state.identity.contains(runtime(a.saga)) && state.argsBytes == argsCodec.encode(a.request), "Saga identity/args mismatch")
    val expectedDescriptors = Vector(("reserve-a", "warehouse-a", a.request.warehouseA.value),
      ("reserve-b", "warehouse-b", a.request.warehouseB.value))
    require(state.participants.map(p => (p.stepId, p.participantId, p.resource)) == expectedDescriptors &&
      state.participants.forall(p => p.phases == Phase.all && p.receiptCodecs == Vector(
        ReceiptCodecPin(Phase.Prepare, prepareCodec.pin), ReceiptCodecPin(Phase.Commit, commitCodec.pin),
        ReceiptCodecPin(Phase.Compensate, compensateCodec.pin))), "Saga participant/codec plan mismatch")
    state.evidence.foreach { case (id, evidence) =>
      require(evidence.identity == id && id.transaction == runtime(a.saga) &&
        state.participants.exists(p => state.operation(p, id.phase) == id), "Saga evidence identity mismatch")
      evidence match {
        case Evidence.Confirmed(_, bytes) => id.phase match {
          case Phase.Prepare => checked(ports.evidence.prepare(kernel(id), prepareCodec.decode(bytes).get))
          case Phase.Commit => checked(ports.evidence.commit(kernel(id), commitCodec.decode(bytes).get))
          case Phase.Compensate => checked(ports.evidence.compensate(kernel(id), compensateCodec.decode(bytes).get))
        }
        case Evidence.Absent(_, proof, true) => checked(ports.evidence.absence(kernel(id), proof))
        case _ => ()
      }
    }
    val p = ReservationResult(a.saga.transactionId, a.request)
    state.status match {
      case StrictStatus.Succeeded =>
        require(state.commitDecision && !state.abortRequested && state.pending.isEmpty &&
          state.participants.forall(p => state.confirmed(state.operation(p, Phase.Prepare)) && state.confirmed(state.operation(p, Phase.Commit))),
          "unconfirmed terminal success")
        SagaResult.Succeeded(p)
      case StrictStatus.Aborted =>
        require(!state.commitDecision && state.abortRequested && state.pending.isEmpty && state.participants.forall { p =>
          val prepare = state.operation(p, Phase.Prepare)
          if (state.confirmed(prepare)) state.confirmed(state.operation(p, Phase.Compensate))
          else !state.evidence.contains(prepare) || state.safelyAbsent(prepare)
        }, "unconfirmed terminal abort")
        if (state.evidence.exists { case (id, _: Evidence.Confirmed) => id.phase == Phase.Prepare; case _ => false }) SagaResult.Compensated(p)
        else SagaResult.RejectedBeforeEffects(p)
      case StrictStatus.RecoveryRequired => SagaResult.RecoveryRequired(p)
      case _ => SagaResult.OutcomeUnknown(p)
    }
  }
  def start(item: ItemIdentity, request: ReservationRequest): Future[SagaResult] = {
    val a = expected(item, request)
    ports.associations.ensure(a).flatMap { saved =>
      require(saved == a, "association ensure mismatch")
      actor(a.saga).ask[StrictSagaCoordinator.Reply](StrictSagaCoordinator.Start(a.saga.transactionId.value, argsCodec.encode(request), _))
        .map(classify(a, _))
    }
  }
  def query(item: ItemIdentity): Future[SagaResult] = association(item).flatMap { a =>
    actor(a.saga).ask[StrictSagaCoordinator.Reply](StrictSagaCoordinator.Attach(runtime(a.saga), _)).map(classify(a, _))
  }
  def reconcile(item: ItemIdentity, authorization: String, maxInteractions: Int): Future[SagaResult] = association(item).flatMap { a =>
    checked(ports.recoveryAuthorization.authorize(a.saga, authorization))
    require(maxInteractions > 0 && maxInteractions <= settings.maxReconcileInteractions, "invalid recovery budget")
    actor(a.saga).ask[StrictSagaCoordinator.Reply](StrictSagaCoordinator.Reconcile(runtime(a.saga), authorization, maxInteractions, _))
      .map(classify(a, _))
  }
  def publish(item: ItemIdentity): Future[ResultObservation] = publication(item, deliver = true)
  def queryPublished(item: ItemIdentity): Future[ResultObservation] = publication(item, deliver = false)
  private def publication(item: ItemIdentity, deliver: Boolean): Future[ResultObservation] = association(item).flatMap { a =>
    query(item).flatMap { result =>
      if (!result.terminal) Future.successful(ResultObservation.Unknown("Saga is nonterminal"))
      else {
        val envelope = ResultEnvelope(a.resultKey, a.saga, result, BinaryCodecs.result.pin, BinaryCodecs.result.encode(result))
        def validate(observation: ResultObservation): ResultObservation = observation match {
          case ResultObservation.Confirmed(receipt) =>
            require(receipt.key == envelope.key && receipt.identity == envelope.identity && receipt.bytes == envelope.bytes,
              "result stable key/identity/bytes mismatch")
            checked(ports.evidence.result(envelope, receipt)); observation
          case _ => observation
        }
        if (!deliver) ports.results.query(envelope).map(validate)
        else ports.results.deliver(envelope).recover { case scala.util.control.NonFatal(e) => ResultObservation.Unknown(e.getMessage) }.flatMap {
          case unknown: ResultObservation.Unknown => ports.results.query(envelope).map(validate)
          case other => Future.successful(validate(other))
        }
      }
    }
  }
}
