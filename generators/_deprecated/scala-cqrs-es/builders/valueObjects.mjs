// valueObjects.mjs — the shared value-object skeleton face (V4-16): per-VO final case class
// + companion jsonFormat, ported from ValueObjectBuilder/ValueObjectTemplate (the engine's
// domain face; AssemblyEngine assembles the VO list from fieldModel.valueObjects verbatim —
// every entry in the truth source enters the metadata and a fresh tree emits it).
// Input: canonical.voCatalog (fieldTree.valueObjects RAW form — name / noteId / fields with
// dataType/description and the optional/defaultValue/noteId extension slots).
import { scalaSig } from './types.mjs';
import { scalaIdentifier } from './naming.mjs';

const FB = 'net.imadz.common';

// member signature = DataTypeMapper (scalaSig) + Option wrap on the ②-layer optional flag
// (TypeResolver.resolveField port: optional VO member → scala.Option[T]).
const memberSig = (f) => (f.optional ? `Option[${scalaSig(f.dataType)}]` : scalaSig(f.dataType));

// Observable dependency imports of this face — exactly three kinds appear in live output:
// List → scala.collection.immutable, Id → <FB>.CommonTypes, Instant → java.time. Same-package
// VO references (List[GuardSpec]…) never import (template shouldImport drops them).
const depImportsOf = (sig, out) => {
  if (/\bList\[/.test(sig)) out.add('scala.collection.immutable.List');
  if (/\bId\b/.test(sig)) out.add(`${FB}.CommonTypes.Id`);
  if (/\bInstant\b/.test(sig)) out.add('java.time.Instant');
};

// ValueObjectBuilder.deriveLogicMethods verbatim — field-semantics business predicates
// (BUG-016 Rich Model rule; 宁缺勿造 vocabulary):
//   completion timestamps → is<Stem>: Boolean = Option(f).isDefined
//   collection fields     → has<Cap>: Boolean = Option(f).exists(_.nonEmpty)
//   source+target         → isSelfLoop: Boolean = source == target
//   description/details   → has<Cap>: Boolean (existence predicates)
// Order = completion ++ collections ++ selfLoop ++ details, first-occurrence distinct.
export function logicMethodsOf(fields) {
  const stems = { resolvedAt: 'Resolved', appliedAt: 'Applied', confirmedAt: 'Confirmed', recordedAt: 'Recorded' };
  const cap = (n) => n[0].toUpperCase() + n.slice(1);
  const byName = new Set(fields.map((f) => f.name));
  const out = [];
  for (const f of fields) if (stems[f.name]) out.push(`  def is${stems[f.name]}: Boolean = Option(${f.name}).isDefined`);
  for (const f of fields) if (f.sig.startsWith('List[')) out.push(`  def has${cap(f.name)}: Boolean = Option(${f.name}).exists(_.nonEmpty)`);
  if (byName.has('source') && byName.has('target')) out.push('  def isSelfLoop: Boolean = source == target');
  for (const f of fields) if (f.name === 'description' || f.name === 'details') out.push(`  def has${cap(f.name)}: Boolean = Option(${f.name}).exists(_.nonEmpty)`);
  return [...new Set(out)];
}

// Builder port: truth-source VO entry → render model. defaultValue rides raw (批8 P2a raw-expr
// passthrough — `List.empty`, `""`; the assembler filters empty strings to absent).
export function valueObjectModel(vo, env) {
  const fields = (vo.fields ?? []).map((f) => ({
    name: scalaIdentifier(f.name),
    sig: memberSig(f),
    defaultValue: f.defaultValue ?? '', // raw-expr passthrough; '' = absent (assembler filter(_.nonEmpty))
    noteId: f.noteId ?? null,
    description: f.description ?? '',
  }));
  const imports = new Set();
  const referencedVos = new Set();
  for (const f of fields) {
    depImportsOf(f.sig, imports);
    for (const m of f.sig.matchAll(/List\[([A-Z]\w*)\]/g)) if (m[1] !== 'String') referencedVos.add(m[1]);
  }
  const rawNoteId = String(vo.noteId ?? '').trim();
  const ownNoteId = rawNoteId && !rawNoteId.startsWith('[') ? rawNoteId : null; // carrier-list form → ledger-only (S7 #2 解边)
  return {
    name: vo.name,
    pkg: 'net.imadz.metarch.domain.values',
    fields,
    imports: [...imports].sort(),
    logicMethods: logicMethodsOf(fields),
    ownNoteId,
    noteIds: ownNoteId ? [ownNoteId] : [],
    referencedVos: [...referencedVos].sort(),
  };
}
