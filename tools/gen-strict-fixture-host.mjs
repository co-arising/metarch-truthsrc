// Byte-exact emitter for the strict-fixture-host family (#41).
// Contract: the same fixture input must reproduce the five approved golden
// family artifacts (types.scala, StrictWire.scala, StockTransferArgsCodec.scala,
// FixtureHost.scala, StockTransferSagaEntry.scala under
// test/reference/curated/strict-fixture-host/v1/app/...) byte-for-byte.
// No golden bytes are embedded: every name, id, pin, payload mapping, evidence
// map, guard message and trigger derivation flows from the input contract
// (truthsrc.strict-fixture-host-input/v1); only emission LAYOUT shapes are
// frozen per pattern exactly as the golden shows, each documented at its site:
//   - one unified call/value packer at 96 columns (closing paren / trailing
//     comma counted) with continuations at +2
//   - plain statements render on one line when they measure <= 100
//   - frozen shapes keyed by pattern: the eight HostRequirements wiring checks
//     carry a per-field break table; TriggerStart/Args puts the first two arg
//     mappings on its first line; identity-txid evidence breaks after
//     `NotExecuted(identity,` and packs the remainder at 100; binding class
//     declarations are always two-line; the derived-hash trigger declaration is
//     two-line while the command trigger declaration is inline-if-fitting;
//     the publishCompletion signature and the FixtureHost class head are
//     frozen templates; the args-codec decode Failure message indents +4 while
//     the host receipt codecs indent +2 (golden shapes).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN_DIR = path.join(ROOT,
  'test/reference/curated/strict-fixture-host/v1/app/example/stockreservation/application/services/transactor');
const EMISSION_FILES = [
  'types.scala', 'StrictWire.scala', 'StockTransferArgsCodec.scala',
  'FixtureHost.scala', 'StockTransferSagaEntry.scala'
];

// ---------- naming (N1 continuation: PascalCase stems, lowerCamel members) ----------
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
const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty'];
const numWord = n => {
  if (!Number.isInteger(n) || n < 1 || n >= NUM_WORDS.length) {
    throw new Error('capability count outside the spelled-out range: ' + n);
  }
  return NUM_WORDS[n];
};
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'];

// The raw template's fixed runtime capability set (raw B01 order); the module-
// required capabilities from the input are appended after these ten.
const FIXED_TEN = [
  'durable-commit-decision', 'durable-abort-decision', 'typed-nonterminal-unknown',
  'safe-status-reattach', 'receipt-reconciliation', 'participant-idempotency-query',
  'pinned-definition-codec', 'manual-evidence-authorization', 'cancel-before-prepare-fencing',
  'durable-manifest'
];

// ---------- layout engine ----------
const PACK_LIMIT = 96;
const LINE_LIMIT = 100;

function packCall(indent, prefix, items, suffix, limit = PACK_LIMIT) {
  // Renders `prefix` + items joined with ", " + `suffix`, wrapping greedily at
  // `limit` columns; the suffix is counted on the final item and a trailing
  // comma on every broken line. Continuation lines sit at indent + 2.
  const lines = [];
  let current = null;
  let baseIndent = indent;
  let basePrefix = prefix;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isLast = i === items.length - 1;
    const tail = isLast ? suffix : ',';
    if (current === null) {
      const joined = item;
      const width = indent + prefix.length + joined.length + tail.length;
      if (width <= limit) {
        current = [item];
        continue;
      }
      lines.push(' '.repeat(indent) + prefix);
      baseIndent = indent + 2;
      basePrefix = '';
      current = [item];
      continue;
    }
    const joined = current.join(', ') + ', ' + item;
    const width = baseIndent + basePrefix.length + joined.length + tail.length;
    if (width <= limit) {
      current.push(item);
    } else {
      lines.push(' '.repeat(baseIndent) + basePrefix + current.join(', ') + ',');
      baseIndent = indent + 2;
      basePrefix = '';
      current = [item];
    }
  }
  lines.push(' '.repeat(baseIndent) + basePrefix + current.join(', ') + suffix);
  return lines;
}

// Header-block variant: the items always sit at `indent` (used for the
// SupportedCapabilities Set whose golden items never ride the header line).
function packBlock(indent, items, suffix, limit = PACK_LIMIT) {
  const lines = [];
  let current = null;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const tail = i === items.length - 1 ? suffix : ',';
    if (current === null) {
      current = [item];
      continue;
    }
    const joined = current.join(', ') + ', ' + item;
    if (indent + joined.length + tail.length <= limit) {
      current.push(item);
    } else {
      lines.push(' '.repeat(indent) + current.join(', ') + ',');
      current = [item];
    }
  }
  lines.push(' '.repeat(indent) + current.join(', ') + suffix);
  return lines;
}

// Wrap-at-equals: `signature = body` on one line when <= 100, else the body
// moves to indent + 2 (golden accessor/settings shape; no comma or paren).
const defWrap = (indent, signature, body) => {
  const inline = ' '.repeat(indent) + signature + ' ' + body;
  if (inline.length <= LINE_LIMIT) return [inline];
  return [' '.repeat(indent) + signature, ' '.repeat(indent + 2) + body];
};

const assertWidth = (lines, label) => {
  for (const line of lines) {
    if (line.length > LINE_LIMIT) {
      throw new Error(label + ': emitted line exceeds ' + LINE_LIMIT + ' columns (' +
        line.length + '): ' + line.slice(0, 80));
    }
  }
  return lines;
};

// Two-argument require/val statements: one line when the whole form measures
// <= 100, otherwise the standard pack (this reproduces every golden guard).
const twoPart = (indent, head, first, second, suffix = ')') => {
  const inline = ' '.repeat(indent) + head + first + ', ' + second + suffix;
  if (inline.length <= LINE_LIMIT) return [inline];
  return packCall(indent, head, [first, second], suffix);
};

// ---------- fail-closed input validation ----------
function validate(input) {
  const saga = input;
  if (saga.schemaVersion !== 'truthsrc.strict-fixture-host-input/v1') {
    throw new Error('unexpected input schema version: ' + saga.schemaVersion);
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(saga.module.objectName)) throw new Error('unsafe module name');
  if (!/^[a-z][a-z0-9-]*$/.test(saga.module.runtimeName)) throw new Error('unsafe runtime name');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(saga.deployment.entryName)) throw new Error('unsafe entry name');
  if (!/^[a-z][a-z0-9-]*$/.test(saga.deployment.namespacePrefix)) {
    throw new Error('unsafe namespace prefix');
  }
  if (!saga.deployment.reconcilePrincipal) throw new Error('reconcile principal required');
  if (!saga.deployment.reconcileTokenMismatch) throw new Error('reconcile mismatch message required');

  const typeIds = new Map(saga.args.types.map(t => [t.id, t]));
  const slotNames = saga.args.slots.map(s => s.slot);
  if (new Set(slotNames).size !== slotNames.length) throw new Error('duplicate args slot');
  for (const slot of saga.args.slots) {
    if (!typeIds.has(slot.typeId)) throw new Error('args slot references unknown typeId: ' + slot.slot);
  }
  for (const t of saga.args.types) {
    if (!/^[a-z][a-z0-9-]*$/.test(t.id)) throw new Error('unsafe declared type id: ' + t.id);
  }
  if (saga.steps.length === 0) throw new Error('empty strict saga is not supported');
  const stepIds = saga.steps.map(s => s.stepId);
  if (new Set(stepIds).size !== stepIds.length) throw new Error('duplicate step id');
  for (const step of saga.steps) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(step.stepId)) throw new Error('unsafe step id: ' + step.stepId);
    const participant = saga.participants.find(p => p.id === step.participantId);
    if (!participant) throw new Error('step references unknown participant: ' + step.stepId);
    for (const phaseName of ['prepare', 'commit', 'compensate']) {
      const phase = step.phases[phaseName];
      if (!phase) throw new Error('missing ' + phaseName + ' phase for step ' + step.stepId);
      if (!phase.receiptPin || !(phase.receiptPin.version > 0)) {
        throw new Error('receipt pin required with positive version for ' +
          step.stepId + '/' + phaseName);
      }
      if (phase.outputs.length === 0 || phase.outputs.length > ORDINALS.length) {
        throw new Error('phase outputs outside the supported 1..' + ORDINALS.length +
          ' range: ' + step.stepId + '/' + phaseName);
      }
      const outputSlots = phase.outputs.map(o => o.slot);
      if (new Set(outputSlots).size !== outputSlots.length) {
        throw new Error('duplicate receipt output slot: ' + step.stepId + '/' + phaseName);
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
      const inputSlots = new Set(phase.inputs.map(i => i.slot));
      for (const p of phase.commandPayload) {
        if (p.source.kind === 'input-slot') {
          if (!inputSlots.has(p.source.slot)) {
            throw new Error('command payload references undeclared input slot: ' + p.source.slot);
          }
        } else if (p.source.kind !== 'identity-transaction') {
          throw new Error('unsupported command payload source: ' + p.source.kind);
        }
      }
      if (phase.commandPayload.length === 0) {
        throw new Error('empty command payload for ' + step.stepId + '/' + phaseName);
      }
      const evidence = phase.evidence;
      if (!evidence || !evidence.mapField || !evidence.label) {
        throw new Error('evidence map and label required for ' + step.stepId + '/' + phaseName);
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(evidence.mapField)) {
        throw new Error('unsafe evidence map field: ' + evidence.mapField);
      }
      for (const e of evidence.markExtraction) {
        if (!outputSlots.includes(e.receiptSlot)) {
          throw new Error('evidence extraction references unknown receipt slot: ' + e.receiptSlot);
        }
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(e.markField)) {
          throw new Error('unsafe evidence mark field: ' + e.markField);
        }
      }
      if (evidence.markExtraction.length !== phase.outputs.length) {
        throw new Error('evidence extraction must cover every receipt output: ' +
          step.stepId + '/' + phaseName);
      }
    }
  }
  const participantIds = saga.participants.map(p => p.id);
  if (new Set(participantIds).size !== participantIds.length) throw new Error('duplicate participant');
  for (const participant of saga.participants) {
    const resourceType = typeIds.get(participant.resourceTypeId);
    if (!resourceType) throw new Error('participant references unknown resource type');
    if (resourceType.implementationFqn === 'java.lang.String' || resourceType.dataType.name === 'String') {
      throw new Error('resource nominal type must not be String: ' + participant.id);
    }
  }
  if (saga.triggers.length !== 2) throw new Error('the fixture family requires two triggers');
  const triggerIds = saga.triggers.map(t => t.id);
  if (new Set(triggerIds).size !== triggerIds.length) throw new Error('duplicate trigger id');
  for (const t of saga.triggers) {
    if (t.kind !== 'command' && t.kind !== 'event') throw new Error('unsupported trigger kind: ' + t.kind);
    if (!typeIds.has(t.idempotency.typeId)) throw new Error('trigger idempotency references unknown type');
    if (!typeIds.has(t.idempotency.sourceSlot)) {
      throw new Error('trigger idempotency source is not a declared type: ' + t.idempotency.sourceSlot);
    }
    const d = t.idempotency.derivation;
    if (t.kind === 'command') {
      if (!d || d.kind !== 'source-slot') {
        throw new Error('command trigger requires a source-slot idempotency derivation');
      }
    } else {
      if (!d || d.kind !== 'derived-hash' || !d.prefix || !d.fields || d.fields.length === 0) {
        throw new Error('event trigger requires a derived-hash idempotency derivation');
      }
      if (!(d.bounds[0] > 0 && d.bounds[1] >= d.bounds[0])) {
        throw new Error('derived-hash bounds must be positive and ordered');
      }
      for (const f of d.fields) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(f)) throw new Error('unsafe derivation field: ' + f);
      }
    }
    const mappingSlots = t.argMappings.map(m => m.slot);
    if (mappingSlots.length !== slotNames.length ||
      [...mappingSlots].sort().join('|') !== [...slotNames].sort().join('|')) {
      throw new Error('trigger arg mappings must cover the args slots exactly: ' + t.id);
    }
    for (const m of t.argMappings) {
      const kind = m.mapping.kind;
      if (kind === 'source-slot' || kind === 'source-field') {
        if (kind === 'source-field' && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(m.mapping.field)) {
          throw new Error('unsafe source-field name: ' + m.mapping.field);
        }
      } else if (kind === 'same-as') {
        if (!mappingSlots.includes(m.mapping.slot)) {
          throw new Error('same-as mapping references unknown arg slot: ' + m.mapping.slot);
        }
      } else if (kind === 'literal') {
        if (typeof m.mapping.value !== 'string' || m.mapping.value.length === 0) {
          throw new Error('literal mapping requires a non-empty value');
        }
      } else {
        throw new Error('unsupported trigger arg mapping: ' + kind);
      }
    }
  }
  if (saga.completions.length !== 1) throw new Error('exactly one succeeded completion required');
  const completion = saga.completions[0];
  if (completion.kind.wire !== 'succeeded') {
    throw new Error('exactly one succeeded completion required');
  }
  for (const i of completion.inputs) {
    if (i.source.kind !== 'transaction-id' && i.source.kind !== 'args') {
      throw new Error('unsupported completion value source: ' + i.source.kind);
    }
  }
  const overlapping = saga.host.capabilities.filter(c => FIXED_TEN.includes(c));
  if (overlapping.length > 0) {
    throw new Error('module capability duplicates the fixed capability set: ' + overlapping[0]);
  }
  if (saga.host.capabilities.length === 0) throw new Error('module capabilities required');
  if (!saga.host.businessInvariants || saga.host.businessInvariants.length === 0) {
    throw new Error('at least one business invariant required');
  }
  if (!saga.host.safety || saga.host.safety.length !== 8 ||
    new Set(saga.host.safety).size !== 8 || saga.host.safety.some(s => !s)) {
    throw new Error('safety wiring table requires eight distinct entries');
  }
  if (!(saga.coordinator.interactionTimeoutMs > 0)) {
    throw new Error('coordinator timeout must be positive');
  }
  if (!(saga.coordinator.maxReconcileInteractions > 0)) {
    throw new Error('coordinator reconcile budget must be positive');
  }
  const decodePattern = saga.argsCodec.decodePattern;
  if (decodePattern.length !== slotNames.length) {
    throw new Error('decode pattern must have one name per args slot');
  }
  if (new Set(decodePattern).size !== decodePattern.length) {
    throw new Error('duplicate decode pattern name');
  }
  for (const n of decodePattern) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) throw new Error('unsafe decode pattern name: ' + n);
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(saga.argsCodec.mapperFqn.split('.').pop())) {
    throw new Error('unsafe args codec class name');
  }
  for (const name of ['protocolObject', 'stateType']) {
    const t = saga.aggregate[name];
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t.name)) throw new Error('unsafe aggregate ' + name);
  }
  for (const name of ['commandRoot', 'phaseReply', 'readQuery', 'publicationCommand',
    'completionAck', 'errorType']) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(saga.aggregate[name])) {
      throw new Error('unsafe aggregate face name: ' + name);
    }
  }
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(saga.upstream.argsPin.id)) throw new Error('unsafe args pin id');
  if (!(saga.upstream.argsPin.version > 0)) throw new Error('args pin version must be positive');
}

// ---------- type helpers ----------
const typeOf = (input, typeId) => {
  const t = input.args.types.find(x => x.id === typeId);
  if (!t) throw new Error('unknown typeId: ' + typeId);
  return t;
};
// Wire conversion rules (F7): String rides the text wire raw; every other
// declared scalar converts through toString (encode) and fromString/toInt
// (decode) — the #40 probe framing precedent.
const encodeExpr = (input, slot, typeId) => {
  const t = typeOf(input, typeId);
  return t.dataType.name === 'String' ? 'value.' + slotCamel(slot) : 'value.' + slotCamel(slot) + '.toString';
};
const decodeExpr = (input, typeId, bound) => {
  const t = typeOf(input, typeId);
  switch (t.dataType.name) {
    case 'String': return bound;
    case 'Int': return bound + '.toInt';
    case 'UUID': return 'java.util.UUID.fromString(' + bound + ')';
    default: throw new Error('unsupported wire decode type: ' + t.dataType.name);
  }
};

// ---------- shared faces ----------
const importGroup = entries => {
  // entries: [{packageName, name}] → sorted `import pkg.{A, B}` lines.
  const byPackage = new Map();
  for (const e of entries) {
    const list = byPackage.get(e.packageName) ?? [];
    list.push(e.name);
    byPackage.set(e.packageName, list);
  }
  return [...byPackage.keys()].sort().map(pkg => {
    const names = [...new Set(byPackage.get(pkg))].sort();
    return 'import ' + pkg + (names.length === 1 ? '.' + names[0] : '.{' + names.join(', ') + '}');
  });
};

// ---------- types.scala ----------
function emitTypes(input) {
  const aliases = input.args.types.map(t =>
    '  type ' + slotCamel(t.id) + ' = String');
  const lines = [
    'package ' + input.module.packageName,
    '',
    '/** Generated fixture host family (strict-fixture-host): wire-level type alias',
    '  * surface for the ' + input.module.runtimeName + ' fixture. Every declared scalar is framed as',
    '  * length-prefixed text on the fixture wire (F7 ruling: Integer and Enumeration',
    '  * map to Text); this object keeps the module\'s type ids in wire order. Kebab',
    '  * contract ids are rewritten to lowerCamel members (family ruling F3, same',
    '  * symbol table as the module); the raw template would emit the ids verbatim',
    '  * and fail scalac. Wire aliases are text, not the module\'s typed fields — the',
    '  * codec layer owns the text-to-typed conversion. */',
    'object types {',
    '',
    ...aliases,
    '}'
  ];
  return assertWidth(lines, 'types.scala').join('\n') + '\n';
}

// ---------- StrictWire.scala ----------
function emitStrictWire(input) {
  const lines = [
    'package ' + input.module.packageName,
    '',
    'import com.google.protobuf.ByteString',
    '',
    'import scala.util.Try',
    '',
    '/** Generated fixture host family (strict-fixture-host): length-prefixed text',
    '  * wire (raw no-money StrictWire branch, T05 constructs verbatim). The 64 cap',
    '  * is a technical constant of the bounded-collection framing, not any contract',
    '  * maxItems. UTF8 decoding REPORTs malformed and unmappable input; truncation',
    '  * and negative lengths fail closed. The raw body iterates with mutable state;',
    '  * the frozen structure gate bans Defn.Var at every layer, so the field walk',
    '  * is tail-recursive over ByteString slices with identical checks in identical',
    '  * order (recorded deviation, D5 class). */',
    'object StrictWire {',
    '',
    '  implicit final class StrictWireOps(private val value: ByteString) extends AnyVal {',
    '    def ++(other: ByteString): ByteString = value.concat(other)',
    '  }',
    '',
    '  def lengthPrefixed(value: String): ByteString = {',
    '    require(value != null, "text field required")',
    '    val utf8 = value.getBytes(java.nio.charset.StandardCharsets.UTF_8)',
    '    ByteString.copyFrom(',
    '      java.nio.ByteBuffer.allocate(4 + utf8.length).putInt(utf8.length).put(utf8).array())',
    '  }',
    '',
    '  def readPrefixed(bytes: ByteString, count: Int): Try[(Vector[String], ByteString)] = Try {',
    '    val (fields, rest) = readFields(bytes, count, Vector.empty)',
    '    (fields, rest)',
    '  }',
    '',
    '  def lengthPrefixedAll(values: Vector[String]): ByteString = {',
    '    require(values != null && values.size <= 64, "bounded collection required")',
    '    values.foldLeft(headerBytes(values.size))((bytes, value) => bytes.concat(lengthPrefixed(value)))',
    '  }',
    '',
    '  def readPrefixedAll(bytes: ByteString): Try[(Vector[String], ByteString)] = {',
    '    require(bytes.size >= 4, "bounded collection header required")',
    '    val count = headerOf(bytes)',
    '    require(count >= 0 && count <= 64, "bounded collection count required")',
    '    readPrefixed(bytes.substring(4), count)',
    '  }',
    '',
    '  private def headerBytes(count: Int): ByteString =',
    '    ByteString.copyFrom(java.nio.ByteBuffer.allocate(4).putInt(count).array())',
    '',
    '  private def readFields(',
    '      bytes: ByteString,',
    '      remaining: Int,',
    '      acc: Vector[String]',
    '  ): (Vector[String], ByteString) =',
    '    if (remaining <= 0) (acc, bytes)',
    '    else {',
    '      require(bytes.size >= 4, "truncated length header")',
    '      val length = headerOf(bytes)',
    '      require(length >= 0, "negative field length")',
    '      require(bytes.size >= 4 + length, "truncated text field")',
    '      val chunk = decodeUtf8(bytes.substring(4, 4 + length))',
    '      readFields(bytes.substring(4 + length), remaining - 1, acc :+ chunk)',
    '    }',
    '',
    '  private def headerOf(bytes: ByteString): Int =',
    '    ((bytes.byteAt(0) & 0xff) << 24) | ((bytes.byteAt(1) & 0xff) << 16) |',
    '      ((bytes.byteAt(2) & 0xff) << 8) | (bytes.byteAt(3) & 0xff)',
    '',
    '  private def decodeUtf8(value: ByteString): String = {',
    '    val decoder = java.nio.charset.StandardCharsets.UTF_8.newDecoder()',
    '      .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)',
    '      .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)',
    '    decoder.decode(java.nio.ByteBuffer.wrap(value.toByteArray)).toString',
    '  }',
    '}'
  ];
  return assertWidth(lines, 'StrictWire.scala').join('\n') + '\n';
}

// ---------- StockTransferArgsCodec.scala ----------
function emitArgsCodec(input) {
  const codecClass = input.argsCodec.mapperFqn.split('.').pop();
  const module = input.module.objectName;
  const pin = input.upstream.argsPin;
  const encodeExprs = input.args.slots.map(s => encodeExpr(input, s.slot, s.typeId));
  const encodeLines = ['  override def encode(value: ' + module + '.Args): ByteString ='];
  encodeExprs.forEach((expr, i) => {
    const indent = i === 0 ? '    ' : '      ';
    encodeLines.push(indent + 'StrictWire.lengthPrefixed(' + expr + ')' + (i < encodeExprs.length - 1 ? ' ++' : ''));
  });
  const patternNames = input.argsCodec.decodePattern;
  const patternLine = '      case (Vector(' + patternNames.join(', ') + '), rest) =>';
  if (patternLine.length > LINE_LIMIT) throw new Error('args codec decode pattern line exceeds 100 columns');
  const convArgs = input.args.slots.map(s => decodeExpr(input, s.typeId,
    patternNames[input.args.slots.findIndex(x => x.slot === s.slot)]));
  const tryLines = packCall(10, 'Try(' + module + '.Args(', convArgs, '))');
  const lines = [
    'package ' + input.module.packageName,
    '',
    'import com.google.protobuf.ByteString',
    'import net.imadz.infra.saga.strict.{CodecPin, PayloadCodec}',
    'import scala.util.{Failure, Try}',
    '',
    'import StrictWire._',
    '',
    '/** Canonical args codec face declared by the module contract:',
    '  * ' + input.argsCodec.mapperFqn + ', ' + input.argsCodec.codecVersion + ', runtime',
    '  * pin ' + pin.id + '/' + pin.version + '. Field order is the module Args order:',
    '  * ' + input.args.slots.map(s => s.slot).join(', '),
    '  * (F7 ruling: UUID and Int ride the text wire via toString/fromString and',
    '  * toString/toInt — the #40 probe framing precedent; conversions throw inside',
    '  * Try and fail closed). Trailing bytes after the declared fields are rejected',
    '  * with the raw wire message verbatim. */',
    'final class ' + codecClass + ' extends PayloadCodec[' + module + '.Args] {',
    '',
    '  override val pin: CodecPin = CodecPin("' + pin.id + '", ' + pin.version + ')',
    '',
    ...encodeLines,
    '',
    '  override def decode(bytes: ByteString): Try[' + module + '.Args] =',
    '    StrictWire.readPrefixed(bytes, ' + input.args.slots.length + ').flatMap {',
    patternLine,
    '        if (rest.isEmpty)',
    ...tryLines,
    '        else Failure(new IllegalArgumentException(',
    '            "what wire: trailing bytes after the declared fields"))',
    '      case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))',
    '    }',
    '}'
  ];
  return assertWidth(lines, 'StockTransferArgsCodec.scala').join('\n') + '\n';
}

// ---------- FixtureHost.scala ----------
// Frozen per-field break table for the eight HostRequirements wiring checks
// (the golden breaks commit/abort/compensation/cancelBeforePrepare/manualRecovery
// after the comparison and keeps afterCommit/unknown/retryIdentity inline).
const WIRING_BREAKS = {
  commitDecision: true, abortDecision: true, afterCommit: false, unknown: false,
  compensation: true, cancelBeforePrepare: true, retryIdentity: false, manualRecovery: true
};
const WIRING_FIELDS = [
  ['commitDecision', 'commit decision wiring mismatch'],
  ['abortDecision', 'abort decision wiring mismatch'],
  ['afterCommit', 'after-commit wiring mismatch'],
  ['unknown', 'unknown wiring mismatch'],
  ['compensation', 'compensation wiring mismatch'],
  ['cancelBeforePrepare', 'cancel-before-prepare wiring mismatch'],
  ['retryIdentity', 'retry identity wiring mismatch'],
  ['manualRecovery', 'manual recovery wiring mismatch']
];

function receiptCodecClass(input, step, phaseName) {
  const stem = strictPascal(step.stepId) + strictPascal(phaseName);
  const member = strictMember(stem, 'Binding');
  const outputs = step.phases[phaseName].outputs;
  const pin = step.phases[phaseName].receiptPin;
  const names = outputs.map((_, i) => ORDINALS[i]);
  const encodeExprs = outputs.map(o => encodeExpr(input, o.slot, o.typeId));
  const decodeArgs = outputs.map((o, i) => decodeExpr(input, o.typeId, names[i]));
  const lines = [];
  lines.push('  private final class ' + stem + 'ReceiptCodec');
  lines.push('      extends PayloadCodec[' + stem + 'Receipt] {');
  lines.push('    override val pin: CodecPin = CodecPin("' + pin.id + '", ' + pin.version + ')');
  lines.push('    override def encode(value: ' + stem + 'Receipt): ByteString =');
  encodeExprs.forEach((expr, i) => {
    const indent = i === 0 ? '      ' : '        ';
    lines.push(indent + 'StrictWire.lengthPrefixed(' + expr + ')' +
      (i < encodeExprs.length - 1 ? ' ++' : ''));
  });
  lines.push('    override def decode(bytes: ByteString): Try[' + stem + 'Receipt] =');
  lines.push('      StrictWire.readPrefixed(bytes, ' + outputs.length + ').flatMap {');
  const pattern = '        case (Vector(' + names.join(', ') + '), rest) =>';
  if (pattern.length > LINE_LIMIT) throw new Error('receipt decode pattern line exceeds 100 columns');
  lines.push(pattern);
  const ctor = stem + 'Receipt(' + decodeArgs.join(', ') + '))';
  const inlineIf = '          if (rest.isEmpty) Try(' + ctor;
  if (inlineIf.length <= LINE_LIMIT) {
    lines.push(inlineIf);
  } else {
    lines.push('          if (rest.isEmpty)');
    const tryLine = '            Try(' + ctor;
    if (tryLine.length <= LINE_LIMIT) lines.push(tryLine);
    else lines.push(...packCall(12, 'Try(' + stem + 'Receipt(', decodeArgs, '))'));
  }
  lines.push('          else Failure(new IllegalArgumentException(');
  lines.push('            "what wire: trailing bytes after the declared fields"))');
  lines.push('        case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))');
  lines.push('      }');
  lines.push('  }');
  return { lines, member };
}

function bindingClass(input, step, phaseName, participant, aggMember) {
  const stem = strictPascal(step.stepId) + strictPascal(phaseName);
  const member = strictMember(stem, 'Binding');
  const phase = step.phases[phaseName];
  const command = strictPascal(phase.command.contractName);
  const protocol = input.aggregate.protocolObject.name;
  const hasTxidInput = phase.inputs.some(i => i.source.kind === 'transaction-id');
  const txidExpr = hasTxidInput ? 'input.transactionId' : 'identity.transaction.transactionId';
  const outputs = phase.outputs;
  const evidence = phase.evidence;
  const single = evidence.markExtraction.length === 1;
  const markParam = single ? evidence.markExtraction[0].markField : 'mark';
  const markArgs = evidence.markExtraction.map(e =>
    single ? e.markField : 'mark.' + e.markField);
  const lines = [];
  lines.push('  private final class ' + stem + 'Binding');
  lines.push('      extends ' + stem + 'HostBinding {');
  lines.push('    private val codec = new ' + stem + 'ReceiptCodec');
  lines.push('    def contract: PhaseContract = ' + member + 'Contract');
  lines.push('    def receiptCodec: PayloadCodec[' + stem + 'Receipt] = codec');
  lines.push('    def querySafety: QuerySafety = QuerySafety.DeclaredReadOnly');
  // execute
  lines.push('    def execute(');
  lines.push('        identity: OperationIdentity,');
  lines.push('        input: ' + stem + 'Input');
  lines.push('    ): Future[PhaseOutcome[' + stem + 'Receipt]] =');
  lines.push('      ' + aggMember + 'ReplyAsk(identity.resource, replyTo =>');
  const payloadArgs = phase.commandPayload.map(p => p.source.kind === 'identity-transaction'
    ? 'identity.transaction.transactionId'
    : 'input.' + slotCamel(p.source.slot));
  lines.push(...packCall(8, protocol + '.' + command + '(', [...payloadArgs, 'replyTo'], ')'));
  lines.push('      ).map { reply =>');
  lines.push('        reply.' + input.aggregate.replyResultField + ' match {');
  lines.push('          case Left(error) =>');
  lines.push('            NotExecuted(identity, refusedEvidence(error), safeToRetry = true)');
  const receiptArgs = outputs.map(o => 'payload.' + slotCamel(o.slot));
  if (receiptArgs.length === 1) {
    lines.push('          case Right(payload) => ConfirmedReceipt(identity,');
    const second = '            ' + stem + 'Receipt(' + receiptArgs[0] + '))';
    if (second.length > LINE_LIMIT) throw new Error('single-field receipt line exceeds 100 columns');
    lines.push(second);
  } else {
    lines.push(...packCall(10, 'case Right(payload) => ConfirmedReceipt(identity, ' +
      stem + 'Receipt(', receiptArgs, '))'));
  }
  lines.push('        }');
  lines.push('      }.recover { case throwable =>');
  lines.push('        Unknown(identity, s"' + phase.command.contractName +
    ' interaction failed: ${throwable.getMessage}")');
  lines.push('      }');
  // query
  lines.push('    def query(');
  lines.push('        identity: OperationIdentity,');
  lines.push('        input: ' + stem + 'Input');
  lines.push('    ): Future[PhaseOutcome[' + stem + 'Receipt]] =');
  lines.push('      ' + aggMember + 'StateAsk(identity.resource).map { state =>');
  const seg1 = 'state.' + evidence.mapField + '.get(' + txidExpr + ')';
  const seg2 = '.map(' + markParam + ' =>';
  const seg3 = ' ConfirmedReceipt(identity,';
  if ((8 + seg1.length + seg2.length + seg3.length) <= PACK_LIMIT) {
    lines.push('        ' + seg1 + seg2 + seg3);
  } else {
    lines.push('        ' + seg1 + seg2);
  }
  if (single) {
    const line = '          ConfirmedReceipt(identity, ' + stem + 'Receipt(' +
      markArgs.join(', ') + '))).getOrElse(';
    if (line.length <= PACK_LIMIT) lines.push(line);
    else lines.push(...packCall(10, 'ConfirmedReceipt(identity, ' + stem + 'Receipt(',
      markArgs, '))).getOrElse('));
  } else {
    const line = '          ' + stem + 'Receipt(' + markArgs.join(', ') + '))).getOrElse(';
    if (line.length <= PACK_LIMIT) lines.push(line);
    else lines.push(...packCall(10, stem + 'Receipt(', markArgs, '))).getOrElse('));
  }
  const absent = 'absentMarkEvidence("' + evidence.label + '", ' + txidExpr + ')';
  if (hasTxidInput) {
    lines.push(...packCall(10, 'NotExecuted(', ['identity', absent, 'safeToRetry = true'], '))'));
  } else {
    lines.push('          NotExecuted(identity,');
    lines.push(...packBlock(12, [absent, 'safeToRetry = true'], '))', LINE_LIMIT));
  }
  lines.push('      }.recover { case throwable =>');
  lines.push('        Unknown(identity, s"' + step.stepId +
    ' evidence query failed: ${throwable.getMessage}")');
  lines.push('      }');
  lines.push('  }');
  return lines;
}

function emitFixtureHost(input) {
  const module = input.module.objectName;
  const protocol = input.aggregate.protocolObject;
  // The private ask helpers take their stem from the aggregate protocol name
  // (WarehouseProtocol -> warehouse), never from the golden.
  const aggMember = (() => {
    const stem = protocol.name.replace(/Protocol$/, '');
    return stem.charAt(0).toLowerCase() + stem.slice(1);
  })();
  const codecClass = input.argsCodec.mapperFqn.split('.').pop();
  const capabilities = [...FIXED_TEN, ...input.host.capabilities];
  const pinNotes = [];
  for (const step of input.steps) {
    for (const phaseName of ['prepare', 'commit', 'compensate']) {
      const pin = step.phases[phaseName].receiptPin;
      if (pin.version !== 1) {
        const participant = input.participants.find(p => p.id === step.participantId);
        pinNotes.push('(' + participant.id.split('-')[0] + ' ' + phaseName +
          ' rides pin version ' + pin.version + ')');
      }
    }
  }
  const pinNoteText = pinNotes.length > 0 ? ' ' + pinNotes.join(' ') : '';
  const aggregateImports = [
    { packageName: protocol.packageName, name: protocol.name },
    ...input.triggers.filter(t => t.kind === 'command').map(t => t.sourceType)
  ];
  const eventImports = [
    ...input.triggers.filter(t => t.kind === 'event').map(t => t.sourceType),
    ...input.completions.map(c => c.eventType)
  ];
  const capItems = capabilities.map(c => JSON.stringify(c));
  const capPack = packBlock(4, capItems, ')');
  const lines = [
    'package ' + input.module.packageName,
    '',
    'import akka.actor.typed.{ActorRef, ActorSystem, Scheduler}',
    'import akka.actor.typed.scaladsl.AskPattern._',
    'import akka.cluster.sharding.typed.scaladsl.ClusterSharding',
    'import akka.persistence.typed.PersistenceId',
    'import akka.util.Timeout',
    'import com.google.protobuf.ByteString',
    ...importGroup(aggregateImports),
    'import ' + input.aggregate.stateType.packageName + '.' + input.aggregate.stateType.name,
    ...importGroup(eventImports),
    'import net.imadz.infra.saga.strict._',
    'import scala.concurrent.duration._',
    'import scala.concurrent.{ExecutionContext, Future}',
    'import scala.util.{Failure, Try}',
    'import StrictWire._',
    '',
    '/** Generated fixture host family (strict-fixture-host): the technical host for',
    '  * the admitted ' + input.module.runtimeName + ' saga module. NOT an authentication or production',
    '  * service. Every phase interaction re-derives its ask from the transaction',
    '  * identity resource (exact-resource addressing), builds receipts from the',
    '  * aggregate reply payload (F8 ruling) and re-reads them from the durable',
    '  * per-phase mark maps (F10 ruling); refusal replies fold to NotExecuted with',
    '  * safeToRetry=true, any interaction failure folds to Unknown. Aggregate',
    '  * refusal never persists events. Receipt codecs pin the module codec ids',
    '  * verbatim' + pinNoteText + '. All structural obligations',
    '  * of the module Host trait fail closed. */',
    'object FixtureHost {',
    '',
    '  /** The fixed runtime capability set (raw B01 order) plus the ' +
      numWord(input.host.capabilities.length) + ' capability',
    '    * names the admitted module\'s HostRequirements demands — a fixture-host',
    '    * profile amendment (F13): the raw template\'s CreditBalance module demanded',
    '    * none beyond the fixed ten, but this module\'s requiredHost declares',
    '    * ' + input.host.capabilities.join(' / ') + ',',
    '    * and requireImplemented filters the requirement against this set. */',
    '  val SupportedCapabilities: Set[String] = Set(',
    ...capPack,
    '',
    '  val DeclaredInvariants: Set[String] = Set(' +
      input.host.businessInvariants.map(i => JSON.stringify(i)).join(', ') + ')',
    '}',
    '',
    'final class FixtureHost(system: ActorSystem[_], sharding: ClusterSharding)(',
    '    implicit ec: ExecutionContext',
    ') extends ' + module + '.Host {',
    '  import ' + module + '._',
    '  import FixtureHost._',
    '',
    '  private val canonicalArgsCodec = new ' + codecClass,
    '  private implicit val askTimeout: Timeout = Timeout(settings.interactionTimeout)',
    '  private implicit val askScheduler: Scheduler = system.scheduler',
    '',
    '  def argsCodec: PayloadCodec[Args] = canonicalArgsCodec',
    '',
    '  def settings: StrictSagaCoordinator.Settings =',
    '    StrictSagaCoordinator.Settings(FiniteDuration(' + input.coordinator.interactionTimeoutMs +
      ', "millis"), ' + input.coordinator.maxReconcileInteractions + ')',
    '',
    '  def requireImplemented(',
    '      requirements: HostRequirements,',
    '      types: Vector[TypeContract],',
    '      argsCodec: ArgsCodecContract',
    '  ): Unit = {',
    '    requireUnsupported(requirements)',
    '    requireSafetyWiring(requirements)',
    '    requireBudgets(requirements)',
    '    require(requirements.durableManifest, "durable manifest required")',
    '    requireDeclaredInvariants(requirements)',
    '    require(argsCodec.runtimePin == argsPin, "args codec runtime pin mismatch")',
    '    requireDeclaredTypes(types)',
    '  }',
    '',
    '  private def requireUnsupported(requirements: HostRequirements): Unit =',
    ...twoPart(4, 'require(',
      'requirements.capabilities.filterNot(SupportedCapabilities.contains).isEmpty',
      '"unsupported capability required to be absent"'),
    '',
    '  private def requireSafetyWiring(requirements: HostRequirements): Unit = {',
    '    requireDecisionWiring(requirements)',
    '    requireCompensationWiring(requirements)',
    '  }',
    '',
    '  private def requireDecisionWiring(requirements: HostRequirements): Unit = {',
    ...WIRING_FIELDS.slice(0, 4).flatMap(([field, message]) =>
      wiringCheck(input, field, message)),
    '  }',
    '',
    '  private def requireCompensationWiring(requirements: HostRequirements): Unit = {',
    ...WIRING_FIELDS.slice(4).flatMap(([field, message]) =>
      wiringCheck(input, field, message)),
    '  }',
    '',
    '  private def requireBudgets(requirements: HostRequirements): Unit =',
    ...packCall(4, 'Vector(', [
      'requirements.totalDeadlineMs', 'requirements.maxParticipants',
      'requirements.maxInFlight', 'requirements.maxAttempts',
      'requirements.phaseTimeoutMs', 'requirements.queryTimeoutMs'
    ], ')'),
    '      .foreach(value => require(value > 0, "positive budget required"))',
    '',
    '  private def requireDeclaredInvariants(requirements: HostRequirements): Unit =',
    ...twoPart(4, 'require(',
      'requirements.businessInvariants.forall(DeclaredInvariants.contains)',
      '"undeclared business invariant required"'),
    '',
    '  private def requireDeclaredTypes(types: Vector[TypeContract]): Unit =',
    ...twoPart(4, 'require(', 'types.map(_.id).toSet == declaredTypeIds',
      '"declared type identity mismatch"'),
    '',
    ...packCall(2, 'private val declaredTypeIds = Set(',
      input.args.types.map(t => JSON.stringify(t.id)), ')'),
    '',
    '  def requireIndependentNamespace(persistenceId: PersistenceId): Unit =',
    '    require(persistenceId.id.startsWith("' + input.deployment.namespacePrefix +
      '/"), "independent strict namespace required")'
  ];
  // per-participant exact-resource addressing
  for (const p of input.participants) {
    const member = strictMember(strictPascal(p.id), 'Resource');
    lines.push('');
    lines.push('  // pure exact-resource addressing; no I/O');
    lines.push('  def ' + member + '(resource: java.util.UUID): String = resource.toString');
  }
  for (const p of input.participants) {
    const member = strictMember(strictPascal(p.id), 'Resource');
    lines.push('');
    lines.push(...defWrap(2, 'def ' + member + 'Contract: AddressContract =',
      module + '.' + member + 'Contract'));
  }
  for (const step of input.steps) {
    for (const phaseName of ['prepare', 'commit', 'compensate']) {
      const stem = strictPascal(step.stepId) + strictPascal(phaseName);
      const member = strictMember(stem, 'Binding');
      lines.push('');
      lines.push(...defWrap(2, 'def ' + member + ': ' + stem + 'HostBinding =',
        'new ' + stem + 'Binding'));
    }
  }
  for (const t of input.triggers) {
    const member = strictMember(strictPascal(t.id), 'Trigger');
    lines.push('');
    lines.push(...defWrap(2, 'def ' + member + ': ' + strictPascal(t.id) + 'TriggerBinding =',
      'new ' + strictPascal(t.id) + 'Trigger'));
  }
  for (const c of input.completions) {
    const member = strictMember(strictPascal(c.kind.wire), 'Completion');
    lines.push('');
    lines.push('  def ' + member + ': ' + strictPascal(c.kind.wire) + 'CompletionBinding = new ' +
      strictPascal(c.kind.wire) + 'CompletionMapper');
  }
  lines.push('');
  lines.push('  private def ' + aggMember + 'EntityRef(id: String) =');
  lines.push('    sharding.entityRefFor(' + protocol.name + '.entityKey, id)');
  lines.push('');
  lines.push('  private def ' + aggMember + 'ReplyAsk[R](');
  lines.push('      id: String,');
  lines.push('      construct: ActorRef[' + protocol.name + '.' + input.aggregate.phaseReply +
    '[R]] => ' + protocol.name + '.' + input.aggregate.commandRoot);
  lines.push('  ): Future[' + protocol.name + '.' + input.aggregate.phaseReply + '[R]] =');
  lines.push('    ' + aggMember + 'EntityRef(id).ask(construct)');
  lines.push('');
  lines.push('  private def ' + aggMember + 'StateAsk(id: String): Future[' +
    input.aggregate.stateType.name + '] =');
  lines.push('    ' + aggMember + 'EntityRef(id).ask(replyTo => ' + protocol.name + '.' +
    input.aggregate.readQuery + '(replyTo))');
  lines.push('');
  lines.push('  private def refusedEvidence(error: ' + protocol.name + '.' +
    input.aggregate.errorType + '): String =');
  lines.push('    s"refused ${error.code} ${error.message}; no events persisted"');
  lines.push('');
  lines.push('  private def absentMarkEvidence(step: String, transactionId: String): String =');
  lines.push('    s"no durable $step mark for transaction $transactionId (controlled profile only)"');
  lines.push('');
  lines.push('  private def requireBoundedText(');
  lines.push('      label: String, value: String, minLength: Int, maxLength: Int): Unit =');
  lines.push('    require(value != null && value.length >= minLength && value.length <= maxLength,');
  lines.push('      s"$label outside declared text bounds")');
  lines.push('');
  lines.push('  private def sha256Hex(value: String): String = {');
  lines.push('    val digest = java.security.MessageDigest.getInstance("SHA-256")');
  lines.push('    digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8))');
  lines.push('      .map(byte => f"${byte & 0xff}%02x").mkString');
  lines.push('  }');
  for (const step of input.steps) {
    for (const phaseName of ['prepare', 'commit', 'compensate']) {
      lines.push('');
      lines.push(...receiptCodecClass(input, step, phaseName).lines);
    }
  }
  for (const step of input.steps) {
    const participant = input.participants.find(p => p.id === step.participantId);
    for (const phaseName of ['prepare', 'commit', 'compensate']) {
      lines.push('');
      lines.push(...bindingClass(input, step, phaseName, participant, aggMember));
    }
  }
  for (const t of input.triggers) {
    lines.push('');
    lines.push(...triggerClass(input, t));
  }
  for (const c of input.completions) {
    lines.push('');
    lines.push(...completionMapperClass(input, c));
  }
  lines.push('}');
  return assertWidth(lines, 'FixtureHost.scala').join('\n') + '\n';
}

function wiringCheck(input, field, message) {
  const value = input.host.safety[WIRING_FIELDS.findIndex(([f]) => f === field)];
  const head = '    require(requirements.' + field + ' == ' + JSON.stringify(value) + ',';
  if (WIRING_BREAKS[field]) {
    return [head, '      ' + JSON.stringify(message) + ')'];
  }
  const inline = head.slice(0, -1) + ', ' + JSON.stringify(message) + ')';
  if (inline.length > LINE_LIMIT) throw new Error('wiring check exceeds 100 columns: ' + field);
  return [inline];
}

function triggerClass(input, t) {
  const member = strictMember(strictPascal(t.id), 'Trigger');
  const traitName = strictPascal(t.id) + 'TriggerBinding';
  const className = strictPascal(t.id) + 'Trigger';
  const d = t.idempotency.derivation;
  const sourceType = t.sourceType.name;
  const lines = [];
  if (t.kind === 'command') {
    lines.push('  private final class ' + className + ' extends ' + traitName + ' {');
  } else {
    lines.push('  private final class ' + className);
    lines.push('      extends ' + traitName + ' {');
  }
  lines.push('    def contract: TriggerContract = ' + member + 'Contract');
  lines.push('    def map(source: ' + sourceType + '): TriggerStart = {');
  const sourceExpr = m => {
    switch (m.mapping.kind) {
      case 'source-slot': return 'source.' + slotCamel(m.slot);
      case 'source-field': return 'source.' + m.mapping.field;
      case 'same-as': {
        const ref = t.argMappings.find(x => x.slot === m.mapping.slot);
        return sourceExpr(ref);
      }
      case 'literal': return JSON.stringify(m.mapping.value);
      default: throw new Error('unsupported trigger arg mapping: ' + m.mapping.kind);
    }
  };
  // Bounded-text validations take Strings; non-String scalars convert through
  // toString (the same F7 conversion rule the codecs use). The Args
  // construction itself passes the source values through raw.
  const validatedExpr = m => {
    const raw = sourceExpr(m);
    const type = typeOf(input, input.args.slots.find(s => s.slot === m.slot).typeId);
    return type.dataType.name === 'String' ? raw : raw + '.toString';
  };
  let derivationLines;
  let startFirst;
  if (d.kind === 'source-slot') {
    const t0 = typeOf(input, t.idempotency.typeId);
    const conv = t0.dataType.name === 'String' ? 'source.' + slotCamel(t.idempotency.sourceSlot)
      : 'source.' + slotCamel(t.idempotency.sourceSlot) + '.toString';
    derivationLines = ['      val ' + slotCamel(t.idempotency.sourceSlot) + ' = ' + conv];
    startFirst = slotCamel(t.idempotency.sourceSlot);
  } else {
    // derived-hash branch shares the tail below
    const segments = d.fields.map(f => '${source.' + f + '}');
    const full = 's"' + d.prefix + ':' + segments.join('/') + '"';
    const firstSeg = 's"' + d.prefix + ':' + segments[0] + '/"';
    const restSeg = 's"' + segments.slice(1).join('/') + '"';
    if ((6 + 'val eventIdentity = '.length + full.length + 2) <= LINE_LIMIT) {
      derivationLines = ['      val eventIdentity = ' + full];
    } else {
      derivationLines = ['      val eventIdentity = ' + firstSeg + ' +', '        ' + restSeg];
    }
    derivationLines.push('      val transactionId = sha256Hex(eventIdentity)');
    startFirst = 'transactionId';
  }
  lines.push(...derivationLines);
  if (d.kind === 'derived-hash') {
    lines.push('      requireBoundedText("transaction id", transactionId, ' +
      d.bounds[0] + ', ' + d.bounds[1] + ')');
  } else {
    const idemType = typeOf(input, t.idempotency.typeId);
    lines.push('      requireBoundedText("' + t.idempotency.sourceSlot.replace(/-/g, ' ') +
      '", ' + startFirst + ', ' + idemType.shape.minLength + ', ' + idemType.shape.maxLength + ')');
  }
  const seenExprs = new Set();
  for (const m of t.argMappings) {
    if (m.mapping.kind === 'same-as' || m.mapping.kind === 'literal') continue;
    const type = typeOf(input, input.args.slots.find(s => s.slot === m.slot).typeId);
    if (type.shape.kind !== 'Id' && type.shape.kind !== 'Text') continue;
    const expr = validatedExpr(m);
    if (seenExprs.has(expr)) continue;
    seenExprs.add(expr);
    // The bounded-text label follows the declared name: the arg slot for
    // source-slot mappings, the declared source field for source-field
    // mappings (camelCase split at the uppercase boundary).
    const label = m.mapping.kind === 'source-field'
      ? m.mapping.field.replace(/([A-Z])/g, ' $1').trim().toLowerCase()
      : m.slot.replace(/-/g, ' ');
    lines.push('      requireBoundedText("' + label + '", ' + expr + ', ' +
      type.shape.minLength + ', ' + type.shape.maxLength + ')');
  }
  const argExprs = t.argMappings.map(sourceExpr);
  lines.push(...triggerStartLines(startFirst, argExprs));
  lines.push('    }');
  lines.push('  }');
  return lines;
}

function triggerStartLines(first, argExprs) {
  // Frozen shape: TriggerStart(<idempotency val>, Args(<first two args>, on the
  // first line, the remaining mappings packed at the pack limit below.
  if (argExprs.length <= 2) {
    const inline = '      TriggerStart(' + first + ', Args(' + argExprs.join(', ') + '))';
    if (inline.length <= LINE_LIMIT) return [inline];
  }
  const head = '      TriggerStart(' + first + ', Args(';
  const firstLineItems = argExprs.slice(0, 2);
  const rest = argExprs.slice(2);
  const lines = [head + firstLineItems.join(', ') + ','];
  lines.push(...packCall(8, '', rest, '))'));
  return lines;
}

function completionMapperClass(input, c) {
  const wire = strictPascal(c.kind.wire);
  const lines = [];
  lines.push('  private final class ' + wire + 'CompletionMapper extends ' +
    wire + 'CompletionBinding {');
  lines.push('    def contract: CompletionContract = ' +
    strictMember(wire, 'Completion') + 'Contract');
  lines.push('    def map(identity: TransactionIdentity,');
  lines.push('        input: ' + wire + 'CompletionInput): ' + c.eventType.name + ' =');
  const args = c.inputs.map(i => i.source.kind === 'transaction-id'
    ? 'input.transactionId' : 'input.' + slotCamel(i.source.slot));
  lines.push(...packCall(6, c.eventType.name + '(', args, ')'));
  lines.push('  }');
  return lines;
}

// ---------- StockTransferSagaEntry.scala ----------
function emitEntry(input) {
  const module = input.module.objectName;
  const protocol = input.aggregate.protocolObject.name;
  const commandTrigger = input.triggers.find(t => t.kind === 'command');
  const eventTrigger = input.triggers.find(t => t.kind === 'event');
  const completion = input.completions[0];
  const firstStep = input.steps[0];
  const firstParticipant = input.participants.find(p => p.id === firstStep.participantId);
  const resourceMember = strictMember(strictPascal(firstParticipant.id), 'Resource');
  const publicationSlot = completion.inputs.find(i => i.source.kind === 'transaction-id').slot;
  const eventImports = [
    ...input.triggers.filter(t => t.kind === 'event').map(t => t.sourceType),
    completion.eventType
  ];
  const aggregateImports = [
    { packageName: input.aggregate.protocolObject.packageName, name: protocol },
    commandTrigger.sourceType
  ];
  const lines = [
    'package ' + input.module.packageName,
    '',
    'import akka.actor.typed.{ActorRef, ActorSystem, Behavior, Scheduler}',
    'import akka.actor.typed.scaladsl.AskPattern._',
    'import akka.actor.typed.scaladsl.Behaviors',
    'import akka.cluster.sharding.typed.scaladsl.ClusterSharding',
    'import akka.cluster.typed.{ClusterSingleton, SingletonActor}',
    'import akka.contrib.persistence.mongodb.{MongoReadJournal, ScalaDslMongoReadJournal}',
    'import akka.persistence.query.{EventEnvelope, PersistenceQuery}',
    'import akka.persistence.typed.PersistenceId',
    'import akka.stream.scaladsl.{Keep, Sink}',
    'import akka.stream.{KillSwitches, Materializer, SystemMaterializer, UniqueKillSwitch}',
    'import akka.util.Timeout',
    ...importGroup(aggregateImports),
    ...importGroup(eventImports),
    'import net.imadz.infra.saga.strict._',
    'import scala.concurrent.duration._',
    'import scala.concurrent.{ExecutionContext, Future}',
    '',
    '/** Generated fixture host family (strict-fixture-host): the deployment entry for',
    '  * the ' + input.module.runtimeName + ' fixture. The reconcile token is constant-time compared for',
    '  * authorized reconciliation only; it is a fixture token, not a production',
    '  * credential. installEventSource consumes the Mongo read journal — its',
    '  * execution needs a reachable Mongo deployment and is compile-face only in this',
    '  * fixture (F12 ruling); KillSwitch ownership stays with the caller. The',
    '  * publication entity is the first step\'s resource (' +
      firstParticipant.id.replace(/-/g, ' ') + ') resolved',
    '  * through the host\'s exact-resource addressing; the publication command',
    '  * carries the transaction id and the aggregate acks idempotently. */',
    'object ' + input.deployment.entryName + ' {',
    '',
    '  val NamespacePrefix = "' + input.deployment.namespacePrefix + '"',
    '',
    '  def persistenceId: PersistenceId =',
    '    PersistenceId.ofUniqueId(s"$NamespacePrefix/${' + module + '.name}")',
    '',
    '  def spawn(',
    '      system: ActorSystem[_],',
    '      sharding: ClusterSharding,',
    '      reconcileToken: String',
    '  )(implicit ec: ExecutionContext): ActorRef[StrictSagaCoordinator.Command] = {',
    '    require(reconcileToken != null && reconcileToken.nonEmpty, "reconcile token required")',
    '    system.systemActorOf(coordinatorBehavior(system, sharding, reconcileToken), coordinatorName)',
    '  }',
    '',
    '  def spawnClusterSingleton(',
    '      system: ActorSystem[_],',
    '      sharding: ClusterSharding,',
    '      reconcileToken: String',
    '  )(implicit ec: ExecutionContext): ActorRef[StrictSagaCoordinator.Command] = {',
    '    require(reconcileToken != null && reconcileToken.nonEmpty, "reconcile token required")',
    '    ClusterSingleton(system).init(',
    '      SingletonActor(coordinatorBehavior(system, sharding, reconcileToken), coordinatorName))',
    '  }',
    '',
    '  def start(',
    '      coordinator: ActorRef[StrictSagaCoordinator.Command],',
    '      host: ' + module + '.Host,',
    '      source: ' + commandTrigger.sourceType.name + ',',
    '      replyTo: ActorRef[StrictSagaCoordinator.Reply]',
    '  ): StrictSagaCoordinator.Start =',
    '    ' + module + '.' + strictMember(strictPascal(commandTrigger.id), 'Trigger') +
      'Start(source, host, replyTo)',
    '',
    '  def installEventSource(',
    '      system: ActorSystem[_],',
    '      sharding: ClusterSharding,',
    '      coordinator: ActorRef[StrictSagaCoordinator.Command]',
    '  )(implicit ec: ExecutionContext): UniqueKillSwitch = {',
    '    val host = new FixtureHost(system, sharding)',
    '    implicit val materializer: Materializer = SystemMaterializer(system).materializer',
    '    val replySink = system.systemActorOf(',
    '      Behaviors.receiveMessage[StrictSagaCoordinator.Reply](_ => Behaviors.same),',
    '      s"${' + module + '.name}-completion-reply-sink")',
    '    val journal = PersistenceQuery(system)',
    '      .readJournalFor[ScalaDslMongoReadJournal](MongoReadJournal.Identifier)',
    '    journal.allEvents()',
    '      .viaMat(KillSwitches.single[EventEnvelope])(Keep.right)',
    '      .toMat(Sink.foreach[EventEnvelope](envelope =>',
    '        dispatchEnvelope(system, sharding, coordinator, host, replySink, envelope)))(Keep.left)',
    '      .run()',
    '  }',
    '',
    '  def status(',
    '      coordinator: ActorRef[StrictSagaCoordinator.Command]',
    '  )(implicit timeout: Timeout, scheduler: Scheduler, ec: ExecutionContext): Future[StrictState] =',
    '    coordinator.ask(StrictSagaCoordinator.GetStatus).flatMap {',
    '      case StrictSagaCoordinator.Status(state) => Future.successful(state)',
    '      case _ => Future.failed(new IllegalStateException("unexpected coordinator reply"))',
    '    }',
    '',
    '  def completionEvent(',
    '      identity: TransactionIdentity,',
    '      args: ' + module + '.Args,',
    '      host: ' + module + '.Host,',
    '      state: StrictState',
    '  ): Option[' + completion.eventType.name + '] =',
    '    state.status match {',
    '      case StrictStatus.Succeeded =>',
    '        Some(' + module + '.' + strictMember(strictPascal(completion.kind.wire), 'Completion') +
      'Event(identity, args, host))',
    '      case StrictStatus.Aborted =>',
    '        None // no compensated / rejected-before-effects completion declared by the module',
    '      case StrictStatus.RecoveryRequired =>',
    '        None // no recovery-required completion declared by the module',
    '      case _ => None',
    '    }',
    '',
    '  def publishCompletion(',
    '      sharding: ClusterSharding,',
    '      host: ' + module + '.Host,',
    '      state: StrictState',
    '  )(implicit timeout: Timeout, scheduler: Scheduler,',
    '      ec: ExecutionContext): Future[' + protocol + '.' + input.aggregate.phaseReply + '[',
    '      ' + protocol + '.' + input.aggregate.completionAck + ']] = {',
    '    require(state.identity.nonEmpty, "transaction identity required")',
    '    require(state.terminal, "terminal state required")',
    '    val identity = state.identity.get',
    '    val args = host.argsCodec.decode(state.argsBytes).get',
    '    require(completionEvent(identity, args, host, state).nonEmpty,',
    '      "no completion event for terminal state")',
    '    completionEvent(identity, args, host, state).get match {',
    '      case completed: ' + completion.eventType.name + ' =>',
    '        val entityRef = sharding.entityRefFor(' + protocol + '.entityKey,',
    '          host.' + resourceMember + '(args.' + slotCamel(firstParticipant.resourceSlot) + '))',
    '        entityRef.ask(replyTo =>',
    ...packCall(10, protocol + '.' + input.aggregate.publicationCommand + '(',
      ['completed.' + slotCamel(publicationSlot), 'replyTo'], '))'),
    '      case _ => Future.failed(new IllegalStateException("unmapped completion event"))',
    '    }',
    '  }',
    '',
    '  private def coordinatorBehavior(',
    '      system: ActorSystem[_],',
    '      sharding: ClusterSharding,',
    '      reconcileToken: String',
    '  )(implicit ec: ExecutionContext): Behavior[StrictSagaCoordinator.Command] =',
    ...packCall(4, module + '.behavior(', ['persistenceId', 'new FixtureHost(system, sharding)',
      'FixtureReconcileAuthorizer(reconcileToken)'], ')'),
    '',
    '  private def coordinatorName: String =',
    '    s"${' + module + '.name}-strict-saga-coordinator"',
    '',
    '  private def dispatchEnvelope(',
    '      system: ActorSystem[_],',
    '      sharding: ClusterSharding,',
    '      coordinator: ActorRef[StrictSagaCoordinator.Command],',
    '      host: FixtureHost,',
    '      replySink: ActorRef[StrictSagaCoordinator.Reply],',
    '      envelope: EventEnvelope',
    '  )(implicit ec: ExecutionContext): Unit = {',
    '    implicit val askTimeout: Timeout = Timeout(15.seconds)',
    '    implicit val askScheduler: Scheduler = system.scheduler',
    '    if (envelope.persistenceId == persistenceId.id)',
    '      coordinatorEnvelope(sharding, coordinator, host, envelope)',
    '    else triggerEnvelope(coordinator, host, replySink, envelope)',
    '  }',
    '',
    '  private def coordinatorEnvelope(',
    '      sharding: ClusterSharding,',
    '      coordinator: ActorRef[StrictSagaCoordinator.Command],',
    '      host: FixtureHost,',
    '      envelope: EventEnvelope',
    '  )(implicit ec: ExecutionContext, timeout: Timeout, scheduler: Scheduler): Unit =',
    '    envelope.event match {',
    '      case StrictEvent.Succeeded => terminalPublication(sharding, coordinator, host)',
    '      case StrictEvent.Aborted => terminalPublication(sharding, coordinator, host)',
    '      case _ => ()',
    '    }',
    '',
    '  private def terminalPublication(',
    '      sharding: ClusterSharding,',
    '      coordinator: ActorRef[StrictSagaCoordinator.Command],',
    '      host: FixtureHost',
    '  )(implicit ec: ExecutionContext, timeout: Timeout, scheduler: Scheduler): Unit =',
    '    coordinator.ask(StrictSagaCoordinator.GetStatus).map {',
    '      case StrictSagaCoordinator.Status(state) => terminalState(sharding, host, state)',
    '      case _ => ()',
    '    }.failed.foreach(failure =>',
    '      Console.err.println(s"coordinator status query failed: ${failure.getMessage}"))',
    '',
    '  private def terminalState(',
    '      sharding: ClusterSharding,',
    '      host: FixtureHost,',
    '      state: StrictState',
    '  )(implicit ec: ExecutionContext, timeout: Timeout, scheduler: Scheduler): Unit =',
    '    if (state.terminal)',
    '      publishCompletion(sharding, host, state).failed.foreach(failure =>',
    '        Console.err.println(s"completion publication failed: ${failure.getMessage}"))',
    '',
    '  private def triggerEnvelope(',
    '      coordinator: ActorRef[StrictSagaCoordinator.Command],',
    '      host: FixtureHost,',
    '      replySink: ActorRef[StrictSagaCoordinator.Reply],',
    '      envelope: EventEnvelope',
    '  ): Unit =',
    '    envelope.event match {',
    '      case event: ' + eventTrigger.sourceType.name + ' =>',
    ...packCall(8, 'coordinator ! ' + module + '.' +
      strictMember(strictPascal(eventTrigger.id), 'Trigger') + 'Start(',
      ['event', 'host', 'replySink'], ')'),
    '      case _ => ()',
    '    }',
    '}',
    '',
    'final case class FixtureReconcileAuthorizer(expected: String) extends ReconcileAuthorizer {',
    '  def authorize(identity: TransactionIdentity, token: String): Either[String, String] = {',
    '    val provided = Option(token).getOrElse("")',
    '    val expectedToken = Option(expected).getOrElse("")',
    '    if (expectedToken.isEmpty) Left("' + input.deployment.reconcileTokenMismatch + '")',
    '    else if (java.security.MessageDigest.isEqual(',
    '      provided.getBytes(java.nio.charset.StandardCharsets.UTF_8),',
    '      expectedToken.getBytes(java.nio.charset.StandardCharsets.UTF_8))) Right("' +
      input.deployment.reconcilePrincipal + '")',
    '    else Left("' + input.deployment.reconcileTokenMismatch + '")',
    '  }',
    '}'
  ];
  return assertWidth(lines, 'StockTransferSagaEntry.scala').join('\n') + '\n';
}

// ---------- top-level ----------
function generate(input) {
  validate(input);
  // Emission targets mirror the module package path (raw packagePath semantics).
  const relDir = 'app/' + input.module.packageName.split('.').join('/');
  return {
    [relDir + '/types.scala']: emitTypes(input),
    [relDir + '/StrictWire.scala']: emitStrictWire(input),
    [relDir + '/StockTransferArgsCodec.scala']: emitArgsCodec(input),
    [relDir + '/FixtureHost.scala']: emitFixtureHost(input),
    [relDir + '/StockTransferSagaEntry.scala']: emitEntry(input)
  };
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
  { name: 'receipt pin version zero',
    mutate: input => { input.steps[0].phases.prepare.receiptPin.version = 0; },
    expect: 'receipt pin required' },
  { name: 'duplicate step id',
    mutate: input => { input.steps[1].stepId = input.steps[0].stepId; },
    expect: 'duplicate step id' },
  { name: 'String resource nominal type',
    mutate: input => {
      input.participants[0].resourceTypeId = 'sku';
      input.args.types.find(t => t.id === 'sku').dataType = { name: 'String', packageName: '' };
    },
    expect: 'resource nominal type must not be String' },
  { name: 'command payload references undeclared input slot',
    mutate: input => { input.steps[0].phases.commit.commandPayload[1].source.slot = 'no-such-slot'; },
    expect: 'command payload references undeclared input slot' },
  { name: 'unsupported command payload source',
    mutate: input => { input.steps[0].phases.commit.commandPayload[0].source = { kind: 'step-receipt' }; },
    expect: 'unsupported command payload source' },
  { name: 'evidence extraction references unknown receipt slot',
    mutate: input => { input.steps[0].phases.prepare.evidence.markExtraction[0].receiptSlot = 'nope'; },
    expect: 'evidence extraction references unknown receipt slot' },
  { name: 'event trigger without derived-hash derivation',
    mutate: input => { input.triggers[1].idempotency.derivation = { kind: 'source-slot' }; },
    expect: 'event trigger requires a derived-hash idempotency derivation' },
  { name: 'trigger arg mappings do not cover the args slots',
    mutate: input => { input.triggers[0].argMappings.pop(); },
    expect: 'trigger arg mappings must cover the args slots' },
  { name: 'same-as mapping references unknown arg slot',
    mutate: input => { input.triggers[1].argMappings[1].mapping.slot = 'no-such-arg'; },
    expect: 'same-as mapping references unknown arg slot' },
  { name: 'decode pattern length mismatch',
    mutate: input => { input.argsCodec.decodePattern.pop(); },
    expect: 'decode pattern must have one name per args slot' },
  { name: 'duplicate decode pattern name',
    mutate: input => { input.argsCodec.decodePattern[1] = input.argsCodec.decodePattern[0]; },
    expect: 'duplicate decode pattern name' },
  { name: 'module capability duplicates the fixed set',
    mutate: input => { input.host.capabilities[0] = 'durable-manifest'; },
    expect: 'module capability duplicates the fixed capability set' },
  { name: 'empty business invariants',
    mutate: input => { input.host.businessInvariants = []; },
    expect: 'at least one business invariant required' },
  { name: 'safety wiring table short',
    mutate: input => { input.host.safety.pop(); },
    expect: 'safety wiring table requires eight distinct entries' },
  { name: 'non-positive coordinator timeout',
    mutate: input => { input.coordinator.interactionTimeoutMs = 0; },
    expect: 'coordinator timeout must be positive' },
  { name: 'completion count not one',
    mutate: input => { input.completions.push(JSON.parse(JSON.stringify(input.completions[0]))); },
    expect: 'exactly one succeeded completion required' },
  { name: 'unsafe namespace prefix',
    mutate: input => { input.deployment.namespacePrefix = 'Strict_Saga'; },
    expect: 'unsafe namespace prefix' }
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

function main() {
  const mode = process.argv[2];
  const inputPath = process.argv[3];
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  if (mode === 'generate') {
    const outDir = process.argv[4];
    const files = generate(input);
    if (outDir) {
      for (const [rel, text] of Object.entries(files)) {
        const target = path.join(outDir, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, text);
      }
    } else {
      for (const [rel, text] of Object.entries(files)) {
        process.stdout.write('===== ' + rel + ' =====\n' + text);
      }
    }
    console.error('generated files:', Object.keys(files).length);
    return;
  }
  if (mode === 'verify') {
    const sha = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
    const run1 = generate(JSON.parse(JSON.stringify(input)));
    const run2 = generate(JSON.parse(JSON.stringify(input)));
    const perFile = [];
    for (const rel of Object.keys(run1)) {
      const golden = fs.readFileSync(path.join(GOLDEN_DIR, path.basename(rel)), 'utf8');
      perFile.push({
        file: rel,
        byteParity: run1[rel] === golden,
        producedSha256: sha(run1[rel]),
        goldenSha256: sha(golden),
        producedBytes: Buffer.byteLength(run1[rel]),
        goldenBytes: Buffer.byteLength(golden)
      });
    }
    const negatives = runNegatives(input);
    const report = {
      byteParity: perFile.every(f => f.byteParity),
      deterministic: JSON.stringify(run1) === JSON.stringify(run2),
      files: perFile,
      negatives: { expected: negatives.length, rejected: negatives.filter(n => n.rejected).length,
        results: negatives }
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.negatives.results.every(n => n.rejected)) process.exitCode = 1;
    if (!report.byteParity || !report.deterministic) {
      for (const f of perFile.filter(x => !x.byteParity)) {
        const rel = f.file;
        const a = run1[rel].split('\n');
        const b = fs.readFileSync(path.join(GOLDEN_DIR, path.basename(rel)), 'utf8').split('\n');
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
          if (a[i] !== b[i]) {
            console.error('first diff in', rel, 'at line', i + 1);
            console.error('produced:', JSON.stringify((a[i] ?? '').slice(0, 130)));
            console.error('golden  :', JSON.stringify((b[i] ?? '').slice(0, 130)));
            break;
          }
        }
      }
      process.exitCode = 1;
    }
    return;
  }
  throw new Error('Expected generate <input> [outDir] or verify <input>');
}

main();
