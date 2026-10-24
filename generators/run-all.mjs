#!/usr/bin/env node
// ═══ run-all.mjs v3 — toolchain-driven pipeline → complete sbt project ═══
// Uses lib/compile.mjs (compileTree) — NEVER hand-glob directories.
// The toolchain knows the canonical layout; we consume its output.
//
// Pipeline: tree → compileTree → canonical JSON → generators → sbt project
//
// Usage: node run-all.mjs <tree-dir> <out-dir> [--binding <dir>] [--package <pkg>]
//   --package  base package for generated code (default: net.imadz.metarch)
//
// Output is a complete, compilable single-module Play/sbt project:
//   build.sbt, project/{build.properties,plugins.sbt}, conf/{application.conf,routes},
//   .gitignore, app/<base package path>/... (ingested-app single-module layout)

import { execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync, mkdtempSync, renameSync, readFileSync, readdirSync } from "fs";
import { join, dirname, relative } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { compileTree } from "../lib/compile.mjs";
import { generatePolicyExec, generatePolicyBootstraps } from "./policy-dsl/policyexec.mjs";
import { generateSmViews } from "./projection-dsl/smviews.mjs";
import { generateViewRepos, generateViewDdl, generateMongoIndexSpec } from "./projection-dsl/viewrepo.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const [treeDir, outDir, ...rest] = process.argv.slice(2);
const flagVal = (f, dflt) =>
  rest.includes(f) ? rest[rest.indexOf(f) + 1] : dflt;
const bindingDir = flagVal("--binding", join(__dirname, "bindings"));
const basePkg = flagVal("--package", "net.imadz.metarch");

if (!treeDir || !outDir) {
  console.error(
    "usage: node run-all.mjs <tree-dir> <out-dir> [--binding <dir>] [--package <pkg>]"
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
// spec scratch lives outside the project — no tool artifacts in the output
const specDir = mkdtempSync(join(tmpdir(), "run-all-spec-"));

// ── Step 1: compile tree via toolchain ──
console.log("compiling tree via lib/compile.mjs...");
const canonicalJson = compileTree(treeDir);
const canonical = JSON.parse(canonicalJson);
console.log(`  schema: ${canonical.schemaVersion}, workshop: ${canonical.workshop}`);

// ── Step 2: extract atoms by kind from canonical ──
const notes = [];
for (const session of canonical.sessions || []) {
  for (const scope of session.scopes || []) {
    for (const note of scope.notes || []) {
      notes.push(note);
    }
  }
}
console.log(`  total notes: ${notes.length}`);

const byType = (t) => notes.filter((n) => n.type === t);
const events = byType("event");
const commands = byType("command");
const aggregates = canonical.aggregates || [];
const policies = byType("policy");
const readModels = canonical.readModels || [];
const valueObjects = canonical.valueObjects || [];
const pipelines = canonical.pipelines || [];
const domainServices = canonical.domainServices || [];
const sagas = canonical.sagas || [];

// ── saga binding TypeContracts (truthsrc.saga-binding/v1) ──
// The saga face's types live in the binding beside the tree (the tree itself
// declares no valueObjects for them): kind "id" = bounded text → proto string;
// kind "money" (ISO-4217, minor-unit-string, scale 2) → MoneyPO {minorUnits,
// currency} — the same shapes the scala pipeline's proto builder emits.
// Absent binding (e.g. the metarch golden tree) ⇒ both catalogs empty and every
// consumer below is inert — golden output is byte-stable by construction.
const sagaBindingPath = flagVal(
  "--saga-binding",
  existsSync(join(dirname(treeDir), "bindings.json"))
    ? join(dirname(treeDir), "bindings.json")
    : null
);
const sagaBinding = sagaBindingPath ? JSON.parse(readFileSync(sagaBindingPath, "utf8")) : null;
const contractIds = new Set();
const contractMoneyVos = [];
if (sagaBinding && Array.isArray(sagaBinding.sagas)) {
  for (const s of sagaBinding.sagas) {
    for (const t of s.types || []) {
      if (t.kind === "id") contractIds.add(t.id);
      else if (t.kind === "money") contractMoneyVos.push({
        name: t.id,
        fields: [
          { name: "minorUnits", dataType: "String", noteId: null, elementHash: null, optional: false },
          { name: "currency", dataType: "String", noteId: null, elementHash: null, optional: false },
        ],
      });
    }
  }
}
console.log(`  sagas: ${sagas.length}${sagaBinding ? `, binding types: ${contractIds.size} ids + ${contractMoneyVos.length} money` : ""}`);

// ── serial/saga face normalization (scala pipeline parity) ──
// Only when a saga binding is present (the metarch golden tree never enters
// this block — byte-stable by construction):
//   - hyphenated event names are illegal Scala/proto identifiers → explicit
//     underscore rename across events AND commands[].produces (the join face);
//   - binding contract id types (bounded text) collapse to String in every
//     Scala-facing field, including Map keys (Map[String, Money] — the golden
//     master's own state shape in the generated app).
if (sagaBinding) {
  const normType = (t) => {
    if (typeof t !== "string") return t;
    if (contractIds.has(t.trim())) return "String";
    const m = t.match(/^(Map[<[])([^,>\]]+)(,\s*.*)([>\]])$/);
    if (m && contractIds.has(m[2].trim())) return `${m[1]}String${m[3]}${m[4]}`;
    return t;
  };
  const scalaName = (n) => (typeof n === "string" && n.includes("-") ? n.replace(/-/g, "_") : n);
  for (const a of aggregates) {
    if (a.identifier && contractIds.has(String(a.identifier.dataType || "").trim())) a.identifier.dataType = "String";
    for (const f of a.stateFields || []) if (f && typeof f === "object" && "dataType" in f) f.dataType = normType(f.dataType);
    for (const e of a.events || []) {
      e.name = scalaName(e.name);
      for (const f of e.payloads || []) if (f && typeof f === "object" && "dataType" in f) f.dataType = normType(f.dataType);
    }
    for (const c of a.commands || []) {
      if (Array.isArray(c.produces)) c.produces = c.produces.map(scalaName);
      for (const f of c.parameters || []) if (f && typeof f === "object" && "dataType" in f) f.dataType = normType(f.dataType);
    }
  }
}
console.log(`  events: ${events.length}, commands: ${commands.length}`);
console.log(`  aggregates: ${aggregates.length}`);
console.log(`  policies: ${policies.length}`);
console.log(`  readModels: ${readModels.length}`);
console.log(`  valueObjects: ${valueObjects.length}`);
console.log(`  pipelines: ${pipelines.length}`);
console.log(`  domainServices: ${domainServices.length}`);

// ── E2: command → decision-view key map (1:1 old rule: first view wins over
// decisionSupport; keys come from the read-model atoms' viewKey payload) ──
const cmdDecisionView = new Map();
for (const r of readModels) for (const c of (r.decisionSupport || [])) {
  if (!cmdDecisionView.has(c) && r.viewKey) cmdDecisionView.set(c, r.viewKey);
}
const dvJsExpr = (cmdName) => {
  const dv = cmdDecisionView.get(cmdName);
  return dv ? `play.api.libs.json.JsString("${dv}")` : "play.api.libs.json.JsNull";
};

// ── @knowledge noteId index (Category A, noteId half) ──
// Golden annotates elements with `// @knowledge <noteId>@<hash>`; the noteId
// half lives in canonical session notes keyed by (type, name) with the owning
// aggregate in `links` (aggregate:<Name>). The same logical note appears in
// several sessions with the SAME noteId (verified), so first-wins is safe;
// 'refining' stage is preferred when present (its notes carry the richest
// payloads). The @<hash> suffix is the element's `elementHash` — seed-
// backfilled into the tree next to its noteId (Decision 1, 2026-10-20; the
// old-pipeline fingerprint itself is not derivable, so it is carried as
// data). Emitters render `@knowledge <noteId>@<elementHash>` when present.
// ── B-CAUSAL: event→event causal provenance ──
// A commandStorming event note may carry `event:<Source>@<strong|eventual>`
// in payload.links (SCHEMA.md §CS: an event→event causal chain). The old
// pipeline rendered it into the EventHandler case as a `// 因果溯源:` comment.
// Keyed by event name (globally unique in this corpus; first hit wins).
const causalByEvent = new Map();
for (const n of notes) {
  if (n.stage !== "commandStorming" || n.type !== "event" || !n.name) continue;
  for (const l of n.links || []) {
    const m = /^event:(.+)@(strong|eventual)$/.exec(String(l));
    if (m && !causalByEvent.has(n.name)) causalByEvent.set(n.name, { source: m[1], strength: m[2] });
  }
}

const noteIdIndex = new Map();
const noteHashIndex = new Map();
const hashByNoteId = new Map();
for (const n of notes) {
  if (n.noteId && n.elementHash && !hashByNoteId.has(n.noteId))
    hashByNoteId.set(n.noteId, n.elementHash);
  if (!n.noteId || !n.type || !n.name) continue;
  const agg = (n.links || []).find((l) => String(l).startsWith("aggregate:"));
  const aggName = agg ? agg.slice("aggregate:".length) : "";
  const key = `${n.type}|${aggName}|${n.name}`;
  const prev = noteIdIndex.get(key);
  if (!prev || n.stage === "refining") {
    noteIdIndex.set(key, n.noteId);
    if (n.elementHash) noteHashIndex.set(key, n.elementHash);
  }
}
const noteIdOf = (type, name, aggName) =>
  noteIdIndex.get(`${type}|${aggName || ""}|${name}`) ||
  noteIdIndex.get(`${type}||${name}`) ||
  null;
const elementHashOf = (type, name, aggName) =>
  noteHashIndex.get(`${type}|${aggName || ""}|${name}`) ||
  noteHashIndex.get(`${type}||${name}`) ||
  hashByNoteId.get(noteIdOf(type, name, aggName)) ||
  null;

// ═══ PHASE1-TRANSITION: golden stamp replication for 1:1 verification ═══
// Golden files carry `@generated by <gen>:<stamp>` headers whose stamps are
// old-pipeline BATCH provenance (which regeneration batch last touched the
// file) — there is no content rule to derive them from. For Phase 1 1:1
// verification we replicate the stamps golden carries, per (kind, name):
//   - most kinds already match the emitters' own stamps (CodegenMain:225ed28b,
//     rules_domain_gen:2026-08-23, gen_api_layer:2026-08-26, …) and are NOT
//     listed here;
//   - repository traits: 15 aggregates came from gen_api_layer:2026-08-26
//     (current emitter default), 11 from an older CodegenMain template
//     variant (stamp + body variant — repository-dsl switches on
//     spec.traitStamp), UseCaseDefinition alone from CodegenMain:66b5b602;
//   - the whole PauseProject read-model family (view, 7 handlers, view
//     bootstrap) was regenerated in one later batch: CodegenMain:c028adad;
//   - PolicyOn* bootstraps carry the policy-exec batch stamp.
// Remove this whole block when Phase 1 closes (stamps then become the
// generators' own provenance again).
const PHASE1_REPO_TRAIT_STAMPS = {
  CemEdge: "CodegenMain:2026-08-23",
  DoR: "CodegenMain:2026-08-23",
  FieldModelDefinition: "CodegenMain:2026-08-23",
  FsmDefinition: "CodegenMain:2026-08-23",
  KnowledgePatch: "CodegenMain:2026-08-23",
  ReadModelDefinition: "CodegenMain:2026-08-23",
  RoleCommandBinding: "CodegenMain:2026-08-23",
  TruthSourceProvenance: "CodegenMain:2026-08-23",
  UseCaseDefinition: "CodegenMain:66b5b602",
  ValueObjectDefinition: "CodegenMain:2026-08-23",
  WorkTicket: "CodegenMain:2026-08-23",
  Workshop: "CodegenMain:2026-08-23",
};
const PHASE1_STAMP_POSTPASS = [
  [/application\/projection\/PauseProjectDecisionView\.scala$/, "CodegenMain:c028adad"],
  [/application\/projection\/handlers\/PauseProject[A-Za-z]*Handler\.scala$/, "CodegenMain:c028adad"],
  [/infrastructure\/bootstrap\/PauseProjectDecisionViewBootstrap\.scala$/, "CodegenMain:c028adad"],
  [/infrastructure\/bootstrap\/PolicyOn[A-Za-z]*Bootstrap\.scala$/, "gen_policy_exec:2026-10-04（policy 执行侧·glue policy 生成面批）"],
];

// Projection intent exprs (Category D): storyMapping readModel notes carry
// info.projectionRefCodes[<EventName>] = golden's `// 投影意图` comment body.
const projRefCodes = new Map();
// Golden handler wiring (verified 34/34 against ingested-app): a view wires
// exactly the events listed in its storyMapping note's `links` (deduped, in
// link order) that belong to the view's primary sourceAggregate. Cross-
// aggregate consumesEvents are NOT wired here (they are covered by the owning
// aggregate's own views), and primary events absent from consumesEvents but
// present in links ARE wired.
const projViewLinks = new Map();
for (const n of notes) {
  if (n.type !== "readModel" || !n.name) continue;
  const rc = n.info && n.info.projectionRefCodes;
  if (rc && typeof rc === "object") projRefCodes.set(n.name, rc);
  const evs = [];
  for (const l of n.links || []) {
    if (typeof l === "string" && l.startsWith("event:")) {
      const e = l.slice(6);
      if (!evs.includes(e)) evs.push(e);
    }
  }
  if (evs.length) projViewLinks.set(n.name, evs);
}

// ── Step 3: run generators into package directories ──
const results = [];

const pascal = (s) =>
  String(s).split(/[-_ ]/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join("");
// Transliteration map: Chinese policy names → English PascalCase.
// The truth tree has 13 policies with Chinese names; these must become ASCII
// for Scala filenames (e.g. PolicyOn<Name>Bootstrap.scala).
const ZH_NAME_MAP = {
  "租户入驻后创建者自动成为Owner": "TenantOnboardedCreatorAutoBecomesOwner",
  "租户入驻后TenantOwner可创建工作组": "TenantOnboardedOwnerCanCreateWorkgroup",
  "注册选择新建租户后自动入驻": "RegisterNewTenantAutoOnboard",
  "目录应用后确认补丁合并": "CatalogAppliedConfirmPatchMerge",
  "成员加入后维护租户名册": "MemberJoinedMaintainTenantRoster",
  "补丁合并后应用到目录": "PatchMergedApplyToCatalog",
  "概念增量后确立概念": "ConceptDeltaEstablishConcept",
  "立项后创建目录版本": "ProjectInitiatedCreateCatalogVersion",
  "知识就绪后完成会话": "KnowledgeReadyCompleteSession",
  "概念确立后检测冲突": "ConceptEstablishedDetectConflict",
  "补丁合并后回锚落点": "PatchMergedAnchorLandingPoint",
  "立项并指定Owner后安排工作坊": "ProjectInitiatedAssignOwnerScheduleWorkshop",
  "DoR通过后请求合并知识": "DoRPassedRequestMergeKnowledge",
};
// asciiName: transliterate known Chinese names, else strip non-ASCII so the
// result is always a safe Scala identifier fragment.
const asciiName = (s) => {
  const raw = String(s);
  if (ZH_NAME_MAP[raw]) return ZH_NAME_MAP[raw];
  const stripped = raw.replace(/[^\x00-\x7F]/g, "");
  return stripped || "Unnamed";
};
// normalize canonical dataType → emitter type key (emitter maps key → Scala type)
const normType = (t) =>
  ({ string: "string", number: "number", integer: "integer", long: "long", boolean: "boolean", timestamp: "long" })[t] || "string";
const normFields = (fields) =>
  (fields || []).map((f) => ({ name: f.name, dataType: normType(f.dataType) }));
// Raw passthrough for the golden-faithful emitters (aggregate-dsl, invariant-dsl):
// they port the old codegen's DataTypeMapper themselves, so the tree's raw
// dataType ("List<CodeAnchorDelta>", "Instant", "String (UUID)", bare VO names)
// and the `optional` flag must reach emit.mjs intact — normType would collapse
// every VO reference to "string" and value-object imports could never be derived.
const normFieldsRaw = (fields) =>
  (fields || []).map((f) => ({ name: f.name, dataType: f.dataType, optional: !!f.optional }));
// Rich passthrough (Categories A/B): golden-faithful emitters also need the
// per-field noteId (@knowledge anchors), origin (fold/rule classification),
// businessDef/description (scaladoc + 待审 reasons), derivation and writtenBy
// (fold coverage). Keep every key the payload carries; never invent.
const normFieldsRich = (fields) =>
  (fields || []).map((f) => ({
    name: f.name,
    dataType: f.dataType,
    optional: !!f.optional,
    noteId: f.noteId || null,
    elementHash: f.elementHash || null,
    origin: f.origin || "",
    businessDef: f.businessDef || "",
    description: f.description || "",
    derivation: f.derivation || "",
    uiLabel: f.uiLabel || "",
    writtenBy: f.writtenBy || [],
    lineageHint: f.lineageHint || "",
    role: f.role || "",
    nature: f.nature || "",
    parent: f.parent || null,
    defaultValue: f.defaultValue !== undefined ? f.defaultValue : null,
  }));

const pkgDir = (pkg) => join(outDir, "app", ...pkg.split("."));

/**
 * mode "single": emitter writes exactly outPath (full target path, we choose the name)
 * mode "dir":     emitter writes multiple files into dirname(outPath); we pass a
 *                marker file path in the right package dir and delete the marker after
 *                (opts.noMarker: emitter takes <spec> <out-dir> directly — pass the
 *                package dir itself, no marker)
 */
function runGen(gen, items, pkg, toSpec, opts = {}) {
  const mode = opts.mode || "single";
  const genDir = join(__dirname, gen);
  const emitJs = join(genDir, "emit.mjs");
  if (!existsSync(emitJs)) {
    results.push({ gen, status: "skip", reason: "no emit.mjs" });
    return;
  }
  const targetPkgDir = pkgDir(pkg);
  mkdirSync(targetPkgDir, { recursive: true });
  let count = 0;
  let firstError = null;
  items.forEach((item, i) => {
    if (firstError) return;
    try {
      const spec = toSpec(item);
      const specPath = join(specDir, `${gen}-${i}.json`);
      writeFileSync(specPath, JSON.stringify(spec, null, 2));
      const outPath =
        mode === "single"
          ? join(targetPkgDir, opts.fileName(item, spec))
          : opts.noMarker
            ? targetPkgDir
            : join(targetPkgDir, ".emit-marker.scala");
      execSync(`node "${emitJs}" "${specPath}" "${outPath}"`, { stdio: "pipe" });
      if (mode === "dir" && !opts.noMarker && existsSync(outPath)) rmSync(outPath);
      count++;
    } catch (e) {
      firstError = e.message.slice(0, 300);
    }
  });
  results.push(
    firstError
      ? { gen, status: "error", error: firstError }
      : { gen, status: "ok", count }
  );
}

const objNameOf = (a) => pascal(a.name);

// NOTE: event-dsl is intentionally NOT wired. Events are defined inside
// domain/entities/<Name>Entity.scala (generated by aggregate-dsl v4) and
// imported by Protocol. Standalone domain/event/ files do not exist in ingested-app.

// event-dsl REMOVED (v4): events live in domain/entities/<Name>Entity.scala,
// generated by aggregate-dsl. No standalone domain/event/ files (ingested-app 1:1).

// ── 0f. paramDefs: the old pipeline's 5-stage parameter ordering ─────────────
// Port of rules_domain_gen.mjs L949–L1155 (see analysis-paramdefs-ordering.md).
// Per command, the ordered subset of command parameters that reaches
// <Cmd>Params (RuleParams VO), CommandHelpers.toParam and policy constructor
// calls. Stages append only; first occurrence wins:
//   1. command-rule references (declaration-order scan) + triggeredBy tail
//   2. DecisionSpec emission bindings (list order) + emitWhen cond/branches
//   3. policy bindings keys (fan-out forwarding)
//   4. produced-event payloads with same name AND same Scala type
//   5. event payload lineageHint "<Cmd>.<field>" (identifier skipped)
// Stage 1's old input (rule expression trees) has no canonical counterpart;
// the referenced set is recovered from guard refs (IR-…_<field> suffixes,
// ir_cmd_<Cmd>_triggered_by) and guard/precondition desc mentions
// (<Cmd>.<field> and backticked fields) — heuristic-equivalent, validated
// against golden membership for all 133 commands.
const scalaSigPD = (dataType) => {
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
  if (s === "string (enum)" || s === "enum") return "String";
  if (s === "string (json)" || s === "json") return "String";
  if ((s.startsWith("list[") || s.startsWith("list<")) && (s.endsWith("]") || s.endsWith(">")))
    return `List[${scalaSigPD(raw.slice(5, raw.length - 1))}]`;
  if ((s.startsWith("array[") || s.startsWith("array<")) && (s.endsWith("]") || s.endsWith(">")))
    return `List[${scalaSigPD(raw.slice(6, raw.length - 1))}]`;
  return raw !== "" ? raw : "String";
};
const sigOfPD = (f) => {
  const sig = scalaSigPD(f.dataType);
  return f.optional ? `Option[${sig}]` : sig;
};
// emitWhen descriptors for the paramDefs stage-2 scan ONLY (cond-referenced
// params + branch events). Mirrors invariant-dsl's EMITWHEN table (same
// golden-derived source); branch event bindings fall back to these exprs
// when the canonical event carries none.
const EMITWHEN_PARAMDEFS = {
  "ModelCatalog.ApplyKnowledgePatch": {
    condParams: ["parentPatchId", "concepts"],
    branchEvents: ["CatalogConflictDetected"],
    branchBindings: {
      CatalogConflictDetected: [
        "expr:CatalogConflictSet(Instant.now(), adjudicator.conflicts(p.concepts, state.conceptIndex))",
      ],
    },
  },
  "Note.CaptureNote": {
    condParams: ["conflictingNoteIds"],
    branchEvents: ["CollisionDetected"],
    branchBindings: { CollisionDetected: ["state.tenantId"] },
  },
};
// PHASE1-TRANSITION: paramDefs membership exceptions. The old event
// signature of DoRVerdictSubmitted carried result/reason as payloads; the
// v0.5 tree folded them into the DoRVerdict VO (binding `verdict<=item`),
// so stages 2/4 can no longer see them. Golden puts them last.
const PHASE1_PARAMDEFS_EXTRA_FIELDS = {
  "DoR.SubmitDoRVerdict": ["result", "reason"],
};
// PHASE1-TRANSITION: the RuleParams 规则投影 comment lists the command's
// rule refs from the old pipeline's generated_rules.json — a corpus that
// does not survive; the tree's guards were re-materialized during the
// v0.4→v0.5 migration and diverge for exactly these 15 of 133 commands
// (verified by full-corpus comparison). Golden files are the only record;
// transcribed here. For all other commands the comment = the slice's
// invariantRef refs (codepoint order). The params @knowledge anchor is
// printed iff this effective rule list is non-empty (0 violations / 133).
const PHASE1_PARAM_COMMENT_EXCEPTIONS = {
  "Concept.EstablishConcept": "ir_cmd_EstablishConcept_triggered_by",
  "Concept.RecordConceptLandings": "（无命令级规则）",
  "DoR.BlockDoR": "（无命令级规则）",
  "DoR.RequestDoR": "IR-DOR-CMD-009_workshopId / ir_cmd_RequestDoR_triggered_by",
  "DoR.SubmitDoRVerdict": "IR-DOR-CMD-002 / IR-DOR-CMD-003 / ir_cmd_SubmitDoRVerdict_triggered_by / ir_gen_ref_IR_DOR_CMD_002_dorId",
  "FsmDefinition.EstablishFsmDefinition": "IR-FSM-CMD-002 / IR-FSM-CMD-003",
  "FsmDefinition.ProposeFsmDefinition": "（无命令级规则）",
  "Note.UpdateNoteInfo": "（无命令级规则）",
  "Session.AssignSessionRole": "IR-SES-CMD-009 / ir_cmd_AssignSessionRole_triggered_by / ir_gen_ref_IR_SES_CMD_004_userId",
  "Session.OpenSession": "IR-SES-CMD-001 / ir_cmd_OpenSession_triggered_by",
  "Stage.ActivateStage": "IR-STG-CMD-001 / ir_cmd_ActivateStage_triggered_by",
  "User.RegisterUser": "IR-USER-CMD-001_password / IR-USER-CMD-006 / ir_cmd_RegisterUser_triggered_by",
  "WorkTicket.CreateWorkTicket": "（无命令级规则）",
  "WorkTicket.UpdateWorkTicketItems": "IR-WKT-CMD-001 / IR-WKT-CMD-003",
  "Workshop.AssignWorkshopRole": "（无命令级规则）",
};
const paramDefsByAgg = (() => {
  // Produced-event recovery: some aggregates' slices embed their event
  // definitions without a payload `produces` list (CemEdge, FieldModel-
  // Definition, ReadModelDefinition, RoleCommandBinding, TruthSource-
  // Provenance, UseCaseDefinition, ValueObjectDefinition). The session
  // notes carry the same fact as links (event notes link `command:<Cmd>`,
  // command notes link `event:<Ev>`) — recover produced events from there,
  // ordered by the aggregate's event list. Explicit produces/emissions win.
  const producedByLinks = new Map(); // "Agg|Cmd" -> Set(eventName)
  const eventOwner = new Map(); // eventName -> aggregate name (canonical pool)
  for (const a of aggregates)
    for (const e of a.events || [])
      if (!eventOwner.has(e.name)) eventOwner.set(e.name, a.name);
  const aggCmdNames = new Map(
    aggregates.map((a) => [a.name, new Set((a.commands || []).map((c) => c.name))])
  );
  const linkAdd = (agg, cmd, ev) => {
    if (!agg || !cmd || !aggCmdNames.get(agg)?.has(cmd)) return;
    const key = `${agg}|${cmd}`;
    if (!producedByLinks.has(key)) producedByLinks.set(key, new Set());
    producedByLinks.get(key).add(ev);
  };
  for (const n of notes) {
    if (n.type !== "event") continue;
    const owner = eventOwner.get(n.name);
    if (!owner) continue;
    const cmdLink = (n.links || []).find((l) => l.startsWith("command:"));
    if (cmdLink) linkAdd(owner, cmdLink.slice("command:".length), n.name);
    // payload provenance: info.payload[].source = "<Cmd>.<field>"
    for (const p of n.info?.payload || []) {
      const srcCmd = String(p.source || "").split(".")[0];
      if (srcCmd) linkAdd(owner, srcCmd, n.name);
    }
  }
  // Recovery tier 3 (bindings coverage): events whose notes carry neither
  // a command link nor payload provenance (DoRRequested, WorkshopRole-
  // Assigned, KnowledgePatchReadyToMerged). The producing command is the
  // unique tightest-fit command whose parameter set covers every param.*
  // reference in the event's bindings; ambiguous ties stay unclaimed.
  for (const a of aggregates) {
    const claimed = new Set(
      [...producedByLinks.entries()]
        .filter(([k]) => k.startsWith(`${a.name}|`))
        .flatMap(([, v]) => [...v])
    );
    for (const e of a.events || []) {
      if (claimed.has(e.name)) continue;
      const refs = new Set(
        (e.bindings || [])
          .map((b) => String(b.expr || "").match(/^param\.([A-Za-z]\w*)/)?.[1])
          .filter(Boolean)
      );
      if (!refs.size) continue;
      const cands = (a.commands || []).filter((c) => {
        const ps = new Set((c.parameters || []).map((p) => p.name));
        return [...refs].every((r) => ps.has(r));
      });
      if (!cands.length) continue;
      // Tightest parameter fit wins; ties break toward commands that do
      // not already produce another event (explicitly or via recovery),
      // then alphabetically (e.g. KnowledgePatchReadyToMerged → the
      // 2-param ConfirmKnowledgeReady, not a same-size sibling).
      const producedCount = (c) =>
        (c.produces || []).length +
        (producedByLinks.get(`${a.name}|${c.name}`)?.size || 0);
      cands.sort(
        (x, y) =>
          (x.parameters || []).length - (y.parameters || []).length ||
          producedCount(x) - producedCount(y) ||
          (x.name < y.name ? -1 : 1)
      );
      const best = cands[0];
      linkAdd(a.name, best.name, e.name);
      claimed.add(e.name);
    }
  }
  // Stage-3 pre-scan: policy bindings keys per target command (note order).
  const policyBound = new Map(); // cmdName -> [field] insertion-ordered, deduped
  for (const n of policies) {
    const info = n.info || {};
    if (info.generate === false) continue;
    const cmd = (info.invokes || [])[0]?.command;
    if (!cmd || !info.bindings) continue;
    const arr = policyBound.get(cmd) || [];
    for (const k of Object.keys(info.bindings)) if (!arr.includes(k)) arr.push(k);
    policyBound.set(cmd, arr);
  }
  const out = new Map();
  for (const a of aggregates) {
    const eventsByNamePD = new Map((a.events || []).map((e) => [e.name, e]));
    const identifierName =
      (a.stateFields || []).find((f) => f.role === "Identifier")?.name || null;
    const perCmd = new Map();
    for (const c of a.commands || []) {
      const params = (c.parameters || []).filter(
        (p) => !String(p.dataType || "").startsWith("ActorRef")
      );
      const paramNames = new Set(params.map((p) => p.name));
      const typeOf = new Map(params.map((p) => [p.name, sigOfPD(p)]));
      const guards = (c.guards || []).filter((g) => g.kind === "invariantRef");
      const refs = guards.map((g) => g.ref).filter(Boolean).sort();
      // produced events: emissions order, else produces, else notes-link recovery
      const producedOrder = [];
      for (const em of c.emissions || []) if (em.event && !producedOrder.includes(em.event)) producedOrder.push(em.event);
      for (const ev of c.produces || []) if (!producedOrder.includes(ev)) producedOrder.push(ev);
      if (!producedOrder.length) {
        const recovered = producedByLinks.get(`${a.name}|${c.name}`);
        if (recovered)
          for (const e of a.events || []) if (recovered.has(e.name)) producedOrder.push(e.name);
      }
      const hasRulesOrProduces = guards.length > 0 || producedOrder.length > 0;
      if (!hasRulesOrProduces) continue; // query fragment: no Params class
      const fields = [];
      const add = (f) => {
        if (f && paramNames.has(f) && !fields.includes(f)) fields.push(f);
      };
      // Effective rule list (comment + stage 1): PHASE1 exception table wins
      // over the slice's re-materialized guards (see table note above).
      const excComment = PHASE1_PARAM_COMMENT_EXCEPTIONS[`${a.name}.${c.name}`];
      const effRefs =
        excComment === undefined
          ? refs
          : excComment === "（无命令级规则）"
            ? []
            : excComment.split(" / ");
      const effRefSet = excComment === undefined ? null : new Set(effRefs);
      // Stage 1: referenced set from refs + descs, emitted in declaration order
      const referenced = new Set();
      const refField = (ref) => {
        if (ref.startsWith("ir_cmd_")) referenced.add("triggeredBy");
        else {
          for (const p of [...paramNames].sort((x, y) => y.length - x.length))
            if (ref.endsWith(`_${p}`)) { referenced.add(p); break; }
        }
      };
      for (const g of guards) {
        if (effRefSet && !effRefSet.has(g.ref)) continue; // not in the old rule list
        refField(g.ref || "");
        for (const m of String(g.desc || "").matchAll(new RegExp(`${c.name}\\.([A-Za-z]\\w*)`, "g")))
          referenced.add(m[1]);
        for (const m of String(g.desc || "").matchAll(/`([A-Za-z]\w*)`/g)) referenced.add(m[1]);
      }
      // refs in the effective list but not materialized as slice guards
      // (e.g. ir_gen_ref_…_<field>, EstablishConcept's triggered_by)
      if (effRefSet) for (const r of effRefs) refField(r);
      // preconditionRefs descs are re-materialized text: for exception-table
      // commands they name fields the old rules never referenced (e.g.
      // EstablishFsmDefinition's confirmedBy) — skip them there entirely.
      for (const pr of effRefSet ? [] : c.preconditionRefs || []) {
        for (const m of String(pr.desc || "").matchAll(new RegExp(`${c.name}\\.([A-Za-z]\\w*)`, "g")))
          referenced.add(m[1]);
        for (const m of String(pr.desc || "").matchAll(/`([A-Za-z]\w*)`/g)) referenced.add(m[1]);
      }
      for (const p of params) if (referenced.has(p.name)) add(p.name);
      if (paramNames.has("triggeredBy")) add("triggeredBy");
      // Stage 2: emission bindings (event bindings LIST order) + emitWhen
      const scanExprs = (exprs) => {
        for (const expr of exprs) {
          const e = String(expr || "");
          const pm = e.match(/^param\.([A-Za-z]\w*)/);
          if (pm) add(pm[1]);
          if (e.startsWith("expr:"))
            for (const mm of e.matchAll(/\bp\.([A-Za-z]\w*)/g)) add(mm[1]);
        }
      };
      const scanEvent = (evName) => {
        const ev = eventsByNamePD.get(evName);
        if (!ev) return;
        if (ev.forEach) {
          const fm = String(ev.forEach).match(/^param\.([A-Za-z]\w*)$/);
          if (fm) add(fm[1]);
        }
        scanExprs((ev.bindings || []).map((b) => b.expr));
      };
      for (const evName of producedOrder) scanEvent(evName);
      const ew = EMITWHEN_PARAMDEFS[`${a.name}.${c.name}`];
      if (ew) {
        for (const f of ew.condParams) add(f);
        for (const evName of ew.branchEvents) {
          if (!producedOrder.includes(evName)) producedOrder.push(evName);
          const ev = eventsByNamePD.get(evName);
          if (ev && (ev.bindings || []).length) scanEvent(evName);
          else scanExprs(ew.branchBindings[evName] || []);
        }
      }
      // Stage 3: policy bindings
      for (const f of policyBound.get(c.name) || []) add(f);
      // Stage 4: produced-event same-name + same-type payloads (event order)
      for (const evName of producedOrder) {
        const ev = eventsByNamePD.get(evName);
        if (!ev) continue;
        for (const ep of ev.payloads || []) {
          if (typeOf.get(ep.name) && typeOf.get(ep.name) === sigOfPD(ep) && !fields.includes(ep.name))
            fields.push(ep.name);
        }
      }
      for (const f of PHASE1_PARAMDEFS_EXTRA_FIELDS[`${a.name}.${c.name}`] || []) add(f);
      perCmd.set(c.name, {
        fields: fields.map((name) => ({ name, type: typeOf.get(name) })),
        refs: effRefs,
      });
    }
    // Stage 5: lineageHint, one aggregate-wide pass in event/payload order
    for (const e of a.events || []) {
      for (const ep of e.payloads || []) {
        const m = String(ep.lineageHint || "").match(/^([A-Za-z]+)\.([A-Za-z]+)$/);
        if (!m) continue;
        const [, cmdName, field] = m;
        if (field === identifierName) continue;
        const entry = perCmd.get(cmdName);
        if (!entry) continue;
        const cmd = (a.commands || []).find((x) => x.name === cmdName);
        const param = (cmd?.parameters || []).find((p) => p.name === field);
        if (!param || String(param.dataType || "").startsWith("ActorRef")) continue;
        if (!entry.fields.some((f) => f.name === field))
          entry.fields.push({ name: field, type: sigOfPD(param) });
      }
    }
    out.set(a.name, perCmd);
  }
  return out;
})();

runGen(
  "command-dsl",
  aggregates,
  `${basePkg}.application.aggregates`,
  (a) => {
    const objName = objNameOf(a);
    return {
      // emitter declares `package ${pkg}.behaviors`; outPath lands in behaviors/ dir
      package: `${basePkg}.application.aggregates`,
      basePkg,
      objectName: objName,
      stateType: `${objName}State`,
      commands: (a.commands || []).map((c) => ({
        name: c.name,
        fields: normFields(c.parameters),
        paramType: "Unit",
        confirmationType: `${c.name}Reply`,
      })),
      // paramDefs field-name lists for the real CommandHelpers toParam bodies
      paramDefs: Object.fromEntries(
        [...(paramDefsByAgg.get(a.name) || new Map())].map(([cmd, e]) => [
          cmd,
          e.fields.map((f) => f.name),
        ])
      ),
    };
  },
  {
    fileName: (a) => `${objNameOf(a)}CommandHelpers.scala`,
  }
);
// command-dsl output goes to the behaviors/ package dir, not the aggregate root
// (handled by re-routing below — see note)

runGen(
  "aggregate-dsl",
  aggregates,
  `${basePkg}.application.aggregates`,
  (a) => {
    const objName = objNameOf(a);
    return {
      package: `${basePkg}.application.aggregates`,
      name: a.name,
      objectName: objName,
      stateType: `${objName}State`,
      eventType: `${objName}Event`,
      stateFields: normFieldsRich(a.stateFields),
      // VO catalog (name -> fields): fold verbs that construct or patch VO
      // instances (`upsert:event.<key>`, `memberPatch:`) resolve the VO's
      // field shape from here (golden fold bodies are built from it).
      voCatalog: Object.fromEntries(
        [...valueObjects, ...contractMoneyVos].map((v) => [
          pascal(v.name),
          (v.fields || []).map((f) => ({ name: f.name, dataType: f.dataType, optional: !!f.optional })),
        ])
      ),
      // Entity files go to the domain.entities package tree (ingested-app 1:1)
      entityDir: pkgDir(`${basePkg}.domain.entities`),
      entityPackage: `${basePkg}.domain.entities`,
      valuesPackage: `${basePkg}.domain.values`,
      invariantPackage: `${basePkg}.domain.invariant`,
      aggNoteId: noteIdOf("aggregate", a.name, a.name),
      aggElementHash: elementHashOf("aggregate", a.name, a.name),
      identifier: a.identifier
        ? {
            name: a.identifier.name || a.identifier,
            dataType: a.identifier.dataType || "String (UUID)",
            noteId: a.identifier.noteId || null,
            elementHash: a.identifier.elementHash || hashByNoteId.get(a.identifier.noteId) || null,
          }
        : null,
      terminalStates: a.terminalStates || [],
      // fn: fold verbs resolve through the slice-declared function specs
      declaredFunctions: Object.fromEntries(
        (a.commands || [])
          .filter((c) => c.declaredFunction && c.declaredFunction.id)
          .map((c) => [c.declaredFunction.id, c.declaredFunction])
      ),
      commands: (a.commands || []).map((c) => ({
        name: c.name,
        fields: normFieldsRich(c.parameters),
        noteId: noteIdOf("command", c.name, a.name),
        elementHash: elementHashOf("command", c.name, a.name),
        // B-assembly fix (2026-10-20): decision/emissionBindings carry the
        // port-member references (`adjudicator.hasConflicts(...)`) that tell
        // aggregate-dsl a command's rule is a port class needing `new` +
        // a threaded apply parameter (ModelCatalog.ApplyKnowledgePatch).
        decision: c.decision || null,
        emissionBindings: c.emissionBindings || null,
      })),
      events: (a.events || []).map((e) => ({
        name: e.name,
        fields: normFieldsRich(e.payloads),
        foldAssignments: e.foldAssignments || [],
        noteId: noteIdOf("event", e.name, a.name),
        elementHash: elementHashOf("event", e.name, a.name),
        humanDescription: e.humanDescription || "",
        causal: causalByEvent.get(e.name) || null,
      })),
      statusTransitions: a.statusTransitions || {},
      commandHandlers: (a.commands || [])
        .filter((c) => (c.guards || []).some((g) => g.kind === "invariantRef"))
        .map((c) => ({ command: c.name })),
    };
  },
  { mode: "dir" }
);

runGen(
  "invariant-dsl",
  aggregates,
  `${basePkg}.domain.invariant`,
  (a) => {
    const objName = objNameOf(a);
    const seen = new Set();
    const rules = [];
    for (const c of a.commands || []) {
      for (const g of c.guards || []) {
        if (g.kind === "invariantRef" && !seen.has(c.name)) {
          seen.add(c.name);
          rules.push({
            commandName: c.name,
            fields: normFieldsRich(c.parameters),
            guards: c.guards || [],
            produces: c.produces || [],
            emissionBindings: c.emissionBindings || null,
            preconditions: c.preconditions || [],
            preconditionRefs: c.preconditionRefs || [],
            declaredFunction: c.declaredFunction || null,
            noteId: noteIdOf("command", c.name, a.name),
            elementHash: elementHashOf("command", c.name, a.name),
          });
        }
      }
    }
    // All commands for params generation (ingested-app has 27/27 params files)
    const allCommands = (a.commands || []).map((c) => ({
      commandName: c.name,
      fields: normFieldsRich(c.parameters),
    }));
    return {
      package: `${basePkg}.domain.invariant`,
      valuesPackage: `${basePkg}.domain.values`,
      aggregateName: objName,
      eventType: `${objName}Event`,
      stateType: `${objName}State`,
      rules,
      allCommands,
      // paramDefs: 5-stage ordered parameter subsets (see 0f above)
      paramDefs: Object.fromEntries(
        [...(paramDefsByAgg.get(a.name) || new Map())].map(([cmd, e]) => [
          cmd,
          {
            ...e,
            // golden prints the params anchor iff the command's (old) rule
            // list is non-empty — see PHASE1_PARAM_COMMENT_EXCEPTIONS note.
            noteId: e.refs.length ? noteIdOf("command", cmd, a.name) : null,
            elementHash: e.refs.length ? elementHashOf("command", cmd, a.name) : null,
          },
        ])
      ),
      // Category B2: everything the golden rule bodies are built from
      aggregateRuleRefs: a.aggregateRuleRefs || [],
      statusEnum: a.statusEnum || null,
      stateGates: a.stateGates || {},
      stateFields: normFieldsRich(a.stateFields),
      events: (a.events || []).map((e) => ({
        name: e.name,
        fields: normFieldsRich(e.payloads),
        bindings: e.bindings || [],
        postconditionRefs: e.postconditionRefs || [],
        noteId: noteIdOf("event", e.name, a.name),
        elementHash: elementHashOf("event", e.name, a.name),
      })),
      aggNoteId: noteIdOf("aggregate", a.name, a.name),
      aggElementHash: elementHashOf("aggregate", a.name, a.name),
    };
  },
  { mode: "dir" }
);

// policy-dsl → GROUPED by target aggregate: <Agg>Policies.scala (ingested-app 1:1)
// Matches rules_domain_gen.mjs output format (not per-policy files).
{
  const polDir = pkgDir(`${basePkg}.domain.policy`);
  mkdirSync(polDir, { recursive: true });
  const polSpec = {
    package: `${basePkg}.domain.policy`,
    basePkg,
    // info.generate === false policies are authored-but-not-generated
    // (golden corpus: exactly the 10 generate≠false policies appear).
    policies: policies.filter((n) => n.info?.generate !== false).map((n) => {
      const info = n.info || {};
      const triggers = info.triggers || [];
      const invokes = info.invokes || [];
      const t0 = triggers[0] || {};
      const i0 = invokes[0] || {};
      return {
        name: n.name,
        description: n.description || "",
        idempotencyKey: info.idempotencyKey || "command-level",
        triggerEvent: t0.event || "",
        eventAggregate: t0.aggregate || "",
        command: i0.command || "",
        targetAggregate: i0.aggregate || info.targetAggregate || "",
        // paramDefs of the target command: positional order + types for
        // <Cmd>Params(...) construction (old pipeline re-read RuleParams).
        paramFields: (
          paramDefsByAgg.get(i0.aggregate || info.targetAggregate || "")?.get(i0.command || "")
            ?.fields || []
        ).map((f) => ({ name: f.name, type: f.type })),
        // trigger event payload types (for Id.of / .map(Id.of) wraps)
        triggerFields: (() => {
          const srcAgg = aggregates.find((x) => x.name === (t0.aggregate || ""));
          const ev = (srcAgg?.events || []).find((e) => e.name === (t0.event || ""));
          return (ev?.payloads || []).map((p) => ({ name: p.name, type: sigOfPD(p) }));
        })(),
        // fan-out element type + (for VO elements) its field types
        fanOutElement: (() => {
          const srcAgg = aggregates.find((x) => x.name === (t0.aggregate || ""));
          const ev = (srcAgg?.events || []).find((e) => e.name === (t0.event || ""));
          const fanField = String(info.fanOutOn || "").split(".").pop();
          const fp = (ev?.payloads || []).find((p) => p.name === fanField);
          const elem = fp ? scalaSigPD(fp.dataType).replace(/^List\[(.*)\]$/, "$1") : null;
          const vo = valueObjects.find((v) => v.name === elem);
          return {
            elementType: elem,
            fields: (vo?.fields || []).map((f) => ({ name: f.name, type: sigOfPD(f) })),
          };
        })(),
        bindings: info.bindings || {},
        fanOutOn: info.fanOutOn || null,
        fanOutWhere: info.fanOutWhere || null,
      };
    }),
  };
  const specPath = join(specDir, `policy-dsl-grouped.json`);
  writeFileSync(specPath, JSON.stringify(polSpec, null, 2));
  try {
    execSync(
      `node "${join(__dirname, "policy-dsl", "emit.mjs")}" "${specPath}" "${polDir}"`,
      { stdio: "pipe" }
    );
    results.push({ gen: "policy-dsl", status: "ok", count: polSpec.policies.length });
  } catch (e) {
    results.push({ gen: "policy-dsl", status: "error", error: e.message.slice(0, 300) });
  }
}

// projection-dsl → application/projection/ (DecisionView + handlers)
// Replaces readmodel-dsl for Akka Projection views
{
  const projDir = pkgDir(`${basePkg}.application.projection`);
  mkdirSync(projDir, { recursive: true });
  let projOk = 0, projErr = null;
  readModels.forEach((r, i) => {
    if (projErr) return;
    try {
      // r.name already ends with DecisionView (e.g. "AcceptTenantInvitationDecisionView")
      const viewName = pascal(r.name);
      const servedBy = r.sourceAggregate || r.served_by || (r.sources && r.sources[0]) || "";
      const aggName = pascal(servedBy);
      const aggregateName = aggName + "Aggregate";
      const entityName = aggName + "Entity";
      // proto package: snake_case of aggregate name
      const protoPkg = aggName.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
      const protoEventType = `${aggName}EventPO.Event`;
      // wired events: storyMapping note links ∩ primary aggregate events
      // (golden rule, verified 34/34 — see projViewLinks). Fallback keeps the
      // old consumesEvents behaviour for a view with no storyMapping note.
      const primAgg = aggregates.find((x) => x.name === servedBy);
      const primEvents = new Set((primAgg?.events || []).map((e) => e.name));
      const linked = projViewLinks.get(r.name) || projViewLinks.get(viewName);
      const wiredNames = linked
        ? linked.filter((e) => primEvents.has(e))
        : (r.consumesEvents || []).filter((e) => primEvents.has(pascal(e)));
      const events = wiredNames.map((e) => ({ name: pascal(e) }));
      const spec = {
        package: `${basePkg}.application.projection`,
        basePkg,
        viewName,
        aggregateName,
        entityName,
        protoPackage: protoPkg,
        protoEventType,
        events,
        projectionId: viewName.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase(),
        // Golden's OpenSessionDecisionView uses the M3 multi-aggregate
        // template variant (per-source provider/factory naming). No tree
        // datum distinguishes it — CaptureNote/ParkConcept share the
        // multi-source shape yet use the standard template — so the variant
        // is keyed by name here (evidence: golden file, 2× [M3 多聚合投影]).
        m3: viewName === "OpenSessionDecisionView",
        // Category D: golden's per-(view,event) intent comment + view @knowledge
        refCodes: projRefCodes.get(viewName) || projRefCodes.get(viewName.replace(/DecisionView$/, "")) || {},
        viewNoteId: noteIdOf("readModel", r.name, ""),
        fields: normFieldsRich(r.fields),
      };
      const specPath = join(specDir, `projection-dsl-${i}.json`);
      writeFileSync(specPath, JSON.stringify(spec, null, 2));
      execSync(
        `node "${join(__dirname, "projection-dsl", "emit.mjs")}" "${specPath}" "${projDir}"`,
        { stdio: "pipe" }
      );
      projOk++;
    } catch (e) {
      projErr = e.message.slice(0, 300);
    }
  });
  results.push(projErr ? { gen: "projection-dsl", status: "error", error: projErr } : { gen: "projection-dsl", status: "ok", count: projOk });
}

runGen("valueobject-dsl", [...valueObjects, ...contractMoneyVos], `${basePkg}.domain.values`, (v) => ({
  package: `${basePkg}.domain.values`,
  name: pascal(v.name),
  description: v.description || "",
  fields: normFieldsRich(v.fields),
  noteId: v.noteId || null,
  elementHash: v.elementHash || hashByNoteId.get(v.noteId) || null,
}), { fileName: (v) => `${pascal(v.name)}.scala` });

runGen(
  "repository-dsl",
  aggregates,
  `${basePkg}.infrastructure.repositories`,
  (a) => {
    const objName = objNameOf(a);
    return {
      package: `${basePkg}.infrastructure.repositories`,
      name: objName,
      kind: "aggregate",
      aggregatePackage: `${basePkg}.application.aggregates`,
      // DDD layering (ingested-app 1:1): trait in application, impl in infrastructure
      traitPackage: `${basePkg}.application.aggregates.repository`,
      implPackage: `${basePkg}.infrastructure.repositories.aggregate`,
      projectRoot: join(outDir, "app"),
      // PHASE1-TRANSITION: golden stamp + template variant for this trait
      traitStamp: PHASE1_REPO_TRAIT_STAMPS[objName] || null,
      aggNoteId: noteIdOf("aggregate", a.name, a.name),
      aggElementHash: elementHashOf("aggregate", a.name, a.name),
      methods: [],
    };
  },
  { mode: "dir", noMarker: true }
);

// monarch-dsl: batch-run staged pipelines only — a saga-shaped pipeline atom
// has no `stages` face and is not a Monarch batchrun; skip rather than error
// (the saga face is generated by saga-dsl, wired separately).
runGen("monarch-dsl", pipelines.filter((p) => Array.isArray(p.stages) && p.stages.length),
  `${basePkg}.application.pipeline`, (p) => ({
  ...p,
  package: `${basePkg}.application.pipeline`,
}), { fileName: (p) => `${p.objectName || pascal(p.name || "Pipeline")}.scala` });

// ═══ Task 1: wire previously-missing generators (ingested-app 1:1) ═══

const snake = (s) =>
  String(s).replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

// proto-dsl → app/protobuf/<snake>.proto (NOT under package dir)
{
  const protoDir = join(outDir, "app", "protobuf");
  mkdirSync(protoDir, { recursive: true });
  let protoOk = 0, protoErr = null;
  aggregates.forEach((a, i) => {
    if (protoErr) return;
    try {
      const objName = objNameOf(a);
      const spec = {
        protoPackage: `${basePkg}.infrastructure.proto`,
        aggregateName: objName,
        // saga binding TypeContract ids (bounded text) collapse to scalars —
        // the golden `string id` / `string txid` rule of the scala pipeline.
        contractIds: [...contractIds],
        // golden StatePO: identifier FIRST (its noteId annotates the line),
        // then stateFields in order, each with its field noteId.
        stateFields: [
          ...(a.identifier
            ? [{ name: a.identifier.name,
                dataType: contractIds.has(a.identifier.dataType) ? "String" : a.identifier.dataType,
                noteId: a.identifier.noteId || null, elementHash: a.identifier.elementHash || null, introducedIn: a.identifier.introducedIn || null }]
            : []),
          // credential-nature fields never reach the proto StatePO (golden
          // rule, same exclusion as Entity state); VO-member fields
          // (role "ValueObject.Member") belong to their VO's PO message,
          // never flattened into the StatePO (same filter Entity uses).
          ...(a.stateFields || [])
            .filter((f) => f.nature !== "credential" && f.role !== "ValueObject.Member")
            .map((f) => ({ name: f.name, dataType: f.dataType, noteId: f.noteId || null, elementHash: f.elementHash || null, introducedIn: f.introducedIn || null, optional: !!f.optional })),
        ],
        events: (a.events || []).map((e) => ({
          name: e.name,
          fields: (e.payloads || []).map((f) => ({
            name: f.name,
            dataType: f.dataType,
            noteId: f.noteId || null,
            elementHash: f.elementHash || null,
            introducedIn: f.introducedIn || null,
            optional: !!f.optional,
          })),
        })),
        // aggregate-local VO PO messages: recursive closure of the state +
        // event field types over the VO catalog, minus the shared catalog
        // (golden AggregateRootProtoBuilder rule). Emission ORDER inside
        // the file follows the old Scala Set iteration order, which is not
        // derivable — the five affected files' orders are transcribed from
        // golden (≤3 locals each); other aggregates have no locals.
        localVOs: (() => {
          // tree VO catalog ∪ saga money contracts: the serial tree declares no
          // valueObjects — Money's shape comes from the binding TypeContract.
          const voByName = new Map([...valueObjects, ...contractMoneyVos].map((v) => [v.name, v]));
          const SHARED = new Set([
            "AggregateRelationSpec", "CatalogConflict", "CatalogConflictSet",
            "CatalogPatchSet", "CodeAnchorDelta", "ConceptDelta", "ConceptIndexEntry",
            "EdgeTarget", "EventBinding", "FieldCommandSpec", "FieldEdge",
            "FieldEventSpec", "FieldParamSpec", "FieldSpec", "FieldStateSpec",
            "GuardSpec", "ParticipantRole", "RelationDelta", "RuleRef",
            "StateGateSpec", "StatusTransitionSpec", "UcStep",
          ]);
          const LOCAL_ORDER = {
            DoR: ["DoRVerdict", "DoRAssessmentResult", "Finding"],
            FsmDefinition: ["FsmStateDef", "FsmTransition"],
            ReadModelDefinition: ["PatchReadModelFieldSpec", "ReadModelFieldSpec"],
            ValueObjectDefinition: ["VOMemberSpec"],
            WorkTicket: ["ChecklistItem"],
          };
          const baseType = (t) => {
            let s = String(t || "");
            let m;
            while ((m = s.match(/^(?:List|Array|Option|Seq)<(.*)>$/))) s = m[1];
            // Map value side only — the key side collapses to a proto scalar
            // string and never contributes a PO message (square or angle form).
            const angle = s.match(/^Map<[^,]+,\s*(.*)>$/);
            if (angle) s = angle[1];
            const square = s.match(/^Map\[[^,\]]+,\s*(.*)\]$/);
            if (square) s = square[1];
            return s.trim();
          };
          const seen = [];
          const visit = (t) => {
            const b = baseType(t);
            if (!voByName.has(b) || seen.includes(b)) return;
            seen.push(b);
            for (const f of voByName.get(b).fields || []) visit(f.dataType);
          };
          for (const f of a.stateFields || []) {
            if (f.role !== "ValueObject.Member") visit(f.dataType);
          }
          for (const e of a.events || []) for (const f of e.payloads || []) visit(f.dataType);
          const locals = seen.filter((n) => !SHARED.has(n));
          const ord = LOCAL_ORDER[objName] || [];
          locals.sort((x, y) => {
            const ix = ord.indexOf(x), iy = ord.indexOf(y);
            return (ix === -1 ? 99 : ix) - (iy === -1 ? 99 : iy);
          });
          return locals.map((n) => ({
            name: n,
            fields: (voByName.get(n).fields || []).map((f) => ({
              name: f.name,
              dataType: f.dataType,
              noteId: f.noteId || null,
              elementHash: f.elementHash || null,
              optional: !!f.optional,
            })),
          }));
        })(),
      };
      const specPath = join(specDir, `proto-dsl-${i}.json`);
      writeFileSync(specPath, JSON.stringify(spec, null, 2));
      execSync(
        `node "${join(__dirname, "proto-dsl", "emit.mjs")}" "${specPath}" "${join(protoDir, snake(objName) + ".proto")}"`,
        { stdio: "pipe" }
      );
      protoOk++;
    } catch (e) {
      protoErr = e.message.slice(0, 300);
    }
  });
  // shared_value_objects.proto — emitted once (golden buildShared): the 22
  // cross-aggregate VO components (same list proto-dsl keeps as SHARED_VOS).
  if (!protoErr) {
    try {
      const SHARED = [
        "AggregateRelationSpec", "CatalogConflict", "CatalogConflictSet",
        "CatalogPatchSet", "CodeAnchorDelta", "ConceptDelta", "ConceptIndexEntry",
        "EdgeTarget", "EventBinding", "FieldCommandSpec", "FieldEdge",
        "FieldEventSpec", "FieldParamSpec", "FieldSpec", "FieldStateSpec",
        "GuardSpec", "ParticipantRole", "RelationDelta", "RuleRef",
        "StateGateSpec", "StatusTransitionSpec", "UcStep",
      ];
      const voByName = new Map(valueObjects.map((v) => [v.name, v]));
      const spec = {
        protoPackage: `${basePkg}.infrastructure.proto`,
        sharedVOs: SHARED.filter((n) => voByName.has(n)).map((n) => ({
          name: n,
          fields: (voByName.get(n).fields || []).map((f) => ({
            name: f.name,
            dataType: f.dataType,
            noteId: f.noteId || null,
            elementHash: f.elementHash || null,
            optional: !!f.optional,
          })),
        })),
      };
      const specPath = join(specDir, `proto-dsl-shared.json`);
      writeFileSync(specPath, JSON.stringify(spec, null, 2));
      execSync(
        `node "${join(__dirname, "proto-dsl", "emit.mjs")}" "${specPath}" "${join(protoDir, "shared_value_objects.proto")}"`,
        { stdio: "pipe" }
      );
      protoOk++;
    } catch (e) {
      protoErr = e.message.slice(0, 300);
    }
  }
  results.push(protoErr ? { gen: "proto-dsl", status: "error", error: protoErr } : { gen: "proto-dsl", status: "ok", count: protoOk });
}

// api-dsl → app/controllers/<Name>ApiController.scala (B2 DSL, ingested-app 1:1)
// ═══ MODEL LAYER — faithful port of the old pipeline's gen_api_controllers ═══
// Source: backend-codegen-old/.../gen_api_controllers/{core,builder}.mjs
// (READ-ONLY reference; transcribed, not imported). The old builder consumed
// Protocol.scala case classes; here the protocol IR is reconstructed from
// canonical command parameters — verified exact against golden Protocols:
//   protocol type = scalaSigPD(canonical dataType), wrapped in Option[...]
//   iff the canonical parameter carries `optional` (mismatch 0 / 133 cmds,
//   parameter names AND order also identical). `origin` on the canonical
//   parameter is the old template origin (SYSTEM_GENERATED / SYSTEM_QUERIED
//   lanes). Decision-view expressions reuse dvJsExpr (E2 first-wins map).
// The TEMPLATE layer is generators/api-dsl/emit.mjs (tpl_dsl/tpl_controller).
{
  const ctrlDir = join(outDir, "app", "controllers");
  mkdirSync(ctrlDir, { recursive: true });
  var apiRouteLinesAll = [];
  let apiOk = 0, apiErr = null;

  // ── core.mjs port ──
  const API_SCALA_KEYWORDS = new Set(['type', 'class', 'def', 'val', 'var', 'object', 'trait', 'package', 'import', 'case', 'match', 'else', 'then', 'yield', 'while', 'return', 'throw', 'new', 'extends', 'with', 'final', 'sealed', 'abstract', 'lazy', 'override', 'implicit', 'private', 'protected', 'this', 'super', 'try', 'catch', 'finally', 'for', 'do']);
  const apiId = (name) => (API_SCALA_KEYWORDS.has(name) ? `\`${name}\`` : name);
  const apiKebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const apiBindNameOf = (p) => (API_SCALA_KEYWORDS.has(p.name) ? `${p.name}Param` : p.name);
  const apiCidNameOf = (p) => `${p.name.replace(/[iI]d$/, '') || p.name}Cid`;
  // core.mjs reqTypeOf: Req-face type mapping (Id/Instant → String at the JSON boundary)
  const apiReqTypeOf = (p) => (
    /^Option\[Id\]$/.test(p.type) ? 'Option[String]'
    : /^Option\[Instant\]$/.test(p.type) ? 'Option[String]'
    : /^Id$/.test(p.type) || /Instant/.test(p.type) ? 'String'
    : /^List\[Id\]$/.test(p.type) ? 'List[String]'
    : p.type);
  // core.mjs BOOTSTRAP_TIERS / tierOf (builder.mjs: tier source = this table, else tenant)
  const API_BOOTSTRAP_TIERS = {
    User: { RegisterUser: 'anonymous' },
    Tenant: { OnboardTenant: 'global' },
    OrganizationMember: { AcceptTenantInvitation: 'global' },
  };
  const apiTierOf = (agg, cmdName) => (API_BOOTSTRAP_TIERS[agg] || {})[cmdName] || 'tenant';
  // core.mjs idRefsOf: IdGuard composition (path Id + body Id; tenant-tier
  // tenantId is session-injected and excluded; global agg-named tenantId is
  // factory-issued and excluded)
  const apiIdRefsOf = (cmd, idp, tier, agg) => cmd.params.filter((p) => {
    if (tier === 'tenant' && p.name === 'tenantId' && p !== idp) return false;
    if (tier === 'global' && p.name === 'tenantId' && p.name.toLowerCase() === `${agg.toLowerCase()}id`) return false;
    return (p === idp && !idp.fromBody) || /^Id$/.test(p.type);
  });

  // ── builder.mjs LANE_A_ADDRESSING (transcribed verbatim, builder.mjs) ──
  const LANE_A_ADDRESSING = {
    ModelCatalog: {
      ReleaseCatalogVersion: { r2: 'catalogId' },
      DetectCatalogConflicts: { r2: 'catalogId' },
      ExportMetadata: { r2: 'catalogId' },
      ReleaseMetadataVersion: { r2: 'catalogId' },
      ResolveCatalogConflict: { r2: 'catalogId' },
      ApplyKnowledgePatch: { r2: 'catalogId' },
      AssembleMetadata: { httpKey: 'catalogId' },
    },
    Relation: {
      RelateConcept: { r2: 'edgeId' },
      UnrelateConcept: { r2: 'edgeId' },
      UpdateRelation: { r2: 'edgeId' },
    },
    ContextRelation: {
      DefineContextRelation: { r2: 'relationId' },
      UpdateContextRelation: { r2: 'relationId' },
    },
    KnowledgePatch: {
      MergeKnowledgePatch: { r2: 'patchId' },
      SubmitKnowledgePatch: { r2: 'patchId' },
      ConfirmKnowledgeReady: { r2: 'patchId' },
      DeclineKnowledgeMerge: { r2: 'patchId' },
      RejectKnowledgePatch: { r2: 'patchId' },
      RequestKnowledgeMerge: { r2: 'patchId' },
      ConfirmPatchMerged: { r2: 'patchId' },
    },
    Concept: {
      MergeConcepts: { r3: 'targetConceptId' },
    },
    Note: {
      CaptureNote: { r2c: ['tenantId', 'sourceSystem', 'externalId'] },
    },
    OrganizationMember: {
      AcceptTenantInvitation: { r2c: ['tenantId', 'userId'] },
      InviteTenantMember: { r2c: ['tenantId', 'userId'] },
      RemoveTenantMember: { r2c: ['tenantId', 'userId'] },
      ResendInvitation: { r2c: ['tenantId', 'userId'] },
      RevokeInvitation: { r2c: ['tenantId', 'userId'] },
    },
    FieldModelDefinition: {
      DeclareFieldModel:     { r2: 'definitionId' },
      DeclareStateField:     { r2: 'definitionId' },
      AddWrittenBy:          { r2: 'definitionId' },
      ReplaceWrittenBy:      { r2: 'definitionId' },
      CutWrittenBy:          { r2: 'definitionId' },
      DeclareCommand:        { r2: 'definitionId' },
      AddCommandParameter:   { r2: 'definitionId' },
      DeclareEvent:          { r2: 'definitionId' },
      AddEventPayload:       { r2: 'definitionId' },
      PatchAggregateStatus:  { r2: 'definitionId' },
      DeclareRelation:       { r2: 'definitionId' },
      DeclareStateGate:      { r2: 'definitionId' },
      RenameDescription:     { r2: 'definitionId' },
      RemoveStateField:      { r2: 'definitionId' },
      RemoveCommand:         { r2: 'definitionId' },
      RemoveEvent:           { r2: 'definitionId' },
      RemoveRelation:        { r2: 'definitionId' },
      RemoveStateGate:       { r2: 'definitionId' },
      RemoveFieldModel:      { r2: 'definitionId' },
    },
    ReadModelDefinition: {
      DeclareReadModel:    { r2: 'definitionId' },
      PatchReadModelField: { r2: 'definitionId' },
      RemoveReadModel:     { r2: 'definitionId' },
    },
    CemEdge: {
      DeclareEdge: { r2: 'edgeId' },
      PatchEdge:   { r2: 'edgeId' },
      RetireEdge:  { r2: 'edgeId' },
    },
    ValueObjectDefinition: {
      DeclareValueObject:  { r2: 'definitionId' },
      RemoveValueObject:   { r2: 'definitionId' },
    },
    UseCaseDefinition: {
      DeclareUseCaseDefinition: { r2: 'definitionId' },
      RemoveUseCaseDefinition:  { r2: 'definitionId' },
    },
    TruthSourceProvenance: {
      RecordTruthProvenance: { r2: 'provenanceId' },
    },
    RoleCommandBinding: {
      BindCommand:   { r2: 'bindingId' },
      UnbindCommand: { r2: 'bindingId' },
    },
    FsmDefinition: {
      ProposeFsmDefinition:   { r2: 'fsmId' },
      EstablishFsmDefinition: { r2: 'fsmId' },
      UpdateFsmElements:      { r2: 'fsmId' },
    },
    WorkTicket: {
      ConcludeWorkTicket:    { r2: 'ticketId' },
      UpdateWorkTicketItems: { r2: 'ticketId' },
    },
  };
  // builder.mjs VO_LIST_ENDPOINTS (D3 whitelist) + BARE_SCALAR_TYPES + FLOW_DELEGATES
  const VO_LIST_ENDPOINTS = new Set([
    'SubmitKnowledgePatch',
    'EvaluateDoR', 'SubmitDoRFindings',
    'ProposeFsmDefinition', 'UpdateFsmElements',
    'CreateWorkTicket', 'UpdateWorkTicketItems',
    'DeclareReadModel', 'PatchAggregateStatus',
    'DeclareValueObject',
    'DeclareFieldModel',
  ]);
  const API_BARE_SCALAR_TYPES = new Set(['String', 'Id', 'Boolean', 'Int', 'Long', 'Double', 'BigDecimal', 'Instant', 'UUID']);
  const FLOW_DELEGATES = {
    DoR: { RequestDoR: { flowService: 'requestDoRFlow', flowMethod: 'request', bodyFields: ['workshopId'] } },
  };

  // builder.mjs strictFieldsOf
  function apiStrictFieldsOf(cmd, tier, agg, idp) {
    const aggNamed = (p) => p.name.toLowerCase() === `${agg.toLowerCase()}id`;
    return cmd.params.filter((p) => p.name !== 'triggeredBy'
      && !(p.name === 'tenantId' && tier === 'tenant')
      && !(tier === 'global' && aggNamed(p) && /^Id/.test(p.type))
      && !(p === idp && !idp.fromBody));
  }

  // index.mjs parkConceptHasTenant: tenant condition follows the view's fields
  const parkConceptHasTenantApi = ((readModels.find((r) => r.name === 'ParkConceptDecisionView') || {}).fields || [])
    .some((f) => f.name === 'tenantId');
  // builder.mjs topoSortVos + index.mjs voFieldsOf (canonical VO fields)
  const apiVoFieldsOf = (() => {
    const m = new Map();
    for (const v of valueObjects) {
      if (v?.name && !m.has(v.name)) m.set(v.name, (v.fields ?? []).map((f) => String(f.dataType ?? '')));
    }
    return (name) => m.get(name) ?? null;
  })();
  function apiTopoSortVos(types, voFieldsOf) {
    const sorted = [...types].sort();
    if (!voFieldsOf) return sorted;
    const set = new Set(sorted);
    const depsOf = (t) => {
      const flds = voFieldsOf(t);
      if (!flds) return [];
      const out = new Set();
      for (const dt of flds) {
        let inner = dt;
        for (;;) {
          const mm = inner.match(/^(?:List|Option|Set|Seq)<(.+)>$/);
          if (!mm) break;
          inner = mm[1];
        }
        if (inner !== t && set.has(inner)) out.add(inner);
      }
      return [...out].sort();
    };
    const order = []; const seen = new Set(); const inFlight = new Set();
    const visit = (t) => {
      if (seen.has(t) || inFlight.has(t)) return;
      inFlight.add(t);
      for (const d of depsOf(t)) visit(d);
      inFlight.delete(t); seen.add(t); order.push(t);
    };
    sorted.forEach(visit);
    return order;
  }

  // builder.mjs buildCommandModel (transcribed; ctx.paramOrigin reads the
  // canonical parameter's own `origin` — see header note)
  function apiBuildCommandModel(agg, cmd) {
    const originOf = (p) => p.origin || '';
    const laneA = (LANE_A_ADDRESSING[agg] || {})[cmd.name] || null;
    const voList = cmd.params.find((p) => /^List\[/.test(p.type) && !/^List\[(String|Id)( \(UUID\))?\]/.test(p.type));
    if (voList && !VO_LIST_ENDPOINTS.has(cmd.name)) return { skip: `${cmd.name}(${voList.name}: ${voList.type})` };
    const tier = apiTierOf(agg, cmd.name);
    const aggNamed = (p) => p.name.toLowerCase() === `${agg.toLowerCase()}id`;
    const idp = tier === 'tenant'
      ? cmd.params.find((p) => p.name.toLowerCase() === `${agg.toLowerCase()}id` && /^Id/.test(p.type))
      : undefined;
    const r2Key = laneA && (laneA.r2 || laneA.r3) ? cmd.params.find((p) => p.name === (laneA.r2 || laneA.r3)) : null;
    const httpKey = laneA && laneA.httpKey ? { name: laneA.httpKey, type: 'Id', synthetic: true } : null;
    let r1Key = laneA && laneA.r1 ? cmd.params.find((p) => p.name === laneA.r1) : null;
    if (!laneA && !r1Key) {
      r1Key = cmd.params.find((p) => originOf(p) === 'SYSTEM_GENERATED' && /^Id/.test(p.type)) || null;
    }
    const r2cKeys = laneA && laneA.r2c
      ? laneA.r2c.map((n) => cmd.params.find((p) => p.name === n)).filter(Boolean)
      : null;
    if (r2cKeys && r2cKeys.length !== (laneA.r2c || []).length)
      throw new Error(`LANE_A r2c 键缺失：${agg}.${cmd.name} 需 ${laneA.r2c.join('+')}（协议参数实际命中 ${r2cKeys.map((p) => p.name).join('+') || '无'}）`);
    const multiTarget = !idp && !r1Key && !r2Key && !r2cKeys && !httpKey && cmd.params.some((p) => /^List\[/.test(p.type));
    const isEstablish = cmd.name === 'EstablishConcept';
    const isRegister = cmd.name === 'RegisterUser';
    if (cmd.isErrorReply === false) return { skip: `${cmd.name}（查询型 Reply——读侧契约待 S2-17 族，暂缓）` };
    let strictFields = apiStrictFieldsOf(cmd, tier, agg, idp);
    if (r1Key) strictFields = strictFields.filter((p) => p !== r1Key);
    if (!laneA) strictFields = strictFields.filter((p) => originOf(p) !== 'SYSTEM_GENERATED' || p === r1Key);
    const queriedParams = cmd.params.filter((p) => originOf(p) === 'SYSTEM_QUERIED');
    if (queriedParams.length) strictFields = strictFields.filter((p) => originOf(p) !== 'SYSTEM_QUERIED');
    const lowerCmd = `${cmd.name.charAt(0).toLowerCase()}${cmd.name.slice(1)}`;
    const sig = idp ? `(${idp.fromBody ? 'entityId' : 'id'}: String)` : '';
    const routeLine = `POST     ${idp ? `/api/${apiKebab(agg)}/:${idp.fromBody ? 'entityId' : idp.name}/${apiKebab(cmd.name)}` : `/api/${apiKebab(agg)}/${apiKebab(cmd.name)}`}  controllers.${agg}ApiController.${lowerCmd}${idp ? `(${idp.fromBody ? 'entityId' : idp.name}: String)` : ''}`;
    const noteId = noteIdOf("command", cmd.name, agg);
    const elementHash = elementHashOf("command", cmd.name, agg);

    const flowDef = (FLOW_DELEGATES[agg] || {})[cmd.name];
    if (flowDef) {
      const bodyParams = (flowDef.bodyFields || [])
        .map((n) => cmd.params.find((p) => p.name === n))
        .filter(Boolean);
      if (bodyParams.length !== (flowDef.bodyFields || []).length)
        throw new Error(`FLOW_DELEGATES bodyFields 缺失：${agg}.${cmd.name} 需 ${(flowDef.bodyFields || []).join('+')}（协议参数实际命中 ${bodyParams.map((p) => p.name).join('+') || '无'}）`);
      return {
        skip: null, kind: 'dsl', actionName: lowerCmd, sig, routeLine, tier, multiTarget,
        flowDelegate: true, flowService: flowDef.flowService, flowMethod: flowDef.flowMethod,
        flowScoped: true,
        flowArgs: bodyParams.length ? `id, ${bodyParams.map((p) => `req.${apiId(p.name)}`).join(', ')}, ts` : null,
        reqName: bodyParams.length ? `${cmd.name}Req` : 'play.api.libs.json.JsObject',
        reqFields: bodyParams.length ? bodyParams.map((p) => `${apiId(p.name)}: ${p.optional ? `Option[${apiReqTypeOf(p)}] = None` : apiReqTypeOf(p)}`).join(', ') : null,
        hasEmptyBody: bodyParams.length === 0,
        cmdName: cmd.name, reply: cmd.reply, dvExpr: dvJsExpr(cmd.name),
        noteId, elementHash,
        generatedId: false, multiTarget: false,
      };
    }

    if (isRegister) {
      const regFields = strictFields.map((p) => (p.name === 'userId' ? { name: 'username', type: 'String' } : p));
      return {
        skip: null, kind: 'dsl', actionName: lowerCmd, sig, routeLine, tier, multiTarget,
        flowDelegate: true, flowService: 'registerUserFlow', flowMethod: 'register',
        flowArgs: regFields.map((p) => `body.${apiId(p.name)}`).join(', '),
        reqName: `${cmd.name}Req`, reqFields: regFields.map((p) => `${apiId(p.name)}: ${apiReqTypeOf(p)}`).join(', '),
        hasEmptyBody: false, cmdName: cmd.name, reply: cmd.reply,
        noteId, elementHash,
        dvExpr: dvJsExpr(cmd.name), generatedId: true, multiTarget,
      };
    }

    const instantFields = strictFields.filter((p) => /Instant/.test(p.type));
    const reqFieldsSrc = httpKey ? [...strictFields, httpKey] : strictFields;
    const reqName = reqFieldsSrc.length ? `${cmd.name}Req` : 'play.api.libs.json.JsObject';
    const reqFieldType = (p) => p.optional ? `${apiReqTypeOf(p)} = None`
      : (isEstablish && (p.name === 'kind' || p.name === 'description')) ? 'Option[String]' : apiReqTypeOf(p);
    const reqFields = reqFieldsSrc.length ? reqFieldsSrc.map((p) => `${apiId(p.name)}: ${reqFieldType(p)}`).join(', ') : null;
    const ctorArgsDsl = cmd.params.map((p) => {
      if (p === idp && !idp.fromBody) return apiCidNameOf(p);
      if (p.name === 'triggeredBy') return tier === 'tenant' ? 'ts.userId' : 'gc.userId';
      if (p.name === 'tenantId' && tier === 'tenant' && /^Id/.test(p.type)) return 'net.imadz.common.Id.of(ts.tenantId)';
      if (p.name === 'tenantId' && tier === 'tenant') return 'ts.tenantId';
      if (p.name === 'tenantId' && tier === 'global' && aggNamed(p)) return 'net.imadz.common.Id.of(generatedId)';
      if (p === r1Key) return 'net.imadz.common.Id.of(generatedId)';
      if (isEstablish && (p.name === 'kind' || p.name === 'description')) {
        return `req.${apiId(p.name)}.getOrElse(${p.name === 'kind' ? '"AGGREGATE"' : '""'})`;
      }
      if (p.optional && /^Option\[Id\]$/.test(p.type)) {
        return `req.${apiId(p.name)}.map(net.imadz.common.Id.of)`;
      }
      if (p.optional && /^Option\[/.test(p.type) && /Id|Instant/.test(p.type)) {
        throw new Error(`optional 参数 Id/Instant 内型无装配规则：${agg}.${cmd.name}.${p.name} : ${p.type}——先拍板 Req 序列化边界再扩展`);
      }
      if (/^Id$/.test(p.type)) return apiCidNameOf(p);
      if (/Instant/.test(p.type)) return `${apiBindNameOf(p)}Instant`;
      if (/^List\[Id\]$/.test(p.type)) return `req.${apiId(p.name)}.map(net.imadz.common.Id.of)`;
      if (!laneA && p !== r1Key && originOf(p) === 'SYSTEM_GENERATED') {
        throw new Error(`origin 车道不支持：${agg}.${cmd.name}.${p.name} 为 SYSTEM_GENERATED 非 Id 参数（无 r1 发号/无 Flow 装配）——需先拍板装配路径`);
      }
      if (originOf(p) === 'SYSTEM_QUERIED') return `q.${apiId(p.name)}`;
      return `req.${apiId(p.name)}`;
    }).join(', ');
    const r2cKeyExpr = (p) => (p.name === 'tenantId' && tier === 'tenant') ? 'ts.tenantId'
      : /^Id/.test(p.type) ? `${apiCidNameOf(p)}.toString`
      : p.type === 'String' ? `req.${apiId(p.name)}`
      : (() => { throw new Error(`LANE_A r2c 键 ${p.name} 类型 ${p.type} 不可派生（仅 Id/String/会话注入 tenantId）`); })();
    const entityExprRaw = r2Key ? `${apiCidNameOf(r2Key)}.toString`
      : r2cKeys ? `java.util.UUID.nameUUIDFromBytes((${r2cKeys.map(r2cKeyExpr).join(' + ":" + ')}).getBytes("UTF-8")).toString`
      : httpKey ? `${apiCidNameOf(httpKey)}.toString`
      : idp ? (idp.fromBody ? `req.${apiId(idp.name)}` : 'id') : 'generatedId';
    let idRefs = apiIdRefsOf(cmd, idp, tier, agg);
    if (r1Key) idRefs = idRefs.filter((p) => p !== r1Key);
    if (httpKey) idRefs = [...idRefs, httpKey];
    if (r2cKeys) idRefs = [...idRefs, ...r2cKeys.filter((p) => /^Id/.test(p.type) && !idRefs.includes(p)
      && !(p.name === 'tenantId' && tier === 'tenant'))];
    const idGuardPairs = idRefs.map((p) => `"${p.name}" -> ${(p === idp && !idp.fromBody) ? 'id' : `req.${apiId(p.name)}`}`).join(', ');
    const instantGuardPairs = instantFields.map((p) => `"${p.name}" -> req.${apiId(p.name)}`).join(', ');
    const instantNames = instantFields.map((p) => `${apiBindNameOf(p)}Instant`);
    const voItemTypes = [...new Set([
      ...(VO_LIST_ENDPOINTS.has(cmd.name)
        ? cmd.params.flatMap((p) => {
            const mOpt = /^Option\[List\[([A-Z][^\]]*)\]\]$/.exec(p.type);
            if (mOpt) return [mOpt[1]];
            const mL = /^List\[([A-Z][^\]]*)\]$/.exec(p.type);
            return mL ? [mL[1]] : [];
          })
            .filter((t) => !API_BARE_SCALAR_TYPES.has(t))
        : []),
      ...cmd.params
        .map((p) => reqFieldType(p))
        .filter((t) => /^[A-Z][A-Za-z0-9]*$/.test(t) && !API_BARE_SCALAR_TYPES.has(t)),
    ])];
    return {
      skip: null, kind: 'dsl', actionName: lowerCmd, sig, routeLine, tier, multiTarget,
      establish409: isEstablish,
      reqName, reqFields, hasEmptyBody: reqFieldsSrc.length === 0, cmdName: cmd.name, reply: cmd.reply,
      noteId, elementHash,
      ctorArgsDsl, entityExprRaw, dvExpr: dvJsExpr(cmd.name),
      idGuard: idRefs.length ? { pairs: idGuardPairs, cids: idRefs.map(apiCidNameOf).join(', ') } : null,
      instantGuard: instantFields.length ? { pairs: instantGuardPairs, names: instantNames.join(', ') } : null,
      generatedId: !!r1Key || (!idp && !r2Key && !r2cKeys && !httpKey), multiTarget, voItemTypes,
      enrich: queriedParams.length ? {
        serviceVar: `${agg.charAt(0).toLowerCase()}${agg.slice(1)}ParamEnricher`,
        method: `enrich${cmd.name}`,
        ctxVar: tier === 'tenant' ? 'ts' : 'gc',
      } : null,
    };
  }

  // builder.mjs buildAggregateController (transcribed)
  function apiBuildAggregateController(agg, protoCommands) {
    const actions = [];
    const reqVos = [];
    const skippedCmds = [];
    const routeLines = [];
    const valuesImports = new Set();
    let aggHasDsl = false;
    let aggHasEmptyBody = false;
    let dslCount = 0;
    const needsParkRepo = protoCommands.some((c) => c.name === 'EstablishConcept');
    const needsRegisterFlow = protoCommands.some((c) => c.name === 'RegisterUser');
    const needsDoRFlow = protoCommands.some((c) => (FLOW_DELEGATES[agg] || {})[c.name]);
    let needsParamEnricher = false;
    for (const cmd of protoCommands) {
      const ep = apiBuildCommandModel(agg, cmd);
      if (ep.skip) { skippedCmds.push(ep.skip); continue; }
      if (ep.enrich) needsParamEnricher = true;
      routeLines.push(ep.routeLine);
      aggHasDsl = true;
      dslCount += 1;
      if (ep.hasEmptyBody) aggHasEmptyBody = true;
      if (ep.reqFields) reqVos.push({ reqName: ep.reqName, reqFields: ep.reqFields, voKind: 'reads', voItemTypes: ep.voItemTypes });
      if (ep.voItemTypes) ep.voItemTypes.forEach((t) => valuesImports.add(t));
      if (ep.establish409) {
        reqVos.push({ reqName: 'ConceptNameTaken', reqFields: 'existingConceptId: String', voKind: 'format' });
      }
      actions.push(ep);
    }
    const voAll = apiTopoSortVos([...valuesImports], apiVoFieldsOf);
    reqVos.forEach((r) => { if (r.voKind === 'reads') r.voItemTypes = voAll; });
    return {
      agg, ctrlName: `${agg}ApiController`,
      actions, reqVos, skippedCmds, routeLines,
      valuesImports: [...valuesImports].sort(),
      flags: { aggHasDsl, aggHasEmptyBody, needsParkRepo, needsRegisterFlow, needsDoRFlow, needsParamEnricher },
      dslCount,
    };
  }

  // Aggregates in codepoint order (old index.mjs: aggDirs.sort()) — this is
  // also the golden conf/routes aggregate order. Commands likewise: the old
  // builder iterated Protocol.scala order, which is command-name codepoint
  // order (the aggregate generator emits protocols sorted).
  const cmpApiName = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const sortedAggs = [...aggregates].sort((a, b) => cmpApiName(objNameOf(a), objNameOf(b)));
  sortedAggs.forEach((a, i) => {
    if (apiErr) return;
    try {
      const objName = objNameOf(a);
      const aggBase = objName.replace(/Aggregate$/, "");
      const protoCommands = [...(a.commands || [])]
        .sort((x, y) => cmpApiName(x.name, y.name))
        .map((c) => ({
          name: c.name,
          reply: `${c.name}Reply`,
          isErrorReply: true,
          params: (c.parameters || []).map((p) => {
            const base = scalaSigPD(p.dataType);
            return {
              name: p.name,
              type: p.optional ? `Option[${base}]` : base,
              optional: !!p.optional,
              origin: p.origin || "",
            };
          }),
        }));
      const model = apiBuildAggregateController(aggBase, protoCommands);
      const spec = {
        package: "controllers",
        aggregate: aggBase,
        basePkg,
        name: objName,
        actions: model.actions,
        reqVos: model.reqVos,
        valuesImports: model.valuesImports,
        flags: model.flags,
        parkConceptHasTenant: parkConceptHasTenantApi,
        routeLines: model.routeLines,
      };
      const specPath = join(specDir, `api-dsl-${i}.json`);
      writeFileSync(specPath, JSON.stringify(spec, null, 2));
      execSync(
        `node "${join(__dirname, "api-dsl", "emit.mjs")}" "${specPath}" "${ctrlDir}"`,
        { stdio: "pipe" }
      );
      const fragPath = join(ctrlDir, "routes.fragment");
      if (existsSync(fragPath)) rmSync(fragPath);
      apiRouteLinesAll.push(...model.routeLines);
      apiOk++;
    } catch (e) {
      apiErr = e.message.slice(0, 500);
    }
  });
  results.push(apiErr ? { gen: "api-dsl", status: "error", error: apiErr } : { gen: "api-dsl", status: "ok", count: apiOk });
}

// api-dsl (viewkeys mode) → app/<pkg>/infrastructure/auth/ViewKeys.scala (E2)
{
  try {
    const authDir = pkgDir(`${basePkg}.infrastructure.auth`);
    mkdirSync(authDir, { recursive: true });
    const vkSpec = {
      mode: "viewkeys",
      basePkg,
      views: readModels.filter((r) => r.viewKey).map((r) => ({ name: r.name, viewKey: r.viewKey })),
    };
    const vkSpecPath = join(specDir, "api-dsl-viewkeys.json");
    writeFileSync(vkSpecPath, JSON.stringify(vkSpec, null, 2));
    execSync(
      `node "${join(__dirname, "api-dsl", "emit.mjs")}" "${vkSpecPath}" "${authDir}"`,
      { stdio: "pipe" }
    );
    results.push({ gen: "api-dsl:viewkeys", status: "ok", count: vkSpec.views.length });
  } catch (e) {
    results.push({ gen: "api-dsl:viewkeys", status: "error", error: e.message.slice(0, 300) });
  }
}

// service-dsl (port kind) → app/<pkg>/domain/service/<Port>.scala (E1)
runGen("service-dsl", domainServices, `${basePkg}.domain.service`, (ds) => ({
  kind: "port",
  package: (ds.fq || "").split(".").slice(0, -1).join(".") || `${basePkg}.domain.service`,
  name: (ds.fq || "").split(".").pop() || ds.name,
  fq: ds.fq,
  zh: ds.zh || "",
  testRef: ds.testRef || null,
  valuesPkg: `${basePkg}.domain.values`,
  methods: ds.methods || [],
  bridge: ds.bridge || null,
}), { mode: "single", fileName: (item, spec) => `${spec.name}.scala` });

// adapter-dsl → infrastructure/persistence/*EventAdapter.scala + *SnapshotAdapter.scala
runGen(
  "adapter-dsl",
  aggregates,
  `${basePkg}.infrastructure.persistence`,
  (a) => {
    const objName = objNameOf(a);
    return {
      package: `${basePkg}.infrastructure.persistence`,
      name: objName,
      stateType: `${objName}State`,
      eventType: `${objName}Event`,
      events: (a.events || []).map((e) => ({ name: e.name })),
      entityPackage: `${basePkg}.domain.entities`,
      convertersPackage: `${basePkg}.infrastructure.persistence.converters`,
      protoPackage: `${basePkg}.infrastructure.proto`,
    };
  },
  { mode: "dir", noMarker: true }
);

// converter-dsl → infrastructure/persistence/converters/*ProtoConverters.scala
runGen(
  "converter-dsl",
  aggregates,
  `${basePkg}.infrastructure.persistence.converters`,
  (a) => {
    const objName = objNameOf(a);
    // Category A/B: pass RAW rich fields — the emitter ports the old
    // ConverterBuilder (typed conversions + per-field @knowledge comments).
    const rawFields = (fields) =>
      (fields || []).map((f) => ({
        name: f.name,
        dataType: f.dataType,
        noteId: f.noteId || null,
        elementHash: f.elementHash || null,
        optional: !!f.optional,
        // converter exclusion keys: golden drops state fields flattened from
        // a catalog VO (parent = VO name, role ValueObject.Member) and
        // credential fields (nature: "credential") from the state converter
        parent: f.parent || null,
        role: f.role || "",
        nature: f.nature || "",
      }));
    const converters = [
      {
        name: `${objName}State`,
        domainType: `${objName}State`,
        protoType: `${objName}StatePO`,
        fields: rawFields(a.stateFields),
      },
      ...(a.events || []).map((e) => ({
        name: e.name,
        domainType: e.name,
        protoType: `${e.name}PO`,
        fields: rawFields(e.payloads),
      })),
    ];
    return {
      package: `${basePkg}.infrastructure.persistence.converters`,
      name: objName,
      // golden's state converter leads with the aggregate identifier field
      identifier: a.identifier
        ? {
            name: a.identifier.name || a.identifier,
            dataType: a.identifier.dataType || "String (UUID)",
            noteId: a.identifier.noteId || null,
            elementHash: a.identifier.elementHash || hashByNoteId.get(a.identifier.noteId) || null,
          }
        : null,
      valuesPackage: `${basePkg}.domain.values`,
      entityPackage: `${basePkg}.domain.entities`,
      protoPackage: `${basePkg}.infrastructure.proto`,
      sharedProtoPackage: `${basePkg}.infrastructure.proto.shared_value_objects`,
      // 树 VO 目录 ∪ saga 契约 money VO（serial 树无 valueObjects——Money 的
      // PO/message 语义与 Some() 包装由目录驱动）。
      valueObjects: [...(valueObjects || []), ...contractMoneyVos].map((v) => ({
        name: pascal(v.name),
        fields: rawFields(v.fields),
      })),
      converters,
    };
  },
  { fileName: (a) => `${objNameOf(a)}ProtoConverters.scala` }
);

// bootstrap-dsl → infrastructure/bootstrap/
// per-aggregate traits first (skipApp), then a final ApplicationBootstrap wiring them all
{
  const bootDir = pkgDir(`${basePkg}.infrastructure.bootstrap`);
  mkdirSync(bootDir, { recursive: true });
  let bootOk = 0, bootErr = null;
  const bootNames = [];
  // PHASE1-TRANSITION (golden-derived wiring facts, same status as the
  // stamp map): only ModelCatalog's bootstrap takes domain-service ports —
  // the ports themselves are tree domain-services (E1); the param names and
  // order are the old template's patch convention.
  const PHASE1_SERVICE_PORTS = {
    ModelCatalog: [
      { param: "adjudicator", type: "ConceptDeltaAdjudicator" },
      { param: "fingerprint", type: "ContentFingerprintPort" },
    ],
  };
  // Views present in golden but with no read-model atom in the tree (graph /
  // semantic / lookup views were generated from other metadata): bootstrap
  // wiring transcribed for Phase 1 verification.
  const PHASE1_EXTRA_VIEWS = [
    { view: "CatalogGraphView", sources: ["ModelCatalog"] },
    { view: "ConceptEdgeGraphView", sources: ["Relation"] },
    { view: "ConceptGraphView", sources: ["Concept"] },
    { view: "ContextGraphView", sources: ["Context"] },
    { view: "ContextRelationGraphView", sources: ["ContextRelation"] },
    { view: "NoteGraphView", sources: ["Note"] },
    { view: "QuestionGraphView", sources: ["Question"] },
    { view: "SubdomainGraphView", sources: ["Subdomain"] },
    { view: "UserLookupByEmailOrPhoneView", sources: ["User"] },
    { view: "KnowledgeSemanticView", sources: ["Note", "Concept"], forForm: true },
  ];
  // DecisionViews whose golden projection object exposes
  // createProjectionFor<X> instead of createProjection (For-form bootstrap).
  const PHASE1_FOR_FORM_VIEWS = { OpenSessionDecisionView: ["Session"] };
  const wiredViews = []; // projections wired into ApplicationBootstrap
  aggregates.forEach((a, i) => {
    if (bootErr) return;
    try {
      const objName = objNameOf(a);
      bootNames.push(`${objName}Bootstrap`);
      const spec = {
        package: `${basePkg}.infrastructure.bootstrap`,
        name: objName,
        basePkg,
        servicePorts: PHASE1_SERVICE_PORTS[objName] || [],
        // 字符串 id 聚合（saga 面，标识符折叠 String）empty 直传 entityId
        idIsString: !!(a.identifier && String(a.identifier.dataType || "").trim() === "String"),
        skipApp: true,
      };
      const specPath = join(specDir, `bootstrap-dsl-${i}.json`);
      writeFileSync(specPath, JSON.stringify(spec, null, 2));
      execSync(
        `node "${join(__dirname, "bootstrap-dsl", "emit.mjs")}" "${specPath}" "${bootDir}"`,
        { stdio: "pipe" }
      );
      bootOk++;
    } catch (e) {
      bootErr = e.message.slice(0, 300);
    }
  });
  // per-projection bootstraps (DecisionView)
  readModels.forEach((r, i) => {
    if (bootErr) return;
    try {
      const viewName = pascal(r.name); // already ends with DecisionView
      bootNames.push(`${viewName}Bootstrap`);
      if (viewName !== "PauseProjectDecisionView") wiredViews.push(viewName);
      // source aggregate from sourceAggregate field
      const servedBy = r.sourceAggregate || r.served_by || (r.sources && r.sources[0]) || "";
      const aggName = pascal(servedBy) + "Aggregate";
      const spec = {
        package: `${basePkg}.infrastructure.bootstrap`,
        name: viewName,
        kind: "projection",
        sourceAggregate: aggName,
        forSources: PHASE1_FOR_FORM_VIEWS[viewName] || null,
        basePkg,
        skipApp: true,
      };
      const specPath = join(specDir, `bootstrap-dsl-proj-${i}.json`);
      writeFileSync(specPath, JSON.stringify(spec, null, 2));
      execSync(
        `node "${join(__dirname, "bootstrap-dsl", "emit.mjs")}" "${specPath}" "${bootDir}"`,
        { stdio: "pipe" }
      );
      bootOk++;
    } catch (e) {
      bootErr = e.message.slice(0, 300);
    }
  });
  // extra golden views without tree read-model atoms (PHASE1 table above) —
  // golden transcriptions, kept for the metarch golden face; a saga-binding
  // tree (serial saga face) drops them (their source aggregates are metarch's).
  const extraViews = sagaBinding ? [] : PHASE1_EXTRA_VIEWS;
  extraViews.forEach((x, i) => {
    if (bootErr) return;
    try {
      bootNames.push(`${x.view}Bootstrap`);
      wiredViews.push(x.view);
      const spec = {
        package: `${basePkg}.infrastructure.bootstrap`,
        name: x.view,
        kind: "projection",
        sourceAggregate: `${x.sources[0]}Aggregate`,
        forSources: x.forForm ? x.sources : null,
        basePkg,
        skipApp: true,
      };
      const specPath = join(specDir, `bootstrap-dsl-xview-${i}.json`);
      writeFileSync(specPath, JSON.stringify(spec, null, 2));
      execSync(
        `node "${join(__dirname, "bootstrap-dsl", "emit.mjs")}" "${specPath}" "${bootDir}"`,
        { stdio: "pipe" }
      );
      bootOk++;
    } catch (e) {
      bootErr = e.message.slice(0, 300);
    }
  });
  // final ApplicationBootstrap: aggregates (alphabetical) then wired
  // projections (alphabetical); policy bootstraps and PauseProject are NOT
  // wired here (golden form — policies wire via PolicyProjectionModule).
  if (!bootErr) {
    try {
      const appSpec = {
        package: `${basePkg}.infrastructure.bootstrap`,
        name: "Application",
        skipTrait: true,
        basePkg,
        aggTraits: aggregates.map((a) => objNameOf(a)),
        viewTraits: wiredViews,
        // service ports are metarch-golden wiring (ModelCatalog domain services);
        // a saga-binding tree has no such aggregate → no phantom ports.
        servicePorts: sagaBinding ? [] : (PHASE1_SERVICE_PORTS.ModelCatalog || []),
      };
      const specPath = join(specDir, `bootstrap-dsl-app.json`);
      writeFileSync(specPath, JSON.stringify(appSpec, null, 2));
      execSync(
        `node "${join(__dirname, "bootstrap-dsl", "emit.mjs")}" "${specPath}" "${bootDir}"`,
        { stdio: "pipe" }
      );
      bootOk++;
    } catch (e) {
      bootErr = e.message.slice(0, 300);
    }
  }
  results.push(bootErr ? { gen: "bootstrap-dsl", status: "error", error: bootErr } : { gen: "bootstrap-dsl", status: "ok", count: bootOk });
}

// ── Step 4: move command-dsl helpers into behaviors/ package dir ──
// command-dsl declares `package ${pkg}.behaviors` but runGen placed it at the
// aggregate root; relocate to match the declared package.
{
  const aggDir = pkgDir(`${basePkg}.application.aggregates`);
  const behDir = pkgDir(`${basePkg}.application.aggregates.behaviors`);
  mkdirSync(behDir, { recursive: true });
  for (const a of aggregates) {
    const f = `${objNameOf(a)}CommandHelpers.scala`;
    const src = join(aggDir, f);
    const dst = join(behDir, f);
    if (existsSync(src)) {
      renameSync(src, dst);
    }
  }
}

// ── Family generators (in-process modules emitting {path, content}) ──
// B-POLICYEXEC: policy execution machinery + PolicyOn<Cmd> bootstraps
// (runner gate = policy note info.executionSide; replaces the former
// per-policy bootstrap-dsl loop, whose slug-named bootstraps were wrong in
// both population and naming).
{
  try {
    const files = [...generatePolicyExec(canonical), ...generatePolicyBootstraps(canonical)];
    for (const f of files) {
      const p = join(outDir, f.path);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, f.content);
    }
    results.push({ gen: "policyexec", status: "ok", count: files.length });
  } catch (e) {
    results.push({ gen: "policyexec", status: "error", error: e.message.slice(0, 300) });
  }
}
{
  try {
    const files = generateSmViews(canonical);
    for (const f of files) {
      const p = join(outDir, f.path);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, f.content);
    }
    results.push({ gen: "projection-dsl/smviews", status: "ok", count: files.length });
  } catch (e) {
    results.push({ gen: "projection-dsl/smviews", status: "error", error: e.message.slice(0, 300) });
  }
}
{
  try {
    const files = generateViewRepos(canonical);
    // Phase 2 R10: SQL DDL + Mongo index spec ride along with the view repos.
    const ddl = generateViewDdl(canonical);
    if (ddl) files.push(ddl);
    const mongoIdx = generateMongoIndexSpec(canonical);
    if (mongoIdx) files.push(mongoIdx);
    for (const f of files) {
      const p = join(outDir, f.path);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, f.content);
    }
    results.push({ gen: "projection-dsl/viewrepo", status: "ok", count: files.length });
  } catch (e) {
    results.push({ gen: "projection-dsl/viewrepo", status: "error", error: e.message.slice(0, 300) });
  }
}

// ── PHASE1-TRANSITION: stamp post-pass (see PHASE1_STAMP_POSTPASS above) ──
// Rewrites only the first `@generated by ...` header line of matched files.
{
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".scala")) {
        for (const [re, stamp] of PHASE1_STAMP_POSTPASS) {
          if (!re.test(p)) continue;
          const src = readFileSync(p, "utf8");
          const out = src.replace(/\/\/ @generated by [^\n]*/, `// @generated by ${stamp}`);
          if (out !== src) writeFileSync(p, out);
          break;
        }
      }
    }
  };
  walk(join(outDir, "app"));
}

console.log("\n═══ run-all v3 results (toolchain-driven → sbt project) ═══");
for (const r of results) {
  console.log(`  ${r.gen}: ${r.status}${r.count !== undefined ? ` (${r.count} files)` : ""}${r.reason ? ` — ${r.reason}` : ""}`);
}
const ok = results.filter((r) => r.status === "ok").length;
console.log(`\n${ok}/${results.length} generators ok`);

// ── Step 5: sbt project scaffold ──
// PHASE1-TRANSITION (B-SCAFFOLD): build.sbt, project/plugins.sbt, .gitignore
// and conf/application.conf are NOT tree-derived — they are the golden
// project's own build/config face. For Phase 1 1:1 verification they are
// emitted as exact static transcriptions of the golden files (kept under
// generators/scaffold-static/). Phase 2 must replace these with a properly
// templated project scaffold (parameterized name/deps) and delete the
// transcriptions.
// Phase 2 scaffold fix (2026-10-20): the build.sbt transcription was patched
// in place - Huawei Cloud resolver removed (user directive: no Huawei
// software/services; resolvers are Maven Central + Aliyun only) and the
// net.imadz engine dependencies the generated code actually imports were
// added (common-core + auth-core, both 0.2 from Maven Central; see the
// evidence comment in scaffold-static/build.sbt). The file remains a static
// transcription otherwise; full parameterization is still pending.
const scaffoldStatic = (name) => readFileSync(join(__dirname, "scaffold-static", name)); // Buffer: byte-exact (golden files carry legacy-encoded comments)

writeFileSync(join(outDir, "build.sbt"), scaffoldStatic("build.sbt"));

mkdirSync(join(outDir, "project"), { recursive: true });
writeFileSync(join(outDir, "project", "build.properties"), "sbt.version=1.4.9\n");
writeFileSync(join(outDir, "project", "plugins.sbt"), scaffoldStatic("plugins.sbt"));

mkdirSync(join(outDir, "conf"), { recursive: true });
writeFileSync(join(outDir, "conf", "application.conf"), scaffoldStatic("application.conf"));
writeFileSync(
  join(outDir, "conf", "routes"),
  `# Generated by truthsrc run-all v3 — api-dsl appends generated routes below.
# Routes
# ~~~~
`
);

writeFileSync(join(outDir, ".gitignore"), scaffoldStatic("gitignore"));

// Serial/saga face support classes (scaffold-static/app transcriptions): the
// api-dsl controller imports metarch.infrastructure.{api.CommandDsl,
// auth.CommandRoleMap}; the ingested-app host carries them as its own files —
// a standalone saga-tree app has no host, so run-all copies them in. Emitted
// only when a saga binding is present: the golden metarch face keeps its
// host-app copies and the run-all output stays byte-identical.
if (sagaBinding) {
  const supportRoot = join(__dirname, "scaffold-static", "app");
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
  for (const src of walk(supportRoot)) {
    const dest = join(outDir, "app", relative(supportRoot, src));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, readFileSync(src));
  }
}

// Controller routes (old gen_api_layer E301 marker block): the scaffold
// step above rewrites conf/routes, so the collected controller route lines
// are appended here — aggregate/codepoint order, golden line format.
if (typeof apiRouteLinesAll !== "undefined" && apiRouteLinesAll.length) {
  const rp = join(outDir, "conf", "routes");
  const cur = existsSync(rp) ? readFileSync(rp, "utf8") : "";
  writeFileSync(rp, cur.trimEnd() + "\n\n# >>> gen_api_layer (E301) >>>\n" + apiRouteLinesAll.join("\n") + "\n# <<< gen_api_layer <<<\n");
}

console.log(`\nsbt project scaffold written to ${outDir}`);
console.log(`  app/ package root: ${basePkg}`);
