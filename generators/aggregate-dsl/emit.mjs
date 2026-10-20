#!/usr/bin/env node
// ═══ aggregate-dsl emitter v4 — ingested-app 1:1 ═══
// Matches ingested-app / golden scala-cqrs-es-metarch pattern:
//
//   application/aggregates/<Name>Protocol.scala
//     — imports State/Event from domain.entities.<Name>Entity
//     — sealed trait <Name>CommandFamily + per-command case classes (replyTo: ActorRef[<Cmd>Reply])
//     — per-command <Cmd>Reply case classes
//     — type <Name>CommandHandlerFamily
//   application/aggregates/<Name>Aggregate.scala
//     — object with entityTypeKey + tags + commandHandler wiring
//   application/aggregates/behaviors/<Name>Behaviors.scala
//   application/aggregates/factories/<Name>AggregateFactory.scala
//   domain/entities/<Name>Entity.scala            (NEW v4)
//     — object <Name>Entity { case class <Name>State; def empty; sealed trait <Name>Event; event case classes; type <Name>EventHandler }
//   domain/entities/behaviors/<Name>EventHandler.scala  (NEW v4)
//     — object <Name>EventHandler { def apply ... event match ... }
//
// Spec: {package, name, objectName, stateType, eventType, stateFields,
//        commands: [{name, fields}], events: [{name, fields}],
//        commandHandlers: [{command}],
//        entityDir (abs path for domain/entities), entityPackage,
//        invariantPackage (for Behaviors rule import)}
// Usage: node emit.mjs <spec.json> <out-dir>
//   (out-dir = application/aggregates dir; entity files go to spec.entityDir)

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

const [specPath, outPathArg] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
// outPath may be a marker file (run-all dir mode) — resolve to its directory
const outDir = outPathArg.endsWith(".scala") ? dirname(outPathArg) : outPathArg;

// dataType → Scala type signature — port of the old codegen's DataTypeMapper
// (generators/_deprecated/scala-cqrs-es/builders/types.mjs `scalaSig`, itself
//  ported from AssemblyEngine.scala:1035-1058). Case-insensitive match; the raw
//  spelling rides through for the custom/VO fallback so VO names survive.
// The spec carries RAW tree dataTypes ("List<CodeAnchorDelta>", "Instant",
// "String (UUID)", ...) — run-all passes them through raw for this generator.
// Legacy lowercase vocabulary ('string','number','integer','long','boolean',
// 'timestamp') also resolves, so standalone specs still work.
const scalaSig = (dataType) => {
  const raw = String(dataType ?? "").trim();
  const s = raw.toLowerCase();
  if (s === "string (uuid)" || s === "uuid") return "Id";
  if (s === "string") return "String";
  if (s === "int" || s === "integer") return "Int";
  if (s === "long" || s === "timestamp") return "Long";
  if (s === "double") return "Double";
  if (s === "boolean" || s === "bool") return "Boolean";
  if (s === "decimal" || s === "bigdecimal" || s === "number") return "BigDecimal";
  if (s === "instant" || s === "datetime") return "Instant";
  if (s === "string (enum)" || s === "enum") return "String"; // 枚举值以字符串承载
  if (s === "string (json)" || s === "json") return "String";
  if ((s.startsWith("list[") || s.startsWith("list<")) && (s.endsWith("]") || s.endsWith(">")))
    return `List[${scalaSig(raw.slice(5, raw.length - 1))}]`; // recurse on raw slice (case preserved)
  if ((s.startsWith("array[") || s.startsWith("array<")) && (s.endsWith("]") || s.endsWith(">")))
    return `List[${scalaSig(raw.slice(6, raw.length - 1))}]`;
  return raw !== "" ? raw : "String"; // VO / custom type name verbatim; empty → String
};

// Scala keyword field names are backtick-quoted in golden (e.g. `type`).
const SCALA_KEYWORDS = new Set(["type","match","case","object","yield","val","var","def","class","trait","extends","with","new","for","import","package","private","protected","sealed","final","abstract","override","implicit","lazy","return","super","this","true","false","null","if","else","while","do","throws","try","catch","finally"]);
const qref = (n) => (SCALA_KEYWORDS.has(n) ? "`" + n + "`" : n);

// Field → "name: Type" (optional fields wrap in Option + "= None", ingested-app 1:1).
// NOTE: dataType is authoritative. The old name heuristic ("ends with Id → Id")
// misfires on 32 tree fields (e.g. tenantId with dataType "String" renders String
// in ingested-app; conceptIds with dataType "List<String>" renders List[String]).
const fieldDecl = (f) => {
  const sig = scalaSig(f.dataType);
  return f.optional ? `${qref(f.name)}: Option[${sig}] = None` : `${qref(f.name)}: ${sig}`;
};

const fieldsOf = (fields) =>
  (fields ?? []).map(fieldDecl).join(", ");

// Parse a Scala type signature into {base, params[]} — port of types.mjs parseType.
// e.g. "Map[String, Money]" → {base:'Map', params:['String','Money']}.
const parseType = (t) => {
  const s = t.trim();
  const lb = s.indexOf("[");
  if (lb === -1) return { base: s, params: [] };
  const base = s.slice(0, lb);
  const inner = s.slice(lb + 1, s.lastIndexOf("]"));
  const params = [];
  let depth = 0, cur = "";
  for (const ch of inner) {
    if (ch === "[") depth++;
    if (ch === "]") depth--;
    if (ch === "," && depth === 0) { params.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) params.push(cur.trim());
  return { base, params };
};

const pascal = (s) =>
  String(s).split(/[-_ ]/).map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : "")).join("");

const objName = spec.objectName || pascal(spec.name || "Aggregate");
const pkg = spec.package || "generated.aggregate";
const entityPkg = spec.entityPackage || pkg.replace(/\.application\.aggregates$/, ".domain.entities");
const stateType = spec.stateType || `${objName}State`;
const eventType = spec.eventType || `${objName}Event`;
const commandFamily = `${objName}CommandFamily`;
const handlerFamily = `${objName}CommandHandlerFamily`;

const handled = new Set((spec.commandHandlers ?? []).map((h) => h.command));
const commands = spec.commands ?? [];
const events = spec.events ?? [];

// Protocol/Behaviors emission order (ingested-app 1:1, verified across all 27
// golden Protocols): non-Get commands alphabetical (codepoint), then the
// synthetic Get<Name>State query command last (alphabetical among themselves).
// Replies follow the same order. Golden Factory methods are NOT per-command
// (createXWithoutBalance/WithInitialValue), so factory order is moot there.
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const orderedCommands = [
  ...commands.filter((c) => !c.name.startsWith("Get")).sort(byName),
  ...commands.filter((c) => c.name.startsWith("Get")).sort(byName),
];

// Value-object package. Golden: net.imadz.metarch.domain.values.<VO>.
// Derived from entityPkg, overridable via spec.valuesPackage.
const valuesPkg = spec.valuesPackage || entityPkg.replace(/\.domain\.entities$/, ".domain.values");

// Type-reference import computation — port of the old codegen's pkgOf + typeDeps
// (types.mjs): a field's Scala signature is walked; each base name maps to its
// owning package. Unknown base names are domain value objects (e.g.
// CodeAnchorDelta, GuardSpec) → imported from domain.values. Primitives/collections
// root (String, Int, Option, ...) import nothing. Golden's rule: one import per
// referenced VO (alphabetical with the rest of the block); java.time.Instant and
// scala.collection.immutable.List likewise data-driven.
// NOTE: golden's Entity repeats `scala.collection.immutable.List` once per DISTINCT
// List[X] TypeRef (an old-codegen multiset artifact). We intentionally emit it ONCE.
const typeImports = (fields) => {
  const fqns = [];
  const walk = (sig) => {
    const { base, params } = parseType(sig);
    let owner;
    if (base === "Id" || base === "iMadzError") owner = "net.imadz.common.CommonTypes";
    else if (base === "Instant") owner = "java.time";
    else if (["List", "Map", "Seq", "Set", "Vector"].includes(base)) owner = "scala.collection.immutable";
    else if (["String", "Int", "Long", "Double", "Float", "Boolean", "BigDecimal", "Option", "Unit"].includes(base)) owner = "";
    else owner = valuesPkg; // VO: caller never supplies typeImport, so bare type names are VOs
    if (owner) fqns.push(`${owner}.${base}`);
    params.forEach(walk);
  };
  for (const f of fields ?? []) {
    const sig = scalaSig(f.dataType);
    walk(f.optional ? `Option[${sig}]` : sig);
  }
  return [...new Set(fqns)];
};

const sortedImportBlock = (fqns) =>
  [...new Set(fqns)].sort().map((i) => `import ${i}`).join("\n");

// ═══ 1. Entity (domain/entities/<Name>Entity.scala) ═══
// Canonical home of State + Events. Protocol imports from here.

// State field → "name: Type"; List-typed state fields get `= List.empty`
// (ingested-app 1:1: 46 occurrences, all on *State case classes; events and
// commands carry no List defaults). Optional state fields keep `Option[T] = None`.
const stateFieldDecl = (f) => {
  const sig = scalaSig(f.dataType);
  if (f.optional) return `${qref(f.name)}: Option[${sig}] = None`;
  return sig.startsWith("List[") ? `${qref(f.name)}: ${sig} = List.empty` : `${qref(f.name)}: ${sig}`;
};
const fieldsOfState = (fields) => (fields ?? []).map(stateFieldDecl).join(", ");

// Compile-flattened value-object member fields ride along in spec.stateFields
// (e.g. DoR.recordedAt, ModelCatalog.appliedAt) but are NOT Entity state
// fields in golden: they are marked by a `(parent=<VO>)` businessDef note or
// by writtenBy entries that are all deep member paths (≥3 segments).
// (foldAssignSkip silences them everywhere; foldTodoSkip keeps items for
// SYSTEM_INJECTED fields like DoR.evaluatedAt whose writtenBy is a member
// path into a payload VO but which golden does carry as state fields.)
const parentMarker = (f) => !!f && String(f.businessDef || "").includes("(parent=");
const allWbDeep = (f) =>
  !!f && (f.writtenBy || []).length > 0 && (f.writtenBy || []).every((w) => w.split(".").length >= 3);
const foldAssignSkip = (f) => parentMarker(f) || allWbDeep(f);
const foldTodoSkip = (f) => parentMarker(f) || (allWbDeep(f) && f.origin !== "SYSTEM_INJECTED");

// State visibility (ingested-app 1:1):
//  - the aggregate identifier (spec.identifier) LEADS the State case class —
//    it is NOT part of spec.stateFields (ConceptState(conceptId: Id, ...)),
//    carries its own @param anchor (noteId only) and is empty()'s parameter;
//  - fields with nature === "credential" never reach State (User drops
//    passwordHash/passwordSalt entirely: no State field, no empty() arg,
//    no @param line, no EventHandler fold/待审 mention);
//  - compile-flattened VO members (foldTodoSkip) are not State fields either.
const isCredential = (f) => !!f && f.nature === "credential";
const identifierField =
  spec.identifier && typeof spec.identifier === "object" && spec.identifier.name
    ? {
        name: spec.identifier.name,
        dataType: spec.identifier.dataType || "String (UUID)",
        noteId: spec.identifier.noteId || null,
        elementHash: spec.identifier.elementHash || null,
        description: "",
        optional: false,
      }
    : null;
const entityStateFields = [
  ...(identifierField ? [identifierField] : []),
  ...(spec.stateFields ?? []).filter((f) => !isCredential(f) && !foldTodoSkip(f)),
];
// EventHandler view: state fields minus credentials; flattened VO members
// stay visible to the fold phases (their skip rules already silence them).
const handlerStateFields = (spec.stateFields ?? []).filter((f) => !isCredential(f));

const entityStateDef = `  case class ${stateType}(${fieldsOfState(entityStateFields)})`;

// empty(): identity param (first state field, the aggregate's own Id) passed
// through; remaining fields get old-codegen type defaults. ingested-app 1:1
// over all 27 golden Entities (fully-qualified Id.of, never imported).
const ZERO_ID = `net.imadz.common.Id.of("00000000-0000-0000-0000-000000000001")`;
const emptyDefault = (f) => {
  if (f.optional) return "None";
  const sig = scalaSig(f.dataType);
  const base = sig.includes("[") ? sig.slice(0, sig.indexOf("[")) : sig;
  switch (base) {
    case "Id": return ZERO_ID;
    case "String": return '""';
    case "Int": return f.name === "order" ? "1" : "0"; // order is 1-based in golden (2/2); version → 0
    case "Long": return "0L";
    case "Double": return "0.0";
    case "BigDecimal": return 'BigDecimal("0")';
    case "Boolean": return "false";
    case "List": case "Seq": case "Set": case "Vector": return "Nil";
    case "Instant": return "null";
    default: return "null";
  }
};
const emptyDef = (() => {
  const sfs = entityStateFields;
  if (sfs.length === 0) return `  def empty: ${stateType} = ???`;
  const [first, ...rest] = sfs;
  const firstSig = scalaSig(first.dataType);
  const args = [first.name, ...rest.map(emptyDefault)].join(", ");
  return `  def empty(${first.name}: ${firstSig}): ${stateType} = ${stateType}(${args})`;
})();

// Events in alphabetical order (ingested-app 1:1: Entity event defs and
// EventHandler cases are both alphabetical by event name).
const orderedEvents = [...events].sort(byName);

// @knowledge scaladoc (Category A). The `@<16hex>` suffix is the element's
// elementHash, seed-carried in the tree next to its noteId (Decision 1,
// 2026-10-20); kh() renders the full anchor when a hash is present.
// A doc block is emitted only when at least one field carries a noteId;
// every field gets a @param line (description text, then the anchor).
const kh = (id, h) => (id ? (h ? `${id}@${h}` : id) : "");
const paramDoc = (fields) => {
  if (!(fields ?? []).some((f) => f.noteId)) return "";
  const lines = (fields ?? []).map((f) => {
    const desc = f.description ? ` ${f.description}` : "";
    const kn = f.noteId ? `  @knowledge ${kh(f.noteId, f.elementHash)}` : "";
    return `   * @param ${qref(f.name)}${desc}${kn}`;
  });
  return `  /**\n${lines.join("\n")}\n   */\n`;
};
const stateDoc = paramDoc(entityStateFields);
const aggDoc = spec.aggNoteId ? `/**\n * @knowledge ${kh(spec.aggNoteId, spec.aggElementHash)}\n */\n\n` : "";

const entityEventDefs = orderedEvents
  .map((e) => `${paramDoc(e.fields)}  case class ${e.name}(${fieldsOf(e.fields)}) extends ${eventType}`)
  .join("\n");
const anyEventDoc = orderedEvents.some((e) => (e.fields ?? []).some((f) => f.noteId));

// Entity imports: CborSerializable + data-driven Id/Instant/List/VO imports,
// alphabetical (ingested-app 1:1 modulo golden's duplicated List lines — see above).
const entityImportBlock = sortedImportBlock([
  "net.imadz.common.CborSerializable",
  ...typeImports([
    ...entityStateFields,
    ...orderedEvents.flatMap((e) => e.fields ?? []),
  ]),
]);

const entity = `// @generated by CodegenMain:225ed28b
// @knowledge-release 1.0.0
package ${entityPkg}

${entityImportBlock}

${aggDoc}object ${objName}Entity {
${stateDoc || "\n"}${entityStateDef}

${emptyDef}

  sealed trait ${eventType} extends CborSerializable
${anyEventDoc ? "\n" : ""}${entityEventDefs}

  type ${objName}EventHandler = (${stateType}, ${eventType}) => ${stateType}
}
`;

// ═══ 2. EventHandler (domain/entities/behaviors/<Name>EventHandler.scala) ═══
// Fold bodies ported from the old rules_domain_gen EventHandler projection
// (writtenBy lineage authoritative + audit rules + status transitions +
// same-name payload fallback), driven by the rich spec: slice foldAssignments
// (④-layer verbs first), then writtenBy derivations, status, audit fields,
// same-name fallback, version. Unassigned state fields and unmapped payload
// fields are reported in the per-case `// 待审:` comment exactly as golden.
// Ordering model (verified against all 27 golden handlers): phase 0 = slice
// verb folds (append/concat/remove/upsert/member*/keep/fn) in declaration
// order; phase 1 = writtenBy-backed direct assignments in stateFields order;
// phase 2 = status literal/transition; phase 3 = audit derivations;
// phase 4 = same-name fallback in stateFields order; phase 5 = version.
// Exprs that need data the spec does not carry (bare `upsert:` VO
// construction, `memberPatch:` source-VO shape) pass through verbatim and are
// logged to stderr as fold notes.
const sigOfField = (f) => {
  const s = scalaSig(f.dataType);
  return f.optional ? `Option[${s}]` : s;
};
const elemSigOf = (dataType) => {
  const sig = scalaSig(dataType);
  return sig.startsWith("List[") ? sig.slice(5, -1) : sig;
};
// (parentMarker / allWbDeep / foldAssignSkip / foldTodoSkip are defined with
// the Entity scaladoc helpers above — the same compile-flattening filter.)

const AUDIT_CREATE_STEMS = new Set(["Created", "Onboarded", "Registered", "Captured", "Raised", "Started", "Accepted", "Joined"]);
const AUDIT_UPDATE_STEMS = new Set(["Updated", "Changed", "Modified", "Edited", "Patched", "Resolved", "Released", "Concluded", "Submitted", "Rejected", "Approved", "Blocked", "Classified", "Assigned", "Evaluated", "Answered", "Completed", "Scheduled", "Published", "Saved", "Requested", "Detected", "Reactivated", "Deleted", "Skipped", "Activated", "Invited", "Merged", "Removed", "Unparked", "Deprecated", "Established", "Suspended", "Resumed", "Archived"]);
const FOLD_VERB_RE = /^(append|concat|remove|upsert|keep|patch|member[A-Z]\w+|fn):/;

// Terminal-state one-way guard (port of old codegen eventhandler_face):
// a non-terminal status literal becomes
//   status = if (Set("t1", ...).contains(state.status)) state.status else "v"
// so replayed history cannot resurrect a terminal state; a literal that IS
// terminal stays plain. Golden evidence is CemEdge (terminalStates
// ["retired"], status literals "active" wrapped, "retired" plain). The old
// pipeline keyed this on the behavior-model (bmExtra) terminalStates, which
// only CemEdge declares; at spec level the faithful gate is terminalStates
// non-empty AND no explicit statusTransitions ruling table (Session / Stage
// / Note carry tables and emit plain literals in golden).
const terminalStates = spec.terminalStates ?? [];
const terminalGuardApplies =
  terminalStates.length > 0 && Object.keys(spec.statusTransitions ?? {}).length === 0;
const statusLiteralText = (slot, val) =>
  slot === "status" && terminalGuardApplies && !terminalStates.includes(val)
    ? `${qref(slot)} = if (Set(${terminalStates.map((t) => `"${t}"`).join(", ")}).contains(state.status)) state.status else "${val}"`
    : `${qref(slot)} = "${val}"`;

const foldNotes = [];
const handlerPortTraits = new Set();
// B-assembly fix (2026-10-20): port members used by fn: fold bodies, derived
// from declaredFunction callExpr (`<pkg>.<X>Access.<member>.<method>({args})`
// → member). Fold bodies reference the bare member, so the EventHandler /
// Behaviors / Aggregate faces must thread it as an apply parameter (golden
// ModelCatalog 债④ closure form); previously only the trait import was
// emitted and the generated code did not compile.
const handlerPortMembers = new Map();

const renderHandlerCase = (e) => {
  const S = handlerStateFields;
  const sfByName = new Map(S.map((f) => [f.name, f]));
  const P = e.fields ?? [];
  const pfByName = new Map(P.map((f) => [f.name, f]));
  const sIdx = (slot) => S.findIndex((f) => f.name === slot);
  const evRef = (name) => `event.${qref(name)}`;
  const assigns = []; // {slot, text, phase, sIdx, fIdx, verbatim}
  const assigned = new Set();
  const todos1 = []; // writtenBy-phase todos (incompatibility / missing field)
  const addAssign = (slot, text, phase, fIdx = 0, verbatim = false) => {
    if (assigned.has(slot)) return false;
    assigned.add(slot);
    assigns.push({ slot, text, phase, sIdx: sIdx(slot), fIdx, verbatim });
    return true;
  };
  // Type compatibility between a state field and an event payload field
  // (old ehCompat over Entity signature types, Option-aware): same type →
  // direct; String ← Id → .toString; List[X] ← X → List(...); else null.
  const compat = (slot, evField, optionUnwrap = false) => {
    const sfd = sfByName.get(slot);
    const pf = pfByName.get(evField);
    if (!sfd || !pf) return null;
    const st = sigOfField(sfd);
    const et = sigOfField(pf);
    if (st === et) return evRef(evField);
    if (st === "String" && et === "Id") return `${evRef(evField)}.toString`;
    if (st.startsWith("List[") && elemSigOf(sfd.dataType) === et) return `List(${evRef(evField)})`;
    // writtenBy-phase only (golden CemEdge EdgePatched): a scalar Option
    // payload field backed by writtenBy folds as getOrElse(state). List-
    // typed state fields stay incompatible (golden FieldModelDefinition
    // AggregateStatusPatched), and the same-name fallback phase never
    // unwraps (golden OrganizationMember review items).
    if (optionUnwrap && !st.startsWith("List[") && et === `Option[${st}]`) return `${evRef(evField)}.getOrElse(state.${qref(slot)})`;
    return null;
  };
  const backed = (slot) => (sfByName.get(slot)?.writtenBy || []).some((w) => w.startsWith(e.name + "."));

  // ── slice foldAssignments ──
  const renderFold = (f) => {
    const slot = f.slot;
    const expr = String(f.expr);
    const sf = sfByName.get(slot);
    let m;
    if ((m = /^literal:(.*)$/.exec(expr))) return { text: statusLiteralText(slot, m[1]) };
    if ((m = /^event\.(\w+)$/.exec(expr))) {
      // Whole-table-carry list fields (description carries 整表携带; the one
      // corpus case is Concept.anchors): golden replaces the list only when
      // the event's list is non-empty.
      const sfDesc = `${sf?.description || ""}${sf?.businessDef || ""}`;
      if (sf && scalaSig(sf.dataType).startsWith("List[") && sfDesc.includes("整表携带"))
        return { text: `${qref(slot)} = (if (Option(${evRef(m[1])}).exists(_.nonEmpty)) ${evRef(m[1])} else state.${qref(slot)})` };
      const c = compat(slot, m[1]);
      if (c === null) {
        foldNotes.push(`${objName}.${e.name}: fold ${slot} = ${expr} dropped (type-incompatible; writtenBy/fallback phases report it)`);
        return null;
      }
      return { text: `${qref(slot)} = ${c}` };
    }
    if ((m = /^upsert:event\.(\w+)$/.exec(expr))) {
      // bare upsert: key-only expr — construct the element VO from the event
      // fields named like the VO's fields (golden Session/Workshop
      // ParticipantRole folds), replacing any element with the same key.
      const key = m[1];
      const elem = elemSigOf(sf.dataType);
      const voFields = (spec.voCatalog || {})[elem];
      if (!voFields || !pfByName.has(key) || voFields.some((vf) => !pfByName.has(vf.name))) {
        foldNotes.push(`${objName}.${e.name}: ${expr} needs VO construction data not in spec — passed through verbatim`);
        return { text: `${qref(slot)} = ${expr}`, verbatim: true };
      }
      const ctorArgs = voFields.map((vf) => evRef(vf.name)).join(", ");
      return { text: `${qref(slot)} = Option(state.${qref(slot)}).getOrElse(Nil).filterNot(x => x.${qref(key)} == ${evRef(key)}) :+ ${elem}(${ctorArgs})` };
    }
    if ((m = /^memberPatch:(\w+)\.(\w+)\.(\w+)$/.exec(expr))) {
      // memberPatch:<slot>.<keyField>.<patchParam> — map over the list,
      // patching the element whose key matches the patch VO's key from the
      // event (golden ReadModelDefinition fields fold). Per element field:
      // Option patch field → getOrElse(x.f); List patch field → keep x.f
      // when the patch list is empty; plain → direct.
      const [, , keyField, patchParam] = m;
      const elem = elemSigOf(sf.dataType);
      const elemFields = (spec.voCatalog || {})[elem];
      const patchField = pfByName.get(patchParam);
      const patchFields = patchField ? (spec.voCatalog || {})[scalaSig(patchField.dataType)] : null;
      if (!elemFields || !patchFields) {
        foldNotes.push(`${objName}.${e.name}: ${expr} needs VO patch data not in spec — passed through verbatim`);
        return { text: `${qref(slot)} = ${expr}`, verbatim: true };
      }
      const patchByName = new Map(patchFields.map((f) => [f.name, f]));
      const copyArgs = [];
      for (const ef of elemFields) {
        if (ef.name === keyField) continue;
        const pf2 = patchByName.get(ef.name);
        if (!pf2) continue;
        const lhs = qref(ef.name);
        const rhs = `${evRef(patchParam)}.${qref(ef.name)}`;
        if (pf2.optional) copyArgs.push(`${lhs} = ${rhs}.getOrElse(x.${lhs})`);
        else if (scalaSig(pf2.dataType).startsWith("List[")) copyArgs.push(`${lhs} = (if (${rhs}.isEmpty) x.${lhs} else ${rhs})`);
        else copyArgs.push(`${lhs} = ${rhs}`);
      }
      return { text: `${qref(slot)} = Option(state.${qref(slot)}).getOrElse(Nil).map(x => if (x.${qref(keyField)} == ${evRef(patchParam)}.${qref(keyField)}) x.copy(${copyArgs.join(", ")}) else x)` };
    }
    if ((m = /^state\.(\w+)$/.exec(expr))) return { text: `${qref(slot)} = state.${qref(m[1])}` };
    if ((m = /^fn:(.+)$/.exec(expr))) {
      const df = (spec.declaredFunctions || {})[m[1]];
      if (!df || !df.callExpr) {
        foldNotes.push(`${objName}.${e.name}: fn:${m[1]} has no declaredFunction spec — passed through verbatim`);
        return { text: `${qref(slot)} = ${expr}`, verbatim: true };
      }
      const args = [];
      let bad = false;
      for (const inp of df.signature?.inputs || []) {
        const rawFrom = String(inp.from || "").split(/[（(]/)[0].trim(); // strip 真源括注
        if (rawFrom.startsWith("state:")) {
          const fld = rawFrom.slice("state:".length).trim().split(".").pop();
          if (!sfByName.has(fld)) bad = true;
          else args.push(`state.${qref(fld)}`);
        } else {
          const fld = rawFrom.split(".").pop();
          if (!pfByName.has(fld)) bad = true;
          else args.push(evRef(fld));
        }
      }
      if (bad) {
        foldNotes.push(`${objName}.${e.name}: fn:${m[1]} input not resolvable from event payload/state — passed through verbatim`);
        return { text: `${qref(slot)} = ${expr}`, verbatim: true };
      }
      // 债④ closure form: `<pkg>.<X>Access.<member>.<method>({args})` → `<member>.<method>(...)`
      const ce = df.callExpr.replace(/^.*Access\./, "").replace("{args}", args.join(", "));
      if (df.portTrait) {
        handlerPortTraits.add(df.portTrait);
        const member = ce.split(".")[0];
        if (/^[A-Za-z_]\w*$/.test(member) && !handlerPortMembers.has(member))
          handlerPortMembers.set(member, df.portTrait);
      }
      return { text: `${qref(slot)} = ${ce}` };
    }
    if ((m = /^append:(?:event\.)?([\w.]+)$/.exec(expr))) {
      const head = m[1].split(".")[0];
      const pf = pfByName.get(head);
      const val = pf && scalaSig(pf.dataType) === "Id" && elemSigOf(sf.dataType) === "String" ? `${evRef(m[1])}.toString` : evRef(m[1]);
      return { text: `${qref(slot)} = Option(state.${qref(slot)}).getOrElse(Nil) :+ ${val}` };
    }
    if ((m = /^concat:(?:event\.)?([\w.]+)$/.exec(expr)))
      return { text: `${qref(slot)} = Option(state.${qref(slot)}).getOrElse(Nil) ++ ${evRef(m[1])}` };
    if ((m = /^remove:(?:event\.)?([\w.]+)$/.exec(expr)))
      return { text: `${qref(slot)} = Option(state.${qref(slot)}).getOrElse(Nil).filter(_ != ${evRef(m[1])})` };
    if ((m = /^keep:(.+)$/.exec(expr))) {
      const inner = m[1];
      let newVal = null;
      if (inner.startsWith("literal:")) newVal = `"${inner.slice("literal:".length)}"`;
      else if (inner.startsWith("event.")) newVal = evRef(inner.slice("event.".length));
      if (newVal === null) {
        foldNotes.push(`${objName}.${e.name}: keep:${inner} unsupported form — passed through verbatim`);
        return { text: `${qref(slot)} = ${expr}`, verbatim: true };
      }
      const sRef = `state.${qref(slot)}`;
      const stSig = scalaSig(sf.dataType);
      const nonEmpty = stSig === "String" || stSig.startsWith("List[") ? `Option(${sRef}).exists(_.nonEmpty)` : `Option(${sRef}).isDefined`;
      return { text: `${qref(slot)} = (if (${nonEmpty}) ${sRef} else ${newVal})` };
    }
    if ((m = /^upsert:event\.(\w+)\.(\w+)$/.exec(expr))) {
      // path-key upsert: payload field IS the VO instance → filterNot + append it
      const [, head, keyMember] = m;
      const pf = pfByName.get(head);
      if (pf && scalaSig(pf.dataType) === elemSigOf(sf.dataType))
        return { text: `${qref(slot)} = Option(state.${qref(slot)}).getOrElse(Nil).filterNot(x => x.${qref(keyMember)} == ${evRef(head)}.${qref(keyMember)}) :+ ${evRef(head)}` };
      foldNotes.push(`${objName}.${e.name}: ${expr} needs VO construction data not in spec — passed through verbatim`);
      return { text: `${qref(slot)} = ${expr}`, verbatim: true };
    }
    if ((m = /^memberUpsert:(\w+)\.(\w+)\.(\w+)$/.exec(expr))) {
      const [, , keyM, valM] = m;
      const pObj = pfByName.has(valM) ? valM : pfByName.has("paramSpec") ? "paramSpec" : pfByName.has("payloadSpec") ? "payloadSpec" : null;
      if (!pObj) {
        foldNotes.push(`${objName}.${e.name}: ${expr} has no payload object to append — passed through verbatim`);
        return { text: `${qref(slot)} = ${expr}`, verbatim: true };
      }
      return { text: `${qref(slot)} = Option(state.${qref(slot)}).getOrElse(Nil).map(x => if (x.${qref(keyM)} == ${evRef(keyM)}) x.copy(${qref(valM)} = Option(x.${qref(valM)}).getOrElse(Nil) :+ ${evRef(pObj)}) else x)` };
    }
    if ((m = /^memberRemove:(\w+)\.(\w+)$/.exec(expr))) {
      const [, , keyM] = m;
      return { text: `${qref(slot)} = Option(state.${qref(slot)}).getOrElse(Nil).filterNot(x => x.${qref(keyM)} == ${evRef(keyM)})` };
    }
    if ((m = /^member(Append|Replace|Cut):(\w+)\.(\w+)\.(\w+)$/.exec(expr))) {
      const [, kind, , keyM, valM] = m;
      const pf = pfByName.get(valM);
      const innerOld = `Option(x.${qref(valM)}).getOrElse(Nil)`;
      const pIsList = pf ? scalaSig(pf.dataType).startsWith("List[") : false;
      let inner;
      if (kind === "Append") inner = pIsList ? `${innerOld} ++ ${evRef(valM)}` : `${innerOld} :+ ${evRef(valM)}`;
      else if (kind === "Replace") inner = pIsList ? evRef(valM) : `List(${evRef(valM)})`;
      else inner = `${innerOld}.filterNot(_ == ${evRef(valM)})`;
      return { text: `${qref(slot)} = Option(state.${qref(slot)}).getOrElse(Nil).map(x => if (x.${qref(keyM)} == ${evRef(keyM)}) x.copy(${qref(valM)} = ${inner}) else x)` };
    }
    foldNotes.push(`${objName}.${e.name}: expr ${expr} not translatable from spec data — passed through verbatim`);
    return { text: `${qref(slot)} = ${expr}`, verbatim: true };
  };
  (e.foldAssignments ?? []).forEach((f, i) => {
    if (!sfByName.has(f.slot)) return; // identifier folds (slot ∉ state): golden drops them; source stays 未映射
    const expr = String(f.expr);
    let phase;
    if (FOLD_VERB_RE.test(expr)) phase = 0;
    else if (f.slot === "status" && expr.startsWith("literal:")) phase = 2;
    else phase = backed(f.slot) ? 1 : 4;
    const r = renderFold(f);
    if (r === null) return;
    addAssign(f.slot, r.text, phase, i, !!r.verbatim);
  });

  // ── Phase 1: writtenBy derivations (2+-segment entries, head = payload field) ──
  for (const sf of S) {
    if (assigned.has(sf.name) || foldTodoSkip(sf)) continue;
    for (const w of sf.writtenBy || []) {
      if (assigned.has(sf.name)) break;
      const seg = w.split(".");
      if (seg.length < 2 || seg[0] !== e.name || seg[1].includes("[")) continue;
      const evField = seg[1];
      if (!pfByName.has(evField)) {
        todos1.push(`${sf.name}（writtenBy ${e.name}.${evField} 事件字段不存在）`);
        continue;
      }
      const text = compat(sf.name, evField, true);
      if (text) addAssign(sf.name, `${qref(sf.name)} = ${text}`, 1);
      else todos1.push(`${sf.name}（writtenBy ${e.name}.${evField} 类型不兼容 ${sigOfField(sf)}←${sigOfField(pfByName.get(evField))}）`);
    }
  }

  // ── Phase 2: status (explicit transition table; literal folds already placed) ──
  let statusTodo = false;
  if (sfByName.has("status") && !assigned.has("status")) {
    const tr = (spec.statusTransitions || {})[e.name];
    if (tr !== undefined && tr !== null) addAssign("status", statusLiteralText("status", tr), 2);
    else statusTodo = true; // no ruling → 枚举值无法判定 (golden: explicit-null ≈ absent, one known exception)
  }

  // ── Phase 3: audit fields (same-name payload > stem-exclusive > create/update class) ──
  const auditTodos = [];
  const stemRaw = e.name.startsWith(objName) ? e.name.slice(objName.length) : e.name;
  const stem = stemRaw.replace(/(Created|Updated|Changed|Occurred)$/, "");
  const stemField = stem ? stem.charAt(0).toLowerCase() + stem.slice(1) : "";
  const isCreate = AUDIT_CREATE_STEMS.has(stem);
  const isUpdate = AUDIT_UPDATE_STEMS.has(stem);
  for (const sf of S) {
    const fname = sf.name;
    if (assigned.has(fname) || foldTodoSkip(sf)) continue;
    const sig = scalaSig(sf.dataType);
    const atKind = /At$/.test(fname) && sig === "Instant";
    const byKind = /By$/.test(fname) && sig === "String";
    if (!atKind && !byKind) continue;
    let text = null;
    if (pfByName.has(fname)) text = compat(fname, fname);
    else if (atKind && pfByName.has("timestamp") && fname === `${stemField}At`) text = "event.timestamp";
    else if (byKind && pfByName.has("triggeredBy") && fname === `${stemField}By`) text = "event.triggeredBy";
    else if (atKind && pfByName.has("timestamp") && fname === "createdAt" && isCreate) text = "event.timestamp";
    else if (byKind && pfByName.has("triggeredBy") && fname === "createdBy" && isCreate) text = "event.triggeredBy";
    else if (atKind && pfByName.has("timestamp") && fname === "modifiedAt" && isUpdate) text = "event.timestamp";
    else if (byKind && pfByName.has("triggeredBy") && fname === "modifiedBy" && isUpdate) text = "event.triggeredBy";
    if (text) addAssign(fname, `${qref(fname)} = ${text}`, 3);
    else auditTodos.push(`${fname}（审计字段，本事件无同名载荷/词干专属/创建更新类）`);
  }

  // ── Phase 4: same-name payload fallback; DERIVED fields → review items ──
  const phase4Todos = [];
  for (const sf of S) {
    const fname = sf.name;
    if (assigned.has(fname) || foldAssignSkip(sf)) continue;
    if (/At$/.test(fname) || /By$/.test(fname)) continue; // audit handled in phase 3
    if (sf.origin === "DERIVED") {
      phase4Todos.push({ sIdx: sIdx(fname), text: `${fname}（DERIVED：${sf.derivation || "无公式"}）` });
      continue;
    }
    if (fname === "status") continue;
    if (pfByName.has(fname)) {
      const text = compat(fname, fname);
      if (text) addAssign(fname, `${qref(fname)} = ${text}`, 4);
      else phase4Todos.push({ sIdx: sIdx(fname), text: `${fname}（同名载荷类型不兼容）` });
    }
  }

  // ── Phase 5: version ← newVersion ──
  if (sfByName.has("version") && pfByName.has("newVersion") && !assigned.has("version"))
    addAssign("version", "version = event.newVersion", 5);

  assigns.sort((a, b) => a.phase - b.phase || (a.phase === 0 ? a.fIdx - b.fIdx : a.sIdx - b.sIdx));
  const argsText = assigns.map((a) => a.text);
  const copyText = argsText.length ? `state.copy(${argsText.join(", ")})` : "state";

  // ── 待审 assembly: writtenBy todos → status → audit → phase-4 (DERIVED/同名) → payload ──
  const items = [...todos1];
  if (statusTodo) items.push(`status（${e.name} → 枚举值无法判定）`);
  items.push(...auditTodos.filter((t) => !foldTodoSkip(sfByName.get(t.split("（")[0]))));
  items.push(
    ...phase4Todos
      .filter((t) => !foldTodoSkip(sfByName.get(t.text.split("（")[0])))
      .sort((a, b) => a.sIdx - b.sIdx)
      .map((t) => t.text)
  );
  const envelope = new Set(["lastVersion", "newVersion", "triggeredBy", "timestamp"]);
  const consumedTexts = assigns.filter((a) => !a.verbatim).map((a) => a.text);
  const unmapped = P.map((f) => f.name).filter((n) => !envelope.has(n) && !consumedTexts.some((t) => t.endsWith("." + n)));
  if (unmapped.length) items.push(`payload 未映射: ${unmapped.join(", ")}`);

  const lines = [];
  if (e.noteId) lines.push(`    // @knowledge ${kh(e.noteId, e.elementHash)}`);
  lines.push(`    case event: ${e.name} =>`);
  // 因果溯源 (B-CAUSAL): the event note's commandStorming causal link
  // (`event:<Source>@<strong|eventual>` in payload.links), restored into the
  // tree from the stage02 board payload evidence — see SCHEMA.md §CS.
  if (e.causal) lines.push(`      // 因果溯源: ${e.causal.source}（${e.causal.strength}）⇒ 本事件`);
  lines.push(`      ${copyText}`);
  if (items.length) lines.push(`      // 待审: ${items.join("；")}`);
  return lines.join("\n");
};

const handlerBlocks = orderedEvents.map(renderHandlerCase);
// B-assembly fix (2026-10-20): handler ports (fold side) + rule ports
// (decision side). A handled command's rule is a port CLASS (invariant-dsl
// emits `class XRule(member: Trait)`) iff its decision / emissionBindings
// text references a fold port member — the tree carries both texts; run-all
// forwards them on the aggregate spec. Port-free aggregates keep the exact
// Phase 1 emission shapes below.
const handlerPorts = [...handlerPortMembers.entries()].map(([member, fqn]) => ({
  member,
  fqn,
  trait: fqn.split(".").pop(),
}));
const cmdPortRefs = new Map();
for (const c of commands) {
  const text = `${JSON.stringify(c.decision ?? "")}\n${JSON.stringify(c.emissionBindings ?? "")}`;
  const refs = handlerPorts.filter(
    (p) => text.includes(`${p.member}.`) || text.includes(`${p.member}(`)
  );
  if (refs.length) cmdPortRefs.set(c.name, refs);
}
const behaviorsPorts = handlerPorts.filter((p) =>
  [...cmdPortRefs.values()].some((refs) => refs.includes(p))
);
// VO imports for `upsert:`/`memberUpsert:` fold slots (old-codegen behavior):
// the slot's element VO type, first-appearance ordered by the aggregate's
// order.events (spec event order), e.g. golden FMD = FieldStateSpec first.
const voImportNames = [];
{
  const seenVo = new Set();
  const prims = new Set(["String", "Int", "Long", "Double", "Boolean", "BigDecimal", "Instant", "Id", "Unit"]);
  for (const e of events) {
    const sfByName = new Map(handlerStateFields.map((f) => [f.name, f]));
    const pfByName = new Map((e.fields ?? []).map((f) => [f.name, f]));
    for (const f of e.foldAssignments ?? []) {
      const expr = String(f.expr ?? "");
      const sf = sfByName.get(f.slot);
      if (!sf) continue;
      const elem = elemSigOf(sf.dataType);
      if (!elem || prims.has(elem) || seenVo.has(elem)) continue;
      let renders = false;
      let m;
      if ((m = /^upsert:event\.(\w+)\.(\w+)$/.exec(expr))) {
        const pf = pfByName.get(m[1]);
        renders = !!(pf && scalaSig(pf.dataType) === elemSigOf(sf.dataType));
      } else if (/^upsert:event\.\w+$/.exec(expr)) {
        // bare upsert constructs the element VO by name → import it
        renders = !!((spec.voCatalog || {})[elem]);
      } else if ((m = /^memberUpsert:(\w+)\.(\w+)\.(\w+)$/.exec(expr))) {
        const valM = m[3];
        renders = !!(pfByName.has(valM) || pfByName.has("paramSpec") || pfByName.has("payloadSpec"));
      }
      if (renders) {
        seenVo.add(elem);
        voImportNames.push(`${valuesPkg}.${elem}`);
      }
    }
  }
}
const handlerImportBlock = [
  ...orderedEvents.map((ev) => `import ${entityPkg}.${objName}Entity.${ev.name}`),
  `import ${entityPkg}.${objName}Entity.${eventType}`,
  `import ${entityPkg}.${objName}Entity.${objName}EventHandler`,
  `import ${entityPkg}.${objName}Entity.${stateType}`,
  ...[...handlerPortTraits].sort().map((t) => `import ${t}`),
  ...voImportNames.map((i) => `import ${i}`),
].join("\n");

const eventHandler = `// @generated by rules_domain_gen:2026-08-23
// @knowledge-release 1.0.0
package ${entityPkg}.behaviors

${handlerImportBlock}

/**
 * ${objName} 状态投影（rules_domain_gen.mjs 生成，2026-08-22）：
 * writtenBy 血缘为权威映射（metarch.fields.template.json）；审计字段按同名载荷/创建更新类事件规则；
 * status 按事件名词干匹配枚举（STATE_TRANSITION）；待确认项标 TODO + 审校清单（story/eventhandler_review.md）。
 */
object ${objName}EventHandler {
${handlerPorts.length
  ? `  // 债④（2026-10-04·闭包形）：port 折叠点带参重载——装配点传实现，闭包捕获不可变。
  def apply(${handlerPorts.map((p) => `${p.member}: ${p.trait}`).join(", ")}): ${objName}EventHandler = {
${handlerPorts.map((p) => `    require(${p.member} != null, "${p.member} 未绑定");`).join("\n")}
    (state, event) => event match {
${handlerBlocks.join("\n\n")}
    case _ => state // 默认兜底
    }
  }`
  : `  def apply: ${objName}EventHandler = (state, event) => event match {
${handlerBlocks.join("\n\n")}
    case _ => state // 默认兜底
  }`}
}
`;
if (foldNotes.length) {
  for (const n of foldNotes) process.stderr.write(`aggregate-dsl fold-note: ${n}\n`);
}

// ═══ 3. Protocol (application/aggregates/<Name>Protocol.scala) ═══
// Commands + per-command Replies. State/Event imported from Entity.
// ingested-app 1:1: headers, Id import, nested type imports (alphabetical order)
// Golden Protocol command docs carry @knowledge anchors but NO description
// text (unlike Entity docs): `   * @param <name>  @knowledge <noteId>`.
// Only fields WITH noteIds get lines (envelope fields like triggeredBy are
// absent in golden); verified across all 27 golden Protocols.
const paramDocNoDesc = (fields) => {
  const kn = (fields ?? []).filter((f) => f.noteId);
  if (!kn.length) return "";
  const lines = kn.map((f) => `   * @param ${qref(f.name)}  @knowledge ${kh(f.noteId, f.elementHash)}`);
  return `  /**\n${lines.join("\n")}\n   */\n`;
};
const commandDefs = orderedCommands
  .map((c) => {
    const fields = fieldsOf(c.fields);
    const allFields = fields ? `${fields}, replyTo: ActorRef[${c.name}Reply]` : `replyTo: ActorRef[${c.name}Reply]`;
    return `${paramDocNoDesc(c.fields)}  case class ${c.name}(${allFields}) extends ${commandFamily}`;
  })
  .join("\n");

// Get<Agg>State synthesis (old pipeline): a state-query command that is NOT
// tree data — appended after all regular command case classes (last, no
// scaladoc), its Reply appended LAST after the alphabetical replies, and the
// Protocol import block gains the self-import of the Reply type (sorted in
// with the per-command Reply imports). Keyed on the aggregate identifier.
const getStateName = `Get${objName}State`;
const getStateReplyName = `${getStateName}Reply`;
const synthesizeGet = !!identifierField && !commands.some((c) => c.name === getStateName);
const getStateCmdDef = synthesizeGet
  ? `  case class ${getStateName}(${qref(identifierField.name)}: ${scalaSig(identifierField.dataType)}, replyTo: ActorRef[${getStateReplyName}]) extends ${commandFamily}`
  : null;
const commandDefsAll = getStateCmdDef ? `${commandDefs}\n${getStateCmdDef}` : commandDefs;

const replyDefs = orderedCommands
  .map((c) => `  case class ${c.name}Reply(error: Option[iMadzError]) extends CborSerializable`)
  .join("\n");
const getStateReplyDef = synthesizeGet
  ? `  case class ${getStateReplyName}(state: ${stateType}) extends CborSerializable`
  : null;
const replyDefsAll = getStateReplyDef ? `${replyDefs}\n${getStateReplyDef}` : replyDefs;

// Protocol imports: fully alphabetical single block (ingested-app 1:1) —
// framework refs, nested Protocol types, Entity types, then data-driven
// Id / Instant / scala.collection.immutable.List / domain.values.* imports.
const protocolImportBlock = sortedImportBlock([
  "akka.actor.typed.ActorRef",
  "net.imadz.common.CborSerializable",
  "net.imadz.common.CommonTypes.iMadzError",
  `${pkg}.${objName}Protocol.${commandFamily}`,
  ...commands.map((c) => `${pkg}.${objName}Protocol.${c.name}Reply`),
  ...(synthesizeGet ? [`${pkg}.${objName}Protocol.${getStateReplyName}`] : []),
  `${entityPkg}.${objName}Entity.${eventType}`,
  `${entityPkg}.${objName}Entity.${stateType}`,
  ...typeImports([
    ...commands.flatMap((c) => c.fields ?? []),
    ...(synthesizeGet ? [identifierField] : []),
  ]),
]);

const protocol = `// @generated by CodegenMain:225ed28b
// @knowledge-release 1.0.0
package ${pkg}

${protocolImportBlock}

object ${objName}Protocol {

  // Commands
  sealed trait ${commandFamily} extends CborSerializable
${commandDefsAll}

  // Replies
${replyDefsAll}${synthesizeGet ? "\n\n\n" : "\n"}
  // CommandHandler type alias (moved from Aggregate to break circular dependency)
  type ${handlerFamily} = (${stateType}, ${commandFamily}) => akka.persistence.typed.scaladsl.Effect[${eventType}, ${stateType}]
${synthesizeGet ? "\n" : ""}
}
`;

// ═══ 4. Aggregate ═══
// ingested-app 1:1: headers, alphabetical imports, comments, tags = tabulate(1) "XxxTag$i"
const aggregate = `// @generated by CodegenMain:225ed28b
// @knowledge-release 1.0.0
package ${pkg}

import akka.cluster.sharding.typed.scaladsl.EntityTypeKey
import akka.persistence.typed.scaladsl.Effect
import ${pkg}.${objName}Protocol.${commandFamily}
import ${pkg}.behaviors.${objName}Behaviors
import ${entityPkg}.${objName}Entity.${eventType}
import ${entityPkg}.${objName}Entity.${stateType}

object ${objName}Aggregate {

// Commands are defined in Protocol
// Replies are defined in Protocol




  // Wiring (Separated Behavior) - Type alias now in Protocol
${handlerPorts.length
  ? `  def commandHandler(${handlerPorts.map((p) => `${p.member}: ${p.fqn}`).join(", ")}): ${pkg}.${objName}Protocol.${handlerFamily} = ${objName}Behaviors.apply${behaviorsPorts.length ? `(${behaviorsPorts.map((p) => p.member).join(", ")})` : ""}`
  : `  def commandHandler: ${pkg}.${objName}Protocol.${handlerFamily} = ${objName}Behaviors.apply`}



  val entityTypeKey: EntityTypeKey[${commandFamily}] = EntityTypeKey("${objName}")
  val tags: Vector[String] = Vector.tabulate(1)(i => s"${objName}Tag$i")


}
`;

// ═══ 5. Behaviors ═══
const invariantPkg = spec.invariantPackage || `${pkg}.invariant`;
const hasHandled = commands.some((c) => handled.has(c.name));
const ruleImport = hasHandled ? `import ${invariantPkg}.${objName}Rules` : "";

const behaviorCases = orderedCommands
  .map((c) => {
    if (handled.has(c.name)) {
      // B-assembly fix (2026-10-20): port-class rules are constructed with
      // `new` + the port members captured by Behaviors.apply (golden form).
      const refs = cmdPortRefs.get(c.name) ?? [];
      const rule = refs.length
        ? `new ${objName}Rules.${c.name}Rule(${refs.map((r) => r.member).join(", ")})`
        : `${objName}Rules.${c.name}Rule`;
      const helper = `${c.name}Helper`;
      return `    case cmd: ${c.name} => runReplyingPolicy(${rule}, ${helper})(state, cmd).replyWith(cmd.replyTo)`;
    } else {
      // B-assembly fix (2026-10-20): the stub pattern was `case X(replyTo)`,
      // an unapply of arity 1 against multi-field command case classes —
      // generated Behaviors never compiled. Typed wildcard matches any arity;
      // the body is the AI_PROMPT ??? stub either way.
      return `    case _: ${c.name} =>
      /*
      >>> AI_PROMPT_START
      Context: Command Handler
      Task: Handle command '${c.name}'
      State: ${stateType}
      Available: repo
      Expected Result: Return Effect.persist(event) or Effect.reply
      <<< AI_PROMPT_END
      */
      ???`;
    }
  })
  .join("\n");

const behaviors = `// @generated by rules_domain_gen:2026-08-23
// @knowledge-release 1.0.0
package ${pkg}.behaviors

import akka.persistence.typed.scaladsl.Effect
import net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy
import ${pkg}.${objName}Protocol._
import ${entityPkg}.${objName}Entity.${eventType}
import ${entityPkg}.${objName}Entity.${stateType}
${ruleImport ? `${ruleImport}\n` : ""}${behaviorsPorts.map((p) => `import ${p.fqn}`).join("\n")}${behaviorsPorts.length ? "\n" : ""}
/**
 * ${objName} 命令流接线（rules_domain_gen.mjs 生成，2026-08-22）：
 * 每个命令 → runReplyingPolicy(规则, Helper)(state, cmd).replyWith(replyTo)；
 * 事件后置校验（EVENT_POSTCONDITION）经 withPost 挂点（persist 前校验事件载荷，失败 → 失败 reply）。
 */
object ${objName}Behaviors extends ${objName}CommandHelpers {

  type ${objName}AggregateCommandHandler = (${stateType}, ${commandFamily}) => Effect[${eventType}, ${stateType}]
${behaviorsPorts.length
  ? `  // 债④（2026-10-04·闭包形）：port 注入重载——装配点（Bootstrap）传手写实现，闭包捕获不可变。
  def apply(${behaviorsPorts.map((p) => `${p.member}: ${p.trait}`).join(", ")}): ${objName}AggregateCommandHandler = { ${behaviorsPorts.map((p) => `require(${p.member} != null, "${p.member} 未绑定");`).join(" ")}
    (state, command) => defaultBehaviors(state, ${behaviorsPorts.map((p) => p.member).join(", ")}).apply(command)
  }`
  : `  def apply: ${objName}AggregateCommandHandler = (state, command) => defaultBehaviors(state).apply(command)`}

  private def defaultBehaviors(state: ${stateType}${behaviorsPorts.length ? `, ${behaviorsPorts.map((p) => `${p.member}: ${p.trait}`).join(", ")}` : ""}): PartialFunction[${commandFamily}, Effect[${eventType}, ${stateType}]] = {
${behaviorCases}
  }

}
`;

// ═══ 6. Factory ═══
// Golden form (old AggregateFactoryBuilder): exactly TWO methods —
// create<Name>WithoutBalance (bare EntityRef) and
// create<Name>WithInitialValue (ask pattern over the init command).
// Init command = first command in family (alphabetical) order — verified
// 27/27 against golden; the synthetic Get<Name>State is read-only and never
// in spec.commands. If the init command has no parameter named as the
// aggregate identifier, the identifier (Id) is prepended to the method
// parameters, used only for entityRefFor, and excluded from the ask args
// (3 golden cases: DoR, Note, OrganizationMember).
const sigOfF = (f) => {
  const sig = scalaSig(f.dataType);
  return f.optional ? `Option[${sig}]` : sig;
};
const firstLowerF = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const initCmd = [...(spec.commands ?? [])].sort((a, b) => (a.name < b.name ? -1 : 1))[0];
const identF = spec.identifier || { name: `${firstLowerF(objName)}Id`, noteId: null, elementHash: null };
const initParamsRaw = (initCmd?.fields ?? []).map((f) => ({
  name: f.name,
  type: sigOfF(f),
  noteId: f.noteId || null,
  elementHash: f.elementHash || null,
}));
const hasIdParam = initParamsRaw.some((p) => p.name === identF.name);
const idParamForFactory = {
  name: identF.name,
  type: "Id",
  noteId: identF.noteId || null,
  elementHash: identF.elementHash || null,
};
const method2Params = hasIdParam ? initParamsRaw : [idParamForFactory, ...initParamsRaw];
const askParams = hasIdParam ? method2Params : initParamsRaw;

const factoryDocLines = (params) =>
  params
    .filter((p) => p.noteId)
    .map((p) => `   * @param ${qref(p.name)}  @knowledge ${kh(p.noteId, p.elementHash)}`);
const factoryDocBlock = (params) => {
  const lines = factoryDocLines(params);
  return lines.length ? `  /**\n${lines.join("\n")}\n   */\n` : "";
};

// Imports: one ASCII-sorted list, duplicates retained (old
// CodeGenerationDSL semantics): Future appears twice; the List import
// appears once per distinct List[<elem>] signature in the init params.
const factoryTypeFqns = new Set();
const factoryListSigs = new Set();
for (const p of method2Params) {
  if (p.type.startsWith("List[")) factoryListSigs.add(p.type);
  for (const b of p.type.match(/[A-Z][A-Za-z0-9]*/g) || []) {
    if (b === "List") continue;
    if (b === "Id") continue; // already in the fixed import set (golden: once)
    else if (b === "Instant") factoryTypeFqns.add("java.time.Instant");
    else if (["String", "Int", "Long", "Double", "Float", "Boolean", "BigDecimal", "Option", "Unit"].includes(b)) {}
    else if (["Map", "Seq", "Set", "Vector"].includes(b)) factoryTypeFqns.add(`scala.collection.immutable.${b}`);
    else factoryTypeFqns.add(`${valuesPkg}.${b}`);
  }
}
const factoryImports = [
  "akka.cluster.sharding.typed.scaladsl.ClusterSharding",
  "akka.cluster.sharding.typed.scaladsl.EntityRef",
  "akka.util.Timeout",
  "javax.inject.Inject",
  "net.imadz.common.CommonTypes.Id",
  "net.imadz.common.CommonTypes.iMadzError",
  `${pkg}.${objName}Aggregate`,
  ...(spec.commands ?? []).flatMap((c) => [
    `${pkg}.${objName}Protocol.${c.name}`,
    `${pkg}.${objName}Protocol.${c.name}Reply`,
  ]),
  `${pkg}.${objName}Protocol.Get${objName}State`,
  `${pkg}.${objName}Protocol.Get${objName}StateReply`,
  `${pkg}.${objName}Protocol.${commandFamily}`,
  ...factoryTypeFqns,
  "scala.concurrent.ExecutionContext",
  "scala.concurrent.Future",
  "scala.concurrent.Future",
  ...[...factoryListSigs].map(() => "scala.collection.immutable.List"),
  "scala.concurrent.duration._",
].sort();

const factory = `// @generated by CodegenMain:225ed28b
// @knowledge-release 1.0.0
package ${pkg}.factories

${factoryImports.map((i) => `import ${i}`).join("\n")}

/**
 * ${objName}AggregateFactory: Aggregate Factory for ${objName}Aggregate
 * Creates and manages aggregate instances via cluster sharding
 */
class ${objName}AggregateFactory @Inject() (clusterSharding: ClusterSharding)(implicit ec: ExecutionContext) {
  implicit val askTimeout: Timeout = Timeout(10.seconds)

${factoryDocBlock([idParamForFactory])}  def create${objName}WithoutBalance(${identF.name}: Id): EntityRef[${commandFamily}] = {
    clusterSharding.entityRefFor(${objName}Aggregate.entityTypeKey, ${identF.name}.toString)
  }

${factoryDocBlock(method2Params)}  def create${objName}WithInitialValue(${method2Params.map((p) => `${qref(p.name)}: ${p.type}`).join(", ")}): Future[Either[iMadzError, EntityRef[${commandFamily}]]] = {
    val entityRef: EntityRef[${commandFamily}] = clusterSharding
      .entityRefFor[${commandFamily}](${objName}Aggregate.entityTypeKey, ${identF.name}.toString)
    for {
      confirmation <- entityRef.ask[${initCmd.name}Reply](${initCmd.name}(${askParams.map((p) => qref(p.name)).join(", ")}, _))
    } yield {
      confirmation.error
        .map(Left.apply[iMadzError, EntityRef[${commandFamily}]])
        .getOrElse(Right(entityRef))
    }
  }

}
`;

// ═══ Write ═══
const behaviorsDir = join(outDir, "behaviors");
const factoriesDir = join(outDir, "factories");
mkdirSync(behaviorsDir, { recursive: true });
mkdirSync(factoriesDir, { recursive: true });

writeFileSync(join(outDir, `${objName}Protocol.scala`), protocol);
writeFileSync(join(outDir, `${objName}Aggregate.scala`), aggregate);
writeFileSync(join(behaviorsDir, `${objName}Behaviors.scala`), behaviors);
writeFileSync(join(factoriesDir, `${objName}AggregateFactory.scala`), factory);

// Entity files go to spec.entityDir (domain/entities tree)
if (spec.entityDir) {
  const entityBehDir = join(spec.entityDir, "behaviors");
  mkdirSync(spec.entityDir, { recursive: true });
  mkdirSync(entityBehDir, { recursive: true });
  writeFileSync(join(spec.entityDir, `${objName}Entity.scala`), entity);
  writeFileSync(join(entityBehDir, `${objName}EventHandler.scala`), eventHandler);
}

console.log(
  `aggregate-dsl: wrote ${objName}Protocol.scala, ${objName}Aggregate.scala, behaviors/${objName}Behaviors.scala, factories/${objName}AggregateFactory.scala` +
    (spec.entityDir ? `, entities/${objName}Entity.scala, entities/behaviors/${objName}EventHandler.scala` : "")
);
