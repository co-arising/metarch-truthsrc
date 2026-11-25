// Byte-exact emitter for the pipeline-invocation-face family (#43).
// Contract: the fixture input (the emission-complete form of the curated
// technical-input.json) must reproduce the seven approved golden family
// artifacts under test/reference/curated/pipeline-invocation-face/v1/app/...
// byte-for-byte: the port surface, the host IO, the journal serializer, the
// execution plan, the port bindings, the invocation host and the strict-saga
// definition.
// Provenance: handwritten-golden (ruling 2026-11-22). The goldens were curated
// by hand against the real strict runtime before any generator existed, so
// there is no classic tools/gen-*.mjs reference and none may be fabricated
// (one-generator program). Golden parity + double-run determinism + the
// negatives battery carry the acceptance.
// No golden bytes are embedded beyond the frozen emission LAYOUT shapes: every
// name, saga identity, digest, wire token, participant, protocol command,
// codec pin, converter call, timing constant and reply/require/refusal message
// flows from the input contract (truthsrc.pipeline-invocation-face-input/v1);
// the file-head doc prose flows verbatim as contract data. Frozen layout
// shapes (each a hand-balanced break the golden shows, documented at its site):
//   - section headers right-fill dashes to a fixed width per file (81/80)
//   - declaration rows wrap the second term at indent + 2/+4 when the one-row
//     form exceeds 120 columns (bindings/ports faces)
//   - the ResultKind all/terminal packs break after the first item, then
//     greedy-fills rows at indent + 8
//   - the FQ codec ladders (encode/decode receipt PB) are fixed 3-row ladders
//   - the strict-participant rows ladder the args field when the row overflows
import {
  renderGroupedValueImports,
  renderValueWildcardImports,
} from '../../lib/derivation/value-object-package.mjs';
import { scalaDirPath, workflowSubpackageSlug } from '../../lib/layout/layout-strategy.mjs';

const allPhaseTypes = md => md.participants.flatMap(p => p.phases.flatMap(ph => [ph.inputType, ph.queryType, ph.receiptType]));
const allReceiptTypes = md => md.participants.flatMap(p => p.phases.map(ph => ph.receiptType));

const basePkgOf = valuesPkg => valuesPkg.replace(/\.domain\.values$/, '');

const LINE_LIMIT = 120;

const assertWidth = (lines, label) => {
  for (const line of lines) {
    if (line.length > LINE_LIMIT && !line.startsWith('import ') && /\s/.test(line.trim())) {
      throw new Error(label + ': emitted line exceeds ' + LINE_LIMIT + ' columns (' +
        line.length + '): ' + line.slice(0, 80));
    }
  }
  return lines;
};

const wrapParseFrom = (indent, varName, fqn, args = 'bytes') => {
  const one = `${indent}val ${varName} = ${fqn}.parseFrom(${args})`;
  if (one.length <= LINE_LIMIT) return [one];
  const two = `${indent}  ${fqn}.parseFrom(${args})`;
  if (two.length <= LINE_LIMIT) return [`${indent}val ${varName} =`, two];
  return [`${indent}val ${varName} =`, `${indent}  ${fqn}`, `${indent}    .parseFrom(${args})`];
};

const camel = kebab => kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const pascal = kebab => {
  const c = camel(kebab);
  return c.charAt(0).toUpperCase() + c.slice(1);
};
const lcFirst = s => s.charAt(0).toLowerCase() + s.slice(1);

// R1 timing constants render as scala durations (100.millis / 5.seconds).
const duration = millis => {
  if (!Number.isInteger(millis) || millis <= 0) {
    throw new Error('timing must be a positive integer millisecond count: ' + millis);
  }
  return millis % 1000 === 0 ? (millis / 1000) + '.seconds' : millis + '.millis';
};

// Section headers right-fill dashes to a fixed per-file width (golden shape).
const sectionHeader = (label, width) => {
  const base = '  // ---- ' + label + ' ';
  return base + '-'.repeat(width - base.length);
};

// Pack a list into one row when it fits; otherwise break after the first item
// and greedy-fill continuation rows at indent + 8 (golden all/terminal shape).
const packAfterFirst = (head, items, tail, cont) => {
  if ((head + items.join(', ') + tail).length <= LINE_LIMIT) {
    return [head + items.join(', ') + tail];
  }
  const contStr = ' '.repeat(cont);
  const rows = [];
  let current = [];
  for (let i = 1; i < items.length; i++) {
    const last = i === items.length - 1;
    const piece = current.length === 0 ? items[i] : current.join(', ') + ', ' + items[i];
    const width = cont + piece.length + (last ? tail.length : 1);
    if (width <= LINE_LIMIT) current.push(items[i]);
    else {
      rows.push(contStr + current.join(', ') + ',');
      current = [items[i]];
    }
  }
  rows.push(contStr + current.join(', ') + tail);
  return [head + items[0] + ',', ...rows];
};

// Declaration row that wraps its second term at indent + 4 when the one-row
// form exceeds the limit (ports/bindings declaration faces).
const wrapDef = (head, tail, tailCont) =>
  (head + tail).length <= LINE_LIMIT ? [head + tail]
    : [head, ' '.repeat(tailCont) + tail.trimStart()];

// Phase-error rows: one continuation row at indent + 14 when the items fit,
// otherwise greedy rows at indent + 12 (golden StageError shapes).
const errorRows = (items) => {
  const one = ' '.repeat(14) + items.join(', ');
  if (one.length <= LINE_LIMIT) return [one];
  const contStr = ' '.repeat(12);
  const rows = [];
  let current = [];
  for (const item of items) {
    const piece = current.length === 0 ? item : current.join(', ') + ', ' + item;
    if (contStr.length + piece.length <= LINE_LIMIT) current.push(item);
    else {
      rows.push(contStr + current.join(', ') + ',');
      current = [item];
    }
  }
  rows.push(contStr + current.join(', '));
  return rows;
};

// ---------- fail-closed input validation ----------
function validate(input) {
  if (input.schemaVersion !== 'truthsrc.pipeline-invocation-face-input/v2') {
    throw new Error('unexpected input schema version: ' + input.schemaVersion);
  }
  if (!/^[a-z][a-z0-9-]*$/.test(input.case)) throw new Error('unsafe business case: ' + input.case);
  const symbol = value => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('unsafe symbol: ' + value);
  };
  const kebab = value => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) throw new Error('unsafe kebab id: ' + value);
  };
  for (const key of Object.keys(input.names)) {
    if (key === 'nameSources' || key === 'package') continue;
    if (key === 'package') { /* handled below */ }
    symbol(input.names[key]);
  }
  if (!/^[a-z][a-z0-9_.]*$/.test(input.names.package)) throw new Error('unsafe package');
  const saga = input.saga;
  kebab(saga.id);
  if (!Number.isInteger(saga.definitionVersion) || saga.definitionVersion <= 0) {
    throw new Error('definition version must be a positive integer');
  }
  if (!saga.definitionDigest.startsWith('sha256:')) {
    throw new Error('definition digest must carry the sha256: prefix');
  }
  if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(saga.artifactVersion)) {
    throw new Error('unsafe artifact version: ' + saga.artifactVersion);
  }
  if (!Array.isArray(saga.argsFields) || saga.argsFields.length === 0) {
    throw new Error('the saga args composition requires at least one field');
  }
  for (const field of saga.argsFields) symbol(field);
  const invocation = input.invocation;
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(invocation.scheme)) {
    throw new Error('unsafe invocation scheme: ' + invocation.scheme);
  }
  kebab(invocation.pipelineStep);
  if (!Array.isArray(invocation.markers) || invocation.markers.length !== 4) {
    throw new Error('the invocation scheme carries exactly four markers');
  }
  for (const marker of invocation.markers) kebab(marker);
  const kinds = input.results.kinds;
  if (kinds.length !== 5) throw new Error('the result-kind set is the frozen five kinds');
  const kindNames = kinds.map(k => k.kind);
  for (const kind of kinds) {
    symbol(kind.kind);
    kebab(kind.wire);
    if (typeof kind.terminal !== 'boolean') throw new Error('result kind terminal flag required');
    symbol(kind.executionCase);
    if (kind.stageError !== null) {
      if (!/^[a-z-]+:[A-Za-z]+:[a-z-]+$/.test(kind.stageError.category + ':' + kind.stageError.label +
        ':' + kind.stageError.discipline)) {
        throw new Error('unsafe stage error tuple for kind ' + kind.kind);
      }
    }
  }
  if (new Set(kindNames).size !== kindNames.length) throw new Error('duplicate result kind');
  const participants = input.participants;
  // The participant COUNT is case-varying (payment carries three, refund two);
  // the frozen shapes are the per-participant uniformity checks below, not the count.
  if (participants.length < 1) {
    throw new Error('the strict-saga definition requires at least one participant');
  }
  const inputNames = input.execution.inputs.map(f => f.name);
  for (const p of participants) {
    kebab(p.stepId);
    symbol(p.participantId);
    symbol(p.aggregate);
    symbol(p.resourceType);
    symbol(p.protocol);
    symbol(p.argsField);
    if (!inputNames.includes(p.argsField)) {
      throw new Error('participant args field must be an execution input field: ' + p.argsField);
    }
    for (const phase of ['prepare', 'commit', 'compensate']) {
      symbol(p.commands[phase]);
    }
  }
  if (new Set(participants.map(p => p.stepId)).size !== participants.length) throw new Error('duplicate participant step id');
  const admission = input.admission;
  if (admission.gates.length !== 2 || !admission.gates.includes('entry') ||
    !admission.gates.includes('association')) {
    throw new Error('the R2(b) admission gates are entry + association');
  }
  const pb = input.portBindings;
  if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(pb.artifact)) throw new Error('unsafe binding artifact');
  if (pb.boundary !== 'handwritten-composition-root') {
    throw new Error('the composition root is the sanctioned binding boundary');
  }
  if (!pb.declaredIdStem.startsWith(input.saga.context + '.')) {
    throw new Error('declared implementation ids must live in the saga context namespace');
  }
  if (!/^[a-z][a-z0-9-]*$/.test(pb.codecPinPrefix)) throw new Error('unsafe codec pin prefix');
  if (!Number.isInteger(pb.codecPinVersion) || pb.codecPinVersion <= 0) {
    throw new Error('codec pin version must be a positive integer');
  }
  const serializer = input.serializer;
  if (!Number.isInteger(serializer.identifier) || serializer.identifier < 742000 || serializer.identifier > 742999) {
    throw new Error('serializer identifier is a judged 742xxx allocation');
  }
  if (!/^[a-z0-9-]+$/.test(serializer.manifest)) throw new Error('unsafe serializer manifest');
  if (!serializer.eventPb.endsWith('HostEventPB')) {
    throw new Error('the host event PB must be the declared HostEventPB face');
  }
  const execution = input.execution;
  kebab(execution.stageId);
  if (execution.stageId !== invocation.pipelineStep) {
    throw new Error('the execution stage is the pipeline step');
  }
  if (execution.planVersion !== saga.artifactVersion) {
    throw new Error('the execution plan version is the saga artifact version');
  }
  if (execution.inputs.length < 3) throw new Error('the execution carries at least three durable inputs');
  for (const f of execution.inputs) symbol(f.name);
  // The durable identity keys are contract data (v2): refund derives both from
  // refundOperationId, payment from operation + occurrence (the golden token
  // table consumes exactly these two field names).
  if (!inputNames.includes(invocation.identitySource) || !inputNames.includes(invocation.identityStageOccurrence)) {
    throw new Error('identity keys must be declared execution inputs: ' + invocation.identitySource + ', ' + invocation.identityStageOccurrence);
  }
  if (new Set(inputNames).size !== inputNames.length) throw new Error('duplicate execution input field');
  for (const name of execution.requestInputs) {
    if (!inputNames.includes(name)) throw new Error('request input must be an execution input: ' + name);
  }
  if (inputNames.includes(execution.output.field)) {
    throw new Error('the plan output field must not collide with a durable input');
  }
  symbol(execution.output.field);
  symbol(execution.output.type);
  if (!execution.executionStatePb.endsWith('ExecutionStatePB')) {
    throw new Error('the execution state PB must be the declared ExecutionStatePB face');
  }
  const slots = execution.codecSlots;
  if (slots.length !== inputNames.length + 1) {
    throw new Error('the codec carries one slot per durable input plus the output slot');
  }
  for (const slot of slots) {
    if (typeof slot.optional !== 'boolean') throw new Error('codec slot optionality required');
    if (slot.optional && slot.slot !== 'output0') {
      throw new Error('the optional codec slot is the output slot');
    }
    if (!inputNames.includes(slot.field) && slot.field !== execution.output.field) {
      throw new Error('codec slot field must be an input or the output: ' + slot.field);
    }
    symbol(slot.type);
  }
  const outputSlot = slots.find(s => s.optional);
  if (!outputSlot || outputSlot.field !== execution.output.field || outputSlot.type !== execution.output.type) {
    throw new Error('the output codec slot must restate the declared plan output');
  }
  for (const name of execution.originalFields) {
    if (!inputNames.includes(name)) throw new Error('original field must be an execution input: ' + name);
  }
  const runtime = input.runtime;
  for (const key of ['initialMillis', 'factor', 'maxMillis', 'deadlineSeconds']) {
    if (!Number.isInteger(runtime.retry[key]) || runtime.retry[key] <= 0) {
      throw new Error('retry timing must be positive integers');
    }
  }
  if (!Number.isInteger(runtime.coordinator.askMillis) || runtime.coordinator.askMillis <= 0 ||
    !Number.isInteger(runtime.coordinator.capacity) || runtime.coordinator.capacity <= 0) {
    throw new Error('coordinator ask window and capacity must be positive integers');
  }
  const supply = input.supply;
  for (const key of Object.keys(supply)) {
    if (key === 'source') continue;
    if (key === 'serializationObject') { symbol(supply[key]); continue; }
    if (!/^[a-z][a-z0-9_.]*$/.test(supply[key])) throw new Error('unsafe supply coordinate: ' + supply[key]);
  }
  if (input.layout.columnLimit !== LINE_LIMIT) {
    throw new Error('the L1 layout contract is the ' + LINE_LIMIT + '-column discipline');
  }
  const messages = input.messages;
  for (const key of Object.keys(messages)) {
    if (typeof messages[key] !== 'string' || messages[key].length === 0) {
      throw new Error('message slot must be nonempty text: ' + key);
    }
  }
  const docs = input.docs;
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

// ---------- derived name model (N1/N2 composition) ----------
const model = input => {
  const m = input.execution.inputs.map(f => f.name);
  const phaseKeys = ['prepare', 'commit', 'compensate'];
  const phaseNames = { prepare: 'Prepare', commit: 'Commit', compensate: 'Compensate' };
  const participants = input.participants.map(p => ({
    stepId: p.stepId,
    participantId: p.participantId,
    camel: camel(p.stepId),
    pascal: pascal(p.stepId),
    aggregate: p.aggregate,
    protocol: p.protocol,
    argsField: p.argsField,
    resourceType: p.resourceType,
    phases: phaseKeys.map(key => ({
      key,
      name: phaseNames[key],
      portMember: camel(p.stepId) + phaseNames[key],
      execute: camel(p.stepId) + phaseNames[key] + 'Execute',
      query: camel(p.stepId) + phaseNames[key] + 'Query',
      inputType: pascal(p.stepId) + phaseNames[key] + 'Input',
      receiptType: pascal(p.stepId) + phaseNames[key] + 'Receipt',
      queryType: pascal(p.stepId) + phaseNames[key] + 'Query',
      codecVal: pascal(p.stepId) + phaseNames[key] + 'Codec',
      checkFn: 'check' + pascal(p.stepId) + phaseNames[key],
      commandFn: camel(p.stepId) + phaseNames[key] + 'Command',
      command: p.commands[key],
      codecPin: input.portBindings.codecPinPrefix + '-' + p.stepId + '-' + key,
    })),
  }));
  const basePkg = basePkgOf(input.supply.domainValuesPackage);
  const flowSlug = workflowSubpackageSlug(input.saga.id);
  return {
    basePkg,
    rootSeg: basePkg.split('.').pop(),
    flowSlug,
    pkg: basePkg + '.application.process.' + flowSlug,
    infraProcessPkg: basePkg + '.infrastructure.process',
    persistencePkg: basePkg + '.infrastructure.persistence',
    bootstrapPkg: basePkg + '.infrastructure.bootstrap',
    host: input.names.hostClass,
    hostIo: input.names.hostIoObject,
    ports: input.names.portsTrait,
    bindings: input.names.portBindingsObject,
    serializer: input.names.serializerClass,
    execution: input.names.executionClass,
    stateCodec: input.names.executionClass.replace(/Execution$/, 'StateCodec'),
    processCodecs: input.names.hostClass.replace(/Host$/, 'ProcessCodecs'),
    processBootstrap: input.names.hostClass.replace(/Host$/, 'ProcessBootstrap'),
    definition: input.names.sagaDefinitionObject,
    original: input.names.originalValue,
    args: input.names.argsValue,
    result: input.names.resultValue,
    plan: { ...input.execution, camelStage: camel(input.execution.stageId) },
    ser: input.serializer,
    saga: input.saga,
    invocation: input.invocation,
    kinds: input.results.kinds,
    terminalKinds: input.results.kinds.filter(k => k.terminal),
    nonTerminalKinds: input.results.kinds.filter(k => !k.terminal),
    participants,
    admission: input.admission,
    pb: input.portBindings,
    runtime: input.runtime,
    supply: input.supply,
    messages: input.messages,
    docs: input.docs,
    inputNames: m,
    converters: input.supply.serializationPackage + '.' + input.supply.serializationObject,
  };
};

// ---------- BankPaymentPorts.scala ----------
function emitPorts(md) {
  const gateLines = md.admission.gates.map(gate =>
    '  def ' + gate + '(input: ' + md.original + '): Future[Boolean]');
  const phaseBlocks = [];
  for (const p of md.participants) {
    phaseBlocks.push(sectionHeader(p.stepId + ' (' + p.participantId + ')', 81), '');
    for (const ph of p.phases) {
      phaseBlocks.push(
        '  def ' + ph.execute + '(input: ' + ph.inputType + ',',
        '      identity: OperationIdentity): Future[' + ph.receiptType + ']',
        '  def ' + ph.query + '(input: ' + ph.queryType + ',',
        '      identity: OperationIdentity): Future[Option[' + ph.receiptType + ']]');
    }
    phaseBlocks.push('');
  }
  const completionLines = [];
  for (const kind of md.kinds) {
    const kc = lcFirst(kind.kind);
    completionLines.push(
      ...wrapDef('  def ' + kc + 'AuthorityCompletion(input: ' + md.original + ',',
        ' context: CompletionContext): Future[' + md.result + ']', 6),
      ...wrapDef('  def ' + kc + 'DeliveryCompletion(input: ' + md.result + ',',
        ' context: CompletionContext): Future[Boolean]', 6));
  }
  const lines = [
    'package ' + md.pkg,
    '',
    'import scala.concurrent.Future',
    '',
    ...renderValueWildcardImports(md.basePkg, [md.original, md.result, ...allPhaseTypes(md)], 'application.process.' + md.flowSlug, new Set([md.original])),
    'import ' + md.supply.strictRuntimePackage + '.{OperationIdentity, TransactionIdentity}',
    '',
    ...md.docs.ports,
    'trait ' + md.ports + ' {',
    '',
    '  import ' + md.ports + '.CompletionContext',
    '',
    '  /** Declared identity of every bound implementation — evidence derived from',
    '    * the binding obligations at install time, never hand-maintained. */',
    '  def declarations: Map[String, (String, String)]',
    '',
    sectionHeader('admission gates', 81),
    '',
    ...gateLines,
    '',
    ...phaseBlocks,
    sectionHeader('result-kind completion pairs', 81),
    '',
    ...completionLines,
    '}',
    '',
    'object ' + md.ports + ' {',
    '',
    '  /** Completion-carrying call context of the delivery two-phase. */',
    '  final case class CompletionContext(original: ' + md.original + ', identity: TransactionIdentity)',
    '',
    '  /** Raised by implementations when an operation was provably not executed;',
    '    * the strict runtime folds this into a not-executed receipt. */',
    '  final case class OperationNotExecuted(',
    '    identity: OperationIdentity,',
    '    evidence: String,',
    '    safeToRetry: Boolean,',
    '  ) extends RuntimeException(evidence)',
    '}',
  ];
  return assertWidth(lines, 'ports').join('\n') + '\n';
}

// ---------- BankPaymentHostIO.scala ----------
function emitHostIo(md) {
  const completionFaceLines = [];
  for (const kind of md.kinds) {
    const kc = lcFirst(kind.kind);
    const row = '      case ResultKind.' + kind.kind + ' => (technical.' + kc +
      'AuthorityCompletion, technical.' + kc + 'DeliveryCompletion)';
    if (row.length <= LINE_LIMIT) {
      completionFaceLines.push(row);
    } else {
      completionFaceLines.push('      case ResultKind.' + kind.kind + ' => (technical.' + kc +
        'AuthorityCompletion,',
        '          technical.' + kc + 'DeliveryCompletion)');
    }
  }
  const lines = [
    'package ' + md.infraProcessPkg,
    '',
    'import scala.concurrent.{ExecutionContext, Future}',
    '',
    ...renderValueWildcardImports(md.basePkg, [md.original, md.result, ...allPhaseTypes(md)], 'infrastructure.process', new Set([md.original])),
    'import ' + md.host + '.ResultKind',
    'import ' + md.pkg + '.' + md.ports,
    'import ' + md.pkg + '.' + md.ports + '.CompletionContext',
    'import ' + md.supply.strictRuntimePackage + '.TransactionIdentity',
    '',
    ...md.docs.hostIo,
    'object ' + md.hostIo + ' {',
    '',
    '  /** Admission asks the entry gate, then the association check; both must',
    '    * pass. An implementation failure surfaces as a failed future — the host',
    '    * reports it as "' + md.messages.admissionUnavailable + '", never as a denial. */',
    '  def admit(',
    '    original: ' + md.original + ',',
    '    technical: ' + md.ports + ',',
    '  )(implicit ec: ExecutionContext): Future[Boolean] =',
    '    technical.entry(original).flatMap {',
    '      case true => technical.association(original)',
    '      case false => Future.successful(false)',
    '    }',
    '',
    '  /** Two-phase delivery: the authority port must re-derive exactly the result',
    '    * implied by the observed identity, then the delivery port carries it to',
    '    * the destination. A mismatch refuses the delivery — never a guess. */',
    '  def deliver(',
    '    kind: ResultKind,',
    '    original: ' + md.original + ',',
    '    identity: TransactionIdentity,',
    '    technical: ' + md.ports + ',',
    '  )(implicit ec: ExecutionContext): Future[Boolean] = {',
    '    val context = CompletionContext(original, identity)',
    '    val expected = ' + md.result + '(' + md.supply.domainValuesPackage + '.' + md.plan.output.type +
      '(identity.transactionId))',
    '    val (authority, delivery) = completionFace(kind, technical)',
    '    authority(original, context).flatMap { actual =>',
    '      require(actual == expected, "' + md.messages.authorityResultDiffers + '")',
    '      delivery(actual, context)',
    '    }',
    '  }',
    '',
    '  private type AuthorityFace =',
    '    (' + md.original + ', CompletionContext) => Future[' + md.result + ']',
    '  private type DeliveryFace =',
    '    (' + md.result + ', CompletionContext) => Future[Boolean]',
    '',
    '  /** The completion faces of each result kind; exhaustive by construction. */',
    '  private def completionFace(',
    '    kind: ResultKind,',
    '    technical: ' + md.ports + ',',
    '  ): (AuthorityFace, DeliveryFace) =',
    '    kind match {',
    ...completionFaceLines,
    '    }',
    '}',
  ];
  return assertWidth(lines, 'host IO').join('\n') + '\n';
}

// ---------- BankPaymentHostSerializer.scala ----------
function emitSerializer(md) {
  const pb = md.ser.eventPb;
  const lines = [
    'package ' + md.persistencePkg,
    '',
    'import akka.serialization.SerializerWithStringManifest',
    'import ' + md.infraProcessPkg + '.' + md.host,
    'import ' + md.supply.strictRuntimePackage + '.StrictSagaProtoConverters',
    'import ' + md.supply.strictRuntimePackage + '.proto.saga_strict.TransactionIdentityPO',
    '',
    ...md.docs.serializer,
    'final class ' + md.serializer + ' extends SerializerWithStringManifest {',
    '  override val identifier: Int = ' + md.ser.identifier,
    '',
    '  private val Manifest = "' + md.ser.manifest + '"',
    '',
    '  override def manifest(value: AnyRef): String = {',
    '    require(value.isInstanceOf[' + md.host + '.Event], "' + md.messages.hostEventRequired + '")',
    '    Manifest',
    '  }',
    '',
    '  override def toBinary(value: AnyRef): Array[Byte] = {',
    '    manifest(value)',
    '    val pb = value match {',
    '      case ' + md.host + '.AdmissionGranted =>',
    '        ' + pb + '(kind = "admitted")',
    '      case ' + md.host + '.Associated(original, args, operation) =>',
    '        ' + pb + '(kind = "associated",',
    '            original = original, args = args, operation = operation)',
    '      case ' + md.host + '.IdentityObserved(identity) =>',
    '        ' + pb + '(kind = "identity",',
    '            identity = StrictSagaProtoConverters.identityToProto(identity).toByteString)',
    '      case ' + md.host + '.ResultIntent(kind) =>',
    ...(
      ('        ' + pb + '(kind = "result", operation = kind.wire)').length <= LINE_LIMIT
        ? ['        ' + pb + '(kind = "result", operation = kind.wire)']
        : ['        ' + pb + '(kind = "result",', '            operation = kind.wire)']
    ),
    '      case ' + md.host + '.DeliveryAcknowledged(kind) =>',
    '        ' + pb + '(kind = "delivered",',
    '            operation = kind.wire)',
    '    }',
    '    pb.toByteArray',
    '  }',
    '',
    '  override def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = {',
    '    require(manifest == Manifest, "' + md.messages.hostEventVersionRequired + '")',
    ...wrapParseFrom('    ', 'pb', pb),
    '    pb.kind match {',
    '      case "admitted" => ' + md.host + '.AdmissionGranted',
    '      case "associated" => ' + md.host + '.Associated(pb.original, pb.args, pb.operation)',
    '      case "identity" =>',
    '          ' + md.host,
    '              .IdentityObserved(StrictSagaProtoConverters',
    '                  .identityFromProto(TransactionIdentityPO.parseFrom(pb.identity.toByteArray)))',
    '      case "result" =>',
    '        resultKind(pb.operation) match {',
    '          case Some(kind) => ' + md.host + '.ResultIntent(kind)',
    '          case None => refuse(pb.kind, pb.operation)',
    '        }',
    '      case "delivered" =>',
    '        resultKind(pb.operation) match {',
    '          case Some(kind) => ' + md.host + '.DeliveryAcknowledged(kind)',
    '          case None => refuse(pb.kind, pb.operation)',
    '        }',
    '      case other => refuse(other, pb.operation)',
    '    }',
    '  }',
    '',
    '  private def resultKind(wire: String): Option[' + md.host + '.ResultKind] =',
    '    ' + md.host + '.ResultKind.fromWire(wire)',
    '',
    '  private def refuse(kind: String, payload: String): Nothing =',
    '    throw new IllegalArgumentException(s"' + md.messages.unknownHostEventKind +
    ' \\"$kind\\" payload \\"$payload\\"")',
    '}',
  ];
  return assertWidth(lines, 'serializer').join('\n') + '\n';
}

// ---------- BankCashPaymentExecution.scala ----------
function emitExecution(md) {
  const stage = md.plan;
  const successKind = md.kinds.find(k => k.stageError === null);
  const errorKinds = md.kinds.filter(k => k.stageError !== null);
  const values = [...new Set(md.plan.inputs.map(f => f.type).concat([md.plan.output.type]))]
    .filter(t => t !== 'String').sort();
  const requestFields = md.plan.inputs.filter(f => md.plan.requestInputs.includes(f.name));
  const stageFold = [];
  stageFold.push('    case ' + successKind.executionCase + '(' + md.plan.output.field +
    ') => Right(state.copy(' + md.plan.output.field + ' = Some(' + md.plan.output.field + ')))');
  for (const kind of errorKinds) {
    stageFold.push('    case ' + kind.executionCase + ' => Left(StageError(StageId,',
      ...errorRows(['Some("' + kind.stageError.label + '")',
        '"' + kind.stageError.category + '"',
        '"' + kind.stageError.category + ':' + kind.stageError.label + ':' + kind.stageError.discipline + '"))']));
  }
  const retry = md.runtime.retry;
  const lines = [
    'package ' + md.pkg,
    '',
    'import scala.concurrent.duration._',
    '',
    ...renderGroupedValueImports(md.basePkg, values, 'application.process.' + md.flowSlug, null, new Set([md.original])),
    'import ' + md.supply.monarchPersistencePackage.replace(/\.persistence$/, '') + '.StageError',
    '',
    ...md.docs.execution,
    'object ' + md.execution + ' {',
    '',
    '  final case class Inputs(',
    ...md.plan.inputs.map(f => '    ' + f.name + ': ' + f.type + ','),
    '  )',
    '',
    '  final case class ' + pascal(stage.stageId) + 'Request(',
    ...requestFields.map(f => '    ' + f.name + ': ' + f.type + ','),
    '  )',
    '',
    '  sealed trait ' + pascal(stage.stageId) + 'Result',
    ...md.kinds.map(kind => kind.stageError === null
      ? '  final case class ' + kind.executionCase + '(' + md.plan.output.field + ': ' +
        md.plan.output.type + ') extends ' + pascal(stage.stageId) + 'Result'
      : '  case object ' + kind.executionCase + ' extends ' + pascal(stage.stageId) + 'Result'),
    '',
    '  final case class State(inputs: Inputs, ' + md.plan.output.field + ': Option[' +
      md.plan.output.type + '] = None)',
    '',
    '  final case class Outputs(' + md.plan.output.field + ': ' + md.plan.output.type + ')',
    '',
    '  /** Unconfirmed predecessor output is refused — never defaulted. */',
    '  def outputs(state: State): Either[StageError, Outputs] =',
    '    state.' + md.plan.output.field + '.map(Outputs(_)).toRight(',
    '      StageError(StageId, Some("UnconfirmedOutput"), "predecessor-output", "' +
      md.messages.unconfirmedPredecessorOutput + '"))',
    '',
    '  // ----------------------------------------------------------------- knowledge',
    '  val PlanVersion = "' + stage.planVersion + '"',
    '  val StageId = "' + stage.stageId + '"',
    '',
    '  /** Bounded retry of the pending-invocation poll (R1): the host answers',
    '    * Pending while the saga runs; the bridge re-asks with exponential backoff',
    '    * inside the stage deadline — never an unbounded 20 ms loop. */',
    '  val RetryInitial: FiniteDuration = ' + duration(retry.initialMillis),
    '  val RetryFactor: Int = ' + retry.factor,
    '  val RetryMax: FiniteDuration = ' + duration(retry.maxMillis),
    '  val StageDeadline: FiniteDuration = ' + duration(retry.deadlineSeconds * 1000),
    '',
    '  /** R1 bounded backoff schedule: attempt 0 waits RetryInitial, doubling per',
    '    * attempt and capped at RetryMax — the poll loop is finite by construction. */',
    '  def backoffMillis(attempt: Int): Long =',
    '    math.min(RetryMax.toMillis, math.round(RetryInitial.toMillis * math.pow(RetryFactor, attempt.toDouble)))',
    '',
    '  def foldResult(state: State, result: ' + pascal(stage.stageId) + 'Result): Either[StageError, State] = result match {',
    ...stageFold,
    '  }',
    '}',
  ];
  return assertWidth(lines, 'execution').join('\n') + '\n';
}

// ---------- BankCashPaymentStateCodec.scala ----------
function emitExecutionStateCodec(md) {
  const stage = md.plan;
  const converters = md.supply.serializationObject;
  const encodeLine = slot => {
    if (slot.type === 'String') {
      return '        ' + slot.slot + ' = Some(identity[String](state.inputs.' + slot.field + ')),';
    }
    return '        ' + slot.slot + ' = Some(' + converters + '.encode' + slot.type + 'PO(state.inputs.' +
      slot.field + ')),';
  };
  const decodeLine = slot => {
    if (slot.type === 'String') {
      return '          ' + slot.field + ' = identity[String](durable(pb.' + slot.slot + ', "' + slot.slot + '")),';
    }
    return '          ' + slot.field + ' = ' + converters + '.decode' + slot.type + 'PO(durable(pb.' +
      slot.slot + ', "' + slot.slot + '")),';
  };
  const lines = [
    'package ' + md.persistencePkg,
    '',
    'import ' + md.pkg + '.' + md.execution,
    'import ' + md.supply.serializationPackage + '.' + md.supply.serializationObject,
    'import ' + md.supply.monarchPersistencePackage + '.StateCodec',
    '',
    '/** Exact finite plan state codec: owns protobuf slot encoding/decoding for',
    '  * `' + md.execution + '.State` in the persistence layer. */',
    'object ' + md.stateCodec + ' {',
    '',
    ...(
      ('  val codec: StateCodec[' + md.execution + '.State] = StateCodec[' + md.execution + '.State](').length <= LINE_LIMIT
        ? ['  val codec: StateCodec[' + md.execution + '.State] = StateCodec[' + md.execution + '.State](']
        : [
            '  val codec: StateCodec[' + md.execution + '.State] =',
            '    StateCodec[' + md.execution + '.State](',
          ]
    ),
    '    state =>',
    '      ' + stage.executionStatePb + '(',
    '        planversion = ' + md.execution + '.PlanVersion,',
    ...md.plan.codecSlots.filter(s => !s.optional).map(encodeLine),
    ...md.plan.codecSlots.filter(s => s.optional).map(slot =>
      '        ' + slot.slot + ' = state.' + slot.field + '.map(' + converters + '.encode' + slot.type + 'PO),'),
    '      ).toByteArray,',
    '    bytes => {',
    ...wrapParseFrom('      ', 'pb', stage.executionStatePb),
    ...(
      ('      require(pb.planversion == ' + md.execution + '.PlanVersion, "' + md.messages.exactPlanVersionRequired + '")').length <= LINE_LIMIT
        ? ['      require(pb.planversion == ' + md.execution + '.PlanVersion, "' + md.messages.exactPlanVersionRequired + '")']
        : [
            '      require(',
            '        pb.planversion == ' + md.execution + '.PlanVersion,',
            '        "' + md.messages.exactPlanVersionRequired + '"',
            '      )',
          ]
    ),
    '      def durable[A](slot: Option[A], name: String): A =',
    '        slot.getOrElse(throw new IllegalArgumentException(s"' + md.messages.missingDurableInput + '"))',
    '      ' + md.execution + '.State(',
    '        ' + md.execution + '.Inputs(',
    ...md.plan.codecSlots.filter(s => !s.optional).map(decodeLine),
    '        ),',
    '        pb.' + md.plan.codecSlots.find(s => s.optional).slot + '.map(' + converters + '.decode' +
      md.plan.output.type + 'PO),',
    '      )',
    '    },',
    '  )',
    '}',
  ];
  return assertWidth(lines, 'stateCodec').join('\n') + '\n';
}

// ---------- BankPaymentProcessCodecs.scala ----------
function emitProcessCodecs(md) {
  const argsValue = md.args;
  const pinVersion = md.pb.codecPinVersion;
  const codecBlocks = [];
  for (const p of md.participants) {
    for (const ph of p.phases) {
      codecBlocks.push(
        '  val ' + ph.codecVal + ': PayloadCodec[' + ph.receiptType + '] = payloadCodec(',
        '    CodecPin("' + ph.codecPin + '", ' + pinVersion + '),',
        '    receipt =>',
        '      ' + md.supply.serializationObject + '.encode' + ph.receiptType + 'PO(receipt).toByteString,',
        '    bytes => Try(' + md.supply.serializationObject + '.decode' + ph.receiptType + 'PO(',
        '      ' + md.supply.protoPackage + '.' + ph.receiptType + 'PO.parseFrom(bytes.toByteArray))),',
        '  )',
        '');
    }
  }
  const lines = [
    'package ' + md.persistencePkg,
    '',
    'import scala.util.Try',
    '',
    'import com.google.protobuf.ByteString',
    'import ' + md.pkg + '._',
    ...renderValueWildcardImports(md.basePkg, [md.args, ...allReceiptTypes(md)], 'infrastructure.persistence'),
    'import ' + md.supply.serializationPackage + '.' + md.supply.serializationObject,
    'import ' + md.supply.strictRuntimePackage + '.{CodecPin, PayloadCodec}',
    '',
    '/** Persistence-layer protobuf payload codecs for `' + md.definition + '`. */',
    'object ' + md.processCodecs + ' extends ' + md.definition + '.Codecs {',
    '',
    ...(
      ('  val argsCodec: PayloadCodec[' + md.definition + '.Args] = new PayloadCodec[' + md.definition + '.Args] {').length <= LINE_LIMIT
        ? ['  val argsCodec: PayloadCodec[' + md.definition + '.Args] = new PayloadCodec[' + md.definition + '.Args] {']
        : [
            '  val argsCodec: PayloadCodec[' + md.definition + '.Args] =',
            '    new PayloadCodec[' + md.definition + '.Args] {',
          ]
    ),
    '    val pin: CodecPin = ' + md.definition + '.ArgsCodecPin',
    '    def encode(value: ' + md.definition + '.Args): ByteString =',
    '      ' + md.supply.serializationObject + '.encode' + argsValue + 'PO(value).toByteString',
    '    def decode(bytes: ByteString): Try[' + md.definition + '.Args] =',
    '      Try(' + md.supply.serializationObject + '.decode' + argsValue + 'PO(',
    '        ' + md.supply.protoPackage + '.' + argsValue + 'PO.parseFrom(bytes.toByteArray)))',
    '  }',
    '',
    '  private def payloadCodec[Receipt](',
    '    codecPin: CodecPin,',
    '    encodeReceipt: Receipt => ByteString,',
    '    decodeBytes: ByteString => Try[Receipt],',
    '  ): PayloadCodec[Receipt] = new PayloadCodec[Receipt] {',
    '    val pin: CodecPin = codecPin',
    '    def encode(value: Receipt): ByteString = encodeReceipt(value)',
    '    def decode(bytes: ByteString): Try[Receipt] = decodeBytes(bytes)',
    '  }',
    '',
    ...codecBlocks,
    '}',
  ];
  return assertWidth(lines, 'processCodecs').join('\n') + '\n';
}

// ---------- BankPaymentPortBindings.scala ----------
function emitBindings(md) {
  const obligationRows = [
    ...md.admission.gates.map(gate =>
      '    Obligation("' + md.pb.declaredIdStem.split('.')[1] + pascal(gate) + '", _.' + gate + '),'),
  ];
  for (const p of md.participants) {
    for (const ph of p.phases) {
      obligationRows.push('    Obligation("' + p.pascal + ph.name + 'Execute", _.' + ph.execute + '),');
      obligationRows.push('    Obligation("' + p.pascal + ph.name + 'QueryPort", _.' + ph.query + '),');
    }
  }
  for (const kind of md.kinds) {
    obligationRows.push('    Obligation("' + md.pb.declaredIdStem.split('.')[1] + kind.kind +
      'Authority", _.' + lcFirst(kind.kind) + 'Authority),');
    obligationRows.push('    Obligation("' + md.pb.declaredIdStem.split('.')[1] + kind.kind +
      'Delivery", _.' + lcFirst(kind.kind) + 'Delivery),');
  }
  const bindingsFields = [
    ...md.admission.gates.map(gate =>
      '    ' + gate + ': RunBinding[' + md.original + ', Boolean],'),
  ];
  for (const p of md.participants) {
    for (const ph of p.phases) {
      bindingsFields.push(
        ...wrapDef('    ' + ph.execute + ': OperationBinding[' + ph.inputType + ',',
          ph.receiptType + '],', 8),
        ...wrapDef('    ' + ph.query + ': OperationBinding[' + ph.queryType + ',',
          'Option[' + ph.receiptType + ']],', 8));
    }
  }
  for (const kind of md.kinds) {
    const kc = lcFirst(kind.kind);
    bindingsFields.push(
      ...wrapDef('    ' + kc + 'Authority: CompletionBinding[' + md.original + ',',
        ' ' + md.result + '],', 8),
      ...wrapDef('    ' + kc + 'Delivery: CompletionBinding[' + md.result + ',',
        ' Boolean],', 8));
  }
  const boundBlocks = [];
  for (const p of md.participants) {
    for (const ph of p.phases) {
      boundBlocks.push(
        '    def ' + ph.execute + '(input: ' + ph.inputType + ',',
        '        identity: OperationIdentity): Future[' + ph.receiptType + '] =',
        '      bindings.' + ph.execute + '.run(input, identity)',
        '    def ' + ph.query + '(input: ' + ph.queryType + ',',
        '        identity: OperationIdentity): Future[Option[' + ph.receiptType + ']] =',
        '      bindings.' + ph.query + '.run(input, identity)');
    }
    boundBlocks.push('');
  }
  const completionBlocks = [];
  for (const kind of md.kinds) {
    const kc = lcFirst(kind.kind);
    completionBlocks.push(
      ...wrapDef('    def ' + kc + 'AuthorityCompletion(input: ' + md.original + ',',
        ' context: CompletionContext): Future[' + md.result + '] =', 8),
      '      bindings.' + kc + 'Authority.run(input, context)',
      ...wrapDef('    def ' + kc + 'DeliveryCompletion(input: ' + md.result + ',',
        ' context: CompletionContext): Future[Boolean] =', 8),
      '      bindings.' + kc + 'Delivery.run(input, context)');
  }
  const lines = [
    'package ' + md.bootstrapPkg,
    '',
    'import scala.concurrent.Future',
    '',
    'import ' + md.pkg + '._',
    'import ' + md.pkg + '.' + md.ports + '.CompletionContext',
    ...renderValueWildcardImports(md.basePkg, [md.original, md.result, ...allPhaseTypes(md)], 'infrastructure.bootstrap', new Set([md.original])),
    'import ' + md.supply.strictRuntimePackage + '.OperationIdentity',
    '',
    ...md.docs.bindings,
    'object ' + md.bindings + ' {',
    '',
    '  private val implementationVersion = "' + md.pb.implementationVersion + '"',
    '',
    '  /** One obligation row per port: the declared implementation identity and the',
    '    * accessor to its binding. The check and the evidence maps are written',
    '    * once, below — never per port. */',
    '  private final case class Obligation(declaredId: String, bound: Bindings => PortBinding[_, _])',
    '',
    '  private val obligations: Vector[Obligation] = Vector(',
    ...obligationRows,
    '  )',
    '',
    '  sealed trait PortBinding[I, O] {',
    '    def id: String',
    '    def version: String',
    '',
    '    def requireExact(expectedId: String, expectedVersion: String): Unit = {',
    '      require(id == expectedId, s"' + md.messages.identityMismatch + '")',
    '      require(version == expectedVersion,',
    '          s"' + md.messages.versionMismatch + '")',
    '    }',
    '  }',
    '',
    '  /** The typed implementation records. Each carries exactly one face; a null',
    '    * face fails at construction, before install ever sees it. */',
    '  final case class RunBinding[I, O](id: String, version: String, run: I => Future[O]) extends PortBinding[I, O] {',
    '    require(run != null, s"' + md.messages.carriesNoRunFace + '")',
    '  }',
    '  final case class OperationBinding[I,',
    '      O](id: String, version: String, run: (I, OperationIdentity) => Future[O]) extends PortBinding[I, O] {',
    '    require(run != null, s"' + md.messages.carriesNoOperationFace + '")',
    '  }',
    '  final case class CompletionBinding[I,',
    '      O](id: String, version: String, run: (I, CompletionContext) => Future[O]) extends PortBinding[I, O] {',
    '    require(run != null, s"' + md.messages.carriesNoCompletionFace + '")',
    '  }',
    '',
    '  /** The typed implementation record — the composition root fills exactly',
    '    * these slots, one per declared port. */',
    '  final case class Bindings(',
    ...bindingsFields,
    '  )',
    '',
    '  /** Verify every declared obligation and expose the typed port surface. */',
    '  def install(bindings: Bindings): ' + md.ports + ' = {',
    '    require(bindings != null, "' + md.messages.completeBindingsRequired + '")',
    '    for (o <- obligations) o.bound(bindings).requireExact("' +
      md.pb.declaredIdStem.split('.')[0] + '." + o.declaredId, implementationVersion)',
    '    new BoundPorts(bindings)',
    '  }',
    '',
    '  private final class BoundPorts(bindings: Bindings) extends ' + md.ports + ' {',
    ...md.admission.gates.map(gate =>
      '    def ' + gate + '(input: ' + md.original + '): Future[Boolean] = bindings.' + gate + '.run(input)'),
    '',
    ...boundBlocks,
    ...completionBlocks,
    '',
    '    /** Declared identity of every bound implementation, derived from the',
    '      * obligation table — never hand-maintained. */',
    '    lazy val declarations: Map[String, (String, String)] =',
    '      obligations.map { o =>',
    '        val b = o.bound(bindings)',
    '        o.declaredId -> (b.id -> b.version)',
    '      }.toMap',
    '  }',
    '',
    '  /** Static binding ownership per port, keyed by declared implementation id:',
    '    * (id, role wire, artifact, version, boundary) — evidence data, derived',
    '    * from the obligation table by the role order above. */',
    '  def bindingOwnership(bindings: Bindings): Vector[(String, String, String, String, String)] = {',
    '    obligations.map { o =>',
    '      val role = o.declaredId match {',
    '        case id if id.endsWith("Entry") => "entry"',
    '        case id if id.endsWith("Association") => "association"',
    '        case id if id.endsWith("Authority") => "authority"',
    '        case id if id.endsWith("Delivery") => "result-delivery"',
    '        case id if id.endsWith("QueryPort") => "phase-query"',
    '        case _ => "phase-execute"',
    '      }',
    '      (o.declaredId, role, "' + md.pb.artifact + '", implementationVersion, "' + md.pb.boundary + '")',
    '    }',
    '  }',
    '}',
  ];
  return assertWidth(lines, 'bindings').join('\n') + '\n';
}

// ---------- BankPaymentHost.scala ----------
function emitHost(md) {
  const kindNames = md.kinds.map(k => k.kind);
  const kindAll = packAfterFirst('    val all: Vector[ResultKind] = Vector(', kindNames, ')', 8);
  const terminalSet = packAfterFirst('    val terminal: Set[ResultKind] = Set(',
    md.terminalKinds.map(k => k.kind), ')', 8);
  const originalArgs = md.plan.originalFields.map(name => '      state.inputs.' + name + ',');
  const argsArgs = md.saga.argsFields.map(name => '      state.inputs.' + name + ',');
  const fingerprintParts = [
    '      InvocationScheme,',
    '      "' + md.saga.context + '",',
    '      SagaId, SagaVersion,',
    '      SagaId, SagaVersion,',
    '      PipelineStep,',
    '      input.' + md.invocation.identitySource + '.value,',
    '      input.' + md.invocation.identityStageOccurrence + '.value,',
  ];
  const classifyLines = [
    '      case StrictStatus.Succeeded => Some(ResultKind.Succeeded)',
    '      case StrictStatus.Aborted =>',
    '        Some(if (status.evidence.values.exists { case Evidence.Confirmed(id,',
    '            _) => id.phase == Phase.Prepare; case _ => false })',
    '          ResultKind.Compensated else ResultKind.RejectedBeforeEffects)',
    '      case StrictStatus.RecoveryRequired =>',
    '        Some(if (status',
    '            .evidence.values',
    '                .exists(_.isInstanceOf[Evidence.Uncertain])) ResultKind.OutcomeUnknown else ResultKind.RecoveryRequired)',
    '      case _ => None',
  ];
  const completedLines = [];
  for (const kind of md.kinds) {
    if (kind.stageError === null) {
      completedLines.push(
        '          case ResultKind.' + kind.kind + ' =>',
        '              Completed(' + md.execution,
        '                  .' + kind.executionCase + '(' + md.supply.domainValuesPackage + '.' +
        md.plan.output.type + '(identity.transactionId)))');
    } else if (kind.terminal) {
      completedLines.push('          case ResultKind.' + kind.kind + ' => Completed(' + md.execution +
        '.' + kind.executionCase + ')');
    }
  }
  completedLines.push('          case ResultKind.' +
    md.nonTerminalKinds.map(k => k.kind).join(' | ResultKind.') + ' => Pending(kind.wire)');
  const lines = [
    'package ' + md.infraProcessPkg,
    '',
    'import akka.actor.typed.ActorRef',
    'import com.google.protobuf.ByteString',
    'import ' + md.pkg + '.{' + md.execution + ', ' + md.definition + '}',
    ...renderGroupedValueImports(md.basePkg, [md.args, md.original, md.result], 'infrastructure.process', null, new Set([md.original])),
    'import ' + md.supply.strictRuntimePackage + '._',
    '',
    ...md.docs.host,
    'object ' + md.host + ' {',
    '',
    '  /** Saga result kinds; `wire` is the persisted identity of the kind. */',
    '  sealed trait ResultKind { def wire: String }',
    '  object ResultKind {',
    ...md.kinds.map(kind => '    case object ' + kind.kind + ' extends ResultKind { val wire = "' +
      kind.wire + '" }'),
    '',
    ...kindAll,
    ...terminalSet,
    '',
    '    def fromWire(wire: String): Option[ResultKind] = all.find(_.wire == wire)',
    '  }',
    '',
    '  sealed trait Request',
    ...(
      ('  final case class Invoke(state: ' + md.execution + '.State, replyTo: ActorRef[Reply]) extends Request').length <= LINE_LIMIT
        ? ['  final case class Invoke(state: ' + md.execution + '.State, replyTo: ActorRef[Reply]) extends Request']
        : [
            '  final case class Invoke(',
            '    state: ' + md.execution + '.State,',
            '    replyTo: ActorRef[Reply],',
            '  ) extends Request',
          ]
    ),
    '  private[' + md.rootSeg + '] final case class Observed(',
    '    reply: StrictSagaCoordinator.Reply, replyTo: ActorRef[Reply]) extends Request',
    '  private[' + md.rootSeg + '] final case class Delivered(',
    '    kind: ResultKind, ok: Boolean, replyTo: ActorRef[Reply]) extends Request',
    '  private[' + md.rootSeg + '] final case class Admitted(',
    '    operation: String, outcome: Either[String, Unit]) extends Request',
    '',
    '  sealed trait Reply',
    '  final case class Completed(result: ' + md.execution + '.' + pascal(md.plan.stageId) +
      'Result) extends Reply',
    '  final case class Pending(reason: String) extends Reply',
    '  final case class Conflict(reason: String) extends Reply',
    '',
    '  sealed trait Event',
    '  final case class Associated(original: ByteString, args: ByteString, operation: String) extends Event',
    '  final case class IdentityObserved(identity: TransactionIdentity) extends Event',
    '  final case class ResultIntent(kind: ResultKind) extends Event',
    '  final case class DeliveryAcknowledged(kind: ResultKind) extends Event',
    '  case object AdmissionGranted extends Event',
    '',
    '  final case class State(',
    '    original: ByteString = ByteString.EMPTY,',
    '    args: ByteString = ByteString.EMPTY,',
    '    operation: String = "",',
    '    identity: Option[TransactionIdentity] = None,',
    '    result: Option[ResultKind] = None,',
    '    delivered: Boolean = false,',
    '    admitted: Boolean = false,',
    '  )',
    '',
    '  // ----------------------------------------------------------------- knowledge',
    '  val SagaId = "' + md.saga.id + '"',
    '  val SagaVersion = "' + md.saga.artifactVersion + '"',
    '  val SagaDefinitionVersion = ' + md.saga.definitionVersion,
    '  val SagaDefinitionDigest = "' + md.saga.definitionDigest + '"',
    '  val PipelineStep = "' + md.invocation.pipelineStep + '"',
    '  val InvocationScheme = "' + md.invocation.scheme + '"',
    '  val InvocationMarkers = Vector(' + md.invocation.markers.map(m => '"' + m + '"').join(', ') + ')',
    '',
    '  def originalInput(state: ' + md.execution + '.State): ' + md.original + ' =',
    '    ' + md.original + '(',
    ...originalArgs,
    '    )',
    '',
    '  def invocationArgs(state: ' + md.execution + '.State): ' + md.args + ' =',
    '    ' + md.args + '(',
    ...argsArgs,
    '    )',
    '',
    '  /** Durable operation identity: the scheme, saga and invocation markers plus',
    '    * the request\'s own keys, length-prefixed and SHA-256 digested. */',
    '  def operationIdentity(state: ' + md.execution + '.State): String = {',
    '    val input = state.inputs',
    '    fingerprint(Vector(',
    ...fingerprintParts,
    '    ) ++ InvocationMarkers)',
    '  }',
    '',
    '  private def fingerprint(parts: Vector[String]): String = {',
    '    parts.foreach(part => require(part != null && part.nonEmpty, "' +
      md.messages.durableIdentityTokenRequired + '"))',
    '    val buffer = new java.io.ByteArrayOutputStream',
    '    val out = new java.io.DataOutputStream(buffer)',
    '    parts.foreach { part =>',
    '      val bytes = part.getBytes(java.nio.charset.StandardCharsets.UTF_8)',
    '      out.writeInt(bytes.length)',
    '      out.write(bytes)',
    '    }',
    '    out.flush()',
    '    sha256Hex(buffer.toByteArray)',
    '  }',
    '',
    '  private def sha256Hex(bytes: Array[Byte]): String =',
    '    "sha256:" + hexSha256(bytes)',
    '',
    '  /** The coordinator\'s per-args digest is the bare hex form; the scheme',
    '    * prefix belongs to definition digests and the operation fingerprint only. */',
    '  private def hexSha256(bytes: Array[Byte]): String =',
    '    java.security.MessageDigest.getInstance("SHA-256").digest(bytes).iterator',
    '      .map(b => f"${b & 0xff}%02x").mkString',
    '',
    '  /** Classify an authoritative strict-saga status into a result kind. */',
    '  def classify(status: StrictState): Option[ResultKind] =',
    '    status.status match {',
    ...classifyLines,
    '    }',
    '',
    '  /** The authoritative status must describe exactly this invocation: same',
    '    * args bytes, same definition identity, same args digest, no identity',
    '    * flip-flop, and a proto-round-trippable payload. */',
    '  def validStatus(state: State, status: StrictState): Boolean =',
    '    status.argsBytes == state.args && status.identity.exists { identity =>',
    '      identity.transactionId == state.operation &&',
    '      identity.definitionName == SagaId &&',
    '      identity.definitionVersion == SagaDefinitionVersion &&',
    '      identity.definitionDigest == SagaDefinitionDigest &&',
    '      identity.argsCodec == ' + md.definition + '.ArgsCodecPin &&',
    '      identity.argsDigest == hexSha256(state.args.toByteArray) &&',
    '      state.identity.forall(_ == identity) &&',
    '      scala.util.Try(StrictSagaProtoConverters.stateToProto(status)).isSuccess',
    '    }',
    '',
    '  def nextResult(current: Option[ResultKind], observed: Option[ResultKind]): Option[ResultKind] =',
    '    if (current.exists(ResultKind.terminal)) None else observed.filterNot(current.contains)',
    '',
    '  /** Derive the caller\'s reply from durable state only (R2 contract). */',
    '  def completed(state: State, kind: ResultKind): Reply =',
    '    state.identity match {',
    '      case None => Pending("' + md.messages.identityNotYetObserved +
      '") // unreachable: kinds answer only after observation; fail closed',
    '      case Some(identity) =>',
    '        kind match {',
    ...completedLines,
    '        }',
    '    }',
    '',
    '  def applyEvent(state: State, event: Event): State = event match {',
    '    case Associated(original, args, operation) =>',
    '      state.copy(original = original, args = args, operation = operation)',
    '    case IdentityObserved(identity) => state.copy(identity = Some(identity))',
    '    case ResultIntent(kind) => state.copy(result = Some(kind), delivered = false)',
    '    case DeliveryAcknowledged(_) => state.copy(delivered = true)',
    '    case AdmissionGranted => state.copy(admitted = true)',
    '  }',
    '}',
  ];
  return assertWidth(lines, 'host').join('\n') + '\n';
}

// ---------- BankPaymentSagaDefinition.scala ----------
function emitDefinition(md) {
  const argsValue = md.args;
  const protocols = [...new Set(md.participants.map(p => p.protocol))].sort();
  const codecContractLines = md.participants.flatMap(p =>
    p.phases.map(ph => '    def ' + ph.codecVal + ': PayloadCodec[' + ph.receiptType + ']'));
  const participantBlocks = [];
  for (const p of md.participants) {
    participantBlocks.push(sectionHeader(p.stepId + ' (' + p.participantId + ', ' + p.aggregate + ')', 80), '');
    for (const ph of p.phases) {
      participantBlocks.push(
        '  def ' + ph.checkFn + '(request: OperationRequest[Args],',
        '      receipt: ' + ph.receiptType + '): Either[String, Unit] =',
        '    verifyReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,',
        '      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)',
        '',
        ...wrapDef('  def ' + ph.commandFn + '(request: OperationRequest[Args]): ' + p.protocol.replace(/Protocol$/, 'RuleParams'),
          '.' + ph.command + 'Params =', 6),
        ...wrapDef('    ' + p.protocol.replace(/Protocol$/, 'RuleParams') + '.' + ph.command + 'Params(TxId(request.identity.transaction.transactionId),',
          'request.args.' + p.argsField + ', request.args.amount)', 8),
        '');
    }
  }
  const participantRows = [];
  for (const p of md.participants) {
    const row2 = '          "' + p.participantId + '", args.' + p.argsField +
      '.value, phaseBindings(ports.' + p.phases[0].portMember + ',';
    if (row2.length <= LINE_LIMIT) {
      participantRows.push(
        '      StrictParticipant[Args]("' + p.stepId + '",',
        row2,
        '              ports.' + p.phases[1].portMember + ', ports.' + p.phases[2].portMember + ')),');
    } else {
      participantRows.push(
        '      StrictParticipant[Args]("' + p.stepId + '",',
        '          "' + p.participantId + '", args',
        '              .' + p.argsField + '.value, phaseBindings(ports.' + p.phases[0].portMember + ',',
        '                  ports.' + p.phases[1].portMember + ', ports.' + p.phases[2].portMember + ')),');
    }
  }
  const receiptChecks = [
    '    if (txid != request.identity.transaction.transactionId)',
    '      Left("' + md.messages.receiptTxidDiffers + '")',
    '    else if (definitionVersion != request.identity.transaction.definitionVersion.toString)',
    '      Left("' + md.messages.receiptDefinitionVersionDiffers + '")',
    '    else if (argsDigest != request.identity.transaction.argsDigest)',
    '      Left("' + md.messages.receiptArgsDigestDiffers + '")',
    '    else if (participant != request.identity.participantId)',
    '      Left("' + md.messages.receiptParticipantDiffers + '")',
    '    else if (resource != request.identity.resource)',
    '      Left("' + md.messages.receiptResourceDiffers + '")',
    '    else if (step != request.identity.stepId)',
    '      Left("' + md.messages.receiptStepDiffers + '")',
    '    else if (phase != request.identity.phase.toString.toLowerCase(java.util.Locale.ROOT))',
    '      Left("' + md.messages.receiptPhaseDiffers + '")',
    '    else Right(())',
  ];
  const lines = [
    'package ' + md.pkg,
    '',
    'import scala.concurrent.ExecutionContext',
    '',
    'import ' + md.supply.domainPackage + '.invariants.params.{' + protocols.map(p => p.replace(/Protocol$/, 'RuleParams')).join(', ') + '}',
    'import ' + md.supply.domainValuesPackage + '._',
    ...renderValueWildcardImports(md.basePkg, [md.args, ...allReceiptTypes(md)], 'application.process.' + md.flowSlug),
    'import ' + md.supply.strictRuntimePackage + '._',
    '',
    ...md.docs.definition,
    'object ' + md.definition + ' {',
    '',
    '  type Args = ' + argsValue,
    '',
    '  val ArgsCodecPin: CodecPin = CodecPin("' + argsValue + '", ' + md.saga.argsPinVersion + ')',
    '',
    '  /** Persistence codec port supplied by the infrastructure persistence layer. */',
    '  trait Codecs {',
    '    def argsCodec: PayloadCodec[Args]',
    ...codecContractLines,
    '  }',
    '',
    '  /** The port view the strict runtime consumes: the bound declarations',
    '    * (evidence) plus one checked phase port per participant phase. */',
    '  trait Ports {',
    '    def declarations: Map[String, (String, String)]',
    ...md.participants.flatMap(p => p.phases.map(ph =>
      '    def ' + ph.portMember + ': PhasePort[Args, ' + ph.receiptType + ']')),
    '  }',
    '',
    '  // ---------------------------------------------------------------- knowledge',
    '  val SagaId = "' + md.saga.id + '"',
    '  val SagaDefinitionVersion = ' + md.saga.definitionVersion,
    '  val SagaDefinitionDigest = "' + md.saga.definitionDigest + '"',
    '',
    '  // Coordinator assembly slots (judged): the coordinator\'s ask window and its',
    '  // in-flight participant capacity.',
    '  val CoordinatorAskMillis = ' + md.runtime.coordinator.askMillis + 'L',
    '  val CoordinatorCapacity = ' + md.runtime.coordinator.capacity,
    '',
    '  /** Every receipt must re-state exactly the durable operation it answers. */',
    '  private def verifyReceiptIdentity(',
    '    request: OperationRequest[Args],',
    '    txid: String,',
    '    definitionVersion: String,',
    '    argsDigest: String,',
    '    participant: String,',
    '    resource: String,',
    '    step: String,',
    '    phase: String,',
    '  ): Either[String, Unit] =',
    ...receiptChecks,
    '',
    ...participantBlocks,
    '  // ------------------------------------------------------------------- wiring',
    '',
    '  /** The runtime consumes binding-wrapped phase ports; the definition site is',
    '    * the single place the checked ports become runtime bindings. */',
    '  private def phaseBindings(',
    '    prepare: PhasePort[Args, _],',
    '    commit: PhasePort[Args, _],',
    '    compensate: PhasePort[Args, _],',
    '  ): Map[Phase, PhaseBinding[Args]] = Map(',
    '    Phase.Prepare -> PhaseBinding(prepare),',
    '    Phase.Commit -> PhaseBinding(commit),',
    '    Phase.Compensate -> PhaseBinding(compensate),',
    '  )',
    '',
    '  def definition(ports: Ports, argsCodec: PayloadCodec[Args])',
    '      (implicit ec: ExecutionContext): StrictSagaDefinition[Args] =',
    '    StrictSagaDefinition(SagaId, SagaDefinitionVersion, SagaDefinitionDigest, argsCodec, args => Vector(',
    ...participantRows,
    '    ))',
    '}',
  ];
  return assertWidth(lines, 'definition').join('\n') + '\n';
}

// ---------- BankPaymentProcessBootstrap.scala ----------
function emitProcessBootstrap(md) {
  const stage = md.plan;
  const hostParam = stage.camelStage + 'Host';
  const phasePortBlocks = [];
  for (const p of md.participants) {
    for (const ph of p.phases) {
      const rt = p.resourceType;
      phasePortBlocks.push(
        '      val ' + ph.portMember + ': PhasePort[Args, ' + ph.receiptType + '] =',
        '        checkedPhasePort(phasePort(technical, codecs.' + ph.codecVal + ') { (ports, request) =>',
        '          val command = ' + md.definition + '.' + ph.commandFn + '(request)',
        '          ports.' + ph.execute + '(',
        '            ' + ph.inputType + '(command.txid, command.resource, command.amount), request.identity)',
        '            .map(r => ConfirmedReceipt(request.identity, r))',
        '        } { (ports, request) =>',
        '          ports.' + ph.query + '(',
        '            ' + ph.queryType + '(TxId(request.identity.transaction.transactionId),',
        '              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,',
        '              request.identity',
        ...(
          ('                  .participantId, ' + rt + '(request.identity.resource), request.identity.stepId, phaseLower(request)),').length <= LINE_LIMIT
            ? ['                  .participantId, ' + rt + '(request.identity.resource), request.identity.stepId, phaseLower(request)),']
            : [
                '                  .participantId, ' + rt + '(request.identity.resource),',
                '                  request.identity.stepId, phaseLower(request)),',
              ]
        ),
        '            request.identity)',
        '            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)',
        '                   case None => Unknown(request.identity, "' + md.messages.typedQueryNoEvidence + '") }',
        ...(
          ('        }, codecs.' + ph.codecVal + ', ' + md.definition + '.' + ph.checkFn + ')').length <= LINE_LIMIT
            ? ['        }, codecs.' + ph.codecVal + ', ' + md.definition + '.' + ph.checkFn + ')']
            : ['        }, codecs.' + ph.codecVal + ',', '          ' + md.definition + '.' + ph.checkFn + ')']
        ),
        ...(ph === p.phases[p.phases.length - 1] && p === md.participants[md.participants.length - 1]
          ? [] : ['']));
    }
  }
  const observeTransform = [
    '          val verdict: Future[Either[String, Unit]] =',
    '            ' + md.hostIo + '.admit(original, technical).transform {',
    '              case scala.util.Success(true) => scala.util.Success(Right(()))',
    '              case scala.util.Success(false) => scala.util.Success(Left("' + md.messages.notAdmitted + '"))',
    '              case scala.util.Failure(error) => scala.util.Success(Left("' +
      md.messages.admissionUnavailablePrefix + '" + error.getMessage))',
    '            }',
    '          context.pipeToSelf(verdict)(admitted => Admitted(state.operation,',
    '              admitted.getOrElse(Left("' + md.messages.admissionUnavailable + '"))))',
  ];
  const lines = [
    'package ' + md.bootstrapPkg,
    '',
    'import scala.concurrent.{ExecutionContext, Future, Promise}',
    'import scala.concurrent.duration._',
    '',
    'import akka.actor.typed.{ActorRef, Behavior, PostStop}',
    'import akka.actor.typed.scaladsl.Behaviors',
    'import akka.persistence.typed.PersistenceId',
    'import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}',
    'import com.google.protobuf.ByteString',
    'import ' + md.supply.domainValuesPackage + '._',
    'import ' + md.pkg + '._',
    'import ' + md.pkg + '.' + md.ports + '.OperationNotExecuted',
    'import ' + md.infraProcessPkg + '.{' + md.host + ', ' + md.hostIo + '}',
    ...renderValueWildcardImports(md.basePkg, [md.original, md.result, md.args, ...allPhaseTypes(md)], 'infrastructure.bootstrap', new Set([md.original])),
    'import ' + md.persistencePkg + '.{' + md.stateCodec + ', ' + md.processCodecs + '}',
    'import ' + md.supply.strictRuntimePackage + '._',
    'import ' + md.supply.monarchPersistencePackage.replace(/\.persistence$/, '') + '.StageFailedException',
    'import ' + md.supply.monarchPersistencePackage + '.{PersistentMonarch, RunObserver}',
    '',
    '/** Runtime persistence & actor assembly for `' + md.host + '` and `' + md.execution + '`. */',
    'object ' + md.processBootstrap + ' {',
    '',
    '  def install(' + hostParam + ': ActorRef[' + md.host + '.Request]): Installed = {',
    '    require(' + hostParam + ' != null, "' + md.messages.exactHostActorRequired + '")',
    '    new Installed(' + hostParam + ')',
    '  }',
    '',
    '  final class Installed private[' + md.processBootstrap + '] (',
    '    val ' + hostParam + ': ActorRef[' + md.host + '.Request],',
    '  )',
    '',
    '  private type Args = ' + md.definition + '.Args',
    '',
    '  private def phaseLower(request: OperationRequest[Args]): String =',
    '    request.identity.phase.toString.toLowerCase(java.util.Locale.ROOT)',
    '',
    '  private def safeOutcome[Receipt](',
    '    result: Future[PhaseOutcome[Receipt]],',
    '    request: OperationRequest[Args],',
    '    face: String,',
    '  )(implicit ec: ExecutionContext): Future[PhaseOutcome[Receipt]] =',
    '    result.recover {',
    '      case ex: OperationNotExecuted',
    '          if ex.identity == request.identity && Option(ex.evidence).exists(_.nonEmpty) =>',
    '        NotExecuted(request.identity, ex.evidence, ex.safeToRetry)',
    '      case ex => Unknown(request.identity, s"' + md.messages.technicalFaceFailedPrefix + '" + ex.getMessage)',
    '    }',
    '',
    '  private def checkedPhasePort[Receipt](',
    '    underlying: PhasePort[Args, Receipt],',
    '    codec: PayloadCodec[Receipt],',
    '    receiptCheck: (OperationRequest[Args], Receipt) => Either[String, Unit],',
    '  )(implicit ec: ExecutionContext): PhasePort[Args, Receipt] = {',
    '    val validPort = underlying.receiptCodec.pin == codec.pin &&',
    '      underlying.querySafety == QuerySafety.DeclaredReadOnly',
    '    new PhasePort[Args, Receipt] {',
    '      val receiptCodec = codec',
    '      val querySafety = QuerySafety.DeclaredReadOnly',
    '      private def validated(result: Future[PhaseOutcome[Receipt]],',
    '          request: OperationRequest[Args]): Future[PhaseOutcome[Receipt]] =',
    '        if (!validPort)',
    '          Future.failed(new IllegalArgumentException("' + md.messages.readOnlyPhasePortRequired + '"))',
    '        else result.flatMap {',
    '          case confirmed @ ConfirmedReceipt(identity, receipt) =>',
    '            if (identity != request.identity)',
    '              Future.failed(new IllegalArgumentException("' + md.messages.operationIdentityMismatch + '"))',
    '            else receiptCheck(request, receipt).fold(',
    '              reason => Future.failed(new IllegalArgumentException(reason)),',
    '              _ => Future.successful(confirmed))',
    '          case other =>',
    '            if (other.identity != request.identity)',
    '              Future.failed(new IllegalArgumentException("' + md.messages.operationIdentityMismatch + '"))',
    '            else Future.successful(other)',
    '        }',
    '      def execute(request: OperationRequest[Args]): Future[PhaseOutcome[Receipt]] =',
    '        validated(underlying.execute(request), request)',
    '      def query(request: OperationRequest[Args]): Future[PhaseOutcome[Receipt]] =',
    '        validated(underlying.query(request), request)',
    '    }',
    '  }',
    '',
    '  private def phasePort[Receipt](',
    '    ports: ' + md.ports + ',',
    '    codec: PayloadCodec[Receipt],',
    '  )(exec: (' + md.ports + ', OperationRequest[Args]) => Future[PhaseOutcome[Receipt]])',
    '   (probe: (' + md.ports + ', OperationRequest[Args]) => Future[PhaseOutcome[Receipt]])',
    '   (implicit ec: ExecutionContext): PhasePort[Args, Receipt] =',
    '    new PhasePort[Args, Receipt] {',
    '      val receiptCodec = codec',
    '      val querySafety = QuerySafety.DeclaredReadOnly',
    '      def execute(request: OperationRequest[Args]): Future[PhaseOutcome[Receipt]] =',
    '        safeOutcome(exec(ports, request), request, "execute")',
    '      def query(request: OperationRequest[Args]): Future[PhaseOutcome[Receipt]] =',
    '        safeOutcome(probe(ports, request), request, "query")',
    '    }',
    '',
    '  def fromTechnical(technical: ' + md.ports + ', codecs: ' + md.definition + '.Codecs)',
    '      (implicit ec: ExecutionContext): ' + md.definition + '.Ports =',
    '    new ' + md.definition + '.Ports {',
    '      val declarations: Map[String, (String, String)] = technical.declarations',
    '',
    ...phasePortBlocks,
    '    }',
    '',
    ...(
      ('  def portsFromTechnical(technical: ' + md.ports + ')(implicit ec: ExecutionContext): ' + md.definition + '.Ports =').length <= LINE_LIMIT
        ? ['  def portsFromTechnical(technical: ' + md.ports + ')(implicit ec: ExecutionContext): ' + md.definition + '.Ports =']
        : [
            '  def portsFromTechnical(technical: ' + md.ports + ')',
            '      (implicit ec: ExecutionContext): ' + md.definition + '.Ports =',
          ]
    ),
    '    fromTechnical(technical, ' + md.processCodecs + ')',
    '',
    '  def definition(ports: ' + md.definition + '.Ports)',
    '      (implicit ec: ExecutionContext): StrictSagaDefinition[' + md.definition + '.Args] =',
    '    ' + md.definition + '.definition(ports, ' + md.processCodecs + '.argsCodec)',
    '',
    '  def coordinatorBehavior(',
    '    persistenceId: String,',
    '    ports: ' + md.definition + '.Ports,',
    '    authorizer: ReconcileAuthorizer,',
    '  )(implicit ec: ExecutionContext): Behavior[StrictSagaCoordinator.Command] = {',
    '    require(persistenceId != null && persistenceId.nonEmpty && authorizer != null,',
    '        "' + md.messages.identityAndAuthorizerRequired + '")',
    '    StrictSagaCoordinator(PersistenceId.ofUniqueId(persistenceId), definition(ports), authorizer,',
    ...(
      ('      StrictSagaCoordinator.Settings(scala.concurrent.duration.Duration(' + md.definition + '.CoordinatorAskMillis,').length <= LINE_LIMIT
        ? ['      StrictSagaCoordinator.Settings(scala.concurrent.duration.Duration(' + md.definition + '.CoordinatorAskMillis,']
        : ['      StrictSagaCoordinator.Settings(', '        scala.concurrent.duration.Duration(' + md.definition + '.CoordinatorAskMillis,']
    ),
    '          "millis"), ' + md.definition + '.CoordinatorCapacity))',
    '  }',
    '',
    '  def hostBehavior(',
    '    persistenceId: String,',
    '    coordinator: ActorRef[StrictSagaCoordinator.Command],',
    '    technical: ' + md.ports + ',',
    '  ): Behavior[' + md.host + '.Request] = Behaviors.setup { context =>',
    '    import ' + md.host + '._',
    '    require(persistenceId != null && persistenceId.nonEmpty && coordinator != null && technical != null,',
    '      "' + md.messages.explicitHostIdentityRequired + '")',
    '    implicit val ec: ExecutionContext = context.executionContext',
    '',
    '    final case class Admission(pending: Boolean, waiters: Vector[ActorRef[Reply]])',
    '    val admissionIdle = Admission(pending = false, waiters = Vector.empty)',
    '    var admission = admissionIdle',
    '',
    '    def broadcaster(waiters: Vector[ActorRef[Reply]]): ActorRef[Reply] =',
    '      context.spawnAnonymous(Behaviors.receiveMessage[Reply] { reply =>',
    '        waiters.foreach(_ ! reply); Behaviors.stopped',
    '      })',
    '',
    '    def deliver(state: State, kind: ResultKind, replyTo: ActorRef[Reply]): Unit = {',
    '      val original = originalInput(parent(state))',
    '      state.identity match {',
    '        case None => context.log.error("delivery attempted without observed identity, operation {}", state.operation)',
    '        case Some(identity) =>',
    '          context.pipeToSelf(' + md.hostIo + '.deliver(kind,',
    '              original, identity, technical))(ok => Delivered(kind, ok.getOrElse(false), replyTo))',
    '      }',
    '    }',
    '',
    '    def parent(state: State): ' + md.execution + '.State =',
    '      ' + md.stateCodec + '.codec.decode(state.original.toByteArray)',
    '',
    '    def observe(state: State, replyTo: ActorRef[Reply]): Unit =',
    '      if (!state.admitted) {',
    '        admission = admission.copy(waiters = admission.waiters :+ replyTo)',
    '        if (!admission.pending) {',
    '          admission = admission.copy(pending = true)',
    '          val original = originalInput(parent(state))',
    ...observeTransform,
    '        }',
    '      } else {',
    '        val adapter = context.spawnAnonymous(Behaviors.receiveMessage[StrictSagaCoordinator.Reply] { reply =>',
    '          context.self ! Observed(reply, replyTo); Behaviors.stopped',
    '        })',
    '        state.identity match {',
    '          case Some(identity) => coordinator ! StrictSagaCoordinator.Attach(identity, adapter)',
    '          case None => coordinator ! StrictSagaCoordinator.Start(state.operation, state.args, adapter)',
    '        }',
    '      }',
    '',
    '    EventSourcedBehavior[Request, Event, State](',
    '      PersistenceId.ofUniqueId(persistenceId),',
    '      State(),',
    '      (state, request) => request match {',
    '        case Invoke(input, replyTo) =>',
    '          val original = ByteString.copyFrom(' + md.stateCodec + '.codec.encode(input))',
    '          val args = ' + md.processCodecs + '.argsCodec.encode(invocationArgs(input))',
    '          val operation = operationIdentity(input)',
    '          if (state.operation.nonEmpty &&',
    '              (state.operation != operation || state.original != original || state.args != args)) {',
    '            Effect.none.thenRun(_ =>',
    '                replyTo ! Conflict("' + md.messages.conflictDifferentInput + '"))',
    '          } else if (state.delivered && state.result.exists(ResultKind.terminal)) {',
    '            Effect.none.thenRun(s => replyTo ! completed(s, s.result.getOrElse(ResultKind.OutcomeUnknown)))',
    '          } else if (state.operation.nonEmpty) {',
    '            Effect.none.thenRun(s => observe(s, replyTo))',
    '          } else {',
    '            context.log.debug("associating invocation {} to saga {}", operation, SagaId)',
    '            Effect.persist(Associated(original, args, operation)).thenRun(s => observe(s, replyTo))',
    '          }',
    '',
    '        case Observed(StrictSagaCoordinator.Status(status), replyTo) if !validStatus(state, status) =>',
    '          Effect.none.thenRun(_ => replyTo ! Conflict("' + md.messages.authoritativeIdentityConflict + '"))',
    '',
    '        case Observed(StrictSagaCoordinator.Status(status), replyTo) =>',
    '          val observed = classify(status)',
    '          val observedEvents = (state.identity, status.identity) match {',
    '            case (None, Some(identity)) => Vector[Event](IdentityObserved(identity))',
    '            case _ => Vector.empty',
    '          }',
    '          val events = observedEvents ++ nextResult(state.result, observed).map(ResultIntent).toVector',
    '          Effect.persist(events).thenRun { s: State =>',
    '            s.result match {',
    '              case Some(kind) if !s.delivered => deliver(s, kind, replyTo)',
    '              case Some(kind) => replyTo ! completed(s, kind)',
    '              case None => replyTo ! Pending("' + md.messages.awaitingAuthoritativeResult + '")',
    '            }',
    '          }',
    '',
    '        case Admitted(operation,',
    '            Right(())) if state.operation.nonEmpty && state.operation == operation && !state.admitted =>',
    '          Effect.persist(AdmissionGranted).thenRun { s: State =>',
    '            val waiters = admission.waiters',
    '            admission = admissionIdle',
    '            observe(s, broadcaster(waiters))',
    '          }',
    '',
    '        case Admitted(operation, Left(reason)) if state.operation == operation && !state.admitted =>',
    '          Effect.none.thenRun { _ =>',
    '            val waiters = admission.waiters',
    '            admission = admissionIdle',
    '            waiters.foreach(_ ! Pending(reason))',
    '          }',
    '',
    '        case _: Admitted => Effect.none',
    '',
    '        case Observed(StrictSagaCoordinator.Denied(reason), replyTo) =>',
    '          Effect.none.thenRun(_ => replyTo ! Pending(reason))',
    '',
    '        case Observed(StrictSagaCoordinator.ConflictingIdentity, replyTo) =>',
    '          Effect.none.thenRun(_ => replyTo ! Conflict("' + md.messages.coordinatorIdentityConflict + '"))',
    '',
    '        case Delivered(kind, true, replyTo) if state.result.contains(kind) =>',
    '          context.log.debug("receipt delivered for operation {} kind {}", state.operation, kind.wire)',
    '          Effect.persist(DeliveryAcknowledged(kind)).thenRun(s => replyTo ! completed(s, kind))',
    '',
    '        case Delivered(_, _, replyTo) =>',
    '          Effect.none.thenRun(_ => replyTo ! Pending("' + md.messages.deliveryUnacknowledged + '"))',
    '      },',
    '      (state, event) => applyEvent(state, event),',
    '    )',
    '  }',
    '',
    '  def executionBehavior(',
    '    persistenceId: String,',
    '    installed: Installed,',
    '    observer: RunObserver[' + md.execution + '.State],',
    '  )(implicit ec: ExecutionContext): Behavior[PersistentMonarch.Command[' + md.execution + '.State]] =',
    '    Behaviors.setup { context =>',
    '      import ' + md.execution + '._',
    '      require(persistenceId != null && persistenceId.nonEmpty && installed != null && observer != null,',
    '        "' + md.messages.explicitOwnedFiniteExecutionRequired + '")',
    '',
    '      final case class InvocationCall(state: State,',
    '          attempt: Int, deadline: Deadline, promise: Promise[' + pascal(stage.stageId) + 'Result])',
    '      val invocationBridge = context.spawnAnonymous(Behaviors.setup[InvocationCall] { bridgeContext =>',
    '        Behaviors.receiveMessage[InvocationCall] { call =>',
    '          bridgeContext.spawnAnonymous(Behaviors.setup[' + md.host + '.Reply] { replyContext =>',
    '            installed.' + hostParam + ' ! ' + md.host + '.Invoke(call.state, replyContext.self)',
    '            Behaviors.receiveMessage[' + md.host + '.Reply] {',
    ...wrapDef('              case ' + md.host + '.Completed(result) =>',
      ' call.promise.trySuccess(result); Behaviors.stopped', 18),
    '              case ' + md.host + '.Conflict(reason) =>',
    '                  call.promise.tryFailure(new IllegalArgumentException(reason)); Behaviors.stopped',
    '              case ' + md.host + '.Pending(_) if call.deadline.isOverdue() =>',
    ...(wrapDef('                call.promise',
      '.tryFailure(new IllegalStateException("' + stage.stageId + ' ' + md.messages.stageDeadlineExceeded +
      '")); Behaviors.stopped', 14)),
    '              case ' + md.host + '.Pending(_) =>',
    '                replyContext.scheduleOnce(backoffMillis(call.attempt).millis, bridgeContext.self,',
    '                  call.copy(attempt = call.attempt + 1))',
    '                Behaviors.same',
    '            }.receiveSignal { case (_, PostStop) =>',
    '              call.promise.tryFailure(new IllegalStateException("' +
      md.messages.ownedInvocationObserverStopped + '")); Behaviors.same',
    '            }',
    '          })',
    '          Behaviors.same',
    '        }',
    '      })',
    '',
    '      def invoke' + pascal(stage.stageId) + '(state: State): Future[' + pascal(stage.stageId) + 'Result] = {',
    '        val promise = Promise[' + pascal(stage.stageId) + 'Result]()',
    '        invocationBridge ! InvocationCall(state, attempt = 0, deadline = Deadline.now + StageDeadline, promise)',
    '        promise.future',
    '      }',
    '',
    '      val plan = Vector(StageId)',
    '      PersistentMonarch.behavior[String, State](',
    '        PersistenceId.ofUniqueId(persistenceId),',
    '        plan,',
    '        (step, state) => step match {',
    '          case StageId => invoke' + pascal(stage.stageId) + '(state).flatMap(r =>',
    '            foldResult(state, r).fold(err => Future.failed(StageFailedException(err)), Future.successful))',
    '          case _ => Future.failed(new IllegalArgumentException("' + md.messages.unknownStaticStep + '"))',
    '        },',
    '        ' + md.stateCodec + '.codec,',
    '        identity[String],',
    '        None,',
    '        observer,',
    '      )',
    '    }',
    '}',
  ];
  return assertWidth(lines, 'processBootstrap').join('\n') + '\n';
}

// ---------- top-level ----------
function generate(input) {
  validate(input);
  const md = model(input);
  const processRel = scalaDirPath(md.pkg);
  const infraProcessRel = scalaDirPath(md.infraProcessPkg);
  const persistenceRel = scalaDirPath(md.persistencePkg);
  const bootstrapRel = scalaDirPath(md.bootstrapPkg);
  return {
    [processRel + '/' + md.ports + '.scala']: emitPorts(md),
    [infraProcessRel + '/' + md.hostIo + '.scala']: emitHostIo(md),
    [persistenceRel + '/' + md.serializer + '.scala']: emitSerializer(md),
    [processRel + '/' + md.execution + '.scala']: emitExecution(md),
    [persistenceRel + '/' + md.stateCodec + '.scala']: emitExecutionStateCodec(md),
    [persistenceRel + '/' + md.processCodecs + '.scala']: emitProcessCodecs(md),
    [bootstrapRel + '/' + md.bindings + '.scala']: emitBindings(md),
    [infraProcessRel + '/' + md.host + '.scala']: emitHost(md),
    [processRel + '/' + md.definition + '.scala']: emitDefinition(md),
    [bootstrapRel + '/' + md.processBootstrap + '.scala']: emitProcessBootstrap(md),
  };
}

// ---------- negatives battery ----------
// Directed mutations of the contract, each expected to be rejected by
// validate() with the named diagnostic fragment.
const NEGATIVES = [
  { name: 'schema version drift', mutate: i => { i.schemaVersion = 'truthsrc.other-input/v1'; }, expect: 'unexpected input schema version' },
  { name: 'unsafe business case', mutate: i => { i.case = 'Payment Case'; }, expect: 'unsafe business case' },
  { name: 'unsafe generated symbol', mutate: i => { i.names.hostClass = 'Bank-Payment-Host'; }, expect: 'unsafe symbol' },
  { name: 'unsafe package', mutate: i => { i.names.package = 'Example.Bankwealth'; }, expect: 'unsafe package' },
  { name: 'definition digest loses the scheme prefix', mutate: i => { i.saga.definitionDigest = 'c13f703e'; }, expect: 'sha256: prefix' },
  { name: 'artifact version drifts from the plan version', mutate: i => { i.execution.planVersion = 'other-v1'; }, expect: 'saga artifact version' },
  { name: 'invocation markers lose a slot', mutate: i => { i.invocation.markers.pop(); }, expect: 'exactly four markers' },
  { name: 'result-kind set is not the frozen five', mutate: i => { i.results.kinds.pop(); }, expect: 'frozen five kinds' },
  { name: 'duplicate result kind', mutate: i => { i.results.kinds[1].kind = i.results.kinds[0].kind; }, expect: 'duplicate result kind' },
  { name: 'stage error tuple loses its discipline', mutate: i => { i.results.kinds[1].stageError.discipline = 'STOP'; }, expect: 'unsafe stage error tuple' },
  { name: 'participant list empty', mutate: i => { i.participants.splice(0, i.participants.length); }, expect: 'at least one participant' },
  { name: 'participant args field outside the execution inputs', mutate: i => { i.participants[0].argsField = 'walletId'; }, expect: 'must be an execution input' },
  { name: 'participant command is not a symbol', mutate: i => { i.participants[0].commands.prepare = 'reserve-funds'; }, expect: 'unsafe symbol' },
  { name: 'admission loses a gate', mutate: i => { i.admission.gates = ['entry']; }, expect: 'entry + association' },
  { name: 'binding boundary drifts from the composition root', mutate: i => { i.portBindings.boundary = 'container'; }, expect: 'sanctioned binding boundary' },
  { name: 'declared ids leave the saga context namespace', mutate: i => { i.portBindings.declaredIdStem = 'global.Flow'; }, expect: 'saga context namespace' },
  { name: 'codec pin version is not positive', mutate: i => { i.portBindings.codecPinVersion = 0; }, expect: 'codec pin version must be a positive integer' },
  { name: 'serializer identifier outside the judged band', mutate: i => { i.serializer.identifier = 799999; }, expect: 'judged 742xxx allocation' },
  { name: 'unsafe serializer manifest', mutate: i => { i.serializer.manifest = 'event v1'; }, expect: 'unsafe serializer manifest' },
  { name: 'host event PB loses its face suffix', mutate: i => { i.serializer.eventPb = 'example.bankwealth.infrastructure.hostproto.bankpaymenthostEventPB'; }, expect: 'HostEventPB face' },
  { name: 'execution stage drifts from the pipeline step', mutate: i => { i.execution.stageId = 'refund-cash'; }, expect: 'execution stage is the pipeline step' },
  { name: 'identity key outside the durable inputs', mutate: i => { i.invocation.identitySource = 'txn'; }, expect: 'identity keys must be declared execution inputs' },
  { name: 'duplicate execution input', mutate: i => { i.execution.inputs[2].name = i.execution.inputs[1].name; }, expect: 'participant args field must be an execution input' },
  { name: 'request input outside the durable inputs', mutate: i => { i.execution.requestInputs.push('phantom'); }, expect: 'must be an execution input' },
  { name: 'output field collides with a durable input', mutate: i => { i.execution.output.field = 'amount'; }, expect: 'must not collide' },
  { name: 'codec slot count drifts', mutate: i => { i.execution.codecSlots.pop(); }, expect: 'one slot per durable input' },
  { name: 'a required codec slot claims optionality', mutate: i => { i.execution.codecSlots[0].optional = true; }, expect: 'optional codec slot is the output slot' },
  { name: 'output codec slot loses the declared type', mutate: i => { i.execution.codecSlots.find(s => s.optional).type = 'OperationId'; }, expect: 'must restate the declared plan output' },
  { name: 'execution state PB loses its face suffix', mutate: i => { i.execution.executionStatePb = 'example.bankwealth.infrastructure.executionproto.bankcashpaymentv1StatePB'; }, expect: 'ExecutionStatePB face' },
  { name: 'original field outside the execution inputs', mutate: i => { i.execution.originalFields.push('phantom'); }, expect: 'must be an execution input' },
  { name: 'retry factor not positive', mutate: i => { i.runtime.retry.factor = 0; }, expect: 'positive integers' },
  { name: 'coordinator capacity not positive', mutate: i => { i.runtime.coordinator.capacity = 0; }, expect: 'coordinator ask window and capacity' },
  { name: 'layout drifts from the L1 discipline', mutate: i => { i.layout.columnLimit = 100; }, expect: '120-column discipline' },
  { name: 'message slot goes empty', mutate: i => { i.messages.awaitingAuthoritativeResult = ''; }, expect: 'nonempty text' },
  { name: 'doc block loses its comment head', mutate: i => { i.docs.host[0] = 'prose'; }, expect: 'golden-head comment array' },
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
  id: 'pipeline-invocation-face',
  familyNumber: 43,
  inputSchema: 'truthsrc.pipeline-invocation-face-input/v1',
  goldenRoot: 'test/reference/curated/pipeline-invocation-face/v1',
  fixtureDir: 'test/fixtures/pipeline-invocation-face-v1',
  toolsRef: null,
  provenance: 'handwritten-golden',
  checkInput: validate,
  renderAll: generate,
  runNegatives,
};
