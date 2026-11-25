// Byte-exact emitter for the effect-face family (#44).
// Contract: the fixture input (the emission-complete form of the curated
// technical-input.json) must reproduce the six approved golden family
// artifacts under test/reference/curated/effect-face/v1/app/... byte-for-byte:
// per case (dispatch, ta), the durable execution plan, the effect host and the
// journal serializer — one effect-host shape, per-case knowledge.
// Provenance: handwritten-golden (ruling 2026-11-22). The goldens were curated
// by hand against the real strict runtime before any generator existed, so
// there is no classic tools/gen-*.mjs reference and none may be fabricated
// (one-generator program). Golden parity + double-run determinism + the
// negatives battery carry the acceptance.
// No golden bytes are embedded beyond the frozen emission LAYOUT shapes: every
// name, saga identity, step id, obligation id, artifact pin, converter call,
// proto coordinate, timing constant and reply/require/refusal message flows
// from the input contract (truthsrc.effect-face-input/v1); the file-head doc
// prose flows verbatim as contract data. Frozen layout shapes (each a
// hand-balanced break the golden shows, documented at its site):
//   - declaration rows wrap their second term at indent + 2/+4/+6 when the
//     one-row form exceeds 120 columns (Installed, checked, encode ladder)
//   - the identity parts render as the fixed five-row token table
//   - the observation decode ladder is the fixed 2-row form
import { renderGroupedValueImports } from '../../lib/derivation/value-object-package.mjs';
import { scalaDirPath, workflowSubpackageSlug } from '../../lib/layout/layout-strategy.mjs';

const basePkgOf = valuesPkg => valuesPkg.replace(/\.domain\.values$/, '');

const LINE_LIMIT = 120;

const assertWidth = (lines, label) => {
  for (const line of lines) {
    if (line.length > LINE_LIMIT && !line.startsWith('import ')) {
      throw new Error(label + ': emitted line exceeds ' + LINE_LIMIT + ' columns (' +
        line.length + '): ' + line.slice(0, 80));
    }
  }
  return lines;
};

const camel = kebab => kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const pascal = kebab => {
  const c = camel(kebab);
  return c.charAt(0).toUpperCase() + c.slice(1);
};

// R1 timing constants render as scala durations (100.millis / 5.seconds).
const duration = millis => {
  if (!Number.isInteger(millis) || millis <= 0) {
    throw new Error('timing must be a positive integer millisecond count: ' + millis);
  }
  return millis % 1000 === 0 ? (millis / 1000) + '.seconds' : millis + '.millis';
};

// Declaration row that wraps its second term at indent + tailCont when the
// one-row form exceeds the limit (the golden Installed/checked faces).
const wrapDef = (head, tail, tailCont) =>
  (head + tail).length <= LINE_LIMIT ? [head + tail]
    : [head, ' '.repeat(tailCont) + tail.trimStart()];

// ---------- fail-closed input validation ----------
function validate(input) {
  if (input.schemaVersion !== 'truthsrc.effect-face-input/v1') {
    throw new Error('unexpected input schema version: ' + input.schemaVersion);
  }
  if (!Array.isArray(input.cases) || input.cases.length !== 2) {
    throw new Error('the effect face carries exactly two cases (dispatch, ta)');
  }
  const symbol = value => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('unsafe symbol: ' + value);
  };
  const kebab = value => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) throw new Error('unsafe kebab id: ' + value);
  };
  for (const c of input.cases) {
    if (!/^[a-z][a-z0-9-]*$/.test(c.case)) throw new Error('unsafe case id: ' + c.case);
    for (const key of Object.keys(c.names)) {
      if (key === 'nameSources' || key === 'package') continue;
      symbol(c.names[key]);
    }
    if (!/^[a-z][a-z0-9_.]*$/.test(c.names.package)) throw new Error('unsafe package');
    const ex = c.execution;
    kebab(ex.stageId);
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(ex.planVersion)) throw new Error('unsafe plan version');
    if (!ex.executionStatePb.endsWith('ExecutionStatePB')) {
      throw new Error('the execution state PB must be the declared ExecutionStatePB face');
    }
    const inputFields = ex.inputs.map(f => f.name);
    for (const f of ex.inputs) symbol(f.name);
    if (new Set(inputFields).size !== inputFields.length) {
      throw new Error('duplicate execution input field in case ' + c.case);
    }
    if (ex.codecSlots.length !== ex.inputs.length + 1) {
      throw new Error('the codec carries one slot per durable input plus the output slot');
    }
    let outputSlot = null;
    for (const slot of ex.codecSlots) {
      symbol(slot.type);
      if (typeof slot.optional !== 'boolean') throw new Error('codec slot optionality required');
      if (slot.optional) {
        if (outputSlot) throw new Error('only the output codec slot is optional');
        outputSlot = slot;
        if (!inputFields.includes(slot.field) && slot.slot !== 'output0') {
          throw new Error('the optional codec slot is the output slot');
        }
      } else if (!inputFields.includes(slot.field)) {
        throw new Error('codec slot field must be a durable input: ' + slot.field);
      }
    }
    const cases = ex.resultCases;
    const success = cases.filter(rc => rc.slot);
    if (success.length !== 1) throw new Error('exactly one result case carries the output slot');
    symbol(success[0].slot);
    for (const rc of cases) symbol(rc.case);
    if (cases.length !== 4) throw new Error('the effect result folds over four cases');
    for (const rc of cases.filter(rc => rc.stageError)) {
      const parts = rc.stageError.split(':');
      if (parts.length !== 3 || !/^[a-z-]+$/.test(parts[0]) || !/^[A-Za-z]+$/.test(parts[1]) ||
        !/^[a-z-]+$/.test(parts[2])) {
        throw new Error('unsafe stage error tuple for case ' + rc.case);
      }
    }
    const eff = c.effect;
    kebab(eff.sagaId);
    if (eff.planVersionArtifact && eff.planVersionArtifact !== ex.planVersion) {
      throw new Error('the effect artifact version must match the execution plan version');
    }
    kebab(eff.hostId);
    if (eff.stepId !== ex.stageId) throw new Error('the effect step is the execution stage');
    symbol(eff.participantStep);
    if (!/^[a-z]+$/.test(eff.identityKeyNoun)) {
      throw new Error('the identity key noun is the doc-facing key word: ' + eff.identityKeyNoun);
    }
    if (!eff.identityKeySlot.startsWith('inputs.')) {
      throw new Error('the identity key slot composes from the durable inputs');
    }
    const keyField = eff.identityKeySlot.slice('inputs.'.length);
    if (keyField !== ex.inputs[0].name) {
      throw new Error('the identity key is the first durable input: ' + keyField);
    }
    for (const key of ['requestValue', 'operationValue', 'observationValue', 'reconcileValue']) symbol(eff[key]);
    const b = eff.bindings;
    if (b.declaredIds.length !== 3 || b.roles.length !== 3) {
      throw new Error('the obligation table carries exactly three bindings');
    }
    if (b.roles.join('|') !== 'execute|query|reconcile') {
      throw new Error('the effect binding roles are execute/query/reconcile');
    }
    for (const id of b.declaredIds) {
      if (!id.startsWith('bankwealth.')) throw new Error('declared ids live in the bankwealth namespace');
    }
    if (b.boundary !== 'handwritten-composition-root') {
      throw new Error('the composition root is the sanctioned binding boundary');
    }
    if (!Number.isInteger(eff.serializerIdentifier) || eff.serializerIdentifier < 744000 ||
      eff.serializerIdentifier > 744999) {
      throw new Error('effect serializer identifier is a judged 744xxx allocation');
    }
    if (!eff.eventPb.endsWith('EffectHostEventPB')) {
      throw new Error('the effect host event PB must be the declared EffectHostEventPB face');
    }
    if (eff.context !== 'bankwealth') throw new Error('the effect context is the bankwealth bound context');
    const docs = c.docs;
    for (const key of Object.keys(docs)) {
      const lines = docs[key];
      if (!Array.isArray(lines) || lines.length === 0 || !lines[0].startsWith('/**') ||
        !lines[lines.length - 1].trimEnd().endsWith('*/')) {
        throw new Error('doc block must be a golden-head comment array: ' + key);
      }
      for (const line of lines) {
        if (typeof line !== 'string' || line.length > LINE_LIMIT) {
          throw new Error('doc line must be text within the layout limit: ' + key);
        }
      }
    }
  }
  const shape = input.faceShape;
  const wires = shape.observationStatus.wires;
  if (wires.join('|') !== 'confirmed|rejected|failed|absent|unknown') {
    throw new Error('the observation status set is the frozen five wires');
  }
  const decisions = shape.reconcileDecisions;
  if (decisions.map(d => d.decision).join('|') !== 'Query|Retry' ||
    decisions.map(d => d.wire).join('|') !== 'query|retry') {
    throw new Error('the reconcile decisions are query + retry');
  }
  for (const key of ['initialMillis', 'factor', 'maxMillis', 'deadlineSeconds']) {
    if (!Number.isInteger(shape.retry[key]) || shape.retry[key] <= 0) {
      throw new Error('retry timing must be positive integers');
    }
  }
  if (shape.layout.columnLimit !== LINE_LIMIT) {
    throw new Error('the L1 layout contract is the ' + LINE_LIMIT + '-column discipline');
  }
  if (!/^[a-z0-9-]+$/.test(shape.serializerManifest)) {
    throw new Error('unsafe serializer manifest');
  }
  // The exact message inventory the shape consumes — every slot must be
  // present, nonempty text (fail-closed against a drifted contract).
  const requiredMessages = ['completeExternalInputRequired', 'stableIdentityRequired',
    'unknownObservationStatus', 'completeObservationRequired', 'fullResultAndEvidenceRequired',
    'authoritativeEvidenceRequired', 'unknownIsNotAResult', 'carriesNoRunFace', 'completeBindingsRequired',
    'identityMismatchFor', 'versionMismatchFor', 'conflictDifferentInput', 'outcomeUnknownPending',
    'optionalQueryObservationRequired', 'reconcileRetainsDurable', 'reconcileRequiresAuthority',
    'reconciliationNotAuthorized', 'effectHostEventRequired', 'exactManifestRequired',
    'exactPayloadVersionRequired', 'unknownEffectEventKind'];
  for (const key of requiredMessages) {
    if (typeof shape.messages[key] !== 'string' || shape.messages[key].length === 0) {
      throw new Error('message slot must be nonempty text: ' + key);
    }
  }
  const requiredExecutionMessages = ['unconfirmedPredecessorOutput', 'exactPlanVersionRequired',
    'missingDurableInput', 'exactEffectHostActorRequired', 'stageDeadlineExceeded',
    'ownedInvocationObserverStopped', 'explicitOwnedFiniteExecutionRequired', 'unknownStaticStep'];
  for (const key of requiredExecutionMessages) {
    if (typeof shape.executionMessages[key] !== 'string' || shape.executionMessages[key].length === 0) {
      throw new Error('execution message slot must be nonempty text: ' + key);
    }
  }
  const supply = input.supply;
  for (const key of Object.keys(supply)) {
    if (key === 'source') continue;
    if (key === 'serializationObject') { symbol(supply[key]); continue; }
    if (!/^[a-z][a-z0-9_.]*$/.test(supply[key])) throw new Error('unsafe supply coordinate: ' + supply[key]);
  }
}

// ---------- per-case emission model ----------
const caseModel = (input, c, shape) => {
  const converters = shape.serializationPackage + '.' + shape.serializationObject;
  const ex = c.execution;
  const success = ex.resultCases.find(rc => rc.slot);
  const refused = ex.resultCases.filter(rc => rc.stageError);
  const refusalByStatus = status => {
    let label = null;
    if (status === 'Rejected') label = 'Refused';
    else if (status === 'Failed') label = 'Unavailable';
    if (label === null) return null;
    const rc = refused.find(r => r.stageError.split(':')[1] === label);
    return rc ? { rc, stageError: rc.stageError.split(':') } : null;
  };
  const basePkg = basePkgOf(shape.domainValuesPackage);
  const flowSlug = workflowSubpackageSlug(c.effect.sagaId);
  return {
    c,
    basePkg,
    rootSeg: basePkg.split('.').pop(),
    flowSlug,
    connectorsPkg: basePkg + '.application.connectors',
    pkg: basePkg + '.infrastructure.connectors',
    executionPkg: basePkg + '.application.process.' + flowSlug,
    persistencePkg: basePkg + '.infrastructure.persistence',
    bootstrapPkg: basePkg + '.infrastructure.bootstrap',
    execution: c.names.executionClass,
    stateCodec: c.names.executionClass.replace(/Execution$/, 'StateCodec'),
    gateway: c.names.effectHostClass.replace(/(?:Effect)?Host$/, 'Gateway'),
    host: c.names.effectHostClass,
    bootstrap: c.names.effectHostClass.replace(/Host$/, 'Bootstrap'),
    serializer: c.names.serializerClass,
    ex,
    camelStage: camel(ex.stageId),
    pascalStage: pascal(ex.stageId),
    effect: c.effect,
    docs: c.docs,
    success,
    refusals: refused,
    refusalByStatus,
    converters,
  };
};

// ---------- <Case>Gateway.scala (pure application outbound gateway port) ----------
function emitGateway(cm) {
  const eff = cm.effect;
  const lines = [
    'package ' + cm.connectorsPkg,
    '',
    'import scala.concurrent.Future',
    '',
    ...renderGroupedValueImports(cm.basePkg, [eff.operationValue, eff.observationValue, eff.reconcileValue], 'application.connectors'),
    '',
    '/** Outbound external-effect gateway port for `' + cm.execution + '`. */',
    'trait ' + cm.gateway + ' {',
    '  def execute(input: ' + eff.operationValue + '): Future[' + eff.observationValue + ']',
    '  def query(input: ' + eff.operationValue + '): Future[Option[' + eff.observationValue + ']]',
    '  def reconcile(input: ' + eff.reconcileValue + '): Future[Boolean]',
    '}',
  ];
  return assertWidth(lines, cm.gateway).join('\n') + '\n';
}

// ---------- <Case>Execution.scala (pure integration stage contract) ----------
function emitExecution(cm, shape) {
  const { ex, pascalStage } = cm;
  const messages = shape.executionMessages;
  const successCase = cm.success;
  const stageFold = [];
  stageFold.push('    case ' + successCase.case + '(' + successCase.slot + ') => Right(state.copy(' +
    successCase.slot + ' = Some(' + successCase.slot + ')))');
  for (const rc of cm.refusals) {
    const [category, label, discipline] = rc.stageError.split(':');
    stageFold.push('    case ' + rc.case + ' => Left(StageError(StageId,',
      '        Some("' + label + '"), "' + category + '", "' + category + ':' + label + ':' +
      discipline + '"))');
  }
  const lines = [
    'package ' + cm.executionPkg,
    '',
    'import scala.concurrent.duration._',
    '',
    ...renderGroupedValueImports(cm.basePkg, values(cm), 'application.process.' + cm.flowSlug),
    'import net.imadz.monarch.StageError',
    '',
    ...cm.docs.execution,
    'object ' + cm.execution + ' {',
    '',
    '  final case class Inputs(' + ex.inputs.map(f => f.name + ': ' + f.type).join(', ') + ')',
    '',
    '  final case class ' + pascalStage + 'Request(' + ex.inputs.map(f => f.name + ': ' + f.type).join(', ') + ')',
    '',
    '  sealed trait ' + pascalStage + 'Result',
    ...ex.resultCases.map(rc => rc.slot
      ? '  final case class ' + rc.case + '(' + rc.slot + ': ' + ex.codecSlots.find(s => s.optional).type +
        ') extends ' + pascalStage + 'Result'
      : '  case object ' + rc.case + ' extends ' + pascalStage + 'Result'),
    '',
    '  final case class State(inputs: Inputs, ' + successCase.slot + ': Option[' +
      ex.codecSlots.find(s => s.optional).type + '] = None)',
    '',
    '  final case class Outputs(' + successCase.slot + ': ' + ex.codecSlots.find(s => s.optional).type + ')',
    '',
    '  /** Unconfirmed predecessor output is refused — never defaulted. */',
    '  def outputs(state: State): Either[StageError, Outputs] =',
    '    state.' + successCase.slot + '.map(Outputs(_)).toRight(',
    '      StageError(StageId, Some("UnconfirmedOutput"), "predecessor-output", "' +
      messages.unconfirmedPredecessorOutput + '"))',
    '',
    '  // ----------------------------------------------------------------- knowledge',
    '  val PlanVersion = "' + ex.planVersion + '"',
    '  val StageId = "' + ex.stageId + '"',
    '',
    '  /** Bounded retry of the pending-effect poll (R1): the host answers Pending',
    '    * while the effect stays unobserved; the bridge re-asks with exponential',
    '    * backoff inside the stage deadline — never an unbounded loop. */',
    '  val RetryInitial: FiniteDuration = ' + duration(shape.retry.initialMillis),
    '  val RetryFactor: Int = ' + shape.retry.factor,
    '  val RetryMax: FiniteDuration = ' + duration(shape.retry.maxMillis),
    '  val StageDeadline: FiniteDuration = ' + duration(shape.retry.deadlineSeconds * 1000),
    '',
    '  /** R1 bounded backoff schedule: attempt 0 waits RetryInitial, doubling per',
    '    * attempt and capped at RetryMax — the poll loop is finite by construction. */',
    '  def backoffMillis(attempt: Int): Long =',
    '    math.min(RetryMax.toMillis, math.round(RetryInitial.toMillis * math.pow(RetryFactor, attempt.toDouble)))',
    '',
    '  def foldResult(state: State, result: ' + pascalStage + 'Result): Either[StageError, State] = result match {',
    ...stageFold,
    '  }',
    '}',
  ];
  return assertWidth(lines, cm.execution).join('\n') + '\n';
}

// ---------- <Case>StateCodec.scala (persistence state & observation codec) ----------
function emitExecutionStateCodec(cm, shape) {
  const { ex, effect: eff } = cm;
  const messages = shape.executionMessages;
  const successCase = cm.success;
  const encodeRows = ex.codecSlots.filter(s => !s.optional).map(slot =>
    '        ' + slot.slot + ' = Some(' + shape.serializationObject + '.encode' + slot.type +
    'PO(state.inputs.' + slot.field + ')),');
  const decodeRows = ex.codecSlots.filter(s => !s.optional).map(slot =>
    '          ' + slot.field + ' = ' + shape.serializationObject + '.decode' + slot.type +
    'PO(durable(pb.' + slot.slot + ', "' + slot.slot + '")),');
  const lines = [
    'package ' + cm.persistencePkg,
    '',
    'import com.google.protobuf.ByteString',
    'import ' + cm.executionPkg + '.' + cm.execution,
    ...renderGroupedValueImports(cm.basePkg, [eff.observationValue], 'infrastructure.persistence'),
    'import ' + shape.serializationPackage + '.' + shape.serializationObject,
    'import ' + shape.monarchPersistencePackage + '.StateCodec',
    '',
    '/** Persistence-layer protobuf codecs for `' + cm.execution + '` and `' + cm.host + '`. */',
    'object ' + cm.stateCodec + ' {',
    '',
    '  val codec: StateCodec[' + cm.execution + '.State] = StateCodec[' + cm.execution + '.State](',
    '    state =>',
    '      ' + ex.executionStatePb + '(',
    '        planversion = ' + cm.execution + '.PlanVersion,',
    ...encodeRows,
    '        ' + ex.codecSlots.find(s => s.optional).slot + ' = state.' + successCase.slot + '.map(' +
      shape.serializationObject + '.encode' + ex.codecSlots.find(s => s.optional).type + 'PO),',
    '      ).toByteArray,',
    '    bytes => {',
    '      val pb = ' + ex.executionStatePb + '.parseFrom(bytes)',
    '      require(pb.planversion == ' + cm.execution + '.PlanVersion, "' + messages.exactPlanVersionRequired + '")',
    '      def durable[A](slot: Option[A], name: String): A =',
    '        slot.getOrElse(throw new IllegalArgumentException(s"' + messages.missingDurableInput + '"))',
    '      ' + cm.execution + '.State(',
    '        ' + cm.execution + '.Inputs(',
    ...decodeRows,
    '        ),',
    '        pb.' + ex.codecSlots.find(s => s.optional).slot + '.map(' + shape.serializationObject +
      '.decode' + ex.codecSlots.find(s => s.optional).type + 'PO),',
    '      )',
    '    },',
    '  )',
    '',
    '  def decodeObservation(bytes: ByteString): Option[' + eff.observationValue + '] =',
    '    if (bytes.isEmpty) None',
    '    else Some(' + shape.serializationObject + '.decode' + eff.observationValue + 'PO(',
    '      ' + shape.protoPackage + '.' + eff.observationValue + 'PO.parseFrom(bytes.toByteArray)))',
    '',
    '  def encodeObservation(value: ' + eff.observationValue + '): ByteString =',
    '    ' + shape.serializationObject + '.encode' + eff.observationValue + 'PO(value).toByteString',
    '}',
  ];
  return assertWidth(lines, cm.stateCodec).join('\n') + '\n';
}

const values = cm => {
  const types = cm.ex.inputs.map(f => f.type)
    .concat([cm.ex.codecSlots.find(s => s.optional).type]);
  return [...new Set(types)].filter(t => t !== 'String').sort();
};

// ---------- <Case>EffectHost.scala (pure integration semantics & protocol) ----------
function emitHost(cm, shape) {
  const eff = cm.effect;
  const m = shape.messages;
  const obligations = eff.bindings.declaredIds.map((id, i) => {
    const role = eff.bindings.roles[i];
    return '    ("' + id.split('.')[1] + '", "' + role + '", _.' + role + '),';
  });
  const statusObjects = shape.observationStatus.wires.map(wire =>
    '    case object ' + pascal(wire) + ' extends ObservationStatus { val wire = "' + wire + '" }');
  const statusAll = 'val all: Vector[ObservationStatus] = Vector(' +
    shape.observationStatus.wires.map(pascal).join(', ') + ')';
  const decisionObjects = shape.reconcileDecisions.map(d =>
    '    case object ' + d.decision + ' extends ReconcileDecision { val wire = "' + d.wire + '" }');
  const bindingsFields = [
    '    execute: EffectBinding[' + eff.operationValue + ', ' + eff.observationValue + '],',
    '    query: EffectBinding[' + eff.operationValue + ', Option[' + eff.observationValue + ']],',
    '    reconcile: EffectBinding[' + eff.reconcileValue + ', Boolean],',
  ];
  const installedMethods = [
    '    def execute(input: ' + eff.operationValue + '): Future[' + eff.observationValue +
      '] = bindings.execute.run(input)',
    '    def query(input: ' + eff.operationValue + '): Future[Option[' + eff.observationValue +
      ']] = bindings.query.run(input)',
    '    def reconcile(input: ' + eff.reconcileValue + '): Future[Boolean] = bindings.reconcile.run(input)',
  ];
  const identityParts = [
    '      "' + eff.context + '",',
    '      "' + eff.sagaId + '", "' + eff.bindings.implementationVersion + '",',
    '      "' + eff.hostId + '", "' + eff.bindings.implementationVersion + '",',
    '      "' + cm.ex.stageId + '", "' + eff.participantStep + '",',
    '      input.inputs.' + cm.ex.inputs[0].name + '.value,',
  ];
  const identityBody = [
    '    val parts = Vector(',
    ...identityParts,
    '    )',
    '    parts.foreach(part => require(part != null && part.nonEmpty, "' + m.stableIdentityRequired + '"))',
    '    val buffer = new java.io.ByteArrayOutputStream()',
    '    val out = new java.io.DataOutputStream(buffer)',
    '    parts.foreach { part =>',
    '      val bytes = part.getBytes(java.nio.charset.StandardCharsets.UTF_8)',
    '      out.writeInt(bytes.length)',
    '      out.write(bytes)',
    '    }',
    '    out.flush()',
    '    java.security.MessageDigest.getInstance("SHA-256").digest(buffer.toByteArray).map(b => f"${b & 0xff}%02x").mkString',
  ];
  const terminalBody = [
    ...wrapDef('  def terminalOutcome(observation: Option[' + eff.observationValue + ']):',
      ' Option[' + cm.execution + '.' + cm.pascalStage + 'Result] =', 6),
    '    observation.flatMap { value =>',
    '      statusOf(value) match {',
    '        case ObservationStatus.Confirmed =>',
    '            Some(' + cm.execution + '.' + cm.success.case + '(value.result.get.' + cm.success.slot + '))',
    '        case ObservationStatus.Rejected => Some(' + cm.execution + '.' +
      cm.refusalByStatus('Rejected').rc.case + ')',
    '        case ObservationStatus.Failed => Some(' + cm.execution + '.' +
      cm.refusalByStatus('Failed').rc.case + ')',
    '        case ObservationStatus.Absent | ObservationStatus.Unknown => None',
    '      }',
    '    }',
  ];
  const checkedBody = [
    ...wrapDef('  def checked(value: ' + eff.observationValue + ',',
      ' expected: ' + eff.operationValue + '): ' + eff.observationValue + ' = {', 6),
    '    require(value != null && value.operation == expected.operation && value.request == expected.request &&',
    '      value.result != null &&',
    '          value.evidence != null, "' + m.completeObservationRequired + '")',
    '    statusOf(value) match {',
    '      case ObservationStatus.Confirmed => require(value.result.nonEmpty &&',
    '          value.result.get != null && value.evidence.nonEmpty, "' + m.fullResultAndEvidenceRequired + '")',
    '      case ObservationStatus.Rejected | ObservationStatus.Failed | ObservationStatus.Absent =>',
    '          require(value.result.isEmpty && value.evidence.nonEmpty,',
    '              "' + m.authoritativeEvidenceRequired + '")',
    '      case ObservationStatus.Unknown => require(value.result.isEmpty, "' + m.unknownIsNotAResult + '")',
    '    }',
    '    value',
    '  }',
  ];
  const lines = [
    'package ' + cm.pkg,
    '',
    'import scala.concurrent.Future',
    '',
    'import akka.actor.typed.ActorRef',
    'import com.google.protobuf.ByteString',
    'import ' + cm.connectorsPkg + '.' + cm.gateway,
    'import ' + cm.executionPkg + '.' + cm.execution,
    ...renderGroupedValueImports(cm.basePkg, [eff.operationValue, eff.observationValue, eff.reconcileValue, eff.requestValue], 'infrastructure.connectors'),
    '',
    ...cm.docs.host,
    'object ' + cm.host + ' {',
    '',
    '  /** External observation status; `wire` is the domain value\'s spelling. */',
    '  sealed trait ObservationStatus { def wire: String }',
    '  object ObservationStatus {',
    ...statusObjects,
    '',
    '    ' + statusAll,
    '',
    '    def fromWire(wire: String): Option[ObservationStatus] = all.find(_.wire == wire)',
    '  }',
    '',
    '  /** Reconciliation decision; `wire` is the authorized-command spelling. */',
    '  sealed trait ReconcileDecision { def wire: String }',
    '  object ReconcileDecision {',
    ...decisionObjects,
    '',
    '    def fromWire(wire: String): Option[ReconcileDecision] =',
    '      Vector(' + shape.reconcileDecisions.map(d => d.decision).join(', ') + ').find(_.wire == wire)',
    '  }',
    '',
    '  /** Exact-binding record of one handwritten effect implementation: one face,',
    '    * no optional slots, a null face fails at construction. */',
    '  final case class EffectBinding[I, O](id: String, version: String, run: I => Future[O]) {',
    '    require(run != null, s"' + m.carriesNoRunFace + '")',
    '  }',
    '',
    '  final case class Bindings(',
    ...bindingsFields,
    '  )',
    '',
    '  /** The obligation table drives install-time exact-binding checks and the',
    '    * ownership evidence — written once, never per binding. */',
    '  private val obligations: Vector[(String, String, Bindings => EffectBinding[_, _])] = Vector(',
    ...obligations,
    '  )',
    '',
    '  private val ImplementationVersion = "' + eff.bindings.implementationVersion + '"',
    '  private val Artifact = "' + eff.bindings.artifact + '"',
    '',
    '  /** Static binding ownership per implementation: (id, role, artifact,',
    '    * version, boundary). Ownership is a static binding obligation, not proof',
    '    * of business authorization, replay or deployment. */',
    '  def bindingOwnership(bindings: Bindings): Vector[(String, String, String, String, String)] =',
    '    obligations.map { case (_, role, bound) =>',
    '      val b = bound(bindings)',
    '      (b.id, role, Artifact, ImplementationVersion, "' + eff.bindings.boundary + '")',
    '    }',
    '',
    '  def install(bindings: Bindings): Installed = {',
    '    require(bindings != null, "' + m.completeBindingsRequired + '")',
    '    for ((declaredId, role, bound) <- obligations) {',
    '      val b = bound(bindings)',
    '      require(b.id == "' + eff.context + '." + declaredId,',
    '          s"' + m.identityMismatchFor + ' $role: expected ' + eff.context + '.$declaredId, got ${b.id}")',
    '      require(b.version == ImplementationVersion, s"' + m.versionMismatchFor + ' $role")',
    '    }',
    '    new Installed(bindings)',
    '  }',
    '',
    ...wrapDef('  final class Installed private[' + cm.host + '] (private val bindings: Bindings)',
      ' extends ' + cm.gateway + ' {', 6),
    ...installedMethods,
    '  }',
    '',
    '  sealed trait Request',
    '  final case class Invoke(input: ' + cm.execution + '.State, replyTo: ActorRef[Reply]) extends Request',
    ...wrapDef('  final case class Reconcile(input: ' + cm.execution + '.State,',
      '      decision: ReconcileDecision, authorization: String, replyTo: ActorRef[Reply]) extends Request', 6),
    '  private[' + cm.rootSeg + '] final case class Observed(operation: String,',
    '      round: Long, value: Option[' + eff.observationValue + '], fromQuery: Boolean) extends Request',
    '  private[' + cm.rootSeg + '] final case class Authorized(operation: String,',
    '      round: Long, allowed: Boolean, decision: ReconcileDecision, authorization: String,',
    '      proof: ByteString) extends Request',
    '',
    '  sealed trait Reply',
    '  final case class Completed(result: ' + cm.execution + '.' + cm.pascalStage + 'Result) extends Reply',
    '  final case class Pending(reason: String) extends Reply',
    '  final case class Conflict(reason: String) extends Reply',
    '',
    '  sealed trait Event',
    '  final case class Intent(original: ByteString, operation: String) extends Event',
    '  final case class ObservationStored(value: ByteString) extends Event',
    '  final case class RetryAuthorized(authorization: String, evidence: ByteString) extends Event',
    '',
    '  final case class State(original: ByteString = ByteString.EMPTY,',
    '      operation: String = "", observation: ByteString = ByteString.EMPTY)',
    '',
    '  def request(input: ' + cm.execution + '.State): ' + eff.requestValue + ' =',
    '    ' + eff.requestValue + '(' + cm.ex.inputs.map(f => 'input.inputs.' + f.name).join(', ') + ')',
    '',
    '  /** Durable operation identity: scheme, saga and step tokens plus the',
    '    * ' + eff.identityKeyNoun + ' key, length-prefixed and SHA-256 digested. */',
    '  def operationIdentity(input: ' + cm.execution + '.State): String = {',
    '    require(input != null && input.inputs != null, "' + m.completeExternalInputRequired + '")',
    ...identityBody,
    '  }',
    '',
    '  def statusOf(value: ' + eff.observationValue + '): ObservationStatus =',
    '    ObservationStatus',
    '        .fromWire(value.status).getOrElse(throw new IllegalArgumentException("' +
      m.unknownObservationStatus + '"))',
    '',
    '  /** Full same-operation same-request observation with status-consistent',
    '    * evidence; anything else refuses. */',
    ...checkedBody,
    '',
    ...terminalBody,
    '',
    '  def isReconcileAuthorized(decision: ReconcileDecision, proof: Option[' + eff.observationValue + ']): Boolean =',
    '    (decision, proof) match {',
    '      case (ReconcileDecision.Retry, Some(value))',
    '          if statusOf(value) == ObservationStatus.Absent && value.evidence.nonEmpty => true',
    '      case (ReconcileDecision.Query, Some(value)) if statusOf(value) == ObservationStatus.Unknown => true',
    '      case _ => false',
    '    }',
    '',
    '  def applyEvent(state: State, event: Event): State = event match {',
    '    case Intent(original, op) => state.copy(original = original, operation = op)',
    '    case ObservationStored(value) => state.copy(observation = value)',
    '    case RetryAuthorized(_, _) => state.copy(observation = ByteString.EMPTY)',
    '  }',
    '}',
  ];
  return assertWidth(lines, cm.host).join('\n') + '\n';
}

// ---------- <Case>EffectBootstrap.scala (runtime persistence & actor assembly) ----------
function emitBootstrap(cm, shape) {
  const { ex, camelStage, pascalStage, effect: eff } = cm;
  const hostParam = camelStage + 'Host';
  const m = shape.messages;
  const messages = shape.executionMessages;
  const lines = [
    'package ' + cm.bootstrapPkg,
    '',
    'import scala.concurrent.{ExecutionContext, Future, Promise}',
    'import scala.concurrent.duration._',
    'import scala.util.control.NonFatal',
    '',
    'import akka.actor.typed.{ActorRef, Behavior, PostStop}',
    'import akka.actor.typed.scaladsl.Behaviors',
    'import akka.persistence.typed.{PersistenceId, RecoveryCompleted}',
    'import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}',
    'import com.google.protobuf.ByteString',
    'import ' + cm.pkg + '._',
    'import ' + cm.executionPkg + '.' + cm.execution,
    ...renderGroupedValueImports(cm.basePkg, [eff.operationValue, eff.reconcileValue], 'infrastructure.bootstrap'),
    'import ' + cm.persistencePkg + '.' + cm.stateCodec,
    'import net.imadz.monarch.StageFailedException',
    'import ' + shape.monarchPersistencePackage + '.{PersistentMonarch, RunObserver}',
    '',
    '/** Runtime persistence & actor assembly for `' + cm.host + '` and `' + cm.execution + '`. */',
    'object ' + cm.bootstrap + ' {',
    '',
    '  def install(' + hostParam + ': ActorRef[' + cm.host + '.Request]): Installed = {',
    '    require(' + hostParam + ' != null, "' + messages.exactEffectHostActorRequired + '")',
    '    new Installed(' + hostParam + ')',
    '  }',
    '',
    '  final class Installed private[' + cm.bootstrap + '] (',
    '    val ' + hostParam + ': ActorRef[' + cm.host + '.Request],',
    '  )',
    '',
    '  def hostBehavior(',
    '    persistenceId: String,',
    '    installed: ' + cm.host + '.Installed,',
    '  ): Behavior[' + cm.host + '.Request] =',
    '    Behaviors.setup { context =>',
    '      import ' + cm.host + '._',
    '      require(persistenceId != null && persistenceId.nonEmpty && installed != null,',
    '          "owned effect persistence and all installed callbacks required")',
    '      implicit val ec: ExecutionContext = context.executionContext',
    '',
    '      var pending = false',
    '      var round = 0L',
    '      var waiters = Vector.empty[ActorRef[Reply]]',
    '',
    '      def answer(value: Reply): Unit = { waiters.distinct.foreach(_ ! value); waiters = Vector.empty }',
    '',
    '      def safe[A](body: => Future[A]): Future[A] =',
    '        try { val future = body; require(future != null, "effect callback future required"); future }',
    '        catch { case NonFatal(e) => Future.failed(e) }',
    '',
    '      def terminal(state: State): Option[' + cm.execution + '.' + pascalStage + 'Result] =',
    '        terminalOutcome(' + cm.stateCodec + '.decodeObservation(state.observation))',
    '',
    '      def operation(state: State): ' + eff.operationValue + ' =',
    '        ' + eff.operationValue + '(state.operation,',
    '            request(' + cm.stateCodec + '.codec.decode(state.original.toByteArray)))',
    '',
    '      def execute(state: State): Unit = {',
    '        pending = true',
    '        round += 1',
    '        val current = round',
    '        val expected = operation(state)',
    '        context.log.debug("effect execute attempt {} for operation {}", current, state.operation)',
    '        context.pipeToSelf(safe(installed.execute(expected)).map(v => Some(checked(v, expected)))) {',
    '          case scala.util.Success(value) => Observed(state.operation, current, value, fromQuery = false)',
    '          case scala.util.Failure(_) => Observed(state.operation, current, None, fromQuery = false)',
    '        }',
    '      }',
    '',
    '      def query(state: State): Unit = {',
    '        pending = true',
    '        round += 1',
    '        val current = round',
    '        val expected = operation(state)',
    '        context.pipeToSelf(safe(installed.query(expected)).map { value =>',
    '          require(value != null, "' + m.optionalQueryObservationRequired + '")',
    '          value.map(v => checked(v, expected))',
    '        }) {',
    '          case scala.util.Success(value) => Observed(state.operation, current, value, fromQuery = true)',
    '          case scala.util.Failure(_) => Observed(state.operation, current, None, fromQuery = true)',
    '        }',
    '      }',
    '',
    '      def completed(state: State, fromQuery: Boolean): Unit = terminal(state) match {',
    '        case Some(value) => answer(Completed(value))',
    '        case None if !fromQuery => query(state)',
    '        case None => answer(Pending("' + m.outcomeUnknownPending + '"))',
    '      }',
    '',
    '      EventSourcedBehavior[Request, Event, State](',
    '        PersistenceId.ofUniqueId(persistenceId),',
    '        State(),',
    '        (state, command) => command match {',
    '          case Invoke(input, replyTo) =>',
    '            val original = ByteString.copyFrom(' + cm.stateCodec + '.codec.encode(input))',
    '            val op = operationIdentity(input)',
    '            if (state.operation.nonEmpty && (state.operation != op || state.original != original)) {',
    '              Effect.none.thenRun(_ => replyTo ! Conflict("' + m.conflictDifferentInput + '"))',
    '            } else {',
    '              waiters :+= replyTo',
    '              if (state.operation.isEmpty) Effect.persist(Intent(original, op)).thenRun(execute)',
    '              else terminal(state) match {',
    '                case Some(value) => Effect.none.thenRun(_ => answer(Completed(value)))',
    '                case None => if (!pending) query(state); Effect.none',
    '              }',
    '            }',
    '',
    '          case Observed(op,',
    '              observedRound, value, fromQuery) if pending && op == state.operation && observedRound == round =>',
    '            pending = false',
    '            val bytes = value.map(' + cm.stateCodec + '.encodeObservation).getOrElse(ByteString.EMPTY)',
    '            if (value.isDefined && bytes != state.observation) {',
    '              Effect.persist(ObservationStored(bytes)).thenRun(completed(_, fromQuery))',
    '            } else {',
    '              Effect.none.thenRun(completed(_, fromQuery))',
    '            }',
    '',
    '          case Reconcile(input, decision, authorization, replyTo) =>',
    '            val original = ByteString.copyFrom(' + cm.stateCodec + '.codec.encode(input))',
    '            val op = operationIdentity(input)',
    '            val proof = ' + cm.stateCodec + '.decodeObservation(state.observation)',
    '            val authorizedFor = isReconcileAuthorized(decision, proof)',
    '            if (state.operation != op || state.original != original) {',
    '              Effect.none.thenRun(_ => replyTo ! Conflict("' + m.reconcileRetainsDurable + '"))',
    '            } else if (pending ||',
    '                terminal(state).nonEmpty || authorization == null || authorization.isEmpty || !authorizedFor) {',
    '              Effect.none.thenRun(_ =>',
    '                  replyTo ! Pending("' + m.reconcileRequiresAuthority + '"))',
    '            } else {',
    '              waiters :+= replyTo',
    '              pending = true',
    '              round += 1',
    '              val current = round',
    '              val evidence = state.observation',
    '              context.pipeToSelf(safe(installed.reconcile(',
    '                ' + eff.reconcileValue + '(op, request(input), decision.wire, proof, authorization)))) {',
    '                case scala.util.Success(allowed) =>',
    '                  Authorized(op, current, allowed, decision, authorization, evidence)',
    '                case scala.util.Failure(_) =>',
    '                  Authorized(op, current, allowed = false, decision, authorization, evidence)',
    '              }',
    '              Effect.none',
    '            }',
    '',
    '          case Authorized(op,',
    '              observedRound, allowed, decision, authorization, proof) if pending &&',
    '                  op == state.operation && observedRound == round =>',
    '            pending = false',
    '            if (!allowed || proof != state.observation) {',
    '              context.log.debug("reconciliation denied for operation {}", state.operation)',
    '              Effect.none.thenRun(_ => answer(Pending("' + m.reconciliationNotAuthorized + '")))',
    '            } else if (decision == ReconcileDecision.Query) {',
    '              Effect.none.thenRun(query)',
    '            } else {',
    '              context.log.debug("retry authorized for operation {}", state.operation)',
    '              Effect.persist(RetryAuthorized(authorization, proof)).thenRun(execute)',
    '            }',
    '',
    '          case _ => Effect.none',
    '        },',
    '        (state, event) => applyEvent(state, event),',
    '      ).receiveSignal { case (state, RecoveryCompleted) if state.operation.nonEmpty &&',
    '          terminal(state).isEmpty => query(state) }',
    '    }',
    '',
    '  def executionBehavior(',
    '    persistenceId: String,',
    '    installed: Installed,',
    '    observer: RunObserver[' + cm.execution + '.State],',
    '  )(implicit ec: ExecutionContext): Behavior[PersistentMonarch.Command[' + cm.execution + '.State]] =',
    '    Behaviors.setup { context =>',
    '      import ' + cm.execution + '._',
    '      require(persistenceId != null && persistenceId.nonEmpty && installed != null && observer != null,',
    '        "' + messages.explicitOwnedFiniteExecutionRequired + '")',
    '',
    '      final case class EffectCall(state: State,',
    '          attempt: Int, deadline: Deadline, promise: Promise[' + pascalStage + 'Result])',
    '      val effectBridge = context.spawnAnonymous(Behaviors.setup[EffectCall] { bridgeContext =>',
    '        Behaviors.receiveMessage[EffectCall] { call =>',
    '          bridgeContext.spawnAnonymous(Behaviors.setup[' + cm.host + '.Reply] { replyContext =>',
    '            installed.' + hostParam + ' ! ' + cm.host + '.Invoke(call.state, replyContext.self)',
    '            Behaviors.receiveMessage[' + cm.host + '.Reply] {',
    '              case ' + cm.host + '.Completed(result) => call.promise.trySuccess(result); Behaviors.stopped',
    '              case ' + cm.host + '.Conflict(reason) =>',
    '                  call.promise.tryFailure(new IllegalArgumentException(reason)); Behaviors.stopped',
    '              case ' + cm.host + '.Pending(_) if call.deadline.isOverdue() =>',
    ...(wrapDef('                call.promise',
      '.tryFailure(new IllegalStateException("' + ex.stageId + ' ' + messages.stageDeadlineExceeded +
      '")); Behaviors.stopped', 14)),
    '              case ' + cm.host + '.Pending(_) =>',
    '                replyContext.scheduleOnce(backoffMillis(call.attempt).millis, bridgeContext.self,',
    '                  call.copy(attempt = call.attempt + 1))',
    '                Behaviors.same',
    '            }.receiveSignal { case (_, PostStop) =>',
    '              call.promise.tryFailure(new IllegalStateException("' + messages.ownedInvocationObserverStopped +
      '")); Behaviors.same',
    '            }',
    '          })',
    '          Behaviors.same',
    '        }',
    '      })',
    '',
    '      def invoke' + pascalStage + '(state: State): Future[' + pascalStage + 'Result] = {',
    '        val promise = Promise[' + pascalStage + 'Result]()',
    '        effectBridge ! EffectCall(state, attempt = 0, deadline = Deadline.now + StageDeadline, promise)',
    '        promise.future',
    '      }',
    '',
    '      val plan = Vector(StageId)',
    '      PersistentMonarch.behavior[String, State](',
    '        PersistenceId.ofUniqueId(persistenceId),',
    '        plan,',
    '        (step, state) => step match {',
    '          case StageId => invoke' + pascalStage + '(state).flatMap(r =>',
    '            foldResult(state, r).fold(err => Future.failed(StageFailedException(err)), Future.successful))',
    '          case _ => Future.failed(new IllegalArgumentException("' + messages.unknownStaticStep + '"))',
    '        },',
    '        ' + cm.stateCodec + '.codec,',
    '        identity[String],',
    '        None,',
    '        observer,',
    '      )',
    '    }',
    '}',
  ];
  return assertWidth(lines, cm.bootstrap).join('\n') + '\n';
}

// ---------- <Case>EffectHostSerializer.scala ----------
function emitSerializer(cm, shape) {
  const eff = cm.effect;
  const m = shape.messages;
  const pb = eff.eventPb;
  const lines = [
    'package ' + cm.persistencePkg,
    '',
    'import akka.serialization.SerializerWithStringManifest',
    'import ' + cm.pkg + '.' + cm.host,
    '',
    ...cm.docs.serializer,
    'final class ' + cm.serializer + ' extends SerializerWithStringManifest {',
    '  override val identifier: Int = ' + eff.serializerIdentifier,
    '',
    '  private val Manifest = "' + shape.serializerManifest + '"',
    '',
    '  override def manifest(value: AnyRef): String = {',
    '    require(value.isInstanceOf[' + cm.host + '.Event], "' + m.effectHostEventRequired + '")',
    '    Manifest',
    '  }',
    '',
    '  override def toBinary(value: AnyRef): Array[Byte] = {',
    '    manifest(value)',
    '    val event = value match {',
    '      case ' + cm.host + '.Intent(original, operation) =>',
    '        ' + pb + '(version = Manifest,',
    '            kind = "intent", original = original, operation = operation)',
    '      case ' + cm.host + '.ObservationStored(observation) =>',
    '        ' + pb + '(version = Manifest,',
    '            kind = "observation", observation = observation)',
    '      case ' + cm.host + '.RetryAuthorized(authorization, evidence) =>',
    '        ' + pb + '(version = Manifest,',
    '            kind = "retry", authorization = authorization, observation = evidence)',
    '    }',
    '    event.toByteArray',
    '  }',
    '',
    '  override def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = {',
    '    require(manifest == Manifest, "' + m.exactManifestRequired + '")',
    '    val event = ' + pb + '.parseFrom(bytes)',
    '    require(event.version == Manifest, "' + m.exactPayloadVersionRequired + '")',
    '    event.kind match {',
    '      case "intent" => ' + cm.host + '.Intent(event.original, event.operation)',
    '      case "observation" => ' + cm.host + '.ObservationStored(event.observation)',
    '      case "retry" => ' + cm.host + '.RetryAuthorized(event.authorization, event.observation)',
    '      case other => throw new IllegalArgumentException(s"' + m.unknownEffectEventKind + ' \\"$other\\"")',
    '    }',
    '  }',
    '}',
  ];
  return assertWidth(lines, cm.serializer).join('\n') + '\n';
}

// ---------- top-level ----------
function generate(input) {
  validate(input);
  const shape = { ...input.faceShape, ...input.supply };
  const files = {};
  for (const c of input.cases) {
    const cm = caseModel(input, c, shape);
    const appConnectorsRel = scalaDirPath(cm.connectorsPkg);
    const infraConnectorsRel = scalaDirPath(cm.pkg);
    const processRel = scalaDirPath(cm.executionPkg);
    const persistenceRel = scalaDirPath(cm.persistencePkg);
    const bootstrapRel = scalaDirPath(cm.bootstrapPkg);
    files[appConnectorsRel + '/' + cm.gateway + '.scala'] = emitGateway(cm);
    files[processRel + '/' + cm.execution + '.scala'] = emitExecution(cm, shape);
    files[persistenceRel + '/' + cm.stateCodec + '.scala'] = emitExecutionStateCodec(cm, shape);
    files[infraConnectorsRel + '/' + cm.host + '.scala'] = emitHost(cm, shape);
    files[bootstrapRel + '/' + cm.bootstrap + '.scala'] = emitBootstrap(cm, shape);
    files[persistenceRel + '/' + cm.serializer + '.scala'] = emitSerializer(cm, shape);
  }
  return files;
}

// ---------- negatives battery ----------
const NEGATIVES = [
  { name: 'schema version drift', mutate: i => { i.schemaVersion = 'truthsrc.other-input/v1'; }, expect: 'unexpected input schema version' },
  { name: 'case count not two', mutate: i => { i.cases.pop(); }, expect: 'exactly two cases' },
  { name: 'unsafe case id', mutate: i => { i.cases[0].case = 'Dispatch Case'; }, expect: 'unsafe case id' },
  { name: 'unsafe generated symbol', mutate: i => { i.cases[0].names.effectHostClass = 'Bad-Host'; }, expect: 'unsafe symbol' },
  { name: 'unsafe package', mutate: i => { i.cases[0].names.package = 'Example.App'; }, expect: 'unsafe package' },
  { name: 'execution state PB loses its face suffix', mutate: i => { i.cases[0].execution.executionStatePb = 'x.StatePB'; }, expect: 'ExecutionStatePB face' },
  { name: 'duplicate execution input', mutate: i => { i.cases[0].execution.inputs[1].name = i.cases[0].execution.inputs[0].name; }, expect: 'duplicate execution input' },
  { name: 'codec slot count drifts', mutate: i => { i.cases[0].execution.codecSlots.pop(); }, expect: 'one slot per durable input' },
  { name: 'two optional codec slots', mutate: i => { i.cases[0].execution.codecSlots[1].optional = true; }, expect: 'only the output codec slot is optional' },
  { name: 'required slot field outside the inputs', mutate: i => { i.cases[0].execution.codecSlots[0].field = 'phantom'; }, expect: 'must be a durable input' },
  { name: 'result cases are not four', mutate: i => { i.cases[0].execution.resultCases.pop(); }, expect: 'folds over four cases' },
  { name: 'two success slots', mutate: i => { i.cases[0].execution.resultCases[1].slot = i.cases[0].execution.resultCases[0].slot; }, expect: 'exactly one result case carries the output slot' },
  { name: 'stage error tuple loses its discipline', mutate: i => { i.cases[0].execution.resultCases[1].stageError = 'business-rejection:Refused'; }, expect: 'unsafe stage error tuple' },
  { name: 'effect step drifts from the execution stage', mutate: i => { i.cases[0].effect.stepId = 'other-stage'; }, expect: 'effect step is the execution stage' },
  { name: 'identity key leaves the durable inputs', mutate: i => { i.cases[0].effect.identityKeySlot = 'outputs.x'; }, expect: 'composes from the durable inputs' },
  { name: 'identity key is not the first durable input', mutate: i => { i.cases[0].effect.identityKeySlot = 'inputs.occurrence'; }, expect: 'identity key is the first durable input' },
  { name: 'unsafe value symbol', mutate: i => { i.cases[0].effect.requestValue = 'Bad Request'; }, expect: 'unsafe symbol' },
  { name: 'obligation table loses a binding', mutate: i => { i.cases[0].effect.bindings.declaredIds.pop(); }, expect: 'exactly three bindings' },
  { name: 'binding roles drift', mutate: i => { i.cases[0].effect.bindings.roles = ['execute', 'query', 'reconcile-x']; }, expect: 'execute/query/reconcile' },
  { name: 'declared ids leave the bankwealth namespace', mutate: i => { i.cases[0].effect.bindings.declaredIds[0] = 'global.X'; }, expect: 'bankwealth namespace' },
  { name: 'binding boundary drifts from the composition root', mutate: i => { i.cases[0].effect.bindings.boundary = 'container'; }, expect: 'sanctioned binding boundary' },
  { name: 'effect serializer identifier outside the judged band', mutate: i => { i.cases[0].effect.serializerIdentifier = 799999; }, expect: 'judged 744xxx allocation' },
  { name: 'effect event PB loses its face suffix', mutate: i => { i.cases[0].effect.eventPb = 'x.EventPB'; }, expect: 'EffectHostEventPB face' },
  { name: 'effect context leaves the bound context', mutate: i => { i.cases[0].effect.context = 'global'; }, expect: 'bankwealth bound context' },
  { name: 'doc block loses its comment head', mutate: i => { i.cases[0].docs.host[0] = 'prose'; }, expect: 'golden-head comment array' },
  { name: 'observation wires drift', mutate: i => { i.faceShape.observationStatus.wires[0] = 'ok'; }, expect: 'frozen five wires' },
  { name: 'reconcile decisions drift', mutate: i => { i.faceShape.reconcileDecisions.pop(); }, expect: 'query + retry' },
  { name: 'retry factor not positive', mutate: i => { i.faceShape.retry.factor = 0; }, expect: 'positive integers' },
  { name: 'layout drifts from the L1 discipline', mutate: i => { i.faceShape.layout.columnLimit = 100; }, expect: '120-column discipline' },
  { name: 'unsafe serializer manifest', mutate: i => { i.faceShape.serializerManifest = 'event v1'; }, expect: 'unsafe serializer manifest' },
  { name: 'message slot goes missing', mutate: i => { delete i.faceShape.messages.outcomeUnknownPending; }, expect: 'message slot must be nonempty text' },
  { name: 'execution message slot goes missing', mutate: i => { delete i.faceShape.executionMessages.unknownStaticStep; }, expect: 'message slot must be nonempty text' },
  { name: 'unsafe supply coordinate', mutate: i => { i.supply.protoPackage = 'Example.Infra'; }, expect: 'unsafe supply coordinate' },
];

function runNegatives(input) {
  const results = NEGATIVES.map(negative => {
    const mutated = JSON.parse(JSON.stringify(input));
    negative.mutate(mutated);
    try {
      generate(mutated);
      return { name: negative.name, rejected: false, expect: negative.expect };
    } catch (error) {
      const rejected = String(error.message).includes(negative.expect);
      return { name: negative.name, rejected, expect: negative.expect, message: String(error.message) };
    }
  });
  return {
    expected: results.length,
    rejected: results.filter(r => r.rejected).length,
    failures: results.filter(r => !r.rejected),
  };
}

// ---------- unified-emitter family registration (emitter-unification Phase 1) ----------
export const family = {
  id: 'effect-face',
  familyNumber: 44,
  inputSchema: 'truthsrc.effect-face-input/v1',
  goldenRoot: 'test/reference/curated/effect-face/v1',
  fixtureDir: 'test/fixtures/effect-face-v1',
  toolsRef: null,
  provenance: 'handwritten-golden',
  checkInput: validate,
  renderAll: generate,
  runNegatives,
};
