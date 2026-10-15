// scala-cqrs-es-api-metarch.test.mjs — V4-4 inc11+inc12+inc13 gate: golden byte identity against
// the LIVE gen_api_layer output (verified fresh 2026-10-15/16: the live renderers run over
// out/truthsrc/metarch.json + story.readmodels.json + viewkey_rename_map.json reproduce the
// support files byte-for-byte, and the controller + read side render byte-identical to the
// ingested-app on-disk files on the first pass):
//   • ViewKeys.scala        — infrastructure/auth, view-key constant registry (S2-17 kebab +
//                             viewkey_rename_map resolution, key-ordered by localeCompare)
//   • CommandRoleMap.scala  — infrastructure/auth, the PB1 role derivation: roles(c) = ∪ role:
//                             targets of notes that link command:c (three co-link forms, S2-88
//                             read/write split), aggregated per view with explicit read-roles
//   • CommandDsl.scala      — infrastructure/api, the static envelope (OkReceipt / ViewListDto /
//                             ViewItem / IdGuard / InstantGuard)
//   • ModelCatalogApiController.scala — app/controllers, the per-aggregate B2 DSL face (inc12):
//                             Lane-A addressing (AssembleMetadata httpKey synthetic catalogId,
//                             the five r2 body-key commands, CreateCatalogVersion factory
//                             generatedId), IdGuard pairs, OkReceipt decision-view literals,
//                             per-endpoint @knowledge anchors with hash16, Req VOs at file tail;
//                             ApplyKnowledgePatch skipped (VO-List, not whitelisted) and
//                             GetModelCatalogState skipped (query Reply — no error slot).
//   • ViewApiController.scala + ViewWrites.scala — app/controllers, the READ side (inc13):
//                             form-B single-line endpoints over 34 gated decision views (engine
//                             axis: 15 mongo views → findByTenantPaged list form, the rest →
//                             tenantList/globalList helpers; 4 composite-key items → 400),
//                             per-view @knowledge anchors on both endpoints and OWrites
//                             (PauseProjectDecisionView has no metarch readModel note → bare,
//                             matching live), null-safe jsExprOf forms (jsInstant / uuid
//                             Option.map / backtick `type`).
//   • VectorSearchApiController.scala — app/controllers, the M3 VECTOR face (V4-13): the
//                             storage.kind=vector view endpoint (verbatim tpl_vector_search port;
//                             query chain OllamaEmbeddingClient.embed → Repository.search, k clamp
//                             1..50 default 8, sourceType whitelist note|concept from refCodes
//                             literals, 503 EMBEDDING_UNAVAILABLE degraded semantics), per-view
//                             anchor with hash16, global artifact (families=[]), plus its E301
//                             route line (block order DSL → views → vector, live parity).
//   • conf/routes — the E301 MARKER BLOCK entry (V4-7): the merged-into-shared-file block
//                             (7 write-side DSL lines + 68 view lines + 1 vector line + 27
//                             aggregate-state lines on this fixture); the merge itself is
//                             apply-side (test/diff-apply.test.mjs). Full-corpus live parity:
//                             the block is BYTE-IDENTICAL to the live E301 region (V4-14 —
//                             the state lines closed the last unported region).
// The command IR comes from parsing THIS suite's own skeleton Protocol rendering (scala-cqrs-es
// protocolModel + renderProtocol — byte-identity proven by its own golden gate), mirroring the
// live two-pass pipeline. The fixture's api-face RAW slots (roleLinkNotes / readModels /
// viewFieldNotes / viewKeyRenames / paramOrigins / viewNoteIds / mongoViewNames) are attached by
// tools/augment-api-canonical.mjs. The elementHashes sidecar is the api-face one (the live hash
// resolver's source: the kn export v1.0.0's elementHashes — 3050 keys, covering both command and
// readModel note ids; the skeleton face's 108-key sidecar only covers commands).
import { equal, ok } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { plan } from '../src/core/generate.mjs';

const GEN = join(import.meta.dirname, '..', 'generators', 'scala-cqrs-es-api');
const CANON = join(import.meta.dirname, '..', 'golden', 'scala-cqrs-es-metarch', 'model-catalog.canonical.json');
const HASHES = join(import.meta.dirname, '..', 'golden', 'scala-cqrs-es-api-metarch', 'elementHashes.json');
const GOLD = join(import.meta.dirname, '..', 'golden', 'scala-cqrs-es-api-metarch', 'expected');

const { entries } = await plan({
  canonicalFile: CANON,
  generatorDir: GEN,
  options: { elementHashes: JSON.parse(readFileSync(HASHES, 'utf8')) },
});
equal(entries.length, 9); // V4-14: AggregateStateApiController joins
for (const e of entries) {
  const want = readFileSync(join(GOLD, e.path), 'utf8');
  equal(e.content, want, `byte identity: ${e.path}`);
}

// All three carry the same two-line preamble: the hardcoded gen_api_layer stamp (generator-side
// fact, never compared) + the canonical's knowledge-release line (knowledge-side).
for (const e of entries.filter((x) => x.kind !== 'controller' && x.kind !== 'routes')) {
  ok(e.content.startsWith('// @generated by gen_api_layer:2026-08-26\n// @knowledge-release 1.0.0\n'),
    `preamble stamp + release line: ${e.path}`);
  // Global artifacts: families=[] (concern semantics — 全局件不参与族过滤)
  equal(e.families.length, 0, `global artifact has empty families: ${e.path}`);
}

// ViewKeys: 34 views, sorted by the RESOLVED key (post-rename localeCompare — the sort keys off
// the new name, so renamed views land between their semantic neighbours, not their old ones).
const vk = entries.find((e) => e.kind === 'view-keys').content;
equal((vk.match(/^  val /gm) || []).length, 34, 'ViewKeys: 34 constants');
ok(vk.includes('val DorVerdicts = "dor-verdicts"'), 'rename applied: submit-do-r-verdict → dor-verdicts');
ok(vk.includes('val TenantMemberJoins = "tenant-member-joins"'), 'rename applied: accept-tenant-invitation → tenant-member-joins');
const vkKeys = [...vk.matchAll(/^  val \w+ = "([^"]+)"$/gm)].map((m) => m[1]);
equal(vkKeys.length, 34);
ok(vkKeys.every((k, i) => i === 0 || vkKeys[i - 1].localeCompare(k) <= 0), 'ViewKeys sorted by key');

// CommandRoleMap: the co-link derivation. Write side = 130 commands (S2-88: readModel notes
// excluded from write-side co-links); the 'AI Agent' role renders through the ROLE_CONSTANTS
// vocabulary mapping (Roles.AiAgent, not the raw link target).
const crm = entries.find((e) => e.kind === 'command-role-map').content;
equal((crm.match(/^    "[A-Z]\w+" -> Seq\(/gm) || []).length, 130, 'byCommand: 130 commands');
ok(crm.includes('"EvaluateDoR" -> Seq(Roles.AiAgent)'), 'AI Agent → Roles.AiAgent (vocabulary mapping)');
ok(crm.includes('"SuspendTenant" -> Seq(Roles.SystemOperator, Roles.TenantOwner)'),
  'multi-role command: co-link union, sorted');
ok(crm.includes('ViewKeys.Workshops -> Seq(Roles.Facilitator, Roles.TenantMember, Roles.WorkgroupOwner),'),
  'view-side entry: decisionSupport ∪ read-roles aggregation');
ok(crm.includes('ViewKeys.TruthSourceProvenance -> Seq(Roles.MetadataEngineer),'),
  'view-side entries sorted localeCompare');
ok(crm.includes('def of(viewKey: String): Seq[String] = m.getOrElse(viewKey, Nil)'), 'read-side accessor');
ok(crm.includes('def ofCommand(command: String): Seq[String] = byCommand.getOrElse(command, Nil)'), 'write-side accessor');

// The gate ran over the fixture's ③-layer face: all 34 readModels views are annotated views
// (zero dropped — the dropped/draft path is logged, not fatal; the zero-intersection case is FATAL).
const canon = JSON.parse(readFileSync(CANON, 'utf8'));
equal(canon.readModels.length, 34, 'fixture readModels face: 34 views');
ok(canon.viewFieldNotes.length > 600, `gate registry present (${canon.viewFieldNotes.length} field notes)`);
ok(canon.roleLinkNotes.length > 600, `co-link participants present (${canon.roleLinkNotes.length} notes)`);
equal(canon.viewKeyRenames.length, 27, 'rename map entries attached');

// CommandDsl: the static envelope — content is fixed text, byte-identity already asserted above;
// spot-check the load-bearing expressions.
const dsl = entries.find((e) => e.kind === 'command-dsl').content;
ok(dsl.includes('"occurredAt" -> new java.time.format.DateTimeFormatterBuilder().appendInstant(3).toFormatter.format(java.time.Instant.now()),'),
  'OCC_EXPR: appendInstant(3) alignment with CommandResults.ok');
ok(dsl.includes('def parse(pairs: (String, String)*): Either[ApiError, Seq[net.imadz.common.CommonTypes.Id]]'),
  'IdGuard: Id boundary translation');

// ── inc12: the per-aggregate controller face ──────────────────────────────────────────────
const ctrl = entries.find((e) => e.path.endsWith('ModelCatalogApiController.scala')); // V4-14: path-scoped — the state/vector controllers are kind 'controller' too
equal(ctrl.families.length, 1, 'controller is aggregate-scoped (families=[ModelCatalog])');
ok(ctrl.content.startsWith('// @generated by gen_api_layer:2026-08-26\n// @knowledge-release 1.0.0\n'), 'controller preamble');
// Exactly 7 DSL endpoints (8 write commands minus the VO-List skip; the query is skipped too).
equal((ctrl.content.match(/\/\*\* B2 DSL：/g) || []).length, 7, '7 B2 DSL endpoints');
equal((ctrl.content.match(/^  def \w+: play\.api\.mvc\.Action/gm) || []).length, 7, '7 endpoint defs');
// Lane-A addressing decisions visible in the rendered ctor/entityRef shapes:
ok(ctrl.content.includes('val generatedId = java.util.UUID.randomUUID().toString'), 'factory minting (CreateCatalogVersion)');
equal((ctrl.content.match(/val generatedId = /g) || []).length, 1, 'exactly one factory-mint endpoint');
ok(ctrl.content.includes('repository.entityRef(catalogCid.toString).ask'), 'r2 body-key addressing (entityRef from Guard cid)');
ok(ctrl.content.includes('IdGuard.parse("projectId" -> req.projectId, "catalogId" -> req.catalogId)'),
  'AssembleMetadata httpKey: synthetic catalogId joins the IdGuard pairs');
ok(ctrl.content.includes('AssembleMetadata(net.imadz.common.Id.of(ts.tenantId), projectCid, req.version, req.manifest, ts.userId, replyTo)'),
  'httpKey ctor: catalogId NOT passed (event key rides the entityRef seed)');
// OkReceipt decision-view literals resolve through decisionSupport + the rename map.
ok(ctrl.content.includes('OkReceipt(generatedId, play.api.libs.json.JsString("catalog-versions"))'),
  'dv literal: CreateCatalogVersion → catalog-versions');
ok(ctrl.content.includes('OkReceipt(catalogCid.toString, play.api.libs.json.JsString("catalog-version-releases"))'),
  'dv literal: ReleaseCatalogVersion → catalog-version-releases');
// Per-endpoint anchors carry the command noteId + hash16 (elementHashes sidecar). The file-tail
// Req VOs carry NO anchor (the reqVos model has no cmdNoteId — same as live).
equal((ctrl.content.match(/^  \/\/ @knowledge [0-9a-f-]{36}@[0-9a-f]{16}$/gm) || []).length, 7, '7 endpoint anchors with hash16');
ok(ctrl.content.includes('\n/** M2（EP_S2_9c 余量并入 B2）：命令载荷 VO——typed Reads 派生，缺键/类型错 → 400 PARAM_INVALID（含字段明细）。 */\nfinal case class AssembleMetadataReq'),
  'file-tail Req VO block (no anchor — reqVos carry no noteId, matching live)');
equal((ctrl.content.match(/\/\/ @knowledge [0-9a-f]/g) || []).length, 7, 'no anchor beyond the 7 endpoints');
// The two skips are model-level facts (skippedNote travels with the entry, not the file).
ok(ctrl.skippedNote.includes('ApplyKnowledgePatch(concepts: List[ConceptDelta])'), 'VO-List skip recorded');
ok(ctrl.skippedNote.includes('GetModelCatalogState（查询型 Reply'), 'query-command skip recorded');
ok(!ctrl.content.includes('ApplyKnowledgePatch'), 'skipped command absent from the file');

// ── inc13: the read side (ViewApi + ViewWrites) ───────────────────────────────────────────
const viewApi = entries.find((e) => e.path.endsWith('ViewApiController.scala'));
const viewWrites = entries.find((e) => e.path.endsWith('ViewWrites.scala'));
equal(viewApi.families.length, 25, 'ViewApi families = gated views\u0027 sourceAggregates union (multi-family, honest attribution)');
equal(JSON.stringify(viewApi.families), JSON.stringify(viewWrites.families), 'ViewWrites carries the same families');
// 34 gated views → 34 repo injections and 68 single-line endpoints (list + item per view).
equal((viewApi.content.match(/DecisionViewRepository,$/gm) || []).length, 34, '34 repo params (all trailing-comma — api: Endpoint follows the last)');
equal((viewApi.content.match(/^  def \w+\(page: Int, pageSize: Int\)/gm) || []).length, 34, '34 list endpoints');
equal((viewApi.content.match(/^  def \w+Item\(entityId: String\)/gm) || []).length, 34, '34 item endpoints');
// Engine axis: 15 mongo views take the paged form (视图存储重设计 2026-10-08), the rest the helpers.
equal((viewApi.content.match(/findByTenantPaged\(ts\.tenantId/g) || []).length, 15, '15 mongo paged list endpoints');
equal((viewApi.content.match(/= tenantList\[/g) || []).length, 17, '17 tenant helper lists (call sites)');
equal((viewApi.content.match(/= globalList\[/g) || []).length, 2, '2 global lists (User 族: deactivatedUsers, userProfiles)');
// Composite-key items (F2: by-id → 400 PARAM_INVALID): notes / parkedKnowledge / sessions / tenantInvitations.
equal((viewApi.content.match(/compositeItem\(ViewKeys\./g) || []).length, 4, '4 composite-key items');
// Anchors: per-view on both endpoints and OWrites — 33 of 34 views carry a metarch readModel
// noteId (PauseProjectDecisionView has none → bare, matching live).
equal((viewApi.content.match(/^  \/\/ @knowledge [0-9a-f-]{36}@[0-9a-f]{16}$/gm) || []).length, 66, '66 view anchors on endpoints (33×2)');
equal((viewWrites.content.match(/^  \/\/ @knowledge [0-9a-f-]{36}@[0-9a-f]{16}$/gm) || []).length, 33, '33 view anchors on OWrites');
ok(viewApi.content.includes('def projectPauses(page: Int, pageSize: Int): play.api.mvc.Action[play.api.mvc.AnyContent] = tenantList'),
  'PauseProject list endpoint present');
const pauseBlock = viewApi.content.slice(viewApi.content.indexOf('def projectPauses(page: Int'));
ok(!pauseBlock.startsWith('\n  // @knowledge'), 'PauseProject carries NO anchor (no metarch readModel note)');
equal((viewWrites.content.match(/implicit val \w+Writes: play\.api\.libs\.json\.OWrites/g) || []).length, 34, 'ViewWrites: 34 per-view OWrites');
// Null-safe jsExprOf forms in ViewWrites (空安全继承 060a217/60b796a).
ok(viewWrites.content.includes('"edgeId" -> Json.toJson(Option(d.edgeId).map(_.toString))'), 'uuid nullable → Option.map form');
ok(viewWrites.content.includes('"assembledAt" -> jsInstant(d.assembledAt)'), 'Instant → jsInstant helper');
ok(viewWrites.content.includes('"type" -> Json.toJson(d.`type`)'), 'Scala keyword → backtick escape');
// Fixture slots behind the read side (Fork A raw inputs).
equal(Object.keys(canon.viewNoteIds ?? {}).length, 43, 'viewNoteIds slot: 43 metarch readModel note ids');
ok(!('PauseProjectDecisionView' in (canon.viewNoteIds ?? {})), 'PauseProject has no readModel note (anchor-bare source fact)');
equal((canon.mongoViewNames ?? []).length, 15, 'mongoViewNames slot: 15 storage.kind=mongo views');

// ── V4-7: the conf/routes E301 marker-block entry + the ledger noteIds slot ───────────────
const routes = entries.find((e) => e.kind === 'routes');
const routeLines = routes.content.split('\n');
equal(routeLines[0], '# >>> gen_api_layer (E301) >>>', 'marker start (live verbatim text)');
equal(routeLines[routeLines.length - 1], '# <<< gen_api_layer <<<', 'marker end (live verbatim text)');
// Fixture scope: 7 write-side DSL lines (ModelCatalog's 8 write commands minus the VO-List skip)
// + 68 view lines. POST lines carry the two-space separator + 5-space method pad; GET view lines
// the pagination defaults (pageGuard contract).
equal((routes.content.match(/^POST     \/api\/model-catalog\//gm) || []).length, 7, '7 write-side route lines');
equal((routes.content.match(/^GET      \/api\/views\/\S+ +controllers\.ViewApiController\.\w+\(page: Int \?= 1, pageSize: Int \?= 20\)$/gm) || []).length, 34, '34 view list lines with pageGuard defaults');
equal((routes.content.match(/^GET      \/api\/views\/\S+\/:entityId +controllers\.ViewApiController\.\w+Item\(entityId: String\)$/gm) || []).length, 34, '34 view item lines');
ok(routes.content.includes('POST     /api/model-catalog/create-catalog-version  controllers.ModelCatalogApiController.createCatalogVersion'),
  'factory route line shape');
// Shared-territory contract: no ledger row, marker merge, global flow.
equal(routes.noLedger, true, 'conf/routes carries no ledger row (live C6 shared territory)');
equal(routes.merge, 'markers', 'routes entry declares the marker merge policy');
equal(routes.families.length, 0, 'routes flows under any concern scope (families=[])');
equal(routes.release, '1.0.0', 'release line for the append-path fingerprint head');
// Ledger noteIds (live row parity — the knowledge identity of each file):
// controllers → served command ids; View face + ViewKeys → view ids; CommandRoleMap → command
// ids (8 on this single-aggregate fixture — the full corpus resolves all 130, harness-verified);
// CommandDsl → none (a pure envelope carries no knowledge payload).
equal(ctrl.noteIds.length, 7, 'controller noteIds = served commands (live row: 7)');
ok(ctrl.noteIds.every((x) => /^[0-9a-f-]{36}$/.test(x)), 'noteIds are uuids');
ok(JSON.stringify(ctrl.noteIds) === JSON.stringify([...ctrl.noteIds].sort()), 'noteIds sorted');
equal(viewApi.noteIds.length, 33, 'ViewApi noteIds = 33 gated views with a metarch note');
equal(viewWrites.noteIds.length, 33, 'ViewWrites carries the same view ids');
equal(entries.find((e) => e.kind === 'view-keys').noteIds.length, 33, 'ViewKeys noteIds = view ids');
equal(entries.find((e) => e.kind === 'command-role-map').noteIds.length, 8, 'CommandRoleMap noteIds (fixture scope: 8 resolvable commands)');
equal('noteIds' in entries.find((e) => e.kind === 'command-dsl'), false, 'CommandDsl carries no noteIds (live parity)');

// ── V4-13: the M3 vector face (VectorSearchApiController + its E301 route line) ───────────
const vec = entries.find((e) => e.path.endsWith('VectorSearchApiController.scala'));
ok(vec, 'vector controller entry present');
equal(vec.families.length, 0, 'vector face is a global artifact (families=[] — no sourceAggregates truth)');
equal(vec.kind, 'controller');
equal((vec.content.match(/^  \/\/ @knowledge [0-9a-f-]{36}@[0-9a-f]{16}$/gm) || []).length, 1, 'per-view endpoint anchor with hash16 (api sidecar: 4cfd5d46)');
ok(vec.content.includes('val k = math.max(1, math.min(50, req.k.getOrElse(8)))'), 'k clamp 1..50 default 8');
ok(vec.content.includes('Set("note", "concept")'), 'sourceType whitelist = refCodes literals (mechanical extraction)');
ok(vec.content.includes('Left(ApiError(503, "EMBEDDING_UNAVAILABLE"'), 'degraded semantics: 503, no silent fallback');
ok(vec.content.includes('knowledgeSemanticViewRepository.search(ts.tenantId, queryEmbedding, k, stFilter)'), 'tid hard gate rides ts.tenantId');
equal(vec.noteIds.length, 1, 'vector ledger noteIds = the view note id');
ok(JSON.stringify(vec.noteIds) === JSON.stringify(['4cfd5d46-97ea-447e-a292-c6dc6e7fe960']), 'noteId = KnowledgeSemanticView note');
// routes: the vector line lands after the view lines (live E301 block order: DSL → views → vector).
const vecLineIdx = routeLines.indexOf('POST     /api/kb/semantic-search        controllers.VectorSearchApiController.knowledgeSemanticViewSearch');
ok(vecLineIdx > 0, 'vector route line present');
ok(routeLines[vecLineIdx - 1].includes('/api/views/'), 'vector line follows the view lines (live block order)');
equal((routes.content.match(/^POST     \/api\/kb\/semantic-search /gm) || []).length, 1, 'exactly one vector route line');
// Fixture slot behind the vector face (the collectVectorViews mirror).
equal(canon.vectorViews.length, 1, 'vectorViews slot: 1 storage.kind=vector view');
equal(canon.vectorViews[0].storage.dims, 1024, 'dims from the ①-layer storage note');

// ── V4-14: the S1 aggregate-state face ────────────────────────────────────────────────────
// The state controller is a GLOBAL face over the full 27-aggregate roster (canonical.stateRoster
// sidecar on this fixture — its own roster is ModelCatalog-only). Byte identity against the
// live engine output is proven by the golden loop above; here: shape + routes closure.
const state = entries.find((e) => e.path.endsWith('AggregateStateApiController.scala'));
ok(state, 'state controller entry present');
equal(state.kind, 'controller');
equal(state.families.length, 0, 'state face is a global artifact (families=[])');
equal(state.noteIds.length, 27, 'state ledger noteIds = the 27 aggregate ids');
equal((state.content.match(/^  def \w+\(id: String\): play\.api\.mvc\.Action/gm) || []).length, 27, '27 per-aggregate methods');
equal((state.content.match(/^  private val writes\w+State: OWrites/gm) || []).length, 27, '27 state OWrites');
equal((state.content.match(/^  private implicit val writesGet\w+StateReply: OWrites/gm) || []).length, 27, '27 reply envelope OWrites');
ok(state.content.includes('Json.toJson[String](st.`type`)'), 'keyword field access backtick-escaped (st.`type`)');
ok(!state.content.includes('passwordSalt'), 'credential-nature fields excluded from the state writes');
equal((routes.content.match(/^GET      \/api\/state\/\S+  controllers\.AggregateStateApiController\.\w+\(id: String\)$/gm) || []).length, 27, '27 state route lines');
{
  const routeLines = routes.content.split('\n');
  const stLineIdx = routeLines.findIndex((l) => l.includes('/api/state/'));
  ok(stLineIdx > 0, 'state route lines present');
  ok(routeLines[stLineIdx - 1].includes('/api/kb/semantic-search'), 'state lines follow the vector line (live block order)');
}

console.log('scala-cqrs-es-api (inc11+inc12+inc13+V4-13+V4-14): ViewKeys + CommandRoleMap + CommandDsl + ModelCatalogApiController + ViewApiController + ViewWrites + VectorSearchApiController + AggregateStateApiController byte-identical');
