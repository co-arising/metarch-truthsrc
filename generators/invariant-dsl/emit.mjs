#!/usr/bin/env node
// ═══ invariant-dsl emitter v4 — per-aggregate Rules + RuleParams (ingested-app 1:1) ═══
// Port of the old codegen's rules_domain_gen.mjs (B2: rule bodies) onto the
// truthsrc spec emitted by run-all.mjs:
//   object <Aggregate>Rules {
//     private def err / notNull / isMissingRef×2
//     checkAggregate: init gate (RULING5 tables) + aggregateRuleRefs translations
//       + synthetic status_enum / tenant_id lines (golden inventory)
//     object|class <Cmd>Rule extends InvariantRule[...]   (one per command, alphabetical)
//       guard chain translated from spec guards (see translateGuard)
//       Right(List(<events>)) built by the eventArgs port (bindings → heuristics)
//     checkEventPostconditions + firstBad<Event> helpers (postconditionRefs
//       conflict-filtered exactly as the old pipeline did + generic Id/timestamp checks)
//   }
// @knowledge anchors: full `<noteId>@<elementHash>` anchors (elementHash is
//   seed-carried in the tree next to the noteId — Decision 1, 2026-10-20),
//   emitted only where the spec carries the noteId (command noteId for
//   command-level anchors, aggregate noteId for aggregate-level anchors).
// Known spec gaps (run-all does not forward them; handled by golden-derived
// exception tables below and reported): guards/produces/noteId for commands
//   without an invariantRef guard; decision.emitWhen / idempotentOn;
//   executable-case sentinel UUIDs for sentinel-degraded refExists rules.
// Usage: node emit.mjs <spec.json> <out-dir>

import { readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
import { dirname, join } from "path";

const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const pascal = (s) =>
  String(s).split(/[-_ ]/).map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : "")).join("");

const pkg = spec.package || "generated.invariant";
const eventType = spec.eventType || "DomainEvent";
const stateType = spec.stateType || "DomainState";
const rules = spec.rules ?? [];

let aggName = spec.aggregateName;
if (!aggName && spec.objectName) {
  aggName = String(spec.objectName).replace(/(Invariants|Rules|Rule)$/, "") || spec.objectName;
}
if (!aggName) {
  aggName = stateType.endsWith("State") ? stateType.slice(0, -5) : "Aggregate";
}
aggName = pascal(aggName);
const containerName = `${aggName}Rules`;
const AGG_UP = aggName.toUpperCase();

// ── shared type mapping (old codegen DataTypeMapper; dataType raw → Scala) ──
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
  if (s === "string (enum)" || s === "enum") return "String";
  if (s === "string (json)" || s === "json") return "String";
  if ((s.startsWith("list[") || s.startsWith("list<")) && (s.endsWith("]") || s.endsWith(">")))
    return `List[${scalaSig(raw.slice(5, raw.length - 1))}]`;
  if ((s.startsWith("array[") || s.startsWith("array<")) && (s.endsWith("]") || s.endsWith(">")))
    return `List[${scalaSig(raw.slice(6, raw.length - 1))}]`;
  return raw !== "" ? raw : "String"; // VO / custom type name verbatim
};
const sigOf = (f) => {
  const sig = scalaSig(f.dataType);
  return f.optional ? `Option[${sig}]` : sig;
};

// Scala keywords are backticked when used as field references (patch_core scalaRef).
const SCALA_KEYWORDS = new Set([
  "type", "class", "object", "def", "val", "var", "if", "else", "for", "while",
  "import", "package", "match", "case", "extends", "trait", "with", "return",
  "null", "true", "false", "new", "this", "super", "private", "protected",
  "sealed", "abstract", "final", "implicit", "lazy", "override", "try",
  "catch", "finally", "throw", "yield", "do", "then", "elseif",
]);
const scalaRef = (n) => (SCALA_KEYWORDS.has(n) ? `\`${n}\`` : n);

// desc strings land inside Scala "..." literals (old pipeline escaping).
// Backslashes in spec descs arrive pre-doubled (verified: 0 descs carry a
// single backslash), so only quotes need neutralizing for Scala strings.
const escDesc = (s) => String(s ?? "").replace(/"/g, "'");
const q = (vals) => vals.map((v) => `"${v}"`).join(", ");

// ── VO member table (name → [[field, rawDataType], ...]) ──
// Needed for VO default construction in eventArgs and for nested-path leaf
// types in postconditions. Static snapshot of the tree's value-objects.
const VO_FIELDS = {"AggregateRelationSpec":[["toAggregate","String"],["cardinality","String"],["foreignKey","String"],["writePath","String"],["ruling","String"],["semanticType","String"],["causal","JSON"],["temporal","Boolean"],["existence","String"],["targetDeletionPolicy","String"],["targetTypes","List<String>"],["noteId","String"]],"CatalogConflictSet":[["detectedAt","Instant"],["conflicts","List<CatalogConflict>"]],"CatalogConflict":[["conflictId","String"],["conflictType","String"],["involvedSessionIds","List<String>"],["details","JSON"],["resolvedAt","Instant"],["resolvedBy","String"],["resolutionAction","String"],["resolutionNote","String"]],"CatalogPatchSet":[["sessionId","String"],["concepts","List<ConceptDelta>"],["appliedAt","Instant"]],"ChecklistItem":[["criterion","String"],["status","String"],["evidence","String"],["proposedBy","String"],["confirmedBy","String"],["confirmedAt","String"]],"CodeAnchorDelta":[["noteId","String (UUID)"],["role","String"],["host","String"],["file","String"],["symbols","List<String>"]],"ConceptDelta":[["action","String"],["conceptName","String"],["contextId","String"],["noteIds","List<String>"],["definition","String"],["conceptId","String (UUID)"],["contentHash","String"],["kind","String (Enum)"],["sourceStage","String"],["sourceSessionId","String (UUID)"],["noteId","String (UUID)"],["anchors","List<CodeAnchorDelta>"],["guards","List<GuardSpec>"],["aggregateRuleRefs","List<RuleRef>"],["preconditionRefs","List<RuleRef>"],["postconditionRefs","List<RuleRef>"],["fields","List<FieldSpec>"],["emits","List<EdgeTarget>"],["folds","List<FieldEdge>"],["emissions","List<FieldEdge>"],["steps","List<UcStep>"],["extensions","List<UcStep>"],["ucWrites","List<EdgeTarget>"],["ucPublishes","List<EdgeTarget>"]],"ConceptIndexEntry":[["conceptName","String"],["contextId","String"],["conceptId","String (UUID)"],["contentHash","String"]],"DoRAssessmentResult":[["verdicts","List<DoRVerdict>"],["evaluatedScope","String"],["summary","String"]],"DoRVerdict":[["criterion","String"],["evaluatorType","String"],["evaluatorId","String"],["evaluatorRole","String"],["aiModelVersion","String"],["harnessBrand","String"],["harnessVersion","String"],["effort","String"],["result","String"],["reason","String"],["evidenceLinks","List<String>"],["recordedAt","Instant"],["recordedBy","String"],["evaluatedScope","JSON"],["summary","String"],["sessionId","String"],["proposal","String"]],"EdgeTarget":[["conceptId","String"],["name","String"]],"EventBinding":[["slot","String"],["expr","String"]],"FieldCommandSpec":[["commandName","String"],["description","String"],["produces","List<String>"],["preconditions","List<String>"],["parameters","List<FieldParamSpec>"],["noteId","String"],["guards","List<GuardSpec>"],["preconditionRefs","List<RuleRef>"]],"FieldEdge":[["fieldNoteId","String"],["slot","String"],["expr","String"],["fieldConceptId","String"]],"FieldEventSpec":[["eventName","String"],["description","String"],["humanDescription","String"],["origin","String"],["payloads","List<FieldParamSpec>"],["noteId","String"],["bindings","List<EventBinding>"],["forEach","String"],["foldAssignments","List<EventBinding>"],["postconditionRefs","List<RuleRef>"]],"FieldParamSpec":[["paramName","String"],["dataType","String"],["description","String"],["uiLabel","String"],["businessDef","String"],["origin","String"],["lineageHint","String"],["derivation","String"],["role","String"],["optional","Boolean"],["optionalWhen","String"],["noteId","String"]],"FieldSpec":[["name","String"],["dataType","String"],["description","String"],["role","String"],["noteId","String"],["writtenBy","List<String>"],["fieldConceptId","String"]],"FieldStateSpec":[["fieldName","String"],["dataType","String"],["description","String"],["uiLabel","String"],["businessDef","String"],["derivation","String"],["lineageHint","String"],["parent","String"],["fold","String"],["source","String"],["origin","String"],["role","String"],["writtenBy","List<String>"],["nature","String"],["noteId","String"],["foldAssignments","List<EventBinding>"]],"Finding":[["criterion","String"],["description","String"],["severity","String"],["sessionId","String"],["proposal","String"]],"FsmStateDef":[["name","String"],["kind","String"],["notes","String"],["confirmedBy","String"],["confirmedAt","String"]],"FsmTransition":[["source","String"],["target","String"],["event","String"],["guard","String"],["notes","String"],["confirmedBy","String"],["confirmedAt","String"]],"GuardSpec":[["kind","String"],["ref","String"],["errCode","String"],["desc","String"],["cond","String"],["from","String"],["toStatus","String"],["notStatus","List<String>"],["note","String"]],"ParticipantRole":[["userId","String (UUID)"],["role","String"]],"PatchReadModelFieldSpec":[["fieldName","String"],["dataType","String"],["uiLabel","String"],["source","String"],["isKey","Boolean"],["origin","String"],["writtenBy","List<String>"]],"ReadModelFieldSpec":[["fieldName","String"],["dataType","String"],["uiLabel","String"],["source","String"],["isKey","Boolean"],["origin","String"],["writtenBy","List<String>"],["noteId","String"]],"RelationDelta":[["action","String"],["relationName","String"],["sourceConceptName","String"],["targetConceptName","String"],["mapping","String"]],"RuleRef":[["ruleId","String"],["errCode","String"],["desc","String"]],"StateGateSpec":[["commandName","String"],["fromStates","List<String>"],["toState","String"],["initial","Boolean"],["noteId","String"]],"StatusTransitionSpec":[["eventName","String"],["toState","String"],["noteId","String"]],"UcStep":[["no","String"],["atStep","String"],["text","String"]],"VOMemberSpec":[["fieldName","String"],["dataType","String"],["description","String"],["noteId","String"]]};

// ── RULING5 (裁决⑤): timestamp gate fields ──
// InitialCommands are NO LONGER read from a generator-side table: the
// tree's stateGates.initial is the single source (Decision 3, 2026-10-20 —
// EstablishConcept is Concept's initial command; ParkConcept is shelving).
// buildCheckAggregate derives the whitelist from spec.stateGates in command
// order. The timestamp-field half of 裁决⑤ remains a table below.
const RULING5_TS_FIELD = {
  Context: "discoveredAt", Relation: "createdAt", ContextRelation: "createdAt", Subdomain: "classifiedAt",
  FieldModelDefinition: "declaredAt", ReadModelDefinition: "declaredAt", ValueObjectDefinition: "declaredAt",
  TruthSourceProvenance: "recordedAt", UseCaseDefinition: "declaredAt",
};

// Synthetic checkAggregate lines (golden inventory; not present in the spec):
// status_enum is emitted for aggregates with a status field + statusEnum,
// except this golden skip-set.
const STATUS_ENUM_SKIP = new Set(["CemEdge", "FsmDefinition", "RoleCommandBinding", "WorkTicket"]);
// tenant_id line is emitted exactly for these aggregates in golden (Tenant
// included although its state has no tenantId field).
const TENANT_AGGS = new Set([
  "Concept", "Context", "ContextRelation", "DoR", "KnowledgePatch", "ModelCatalog",
  "Note", "OrganizationMember", "Project", "Question", "Relation", "Session",
  "Stage", "Subdomain", "Tenant", "Workgroup", "Workshop",
]);

// Aggregate identifier fields → owning aggregate (refExists target derivation).
const AGG_IDENTIFIERS = {
  conceptId: "Concept", contextId: "Context", relationId: "ContextRelation",
  dorId: "DoR", fsmId: "FsmDefinition", patchId: "KnowledgePatch",
  catalogId: "ModelCatalog", noteId: "Note", orgMemberId: "OrganizationMember",
  projectId: "Project", questionId: "Question", edgeId: "Relation",
  sessionId: "Session", stageId: "Stage", subdomainId: "Subdomain",
  tenantId: "Tenant", userId: "User", ticketId: "WorkTicket",
  workgroupId: "Workgroup", workshopId: "Workshop", bindingId: "RoleCommandBinding",
  provenanceId: "TruthSourceProvenance",
  sourceId: "Concept",
  targetId: "Concept",
};
const REF_TARGET_EXTRA = { aggregateIds: "Concept" };
function refTargetOf(field) {
  if (REF_TARGET_EXTRA[field]) return REF_TARGET_EXTRA[field];
  if (AGG_IDENTIFIERS[field]) return AGG_IDENTIFIERS[field];
  const sing = field.endsWith("Ids") ? field.slice(0, -1) : field;
  if (AGG_IDENTIFIERS[sing]) return AGG_IDENTIFIERS[sing];
  for (const k of Object.keys(AGG_IDENTIFIERS).sort((a, b) => b.length - a.length)) {
    const cap = k[0].toUpperCase() + k.slice(1);
    if (field.endsWith(cap) || sing.endsWith(cap)) return AGG_IDENTIFIERS[k];
  }
  return null;
}

// ── Golden-derived exception tables (spec gaps; see header note) ──
// refExists rules the old pipeline degraded to executable-case sentinels: the
// Cross-aggregate membership checks the old pipeline rendered in degraded
// sentinel form: `!(!(p.f == Id.of("<executable-case user>")))` with the
// comment suffix （哨兵判定（不可翻译·④层降级））. UUIDs/descs from golden
// (the executable_cases sentinel users are not in the tree).
const SENTINEL_CHECKS = {
  "Session.InviteParticipant.ir_gen_ref_IR_SES_CMD_003_userId": {
    uuid: "40f3e300-6546-36a5-960e-9148022e510e", field: "userId",
    desc: "InviteParticipant.userId 必须属于 OrganizationMember.userId（经 Session.tenantId 关联）",
  },
  "Workgroup.AssignWorkgroupOwner.ir_gen_ref_IR_WG_CMD_002_ownerUserId": {
    uuid: "40f3e300-6546-36a5-960e-9148022e510e", field: "ownerUserId",
    desc: "AssignWorkgroupOwner.ownerUserId 必须属于 OrganizationMember.userId（经 Workgroup.tenantId 关联）",
  },
  "OrganizationMember.InviteTenantMember.ir_gen_ref_IR_INV_CMD_002_userId": {
    uuid: "1e4e0961-7a69-31fa-bccc-8cb7e5c58039", field: "userId",
    desc: "InviteTenantMember.userId 不得属于 OrganizationMember.userId（经 OrganizationMember.tenantId 关联）",
  },
  "Project.AssignProjectOwner.ir_gen_ref_IR_PRJ_CMD_002_ownerUserId": {
    uuid: "40f3e300-6546-36a5-960e-9148022e510e", field: "ownerUserId",
    desc: "AssignProjectOwner.ownerUserId 必须属于 Workgroup.memberUserIds（经 Project.workgroupId 关联）",
  },
};
// Aggregate identity field names where they differ from <agg>Id
// (the tree's stateFields omit the id; the entity State carries it).
const AGG_ID_FIELDS = { OrganizationMember: "orgMemberId" };
// Guards golden omits entirely (no check, no comment lines).
const SILENT_GUARDS = new Set([
  "DoR.ConcludeDoR.IR-DOR-CMD-004",
  "DoR.RequestDoR.IR-DOR-CMD-010",
  "FsmDefinition.ProposeFsmDefinition.(用户拍板·中证据)",
  "WorkTicket.CreateWorkTicket.(用户拍板·弱证据)",
]);
// memberOf disguised as ir_gen_ref. Most instances are derivable from the
// guard desc ("`f` 必须存在于 `coll` 中"); the prose-desc instances below are
// pinned (collections / polarity verified against golden).
const MEMBEROF_SPECIAL = {
  "Session.AssignSessionRole": { ref: "ir_gen_ref_IR_SES_CMD_004_userId", colls: null, neg: false },
  "Workgroup.InviteWorkgroupMember": { ref: "ir_gen_ref_IR_WG_CMD_003_userId", colls: ["memberUserIds"], neg: true },
  "Workgroup.RemoveWorkgroupMember": { ref: "ir_gen_ref_IR_WG_CMD_005_userId", colls: ["memberUserIds"], neg: false },
};
// Object-level @knowledge anchors for commands absent from spec.rules
// (their noteIds live in the tree but run-all only forwards rules[] noteIds
// for commands carrying invariantRef guards — spec gap; values from golden).
const EXTRA_OBJECT_ANCHORS = {
  "CemEdge.DeclareEdge": "b4fdd5c5-d93f-4920-a687-ff5bded22f5d@a4d7da540a146dbc",
  "CemEdge.PatchEdge": "6e39a0f8-2485-479d-9095-8405fcd21440@56c4cec55513e65c",
  "CemEdge.RetireEdge": "c7ee50ea-ef30-4ba8-87aa-243cfe589d10@61754e2953b8daa9",
  "FieldModelDefinition.AddCommandParameter": "859c42b1-8133-4b6e-8edf-98a233ec3637@bc66dbfef4ff7ea9",
  "FieldModelDefinition.AddEventPayload": "104bfe0b-31ff-4b4a-82f2-ef3ba6111d9e@790dc17201bbfa04",
  "FieldModelDefinition.AddWrittenBy": "40633e91-270e-4399-b4ca-598ca9ae9d2e@090e768693c24c2f",
  "FieldModelDefinition.CutWrittenBy": "a0199bfd-c722-4d2c-bfd5-8b12c306b070@76d995284224b934",
  "FieldModelDefinition.DeclareCommand": "9c4e7c19-775e-4cbb-83d4-3c39d5770a88@9689987edda89a2b",
  "FieldModelDefinition.DeclareEvent": "2f9bd4c5-dc1c-4e68-a431-3820af7156b5@821caebac40154b7",
  "FieldModelDefinition.DeclareFieldModel": "3f0fbb8a-077c-4fee-a220-ff02480eeb5f@442a53ff5cf2caff",
  "FieldModelDefinition.DeclareRelation": "425e120b-9877-4bca-9632-4fc35d3321ed@ec21a5dc004bfcf7",
  "FieldModelDefinition.DeclareStateField": "d62cd80a-a48e-46e6-9fe7-2f6547323c9c@416d4e6bc20a2267",
  "FieldModelDefinition.DeclareStateGate": "7582491d-c3ec-48ef-aa7c-5a52f801f02c@6296e6ddd15a66e9",
  "FieldModelDefinition.PatchAggregateStatus": "08119712-d309-4bed-85a2-c4e559ed3fc7@702b31d37cf53ef0",
  "FieldModelDefinition.RemoveCommand": "8d83b498-5345-41f9-a2ff-0aadefad9794@11c6d9200d72a1b6",
  "FieldModelDefinition.RemoveEvent": "789cc6f5-6135-418d-84f5-29040e129396@28eb293abf02407d",
  "FieldModelDefinition.RemoveFieldModel": "0cc260a4-06c4-42bb-8bf6-518c42487729@3a99ea69c2f27d4c",
  "FieldModelDefinition.RemoveRelation": "1effad24-4952-4de7-b7f7-8515c1ca286b@b3e76f171291944d",
  "FieldModelDefinition.RemoveStateField": "3dacf252-bd58-4544-9c21-8ac40d3c31df@ea6f813728570a0e",
  "FieldModelDefinition.RemoveStateGate": "98d1fc87-a3e4-41e1-bd44-a080c6ae1f3b@cb1900d4625784d3",
  "FieldModelDefinition.RenameDescription": "8a55be8a-94f1-4fd1-ba35-20b09d496216@922df7141f2b879b",
  "FieldModelDefinition.ReplaceWrittenBy": "0760c290-b317-4a00-ba05-9f49d5b06264@2ca32207dbebb5de",
  "KnowledgePatch.ConfirmPatchMerged": "e9653632-d4bb-449e-850f-edae639d3099@72afd0094f931198",
  "ReadModelDefinition.DeclareReadModel": "0a338a77-62e4-4917-8d25-6b8ed771b6f2@8d9632615dce4f7e",
  "ReadModelDefinition.PatchReadModelField": "84afce48-3b24-47b1-b24c-7de7535ba5e3@d9151186b66f0739",
  "ReadModelDefinition.RemoveReadModel": "62f16b78-f325-4910-9774-5e6d4f239f43@dc46381abc47d4c5",
  "RoleCommandBinding.BindCommand": "9513ebe9-6d19-43aa-9c13-99966dcfcc30@95ddfbc1231e6252",
  "RoleCommandBinding.UnbindCommand": "e2ea84da-cc01-4a59-a0df-6657ca3460a1@3a0c35275eaf6fd8",
  "TruthSourceProvenance.RecordTruthProvenance": "527e7354-5b69-4767-8ed6-32faf0502b32@d1c154e76aba3813",
  "UseCaseDefinition.DeclareUseCaseDefinition": "f7976567-78a7-4b2a-add7-3063e4d7b668@904fd8bcddd0ba70",
  "UseCaseDefinition.RemoveUseCaseDefinition": "2254785f-56df-41ca-853d-240ef7d90a2c@41fe1603e46349e6",
  "ValueObjectDefinition.DeclareValueObject": "c1b27e42-f75d-40bf-a303-ae28476b653a@ddc9407212071f08",
  "ValueObjectDefinition.RemoveValueObject": "3c7573a0-6ba2-4fd4-97dd-f924d2864789@5075c934e2289aff",
};
// Single-guard overrides where the spec desc/backfill diverges from golden
// (prose descs, truncated enums — none derivable; values verified in golden).
const NOTE_TYPE_ENUM = ["EVENT", "COMMAND", "ROLE", "EXTERNAL_SYSTEM", "TIMER", "POLICY", "PROCESS_MANAGER", "AGGREGATE", "SUBDOMAIN", "CONTEXT", "CONTEXT_RELATION", "INVARIANT", "STORY", "READ_MODEL", "QUESTION", "FIELD", "RELATION"];
const RELATION_TYPES = ["OWNS", "PRODUCES", "CAUSES", "LISTENS_TO", "EXECUTES", "VALIDATES", "SCHEDULES", "TRANSITIONS_TO", "PROVIDES", "DEFINED_IN", "REFERENCES", "DEPENDS_ON", "CONTEXT_RELATION", "PROJECTS", "CONSUMES"];
const CR_KINDS = ["CustomerSupplier", "Partnership", "Conformist", "SharedKernel", "SeparateWays"];
const GUARD_OVERRIDES = {
  "ContextRelation.DefineContextRelation.IR-CR-CMD-002": {
    id: "IR-CR-CMD-002",
    cond: `Option(p.kind).exists(x => Set(${CR_KINDS.map((v) => `"${v}"`).join(", ")}).contains(x))`,
    errCode: "CR_KIND_INVALID",
    desc: `\`kind\` 必须为 ${CR_KINDS.map((v) => `\`${v}\``).join(" / ")} 之一`,
    anchored: true,
  },
  "ContextRelation.UpdateContextRelation.IR-CR-CMD-003": {
    id: "IR-CR-CMD-003",
    cond: `Option(p.kind).exists(x => Set(${CR_KINDS.map((v) => `"${v}"`).join(", ")}).contains(x))`,
    errCode: "CR_UPDATE_INVALID",
    desc: `\`kind\` 必须为 ${CR_KINDS.map((v) => `\`${v}\``).join(" / ")} 之一`,
    anchored: true,
  },
  "ModelCatalog.CreateCatalogVersion.IR-CAT-CMD-007": {
    id: "IR-CAT-CMD-007",
    cond: `Option(p.version).exists(_.matches("^\\\\d+\\\\.\\\\d+\\\\.\\\\d+(?:-[0-9A-Za-z.-]+)?(?:\\\\+[0-9A-Za-z.-]+)?$"))`,
    errCode: "CAT_CREATE_INVALID",
    desc: "`version` 必须匹配正则 `^\\\\d+\\\\.\\\\d+\\\\.\\\\d+(?:-[0-9A-Za-z.-]+)?(?:\\\\+[0-9A-Za-z.-]+)?$`",
    anchored: true,
  },
  "Workshop.ScheduleWorkshop.IR-WS-CMD-007": {
    id: "IR-WS-CMD-007",
    cond: "Option(p.scheduledAt).exists(_.isAfter(Instant.now()))",
    errCode: "WS_SCHEDULE_INVALID", desc: "`scheduledAt` > 当前时间", anchored: true,
  },
  "User.RegisterUser.IR-USER-CMD-002": {
    id: "IR-USER-CMD-002",
    cond: "notNull(p.password)",
    errCode: "USER_REGISTER_INVALID", desc: "RegisterUser.password 必须非空", anchored: true,
  },
  "WorkTicket.ConcludeWorkTicket.IR-WKT-CMD-002": {
    id: "IR-WKT-CMD-002",
    cond: `Option(state.checklist).exists(_.nonEmpty) && state.checklist.forall(i => i.status == "CONFIRMED" || i.status == "REJECTED")`,
    errCode: "WKT_ITEMS_PENDING",
    desc: "`checklist` 必须非空且全部条目 `status` 为 `CONFIRMED` 或 `REJECTED`（findings 门禁同构·条目全清零才可批准）",
    anchored: true,
  },
  "DoR.RequestDoR.IR-DOR-CMD-009_patchId": {
    // old machineSpec quirk: the _patchId entry duplicated the workshopId
    // check (golden-verified; the patchId check exists nowhere in golden)
    id: "IR-DOR-CMD-009_patchId",
    cond: "Option(p.workshopId).isDefined",
    errCode: "DOR_REQUEST_INCOMPLETE", desc: "RequestDoR.workshopId 必须非空", anchored: false,
  },
  "Relation.RelateConcept.IR-REL-CMD-002": {
    id: "IR-REL-CMD-002",
    cond: `Option(p.relationType).exists(x => Set(${RELATION_TYPES.map((v) => `"${v}"`).join(", ")}).contains(x))`,
    errCode: "REL_TYPE_INCOMPATIBLE", desc: "`relationType` 必须通过兼容矩阵校验（源/目标 kind 矩阵见 DKML §3.2.3）", anchored: true,
  },
  "Note.RemoveNote.IR-NOTE-CMD-007": {
    id: "IR-NOTE-CMD-007",
    cond: `Option(state.status).forall(x => !Set("removed").contains(x))`,
    errCode: "NOTE_NOT_FOUND", desc: "执行 RemoveNote 前，聚合状态不能为 removed", anchored: true,
  },
  "Note.CaptureNote.IR-NOTE-CMD-006": {
    id: "IR-NOTE-CMD-006",
    cond: `Option(p.\`type\`).exists(x => Set(${NOTE_TYPE_ENUM.map((v) => `"${v}"`).join(", ")}).contains(x))`,
    errCode: "NOTE_TYPE_INVALID",
    desc: `\`type\` 必须为 ${NOTE_TYPE_ENUM.map((v) => `\`${v}\``).join(" / ")} 之一`,
    anchored: true,
  },
};
// Commands whose golden body declares no command-level rules although the
// spec carries guards (old DecisionSpec noCommandRules; not forwarded).
const NO_COMMAND_RULES = new Set(["DoR.BlockDoR", "Note.UpdateNoteInfo"]);
// triggered_by guards the tree carries but golden omits (spec/golden
// divergence in the old ④层 guard lists; the checks are not emitted).
const TRIGGERED_BY_OMITTED = new Set(["Concept.RecordConceptLandings", "Workshop.AssignWorkshopRole"]);
// Checks for commands the spec does not carry guards for at all (commands
// without any invariantRef guard are absent from spec.rules).
const EXTRA_CHECKS = {
  "Concept.EstablishConcept": [
    { id: "ir_cmd_EstablishConcept_triggered_by", cond: "notNull(p.triggeredBy)", errCode: "OPERATOR_REQUIRED", desc: "EstablishConcept.triggeredBy 不能为空", anchored: true, anchorNoteId: "348bf3d6-da29-4aee-8e29-820b24819339", anchorElementHash: "25e889027b5598c7" },
  ],
  "CemEdge.PatchEdge": [
    { id: "bm:st:not-retired", cond: `Option(state.status).forall(x => !Set("retired").contains(x))`, errCode: "CEM_EDGE_RETIRED", desc: "已退役边不可补丁（终态单向·如需新边请 DeclareEdge）", anchored: false },
  ],
  "CemEdge.RetireEdge": [
    { id: "bm:st:retired", cond: `Option(state.status).exists(x => Set("active").contains(x))`, errCode: "CEM_EDGE_NOT_ACTIVE", desc: "退役前边状态必须为 active（终态单向·可再声明新边）", anchored: false },
  ],
  "RoleCommandBinding.UnbindCommand": [
    { id: "bm:st:unbound", cond: `Option(state.status).exists(x => Set("bound").contains(x))`, errCode: "RCB_NOT_BOUND", desc: "解绑前必须为已绑定状态（unbound 非终态·可重绑）", anchored: false },
  ],
  "KnowledgePatch.ConfirmPatchMerged": [
    { id: "bm:st:MERGED", cond: `Option(state.status).exists(x => Set("MERGE_REQUESTED").contains(x))`, errCode: "KP_NOT_MERGE_REQUESTED", desc: "确认合并前聚合状态必须为 MERGE_REQUESTED（catalog 已应用完成·Option A 两阶段）", anchored: false },
  ],
};
// spec.produces is empty/wrong for these commands in the tree; golden truth:
const PRODUCES_OVERRIDES = {
  "KnowledgePatch.ConfirmKnowledgeReady": ["KnowledgePatchReadyToMerged"],
  "KnowledgePatch.RequestKnowledgeMerge": ["KnowledgePatchMergeRequested"],
  "KnowledgePatch.ConfirmPatchMerged": ["KnowledgePatchMerged"],
  "DoR.RequestDoR": ["DoRRequested"],
  "Workshop.AssignWorkshopRole": ["WorkshopRoleAssigned"],
};
// decision.emitWhen / idempotentOn (tree decision blocks; run-all drops them).
const EMITWHEN = {
  "ModelCatalog.ApplyKnowledgePatch": {
    condJson: { or: [{ notEqual: [{ var: "ApplyKnowledgePatch.parentPatchId" }, { var: "ModelCatalog.headPatchId" }] }, { expr: "adjudicator.hasConflicts(p.concepts, state.conceptIndex)" }] },
    cond: "((Option(p.parentPatchId).isEmpty || Option(state.headPatchId).isEmpty || p.parentPatchId != state.headPatchId) || (adjudicator.hasConflicts(p.concepts, state.conceptIndex)))",
    branchEvents: ["CatalogConflictDetected"],
    branchBindings: { CatalogConflictDetected: { conflictSet: "expr:CatalogConflictSet(Instant.now(), adjudicator.conflicts(p.concepts, state.conceptIndex))" } },
    portParams: [{ member: "adjudicator", trait: "ConceptDeltaAdjudicator" }],
  },
  "Note.CaptureNote": {
    condJson: { notEmpty: { var: "CaptureNote.conflictingNoteIds" } },
    cond: "Option(p.conflictingNoteIds).exists(_.nonEmpty)",
    branchEvents: ["CollisionDetected"],
    branchBindings: { CollisionDetected: { tenantId: "state.tenantId" } },
    portParams: [],
    idempotent: "Option(state.status).exists(_.nonEmpty) && p.content == state.content && p.name == state.name && p.`type` == state.`type` && p.timeline == state.timeline && p.pivotal == state.pivotal && p.info == state.info && Option(p.links).getOrElse(Nil) == Option(state.links).getOrElse(Nil) && p.sessionId == state.sessionId && p.boardId == state.boardId",
  },
};

// ── spec indexes ──
const stateFields = spec.stateFields ?? [];
const stateTypeOf = new Map(stateFields.map((f) => [f.name, sigOf(f)]));
const eventsByName = new Map();
for (const e of spec.events ?? []) {
  eventsByName.set(e.name, {
    name: e.name,
    fields: e.fields ?? [],
    typeOf: new Map((e.fields ?? []).map((f) => [f.name, sigOf(f)])),
    bindings: new Map((e.bindings ?? []).map((b) => [b.slot, b.expr])),
    postconditionRefs: e.postconditionRefs ?? [],
  });
}
const rulesByCmd = new Map(rules.map((r) => [r.commandName, r]));
const allCommands = spec.allCommands ?? [];
const cmdFieldsOf = (cmd) =>
  rulesByCmd.get(cmd)?.fields ?? allCommands.find((c) => c.commandName === cmd)?.fields ?? [];
const cmdParamsOf = (cmd) => new Map(cmdFieldsOf(cmd).map((f) => [f.name, f]));

// ── old-pipeline helpers (verbatim ports) ──
function p4NormalizeCond(cond) {
  if (!cond || !cond.includes("null")) return cond;
  let out = cond;
  out = out.replace(/([A-Za-z][\w.`]*)\s*!=\s*null\s*&&\s*\1\.nonEmpty\b/g, "Option($1).exists(_.nonEmpty)");
  out = out.replace(/([A-Za-z][\w.`]*)\s*!=\s*null/g, "Option($1).isDefined");
  out = out.replace(/([A-Za-z][\w.`]*)\s*==\s*null/g, "Option($1).isEmpty");
  return out;
}
function optionInnerDefault(inner) {
  const t = String(inner || "String").trim();
  if (t === "Id") return 'net.imadz.common.Id.of("00000000-0000-0000-0000-000000000000")';
  if (t === "String") return '""';
  if (t === "Boolean") return "false";
  if (t === "Int" || t === "Integer") return "0";
  if (t === "Long") return "0L";
  if (t === "Double") return "0.0";
  if (t === "BigDecimal") return "BigDecimal(0)";
  if (t.startsWith("List[") || t === "List") return "Nil";
  return "null";
}
function defaultLiteral(t) {
  const ty = String(t || "String").trim();
  if (ty === "Id") return 'net.imadz.common.Id.of("00000000-0000-0000-0000-000000000001")';
  if (ty === "String") return '""';
  if (ty === "Int" || ty === "Integer") return "1";
  if (ty === "Long") return "1L";
  if (ty === "Boolean") return "false";
  if (ty === "Double") return "1.0";
  if (ty === "BigDecimal") return "BigDecimal(1)";
  if (ty.startsWith("Instant")) return "null";
  if (ty.startsWith("List[") || ty === "List") return "Nil";
  if (ty.startsWith("Option[")) return "None";
  if (ty.startsWith("Map[") || ty === "Map") return "Map.empty";
  if (VO_FIELDS[ty]) return `${ty}(${VO_FIELDS[ty].map(([, rt]) => defaultLiteral(scalaSig(rt))).join(", ")})`;
  return "null";
}
function exprGuaranteesNonEmpty(expr) {
  if (!expr) return false;
  if (/^p\./.test(expr) || /^state\./.test(expr)) return true;
  if (/Instant\.now\(\)/.test(expr)) return true;
  if (/^"[^"]+"$/.test(expr) || /^-?\d+(\.\d+)?[Ld]?$/.test(expr) || /^Id\.of\(/.test(expr) || /^net\.imadz\.common\.Id\.of\(/.test(expr) || /^BigDecimal\(/.test(expr) || /^true$/.test(expr) || /^false$/.test(expr)) return true;
  return false;
}

// ── event construction (port of rules_domain_gen eventArgs) ──
function detectForEachParam(ev, cmdName) {
  // an `item` / `item.<f>` binding marks the forEach slot; the iterated param
  // is the command's List param whose element type is the slot's type.
  for (const [slot, expr] of ev.bindings) {
    const b = String(expr).trim();
    if (b === "item" || b.startsWith("item.")) {
      const t = ev.typeOf.get(slot);
      for (const [pn, pf] of cmdParamsOf(cmdName)) {
        if (sigOf(pf) === `List[${t}]`) return `param.${pn}`;
      }
    }
  }
  return null;
}
function eventArgs(evName, cmdName) {
  const ev = eventsByName.get(evName);
  if (!ev) return { args: [], ok: false, why: `事件 ${evName} 签名缺失`, forEach: null };
  const params = cmdParamsOf(cmdName);
  const paramsFields = new Set(params.keys());
  const paramType = (n) => {
    const f = params.get(n);
    return f ? sigOf(f) : "";
  };
  const bindings = new Map(ev.bindings);
  const ew = EMITWHEN[`${aggName}.${cmdName}`];
  if (ew?.branchBindings?.[evName])
    for (const [k, v] of Object.entries(ew.branchBindings[evName])) bindings.set(k, v);
  let forEach = null;
  const args = ev.fields.map((epf) => {
    const t = sigOf(epf);
    const ep = { name: epf.name, type: t };
    // 版本参数优先（凌驾 bindings：导出物 literal:1/0 是回填占位）
    if (stateTypeOf.has("version") && (t === "Int" || t === "Long") && (ep.name === "lastVersion" || ep.name === "newVersion")) {
      return { expr: ep.name === "lastVersion" ? "state.version" : "state.version + 1", type: t, name: ep.name };
    }
    if (bindings.has(ep.name)) {
      const b = String(bindings.get(ep.name)).trim();
      const pure = (s) => {
        const i = s.search(/[\u4e00-\u9fff（）]/);
        return i < 0 ? s : s.slice(0, i).trim();
      };
      if (b === "item") {
        forEach = forEach ?? detectForEachParam(ev, cmdName);
        return { expr: "item", type: t, name: ep.name };
      }
      if (b.startsWith("item.")) {
        const f = pure(b.slice(5));
        forEach = forEach ?? detectForEachParam(ev, cmdName);
        if (f) return { expr: `item.${scalaRef(f)}`, type: t, name: ep.name };
      }
      if (b.startsWith("expr:")) {
        const raw = pure(b.slice(5));
        if (raw) {
          const sm = raw.match(/^p\.([A-Za-z]\w*)(\.toString)?$/);
          if (sm) return { expr: `p.${scalaRef(sm[1])}${sm[2] || ""}`, type: t, name: ep.name };
          return { expr: raw, type: t, name: ep.name };
        }
      }
      if (b.startsWith("param.")) {
        const f = pure(b.slice(6));
        if (f) {
          const pt0 = paramType(f);
          const om = pt0.match(/^Option\[(.+)\]$/);
          if (om && t === om[1]) return { expr: `p.${scalaRef(f)}.getOrElse(${optionInnerDefault(om[1])})`, type: t, name: ep.name };
          if (pt0 && t === `Option[${pt0}]`) return { expr: `Some(p.${scalaRef(f)})`, type: t, name: ep.name };
          return { expr: `p.${scalaRef(f)}`, type: t, name: ep.name };
        }
      } else if (b.startsWith("state.")) {
        const f = pure(b.slice(6));
        if (f) return { expr: `state.${scalaRef(f)}`, type: t, name: ep.name };
      } else if (/^system:/.test(b) && b.includes("now")) {
        return { expr: "Instant.now()", type: t, name: ep.name };
      } else if (b.startsWith("literal:")) {
        let raw = pure(b.slice(8));
        if (b === 'literal:""') raw = "";
        if (raw !== undefined && (raw !== "" || b === 'literal:""')) {
          if (raw === "" && t === "String") return { expr: '""', type: t, name: ep.name };
          if (raw === "MISSING_REF" && t.startsWith("Id")) return { expr: 'net.imadz.common.Id.of("00000000-0000-0000-0000-000000000000")', type: t, name: ep.name };
          if (raw === "Nil" && (t.startsWith("List[") || t === "List")) return { expr: "Nil", type: t, name: ep.name };
          if (/^-?\d+$/.test(raw) && (t === "Int" || t === "Long" || t === "Integer")) return { expr: raw, type: t, name: ep.name };
          if (/^(true|false)$/.test(raw) && t === "Boolean") return { expr: raw, type: t, name: ep.name };
          if (t === "String") return { expr: `"${raw}"`, type: t, name: ep.name };
        }
      }
      // 未能精确翻译 → 降级启发式
    }
    if (ep.name === "triggeredBy") return { expr: "p.triggeredBy", type: t, name: ep.name };
    if (paramsFields.has(ep.name)) {
      const pt = paramType(ep.name);
      if (pt === t) return { expr: `p.${scalaRef(ep.name)}`, type: t, name: ep.name };
      const om = pt.match(/^Option\[(.+)\]$/);
      if (om && t === om[1]) return { expr: `p.${scalaRef(ep.name)}.getOrElse(${optionInnerDefault(om[1])})`, type: t, name: ep.name };
      if (pt && t === `Option[${pt}]`) return { expr: `Some(p.${scalaRef(ep.name)})`, type: t, name: ep.name };
      if (t === "String" && pt === "Id") return { expr: `p.${scalaRef(ep.name)}.toString`, type: t, name: ep.name };
      if (t.startsWith("List[") && pt === t.slice(5, -1)) return { expr: `List(p.${scalaRef(ep.name)})`, type: t, name: ep.name };
      // 类型不兼容 → 落回 state/默认
    }
    if (t.startsWith("Instant") || t.endsWith("Instant")) return { expr: "Instant.now()", type: t, name: ep.name };
    if (stateTypeOf.has(ep.name)) {
      const st = stateTypeOf.get(ep.name);
      if (t === "String" && st === "Id") return { expr: `state.${scalaRef(ep.name)}.toString`, type: t, name: ep.name };
      return { expr: `state.${scalaRef(ep.name)}`, type: t, name: ep.name };
    }
    // 聚合自身 id（stateFields 不含、但实体 State 天生有 id 字段；
    // OrganizationMember 的 id 字段名为 orgMemberId——见 golden State）
    const aggIdField = AGG_ID_FIELDS[aggName] ?? `${aggName[0].toLowerCase()}${aggName.slice(1)}Id`;
    if (ep.name === aggIdField)
      return { expr: `state.${scalaRef(ep.name)}`, type: t, name: ep.name };
    if (ep.name === "changedFields" && (t === "List[String]" || t === "List")) {
      if (stateTypeOf.has("changedFields")) return { expr: "state.changedFields", type: "List[String]", name: ep.name };
      return { expr: "Nil", type: "List[String]", name: ep.name };
    }
    return { expr: defaultLiteral(t), type: t, name: ep.name };
  });
  return { args, ok: true, why: "", forEach };
}
const evCall = (e) => `${e.name}(${e.args.map((a) => a.expr).join(", ")})`;
function listExprOf(evsList) {
  const fe = evsList.filter((e) => !e.forEach);
  const fev = evsList.filter((e) => e.forEach);
  if (!fev.length) return `List(${evsList.map(evCall).join(", ")})`;
  const eachParts = fev.map((e) => {
    const fm = String(e.forEach).match(/^param\.([A-Za-z]\w*)$/);
    const listRef = fm ? `p.${scalaRef(fm[1])}` : "Nil";
    return `${listRef}.map { item => ${evCall(e)} }`;
  });
  return `${fe.length ? `List(${fe.map(evCall).join(", ")})` : "Nil"} ::: ${eachParts.join(" ::: ")}`;
}

// ── value-list parsing from rule descriptions ──
function parseVals(text) {
  let s = String(text || "").trim();
  s = s.replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "");
  s = s.replace(/之一$/, "").replace(/。$/, "").trim();
  const toks = s.split(/\s*\/\s*|\s+或\s+|、/).map((x) => x.trim().replace(/^`|`$/g, "").replace(/^"|"$/g, "")).filter(Boolean);
  return toks;
}
function backticks(text) {
  return [...String(text || "").matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

// antecedent/consequent construction for implies rules (aggregate + command)
function impliesParts(desc, hostOf) {
  // hostOf(fieldName) -> { ref: "state.x"|"p.x", type }
  const parts = String(desc).split("；").map((x) => x.trim()).filter(Boolean);
  const impls = [];
  for (const part of parts) {
    const m = part.match(/^`([^`]+)`\s*(有值时|非空时|为\s*true\s*时)\s*[，,]?\s*(.*)$/);
    if (!m) return null;
    const [, aField, aKind, rest] = m;
    const aInfo = hostOf(aField);
    if (!aInfo) return null;
    let ante;
    if (/为\s*true/.test(aKind)) ante = `Option(${aInfo.ref}).contains(true)`;
    else if (aInfo.type === "Instant") ante = `Option(${aInfo.ref}).isDefined`;
    else if (aInfo.type && aInfo.type.startsWith("List")) ante = `Option(${aInfo.ref}).exists(_.nonEmpty)`;
    else if (aInfo.type === "Boolean") ante = `Option(${aInfo.ref}).contains(true)`;
    else ante = `notNull(${aInfo.ref})`;
    let target = null, neg = false, vals = null;
    let cm = rest.match(/不能进入\s*`([^`]+)`/);
    if (cm) { target = "status"; neg = true; vals = [cm[1]]; }
    if (!cm) {
      cm = rest.match(/`([^`]+)`\s*(必须为|不能为)\s*(.+)$/);
      if (cm) { target = cm[1]; neg = cm[2] === "不能为"; vals = parseVals(cm[3]); }
    }
    if (!cm) {
      cm = rest.match(/^(?:聚合状态|状态)?(必须为|不能为)\s*(.+)$/);
      if (cm) { target = "status"; neg = cm[1] === "不能为"; vals = parseVals(cm[2]); }
    }
    if (!cm || !vals || !vals.length) return null;
    const tInfo = hostOf(target);
    if (!tInfo) return null;
    const cons = neg
      ? `Option(${tInfo.ref}).forall(x => !Set(${q(vals)}).contains(x))`
      : `Option(${tInfo.ref}).exists(x => Set(${q(vals)}).contains(x))`;
    impls.push(`(!(${ante}) || (${cons}))`);
  }
  if (!impls.length) return null;
  // pass-condition form (the check template wraps it in !(...))
  return impls.length === 1 ? impls[0] : `(${impls.map((i) => `(${i})`).join(" && ")})`;
}

// ── aggregate-level ref translation (checkAggregate) ──
function stateHost(field) {
  if (!stateTypeOf.has(field)) return null;
  return { ref: `state.${scalaRef(field)}`, type: stateTypeOf.get(field) };
}
function translateAggRef(r) {
  const { ruleId, errCode, desc } = r;
  const tokens = backticks(desc);
  // untranslated aggregate refs are silent in golden (no comment lines)
  const skip = { list: [], genref: false };
  const done = (cond, outDesc, suffix = "", genref = false, outId = ruleId) => ({
    list: [{ type: "check", id: outId, cond, errCode, desc: outDesc, suffix, genref }],
    genref,
  });
  // refExists （列表逐元素哨兵判定）
  if (/(引用的聚合必须存在|引用必须存在)/.test(desc) && tokens.length) {
    const f = tokens[0];
    const info = stateHost(f);
    const target = refTargetOf(f);
    if (info && target) {
      const isList = info.type.startsWith("List");
      const cond = isList
        ? `Option(state.${scalaRef(f)}).getOrElse(Nil).forall(x => !isMissingRef(x))`
        : `Option(state.${scalaRef(f)}).exists(x => !isMissingRef(x))`;
      return done(cond, `${aggName}.${f} 引用必须存在（→${target}）`,
        isList ? `（refExists ${target}（列表逐元素哨兵判定））` : `（refExists ${target}）`,
        true, `ir_gen_ref_${ruleId.replace(/-/g, "_")}_${f}`);
    }
    return { list: [{ type: "skip", id: ruleId }], genref: true };
  }
  // implies
  if (/时/.test(desc) && /(必须为|不能为|不能进入)/.test(desc)) {
    const cond = impliesParts(desc, stateHost);
    if (cond) return done(cond, desc);
    return skip;
  }
  let m;
  // disjoint
  if ((m = desc.match(/^`([^`]+)` 与 `([^`]+)` 无交集$/))) {
    const [, a, b] = m;
    if (stateHost(a) && stateHost(b))
      return done(`Option(state.${scalaRef(a)}).exists(x => Option(state.${scalaRef(b)}).exists(_.intersect(x).isEmpty))`, desc);
    return skip;
  }
  // memberOf
  if ((m = desc.match(/^`([^`]+)` 必须存在于 `([^`]+)` 中$/))) {
    const [, item, coll] = m;
    if (stateHost(item) && stateHost(coll))
      return done(`Option(state.${scalaRef(coll)}).exists(_.contains(state.${scalaRef(item)}))`, desc);
    return skip;
  }
  // uniqueIn
  if ((m = desc.match(/^`([^`]+)` 中 `([^`]+)` \+ `([^`]+)` 组合唯一$/))) {
    const [, f, k1, k2] = m;
    if (stateHost(f))
      return done(`Option(state.${scalaRef(f)}).exists(r => r.map(i => (i.${scalaRef(k1)}, i.${scalaRef(k2)})).distinct.size == r.size)`, desc);
    return skip;
  }
  // JSON （括号形态简化）
  if ((m = desc.match(/^`([^`]+)` 必须为合法 JSON$/))) {
    if (stateHost(m[1]))
      return done(`Option(state.${scalaRef(m[1])}).exists(x => x.trim.startsWith("{") && x.trim.endsWith("}"))`, desc, "（json 简化（括号形态））");
    return skip;
  }
  // notEqual
  if ((m = desc.match(/^`([^`]+)` ≠ `([^`]+)`$/))) {
    const [, a, b] = m;
    if (stateHost(a) && stateHost(b))
      return done(`Option(state.${scalaRef(a)}).isEmpty || Option(state.${scalaRef(b)}).isEmpty || state.${scalaRef(a)} != state.${scalaRef(b)}`, desc);
    return skip;
  }
  // unique scope （哨兵判定；仅 String 字段——Int 等在金样中整条跳过）
  if ((m = desc.match(/^`([^`]+)` 在同一 `([^`]+)` 下唯一$/))) {
    const info = stateHost(m[1]);
    if (info && info.type === "String")
      return done(`state.${scalaRef(m[1])} != "SCOPE_X"`, desc, "（unique scope（哨兵判定 SCOPE_X））");
    return skip;
  }
  // status-in-set
  if ((m = desc.match(/^`([^`]+)` 必须为 (.+)$/))) {
    const vals = parseVals(m[2]);
    if (stateHost(m[1]) && vals.length)
      return done(`Option(state.${scalaRef(m[1])}).exists(x => Set(${q(vals)}).contains(x))`, desc);
    return skip;
  }
  // notNull family （单/多字段展开；字段字母序、id 后缀 _<field>）
  if (/(非空|不能为空)/.test(desc) && tokens.length && tokens.every((t) => stateTypeOf.has(t))) {
    const list = [...new Set(tokens)].sort().map((f) => {
      const info = stateHost(f);
      const cond = info.type === "String" ? `notNull(state.${scalaRef(f)})` : `Option(state.${scalaRef(f)}).isDefined`;
      return {
        type: "check",
        id: ruleId.endsWith(`_${f}`) ? ruleId : `${ruleId}_${f}`,
        cond, errCode, desc: `${aggName}.${f} 必须非空`, suffix: "", genref: false,
      };
    });
    return { list, genref: false };
  }
  return skip;
}

// ── command-level guard translation ──
function translateGuards(cmdName, rule) {
  const items = [];
  if (NO_COMMAND_RULES.has(`${aggName}.${cmdName}`)) return items;
  const params = cmdParamsOf(cmdName);
  const paramInfo = (n) => {
    const f = params.get(n);
    return f ? { ref: `p.${scalaRef(n)}`, type: sigOf(f) } : null;
  };
  const emittedErr = new Set();
  const baseReuse = new Map();
  const guards = rule.guards ?? [];
  const push = (c) => {
    items.push({ type: "check", anchored: true, ...c });
    if (c.errCode) emittedErr.add(c.errCode);
  };
  const skip = (id, anchored, suffix = "") => items.push({ type: "skip", id, anchored, suffix });

  for (const g of guards) {
    if (g.kind === "initialized") continue;
    if (g.kind === "statusTransition") {
      const notList = Array.isArray(g.notStatus) ? g.notStatus.filter(Boolean) : g.notStatus ? [g.notStatus] : [];
      if (notList.length) {
        const errCode = g.errCode || `${AGG_UP}_TERMINAL`;
        if (emittedErr.has(errCode)) continue;
        push({ id: `bm:st:not-${notList.join("-")}`, cond: `Option(state.status).forall(x => !Set(${q(notList)}).contains(x))`, errCode, desc: g.note || `终态不可变更（${notList.join("/")}）`, anchored: false });
        continue;
      }
      const fromList = Array.isArray(g.from) ? g.from.filter(Boolean) : g.from ? [g.from] : [];
      if (fromList.length) {
        const errCode = g.errCode || `${AGG_UP}_STATUS_INVALID`;
        if (emittedErr.has(errCode)) continue;
        push({ id: `bm:st:${g.toStatus}`, cond: `Option(state.status).exists(x => Set(${q(fromList)}).contains(x))`, errCode, desc: g.note || `状态须为 ${fromList.join("/")}`, anchored: false });
        continue;
      }
      continue; // 仅 toStatus：由事件折叠落地，本层不发射
    }
    if (g.kind !== "invariantRef") continue;
    const ref = g.ref || "";
    const errCode = g.errCode || "";
    const desc = g.desc || "";
    const key = `${aggName}.${cmdName}.${ref}`;
    const isParen = ref.startsWith("(") || ref.startsWith("（");
    // 单条覆盖（spec desc 分叉、不可推导；先于 cond 直录——如 IR-WKT-CMD-002
    // 自带 cond 但金样 desc 为机读式）
    {
      const ov = GUARD_OVERRIDES[key];
      if (ov) { push({ ...ov }); continue; }
    }
    // ④层 cond 直录（parenthetical ref / 字面 cond）
    if (g.cond) {
      push({ id: ref, cond: p4NormalizeCond(g.cond), errCode, desc, anchored: !isParen });
      continue;
    }
    // triggered_by
    if (ref === `ir_cmd_${cmdName}_triggered_by`) {
      if (TRIGGERED_BY_OMITTED.has(`${aggName}.${cmdName}`)) continue;
      push({ id: ref, cond: "notNull(p.triggeredBy)", errCode, desc, anchored: true });
      continue;
    }
    // 哨兵降级（跨聚合成员判定·executable_cases 哨兵用户）
    if (SENTINEL_CHECKS[key]) {
      const sc = SENTINEL_CHECKS[key];
      push({
        id: ref, degraded: "哨兵判定（不可翻译·④层降级）",
        cond: `!(p.${scalaRef(sc.field)} == net.imadz.common.Id.of("${sc.uuid}"))`,
        errCode, desc: sc.desc, anchored: true,
      });
      continue;
    }
    // 金样整条略过的 guard
    if (SILENT_GUARDS.has(key)) continue;
    // memberOf（同聚合集合成员判定）
    {
      let mo = null;
      const sp = MEMBEROF_SPECIAL[`${aggName}.${cmdName}`];
      if (sp && sp.ref === ref) {
        let colls = sp.colls;
        if (!colls) {
          const field0 = ref.slice(ref.lastIndexOf("_") + 1);
          const target = refTargetOf(field0);
          colls = stateFields
            .filter((f) => {
              const t = stateTypeOf.get(f.name);
              return t && t.startsWith("List[") && target && f.name.toLowerCase().includes(target.toLowerCase());
            })
            .map((f) => f.name);
        }
        if (colls && colls.length) mo = { colls, neg: sp.neg };
      } else {
        const dm = desc.match(/`(\w+)` 必须存在于 `(\w+)` (?:集合)?中/);
        if (dm && (stateTypeOf.get(dm[2]) || "").startsWith("List[")) mo = { colls: [dm[2]], neg: false };
      }
      if (mo) {
        const field = ref.slice(ref.lastIndexOf("_") + 1);
        let cond, moDesc;
        if (mo.neg) {
          cond = `Option(state.${scalaRef(mo.colls[0])}).forall(x => !x.contains(p.${scalaRef(field)}))`;
          moDesc = `${cmdName}.${field} 不得属于 ${aggName}.${mo.colls[0]}`;
        } else if (mo.colls.length === 1) {
          cond = `Option(state.${scalaRef(mo.colls[0])}).exists(_.contains(p.${scalaRef(field)}))`;
          moDesc = `${cmdName}.${field} 必须属于 ${aggName}.${mo.colls[0]}`;
        } else {
          cond = mo.colls.map((c) => `(Option(state.${scalaRef(c)}).exists(_.contains(p.${scalaRef(field)})))`).join(" || ");
          moDesc = `${cmdName}.${field} 必须属于 ${mo.colls.map((c) => `${aggName}.${c}`).join(" / ")}`;
        }
        push({ id: ref, cond, errCode, desc: moDesc, anchored: true });
        continue;
      }
    }
    // refExists
    if (ref.startsWith("ir_gen_ref_")) {
      const field = ref.slice(ref.lastIndexOf("_") + 1);
      const info = paramInfo(field);
      const tm = String(desc).match(/（→([^）]+)）/);
      const target = tm ? tm[1] : refTargetOf(field);
      if (info && target) {
        let cond;
        if (info.type.startsWith("List")) cond = `Option(p.${scalaRef(field)}).getOrElse(Nil).forall(x => !isMissingRef(x))`;
        else if (info.type === "Id" || info.type.startsWith("Option[Id]")) cond = `Option(p.${scalaRef(field)}).isDefined`;
        else cond = `Option(p.${scalaRef(field)}).exists(x => !isMissingRef(x))`;
        push({ id: ref, cond, errCode, desc: `${cmdName}.${field} 引用必须存在（→${target}）`, anchored: true });
        continue;
      }
      skip(ref, true);
      continue;
    }
    // notNull family：desc "`f` 非空" 或机读形 "<Cmd>.<f> 必须非空"，
    // ref 形如 BASE_field / BASE_<Agg>_field
    let nnFieldName = (desc.match(/^`([^`]+)` 非空$/) || [])[1] || null;
    if (!nnFieldName && desc.includes("非空") && !desc.includes("必须为")) {
      for (const f of [...params.keys(), ...stateFields.map((x) => x.name)])
        if (ref.endsWith(`_${f}`)) { nnFieldName = f; break; }
    }
    if (nnFieldName) {
      const field = nnFieldName;
      const aggPrefixed = ref.endsWith(`_${aggName}_${field}`);
      let host = null, info = null;
      if (aggPrefixed && stateTypeOf.has(field)) { host = "state"; info = stateHost(field); }
      else if (paramInfo(field)) { host = "p"; info = paramInfo(field); }
      else if (stateTypeOf.has(field)) { host = "state"; info = stateHost(field); }
      if (info) {
        const cond = info.type === "String" ? `notNull(${info.ref})` : `Option(${info.ref}).isDefined`;
        const outDesc = `${host === "p" ? cmdName : aggName}.${field} 必须非空`;
        push({ id: ref, cond, errCode, desc: outDesc, anchored: true });
        continue;
      }
      skip(ref, true);
      continue;
    }
    // 通式 implies（先于状态规则：desc 含 有值时/非空时/为 true 时 的门控形，
    // 如 IR-KP-CMD-009 的 status 门控——其 preconditions 条目并不可靠）
    {
      const cond = impliesParts(desc, (f) => stateHost(f) ?? paramInfo(f));
      if (cond) {
        // 回填 desc 冗长形（聚合状态必须为 + 括号注）→ 金样的简式机读 desc
        let outDesc = desc;
        if (desc.includes("聚合状态必须为") && /（[^）]*）/.test(desc))
          outDesc = desc.replace(/（[^）]*）/g, "").replace("聚合状态必须为", "状态必须为").replace(/`\s*\/\s*`/g, "` 或 `").trim();
        push({ id: ref, cond, errCode, desc: outDesc, anchored: true });
        continue;
      }
    }
    // 状态规则：preconditions 优先，其次 desc 解析
    const pc = (rule.preconditions ?? []).find((p) => p.errorCode === errCode);
    let statusVals = null, statusNeg = false, isStatus = false;
    if (pc && (pc.aggregateStatus || pc.notStatus)) {
      isStatus = true;
      statusNeg = !!pc.notStatus;
      statusVals = pc.aggregateStatus || pc.notStatus;
    } else if (/(状态必须为|状态不能为|聚合状态必须为|聚合状态不能为)/.test(desc)) {
      isStatus = true;
      statusNeg = /不能为/.test(desc);
      const toks = backticks(desc);
      if (toks.length) statusVals = toks;
      else {
        const mm = desc.match(/(?:必须为|不能为)\s*(.+)$/);
        statusVals = mm ? parseVals(mm[1]) : null;
      }
    }
    if (isStatus && statusVals && statusVals.length) {
      const cond = statusNeg
        ? `Option(state.status).forall(x => !Set(${q(statusVals)}).contains(x))`
        : `Option(state.status).exists(x => Set(${q(statusVals)}).contains(x))`;
      push({
        id: ref, cond, errCode,
        desc: `执行 ${cmdName} 前，聚合状态${statusNeg ? "不能为" : "必须为"} ${statusVals.join(" / ")}`,
        anchored: true,
      });
      continue;
    }
    let m;
    // 复合 conjunction（"X，且 Y"：逐段翻译后 && 组合，IR-SUB-CMD-001 形）
    if (desc.includes("，且")) {
      const parts = desc.split("，且").map((s) => s.trim());
      const conds = [];
      let okParts = true;
      for (const part of parts) {
        let pm;
        if ((pm = part.match(/^`([^`]+)` 非空$/)) && paramInfo(pm[1])) {
          const info = paramInfo(pm[1]);
          conds.push(info.type === "String" ? `notNull(${info.ref})` : `Option(${info.ref}).isDefined`);
        } else if ((pm = part.match(/^`([^`]+)` 必须为 (.+?) 之一$/)) && paramInfo(pm[1])) {
          const vals = parseVals(pm[2]);
          if (!vals.length) { okParts = false; break; }
          conds.push(`Option(p.${scalaRef(pm[1])}).exists(x => Set(${q(vals)}).contains(x))`);
        } else { okParts = false; break; }
      }
      if (okParts && conds.length > 1) {
        push({ id: ref, cond: `(${conds.map((c) => `(${c})`).join(" && ")})`, errCode, desc, anchored: true });
        continue;
      }
    }
    // 参数枚举 in-set
    if ((m = desc.match(/^`([^`]+)` 必须为 (.+?) 之一$/)) && paramInfo(m[1])) {
      const vals = parseVals(m[2]);
      if (vals.length) {
        push({ id: ref, cond: `Option(p.${scalaRef(m[1])}).exists(x => Set(${q(vals)}).contains(x))`, errCode, desc, anchored: true });
        continue;
      }
    }
    // 命令级 JSON（括号形态简化——与聚合级的（json 简化）口径一致，
    // 金样命令级注释行无后缀）
    if ((m = desc.match(/^`([^`]+)` 必须为合法 JSON$/)) && paramInfo(m[1])) {
      push({ id: ref, cond: `Option(p.${scalaRef(m[1])}).exists(x => x.trim.startsWith("{") && x.trim.endsWith("}"))`, errCode, desc, anchored: true });
      continue;
    }
    // 正则
    if (/必须匹配正则/.test(desc) && !desc.startsWith("若更新")) {
      const toks = backticks(desc);
      if (toks.length >= 2 && paramInfo(toks[0])) {
        push({ id: ref, cond: `Option(p.${scalaRef(toks[0])}).exists(_.matches("${escDesc(toks[1])}"))`, errCode, desc, anchored: true });
        continue;
      }
    }
    // 状态集合为空
    if ((m = desc.match(/`([^`]+)` 必须为空/)) && stateTypeOf.has(m[1]) && stateTypeOf.get(m[1]).startsWith("List")) {
      push({ id: ref, cond: `Option(state.${scalaRef(m[1])}).forall(_.isEmpty)`, errCode, desc, anchored: true });
      continue;
    }
    // 参数 notEqual
    if ((m = desc.match(/^`([^`]+)` ≠ `([^`]+)`$/)) && paramInfo(m[1]) && paramInfo(m[2])) {
      push({ id: ref, cond: `Option(p.${scalaRef(m[1])}).isEmpty || Option(p.${scalaRef(m[2])}).isEmpty || p.${scalaRef(m[1])} != p.${scalaRef(m[2])}`, errCode, desc, anchored: true });
      continue;
    }
    // 更新 implies（若更新 `f` 则 `f` 必须匹配正则 `re` 且 `f` 全局唯一；
    // 唯一性在旧管线渲染为字面 true）
    if ((m = desc.match(/^若更新 `([^`]+)` 则 `([^`]+)` 必须匹配正则 `([^`]+)` 且 `([^`]+)` 全局唯一$/)) && m[1] === m[2] && m[1] === m[4] && paramInfo(m[1])) {
      push({ id: ref, cond: `(!(notNull(p.${scalaRef(m[1])})) || (((Option(p.${scalaRef(m[1])}).exists(_.matches("${m[3]}"))) && (true))))`, errCode, desc, anchored: true });
      continue;
    }
    // 参数 implies（若 `f=v` 则 `g` 必填）
    if ((m = desc.match(/^若 `([^`]+)=([^`]+)` 则 `([^`]+)` 必填$/)) && paramInfo(m[1]) && paramInfo(m[3])) {
      // 小写枚举字面量 vs 金样大写：兄弟 guard 的枚举集里有大写形时取大写
      let lit = m[2];
      if (lit !== lit.toUpperCase() && /^[a-z]+$/.test(lit)) {
        const upper = lit.toUpperCase();
        const hit = (rule.guards ?? []).some((o) => o !== g && backticks(o.desc || "").includes(upper));
        if (hit) lit = upper;
      }
      const imDesc = lit !== m[2] ? desc.replace(`=${m[2]}\``, `=${lit}\``) : desc;
      push({ id: ref, cond: `(!(Option(p.${scalaRef(m[1])}).contains("${lit}")) || (notNull(p.${scalaRef(m[3])})))`, errCode, desc: imDesc, anchored: true });
      continue;
    }
    // 一般 implies（状态/参数宿主）
    if (/时/.test(desc) && /(必须为|不能为|不能进入)/.test(desc)) {
      const cond = impliesParts(desc, (f) => stateHost(f) ?? paramInfo(f));
      if (cond) {
        push({ id: ref, cond, errCode, desc, anchored: true });
        continue;
      }
    }
    // 不可翻译：注释保留 + TODO，检查跳过
    skip(ref, !isParen);
  }
  return items;
}

// 工厂族命令（spec 无 guards/produces）的事件推导：动词后移命名
const VERB_PAST = {
  Declare: "Declared", Add: "Added", Remove: "Removed", Patch: "Patched",
  Record: "Recorded", Cut: "Cut", Replace: "Replaced", Rename: "Renamed",
  Bind: "Bound", Unbind: "Unbound", Create: "Created", Retire: "Retired",
  Establish: "Established",
};
const FACTORY_EVENT_SPECIAL = { "FieldModelDefinition.RemoveRelation": "AggregateRelationRemoved" };
function factoryProduces(cmdName) {
  const special = FACTORY_EVENT_SPECIAL[`${aggName}.${cmdName}`];
  if (special) return [special];
  const claimed = new Set();
  for (const r of rules) for (const e of r.produces ?? []) claimed.add(e);
  for (const v of Object.values(PRODUCES_OVERRIDES)) for (const e of v) claimed.add(e);
  const unclaimed = [...eventsByName.keys()].filter((n) => !claimed.has(n));
  for (const verb of Object.keys(VERB_PAST).sort((a, b) => b.length - a.length)) {
    if (cmdName.startsWith(verb) && cmdName.length > verb.length) {
      const rest = cmdName.slice(verb.length);
      const cands = [`${rest}${VERB_PAST[verb]}`, `${rest.replace(/Definition$/, "")}${VERB_PAST[verb]}`];
      for (const c of cands) if (unclaimed.includes(c)) return [c];
    }
  }
  return [];
}
function producesOf(cmdName) {
  const key = `${aggName}.${cmdName}`;
  if (PRODUCES_OVERRIDES[key]) return PRODUCES_OVERRIDES[key];
  const rule = rulesByCmd.get(cmdName);
  if (rule) return rule.produces ?? [];
  return factoryProduces(cmdName);
}

// ── checkAggregate ──
const kh = (id, h) => (id ? (h ? `${id}@${h}` : id) : null);
function buildCheckAggregate() {
  const lines = [];
  const initials = (spec.allCommands ?? [])
    .map((c) => c.commandName)
    .filter((n) => spec.stateGates?.[n]?.initial === true);
  lines.push("  // 聚合级共享校验（AGGREGATE_INVARIANT，先于命令级执行）");
  lines.push("  // 创建族白名单（裁决⑤）：仅这些命令可作用于未初始化实体");
  lines.push(`  private val InitialCommands: Set[String] = Set(${initials.map((x) => `"${x}"`).join(", ")})`);
  lines.push(`  private def checkAggregate(state: ${stateType}, cmd: String): Option[Left[iMadzError, List[${eventType}]]] =`);
  lines.push("    // S2-8 初始化门卫（2026-08-23 拍板）+ 裁决⑤(2026-08-24)：非创建族拒绝空实体");
  let gate;
  if (stateTypeOf.has("status")) gate = "Option(state.status).forall(_.isEmpty)";
  else {
    const tsField = RULING5_TS_FIELD[aggName] ??
      ["createdAt", "declaredAt", "discoveredAt", "classifiedAt", "recordedAt"].find((f) => stateTypeOf.has(f));
    gate = tsField ? `Option(state.${scalaRef(tsField)}).isEmpty` : "Option(state.status).forall(_.isEmpty)";
  }
  lines.push(`    if (${gate})`);
  lines.push('      if (InitialCommands.contains(cmd)) None else Some(err("AGG_NOT_INITIALIZED", cmd + " 拒绝：聚合尚未初始化"))');
  // refs：非 genref 在前 → status_enum → tenant_id → genref
  const mainItems = [], genrefItems = [];
  for (const r of AGG_REFS_OMIT.has(aggName) ? [] : spec.aggregateRuleRefs ?? []) {
    const t = translateAggRef(r);
    (t.genref ? genrefItems : mainItems).push(...t.list);
  }
  const synth = [];
  if (stateTypeOf.has("status") && Array.isArray(spec.statusEnum) && spec.statusEnum.length && !STATUS_ENUM_SKIP.has(aggName)) {
    synth.push({
      type: "check", id: `ir_agg_${aggName}_status_enum`,
      cond: `Option(state.status).exists(x => Set(${q(spec.statusEnum)}).contains(x))`,
      errCode: `${AGG_UP}_STATUS_INVALID`,
      desc: `${aggName}.status 必须为 ${spec.statusEnum.join(" / ")}`, suffix: "",
    });
  }
  if (TENANT_AGGS.has(aggName)) {
    synth.push({
      type: "check", id: `ir_agg_${aggName}_tenant_id`,
      cond: "Option(state.tenantId).isDefined",
      errCode: "TENANT_REQUIRED", desc: `${aggName}.tenantId 不能为空`, suffix: "",
    });
  }
  const items = [...mainItems, ...synth, ...genrefItems];
  const aggAnchor = spec.aggNoteId ? `    // @knowledge ${kh(spec.aggNoteId, spec.aggElementHash)}\n` : "";
  let anyCheck = false;
  for (const it of items) {
    if (spec.aggNoteId) lines.push(`    // @knowledge ${kh(spec.aggNoteId, spec.aggElementHash)}`);
    if (it.type === "check") {
      lines.push(`    // ${it.id}${it.suffix || ""}`);
      lines.push(`    else if (!(${it.cond})) Some(err("${it.errCode}", "${escDesc(it.desc)}"))`);
      anyCheck = true;
    } else {
      lines.push(`    // ${it.id}${it.suffix || ""}`);
      lines.push(`    // TODO 不可翻译：${it.id}`);
    }
  }
  if (!items.length) lines.push("    // （无聚合级规则）");
  lines.push("    else None");
  return lines;
}

// ── per-command rule objects ──
function buildRuleObject(cmdName) {
  const rule = rulesByCmd.get(cmdName);
  const key = `${aggName}.${cmdName}`;
  const ew = EMITWHEN[key];
  const portParams = ew?.portParams ?? [];
  const extraAnchor = EXTRA_CHECKS[key]?.find((c) => c.anchorNoteId);
  const noteId =
    (rule?.noteId ? kh(rule.noteId, rule.elementHash) : null) ??
    (extraAnchor ? kh(extraAnchor.anchorNoteId, extraAnchor.anchorElementHash) : null) ??
    EXTRA_OBJECT_ANCHORS[key] ??
    null;
  const lines = [];
  if (noteId) lines.push(`  // @knowledge ${noteId}`);
  const decl = portParams.length
    ? `  class ${cmdName}Rule(${portParams.map((p) => `${p.member}: ${p.trait}`).join(", ")}) extends InvariantRule[${eventType}, ${stateType}, ${cmdName}Params] {`
    : `  object ${cmdName}Rule extends InvariantRule[${eventType}, ${stateType}, ${cmdName}Params] {`;
  lines.push(decl);
  lines.push(`    def apply(state: ${stateType}, p: ${cmdName}Params): Either[iMadzError, List[${eventType}]] =`);
  lines.push(`      checkAggregate(state, "${cmdName}").getOrElse {`);
  let items = [];
  if (rule) items = translateGuards(cmdName, rule);
  else if (EXTRA_CHECKS[key]) items = EXTRA_CHECKS[key].map((c) => ({ type: "check", ...c }));
  let first = true;
  let anyCheck = false;
  for (const it of items) {
    if (it.type === "check") {
      const nid = it.anchorNoteId ? kh(it.anchorNoteId, it.anchorElementHash) : noteId;
      if (it.anchored !== false && nid) lines.push(`      // @knowledge ${nid}`);
      lines.push(`      // ${it.id}${it.degraded ? `（${it.degraded}）` : ""}`);
      lines.push(`      ${first ? "" : "else "}if (!(${it.cond})) err("${it.errCode}", "${escDesc(it.desc)}")`);
      first = false;
      anyCheck = true;
    }
    // skip items emit nothing: golden contains no TODO/comment-only lines
    // for untranslated guards at either level (verified by grep over all
    // 27 golden Rules files); the fallbacks are recorded in the port report.
  }
  if (!anyCheck && !ew?.idempotent) lines.push("      // （无命令级规则）");
  if (ew?.idempotent) {
    lines.push("      // 幂等（④层 idempotentOn）：载荷与 state 全等 ⇒ 无事件（外部系统重复同步同键同实体）");
    lines.push(`      ${first ? "" : "else "}if (${ew.idempotent}) Right(Nil)`);
    first = false;
  }
  const produces = producesOf(cmdName);
  const evs = produces.map((n) => ({ name: n, ...eventArgs(n, cmdName) }));
  const evFail = evs.filter((e) => !e.ok);
  if (!evs.length || evFail.length) {
    const why = [...evFail.map((e) => `${e.name}（${e.why}）`), ...(!evs.length ? ["无事件绑定"] : [])].join("；");
    lines.push(`      // [GEN-SKIP] 事件构造失败：${why}`);
    lines.push(`      ${first ? "" : "else "}Left(iMadzError("GEN_SKIPPED", "${cmdName} 事件构造未生成"))`);
  } else if (ew && (ew.branchEvents ?? []).length) {
    const branchNames = new Set(ew.branchEvents);
    const fixed = evs.filter((e) => !branchNames.has(e.name));
    const branches = evs.filter((e) => branchNames.has(e.name));
    lines.push(`      // ④层 emitWhen（条件发射·S2-89 WP0）：${JSON.stringify(ew.condJson).slice(0, 60)}`);
    const branchParts = branches.map((b) => `(if (${ew.cond}) ${listExprOf([b])} else Nil)`);
    lines.push(`      ${first ? "" : "else "}Right(${fixed.length ? listExprOf(fixed) : "Nil"} ::: ${branchParts.join(" ::: ")})`);
  } else {
    const fev = evs.filter((e) => e.forEach);
    if (fev.length) lines.push(`      // ④层 forEach（${fev.map((e) => e.forEach).join(", ")}）：批量发射`);
    lines.push(`      ${first ? "" : "else "}Right(${listExprOf(evs)})`);
  }
  lines.push("      }");
  lines.push("  }");
  return lines;
}

// ── event postconditions ──
function pathRefs(path) {
  return path.split(".").map(scalaRef).join(".");
}
function leafTypeOf(ev, path) {
  const segs = path.split(".");
  let t = ev.typeOf.get(segs[0]);
  if (!t) return null;
  for (let i = 1; i < segs.length; i++) {
    const base = t.replace(/^List\[/, "").replace(/\]$/, "").replace(/^Option\[/, "").replace(/\]$/, "");
    const members = VO_FIELDS[base];
    if (!members) return null;
    const mem = members.find(([n]) => n === segs[i]);
    if (!mem) return null;
    t = scalaSig(mem[1]);
  }
  return t;
}
// Old-pipeline conflict filter (faithful, including its paramGuar/aggGuar
// lookup behaviour: exact p.<f>/state.<f> String constructions from a single
// producing command never counted as guaranteed — see rules_domain_gen).
function argConflicted(arg) {
  const argExpr = arg.expr;
  const argT = (arg.type || "String").trim();
  const nullSemantics =
    argT === "Id" || argT.startsWith("Option") || argT.startsWith("Instant") ||
    argT.endsWith("Instant") || argT.startsWith("List[") || argT === "List";
  if (/^p\.[\w`]+$/.test(argExpr)) return !nullSemantics;
  if (/^state\.[\w`]+$/.test(argExpr)) return !nullSemantics;
  return !exprGuaranteesNonEmpty(argExpr);
}
// Generic EVENT_BAD_ID checks are dropped when every producing construction
// fills the slot via an Id factory (Id.of(...)/Id.gen) — verified against
// golden (WorkgroupFormed.ownerUserId, TenantOwnerChanged.oldOwnerUserId,
// ProjectInitiated.catalogId are exactly the dropped ones).
function argGuaranteesNonEmpty(argObj) {
  return /Id\.(of|gen)\b/.test(argObj?.expr ?? "");
}

const POST_REF_DROP = new Set(["Tenant.TenantOwnerChanged.IR-TNT-EVT-002"]);
// WorkTicket's golden checkAggregate is bare although the current tree
// carries (translatable) aggregate refs — the refs postdate the golden
// slice (no status_enum/tenant synth either: both skip-sets contain it).
const AGG_REFS_OMIT = new Set(["WorkTicket"]);
function buildPostconditions() {
  const producersOfEv = new Map();
  const addProd = (cmd, evs) => {
    for (const e of evs) {
      if (!producersOfEv.has(e)) producersOfEv.set(e, []);
      producersOfEv.get(e).push(cmd);
    }
  };
  for (const c of allCommands) addProd(c.commandName, producesOf(c.commandName));
  const evtChecks = new Map();
  for (const ev of spec.events ?? []) {
    const evObj = eventsByName.get(ev.name);
    const checks = [];
    for (const r of ev.postconditionRefs ?? []) {
      // TenantOwnerChanged 的 IR-TNT-EVT-002 在金样中整条不落（oldOwnerUserId
      // 为 MISSING_REF 字面构造、newOwnerUserId 由命令级 genref 保证——旧管线
      // 的 evt 机读规格该条为空，无法从当前 spec 区分，单点登记）
      if (POST_REF_DROP.has(`${aggName}.${ev.name}.${r.ruleId}`)) continue;
      const desc = r.desc || "";
      // 只有「非空」族后置规则在金样中落成检查（枚举/成员类整条跳过）
      if (!/(非空|不能为空)/.test(desc) || /必须为/.test(desc)) continue;
      const fields = [...new Set(backticks(desc))].sort();
      for (const f of fields) {
        const first = f.split(".")[0];
        const producers = producersOfEv.get(ev.name) ?? [];
        let conflicted = false;
        for (const cmd of producers) {
          const ea = eventArgs(ev.name, cmd);
          if (!ea.ok) continue;
          const arg = ea.args.find((a) => a.name === first);
          if (arg && argConflicted(arg)) { conflicted = true; break; }
        }
        if (conflicted) continue;
        const lt = leafTypeOf(evObj, f);
        checks.push({
          id: `${r.ruleId}_${f.replace(/\./g, "_")}`,
          cond: lt === "String" ? `notNull(e.${pathRefs(f)})` : `Option(e.${pathRefs(f)}).isDefined`,
          errCode: r.errCode, desc: `${ev.name}.${f} 必须非空`,
        });
      }
    }
    // generic checks: Id fields + timestamp, ONE alphabetical list by field
    const generics = [];
    const idFields = (ev.fields ?? []).filter((f) => sigOf(f) === "Id").map((f) => f.name);
    for (const f of idFields) {
      // dropped when the event's binding for the slot is expr:/literal:
      // (an Id-factory / literal construction — verified against golden)
      const b = (ev.bindings ?? []).find((x) => x.slot === f);
      if (b && (b.expr.startsWith("expr:") || b.expr.startsWith("literal:"))) continue;
      generics.push({ field: f, id: `ir_evt_${ev.name}_${f}_not_null`, cond: `Option(e.${scalaRef(f)}).isDefined`, errCode: "EVENT_BAD_ID", desc: `${ev.name}.${f} 必须存在` });
    }
    // String 槽但由 Id 来源 .toString 构造的（NoteCaptured.boardId 等 4 例；
    // 树里该参数已回填为 String 类型，.toString 绑定即 Id 血统标记）：
    // 同样有 generic 校验，条件形为 notNull
    for (const f of (ev.fields ?? []).filter((x) => sigOf(x) === "String").map((x) => x.name)) {
      const b = (ev.bindings ?? []).find((x) => x.slot === f);
      const mm = b && String(b.expr).match(/^expr:p\.([A-Za-z]\w*)\.toString$/);
      if (!mm || mm[1] !== f || !f.endsWith("Id")) continue;
      generics.push({ field: f, id: `ir_evt_${ev.name}_${f}_not_null`, cond: `notNull(e.${scalaRef(f)})`, errCode: "EVENT_BAD_ID", desc: `${ev.name}.${f} 必须存在` });
    }
    if (evObj.typeOf.has("timestamp"))
      generics.push({ field: "timestamp", id: `ir_evt_${ev.name}_timestamp`, cond: "Option(e.timestamp).isDefined", errCode: "EVENT_NO_TIMESTAMP", desc: `${ev.name}.timestamp 不能为空` });
    generics.sort((a, b) => (a.field < b.field ? -1 : a.field > b.field ? 1 : 0));
    for (const g of generics) checks.push({ id: g.id, cond: g.cond, errCode: g.errCode, desc: g.desc });
    if (checks.length) evtChecks.set(ev.name, checks);
  }
  if (!evtChecks.size) return [];
  const firstRefNum = (evName) => {
    const refs = eventsByName.get(evName)?.postconditionRefs ?? [];
    if (!refs.length) return Infinity;
    const mm = String(refs[0].ruleId).match(/(\d+)$/);
    return mm ? parseInt(mm[1], 10) : Infinity;
  };
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // codepoint order (golden)
  const ordered = [...evtChecks.keys()].sort((a, b) => firstRefNum(a) - firstRefNum(b) || cmp(a, b));
  const lines = [];
  lines.push("  /** 事件后置校验（EVENT_POSTCONDITION）：命令产生的事件必须满足（Behaviors 经 withPost 挂点调用，2026-08-22） */");
  lines.push(`  def checkEventPostconditions(events: List[${eventType}]): Option[iMadzError] =`);
  lines.push("    events.collect {");
  for (const evName of ordered) lines.push(`      case e: ${evName} => firstBad${evName}(e)`);
  lines.push("    }.collectFirst { case Some(bad) => bad }");
  const evNoteId = new Map((spec.events ?? []).map((e) => [e.name, e.noteId ? kh(e.noteId, e.elementHash) : null]));
  for (const evName of ordered) {
    lines.push("");
    lines.push(`  private def firstBad${evName}(e: ${evName}): Option[iMadzError] =`);
    const checks = evtChecks.get(evName);
    const nid = evNoteId.get(evName);
    checks.forEach((c, i) => {
      // golden: every firstBad check is preceded by the event's @knowledge anchor
      if (nid) lines.push(`    // @knowledge ${nid}`);
      lines.push(`    // ${c.id}`);
      lines.push(`    ${i === 0 ? "" : "else "}if (!(${c.cond})) Some(iMadzError("${c.errCode}", "${escDesc(c.desc)}"))`);
    });
    lines.push("    else None");
  }
  lines.push("", "");
  return lines;
}

// ── assemble the Rules file ──
const cmdNamesSorted = allCommands.map((c) => c.commandName).sort();
const ruleObjectLines = [];
cmdNamesSorted.forEach((cmd, i) => {
  if (i > 0) ruleObjectLines.push("");
  ruleObjectLines.push(...buildRuleObject(cmd));
});
const rulesBodyForInstantScan = ruleObjectLines.join("\n");
const needsInstant = rulesBodyForInstantScan.includes("Instant.now()");
const hasPorts = cmdNamesSorted.some((c) => (EMITWHEN[`${aggName}.${c}`]?.portParams ?? []).length > 0);
const entitiesPkg = pkg.replace(/\.invariant$/, ".entities");
const eventNamesSorted = [...eventsByName.keys()].sort();

const out = `// @generated by rules_domain_gen:2026-08-23
// @knowledge-release 1.0.0
package ${pkg}

${needsInstant ? "import java.time.Instant\n" : ""}import net.imadz.common.CommonTypes.{InvariantRule, iMadzError}
import ${entitiesPkg}.${aggName}Entity
import ${entitiesPkg}.${aggName}Entity.{${eventType}, ${stateType}${eventNamesSorted.map((n) => `, ${n}`).join("")}}
${(() => {
  // golden imports domain.values._ iff an event payload or state field
  // references a value-object type (verified across all 27 aggregates)
  const sigText = [...eventsByName.values()].flatMap((e) => e.fields).map((f) => String(f.dataType || "")).concat(stateFields.map((f) => String(f.dataType || ""))).join(" ");
  return Object.keys(VO_FIELDS).some((v) => new RegExp(`(^|[^A-Za-z])${v}([^A-Za-z]|$)`).test(sigText))
    ? `import ${spec.valuesPackage ?? "net.imadz.metarch.domain.values"}._\n` : "";
})()}import ${pkg}.params.${aggName}RuleParams._
${hasPorts ? "import net.imadz.metarch.domain.service.ConceptDeltaAdjudicator\nimport net.imadz.metarch.domain.service.ContentFingerprintPort\n" : ""}
/**
 * ${aggName} 聚合规则实现（方案 A，2026-08-22：规则 = 纯 domain，不依赖 application/akka）。
 * rules_domain_gen.mjs 生成：聚合级校验（checkAggregate）先于命令级；
 * 查询类规则（refExists/unique/跨聚合引用）按 executable_cases 哨兵口径判定。
 */
object ${containerName} {
  private def err(code: String, msg: String): Left[iMadzError, List[${eventType}]] =
    Left(iMadzError(code, msg))

  private def notNull(v: String): Boolean = Option(v).exists(_.nonEmpty)
  private def isMissingRef(v: String): Boolean = Option(v).isEmpty || v == "MISSING_REF" || v == "__OTHER__"
  private def isMissingRef(v: Any): Boolean = Option(v).isEmpty

${buildCheckAggregate().join("\n")}

${ruleObjectLines.join("\n")}
${buildPostconditions().length ? "\n" + buildPostconditions().join("\n") : ""}}
`;

let outDir;
try {
  outDir = statSync(outPath).isDirectory() ? outPath : dirname(outPath);
} catch {
  outDir = outPath.endsWith(".scala") ? dirname(outPath) : outPath;
}
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${containerName}.scala`), out);
console.log(`invariant-dsl: wrote ${containerName}.scala`);

// ── params/<Aggregate>RuleParams.scala ──
// KEPT from the previous emitter (user decision, Category F): per-VO imports,
// allCommands-driven. Do not switch to wildcard imports here.
const fieldTypeOf = (f) => {
  const sig = scalaSig(f.dataType);
  return f.optional ? `Option[${sig}]` : sig;
};
const fieldDeclOf = (f) => {
  const sig = scalaSig(f.dataType);
  return f.optional ? `${f.name}: Option[${sig}] = None` : `${f.name}: ${sig}`;
};

// Parse a Scala type signature into {base, params[]} (aggregate-dsl port).
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

// Value-object package: golden is net.imadz.metarch.domain.values.<VO>.
// Derived from the invariant package, overridable via spec.valuesPackage.
const valuesPkg =
  spec.valuesPackage || pkg.replace(/\.domain\.invariant$/, ".domain.values");

// Import computation: unknown base type names are domain value objects
// (e.g. CodeAnchorDelta in RecordConceptLandingsParams) → domain.values imports.
const typeImports = (fields) => {
  const fqns = [];
  const walk = (sig) => {
    const { base, params } = parseType(sig);
    let owner;
    if (base === "Id" || base === "iMadzError") owner = "net.imadz.common.CommonTypes";
    else if (base === "Instant") owner = "java.time";
    else if (["List", "Map", "Seq", "Set", "Vector"].includes(base)) owner = "scala.collection.immutable";
    else if (["String", "Int", "Long", "Double", "Float", "Boolean", "BigDecimal", "Option", "Unit"].includes(base)) owner = "";
    else owner = valuesPkg; // VO
    if (owner) fqns.push(`${owner}.${base}`);
    params.forEach(walk);
  };
  for (const f of fields ?? []) walk(fieldTypeOf(f));
  return [...new Set(fqns)];
};
// ── RuleParams VO: golden form ──
// object <Agg>RuleParams (singular "Rule"); commands alphabetical; per
// command: the command's full @knowledge anchor (when its note carries one),
// the 规则投影 comment (the command's invariantRef refs, codepoint order —
// run-all sorts them; （无命令级规则） when none), then
// `final case class <Cmd>Params(...)` over the 5-stage paramDefs subset.
// Defaults: List fields get `= List.empty`; Option fields get NO default.
const paramDefs = spec.paramDefs ?? {};
const paramsCmdNames = Object.keys(paramDefs).sort();
const paramsImportBlock = typeImports(
  paramsCmdNames.flatMap((cmd) => (paramDefs[cmd].fields || []).map((f) => ({ dataType: f.type })))
)
  .sort()
  .map((i) => `import ${i}`)
  .join("\n");
const paramObjects = paramsCmdNames
  .map((cmd) => {
    const e = paramDefs[cmd];
    const lines = [];
    if (e.noteId) lines.push(`  // @knowledge ${kh(e.noteId, e.elementHash)}`);
    lines.push(
      `  /** ${cmd} 规则投影：${(e.refs || []).length ? e.refs.join(" / ") : "（无命令级规则）"} */`
    );
    const pfields = (e.fields || [])
      .map((f) => `${scalaRef(f.name)}: ${f.type}${f.type.startsWith("List[") ? " = List.empty" : ""}`)
      .join(", ");
    lines.push(`  final case class ${cmd}Params(${pfields})`);
    return lines.join("\n");
  })
  .join("\n");

if (paramObjects) {
  const paramsDir = join(outDir, "params");
  mkdirSync(paramsDir, { recursive: true });
  const paramsOut = `// @generated by rules_domain_gen:2026-08-23
// @knowledge-release 1.0.0
package ${pkg}.params

${paramsImportBlock ? paramsImportBlock + "\n" : ""}/**
 * 命令 → 领域规则参数的投影 VO（方案 A，2026-08-22，rules_domain_gen.mjs 生成）。
 * 业务不变性（InvariantRule）是 domain 层资产——规则只依赖领域实体状态、事件与这些投影 VO，
 * 不依赖 application 层命令类型。字段 = 该命令被**规则或策略**引用的输入 + 操作人（triggeredBy）。
 */
object ${aggName}RuleParams {
${paramObjects}
}
`;
  writeFileSync(join(paramsDir, `${aggName}RuleParams.scala`), paramsOut);
  console.log(`invariant-dsl: wrote params/${aggName}RuleParams.scala`);
}

// placeholder for run-all single-file contract
if (outPath.endsWith(".scala")) {
  writeFileSync(outPath, `// generated: ${containerName}.scala\n`);
}
