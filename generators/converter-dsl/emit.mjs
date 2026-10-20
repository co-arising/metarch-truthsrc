#!/usr/bin/env node
// === converter-dsl emitter — 1:1 restoration of old codegen (AggregateConverterBuilder) ===
// Generates: <Agg>ProtoConverters.scala (trait with nested <X>Conv objects)
// Usage: node emit.mjs <spec.json> <out.scala>
//
// Spec: {
//   package: "net.imadz.metarch.infrastructure.persistence.converters",
//   name: "Concept",                     // aggregate PascalCase
//   valuesPackage: "net.imadz.metarch.domain.values",
//   entityPackage: "net.imadz.metarch.domain.entities",
//   protoPackage: "net.imadz.metarch.infrastructure.proto",            // base; the
//      aggregate's own PO package is protoPackage + "." + snake(name)  //   aggregate's own
//   sharedProtoPackage: "...proto.shared_value_objects",
//   identifier: { name, dataType, noteId } | null,   // aggregate id field
//      (prepended to the state converter; dataType is "String (UUID)" → IdConv)
//   valueObjects: [{ name, fields: [{ name, dataType, noteId, optional }] }],  // full VO catalog
//   converters: [{ name, domainType, protoType, fields: [{ name, dataType, noteId, optional }] }],
//      // one entry for the state + one per event; fields are RAW canonical dataTypes
// }
//
// Golden (ingested-app): header CodegenMain:225ed28b + @knowledge-release, package,
// ONE codepoint-sorted import list: import trio (java.time.Instant /
// CommonTypes.Id / PrimitiveConverter), per-event+state entity imports, per-referenced-VO
// values imports, per-event+state+own-VO PO imports, per-shared-VO PO imports,
// scala.collection.immutable.List iff a List<...> field exists.
// Body: VO converters (alphabetical) → event converters (alphabetical) → state converter,
// then ListConv / InstantConv helpers + the S2-82-B3 self-companion object.
// Field conversion rules were derived empirically by classifying every field expression
// in all 27 golden converter files against the canonical RAW dataType (see the
// conversion-expr table in the verification report).

import { readFileSync, writeFileSync } from "fs";

const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const agg = spec.name;
const pkg = spec.package || "net.imadz.metarch.infrastructure.persistence.converters";
const traitName = `${agg}ProtoConverters`;
const entityPkg = spec.entityPackage || "net.imadz.metarch.domain.entities";
const valuesPkg = spec.valuesPackage || "net.imadz.metarch.domain.values";
const protoBase = spec.protoPackage || "net.imadz.metarch.infrastructure.proto";
const sharedProtoPkg = spec.sharedProtoPackage || `${protoBase}.shared_value_objects`;

// deterministic across locales (golden orderings are codepoint)
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const snake = (s) =>
  s
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
const aggProtoPkg = `${protoBase}.${snake(agg)}`;

// ─── Shared-VO set ───
// Ported from old codegen AggregateRootProtoBuilder.voOwnerMap + buildShared: a VO's PO
// is defined ONCE — in shared_value_objects.proto iff its VO-component (VOs linked by
// VO-typed fields) is referenced by >=2 aggregates' state/event fields; otherwise in the
// single referencing aggregate's own proto file. The component count needs global
// knowledge, which a per-aggregate spec cannot carry, so the golden set for this truth
// source is pinned here (message list of shared_value_objects.proto); VOs outside it
// resolve to this aggregate's own proto package (matches old codegen's fallback and
// every golden converter file: no cross-aggregate local VO PO import exists).
// If the truth source changes such that the shared set must change, the emitter needs
// a `sharedVoNames` list in the spec (run-all side).
const SHARED_VOS = new Set([
  "AggregateRelationSpec", "CatalogConflict", "CatalogConflictSet", "CatalogPatchSet",
  "CodeAnchorDelta", "ConceptDelta", "ConceptIndexEntry", "EdgeTarget", "EventBinding",
  "FieldCommandSpec", "FieldEdge", "FieldEventSpec", "FieldParamSpec", "FieldSpec",
  "FieldStateSpec", "GuardSpec", "ParticipantRole", "RelationDelta", "RuleRef",
  "StateGateSpec", "StatusTransitionSpec", "UcStep",
]);

// ─── Type analysis (RAW canonical dataTypes) ───
const VO_NAMES = new Set((spec.valueObjects || []).map((v) => v.name));
const voByName = new Map((spec.valueObjects || []).map((v) => [v.name, v]));
// strip List<>/Array<> wrappers to the innermost type
const innerType = (t) => {
  const m = /^(?:List|Array)<(.+)>$/.exec((t || "").trim());
  return m ? innerType(m[1]) : (t || "").trim();
};
const isListType = (t) => /^(?:List|Array)</.test((t || "").trim());
const isVOType = (t) => VO_NAMES.has(innerType(t));
// primitive/scalar converter for a NON-list type; null => direct passthrough
const scalarConv = (inner) => {
  if (inner === "String (UUID)") return "IdConv";
  if (inner === "Instant") return "InstantConv";
  if (VO_NAMES.has(inner)) return `${inner}Conv`;
  return null;
};

// ─── Field conversion expressions ───
// Empirically derived (all 27 golden files vs canonical RAW types):
//   String/String (Enum)/String (JSON)/JSON/Boolean/Integer/Int → direct d.f / p.f
//   String (UUID)  → IdConv.toProto(d.f) / IdConv.fromProto(p.f)
//   Instant        → InstantConv.toProto(d.f) / InstantConv.fromProto(p.f)
//   VO (bare, ANY optional flag) → Some(VConv.toProto(d.f)) /
//     VConv.fromProto(p.f.getOrElse(throw new IllegalArgumentException(
//       s"Missing required field: f")))   — proto3 message fields are Option in scalapb
//   List<X>        → d.f.map(Xc.toProto) / p.f.map(Xc.fromProto).toList   (Xc = Id/String/Instant/VO conv)
//   Array<String>  behaves exactly like List<String>
//   optional List<X>  → d.f.getOrElse(Nil).map(Xc.toProto) / Some(p.f.map(Xc.fromProto).toList)
//   optional String-ish (String / String (Enum) / JSON) → d.f.map(StringConv.toProto) / p.f.map(StringConv.fromProto)
//   optional Boolean  → direct d.f / p.f
// Unobserved shapes (optional Id, optional Instant) fall back to the .map convention and
// are listed in the verification report.
// Scala keywords (only `type` occurs in this truth source, in Note) are backticked in
// both the argument name and the d./p. accessor (golden NoteProtoConverters).
const SCALA_KEYWORDS = new Set([
  "abstract", "case", "catch", "class", "def", "do", "else", "extends", "false",
  "final", "finally", "for", "forSome", "if", "implicit", "import", "lazy", "match",
  "new", "null", "object", "override", "package", "private", "protected", "return",
  "sealed", "super", "this", "throw", "trait", "try", "true", "type", "val", "var",
  "while", "with", "yield",
]);
const esc = (n) => (SCALA_KEYWORDS.has(n) ? `\`${n}\`` : n);
function toExpr(f) {
  const n = esc(f.name);
  const list = isListType(f.dataType);
  const inner = innerType(f.dataType);
  const sc = scalarConv(inner);
  if (!f.optional) {
    if (list) return `d.${n}.map(${(sc || "StringConv")}.toProto)`;
    if (sc === "IdConv" || sc === "InstantConv") return `${sc}.toProto(d.${n})`;
    if (sc) return `Some(${sc}.toProto(d.${n}))`;               // bare VO ⇒ proto3 message ⇒ Option
    return `d.${n}`;
  }
  if (list) return `d.${n}.getOrElse(Nil).map(${(sc || "StringConv")}.toProto)`;
  if (sc === "IdConv") return `d.${n}.map(IdConv.toProto)`;          // unobserved: best-effort
  if (sc === "InstantConv") return `d.${n}.map(InstantConv.toProto)`; // unobserved: best-effort
  if (sc) return `Some(${sc}.toProto(d.${n}))`;                       // VO (same as non-optional)
  if (/Boolean/.test(inner)) return `d.${n}`;                        // optional Boolean: direct
  if (/^(Int|Integer|Long|Double|BigDecimal)$/.test(inner)) return `d.${n}`; // unobserved
  return `d.${n}.map(StringConv.toProto)`;                            // optional String-ish
}
function fromExpr(f) {
  const n = esc(f.name);
  const list = isListType(f.dataType);
  const inner = innerType(f.dataType);
  const sc = scalarConv(inner);
  if (!f.optional) {
    if (list) return `p.${n}.map(${(sc || "StringConv")}.fromProto).toList`;
    if (sc === "IdConv" || sc === "InstantConv") return `${sc}.fromProto(p.${n})`;
    if (sc) return `${sc}.fromProto(p.${n}.getOrElse(throw new IllegalArgumentException(s"Missing required field: ${f.name}")))`;
    return `p.${n}`;
  }
  if (list) return `Some(p.${n}.map(${(sc || "StringConv")}.fromProto).toList)`;
  if (sc === "IdConv") return `p.${n}.map(IdConv.fromProto)`;              // unobserved: best-effort
  if (sc === "InstantConv") return `p.${n}.map(InstantConv.fromProto)`;    // unobserved: best-effort
  if (sc) return `${sc}.fromProto(p.${n}.getOrElse(throw new IllegalArgumentException(s"Missing required field: ${f.name}")))`;
  if (/Boolean/.test(inner)) return `p.${n}`;                             // optional Boolean: direct
  if (/^(Int|Integer|Long|Double|BigDecimal)$/.test(inner)) return `p.${n}`; // unobserved
  return `p.${n}.map(StringConv.fromProto)`;                               // optional String-ish
}

// ─── Converter selection ───
const entries = spec.converters || [];
const ident = spec.identifier || null;
const stateEntry = entries.find((c) => c.domainType === `${agg}State` || c.name === `${agg}State`);
if (stateEntry && ident && !(stateEntry.fields || []).some((f) => f.name === ident.name)) {
  stateEntry.fields = [ident, ...(stateEntry.fields || [])];
}

// EP Phase 3(a) (old codegen isStateFieldExcluded): state fields flattened in from a
// nested VO must NOT reach the state converter — in the canonical payload they carry
// `parent` naming a REAL catalog VO (role "ValueObject.Member"): DoR's 17
// DoRVerdict/DoRAssessmentResult/Finding members and ModelCatalog's
// CatalogConflict/CatalogPatchSet/CatalogConflictSet members. A parent that names no
// catalog VO is not an expansion artifact (ModelCatalog conceptIndex, parent
// "ConceptIndexSet", role "State" — golden KEEPS it). Likewise fields whose `nature`
// the concerns registry excludes from aggregate columns (User: "credential"
// passwordSalt/passwordHash). The filter applies ONLY to the state converter's rendered
// fields: VO dependency collection below still scans the unfiltered fields (old codegen
// collectDependentValueObjects semantics — ModelCatalog's ConceptIndexEntry converter
// exists solely because of the conceptIndex state field).
// Requires the spec to carry `parent`/`role`/`nature` through (run-all rawFields today
// drops them; without them this filter is a no-op and DoR/ModelCatalog/User state
// converters keep the extra fields — spec gap, see verification report).
const EXCLUDED_STATE_NATURES = new Set(["credential"]);
const isExcludedStateField = (f) =>
  EXCLUDED_STATE_NATURES.has(f.nature) ||
  f.role === "ValueObject.Member" ||
  (!!f.parent && VO_NAMES.has(f.parent));
const stateFieldsEmit = stateEntry
  ? (stateEntry.fields || []).filter((f) => !isExcludedStateField(f))
  : [];
const eventEntries = entries.filter((c) => c !== stateEntry).sort((a, b) => cmp(a.name, b.name));

// VOs this aggregate's converters reference = transitive closure of VO-typed fields
// (old codegen: collectDeepDependencies), minus the state VO itself, sorted by name.
function refsOf(fields) {
  const out = new Set();
  for (const f of fields || []) if (isVOType(f.dataType)) out.add(innerType(f.dataType));
  return out;
}
const referenced = new Set();
for (const c of entries) for (const v of refsOf(c.fields)) referenced.add(v);
let grew = true;
while (grew) {
  grew = false;
  for (const v of [...referenced]) {
    for (const dep of refsOf((voByName.get(v) || {}).fields)) {
      if (!referenced.has(dep)) { referenced.add(dep); grew = true; }
    }
  }
}
referenced.delete(stateEntry && (stateEntry.domainType || stateEntry.name));
const voNames = [...referenced].sort(cmp);
const voCatalog = voNames.map((v) => voByName.get(v)).filter(Boolean);

// ─── Imports ───
const entityNames = [...eventEntries.map((c) => c.name), stateEntry ? stateEntry.name : null]
  .filter(Boolean)
  .sort(cmp);
const imports = [
  "import java.time.Instant",
  "import net.imadz.common.CommonTypes.Id",
  "import net.imadz.common.serialization.PrimitiveConverter",
  ...entityNames.map((n) => `import ${entityPkg}.${agg}Entity.${n}`),
  ...voNames.map((v) => `import ${valuesPkg}.${v}`),
  ...[...eventEntries.map((c) => c.protoType), stateEntry ? stateEntry.protoType : null]
    .filter(Boolean)
    .concat(voNames.filter((v) => !SHARED_VOS.has(v)).map((v) => `${v}PO`))
    .map((p) => `import ${aggProtoPkg}.${p}`),
  ...voNames
    .filter((v) => SHARED_VOS.has(v))
    .map((v) => `import ${sharedProtoPkg}.${v}PO`),
];
const allFields = [...voCatalog, ...entries].flatMap((c) => c.fields || []);
if (allFields.some((f) => isListType(f.dataType))) imports.push("import scala.collection.immutable.List");
// Golden import rhythm: the whole import block is one codepoint-sorted list
// (e.g. shared_value_objects ParticipantRolePO sorts BEFORE own proto.workshop.*).
const sortedImports = [...new Set(imports)].sort(cmp);

// ─── Converter object rendering ───
function renderConv(domainType, protoType, fields) {
  const arg = (f, expr) =>
    `${f.noteId ? `      // @knowledge ${f.elementHash ? `${f.noteId}@${f.elementHash}` : f.noteId}\n` : ""}      ${esc(f.name)} = ${expr}`;
  const toArgs = (fields || []).map((f) => arg(f, toExpr(f))).join(",\n");
  const fromArgs = (fields || []).map((f) => arg(f, fromExpr(f))).join(",\n");
  return `  object ${domainType}Conv extends ProtoConverter[${domainType}, ${protoType}] {
    override def toProto(d: ${domainType}): ${protoType} = ${protoType}(
${toArgs}
    )

    override def fromProto(p: ${protoType}): ${domainType} = ${domainType}(
${fromArgs}
    )
  }`;
}

const LIST_CONV = `  object ListConv {
    def toProto[D, P](domain: List[D])(implicit c: ProtoConverter[D, P]): Seq[P] = domain.map(c.toProto)
    def fromProto[D, P](proto: Seq[P])(implicit c: ProtoConverter[D, P]): List[D] = proto.map(c.fromProto).toList
  }`;
const INSTANT_CONV = `  object InstantConv {
    def toProto(domain: java.time.Instant): Long = Option(domain).fold(0L)(_.toEpochMilli)
    def fromProto(proto: Long): java.time.Instant = java.time.Instant.ofEpochMilli(proto)
  }`;

const convObjs = [
  ...voCatalog.map((v) => renderConv(v.name, `${v.name}PO`, v.fields)),
  ...eventEntries.map((c) => renderConv(c.domainType, c.protoType, c.fields)),
  ...(stateEntry ? [renderConv(stateEntry.domainType, stateEntry.protoType, stateFieldsEmit)] : []),
];

// Golden blank-line rhythm inside the trait: 2 blank lines between converter objects
// (and before ListConv), but only 1 blank line between ListConv and InstantConv and
// between InstantConv and the trait's closing brace.
const traitBody = `${convObjs.join("\n\n\n")}\n\n\n${LIST_CONV}\n\n${INSTANT_CONV}`;

const out = `// @generated by CodegenMain:225ed28b
// @knowledge-release 1.0.0
package ${pkg}

${sortedImports.join("\n")}

trait ${traitName} extends PrimitiveConverter {

${traitBody}

}

/** S2-82-B3（2026-09-11）：self-companion——trait 嵌套 Conv object 的静态寻址口。
  * Scala trait 无 term（TraitName.NestedObject 编译红「no companion object」）——
  * 投影 handler/读端经 ${traitName}.XxxConv.fromProto 静态调用需要本伴生；
  * EventAdapter/SnapshotAdapter 等 mixin 消费方不受影响（trait 本体原样）。 */
object ${traitName} extends ${traitName}
`;

writeFileSync(outPath, out);
console.log(`emitted ${outPath} (${convObjs.length} converters)`);
