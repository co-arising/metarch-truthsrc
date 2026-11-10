import { n, types, q } from './syntax.mjs';
import { runProtocolTemplate } from './run-protocol.mjs';

/** Storage-independent, nominal business values and the frozen typed protocol. */
export function kernelTemplate(m, out) {
  const t = types(m), req = n(m.request), resource = n(m.field.resourceA.type), tx = n(m.transaction);
  out.append(`package ${m.packages.kernel}\n\nimport scala.concurrent.Future\n\n`, m.sources);
  // Match lib/saga/compile-pure.mjs string validation: [...value].length, not UTF-16 units.
  for (const v of m.values) out.append(v.storage === 'positive-int'
    ? `final case class ${n(v)}(value: Int) { require(value >= ${v.minimum} && value <= ${v.maximum}, "quantity outside positive Int domain") }\n`
    : `final case class ${n(v)}(value: String) { require(value != null && value.codePointCount(0, value.length) >= ${v.minLength} && value.codePointCount(0, value.length) <= ${v.maxLength}, "identity outside declared length bounds") }\n`, [v.source]);
  out.append(`final case class ${req}(\n`, [m.request.source]);
  m.request.fields.forEach((field, i) => out.append(`    ${field.identifier}: ${n(field.type)}${i < m.request.fields.length - 1 ? ',' : ''}\n`, [field.source]));
  out.append(`) { require(${m.field.resourceA.identifier} != ${m.field.resourceB.identifier}, "distinct resource identities required") }\n`, [m.request.source]);
  out.append(`final case class ${n(m.result)}(\n`, [m.result.source]);
  m.result.fields.forEach((f, i) => out.append(`    ${f.identifier}: ${f.role === 'transactionId' ? tx : req}${i < m.result.fields.length - 1 ? ',' : ''}\n`, [f.source]));
  out.append(`)\n\nfinal case class ${t.codecIdentity}(id: String, version: Int)
final case class ${t.identity}(transactionId: ${tx}, definitionName: String,
    definitionVersion: Int, argsDigest: String, definitionDigest: String,
    argsCodec: ${t.codecIdentity}, planDigest: String)
sealed trait ${t.phase}
object ${t.phase} {
  case object Prepare extends ${t.phase}
  case object Commit extends ${t.phase}
  case object Compensate extends ${t.phase}
}
final case class ${t.phaseIdentity}(saga: ${t.identity}, participantId: String, resource: ${resource},
    stepId: String, phase: ${t.phase})
final case class ${t.item}(jobId: String, sequence: Long, itemId: String) {
  require(jobId.nonEmpty && sequence >= 0 && itemId.nonEmpty)
}
final case class ${t.association}(item: ${t.item}, request: ${req}, saga: ${t.identity}, resultKey: String)

sealed trait ${t.sagaResult} { def payload: ${n(m.result)}; def terminal: Boolean }
object ${t.sagaResult} {
${m.serialization.results.map(r => `  final case class ${r.name}(payload: ${n(m.result)}) extends ${t.sagaResult} { val terminal = ${r.terminal} }`).join('\n')}
}
`, m.sources);
  for (const phase of ['prepare', 'commit', 'compensate']) out.append(`final case class ${t[phase + 'Receipt']}(identity: ${t.phaseIdentity}, reservationId: String, proof: String)\n`, m.sources);
  out.append(`final case class ${t.prepareCommand}(identity: ${t.phaseIdentity}, request: ${req}, priorPrepare: Option[${t.prepareReceipt}])
final case class ${t.commitCommand}(identity: ${t.phaseIdentity}, request: ${req},
    prepareA: ${t.prepareReceipt}, prepareB: ${t.prepareReceipt}, priorCommit: Option[${t.commitReceipt}])
final case class ${t.compensateCommand}(identity: ${t.phaseIdentity}, request: ${req}, prepared: ${t.prepareReceipt})
sealed trait ${t.participantObservation}[+A] { def identity: ${t.phaseIdentity} }
object ${t.participantObservation} {
  final case class Confirmed[A](identity: ${t.phaseIdentity}, receipt: A) extends ${t.participantObservation}[A]
  final case class SafeAbsent(identity: ${t.phaseIdentity}, proof: String) extends ${t.participantObservation}[Nothing]
  final case class NotFound(identity: ${t.phaseIdentity}) extends ${t.participantObservation}[Nothing]
  final case class Unknown(identity: ${t.phaseIdentity}, reason: String) extends ${t.participantObservation}[Nothing]
  final case class Rejected(identity: ${t.phaseIdentity}, reason: String) extends ${t.participantObservation}[Nothing]
}
trait ${n(m.ports.participant)} {
${['prepare', 'commit', 'compensate'].flatMap(phase => [phase, 'query' + phase[0].toUpperCase() + phase.slice(1)].map(method => `  def ${method}(command: ${t[phase + 'Command']}): Future[${t.participantObservation}[${t[phase + 'Receipt']}]]`)).join('\n')}
}
`, [m.ports.participant.source]);
  out.append(`trait ${n(m.ports.association)} {
  def ensure(value: ${t.association}): Future[${t.association}]
  def query(item: ${t.item}): Future[Option[${t.association}]]
}
`, [m.ports.association.source]);
  out.append(`final case class ${t.resultEnvelope}(key: String, identity: ${t.identity}, result: ${t.sagaResult}, codec: ${t.codecIdentity}, bytes: Vector[Byte])
final case class ${t.resultReceipt}(key: String, identity: ${t.identity}, bytes: Vector[Byte], proof: String)
final case class ${t.itemResult}(item: ${t.item}, result: ${t.sagaResult}, delivery: Option[${t.resultReceipt}])
final case class ${t.manifestResult}(items: Vector[${t.itemResult}])
sealed trait ${t.resultObservation}
object ${t.resultObservation} {
  final case class Confirmed(receipt: ${t.resultReceipt}) extends ${t.resultObservation}
  case object NotFound extends ${t.resultObservation}
  final case class Unknown(reason: String) extends ${t.resultObservation}
  final case class Conflict(reason: String) extends ${t.resultObservation}
}
trait ${n(m.ports.result)} {
  def deliver(envelope: ${t.resultEnvelope}): Future[${t.resultObservation}]
  def query(envelope: ${t.resultEnvelope}): Future[${t.resultObservation}]
}
`, [m.ports.result.source]);
  out.append(`trait ${n(m.ports.evidence)} {
${['prepare', 'commit', 'compensate'].map(phase => `  def ${phase}(expected: ${t.phaseIdentity}, receipt: ${t[phase + 'Receipt']}): Either[String, Unit]`).join('\n')}
  def absence(expected: ${t.phaseIdentity}, proof: String): Either[String, Unit]
  def result(expected: ${t.resultEnvelope}, receipt: ${t.resultReceipt}): Either[String, Unit]
  def release(operationKey: String, terminalDigest: String, proof: String): Either[String, Unit]
}
`, [m.ports.evidence.source]);
  out.append(`trait ${n(m.ports.executionEvidence)} {
  def certify(operationKey: String, terminalBytes: Vector[Byte]): String
}
`, [m.ports.executionEvidence.source]);
  out.append(`trait ${n(m.ports.recoveryAuthorization)} {
  def authorize(identity: ${t.identity}, token: String): Either[String, String]
}
`, [m.ports.recoveryAuthorization.source]);
  out.append(`final case class ${t.applicationPorts}(warehouseA: ${n(m.ports.participant)}, warehouseB: ${n(m.ports.participant)},
    associations: ${n(m.ports.association)}, results: ${n(m.ports.result)}, evidence: ${n(m.ports.evidence)},
    executionEvidence: ${n(m.ports.executionEvidence)}, recoveryAuthorization: ${n(m.ports.recoveryAuthorization)})
trait ${t.facade} {
  def start(item: ${t.item}, request: ${req}): Future[${t.sagaResult}]
  def query(item: ${t.item}): Future[${t.sagaResult}]
  def publish(item: ${t.item}): Future[${t.resultObservation}]
  def reconcile(item: ${t.item}, authorization: String, maxInteractions: Int): Future[${t.sagaResult}]
}
trait ${t.binaryCodec}[A] {
  def pin: ${t.codecIdentity}
  def encode(value: A): Vector[Byte]
  def decode(bytes: Vector[Byte]): scala.util.Try[A]
}
`, m.sources);
  for (const run of m.runs) runProtocolTemplate(run, out);
}
