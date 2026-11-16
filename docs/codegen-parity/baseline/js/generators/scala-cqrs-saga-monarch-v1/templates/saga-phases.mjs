import { n, q, types } from './syntax.mjs';

/** Typed Strict bridges consume coordinator-persisted receipts, never guessed handles. */
export function sagaPhasesTemplate(m, out) {
  const t = types(m), req = n(m.request), [a, b] = m.saga.participants;
  out.append(`  private def checked[A](value: Either[String, A]): A = value.fold(e => throw new IllegalArgumentException(e), identity)
  private def outcome[A](expected: ${t.phaseIdentity}, value: ${t.participantObservation}[A],
      validate: A => Either[String, Unit]): PhaseOutcome[A] = {
    require(value.identity == expected, "participant observation identity mismatch")
    val id = OperationIdentity(runtime(expected.saga), expected.participantId, expected.resource.value, expected.stepId,
      expected.phase match {
        case ${t.phase}.Prepare => Phase.Prepare
        case ${t.phase}.Commit => Phase.Commit
        case ${t.phase}.Compensate => Phase.Compensate
      })
    value match {
      case ${t.participantObservation}.Confirmed(_, receipt) => checked(validate(receipt)); ConfirmedReceipt(id, receipt)
      case ${t.participantObservation}.SafeAbsent(_, proof) => checked(ports.evidence.absence(expected, proof)); NotExecuted(id, proof, safeToRetry = true)
      case ${t.participantObservation}.NotFound(_) => Unknown(id, "not found is not fenced absence")
      case ${t.participantObservation}.Unknown(_, reason) => Unknown(id, reason)
      case ${t.participantObservation}.Rejected(_, reason) => Rejected(id, reason)
    }
  }
  private def producer(r: OperationRequest[${req}], first: Boolean, phase: Phase): OperationIdentity =
    OperationIdentity(r.identity.transaction, if (first) ${q(a.participantId)} else ${q(b.participantId)},
      (if (first) r.args.${a.resourceField} else r.args.${b.resourceField}).value,
      if (first) ${q(a.stepId)} else ${q(b.stepId)}, phase)
  private def prepared(r: OperationRequest[${req}], first: Boolean): ${t.prepareReceipt} = {
    val id = producer(r, first, Phase.Prepare)
    val receipt = r.receipt(id, prepareCodec.pin, prepareCodec).get
    require(receipt.identity == kernel(id), "persisted prepare receipt identity mismatch")
    checked(ports.evidence.prepare(kernel(id), receipt)); receipt
  }
  private def committedFirst(r: OperationRequest[${req}]): ${t.commitReceipt} = {
    val id = producer(r, true, Phase.Commit)
    val receipt = r.receipt(id, commitCodec.pin, commitCodec).get
    require(receipt.identity == kernel(id), "persisted commit receipt identity mismatch")
    checked(ports.evidence.commit(kernel(id), receipt)); receipt
  }
  private def participant(first: Boolean, request: ${req}): StrictParticipant[${req}] = {
    val external = if (first) ports.warehouseA else ports.warehouseB
`, m.saga.participants.map(p => p.source));
  for (const phase of ['prepare', 'commit', 'compensate']) {
    const title = phase[0].toUpperCase() + phase.slice(1), receipt = t[phase + 'Receipt'];
    const argumentsText = phase === 'prepare' ? 'id, r.args, if (first) None else Some(prepared(r, true))' : phase === 'commit'
      ? 'id, r.args, prepared(r, true), prepared(r, false), if (first) None else Some(committedFirst(r))' : 'id, r.args, prepared(r, first)';
    out.append(`    val ${phase} = new PhasePort[${req}, ${receipt}] {
      val receiptCodec = ${phase}Codec
      val querySafety = QuerySafety.DeclaredReadOnly
      private def call(r: OperationRequest[${req}], query: Boolean): Future[PhaseOutcome[${receipt}]] = {
        val id = kernel(r.identity); val command = ${t[phase + 'Command']}(${argumentsText})
        (if (query) external.query${title}(command) else external.${phase}(command)).map { value =>
          outcome(id, value, (receipt: ${receipt}) => {
            if (receipt == null || receipt.identity != id) Left("receipt identity mismatch")
            else ${n(m.symbols.codecs)}.validate${title}Handle(receipt.identity, receipt.reservationId)
              .flatMap(_ => ports.evidence.${phase}(id, receipt))
          })
        }
      }
      def execute(r: OperationRequest[${req}]): Future[PhaseOutcome[${receipt}]] = call(r, false)
      def query(r: OperationRequest[${req}]): Future[PhaseOutcome[${receipt}]] = call(r, true)
    }
`, m.saga.participants.map(p => ({ document: p.source.document, pointer: p.source.pointer + '/phases/' + phase })));
  }
  out.append(`    StrictParticipant(if (first) ${q(a.stepId)} else ${q(b.stepId)}, if (first) ${q(a.participantId)} else ${q(b.participantId)},
      (if (first) request.${a.resourceField} else request.${b.resourceField}).value,
      Map(Phase.Prepare -> PhaseBinding(prepare), Phase.Commit -> PhaseBinding(commit), Phase.Compensate -> PhaseBinding(compensate)))
  }
  val definition: StrictSagaDefinition[${req}] = StrictSagaDefinition(DefinitionName, DefinitionVersion,
    DefinitionDigest, argsCodec, r => Vector(participant(true, r), participant(false, r)))
`, m.saga.participants.map(p => p.source));
}
