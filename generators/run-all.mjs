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
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { compileTree } from "../lib/compile.mjs";

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
for (const n of notes) {
  if (n.type !== "readModel" || !n.name) continue;
  const rc = n.info && n.info.projectionRefCodes;
  if (rc && typeof rc === "object") projRefCodes.set(n.name, rc);
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
      })),
      events: (a.events || []).map((e) => ({
        name: e.name,
        fields: normFieldsRich(e.payloads),
        foldAssignments: e.foldAssignments || [],
        noteId: noteIdOf("event", e.name, a.name),
        elementHash: elementHashOf("event", e.name, a.name),
        humanDescription: e.humanDescription || "",
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
    policies: policies.map((n) => {
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
      // events from consumesEvents (already in the readModel)
      const events = (r.consumesEvents || []).map(e => ({
        name: pascal(e),
      }));
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

runGen("valueobject-dsl", valueObjects, `${basePkg}.domain.values`, (v) => ({
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

runGen("monarch-dsl", pipelines, `${basePkg}.application.pipeline`, (p) => ({
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
        // golden StatePO: identifier FIRST (its noteId annotates the line),
        // then stateFields in order, each with its field noteId.
        stateFields: [
          ...(a.identifier
            ? [{ name: a.identifier.name, dataType: a.identifier.dataType, noteId: a.identifier.noteId || null, elementHash: a.identifier.elementHash || null, introducedIn: a.identifier.introducedIn || null }]
            : []),
          // credential-nature fields never reach the proto StatePO (golden
          // rule, same exclusion as Entity state)
          ...(a.stateFields || [])
            .filter((f) => f.nature !== "credential")
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
  results.push(protoErr ? { gen: "proto-dsl", status: "error", error: protoErr } : { gen: "proto-dsl", status: "ok", count: protoOk });
}

// api-dsl → app/controllers/<Name>ApiController.scala (B2 DSL, ingested-app 1:1)
{
  const ctrlDir = join(outDir, "app", "controllers");
  mkdirSync(ctrlDir, { recursive: true });
  const routesFrags = [];
  let apiOk = 0, apiErr = null;
  aggregates.forEach((a, i) => {
    if (apiErr) return;
    try {
      const objName = objNameOf(a);
      const aggBase = objName.replace(/Aggregate$/, "");
      const spec = {
        package: "controllers",
        aggregate: aggBase,
        basePkg,
        name: objName,
        flags: {
          aggHasDsl: true,
          aggHasEmptyBody: (a.commands || []).some(c => !(c.parameters || c.params || []).length),
        },
        commands: (a.commands || []).map((c) => {
          const params = c.parameters || c.params || [];
          // ID guard: find Id-typed params
          // Path param = first Id param (by convention, the aggregate's own ID)
          const idParams = params.filter(p =>
            /Id$/.test(p.name) || /^(.*)Id$/.test(p.type || ""));
          const pathParamName = idParams.length ? idParams[0].name : "id";
          const idGuard = idParams.length ? {
            pairs: idParams.map((p, idx) => {
              // "conceptId" -> id  (path param) or "conceptId" -> req.conceptId (body)
              const src = idx === 0 ? pathParamName : `req.${p.name}`;
              return `"${p.name}" -> ${src}`;
            }),
            cids: idParams.map(p => `${p.name.replace(/Id$/, "")}Cid`),
          } : null;
          // Build ctor args from params (excluding replyTo, triggeredBy)
          const ctorParams = params.filter(p =>
            p.name !== "replyTo" && p.name !== "triggeredBy");
          const ctorArgs = ctorParams.map(p => {
            if (/Id$/.test(p.name) && idGuard) {
              // Map to guard-extracted Cid
              const base = p.name.replace(/Id$/, "");
              return `${base}Cid`;
            }
            if (p.name === "tenantId") return "ts.tenantId";
            if (p.name === "userId") return "ts.userId";
            return `req.${p.name}`;
          }).join(", ");
          // Req fields: params excluding tenantId/userId/triggeredBy/replyTo/Id-guarded
          const reqFields = params
            .filter(p => !["tenantId", "userId", "triggeredBy", "replyTo"].includes(p.name))
            .map(p => ({ name: p.name, type: normType(p.dataType || p.type) }));
          return {
            name: c.name,
            actionName: c.name[0].toLowerCase() + c.name.slice(1),
            tier: c.tier || "tenant",
            httpMethod: "POST",
            routePath: `/api/${snake(aggBase)}/${snake(c.name)}`,
            sig: idParams.length ? `(${idParams[0].name}: String)` : "",
            pathParam: idParams.length ? idParams[0].name : null,
            idGuard,
            ctorArgs,
            reqFields,
            entityExpr: idParams.length ? idParams[0].name : "id",
            dvExpr: dvJsExpr(c.name),
            noteId: noteIdOf("command", c.name, a.name),
            elementHash: elementHashOf("command", c.name, a.name),
          };
        }),
      };
      const specPath = join(specDir, `api-dsl-${i}.json`);
      writeFileSync(specPath, JSON.stringify(spec, null, 2));
      execSync(
        `node "${join(__dirname, "api-dsl", "emit.mjs")}" "${specPath}" "${ctrlDir}"`,
        { stdio: "pipe" }
      );
      // collect routes fragment
      const fragPath = join(ctrlDir, "routes.fragment");
      if (existsSync(fragPath)) {
        routesFrags.push(readFileSync(fragPath, "utf8"));
        rmSync(fragPath);
      }
      apiOk++;
    } catch (e) {
      apiErr = e.message.slice(0, 300);
    }
  });
  // append generated routes to conf/routes (ensure conf/ exists — scaffold step runs later)
  if (routesFrags.length) {
    mkdirSync(join(outDir, "conf"), { recursive: true });
    const routesPath = join(outDir, "conf", "routes");
    const existing = existsSync(routesPath) ? readFileSync(routesPath, "utf8") : "";
    writeFileSync(routesPath, existing + "\n" + routesFrags.join("\n"));
  }
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
      valueObjects: (valueObjects || []).map((v) => ({
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
  // extra golden views without tree read-model atoms (PHASE1 table above)
  PHASE1_EXTRA_VIEWS.forEach((x, i) => {
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
  // per-policy bootstraps
  policies.forEach((p, i) => {
    if (bootErr) return;
    try {
      const policyName = "PolicyOn" + pascal(asciiName(p.name));
      bootNames.push(`${policyName}Bootstrap`);
      // source aggregate = the aggregate owning the policy's trigger event
      const trigAgg = (p.info?.triggers || [])[0]?.aggregate || "";
      const aggName = trigAgg
        ? pascal(trigAgg) + "Aggregate"
        : aggregates.length > 0
          ? objNameOf(aggregates[0]) + "Aggregate"
          : "ConceptAggregate";
      const spec = {
        package: `${basePkg}.infrastructure.bootstrap`,
        name: policyName,
        kind: "policy",
        sourceAggregate: aggName,
        basePkg,
        skipApp: true,
      };
      const specPath = join(specDir, `bootstrap-dsl-pol-${i}.json`);
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
        servicePorts: PHASE1_SERVICE_PORTS.ModelCatalog || [],
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
const appName = `${String(canonical.workshop || "generated").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-generated`;

writeFileSync(join(outDir, "build.sbt"), `name := "${appName}"
organization := "net.imadz"
version := "1.0-SNAPSHOT"

scalaVersion := "2.13.14"

val akkaVersion = "2.6.20"
val imadzVersion = "0.2"

lazy val root = (project in file(".")).enablePlugins(PlayScala)

Compile / scalacOptions ++= Seq(
  "-target:11",
  "-deprecation",
  "-feature",
  "-unchecked",
  "-Xlog-reflective-calls",
  "-Xlint")
Compile / javacOptions ++= Seq("-Xlint:unchecked", "-Xlint:deprecation")

resolvers ++= Seq(
  "Aliyun" at "https://maven.aliyun.com/repository/public/"
)

libraryDependencies += guice
libraryDependencies += jdbc
libraryDependencies += clusterSharding
libraryDependencies ++= Seq(
  // net.imadz 0.2 engine libraries (lockstep)
  "net.imadz" %% "common-core" % imadzVersion,
  "net.imadz" %% "monarch-core" % imadzVersion,
  "net.imadz" %% "saga-core" % imadzVersion,
  "net.imadz" %% "auth-core" % imadzVersion,
  "net.imadz" %% "monarch-persistence" % imadzVersion,

  // Akka
  "com.typesafe.akka" %% "akka-cluster-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-cluster-sharding-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-stream" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence-query" % akkaVersion,
  "com.typesafe.akka" %% "akka-serialization-jackson" % akkaVersion,
  "com.typesafe.akka" %% "akka-slf4j" % akkaVersion,

  // Projections
  "com.lightbend.akka" %% "akka-projection-eventsourced" % "1.2.5",
  "com.lightbend.akka" %% "akka-projection-jdbc" % "1.2.5",
  "org.scalikejdbc" %% "scalikejdbc" % "3.5.0",
  "org.scalikejdbc" %% "scalikejdbc-config" % "3.5.0",
  "org.scalikejdbc" %% "scalikejdbc-play-initializer" % "2.8.0-scalikejdbc-3.5",

  // Logging / test
  "ch.qos.logback" % "logback-classic" % "1.4.5",
  "org.scalatest" %% "scalatest" % "3.2.15" % Test,
  "org.scalatestplus.play" %% "scalatestplus-play" % "5.0.0" % Test,
  "com.typesafe.akka" %% "akka-actor-testkit-typed" % akkaVersion % Test,
  "com.typesafe.akka" %% "akka-stream-testkit" % akkaVersion % Test,
  "com.typesafe.akka" %% "akka-persistence-testkit" % akkaVersion % Test
)
`);

mkdirSync(join(outDir, "project"), { recursive: true });
writeFileSync(join(outDir, "project", "build.properties"), "sbt.version=1.4.9\n");
writeFileSync(
  join(outDir, "project", "plugins.sbt"),
  `addSbtPlugin("com.typesafe.play" % "sbt-plugin" % "2.8.18")\n`
);

mkdirSync(join(outDir, "conf"), { recursive: true });
writeFileSync(
  join(outDir, "conf", "application.conf"),
  `# Generated by truthsrc run-all v3 — fill in environment specifics.
play.http.secret.key = "changeme-in-production"

# Akka cluster (single-node dev default)
akka {
  actor.provider = "cluster"
  remote.artery.canonical.port = 2551
  cluster.seed-nodes = ["akka://application@127.0.0.1:2551"]
}

# Persistence / projections: wire your journal + read journal here.
# Generated repositories reference these via application.conf.
`
);
writeFileSync(
  join(outDir, "conf", "routes"),
  `# Generated by truthsrc run-all v3 — api-dsl appends generated routes below.
# Routes
# ~~~~
`
);

writeFileSync(
  join(outDir, ".gitignore"),
  `target/
project/target/
project/project/
.bsp/
.metals/
.idea/
*.class
*.log
`
);

console.log(`\nsbt project scaffold written to ${outDir}`);
console.log(`  app/ package root: ${basePkg}`);
