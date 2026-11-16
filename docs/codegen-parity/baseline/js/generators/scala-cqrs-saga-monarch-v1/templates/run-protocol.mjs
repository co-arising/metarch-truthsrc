import { n, q, fqn } from './syntax.mjs';

/** Business protocol only. In particular no successful checkpoint or operation bytes are invented here. */
export function runProtocolTemplate(run, out) {
  const record = (name, fields, sources, indent = '  ') => {
    out.append(`${indent}final case class ${name}(\n`, sources);
    fields.forEach((field, i) => out.append(`${indent}    ${field.identifier}: ${field.scalaType ?? fqn(field.typeModel)}${i + 1 < fields.length ? ',' : ''}\n`, field.sources ?? [field.source, field.typeSource]));
    out.append(`${indent})\n`, sources);
  };
  out.append(`\nobject ${n(run.protocol)} {\n`, [run.source, ...run.sources]);
  record('Input', run.inputs, [run.source]);
  record('Output', run.outputs.map(field => ({ ...field, sources: [field.source, field.typeSource, field.from.source] })), [run.source]);
  out.append(`  sealed trait Status
  object Status {
    case object Partial extends Status
    case object Completed extends Status
    case object Stopped extends Status
  }
  // A stopped business result may have only a confirmed prefix of writes.
  // Infrastructure/unknown leaf observations do not become Completed state.
  final case class State(
      runId: String,
      input: Input,
`, [run.source]);
  for (const write of run.writes) out.append(`      ${write.stateIdentifier}: Option[${fqn(write.typeModel)}],\n`, [write.source, write.typeSource]);
  out.append(`      status: Status,
      code: Option[String],
      stoppedStep: Option[String],
      reason: Option[String]) {
    require(runId != null && runId.nonEmpty && input != null && status != null)
    require(code != null && stoppedStep != null && reason != null)
    require((status == Status.Stopped) == code.isDefined)
    require(code.isDefined == stoppedStep.isDefined && code.isDefined == reason.isDefined)
  }
  object Steps {
`, [run.source]);
  for (const step of run.steps) out.append(`    val ${step.identifier}: String = ${q(step.id)}\n`, [step.source]);
  out.append('  }\n', [run.source]);
  for (const port of run.ports) {
    const steps = run.steps.filter(s => s.port === port.id);
    const fieldSources = (field, direction) => [field.source, field.typeSource,
      ...steps.flatMap(s => s[direction].filter(row => row.slot === field.slot).map(row => row.source))];
    out.append(`  object ${port.identifier} {\n`, [port.source, ...steps.map(s => s.source)]);
    record('Args', port.inputs.map(field => ({ ...field, sources: fieldSources(field, 'reads') })), [port.source], '    ');
    record('Values', port.outputs.map(field => ({ ...field, sources: fieldSources(field, 'writes') })), [port.source], '    ');
    out.append(`    sealed trait Outcome { def code: String; def kind: String }
    sealed trait TerminalOutcome extends Outcome
    sealed trait Continuing extends TerminalOutcome { def values: Values }
    sealed trait BusinessRejection extends TerminalOutcome { def reason: String }
    sealed trait NonSuccessObservation extends Outcome { def reason: String }
    object Outcome {
`, [port.source]);
    for (const outcome of port.outcomes) {
      const parent = outcome.carriesValues ? 'Continuing' : outcome.kind === 'business-rejection' ? 'BusinessRejection' : 'NonSuccessObservation';
      out.append(`      final case class ${outcome.identifier}(${outcome.carriesValues ? 'values: Values' : 'reason: String'}) extends ${parent} {
        val code: String = ${q(outcome.code)}
        val kind: String = ${q(outcome.kind)}
      }
`, [outcome.source, ...steps.flatMap(s => s.outcomes.filter(o => o.code === outcome.code).map(o => o.source))]);
    }
    out.append('    }\n', [port.source]);
    if (port.effect === 'pure') out.append(`    trait Leaf {
      def apply(args: Args): Future[Outcome]
    }
`, [port.source]);
    else out.append(`    // Constructed by the generated adapter from the original durable Run, never by the caller.
    final case class Request(runId: String, stepId: String, args: Args,
        operationId: String, effectKey: String, connectorId: String, connectorVersion: String,
        ledgerEpoch: String, requestCodecId: String, requestCodecVersion: String, requestBytes: Vector[Byte])
    final case class Evidence(request: Request, outcome: TerminalOutcome, bytes: Vector[Byte], proof: Vector[Byte])
    sealed trait Observation
    object Observation {
      final case class Confirmed(evidence: Evidence) extends Observation
      final case class Observed(outcome: NonSuccessObservation) extends Observation
      case object NotFound extends Observation
    }
    trait Leaf {
      def submit(request: Request): Future[Observation]
      def query(request: Request): Future[Observation]
      def validateEvidence(expected: Request, evidence: Evidence): Either[String, Unit]
    }
`, [port.source, ...run.operations.map(o => o.source), ...steps.map(s => s.idempotency.source)]);
    out.append('  }\n', [port.source]);
  }
  out.append('}\n', [run.source]);
}
