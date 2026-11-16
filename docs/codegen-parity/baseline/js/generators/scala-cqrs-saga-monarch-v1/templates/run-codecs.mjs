import { n, q, fqn, resultPayload } from './syntax.mjs';

// Reuse the enclosing BinaryCodecs' private bounded Out/In and nominal codecs.
export function runCodecsTemplate(m, run, out) {
  const p = fqn(run.protocol), sources = [run.source, ...run.sources];
  const write = (type, value) => {
    if (type.fqn === m.request.fqn) return `requestOut(o, ${value})`;
    if (type.fqn === m.result.fqn) return `o.text(${value}.${m.result.transactionField}.value); requestOut(o, ${value}.${m.result.requestField})`;
    return `o.${type.storage === 'positive-int' ? 'int' : 'text'}(${value}.value)`;
  };
  const read = type => type.fqn === m.request.fqn ? 'requestIn(i)' : type.fqn === m.result.fqn
    ? resultPayload(m, n(m.transaction) + '(i.text())', 'requestIn(i)')
    : `${fqn(type)}(i.${type.storage === 'positive-int' ? 'int' : 'text'}())`;
  const recordOut = fields => fields.map(f => write(f.typeModel, 'v.' + f.identifier)).join('; ');
  const recordIn = fields => fields.map(f => read(f.typeModel)).join(', ');
  out.append(`
  object ${n(run.symbol)} {
    import ${p}._
    val semanticDigest: String = ${q(run.semanticDigest)}
    trait Codec[A] {
      def encode(value: A): Vector[Byte]
      def decode(bytes: Vector[Byte]): Try[A]
    }
    private def framed[A](id: String, version: String, role: String)(write: (Out, A) => Unit)(read: In => A): Codec[A] = new Codec[A] {
      def encode(value: A): Vector[Byte] = {
        val o = new Out; o.text(id); o.text(version); o.text(semanticDigest); o.text(role); write(o, value); o.bytes
      }
      def decode(bytes: Vector[Byte]): Try[A] = Try {
        val i = new In(bytes)
        require(i.text() == id && i.text() == version && i.text() == semanticDigest && i.text() == role, "Run codec/semantic pin mismatch")
        val value = read(i); i.done(); require(encode(value) == bytes, "noncanonical Run encoding"); value
      }
    }
    private def optionOut[A](o: Out, value: Option[A])(write: A => Unit): Unit = {
      require(value != null, "null option"); o.int(if (value.isDefined) 1 else 0); value.foreach(write)
    }
    private def optionIn[A](i: In)(read: => A): Option[A] = i.int() match {
      case 0 => None
      case 1 => Some(read)
      case _ => throw new IllegalArgumentException("invalid option tag")
    }
    private def inputOut(o: Out, v: Input): Unit = { ${recordOut(run.inputs)} }
    private def inputIn(i: In): Input = Input(${recordIn(run.inputs)})
    val input: Codec[Input] = framed[Input](${q(run.stateCodec.id)}, ${q(run.stateCodec.version)}, "input")(inputOut)(inputIn)
    def validateState(v: State): Unit = {
      require(v != null && v.runId != null && v.runId.nonEmpty && v.input != null, "missing original Run input")
      input.encode(v.input)
`, sources);
  for (const step of run.steps) {
    const flags = step.writes.map(w => 'v.' + w.stateIdentifier + '.isDefined');
    out.append(`      require(${step.writes.map(w => 'v.' + w.stateIdentifier + ' != null').join(' && ') || 'true'}, "null write option")
      require(${flags.length ? flags.map(f => `(${f} == ${flags[0]})`).join(' && ') : 'true'}, "partial step write set")
`, [step.source, ...step.writes.map(w => w.source)]);
  }
  const prefixFlags = run.steps.filter(s => s.writes.length).map(s => 'v.' + s.writes[0].stateIdentifier + '.isDefined');
  out.append(`      val prefix = Vector[Boolean](${prefixFlags.join(', ')})
      require(!prefix.dropWhile(b => b).contains(true), "non-prefix Run writes")
      require(v.status != Status.Completed || prefix.forall(b => b), "completed Run missing writes")
      require(v.code != null && v.stoppedStep != null && v.reason != null, "null stop metadata")
      require((v.status == Status.Stopped) == v.code.isDefined && v.code.isDefined == v.stoppedStep.isDefined && v.code.isDefined == v.reason.isDefined, "invalid stop metadata")
      if (v.status == Status.Stopped) require((v.stoppedStep.get, v.code.get) match {
`, sources);
  for (const step of run.steps) for (const o of step.outcomes.filter(o => o.stateEffect === 'stop')) {
    const prior = run.steps.filter(s => s.ordinal < step.ordinal).flatMap(s => s.writes).map(w => 'v.' + w.stateIdentifier + '.isDefined');
    const rest = run.steps.filter(s => s.ordinal >= step.ordinal).flatMap(s => s.writes).map(w => 'v.' + w.stateIdentifier + '.isEmpty');
    out.append(`        case (${q(step.id)}, ${q(o.code)}) => ${[...prior, ...rest].join(' && ') || 'true'}
`, [step.source, o.source]);
  }
  out.append(`        case _ => false
      }, "undeclared stop or invalid stopped prefix")
    }
    private def stateOut(o: Out, v: State): Unit = {
      validateState(v); o.text(v.runId); inputOut(o, v.input)
${run.writes.map(w => `      optionOut(o, v.${w.stateIdentifier}) { value => ${write(w.typeModel, 'value')} }`).join('\n')}
      o.int(v.status match { case Status.Partial => 0; case Status.Completed => 1; case Status.Stopped => 2 })
      optionOut(o, v.code)(o.text); optionOut(o, v.stoppedStep)(o.text); optionOut(o, v.reason)(o.text)
    }
    private def stateIn(i: In): State = {
      val value = State(i.text(), inputIn(i), ${run.writes.map(w => `optionIn(i)(${read(w.typeModel)})`).join(', ')}${run.writes.length ? ', ' : ''}
        i.int() match { case 0 => Status.Partial; case 1 => Status.Completed; case 2 => Status.Stopped; case _ => throw new IllegalArgumentException("invalid Run status") },
        optionIn(i)(i.text()), optionIn(i)(i.text()), optionIn(i)(i.text()))
      validateState(value); value
    }
    val state: Codec[State] = framed[State](${q(run.stateCodec.id)}, ${q(run.stateCodec.version)}, "state")(stateOut)(stateIn)
    val output: Codec[Output] = framed[Output](${q(run.stateCodec.id)}, ${q(run.stateCodec.version)}, "output")((o, v) => { ${recordOut(run.outputs)} })(i => Output(${recordIn(run.outputs)}))
    def initial(runId: String, value: Input): State = {
      val result = State(runId, value, ${run.writes.map(() => 'None').join(', ')}${run.writes.length ? ', ' : ''}Status.Partial, None, None, None)
      state.encode(result); result
    }
`, sources);
  if (run.mode === 'managed') {
    const op = run.operations[0], port = run.steps[0].portModel, pn = port.identifier;
    out.append(`    val idempotencyKey: Codec[${fqn(run.steps[0].idempotency.typeModel)}] = framed[${fqn(run.steps[0].idempotency.typeModel)}](${q(op.requestCodec.id)}, ${q(op.requestCodec.version)}, "idempotency-key")((o, v) => { ${write(run.steps[0].idempotency.typeModel, 'v')} })(i => ${read(run.steps[0].idempotency.typeModel)})
    // The request stores all original inputs, not merely the leaf's selected reads.
    val request: Codec[State] = framed[State](${q(op.requestCodec.id)}, ${q(op.requestCodec.version)}, "request")((o, v) => {
      require(v == initial(v.runId, v.input), "managed request must contain initial state"); stateOut(o, v)
    })(i => { val v = stateIn(i); require(v == initial(v.runId, v.input), "managed request not initial"); v })
    val outcome: Codec[${pn}.TerminalOutcome] = framed[${pn}.TerminalOutcome](${q(op.requestCodec.id)}, ${q(op.requestCodec.version)}, "terminal-outcome")((o, v) => v match {
`, sources);
    for (const outcome of port.outcomes.filter(o => o.carriesValues || o.kind === 'business-rejection')) out.append(`      case value: ${pn}.Outcome.${outcome.identifier} =>
        o.text(${q(outcome.code)}); ${outcome.carriesValues ? port.outputs.map(f => write(f.typeModel, 'value.values.' + f.identifier)).join('; ') : 'o.text(value.reason)'}
`, [outcome.source]);
    out.append(`    })(i => i.text() match {
`, sources);
    for (const outcome of port.outcomes.filter(o => o.carriesValues || o.kind === 'business-rejection')) out.append(`      case ${q(outcome.code)} => ${pn}.Outcome.${outcome.identifier}(${outcome.carriesValues ? `${pn}.Values(${recordIn(port.outputs)})` : 'i.text()'})
`, [outcome.source]);
    out.append(`      case _ => throw new IllegalArgumentException("undeclared terminal outcome")
    })
    def proofBytes(value: Vector[Byte]): Vector[Byte] = {
      require(value != null && value.nonEmpty && value.size <= MaxBytes, "empty/oversized leaf proof"); value
    }
`, sources);
  }
  out.append('  }\n', sources);
}
