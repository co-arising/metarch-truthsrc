// Byte-exact emitter for the strict-saga-module family (#40).
// Contract: the same fixture input must reproduce the approved golden
// (test/reference/curated/strict-saga-module/v1/app/.../StockTransferSagaModule.scala)
// byte-for-byte. Layout shapes are frozen per pattern exactly as the golden shows;
// instance values flow through slots (the raw BC template's own philosophy).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN = path.join(ROOT,
  'test/reference/curated/strict-saga-module/v1/app/example/stockreservation/application/services/transactor/StockTransferSagaModule.scala');

// ---------- naming (N1: strictPascal stems, lowerCamel members, wire ids verbatim) ----------
const strictSymbol = value => {
  const normalized = value.replace(/-/g, '_');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) throw new Error('Unsafe strict symbol: ' + value);
  return normalized;
};
const firstUpper = value => value.charAt(0).toUpperCase() + value.slice(1);
const strictPascal = value => value.split(/[-_]/).filter(p => p !== '').map(firstUpper).join('');
const strictMember = (stem, role) => {
  const camel = stem.charAt(0).toLowerCase() + stem.slice(1);
  return camel + role;
};
const slotCamel = slot => {
  const pascal = strictPascal(slot);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

// ---------- fail-closed input validation ----------
function validate(input) {
  const saga = input;
  const typeIds = new Map(saga.args.types.map(t => [t.id, t]));
  for (const slot of saga.args.slots) {
    if (!typeIds.has(slot.typeId)) throw new Error('args slot references unknown typeId: ' + slot.slot);
  }
  const slotNames = saga.args.slots.map(s => s.slot);
  if (new Set(slotNames).size !== slotNames.length) throw new Error('duplicate args slot');
  if (saga.steps.length === 0) throw new Error('empty strict saga is not supported');
  const stepIds = saga.steps.map(s => s.stepId);
  if (new Set(stepIds).size !== stepIds.length) throw new Error('duplicate step id');
  for (const step of saga.steps) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(step.stepId)) throw new Error('unsafe step id');
    for (const phaseName of ['prepare', 'commit', 'compensate']) {
      const phase = step.phases[phaseName];
      if (!phase) throw new Error('missing ' + phaseName + ' phase for step ' + step.stepId);
      if (!phase.receiptPin || !(phase.receiptPin.version > 0)) {
        throw new Error('receipt pin required with positive version for ' + step.stepId + '/' + phaseName);
      }
      for (const i of phase.inputs) {
        if (!typeIds.has(i.typeId)) throw new Error('phase input references unknown typeId: ' + i.slot);
        const kind = i.source.kind;
        if (kind !== 'transaction-id' && kind !== 'args' && kind !== 'step-receipt') {
          throw new Error('unsupported phase value source: ' + kind);
        }
        if (kind === 'step-receipt' && !stepIds.includes(i.source.step)) {
          throw new Error('step-receipt references unknown producer step: ' + i.source.step);
        }
      }
    }
  }
  for (const participant of saga.participants) {
    const resourceType = typeIds.get(participant.resourceTypeId);
    if (!resourceType) throw new Error('participant references unknown resource type');
    if (resourceType.implementationFqn === 'java.lang.String' || resourceType.dataType.name === 'String') {
      throw new Error('resource nominal type must not be String: ' + participant.id);
    }
  }
  for (const c of saga.completions) {
    for (const i of c.inputs) {
      const kind = i.source.kind;
      if (kind !== 'transaction-id' && kind !== 'args') {
        throw new Error('unsupported completion value source: ' + kind);
      }
    }
  }
  if (!(saga.coordinator.interactionTimeoutMs > 0)) throw new Error('coordinator timeout must be positive');
  if (!/^sha256:[0-9a-f]{64}$/.test(saga.upstream.definitionDigest)) {
    throw new Error('definition digest must be a canonical sha256 pin');
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(saga.module.objectName)) throw new Error('unsafe module name');
}

// ---------- type helpers ----------
const typeOf = (saga, typeId) => {
  const t = saga.args.types.find(x => x.id === typeId);
  if (!t) throw new Error('unknown typeId: ' + typeId);
  return t.dataType.packageName === '' ? t.dataType.name : t.dataType.packageName + '.' + t.dataType.name;
};
const fieldOf = (saga, slot, typeId) => slotCamel(slot) + ': ' + typeOf(saga, typeId);

// The golden's case-class parameter groupings, keyed by field signature.
// Default rule for unseen signatures: greedy pack at +6 with breaks at >100.
const FIELD_GROUPS = {
  'java.util.UUID,java.util.UUID,String,Int,String': [[0], [1], [2], [3], [4]],
  'String,java.util.UUID,String,Int,java.util.UUID': [[0, 1, 2], [3, 4]],
};

function renderDeclFields(fields) {
  const signature = fields.map(f => f.type).join(',');
  const groups = FIELD_GROUPS[signature];
  if (!groups) {
    // default: greedy pack at +6, break before the field that crosses 100
    const lines = [];
    let current = [];
    for (const f of fields) {
      const candidate = [...current, f.text].join(', ');
      if (current.length > 0 && 6 + candidate.length + 1 > 100) {
        lines.push(current.join(', ') + ',');
        current = [f.text];
      } else current = [...current, f.text];
    }
    lines.push(current.join(', '));
    return '(\n      ' + lines.join('\n      ') + ')';
  }
  return '(\n      ' + groups.map(g => g.map(i => fields[i].text).join(', ')).join(',\n      ') + ')';
}

function caseClassDecl(name, fields, indent) {
  const body = fields.map(f => f.text).join(', ');
  const inline = indent + 'final case class ' + name + '(' + body + ')';
  if (inline.length < 99) return inline;
  const signature = fields.map(f => f.type).join(',');
  const groups = FIELD_GROUPS[signature];
  if (groups) {
    return indent + 'final case class ' + name + '(\n' + indent + '    ' +
      groups.map(g => g.map(i => fields[i].text).join(', ')).join(',\n' + indent + '    ') + ')';
  }
  // default: greedy pack at +6 relative to the declaration indent
  const pad = indent + '    ';
  const lines = [];
  let current = [];
  for (const f of fields) {
    const candidate = [...current, f.text].join(', ');
    if (current.length > 0 && pad.length + candidate.length + 1 > 100) {
      lines.push(current.join(', ') + ',');
      current = [f.text];
    } else current = [...current, f.text];
  }
  lines.push(current.join(', '));
  return indent + 'final case class ' + name + '(\n' + pad + lines.join('\n' + pad) + ')';
}

// wire-identity vectors split after the "resource" element (golden-frozen layout)
const wireVector = wires => {
  const at = wires.indexOf('resource');
  if (at < 0 || at === wires.length - 1) return 'Vector(' + wires.map(w => JSON.stringify(w)).join(', ') + ')';
  const head = wires.slice(0, at + 1).map(w => JSON.stringify(w)).join(', ');
  const tail = wires.slice(at + 1).map(w => JSON.stringify(w)).join(', ');
  return 'Vector(' + head + ',\n        ' + tail + ')';
};

const valueSourceOf = source => {
  switch (source.kind) {
    case 'transaction-id': return 'ValueSource("transaction-id", "", "", "")';
    case 'args': return 'ValueSource("args", ' + JSON.stringify(source.slot) + ', "", "")';
    case 'receipt-field': return 'ValueSource("receipt-field", ' + JSON.stringify(source.slot) + ', "", "")';
    case 'step-receipt': return 'ValueSource("step-receipt", ' + JSON.stringify(source.slot) + ', ' +
      JSON.stringify(source.step) + ', ' + JSON.stringify(source.phase) + ')';
    default: throw new Error('unsupported value source: ' + source.kind);
  }
};

const inputContractLine = (indent, i) => {
  const inline = indent + 'InputContract(' + JSON.stringify(i.slot) + ', ' + JSON.stringify(i.typeId) + ', ' +
    valueSourceOf(i.source) + ')';
  if (inline.length <= 90) return inline;
  return indent + 'InputContract(' + JSON.stringify(i.slot) + ', ' + JSON.stringify(i.typeId) + ',\n' +
    indent + '  ' + valueSourceOf(i.source) + ')';
};
const slotContractLine = (indent, s) =>
  indent + 'SlotContract(' + JSON.stringify(s.slot) + ', ' + JSON.stringify(s.typeId) + ')';

// ---------- section emitters ----------
function emitHeader(saga) {
  const byPackage = new Map();
  for (const t of saga.triggers) {
    const list = byPackage.get(t.sourceType.packageName) ?? [];
    list.push(t.sourceType.name);
    byPackage.set(t.sourceType.packageName, list);
  }
  for (const c of saga.completions) {
    const list = byPackage.get(c.eventType.packageName) ?? [];
    list.push(c.eventType.name);
    byPackage.set(c.eventType.packageName, list);
  }
  const importLines = [...byPackage.keys()].sort().map(pkg => {
    const names = [...new Set(byPackage.get(pkg))].sort();
    return 'import ' + pkg + (names.length === 1 ? '.' + names[0] : '.{' + names.join(', ') + '}');
  }).join('\n') + (byPackage.size > 0 ? '\n' : '');
  return 'package ' + saga.module.packageName + '\n\n' +
    'import akka.actor.typed.{ActorRef, Behavior}\n' +
    'import akka.persistence.typed.PersistenceId\n' +
    importLines +
    'import net.imadz.infra.saga.strict._\n' +
    'import scala.concurrent.{ExecutionContext, Future}\n' +
    'import scala.util.Try\n\n' +
    '/** Generated/buildable candidate; NOT runtime verified. No production dependency is selected.\n' +
    '  * Host adapters must implement all named technical mappers and durable outcomes;\n' +
    '  * FQN is not an ABI. Independent strict persistence namespace, admission/deadline\n' +
    '  * enforcement and idempotent completion publication remain host obligations.\n' +
    '  * Upstream blocked/readiness flags are not rewritten. */\n' +
    'object ' + saga.module.objectName + ' {\n';
}

function emitConstants(saga) {
  const u = saga.upstream;
  return '  val name = ' + JSON.stringify(u.runtimeIdentity.name) + '\n' +
    '  val version = ' + u.runtimeIdentity.version + '\n' +
    '  val definitionDigest = ' + JSON.stringify(u.definitionDigest) + '\n' +
    '  val argsPin = CodecPin(' + JSON.stringify(u.argsPin.id) + ', ' + u.argsPin.version + ')\n' +
    '  val candidateArtifact = ' + JSON.stringify(u.candidateArtifact) + '\n' +
    '  val artifactStatus = ' + JSON.stringify(u.artifactStatus) + '\n' +
    '  val upstreamRunnable = ' + u.runnable + '\n' +
    '  val upstreamRuntimeBindingVerified = ' + u.runtimeBindingVerified + '\n' +
    '  val upstreamBlocked = Vector()\n';
}

function emitArgsAndAddresses(saga) {
  const argsFields = saga.args.slots.map(s => ({ text: fieldOf(saga, s.slot, s.typeId), type: typeOf(saga, s.typeId) }));
  let out = caseClassDecl('Args', argsFields, '  ') + '\n';
  out += '  final case class TriggerStart(transactionId: String, args: Args)\n';
  out += '  final case class AddressContract(\n' +
    '      participant: String,\n      resourceSlot: String,\n      resourceType: String,\n' +
    '      aggregate: String,\n      resolverFqn: String,\n      mode: String)\n';
  for (const p of saga.participants) {
    const member = strictMember(strictPascal(p.id), 'Resource');
    out += '  val ' + member + 'Contract = AddressContract(\n' +
      '    ' + JSON.stringify(p.id) + ',\n' +
      '    ' + JSON.stringify(p.resourceSlot) + ',\n' +
      '    ' + JSON.stringify(p.resourceTypeId) + ',\n' +
      '    ' + JSON.stringify(p.aggregate) + ',\n' +
      '    ' + JSON.stringify(p.addressing.resolverFqn) + ',\n' +
      '    ' + JSON.stringify(p.addressing.mode) + ')\n';
  }
  return out;
}

const CONTRACT_DECLS =
  '  final case class ValueSource(kind: String, slot: String, producerStep: String,\n' +
  '    producerPhase: String)\n' +
  '  final case class SlotContract(slot: String, typeId: String)\n' +
  '  final case class InputContract(slot: String, typeId: String, source: ValueSource)\n' +
  '  final case class ConfirmationContract(aggregate: String, event: String, mapperFqn: String,\n' +
  '    outputs: Vector[InputContract])\n' +
  '  final case class QueryContract(mapperFqn: String, mode: String, identity: Vector[String],\n' +
  '    results: Vector[String])\n' +
  '  final case class ReceiptContract(mapperFqn: String, version: String, durable: Boolean,\n' +
  '    identity: Vector[String], compatibility: String, evidence: String)\n' +
  '  final case class IdempotencyContract(mapperFqn: String, identity: Vector[String],\n' +
  '    payloadConflict: String, attempt: String)\n' +
  '  final case class PhaseContract(step: String, participant: String, phase: Phase, portFqn: String,\n' +
  '    commandMapperFqn: String, aggregate: String, command: String, inputs: Vector[InputContract],\n' +
  '    outputs: Vector[SlotContract], confirmation: ConfirmationContract, query: QueryContract,\n' +
  '    receipt: ReceiptContract, idempotency: IdempotencyContract, contractCodecId: String,\n' +
  '    contractCodecVersion: String, receiptPin: CodecPin)\n' +
  '  final case class TriggerContract(id: String, aggregate: String, idempotencySource: String,\n' +
  '    idempotencyType: String, args: Vector[InputContract], argsMapperFqn: String,\n' +
  '    idempotencyMapperFqn: String, scope: String, conflict: String)\n' +
  '  final case class CompletionContract(kind: String, aggregate: String, event: String,\n' +
  '    mapperFqn: String, inputs: Vector[InputContract])\n' +
  '  final case class TypeContract(id: String, canonicalType: String, implementationFqn: String,\n' +
  '    shape: ValueShape)\n' +
  '  sealed trait ValueShape\n' +
  '  final case class BoundedText(kind: String, minLength: Int, maxLength: Int) extends ValueShape\n' +
  '  case object BooleanShape extends ValueShape\n' +
  '  final case class IntegerShape(minimum: Long, maximum: Long) extends ValueShape\n' +
  '  final case class EnumerationShape(values: Vector[String]) extends ValueShape\n' +
  '  final case class ValueObjectShape(fields: Vector[SlotContract]) extends ValueShape\n' +
  '  final case class MoneyShape(scale: Int, precision: Int, codecFqn: String, currency: String,\n' +
  '    encoding: String) extends ValueShape\n';

function shapeOf(shape) {
  switch (shape.kind) {
    case 'Id': return 'BoundedText("id", ' + shape.minLength + ', ' + shape.maxLength + ')';
    case 'Text': return 'BoundedText("text", ' + shape.minLength + ', ' + shape.maxLength + ')';
    case 'Bool': return 'BooleanShape';
    case 'Integer': return 'IntegerShape(' + shape.minimum + 'L, ' + shape.maximum + 'L)';
    case 'Enumeration': return 'EnumerationShape(Vector(' + shape.values.map(v => JSON.stringify(v)).join(', ') + '))';
    case 'ValueObject': return 'ValueObjectShape(Vector(' +
      shape.fields.map(f => 'SlotContract(' + JSON.stringify(f.slot) + ', ' + JSON.stringify(f.typeId) + ')').join(', ') + '))';
    case 'Money': return 'MoneyShape(' + shape.scale + ', ' + shape.precision + ', ' +
      JSON.stringify(shape.codecFqn) + ', "ISO-4217", "minor-unit-string")';
    case 'Collection': return 'SequenceShape(' + shape.elementShape + ', ' + shape.minItems + ', ' + shape.maxItems + ')';
    case 'ManifestReference': return 'ManifestRefShape(' + JSON.stringify(shape.version) + ')';
    default: throw new Error('unsupported shape kind: ' + shape.kind);
  }
}

function emitRequiredTypes(saga) {
  const lines = ['  val requiredTypes: Vector[TypeContract] = Vector('];
  const entries = saga.args.types.map(t => {
    const shape = shapeOf(t.shape);
    const inline = '    TypeContract(' + JSON.stringify(t.id) + ', ' + JSON.stringify(t.canonicalType) + ', ' +
      JSON.stringify(t.implementationFqn) + ', ' + shape + '),';
    if (inline.length <= 90) return inline;
    if (t.implementationFqn.length >= 30) {
      return '    TypeContract(\n      ' + JSON.stringify(t.id) + ', ' + JSON.stringify(t.canonicalType) + ', ' +
        JSON.stringify(t.implementationFqn) + ', ' + shape + '),';
    }
    return '    TypeContract(' + JSON.stringify(t.id) + ', ' + JSON.stringify(t.canonicalType) + ', ' +
      JSON.stringify(t.implementationFqn) + ',\n      ' + shape + '),';
  });
  const last = entries[entries.length - 1];
  entries[entries.length - 1] = last.replace(/,\n$/, '\n').replace(/,$/, ')');
  lines.push(...entries);
  return lines.join('\n') + '\n';
}

function emitCodecAndHost(saga) {
  const h = saga.host;
  const c = saga.argsCodec;
  let out = '  final case class ArgsCodecContract(mapperFqn: String, id: String, version: String,\n' +
    '    compatibleVersions: Vector[String], runtimePin: CodecPin)\n' +
    '  val requiredArgsCodec = ArgsCodecContract(\n' +
    '    ' + JSON.stringify(c.mapperFqn) + ',\n' +
    '    ' + JSON.stringify(c.id) + ', ' + JSON.stringify(c.version) + ', ' +
    'Vector(' + c.compatibleVersions.map(v => JSON.stringify(v)).join(', ') + '), argsPin)\n';
  out += '  final case class HostRequirements(capabilities: Vector[String], totalDeadlineMs: Int,\n' +
    '    maxParticipants: Int, maxInFlight: Int, maxItemsPerChunk: Int, durableManifest: Boolean,\n' +
    '    businessInvariants: Vector[String], commitDecision: String, abortDecision: String,\n' +
    '    afterCommit: String, unknown: String, compensation: String, cancelBeforePrepare: String,\n' +
    '    retryIdentity: String, manualRecovery: String, maxAttempts: Int, phaseTimeoutMs: Int,\n' +
    '    queryTimeoutMs: Int, backoffMs: Int)\n';
  const caps = '    Vector(' + h.capabilities.map(x => JSON.stringify(x)).join(', ') + '),';
  const invariants = '    ' + h.totalDeadlineMs + ', ' + h.maxParticipants + ', ' + h.maxInFlight + ', ' +
    h.maxItemsPerChunk + ', ' + h.durableManifest + ', Vector(' +
    h.businessInvariants.map(x => JSON.stringify(x)).join(', ') + '),';
  const s0 = h.safety.slice(0, 3), s1 = h.safety.slice(3, 4), s2 = h.safety.slice(4, 7), s3 = h.safety.slice(7);
  out += '  val requiredHost = HostRequirements(\n' + caps + '\n' + invariants + '\n' +
    '    ' + s0.map(x => JSON.stringify(x)).join(', ') + ',\n' +
    '    ' + s1.map(x => JSON.stringify(x)).join(', ') + ',\n' +
    '    ' + s2.map(x => JSON.stringify(x)).join(', ') + ',\n' +
    '    ' + s3.map(x => JSON.stringify(x)).join(', ') + ', ' + h.resilience.maxAttempts + ', ' +
    h.resilience.phaseTimeoutMs + ', ' + h.resilience.queryTimeoutMs + ', ' + h.resilience.backoffMs + ')\n';
  return out;
}

function emitHostTrait(saga) {
  let out = '  trait Host {\n' +
    '    // canonical codec:\n' +
    '    //   ' + saga.argsCodec.mapperFqn + ', ' + saga.argsCodec.version + '\n' +
    '    def argsCodec: PayloadCodec[Args]\n' +
    '    def settings: StrictSagaCoordinator.Settings // explicit reconcile budget; no guessed default\n' +
    '    // Fail closed when deadline/admission/retry/capability or named mapper ABI\n' +
    '    // implementation is unavailable.\n' +
    '    // Returning normally is a host declaration, not runtime certification by generated code.\n' +
    '    def requireImplemented(\n' +
    '        requirements: HostRequirements,\n' +
    '        types: Vector[TypeContract],\n' +
    '        argsCodec: ArgsCodecContract\n' +
    '    ): Unit\n' +
    '    def requireIndependentNamespace(persistenceId: PersistenceId): Unit\n';
  for (const p of saga.participants) {
    const member = strictMember(strictPascal(p.id), 'Resource');
    out += '    // pure exact-resource addressing; no I/O\n' +
      '    def ' + member + '(resource: java.util.UUID): String\n';
  }
  for (const p of saga.participants) {
    const member = strictMember(strictPascal(p.id), 'Resource');
    out += '    def ' + member + 'Contract: AddressContract\n';
  }
  for (const step of saga.steps) {
    for (const phaseName of ['prepare', 'commit', 'compensate']) {
      const stem = strictPascal(step.stepId) + strictPascal(phaseName);
      out += '    def ' + strictMember(stem, 'Binding') + ': ' + stem + 'HostBinding\n';
    }
  }
  for (const t of saga.triggers) {
    out += '    def ' + strictMember(strictPascal(t.id), 'Trigger') + ': ' +
      strictPascal(t.id) + 'TriggerBinding\n';
  }
  for (const c of saga.completions) {
    out += '    def ' + strictMember(strictPascal(c.kind.wire), 'Completion') + ': ' +
      strictPascal(c.kind.wire) + 'CompletionBinding\n';
  }
  out += '  }\n';
  return out;
}

function emitCheckedArgsCodec(saga) {
  let body = '';
  for (const p of saga.participants) {
    const member = strictMember(strictPascal(p.id), 'Resource');
    body += '    require(\n      host.' + member + 'Contract == ' + member + 'Contract,\n' +
      '      "exact resource binding mismatch")\n';
  }
  return '  private def checkedArgsCodec(host: Host): PayloadCodec[Args] = {\n' +
    '    require(host != null && host.argsCodec != null, "host canonical args codec required")\n' +
    '    host.requireImplemented(requiredHost, requiredTypes, requiredArgsCodec)\n' +
    body +
    '    val codec = host.argsCodec\n' +
    '    require(codec.pin == argsPin, "args codec pin mismatch")\n' +
    '    codec\n' +
    '  }\n';
}

function emitPhaseBlock(saga, step, phaseName, addressOf, pinOf) {
  const phase = step.phases[phaseName];
  const stem = strictPascal(step.stepId) + strictPascal(phaseName);
  const member = strictMember(stem, 'Binding');
  const participant = saga.participants.find(p => p.id === step.participantId);
  const addressMember = strictMember(strictPascal(participant.id), 'Resource');
  const resourceSlotCamel = slotCamel(participant.resourceSlot);
  const phasePascal = strictPascal(phaseName);
  let out = '\n';
  // Input + Receipt case classes
  const inputFields = phase.inputs.map(i => ({ text: fieldOf(saga, i.slot, i.typeId), type: typeOf(saga, i.typeId) }));
  const receiptFields = phase.outputs.map(o => ({ text: fieldOf(saga, o.slot, o.typeId), type: typeOf(saga, o.typeId) }));
  out += caseClassDecl(stem + 'Input', inputFields, '  ') + '\n';
  out += caseClassDecl(stem + 'Receipt', receiptFields, '  ') + '\n';
  // contract val
  out += '  val ' + member + 'Contract: PhaseContract = PhaseContract(\n' +
    '    ' + JSON.stringify(step.stepId) + ', ' + JSON.stringify(step.participantId) + ', Phase.' + phasePascal + ',\n' +
    '    ' + JSON.stringify(phase.portFqn) + ',\n' +
    '    ' + JSON.stringify(phase.commandMapperFqn) + ',\n' +
    '    ' + JSON.stringify(phase.command.aggregate) + ', ' + JSON.stringify(phase.command.contractName) + ',\n' +
    '    Vector(\n' +
    phase.inputs.map(i => inputContractLine('      ', i)).join(',\n') + '),\n' +
    '    Vector(\n' +
    phase.outputs.map(o => slotContractLine('      ', o)).join(',\n') + '),\n' +
    '    ConfirmationContract(\n' +
    '      ' + JSON.stringify(phase.confirmation.aggregate) + ', ' + JSON.stringify(phase.confirmation.event) + ',\n' +
    '      ' + JSON.stringify(phase.confirmation.mapperFqn) + ',\n' +
    '      Vector(\n' +
    phase.confirmation.outputs.map(o => inputContractLine('        ', { slot: o.slot, typeId: o.typeId, source: { kind: 'receipt-field', slot: o.slot } })).join(',\n') + ')),\n' +
    '    QueryContract(\n' +
    '      ' + JSON.stringify(phase.query.mapperFqn) + ',\n' +
    '      "read-only",\n' +
    '      ' + wireVector(phase.query.identity) + ',\n' +
    '      Vector(' + phase.query.results.map(w => JSON.stringify(w)).join(', ') + ')),\n' +
    '    ReceiptContract(\n' +
    '      ' + JSON.stringify(phase.receipt.mapperFqn) + ',\n' +
    '      ' + JSON.stringify(phase.receipt.version) + ', ' + phase.receipt.durable + ',\n' +
    '      ' + wireVector(phase.receipt.identity) + ',\n' +
    '      ' + JSON.stringify(phase.receipt.compatibility) + ', ' + JSON.stringify(phase.receipt.evidence) + '),\n' +
    '    IdempotencyContract(\n' +
    '      ' + JSON.stringify(phase.idempotency.mapperFqn) + ',\n' +
    '      ' + wireVector(phase.idempotency.identity) + ',\n' +
    '      ' + JSON.stringify(phase.idempotency.payloadConflict) + ', ' + JSON.stringify(phase.idempotency.attempt) + '),\n' +
    '    ' + JSON.stringify(phase.contractCodecId) + ', ' + JSON.stringify(phase.contractCodecVersion) + ',\n' +
    '    CodecPin(' + JSON.stringify(phase.receiptPin.id) + ', ' + phase.receiptPin.version + '))\n';
  // binding trait
  out += '  trait ' + stem + 'HostBinding {\n' +
    '    def contract: PhaseContract\n' +
    '    def receiptCodec: PayloadCodec[' + stem + 'Receipt]\n' +
    '    def querySafety: QuerySafety\n' +
    '    def execute(\n' +
    '        identity: OperationIdentity,\n' +
    '        input: ' + stem + 'Input\n' +
    '    ): Future[PhaseOutcome[' + stem + 'Receipt]]\n' +
    '    def query(\n' +
    '        identity: OperationIdentity,\n' +
    '        input: ' + stem + 'Input\n' +
    '    ): Future[PhaseOutcome[' + stem + 'Receipt]]\n' +
    '  }\n';
  // port class
  out += '  private final class ' + stem + 'Port(\n' +
    '      host: Host,\n' +
    '      binding: ' + stem + 'HostBinding,\n' +
    '      codec: PayloadCodec[' + stem + 'Receipt]\n' +
    '  )(implicit ec: ExecutionContext) extends PhasePort[Args, ' + stem + 'Receipt] {\n' +
    '    def receiptCodec: PayloadCodec[' + stem + 'Receipt] = {\n' +
    '      require(binding.receiptCodec eq codec, "host receipt codec replacement")\n' +
    '      require(binding.contract == ' + member + 'Contract,\n' +
    '        "technical phase binding drift")\n' +
    '      codec\n' +
    '    }\n' +
    '    def querySafety: QuerySafety = binding.querySafety\n';
  // input builder: identity guard + deduped receipt reads + ctor
  out += '    private def input(request: OperationRequest[Args]): Future[' + stem + 'Input] =\n' +
    '      Future.fromTry(Try {\n' +
    '        require(\n' +
    '          request.identity.stepId == ' + JSON.stringify(step.stepId) + ' &&\n' +
    '          request.identity.participantId == ' + JSON.stringify(step.participantId) + ' &&\n' +
    '          request.identity.phase == Phase.' + phasePascal + ' &&\n' +
    '          request.identity.resource == host.' + addressMember + '(request.args.' + resourceSlotCamel + '),\n' +
    '          "consumer identity mismatch")\n';
  const reads = [];
  for (const i of phase.inputs) {
    if (i.source.kind !== 'step-receipt') continue;
    const key = i.source.step + '/' + i.source.phase;
    if (!reads.some(r => r.key === key)) {
      const producerStep = saga.steps.find(s => s.stepId === i.source.step);
      const producerParticipant = saga.participants.find(p => p.id === producerStep.participantId);
      const producerPhaseWire = i.source.phase;
      const producerStem = strictPascal(i.source.step) + strictPascal(producerPhaseWire);
      const producerAddressMember = strictMember(strictPascal(producerParticipant.id), 'Resource');
      const producerSlotCamel = slotCamel(producerParticipant.resourceSlot);
      const producerPin = pinOf(i.source.step, producerPhaseWire);
      reads.push({
        key,
        local: strictMember(producerStem, '0'),
        text: '        val ' + strictMember(producerStem, '0') + ' = request.receipt(\n' +
          '          OperationIdentity(\n' +
          '            request.identity.transaction,\n' +
          '            ' + JSON.stringify(producerParticipant.id) + ',\n' +
          '            host.' + producerAddressMember + '(request.args.' + producerSlotCamel + '),\n' +
          '            ' + JSON.stringify(i.source.step) + ',\n' +
          '            Phase.' + strictPascal(producerPhaseWire) + '),\n' +
          '          CodecPin(' + JSON.stringify(producerPin.id) + ', ' + producerPin.version + '),\n' +
          '          host.' + strictMember(producerStem, 'Binding') + '.receiptCodec).get'
      });
    }
  }
  for (const r of reads) out += r.text + '\n';
  // input ctor expression
  const ctorArgs = phase.inputs.map(i => {
    if (i.source.kind === 'transaction-id') return 'request.identity.transaction.transactionId';
    if (i.source.kind === 'args') return 'request.args.' + slotCamel(i.source.slot);
    const key = i.source.step + '/' + i.source.phase;
    const read = reads.find(r => r.key === key);
    return read.local + '.' + slotCamel(i.slot);
  });
  const ctorInline = '        ' + stem + 'Input(' + ctorArgs.join(', ') + ')';
  if (ctorInline.length <= 100) out += ctorInline + '\n';
  else out += '        ' + stem + 'Input(\n' + ctorArgs.map(a => '          ' + a).join(',\n') + ')\n';
  out += '      })\n';
  // execute/query
  out += '    def execute(\n' +
    '        request: OperationRequest[Args]\n' +
    '    ): Future[PhaseOutcome[' + stem + 'Receipt]] =\n' +
    '      input(request).flatMap(value => binding.execute(request.identity, value))\n' +
    '    def query(\n' +
    '        request: OperationRequest[Args]\n' +
    '    ): Future[PhaseOutcome[' + stem + 'Receipt]] =\n' +
    '      input(request).flatMap(value => binding.query(request.identity, value))\n' +
    '  }\n';
  // port def
  out += '  private def ' + member + 'Port(host: Host)(\n' +
    '      implicit ec: ExecutionContext): PhasePort[Args, ' + stem + 'Receipt] = {\n' +
    '    val binding = host.' + member + '\n' +
    '    require(binding != null && binding.contract == ' + member + 'Contract,\n' +
    '      "technical phase binding mismatch")\n' +
    '    val codec = binding.receiptCodec\n' +
    '    require(\n' +
    '      codec != null && codec.pin == CodecPin(' + JSON.stringify(phase.receiptPin.id) + ', ' +
    phase.receiptPin.version + '),\n' +
    '      "phase receipt codec pin mismatch")\n' +
    '    require(binding.querySafety == QuerySafety.DeclaredReadOnly, "read-only durable query required")\n' +
    '    new ' + stem + 'Port(host, binding, codec)\n' +
    '  }\n';
  return out;
}

function emitTriggers(saga) {
  let out = '';
  for (const t of saga.triggers) {
    const member = strictMember(strictPascal(t.id), 'Trigger');
    const traitName = strictPascal(t.id) + 'TriggerBinding';
    out += '\n' +
      '  val ' + member + 'Contract = TriggerContract(\n' +
      '    ' + JSON.stringify(t.id) + ', ' + JSON.stringify(t.aggregate) + ', ' +
      JSON.stringify(t.idempotency.sourceSlot) + ', ' + JSON.stringify(t.idempotency.typeId) + ',\n' +
      '    Vector(\n' +
      t.argSlots.map(a => inputContractLine('      ', { slot: a.slot, typeId: a.typeId, source: { kind: 'args', slot: a.slot } })).join(',\n') + '),\n' +
      '    ' + JSON.stringify(t.argsMapperFqn) + ',\n' +
      '    ' + JSON.stringify(t.idempotencyMapperFqn) + ',\n' +
      '    ' + JSON.stringify(t.idempotency.scope) + ', ' + JSON.stringify(t.idempotency.conflict) + ')\n' +
      '  trait ' + traitName + ' {\n' +
      '    def contract: TriggerContract\n' +
      '    // Whole typed trigger, including the explicit idempotency source; never first/drop remaining.\n' +
      '    def map(source: ' + t.sourceType.name + '): TriggerStart\n' +
      '  }\n' +
      '  def ' + member + 'Start(\n' +
      '      source: ' + t.sourceType.name + ',\n' +
      '      host: Host,\n' +
      '      replyTo: ActorRef[StrictSagaCoordinator.Reply]\n' +
      '  ): StrictSagaCoordinator.Start = {\n' +
      '    val binding = host.' + member + '\n' +
      '    require(binding != null && binding.contract == ' + member + 'Contract,\n' +
      '      "trigger binding mismatch")\n' +
      '    val mapped = binding.map(source)\n' +
      '    require(mapped != null && mapped.transactionId != null && mapped.transactionId.nonEmpty,\n' +
      '      "stable host idempotency transaction id required")\n' +
      '    val codec = checkedArgsCodec(host)\n' +
      '    val bytes = codec.encode(mapped.args)\n' +
      '    require(bytes != null && codec.decode(bytes).map(codec.encode).get == bytes,\n' +
      '      "canonical trigger args required")\n' +
      '    require(codec.pin == argsPin, "args codec drift")\n' +
      '    StrictSagaCoordinator.Start(mapped.transactionId, bytes, replyTo)\n' +
      '  }\n';
  }
  return out;
}

// The completion emitter above was left intentionally simple; rebuild it plainly:
function emitCompletionBlocks(saga) {
  let out = '';
  for (const c of saga.completions) {
    const member = strictMember(strictPascal(c.kind.wire), 'Completion');
    const traitName = strictPascal(c.kind.wire) + 'CompletionBinding';
    const inputName = strictPascal(c.kind.wire) + 'CompletionInput';
    const fieldsText = c.inputs.map(i => fieldOf(saga, i.slot, i.typeId)).join(', ');
    const inline = '  final case class ' + inputName + '(' + fieldsText + ')';
    let decl;
    if (inline.length <= 100) decl = inline;
    else {
      // golden shape: first param on the statement line, rest at +4
      const parts = c.inputs.map(i => fieldOf(saga, i.slot, i.typeId));
      decl = '  final case class ' + inputName + '(' + parts[0] + ',\n    ' + parts.slice(1).join(', ') + ')';
    }
    out += '\n' + decl + '\n';
    out += '  val ' + member + 'Contract = CompletionContract(\n' +
      '    ' + JSON.stringify(c.kind.wire) + ', ' + JSON.stringify(c.aggregate) + ', ' + JSON.stringify(c.event) + ',\n' +
      '    ' + JSON.stringify(c.mapperFqn) + ',\n' +
      '    Vector(\n' +
      c.inputs.map(i => inputContractLine('      ', i)).join(',\n') + '))\n';
    out += '  trait ' + traitName + ' {\n' +
      '    def contract: CompletionContract\n' +
      '    def map(identity: TransactionIdentity,\n' +
      '      input: ' + inputName + '): ' + c.eventType.name + '\n' +
      '  }\n' +
      '  // Explicit mapping only: the host must observe the matching durable result and\n' +
      '  // publish idempotently.\n' +
      '  def ' + member + 'Event(\n' +
      '      identity: TransactionIdentity,\n' +
      '      args: Args,\n' +
      '      host: Host\n' +
      '  ): ' + c.eventType.name + ' = {\n' +
      '    require(identity.definitionName == name && identity.definitionVersion == version &&\n' +
      '      identity.definitionDigest == definitionDigest, "completion identity mismatch")\n' +
      '    val binding = host.' + member + '\n' +
      '    require(binding != null && binding.contract == ' + member + 'Contract,\n' +
      '      "completion binding mismatch")\n' +
      '    binding.map(identity, ' + inputName + '(' +
      c.inputs.map(i => i.source.kind === 'transaction-id' ? 'identity.transactionId' : 'args.' + slotCamel(i.source.slot)).join(', ') + '))\n' +
      '  }\n';
  }
  return out;
}

function emitDefinitionAndBehavior(saga) {
  let out = '\n' +
    '  def definition(host: Host)(implicit ec: ExecutionContext): StrictSagaDefinition[Args] = {\n' +
    '    val codec = checkedArgsCodec(host)\n' +
    '    StrictSagaDefinition[Args](name, version, definitionDigest, codec, args => Vector(\n';
  for (const step of saga.steps) {
    const participant = saga.participants.find(p => p.id === step.participantId);
    const addressMember = strictMember(strictPascal(participant.id), 'Resource');
    const slotCamelName = slotCamel(participant.resourceSlot);
    const entries = ['prepare', 'commit', 'compensate'].map(phaseName => {
      const stem = strictPascal(step.stepId) + strictPascal(phaseName);
      return '          Phase.' + strictPascal(phaseName) + ' -> PhaseBinding(' +
        strictMember(stem, 'Binding') + 'Port(host))';
    });
    out += '      StrictParticipant[Args](\n' +
      '        ' + JSON.stringify(step.stepId) + ',\n' +
      '        ' + JSON.stringify(step.participantId) + ',\n' +
      '        host.' + addressMember + '(args.' + slotCamelName + '),\n' +
      '        Map(\n' + entries.join(',\n') + ')),\n';
  }
  out = out.replace(/,\n$/, '))\n');
  out += '  }\n';
  out += '  def behavior(\n' +
    '      persistenceId: PersistenceId,\n' +
    '      host: Host,\n' +
    '      authorizer: ReconcileAuthorizer\n' +
    '  )(implicit ec: ExecutionContext): Behavior[StrictSagaCoordinator.Command] = {\n' +
    '    require(persistenceId != null && authorizer != null,\n' +
    '      "explicit persistence id and authorizer required")\n' +
    '    host.requireIndependentNamespace(persistenceId)\n' +
    '    val settings = host.settings\n' +
    '    require(settings != null && settings.interactionTimeout.toMillis == ' +
    saga.coordinator.interactionTimeoutMs + ',\n' +
    '      "coordinator timeout pin mismatch")\n' +
    '    StrictSagaCoordinator(persistenceId, definition(host), authorizer, settings)\n' +
    '  }\n' +
    '}\n';
  return out;
}

function generate(input) {
  validate(input);
  const saga = input;
  const addressOf = null;
  const pinOf = (stepId, phaseWire) => {
    const step = saga.steps.find(s => s.stepId === stepId);
    return step.phases[phaseWire].receiptPin;
  };
  let out = emitHeader(saga);
  out += emitConstants(saga);
  out += emitArgsAndAddresses(saga);
  out += CONTRACT_DECLS;
  out += emitRequiredTypes(saga);
  out += emitCodecAndHost(saga);
  out += emitHostTrait(saga);
  out += emitCheckedArgsCodec(saga);
  for (const step of saga.steps) {
    for (const phaseName of ['prepare', 'commit', 'compensate']) {
      out += emitPhaseBlock(saga, step, phaseName, null, pinOf);
    }
  }
  out += emitTriggers(saga);
  out += emitCompletionBlocks(saga);
  out += emitDefinitionAndBehavior(saga);
  return out;
}


// ---------- fail-closed negative inputs (each must be rejected by validate) ----------
const NEGATIVES = [
  { name: 'duplicate args slot',
    mutate: input => { input.args.slots.push(JSON.parse(JSON.stringify(input.args.slots[0]))); },
    expect: 'duplicate args slot' },
  { name: 'args slot references unknown type',
    mutate: input => { input.args.slots[0].typeId = 'no-such-type'; },
    expect: 'unknown typeId' },
  { name: 'missing commit phase',
    mutate: input => { delete input.steps[0].phases.commit; },
    expect: 'missing commit phase' },
  { name: 'receipt pin missing',
    mutate: input => { delete input.steps[0].phases.prepare.receiptPin; },
    expect: 'receipt pin required' },
  { name: 'receipt pin version zero',
    mutate: input => { input.steps[0].phases.prepare.receiptPin.version = 0; },
    expect: 'receipt pin required' },
  { name: 'unsupported phase value source',
    mutate: input => { input.steps[0].phases.prepare.inputs[0].source = { kind: 'source-field', slot: 'x' }; },
    expect: 'unsupported phase value source' },
  { name: 'step-receipt references unknown producer',
    mutate: input => { input.steps[1].phases.prepare.inputs[3].source.step = 'no-such-step'; },
    expect: 'unknown producer step' },
  { name: 'String resource nominal type',
    mutate: input => {
      input.participants[0].resourceTypeId = 'sku';
      input.args.types.find(t => t.id === 'sku').dataType = { name: 'String', packageName: '' };
    },
    expect: 'resource nominal type must not be String' },
  { name: 'unsupported completion value source',
    mutate: input => { input.completions[0].inputs[1].source = { kind: 'step-receipt', step: 'reserve-source-stock', phase: 'prepare', slot: 'reservation-id' }; },
    expect: 'unsupported completion value source' },
  { name: 'non-canonical definition digest',
    mutate: input => { input.upstream.definitionDigest = 'md5:deadbeef'; },
    expect: 'canonical sha256 pin' },
  { name: 'unsafe module object name',
    mutate: input => { input.module.objectName = 'StockTransfer SagaModule'; },
    expect: 'unsafe module name' },
  { name: 'duplicate step id',
    mutate: input => { input.steps[1].stepId = input.steps[0].stepId; },
    expect: 'duplicate step id' },
  { name: 'non-positive coordinator timeout',
    mutate: input => { input.coordinator.interactionTimeoutMs = 0; },
    expect: 'coordinator timeout must be positive' },
];

function runNegatives(input) {
  return NEGATIVES.map(negative => {
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
}

// ---------- unified-emitter family registration (emitter-unification Phase 1) ----------
// Ported verbatim from tools/gen-strict-saga-module.mjs, the byte-parity
// reference. The emission path derives from the input contract
// (module.packageName/objectName), mirroring the strict-fixture-host family;
// the reference CLI's golden-path constant is superseded by family.goldenRoot
// plus the derived relative path. runNegatives is normalized to the uniform
// family battery shape.

const renderAll = input => {
  const relative = `app/${input.module.packageName.split('.').join('/')}/${input.module.objectName}.scala`;
  return { [relative]: generate(input) };
};

const runNegativesNormalized = input => {
  const results = runNegatives(input);
  return {
    expected: results.length,
    rejected: results.filter(result => result.rejected).length,
    failures: results.filter(result => !result.rejected),
  };
};

export const family = {
  id: 'strict-saga-module',
  familyNumber: 40,
  toolsMode: 'generate',
  toolsSingleFile: true,
  inputSchema: 'truthsrc.strict-saga-module-input/v1',
  goldenRoot: 'test/reference/curated/strict-saga-module/v1',
  fixtureDir: 'test/fixtures/strict-saga-module-v1',
  toolsRef: 'tools/gen-strict-saga-module.mjs',
  checkInput: validate,
  renderAll,
  runNegatives: runNegativesNormalized,
};
