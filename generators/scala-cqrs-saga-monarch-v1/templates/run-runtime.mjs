import { n, q, fqn, vector } from './syntax.mjs';

export function runRuntimeTemplate(m, run, out) {
  const name = n(run.symbol), p = fqn(run.protocol), c = n(m.symbols.codecs), r = run.binding.run;
  const sources = [run.source, ...run.sources], leafName = port => {
    const index = run.ports.findIndex(candidate => candidate.id === port.id);
    if (index < 0) throw new Error('declared Run port is missing: ' + port.id);
    return 'leaf' + index;
  };
  const sourceValue = from => from.kind === 'input' ? 'state.input.' + from.identifier
    : `state.${from.identifier}.getOrElse(throw new IllegalArgumentException("missing confirmed read"))`;
  const args = step => `${step.portModel.identifier}.Args(${step.portModel.inputs.map(input => sourceValue(step.reads.find(read => read.slot === input.slot).from)).join(', ')})`;
  out.append(`
object ${name} {
  import ${p}._
  private val codecs = ${c}.${name}
  val semanticDigest: String = codecs.semanticDigest
  val definition: RunDefinition[String] = RunDefinition(${q(r.definitionId)}, ${q(r.definitionVersion)}, ${q(r.codecVersion)}, ${vector(run.steps.map(s => q(s.id)))})
  final case class Leaves(${run.ports.map(port => `${leafName(port)}: ${port.identifier}.Leaf`).join(', ')}) {
    require(${run.ports.map(port => `${leafName(port)} != null`).join(' && ')})
  }
  sealed trait Completion { def state: State }
  final case class Completed(state: State, output: Output) extends Completion
  final case class Stopped(state: State, stepId: String, code: String, reason: String) extends Completion
  private def attempt[A](body: => A): Either[String, A] = scala.util.Try(body).toEither.left.map(e => Option(e.getMessage).getOrElse(e.getClass.getName))
  def initial(runId: String, input: Input): State = codecs.initial(runId, input)
  def submission(runId: String, input: Input): RunSubmission = RunSubmission(runId, definition.id, definition.version,
    definition.codecVersion, ByteString.fromArray(codecs.state.encode(initial(runId, input)).toArray))
  def expected(submission: RunSubmission): RunProtocol.Identity = {
    require(submission.definitionId == definition.id && submission.definitionVersion == definition.version && submission.codecVersion == definition.codecVersion, "submission definition mismatch")
    val state = codecs.state.decode(submission.initialState.toArray.toVector).get
    require(state.runId == submission.runId && state == initial(state.runId, state.input), "original submission state mismatch")
    RunProtocol.Identity(submission.runId, definition.id, definition.version, definition.codecVersion,
      ${c}.digest(submission.initialState.toArray.toVector), definition.planDigest)
  }
  def completion(state: State): Completion = {
    codecs.state.encode(state)
    state.status match {
      case Status.Completed => Completed(state, Output(${run.outputs.map(o => sourceValue(o.from)).join(', ')}))
      case Status.Stopped => Stopped(state, state.stoppedStep.get, state.code.get, state.reason.get)
      case Status.Partial => throw new IllegalArgumentException("Run has no business completion")
    }
  }
  def validate(submission: RunSubmission, reply: RunProtocol.Reply): Either[String, Option[Completion]] = attempt {
    val wanted = expected(submission)
    val original = codecs.state.decode(submission.initialState.toArray.toVector).get
    reply match {
      case RunProtocol.Current(view) if view.identity.contains(wanted) && view.runId.contains(submission.runId) =>
        val state = view.lastState.map(bytes => codecs.state.decode(bytes.toArray.toVector).get)
        require(state.forall(s => s.runId == original.runId && s.input == original.input), "original Run input changed")
        require(view.completedCursors == definition.cursors.take(view.completedCursors.size) && view.completedCursors.size <= definition.cursors.size, "Run cursor prefix mismatch")
        if (view.status == RunProtocol.Status.Completed) {
          require(view.completedCursors == definition.cursors && view.awaiting.isEmpty, "incomplete terminal Run frontier")
          Some(completion(state.getOrElse(throw new IllegalArgumentException("completed Run missing state"))))
        } else if (view.status == RunProtocol.Status.Failed || view.status == RunProtocol.Status.RecoveryBlocked)
          throw new IllegalArgumentException(view.reason.getOrElse("Run not successful"))
        else None
      case _ => throw new IllegalArgumentException("six-field Run identity/unavailable mismatch")
    }
  }
  private val stateCodec: StateCodec[State] = StateCodec[State](s => codecs.state.encode(s).toArray,
    bytes => codecs.state.decode(bytes.toVector).get)
`, sources);
  for (const step of run.steps) {
    const pn = step.portModel.identifier;
    const prior = run.steps.filter(s => s.ordinal < step.ordinal).flatMap(s => s.writes).map(w => 'state.' + w.stateIdentifier + '.isDefined');
    const rest = run.steps.filter(s => s.ordinal >= step.ordinal).flatMap(s => s.writes).map(w => 'state.' + w.stateIdentifier + '.isEmpty');
    out.append(`  private def before${step.ordinal}(state: State): Unit = {
    codecs.state.encode(state)
    require(state.status == Status.Partial && ${[...prior, ...rest].join(' && ') || 'true'}, "unexpected Run step frontier")
  }
  private def apply${step.ordinal}(state: State, outcome: ${pn}.Outcome): State = {
    before${step.ordinal}(state)
    val next = outcome match {
`, [step.source, ...step.reads.map(r => r.source)]);
    for (const o of step.outcomes) {
      const result = o.stateEffect === 'write' ? `state.copy(${[...step.writes.map(w => `${w.stateIdentifier} = Some(value.values.${w.portIdentifier})`), 'status = Status.' + (step.ordinal === run.steps.length - 1 ? 'Completed' : 'Partial')].join(', ')})`
        : o.stateEffect === 'stop' ? `state.copy(status = Status.Stopped, code = Some(${q(o.code)}), stoppedStep = Some(${q(step.id)}), reason = Some(value.reason))`
        : 'throw new IllegalStateException(value.code + ": " + value.reason)';
      out.append(`      case value: ${pn}.Outcome.${o.identifier} => ${result}
`, [o.source, ...step.writes.map(w => w.source)]);
    }
    out.append(`    }
    codecs.state.encode(next); next
  }
`, [step.source]);
  }
  if (run.mode === 'versioned') {
    out.append(`  def interpret(stepId: String, state: State, leaves: Leaves)(implicit ec: ExecutionContext): Future[State] = {
    if (!definition.stepIds.contains(stepId)) Future.failed(new IllegalArgumentException("undeclared Run step"))
    else if (state.status == Status.Stopped) { codecs.state.encode(state); Future.successful(state) }
    else stepId match {
`, sources);
    for (const step of run.steps) out.append(`      case ${q(step.id)} =>
        Future { before${step.ordinal}(state); ${args(step)} }.flatMap(leaves.${leafName(step.portModel)}.apply).map(apply${step.ordinal}(state, _))
`, [step.source, ...step.reads.map(r => r.source)]);
    out.append(`      case _ => Future.failed(new IllegalArgumentException("undeclared Run step"))
    }
  }
  def behavior(id: PersistenceId, leaves: Leaves)(implicit ec: ExecutionContext): Behavior[PersistentMonarch.Command[State]] =
    PersistentMonarch.versionedBehavior(id, definition, (step: String, state: State) => interpret(step, state, leaves), stateCodec)
`, sources);
  } else {
    const step = run.steps[0], pn = step.portModel.identifier, op = run.operations[0];
    out.append(`  def buildRequest(state: State): ${pn}.Request = {
    require(state == initial(state.runId, state.input), "operation requires original initial Run state")
    val requestBytes = codecs.request.encode(state)
    val operationId = ${c}.identityDigest(Vector(definition.id.getBytes("UTF-8").toVector, state.runId.getBytes("UTF-8").toVector, ${q(step.id)}.getBytes("UTF-8").toVector))
    val effectKey = ${c}.identityDigest(Vector(definition.id.getBytes("UTF-8").toVector, state.runId.getBytes("UTF-8").toVector, ${q(step.id)}.getBytes("UTF-8").toVector,
      codecs.idempotencyKey.encode(${sourceValue(step.idempotency.from)})))
    ${pn}.Request(state.runId, ${q(step.id)}, ${args(step)}, operationId, effectKey,
      ${q(op.connectorId)}, ${q(op.connectorVersion)}, ${q(op.ledgerEpoch)}, ${q(op.requestCodec.id)}, ${q(op.requestCodec.version)}, requestBytes)
  }
  def operation(state: State): OperationProtocol.Request = {
    val r = buildRequest(state)
    OperationProtocol.Request(r.operationId, r.effectKey, r.stepId, r.connectorId, r.connectorVersion, r.ledgerEpoch,
      ByteString.fromArray(r.requestBytes.toArray))
  }
  private def original(request: OperationProtocol.Request): (State, ${pn}.Request) = {
    val state = codecs.request.decode(request.payload.toArray.toVector).get
    val expected = buildRequest(state)
    require(request == operation(state), "managed operation pins/bytes mismatch")
    state -> expected
  }
  final class Adapter(leaf: ${pn}.Leaf)(implicit ec: ExecutionContext) extends net.imadz.monarch.persistence.operation.ExternalOperationPort {
    require(leaf != null)
    val connectorId: String = ${q(op.connectorId)}
    val connectorVersion: String = ${q(op.connectorVersion)}
    private def terminal(request: OperationProtocol.Request, value: ${pn}.Evidence): OperationProtocol.Terminal = {
      val (_, expected) = original(request)
      require(value != null && value.request == expected && value.outcome != null, "leaf evidence original request mismatch")
      require(value.bytes == codecs.outcome.encode(value.outcome), "leaf outcome bytes mismatch")
      codecs.proofBytes(value.proof)
      leaf.validateEvidence(expected, value).fold(e => throw new IllegalArgumentException(e), _ => ())
      val evidence = OperationProtocol.Evidence(request.operationKey, request.fingerprint, request.ledgerEpoch, None, ByteString.fromArray(value.proof.toArray))
      val bytes = ByteString.fromArray(value.bytes.toArray)
      value.outcome match {
        case _: ${pn}.Continuing => OperationProtocol.Succeeded(bytes, evidence)
        case rejected: ${pn}.BusinessRejection => OperationProtocol.KnownFailed(rejected.code, rejected.reason, bytes, evidence)
      }
    }
    private def observe(request: OperationProtocol.Request, value: ${pn}.Observation): OperationProtocol.Observation = value match {
      case ${pn}.Observation.Confirmed(evidence) => OperationProtocol.Confirmed(terminal(request, evidence))
      case ${pn}.Observation.Observed(outcome) => OperationProtocol.Unknown(outcome.code + ": " + outcome.reason)
      case ${pn}.Observation.NotFound => OperationProtocol.Unknown("original external request not found; submission safety is unknown")
    }
    def submit(request: OperationProtocol.Request): Future[OperationProtocol.Observation] =
      Future(original(request)._2).flatMap(leaf.submit).map(observe(request, _))
    def query(request: OperationProtocol.Request, lastEvidence: Option[OperationProtocol.Evidence]): Future[OperationProtocol.Observation] =
      Future(original(request)._2).flatMap(leaf.query).map(observe(request, _))
    override def validateEvidence(request: OperationProtocol.Request, observation: OperationProtocol.WithEvidence): Either[String, Unit] = attempt {
      val (_, expected) = original(request)
      observation match {
        case OperationProtocol.Confirmed(value) =>
          val proof = value.evidence
          require(proof.operationKey == request.operationKey && proof.requestDigest == request.fingerprint && proof.ledgerEpoch == request.ledgerEpoch && proof.taskId.isEmpty, "operation evidence identity mismatch")
          val outcome = codecs.outcome.decode(value.result.toArray.toVector).get
          val rebuilt = terminal(request, ${pn}.Evidence(expected, outcome, value.result.toArray.toVector, proof.payload.toArray.toVector))
          require(rebuilt == value, "operation terminal kind/code/result mismatch")
        case _ => throw new IllegalArgumentException("only validated terminal leaf evidence is supported")
      }
    }
  }
  def interpret(stepId: String, state: State, scope: ManagedStageScope)(implicit ec: ExecutionContext): Future[State] = {
    require(stepId == ${q(step.id)}, "undeclared managed step"); before0(state)
    val request = operation(state)
    scope.awaitTerminal(request).map { terminal =>
      val proof = terminal.evidence
      require(proof.operationKey == request.operationKey && proof.requestDigest == request.fingerprint && proof.ledgerEpoch == request.ledgerEpoch && proof.taskId.isEmpty, "committed operation evidence identity mismatch")
      codecs.proofBytes(proof.payload.toArray.toVector)
      val outcome = codecs.outcome.decode(terminal.result.toArray.toVector).get
      require((terminal, outcome) match {
        case (_: OperationProtocol.Succeeded, _: ${pn}.Continuing) => true
        case (failed: OperationProtocol.KnownFailed, rejected: ${pn}.BusinessRejection) => failed.code == rejected.code && failed.detail == rejected.reason
        case _ => false
      }, "committed operation terminal kind/code mismatch")
      apply0(state, outcome)
    }
  }
  def behavior(id: PersistenceId, resolve: String => ActorRef[OperationProtocol.Command], settings: ManagedOperationSettings = ManagedOperationSettings())
      (implicit ec: ExecutionContext): Behavior[PersistentMonarch.Command[State]] =
    PersistentMonarch.managedBehavior(id, definition, (step: String, state: State, scope: ManagedStageScope) => interpret(step, state, scope),
      stateCodec, new ManagedOperations(resolve, settings))
`, sources);
  }
  out.append(`  /** One effective writer owns this namespace; cache bounds also bound actor identities. */
  final class Host(system: akka.actor.typed.ActorSystem[_], namespace: String, leaves: Leaves,
      maxRuns: Int = ${run.admission.maxConcurrentRuns}, queryTimeout: FiniteDuration = ${m.saga.coordinatorSettings.interactionTimeoutMs}.millis)(implicit ec: ExecutionContext) {
    require(system != null && namespace != null && namespace.nonEmpty && leaves != null)
    require(maxRuns > 0 && maxRuns <= ${run.admission.maxConcurrentRuns} && queryTimeout > Duration.Zero && queryTimeout <= ${m.saga.coordinatorSettings.interactionTimeoutMs}.millis, "host exceeds compiled bounds")
    private implicit val scheduler: akka.actor.typed.Scheduler = system.scheduler
    private val lock = new Object
    private val runs = scala.collection.mutable.Map.empty[String, (RunSubmission, ActorRef[RunProtocol.Request])]
    private def key(kind: String, id: String): String = ${c}.identityDigest(Vector(namespace, definition.id, kind, id).map(_.getBytes("UTF-8").toVector))
    private def pid(kind: String, id: String): PersistenceId = PersistenceId.ofUniqueId("typed-run-" + key(kind, id))
`, sources);
  if (run.mode === 'managed') out.append(`    private val adapter = new Adapter(leaves.leaf0)
    private val operationSettings = net.imadz.monarch.persistence.operation.OperationSettings.fromConfig(system.settings.config)
    private val operations = scala.collection.mutable.Map.empty[String, ActorRef[OperationProtocol.Command]]
    private def resolveOperation(id: String): ActorRef[OperationProtocol.Command] = lock.synchronized {
      operations.getOrElseUpdate(id, {
        require(operations.size < maxRuns, "operation host capacity reached")
        system.systemActorOf(net.imadz.monarch.persistence.operation.PersistentOperation.behavior(pid("operation", id), id, adapter, operationSettings), "op-" + key("operation", id))
      })
    }
`, sources);
  out.append(`    private def resolve(value: RunSubmission): ActorRef[RunProtocol.Request] = lock.synchronized {
      expected(value)
      runs.get(value.runId) match {
        case Some((prior, ref)) => require(prior == value, "original Run submission conflict"); ref
        case None =>
          require(runs.size < maxRuns, "Run host capacity reached")
          val ref = system.systemActorOf(behavior(pid("run", value.runId), ${run.mode === 'managed' ? 'resolveOperation _' : 'leaves'}), "run-" + key("run", value.runId)).narrow[RunProtocol.Request]
          runs.put(value.runId, value -> ref); ref
      }
    }
    private val activePort = RunSubmissionPort(resolve _, queryTimeout)
    val submissionPort: RunSubmissionPort = new RunSubmissionPort {
      def ensure(value: RunSubmission): Future[RunProtocol.Reply] = activePort.ensure(value)
      def query(value: RunSubmission): Future[RunProtocol.Reply] = {
        expected(value)
        val active = lock.synchronized { runs.get(value.runId) }
        active match {
          case Some((prior, _)) if prior == value => activePort.query(value)
          case Some(_) => Future.successful(RunProtocol.Rejected(value.runId, "original Run submission conflict"))
          case None => Future.successful(RunProtocol.Unavailable(Some(value.runId), "Run is not active; explicit original-identity reactivation required"))
        }
      }
    }
    def ensure(runId: String, input: Input): Future[Either[String, Option[Completion]]] = {
      val value = submission(runId, input); submissionPort.ensure(value).map(validate(value, _))
    }
    /** Explicit, finite activation of only the original Run and its derived operation. */
    def reconcile(runId: String, input: Input): Future[Either[String, Option[Completion]]] = {
      Future(submission(runId, input)).flatMap { value =>
        submissionPort.ensure(value).flatMap { reply =>
          validate(value, reply) match {
            case terminal @ Right(Some(_)) => Future.successful(terminal)
            case failed @ Left(_) => Future.successful(failed)
            case Right(None) =>
${run.mode === 'managed' ? `              import akka.actor.typed.scaladsl.AskPattern._
              implicit val timeout: akka.util.Timeout = akka.util.Timeout(queryTimeout)
              val request = operation(initial(runId, input))
              val view = reply.asInstanceOf[RunProtocol.Current].view
              require(view.status == RunProtocol.Status.Running || view.status == RunProtocol.Status.AwaitingOperation, "Run is not recoverable")
              require(view.awaiting.forall(a => a.cursor == definition.cursors.head && a.operationKey == request.operationKey &&
                a.requestDigest == request.fingerprint), "Run awaiting original operation mismatch")
              val ref = resolveOperation(request.operationKey)
              def checked(reply: OperationProtocol.Reply): OperationProtocol.View = reply match {
                case OperationProtocol.Current(current) if current.operationKey == request.operationKey &&
                    current.requestDigest.contains(request.fingerprint) && current.phase != OperationProtocol.Phase.RecoveryBlocked => current
                case _ => throw new IllegalArgumentException("original operation unavailable, rejected or mismatched")
              }
              ref.ask[OperationProtocol.Reply](OperationProtocol.Get(request.operationKey, _)).flatMap { observed =>
                val current = checked(observed)
                if (current.phase == OperationProtocol.Phase.Blocked)
                  ref.ask[OperationProtocol.Reply](OperationProtocol.Reconcile(request.operationKey, _)).map { reconciled => checked(reconciled); () }
                else Future.successful(())
              }.flatMap(_ => submissionPort.query(value).map(validate(value, _)))` : `              submissionPort.query(value).map(validate(value, _))`}
          }
        }
      }.recover { case scala.util.control.NonFatal(e) => Left(Option(e.getMessage).getOrElse(e.getClass.getName)) }
    }
    def query(runId: String, input: Input): Future[Either[String, Option[Completion]]] = {
      val value = submission(runId, input); submissionPort.query(value).map(validate(value, _))
    }
  }
}
`, sources);
}
