// === viewrepo — B-VIEWREPO family: DecisionView / GraphView / KnowledgeSemantic /
// UserLookup repository traits + impls (88 files) ===
// Pure function of canonical (compileTree output). Ports:
//   - AssemblyEngine.scala: DataTypeMapper, tableRepositoryMethods,
//     graphRepositoryMethods, readStoreStorage, finder derivation
//     (keyNames sorted; findBy<Id> = non-key *Id + composite-key *Id)
//   - ProjectionRepositoryBuilder / Template (trait)
//   - ProjectionRepositoryImplBuilder / Template (SQL scalikejdbc, Mongo
//     MongoViewStore, Graph GraphMutationExecutor, Vector PgVectorStore)
// Field source of truth: storyMapping `field` notes (info.kind=readModelField,
// info.parent=<View>) — they carry name/dataType/isKey + note description +
// noteId/elementHash for every one of the 44 views (the 34 promoted
// canonical.readModels are a subset projection of the same notes).
// Storage source: storyMapping `readModel` notes' info.storage.
//
// PHASE1 exceptions (golden-internal inconsistencies with no canonical
// signal; transcribed from golden, same spirit as run-all.mjs PHASE1 tables):
//   - PauseProjectDecisionView: later batch stamp CodegenMain:c028adad and
//     bare (non-Option) Instant DTO fields with null-guarded bind/read.
//   - Mongo findByKey 2nd argument: 7 views pass the bare parameter name
//     instead of the quoted key-field string (BARE_FIND_BY_KEY below).
//   - Mongo findByTenantPaged: ParkConcept passes Map.empty as 5th arg;
//     other non-kindValue views omit it; kindValue views pass the kind map.
//   - SubmitKnowledgePatch findByKey passes patchId without .toString.

const TRAIT_PKG = "net.imadz.metarch.application.projection.repository";
const IMPL_PKG = "net.imadz.metarch.infrastructure.repositories.projection";
const STAMP = "CodegenMain:225ed28b";
const PAUSE_VIEW = "PauseProjectDecisionView";
const BARE_FIND_BY_KEY = new Set([
  "CemEdgeDecisionView",
  "FieldModelDefinitionDecisionView",
  "ReadModelDefinitionDecisionView",
  "SubmitDoRVerdictDecisionView",
  "TruthSourceProvenanceDecisionView",
  "UseCaseDefinitionDecisionView",
  "ValueObjectDefinitionDecisionView",
]);

const SCALA_KEYWORDS = new Set(
  ("abstract case catch class def do else extends false final finally for forSome if implicit import lazy match new null object override package private protected return sealed super this throw trait try true type val var while with yield").split(" ")
);
export const scalaId = (n) => (SCALA_KEYWORDS.has(n) ? "`" + n + "`" : n);
const pascal = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
const BS2 = "\\"; // one backslash char, as in Scala source: (v \ "x")

// ── DataTypeMapper port ─────────────────────────────────────────────
// returns { sig, deps:Set<fqn>, kind, inner }
function resolveType(raw0, basePkg) {
  const raw = String(raw0 ?? "").trim();
  const low = raw.toLowerCase();
  const T = (sig, deps = [], kind = sig, inner = null) => ({ sig, deps: new Set(deps), kind, inner });
  if (low === "string") return T("String");
  if (low === "int" || low === "integer") return T("Int");
  if (low === "long") return T("Long");
  if (low === "double") return T("Double");
  if (low === "boolean" || low === "bool") return T("Boolean");
  if (low === "decimal" || low === "bigdecimal") return T("BigDecimal", ["scala.math.BigDecimal"]);
  if (low === "instant" || low === "datetime") return T("Instant", ["java.time.Instant"]);
  if (low === "string (uuid)") return T("Id", ["net.imadz.common.CommonTypes.Id"]);
  if (low === "string (enum)") return T("String");
  if (low === "string (json)" || low === "json") return T("String");
  if ((low.startsWith("list[") || low.startsWith("list<")) && (low.endsWith("]") || low.endsWith(">"))) {
    const inner = resolveType(raw.slice(5, raw.length - 1), basePkg);
    return {
      sig: `List[${inner.sig}]`,
      deps: new Set(["scala.collection.immutable.List", ...inner.deps]),
      kind: "List",
      inner,
    };
  }
  if (low === "array<string>") return T("List[String]", ["scala.collection.immutable.List"], "List", T("String"));
  if (raw !== "") return T(raw, [`${basePkg}.domain.values.${raw}`], "VO");
  return T("String");
}

// ── KnowledgeAnchorDoc port ─────────────────────────────────────────
const anchor = (f) =>
  f.noteId ? (f.elementHash ? `${f.noteId}@${f.elementHash}` : f.noteId) : null;
function paramLines(fields, withDesc) {
  const out = [];
  for (const f of fields) {
    const a = anchor(f);
    if (!a) continue;
    let desc = withDesc && f.description ? ` ${f.description}` : "";
    // Phase 2: adjudicated opaque payloads are annotated on the DTO doc so a
    // reader can tell the String is deliberate, not an unexpanded leftover.
    if (withDesc && f.opaque) desc += " [opaque: 裁决保留的原文载荷·不展开]";
    out.push(`@param ${scalaId(f.name)}${desc}  @knowledge ${a}`);
  }
  return out;
}
function docBlock(fields, indent, withDesc) {
  const lines = paramLines(fields, withDesc);
  if (!lines.length) return "";
  return (
    [`${indent}/**`, ...lines.map((l) => `${indent} * ${l}`), `${indent} */`].join("\n") + "\n"
  );
}

const HEADER = (stamp) => `// @generated by ${stamp}\n// @knowledge-release 1.0.0\n`;
const stampOf = (view) => (view === PAUSE_VIEW ? "CodegenMain:c028adad" : STAMP);
const importsCode = (fqns) =>
  [...new Set(fqns)].sort().map((f) => `import ${f}`).join("\n");

// ── canonical indexes ───────────────────────────────────────────────
function indexCanonical(canonical) {
  const fieldsByView = new Map(); // view -> [field]
  const storageByView = new Map(); // view -> storage obj
  const viewNames = [];
  for (const session of canonical.sessions || []) {
    for (const scope of session.scopes || []) {
      for (const note of scope.notes || []) {
        if (note.type === "field" && note.info && note.info.kind === "readModelField" && note.info.parent) {
          const arr = fieldsByView.get(note.info.parent) || [];
          arr.push({
            name: note.name,
            dataType: note.info.dataType || "String",
            isKey: !!note.info.isKey,
            description: note.description || "",
            noteId: note.noteId || null,
            elementHash: note.elementHash || null,
            // Phase 2 markers (SCHEMA v0.5.2; absent = Phase 1 behaviour)
            opaque: !!note.info.opaque,
            queryable: !!note.info.queryable,
            structure: note.info.structure || null,
          });
          fieldsByView.set(note.info.parent, arr);
        }
        if (note.type === "readModel" && note.name) {
          if (!storageByView.has(note.name)) {
            storageByView.set(note.name, (note.info && note.info.storage) || {});
            viewNames.push(note.name);
          }
        }
      }
    }
  }
  // Value-object registry (canonical catalog) — member schemas for typed
  // codecs (Mongo R6) and SQL sub-table columns (R4). VO payloads ride
  // canonical.valueObjects verbatim: { name, fields: [{name, dataType}] }.
  const voByName = new Map();
  for (const v of canonical.valueObjects || []) {
    if (v && v.name && Array.isArray(v.fields)) voByName.set(v.name, v);
  }
  return { fieldsByView, storageByView, viewNames, voByName };
}

// Field-aware type resolution (Phase 2 R1): an adjudicated expansion
// (info.structure) wins over the raw dataType string.
//   structure: { vo: "<VO name>" }        -> the tree VO itself (domain.values)
//   structure: { name, fields: [...] }    -> a sub-document DTO emitted beside
//                                            the view DTO (trait companion)
// Anything else falls through to the Phase 1 DataTypeMapper port.
function resolveFieldType(f, basePkg) {
  const s = f.structure;
  if (s && s.vo) {
    return { sig: s.vo, deps: new Set([`${basePkg}.domain.values.${s.vo}`]), kind: "VO", inner: null, voName: s.vo };
  }
  if (s && s.name && Array.isArray(s.fields)) {
    return { sig: s.name, deps: new Set(), kind: "Struct", inner: null, struct: s };
  }
  return resolveType(f.dataType, basePkg);
}

// ── method model (trait + impl share it) ────────────────────────────
// method: { name, params:[{name,type,noteId,elementHash}], ret, logic }
function tableMethods(view, fields) {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const keys = fields.filter((f) => f.isKey).map((f) => f.name).sort();
  const nonKeyIds = fields.map((f) => f.name).filter((n) => !keys.includes(n) && n.endsWith("Id"));
  const compKeyIds = keys.length > 1 ? keys.filter((n) => n.endsWith("Id")) : [];
  const idNames = [...new Set([...nonKeyIds, ...compKeyIds])].sort();
  const p = (name) => {
    const f = byName.get(name);
    return { name, type: "String", noteId: f ? f.noteId : null, elementHash: f ? f.elementHash : null };
  };
  const methods = [
    { name: "upsert", params: [{ name: "view", type: view }], ret: "Unit", logic: `投影写侧 upsert ${view} 行` },
  ];
  if (keys.length) {
    methods.push({
      name: "findByIdentity",
      params: keys.map(p),
      ret: `Future[Option[${view}]]`,
      logic: `按标识键 (${keys.join(", ")}) 查单条 ${view}`,
    });
  }
  for (const id of idNames) {
    methods.push({
      name: `findBy${pascal(id)}`,
      params: [p(id)],
      ret: `Future[List[${view}]]`,
      logic: `按 ${id} 查 ${view} 列表`,
    });
  }
  methods.push({ name: "findAll", params: [], ret: `Future[List[${view}]]`, logic: `查全部 ${view} 行` });
  return { methods, keys, idNames };
}

function mongoExtraMethods(view, fields) {
  const t = fields.find((f) => f.name === "tenantId");
  const tp = { name: "tenantId", type: "String", noteId: t ? t.noteId : null, elementHash: t ? t.elementHash : null };
  return [
    {
      name: "findByTenantPaged",
      params: [tp, { name: "limit", type: "Int" }, { name: "offset", type: "Long" }],
      ret: `Future[List[${view}]]`,
      logic: `按 tenantId 分页查 ${view}（SQL 级租户下推·limit/offset）`,
    },
    {
      name: "countByTenant",
      params: [tp],
      ret: "Future[Long]",
      logic: `按 tenantId 计数 ${view}（分页 total）`,
    },
  ];
}

// Phase 2 R3 (SQL): element finders for list fields adjudicated queryable.
// Naming (construction decision, design R3 left it open): the method is named
// after the singular element role — findBy<Element> (linkedNoteIds ->
// findByLinkedNoteId). The element parameter carries the field note's anchor.
const singular = (n) => (n.endsWith("s") ? n.slice(0, -1) : n);
function elementFinders(view, fields) {
  const out = [];
  for (const f of fields) {
    if (!f.queryable || !f.resolved || f.resolved.kind !== "List") continue;
    const el = singular(f.name);
    out.push({
      name: `findBy${pascal(el)}`,
      params: [{ name: el, type: "String", noteId: f.noteId, elementHash: f.elementHash }],
      ret: `Future[List[${view}]]`,
      logic: `按 ${f.name} 元素查 ${view} 列表（子表元素索引）`,
      elementField: f.name,
    });
  }
  return out;
}

function graphMethods(view, fields, storage) {
  const label = storage.nodeLabel || "";
  // Phase 2 R9: props are typed once any field of the view carries a
  // non-String adjudicated type (backfilled dataType); an all-String view
  // keeps the Phase 1 Map[String, String] channel byte-for-byte.
  const typed = (fields || []).some((f) => f.resolved && f.resolved.kind !== "String");
  const props = { name: "props", type: typed ? "Map[String, Any]" : "Map[String, String]" };
  const methods = [
    { name: "upsertNode", params: [{ name: "key", type: "String" }, props], ret: "Unit", logic: `图节点 MERGE 写侧（${label}·${storage.keySpace || "kn"}: 空间前缀键）` },
    { name: "updateNodeProps", params: [{ name: "key", type: "String" }, props], ret: "Unit", logic: `图节点属性 SET（${label}）` },
    { name: "deleteNode", params: [{ name: "key", type: "String" }, { name: "tenantId", type: "String" }], ret: "Unit", logic: `图节点 DETACH DELETE（${label}）` },
    {
      name: "mergeLinkTolerant",
      params: ["fromExternalId", "toName", "linkType", "linkTarget", "tenantId"].map((n) => ({ name: n, type: "String" })),
      ret: "Unit",
      logic: "Note→Note LINKS 边 MERGE（悬空端点弃置·CM-11 三段式扩边 2026-10-02）",
    },
  ];
  const burnable = burnableEdges(storage);
  if (burnable.length) {
    const types = [...new Set(burnable.map((e) => e.edgeType))];
    methods.push({
      name: "mergeEdge",
      params: ["edgeType", "fromKey", "toKey", "tenantId"].map((n) => ({ name: n, type: "String" })),
      ret: "Unit",
      logic: `图边 MERGE（edgeType 白名单 [${types.join(", ")}]·端点结构烧进 Impl）`,
    });
  }
  return methods;
}
const burnableEdges = (storage) =>
  (storage.edgeMappings || []).filter(
    (e) => e.relationKey === storage.nodeKey && String(e.toKeyId || "").trim() !== ""
  );

function vectorMethods(view) {
  return [
    { name: "upsert", params: [{ name: "view", type: view }], ret: "Unit", logic: `投影写侧 upsert ${view} 行（同步嵌入）` },
    {
      name: "findByIdentity",
      params: ["tenantId", "sourceType", "sourceId"].map((n) => ({ name: n, type: "String" })),
      ret: `Future[Option[${view}]]`,
      logic: `按标识键 (tenantId, sourceType, sourceId) 查单条 ${view}`,
      noDoc: true,
    },
    {
      name: "delete",
      params: ["sourceType", "sourceId"].map((n) => ({ name: n, type: "String" })),
      ret: "Unit",
      logic: `按 (sourceType, sourceId) 删 ${view} 行（sourceId 全局唯一·删除事件折叠）`,
      noDoc: true,
    },
    {
      name: "search",
      params: [
        { name: "tenantId", type: "String" },
        { name: "queryEmbedding", type: "Array[Float]" },
        { name: "k", type: "Int" },
        { name: "sourceType", type: "Option[String]" },
      ],
      ret: `Future[List[${view}]]`,
      logic: `租户内向量近邻检索 ${view}（cosine·k 截断·sourceType 过滤）`,
      noDoc: true,
    },
  ];
}

// ── trait rendering (ProjectionRepositoryTemplate port) ─────────────
function renderTrait(view, fields, methods, implName, kind, basePkg) {
  const dtoDeps = new Set();
  const sortedFields = [...fields].sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const f of sortedFields) {
    f.resolved = resolveFieldType(f, basePkg);
    for (const d of f.resolved.deps) dtoDeps.add(d);
  }
  const dtoSig = (f) =>
    f.resolved.kind === "Instant" && view !== PAUSE_VIEW ? "Option[Instant]" : f.resolved.sig;
  // Expanded sub-document DTO definitions (deps must land before imports are
  // filtered below); the companion emission further down reuses this list.
  const structDefs = [];
  for (const f of sortedFields) {
    if (!f.structure || !f.structure.name || !Array.isArray(f.structure.fields)) continue;
    const sub = [...f.structure.fields]
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .map((sf) => {
        const r = resolveType(sf.dataType, basePkg);
        for (const d of r.deps) dtoDeps.add(d);
        return `${scalaId(sf.name)}: ${r.sig}`;
      })
      .join(", ");
    structDefs.push(`/** ${f.structure.name} — ${view}.${f.name} 的展开子文档（info.structure·结构出处见树） */\ncase class ${f.structure.name}(${sub})`);
  }
  const methodDeps = new Set();
  const retDeps = (ret) => {
    if (ret.includes("Future")) methodDeps.add("scala.concurrent.Future");
    if (ret.includes("List[")) methodDeps.add("scala.collection.immutable.List");
    if (ret.includes("Map[")) methodDeps.add("scala.collection.immutable.Map");
    if (ret.includes(view)) methodDeps.add(`${TRAIT_PKG}.${view}Table.${view}`);
  };
  for (const m of methods) {
    retDeps(m.ret);
    for (const prm of m.params) if (prm.type === view) methodDeps.add(`${TRAIT_PKG}.${view}Table.${view}`);
    if (m.params.some((prm) => prm.type.startsWith("Map["))) methodDeps.add("scala.collection.immutable.Map");
  }
  const deps = new Set([...dtoDeps, ...methodDeps, `${IMPL_PKG}.${implName}`, "com.google.inject.ImplementedBy", "javax.inject.Inject"]);
  if (kind !== "graph") {
    deps.add("scala.concurrent.Future");
    deps.add("scala.collection.immutable.List");
  }
  const filtered = [...deps].filter((d) => d && d !== TRAIT_PKG && !d.startsWith("java.lang"));
  const dtoParams = sortedFields.map((f) => `${scalaId(f.name)}: ${dtoSig(f)}`).join(", ");
  const dtoDoc = docBlock(sortedFields, "", true);
  // Phase 2 R12: expanded sub-document DTOs live in the same companion object
  // (no new files; definitions computed above as structDefs).
  const structCode = structDefs.length ? `\n\n${structDefs.join("\n\n")}` : "";
  const dtoCompanion = `object ${view}Table {\n${dtoDoc}case class ${view}(${dtoParams}) {\n\n}${structCode}\n}`;
  const methodsCode = methods
    .map((m) => {
      const params = m.params.map((prm) => `${scalaId(prm.name)}: ${prm.type}`).join(", ");
      const fd = m.noDoc ? "" : docBlock(m.params, "  ", false);
      return `${fd}  def ${m.name}(${params}): ${m.ret}\n  // Logic: ${m.logic}`;
    })
    .join("\n\n");
  const traitDef = `/**\n * ${view}Repository: Projection Layer Repository Interface (Read Side)\n * DTOs are defined in the companion object.\n */\n\n@ImplementedBy(classOf[${implName}])\ntrait ${view}Repository {\n\n  import ${view}Table._\n\n${methodsCode}\n\n}\n`;
  return `${HEADER(stampOf(view))}package ${TRAIT_PKG}\n\n${importsCode(filtered)}\n\n${dtoCompanion}\n\n${traitDef}\n`;
}

// ── impl rendering (ProjectionRepositoryImplTemplate port) ──────────
function renderImpl(view, fields, methods, implName, kind, basePkg, bodyOf, extraMembers, ctorParams, deps) {
  const allDeps = new Set([
    ...deps,
    `${TRAIT_PKG}.${view}Table._`,
    "scalikejdbc._",
    "scala.concurrent.ExecutionContext.Implicits.global",
    "javax.inject.Singleton",
  ]);
  if (ctorParams && ctorParams.length) allDeps.add("javax.inject.Inject");
  const filtered = [...allDeps].filter((d) => d && d !== IMPL_PKG && !d.startsWith("java.lang"));
  const ctor = ctorParams && ctorParams.length ? ` @Inject() (${ctorParams.map((c) => `${c.name}: ${c.type}`).join(", ")})` : "";
  const methodsCode = methods
    .map((m) => {
      const params = m.params.map((prm) => `${scalaId(prm.name)}: ${prm.type}`).join(", ");
      const fd = m.noDoc ? "" : docBlock(m.params, "  ", false);
      const body = bodyOf(m).split("\n").map((l) => `    ${l}`).join("\n");
      return `${fd}  override def ${m.name}(${params}): ${m.ret} = {\n    // ==== BEGIN MANUAL ====\n${body}\n    // ==== END MANUAL ====\n  }`;
    })
    .join("\n\n");
  const extra = extraMembers ? `\n${extraMembers}\n` : "";
  return `${HEADER(stampOf(view))}package ${IMPL_PKG}\n\n${importsCode(filtered)}\n\n/**\n * ${implName}: Projection Repository Implementation\n */\n@Singleton\nclass ${implName}${ctor} extends ${view}Repository {\n\n${methodsCode}\n${extra}\n}\n`;
}

// ── SQL (scalikejdbc) bodies — ProjectionRepositoryImplBuilder.buildTable port
// Phase 2: R3 tenant paged/count bodies; R4/R5 list fields leave the main
// table for sub-tables (delete+insert inside the upsert transaction, hydrate
// on read). Views without list fields keep the Phase 1 bodies byte-for-byte
// for every pre-existing method.
function sqlBodies(view, fields, keys, voByName, basePkg) {
  const sortedFields = [...fields].sort((a, b) => (a.name < b.name ? -1 : 1));
  const table = `${view.toLowerCase()}_table`;
  const bareInstant = view === PAUSE_VIEW;
  const scalarFields = sortedFields.filter((f) => f.resolved.kind !== "List");
  const listFields = sortedFields.filter((f) => f.resolved.kind === "List");
  const hasLists = listFields.length > 0;
  const subTableOf = (f) => `${view.toLowerCase()}_${f.name.toLowerCase()}_table`;
  const fieldByName = new Map(sortedFields.map((f) => [f.name, f]));

  // bind an arbitrary value expression (view field / sub-table element / VO member)
  const bindVal = (expr, r, bare = false) => {
    if (r.kind === "Instant")
      return bare || bareInstant
        ? `(if (${expr} == null) null else java.lang.Long.valueOf(${expr}.toEpochMilli))`
        : `(${expr}.map(x => java.lang.Long.valueOf(x.toEpochMilli)).orNull)`;
    if (r.kind === "Id") return `${expr}.toString`;
    return expr;
  };
  const bindExpr = (f) => bindVal(`view.${scalaId(f.name)}`, f.resolved);
  const readVal = (col, r, bare = false) => {
    if (r.kind === "Int") return `rs.int("${col}")`;
    if (r.kind === "Long") return `rs.long("${col}")`;
    if (r.kind === "Boolean") return `rs.boolean("${col}")`;
    if (r.kind === "BigDecimal") return `rsBigDecimal("${col}")`;
    if (r.kind === "Instant") {
      const e = `rs.longOpt("${col}").map(java.time.Instant.ofEpochMilli)`;
      return bare || bareInstant ? `${e}.orNull` : e;
    }
    if (r.kind === "Id") return `Id.of(rs.string("${col}"))`;
    return `rs.string("${col}")`;
  };
  const readExpr = (f) => readVal(f.name, f.resolved);
  const colList = scalarFields.map((f) => "`" + f.name + "`").join(", ");
  const keyBinds = (src) => keys.map((k) => bindVal(`${src}.${scalaId(k)}`, fieldByName.get(k).resolved)).join(", ");
  const keyWhere = keys.map((k) => "`" + k + "` = ?").join(" AND ");

  // sub-table element/member shape for one list field
  const subShape = (f) => {
    const inner = f.resolved.inner;
    if (inner.kind === "VO") {
      const vo = voByName.get(inner.sig);
      const members = (vo ? vo.fields : []).map((mf) => ({ name: mf.name, resolved: resolveType(mf.dataType, basePkg) }));
      return { vo: inner.sig, members };
    }
    return { vo: null, members: null, element: inner };
  };
  const subCols = (f) => {
    const s = subShape(f);
    return s.vo ? [...keys, "idx", ...s.members.map((m) => m.name)] : [...keys, "idx", "value"];
  };
  const subInsert = (f) => {
    const sub = subTableOf(f);
    const cols = subCols(f).map((c) => "`" + c + "`").join(", ");
    const ph = subCols(f).map(() => "?").join(", ");
    const s = subShape(f);
    const elemBinds = s.vo
      ? s.members.map((m) => bindVal(`elem.${scalaId(m.name)}`, m.resolved, true)).join(", ")
      : bindVal("elem", s.element, true);
    return `  sql"DELETE FROM \`${sub}\` WHERE ${keyWhere}".bind(${keyBinds("view")}).update.apply()\n  view.${scalaId(f.name)}.zipWithIndex.foreach { case (elem, idx) =>\n    sql"INSERT INTO \`${sub}\` (${cols}) VALUES (${ph})".bind(${keyBinds("view")}, idx, ${elemBinds}).update.apply()\n  }`;
  };
  const subRead = (f) => {
    const sub = subTableOf(f);
    const s = subShape(f);
    const cols = subCols(f).filter((c) => !keys.includes(c) && c !== "idx").map((c) => "`" + c + "`").join(", ");
    const elemRead = s.vo
      ? `${s.vo}(${s.members.map((m) => `${scalaId(m.name)} = ${readVal(m.name, m.resolved, true)}`).join(", ")})`
      : readVal("value", s.element, true);
    return `sql"SELECT ${cols} FROM \`${sub}\` WHERE ${keyWhere} ORDER BY \`idx\`".bind(${keyBinds("row")}).map(rs => ${elemRead}).list.apply()`;
  };
  const hydrateCopy = () =>
    listFields.map((f) => `${scalaId(f.name)} = ${subRead(f)}`).join(",\n            ");
  const mapBody = () =>
    sortedFields
      .map((f) => (f.resolved.kind === "List" ? `${scalaId(f.name)} = Nil` : `${scalaId(f.name)} = ${readExpr(f)}`))
      .join(",\n            ");

  const bodyOf = (m) => {
    if (m.name === "upsert") {
      const placeholders = scalarFields.map(() => "?").join(", ");
      const updates = scalarFields
        .map((f) => f.name)
        .filter((n) => !keys.includes(n))
        .map((c) => "`" + c + "` = VALUES(`" + c + "`)")
        .join(", ");
      const binds = scalarFields.map(bindExpr).join(",\n          ");
      const main = `sql"""INSERT INTO ${table}\n        (${colList})\n        VALUES (${placeholders})\n        ON DUPLICATE KEY UPDATE ${updates}"""\n    .bind(\n          ${binds}\n        )\n    .update.apply()`;
      if (!hasLists) return `DB.localTx { implicit session =>\n  ${main}\n}`;
      const subs = listFields.map(subInsert).join("\n");
      return `DB.localTx { implicit session =>\n  ${main}\n  // 子表（列表结构化·Phase 2 R4）：同事务先删后插\n${subs}\n}`;
    }
    if (m.name === "countByTenant") {
      return `Future {\n      DB readOnly { implicit session =>\n        sql"""SELECT COUNT(*) FROM ${table} WHERE \`tenantId\` = ?"""\n          .bind(tenantId)\n          .map(rs => rs.long(1))\n          .single.apply()\n          .getOrElse(0L)\n      }\n    }`;
    }
    const terminal = m.ret.includes("Option[") ? "headOption" : "list";
    let selectHead, bindClause;
    if (m.name === "findByTenantPaged") {
      const orderCols = keys.map((k) => "`" + k + "`").join(", ");
      selectHead = `SELECT ${colList}\n              FROM ${table}\n              WHERE \`tenantId\` = ?\n              ORDER BY ${orderCols} LIMIT ? OFFSET ?`;
      bindClause = `\n          .bind(tenantId, limit, offset)`;
    } else if (m.elementField) {
      const f = fieldByName.get(m.elementField);
      const sub = subTableOf(f);
      const join = keys.map((k) => `\`${sub}\`.\`${k}\` = \`${table}\`.\`${k}\``).join(" AND ");
      selectHead = `SELECT ${colList}\n              FROM ${table}\n              WHERE EXISTS (SELECT 1 FROM \`${sub}\` WHERE ${join} AND \`${sub}\`.\`value\` = ?)`;
      bindClause = `\n          .bind(${scalaId(m.params[0].name)})`;
    } else {
      const where = m.params.length
        ? `\n              WHERE ${m.params.map((prm) => "`" + prm.name + "` = ?").join(" AND ")}`
        : "";
      selectHead = `SELECT ${colList}\n              FROM ${table}${where}`;
      bindClause = m.params.length ? `\n          .bind(${m.params.map((prm) => scalaId(prm.name)).join(", ")})` : "";
    }
    if (!hasLists) {
      return `Future {\n      DB readOnly { implicit session =>\n        sql"""${selectHead}"""${bindClause}\n          .map(rs => ${view}(\n            ${mapBody()}\n          ))\n          .${terminal}.apply()\n      }\n    }`;
    }
    const tail = terminal === "headOption" ? "hydrated.headOption" : "hydrated";
    return `Future {\n      DB readOnly { implicit session =>\n        val rows = sql"""${selectHead}"""${bindClause}\n          .map(rs => ${view}(\n            ${mapBody()}\n          ))\n          .list.apply()\n        val hydrated = rows.map { row =>\n          row.copy(\n            ${hydrateCopy()}\n          )\n        }\n        ${tail}\n      }\n    }`;
  };
  const deps = new Set(["scala.concurrent.Future", "scala.concurrent.ExecutionContext", `${TRAIT_PKG}.${view}Repository`]);
  if (sortedFields.some((f) => f.resolved.kind === "Id")) deps.add("net.imadz.common.Id");
  for (const f of sortedFields) {
    if (f.resolved.kind === "List" && f.resolved.inner) for (const d of f.resolved.inner.deps) deps.add(d);
    if (f.resolved.kind === "Id") deps.add("net.imadz.common.Id");
    // sub-table reads construct Id values for Id elements / VO members
    if (f.resolved.kind === "List" && f.resolved.inner) {
      if (f.resolved.inner.kind === "Id") deps.add("net.imadz.common.Id");
      if (f.resolved.inner.kind === "VO") {
        const vo = voByName.get(f.resolved.inner.sig);
        if (vo && vo.fields.some((mf) => resolveType(mf.dataType, basePkg).kind === "Id")) deps.add("net.imadz.common.Id");
      }
    }
  }
  return { bodyOf, deps, extraMembers: null, ctorParams: null };
}

// ── Mongo bodies — buildMongo port ──────────────────────────────────
// Phase 2 R6/R7/R8: the impl↔store boundary is a typed BSON Document codec
// (MongoViewStore Document API — see phase2-mongoviewstore-document-api.md),
// not a whole-row JSON string. Field-level codecs are generated from the
// resolved types; VO/struct members recurse through generated per-type
// codecs whose schemas come from the tree (canonical VOs / info.structure).
// safeRowToView per-row fault isolation and the kind gate are preserved.
function mongoBodies(view, fields, storage, voByName, basePkg) {
  const sortedFields = [...fields].sort((a, b) => (a.name < b.name ? -1 : 1));
  const collection = storage.collection || "";
  const keyField = storage.keyField || "";
  const kv = storage.kindValue || "";
  const keyCol = kv ? "_id" : keyField;
  const composite = (expr) => (kv ? `"${kv}:" + ${expr}` : expr);
  const used = new Set(); // BSON type names actually referenced (import set)
  const codecDeps = new Set(); // extra imports (VO types…)
  const codecDefs = new Map(); // typeName -> {toDoc, fromDoc}
  const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

  // Optional VO/struct members (payload `optional: true` — the VO generator
  // wraps them in Option[_], so the codec must too).
  function writeValOpt(expr, r) {
    used.add("BsonNull");
    return `${expr}.map(elem => (${writeVal("elem", r, false)}: org.mongodb.scala.bson.BsonValue)).getOrElse(BsonNull())`;
  }
  function readValOpt(name, r, src) {
    return `${src}.get("${name}") match { case Some(v) if !v.isNull => Some(${readElem("v", r)}); case _ => None }`;
  }
  const memberWrites = (members) =>
    members
      .map((m) => `"${m.name}" -> ${m.optional ? writeValOpt(`v.${scalaId(m.name)}`, m.resolved) : writeVal(`v.${scalaId(m.name)}`, m.resolved, false)}`)
      .join(",\n      ");
  const memberReads = (members) =>
    members
      .map((m) => `${scalaId(m.name)} = ${m.optional ? readValOpt(m.name, m.resolved, "doc") : readVal(m.name, m.resolved, "doc", false)}`)
      .join(",\n      ");
  function ensureVoCodec(voName) {
    if (codecDefs.has(voName)) return;
    const vo = voByName.get(voName);
    if (!vo) throw new Error(`mongo codec: VO ${voName} not in canonical valueObjects`);
    codecDefs.set(voName, null); // cycle guard
    codecDeps.add(`${basePkg}.domain.values.${voName}`);
    const members = vo.fields.map((mf) => ({ name: mf.name, resolved: resolveType(mf.dataType, basePkg), optional: !!mf.optional }));
    const writes = memberWrites(members);
    const reads = memberReads(members);
    codecDefs.set(voName, {
      toDoc: `  private def ${lower(voName)}ToDocument(v: ${voName}): Document =\n    Document(\n      ${writes})`,
      fromDoc: `  private def ${lower(voName)}FromDocument(doc: Document): ${voName} = ${voName}(\n      ${reads})`,
    });
  }
  function ensureStructCodec(struct) {
    const name = struct.name;
    if (codecDefs.has(name)) return;
    codecDefs.set(name, null);
    const members = struct.fields.map((mf) => ({ name: mf.name, resolved: resolveType(mf.dataType, basePkg), optional: !!mf.optional }));
    const writes = memberWrites(members);
    const reads = memberReads(members);
    codecDefs.set(name, {
      toDoc: `  private def ${lower(name)}ToDocument(v: ${name}): Document =\n    Document(\n      ${writes})`,
      fromDoc: `  private def ${lower(name)}FromDocument(doc: Document): ${name} = ${name}(\n      ${reads})`,
    });
  }
  // BSON write expression for a value of resolved type r. optInstant: the
  // value is Option[Instant] (view DTO shape) rather than a bare Instant.
  function writeVal(expr, r, optInstant) {
    switch (r.kind) {
      case "String": used.add("BsonString"); used.add("BsonNull"); return `bsonStr(${expr})`;
      case "Int": used.add("BsonInt32"); return `BsonInt32(${expr})`;
      case "Long": used.add("BsonInt64"); return `BsonInt64(${expr})`;
      case "Double": used.add("BsonDouble"); return `BsonDouble(${expr})`;
      case "Boolean": used.add("BsonBoolean"); return `BsonBoolean(${expr})`;
      case "BigDecimal": used.add("BsonDecimal128"); return `new org.bson.BsonDecimal128(org.bson.types.Decimal128.parse(${expr}.toString))`;
      case "Id": used.add("BsonString"); used.add("BsonNull"); codecDeps.add("net.imadz.common.Id"); return `((if (${expr} == null) BsonNull() else BsonString(${expr}.toString)): org.mongodb.scala.bson.BsonValue)`;
      case "Instant":
        used.add("BsonDateTime"); used.add("BsonNull");
        return optInstant
          ? `(${expr}.map(x => BsonDateTime(x.toEpochMilli)).getOrElse(BsonNull()): org.mongodb.scala.bson.BsonValue)`
          : `BsonDateTime(${expr}.toEpochMilli)`;
      case "List": used.add("BsonArray"); return `BsonArray(${expr}.map(elem => (${writeVal("elem", r.inner, false)}: org.mongodb.scala.bson.BsonValue)))`;
      case "VO": ensureVoCodec(r.sig); return `${lower(r.sig)}ToDocument(${expr}).toBsonDocument`;
      case "Struct": ensureStructCodec(r.struct); return `${lower(r.struct.name)}ToDocument(${expr}).toBsonDocument`;
      default: used.add("BsonString"); used.add("BsonNull"); return `bsonStr(${expr}.toString)`;
    }
  }
  function readElem(expr, r) {
    switch (r.kind) {
      case "String": return `${expr}.asString().getValue`;
      case "Int": return `${expr}.asInt32().getValue`;
      case "Long": return `${expr}.asInt64().getValue`;
      case "Double": return `${expr}.asDouble().getValue`;
      case "Boolean": return `${expr}.asBoolean().getValue`;
      case "BigDecimal": return `BigDecimal(${expr}.asDecimal128().getValue.toString)`;
      case "Id": codecDeps.add("net.imadz.common.Id"); return `Id.of(${expr}.asString().getValue)`;
      case "Instant": return `${expr} match { case v if v.isDateTime => java.time.Instant.ofEpochMilli(v.asDateTime().getValue); case v if v.isInt64 => java.time.Instant.ofEpochMilli(v.asInt64().getValue); case v if v.isString => java.time.Instant.parse(v.asString().getValue) }`;
      case "VO": ensureVoCodec(r.sig); return `${lower(r.sig)}FromDocument(Document(${expr}.asDocument()))`;
      case "Struct": ensureStructCodec(r.struct); return `${lower(r.struct.name)}FromDocument(Document(${expr}.asDocument()))`;
      case "List": return `${expr}.asArray().getValues.asScala.map(elem => ${readElem("elem", r.inner)}).toList`;
      default: return `${expr}.asString().getValue`;
    }
  }
  // BSON read expression for field `name` of document expression `src`.
  function readVal(name, r, src, optInstant) {
    const at = `${src}("${name}")`;
    switch (r.kind) {
      case "String": return `${at}.asString().getValue`;
      case "Int": return `${at}.asInt32().getValue`;
      case "Long": return `${at}.asInt64().getValue`;
      case "Double": return `${at}.asDouble().getValue`;
      case "Boolean": return `${at}.asBoolean().getValue`;
      case "BigDecimal": return `BigDecimal(${at}.asDecimal128().getValue.toString)`;
      case "Id": codecDeps.add("net.imadz.common.Id"); return `${src}.get("${name}") match { case Some(v) if !v.isNull => Id.of(v.asString().getValue); case _ => null }`;
      case "Instant":
        return optInstant
          ? `${src}.get("${name}") match { case Some(v) if v.isDateTime => Some(java.time.Instant.ofEpochMilli(v.asDateTime().getValue)); case Some(v) if v.isInt64 => Some(java.time.Instant.ofEpochMilli(v.asInt64().getValue)); case Some(v) if v.isString => Some(java.time.Instant.parse(v.asString().getValue)); case _ => None }`
          : `${at} match { case v if v.isDateTime => java.time.Instant.ofEpochMilli(v.asDateTime().getValue); case v if v.isInt64 => java.time.Instant.ofEpochMilli(v.asInt64().getValue); case v if v.isString => java.time.Instant.parse(v.asString().getValue) }`;
      case "List":
        used.add("BsonArray");
        return `${src}.get("${name}") match { case Some(v) if v.isArray => v.asArray().getValues.asScala.map(elem => ${readElem("elem", r.inner)}).toList; case _ => Nil }`;
      case "VO": ensureVoCodec(r.sig); return `${lower(r.sig)}FromDocument(Document(${at}.asDocument()))`;
      case "Struct": ensureStructCodec(r.struct); return `${lower(r.struct.name)}FromDocument(Document(${at}.asDocument()))`;
      default: return `${at}.asString().getValue`;
    }
  }

  const writeEntries = sortedFields.map((f) => `"${f.name}" -> ${writeVal(`view.${scalaId(f.name)}`, f.resolved, true)}`).join(",\n      ");
  const kindEntry = kv ? `,\n      "kind" -> BsonString("${kv}")` : "";
  if (kv) used.add("BsonString");
  const rowEntries = sortedFields.map((f) => `${scalaId(f.name)} = ${readVal(f.name, f.resolved, "doc", true)}`).join(",\n      ");
  // trigger codec registration for every VO/struct reachable from the fields
  for (const f of sortedFields) {
    if (f.resolved.kind === "VO") ensureVoCodec(f.resolved.sig);
    if (f.resolved.kind === "Struct") ensureStructCodec(f.resolved.struct);
    if (f.resolved.kind === "List" && f.resolved.inner && f.resolved.inner.kind === "VO") ensureVoCodec(f.resolved.inner.sig);
  }
  const codecCode = [...codecDefs.values()].filter(Boolean).map((c) => `${c.toDoc}\n\n${c.fromDoc}`).join("\n\n");
  const bsonStrHelper = used.has("BsonString")
    ? `\n\n  /** String 字段 → BSON（null 保真为 BsonNull，与 Phase 1 JsNull 口径一致） */\n  private def bsonStr(s: String): org.mongodb.scala.bson.BsonValue = if (s == null) BsonNull() else BsonString(s)`
    : "";
  const safeRowDef = kv
    ? `  /** [6合1 kind 判别式] decode 前 kind 门——同 collection 多视图列同形不设防＝静默混族读：\n    * kind 不匹配按毒行跳过（与字段级 decode 失败同路径） */\n  private def safeRowToView(doc: Document): Option[${view}] =\n    doc.get("kind") match {\n      case Some(v) if v.isString && v.asString().getValue == "${kv}" => scala.util.Try(rowFromDocument(doc)).toOption\n      case _ => None\n    }\n\n`
    : `  /** Document → DTO·毒行隔离 wrapper（S9 反例验证 2026-10-08：decode 失败＝单行披露跳过不炸集合——\n    * guards 型全表 500 事故的 Mongo 路免疫面；本层挡字段级 decode 失败） */\n  private def safeRowToView(doc: Document): Option[${view}] =\n    scala.util.Try(rowFromDocument(doc)).toOption\n\n`;
  const extraMembers = `/** DTO → BSON Document（视图行整取整写——字段级类型化 codec；Phase 2 R6） */\n  private def viewToDocument(view: ${view}): Document =\n    Document(\n      ${writeEntries}${kindEntry})${bsonStrHelper}\n\n${safeRowDef}  private def rowFromDocument(doc: Document): ${view} = ${view}(\n      ${rowEntries})${codecCode ? `\n\n${codecCode}` : ""}`;
  const bodyOf = (m) => {
    switch (m.name) {
      case "upsert":
        return `viewStore.putDocumentDoc("${collection}", "${keyCol}", ${composite(`view.${scalaId(keyField)}.toString`)}, viewToDocument(view))`;
      case "findByIdentity": {
        const keyParam = keyField;
        const valExpr =
          view === "SubmitKnowledgePatchDecisionView"
            ? keyParam
            : composite(`${keyParam}.toString`);
        if (kv) return `viewStore.findByKeyDoc("${collection}", "${keyCol}", ${valExpr}).map(_.flatMap(safeRowToView))`;
        if (BARE_FIND_BY_KEY.has(view))
          return `viewStore.findByKeyDoc("${collection}", ${keyParam}, ${valExpr}).map(_.flatMap(safeRowToView))`;
        return `viewStore.findByKeyDoc("${collection}", "${keyCol}", ${valExpr}).map(_.flatMap(safeRowToView))`;
      }
      case "findByTenantPaged": {
        if (kv) return `viewStore.findByTenantPagedDoc("${collection}", tenantId, limit, offset, Map("kind" -> "${kv}")).map(rows => rows.flatMap(safeRowToView).toList)`;
        if (view === "ParkConceptDecisionView")
          return `viewStore.findByTenantPagedDoc("${collection}", tenantId, limit, offset, Map.empty).map(rows => rows.flatMap(safeRowToView).toList)`;
        return `viewStore.findByTenantPagedDoc("${collection}", tenantId, limit, offset).map(rows => rows.flatMap(safeRowToView).toList)`;
      }
      case "countByTenant":
        // R7: store-side countDocuments (catalog family carries the kind cond)
        return kv
          ? `viewStore.countByTenant("${collection}", tenantId, Map("kind" -> "${kv}"))`
          : `viewStore.countByTenant("${collection}", tenantId)`;
      case "findAll":
        return `viewStore.findAllDoc("${collection}").map(rows => rows.flatMap(safeRowToView).toList)`;
      default: {
        const conds = [
          ...(kv ? [`"kind" -> "${kv}"`] : []),
          ...m.params.map((prm) => `"${prm.name}" -> ${scalaId(prm.name)}`),
        ];
        return `viewStore.findByFieldsDoc("${collection}", Map(${conds.join(", ")})).map(rows => rows.flatMap(safeRowToView).toList)`;
      }
    }
  };
  const deps = new Set([
    "scala.concurrent.Future",
    "scala.concurrent.ExecutionContext",
    `${TRAIT_PKG}.${view}Repository`,
    "net.imadz.metarch.infrastructure.persistence.mongo.MongoViewStore",
    "org.mongodb.scala.Document",
  ]);
  for (const t of used) deps.add(`org.mongodb.scala.bson.${t}`);
  if ([...used].some((t) => t === "BsonArray")) deps.add("scala.jdk.CollectionConverters._");
  for (const d of codecDeps) deps.add(d);
  for (const f of sortedFields) for (const d of f.resolved.deps) deps.add(d);
  return { bodyOf, deps, extraMembers, ctorParams: [{ name: "viewStore", type: "MongoViewStore" }] };
}

// ── Graph bodies — buildGraph port ──────────────────────────────────
function graphBodies(view, storage) {
  const label = storage.nodeLabel || "";
  const keyName = storage.nodeKey || "";
  const ks = storage.keySpace || "kn";
  const ex = "GraphMutationExecutor";
  const strict = `${ex}.ExecutionMode.Strict`;
  const bodyOf = (m) => {
    switch (m.name) {
      case "upsertNode":
        return `${ex}.apply(${ex}.UpsertNode("${label}", "${keyName}", s"${ks}:$key", props), ${strict})`;
      case "updateNodeProps":
        return `${ex}.apply(${ex}.UpdateNodeProps("${label}", "${keyName}", s"${ks}:$key", props), ${strict})`;
      case "deleteNode":
        return `${ex}.apply(${ex}.DeleteNode("${label}", "${keyName}", s"${ks}:$key", Some(tenantId)), ${strict})`;
      case "mergeLinkTolerant":
        return "??? // CM-11：容忍语义手写面（GraphMutationExecutor Strict+catch·悬空端点弃置）";
      case "mergeEdge": {
        const cases = burnableEdges(storage)
          .map((e) => {
            const toPrefix = !String(e.toKeySpace || "").trim() ? "" : `${e.toKeySpace}:`;
            return `    case "${e.edgeType}" => ("${e.toLabel}", "${e.toKeyId}", "${toPrefix}")`;
          })
          .join("\n");
        return `val (toLabel, toKeyName, toKeyPrefix) = edgeType match {\n${cases}\n    case other => throw new IllegalArgumentException(s"edgeType '$other' 不在 ${view}Repository edgeMappings 白名单")\n}\n${ex}.apply(\n  ${ex}.MergeEdge(edgeType, "${label}", "${keyName}", s"${ks}:$fromKey", toLabel, toKeyName, s"$toKeyPrefix$toKey", Map("tenantId" -> tenantId)),\n  ${strict})`;
      }
      default:
        throw new Error(`graph verb out of vocabulary: ${m.name}`);
    }
  };
  const deps = new Set([
    `${TRAIT_PKG}.${view}Repository`,
    "net.imadz.metarch.infrastructure.graph.GraphMutationExecutor",
    "scala.collection.immutable.Map",
  ]);
  return { bodyOf, deps, extraMembers: null, ctorParams: null };
}

// ── Vector bodies — buildVector port ────────────────────────────────
function vectorBodies(view, fields, storage) {
  const sortedFields = [...fields].sort((a, b) => (a.name < b.name ? -1 : 1));
  const table = storage.table || `${view.toLowerCase()}_table`;
  const embeddingCol = storage.embeddingColumn || "embedding";
  const model = (storage.embedding && storage.embedding.model) || "";
  const dims = storage.dims || 0;
  const keyFields = fields.filter((f) => f.isKey).map((f) => f.name).sort();
  const columns = sortedFields.map((f) => snake(f.name));
  const upsertLogic = `// 投影内同步嵌入（M3 拍板）：embedText → ${model}(${dims}d) → pgvector 行 upsert\nval embedding = embeddingClient.embed(view.embedText)\npgVectorStore.upsert(\n  table = "${table}",\n  columns = Seq(\n    ${sortedFields.map((f) => `"${snake(f.name)}" -> view.${scalaId(f.name)}`).join(",\n    ")}),\n  embeddingColumn = "${embeddingCol}",\n  embedding = embedding,\n  keyColumns = Seq(${keyFields.map((k) => `"${snake(k)}"`).join(", ")}))`;
  const deleteLogic = `// 删除事件折叠（fold 词表 view.delete）：sourceId 全局唯一，按 (sourceType, sourceId) 删行\npgVectorStore.delete(\n  table = "${table}",\n  sourceType = sourceType,\n  sourceId = sourceId)`;
  const identityLogic = `Future {\n  pgVectorStore.findByKeys(\n    table = "${table}",\n    keys = Map(${keyFields.map((k) => `"${snake(k)}" -> ${scalaId(k)}`).join(", ")}),\n    columns = ViewColumns)\n    .map(rowToView)\n}`;
  const searchLogic = `Future {\n  pgVectorStore.search(\n    table = "${table}",\n    tenantId = tenantId,\n    queryEmbedding = queryEmbedding,\n    k = k,\n    sourceType = sourceType,\n    columns = ViewColumns)\n    .map(rowToView)\n}`;
  const extraMembers = `private val ViewColumns: Seq[String] = Seq(${columns.map((c) => `"${c}"`).join(", ")})\n\n  /** 行 Map（PgVectorStore 按列名返回）→ DTO 映射（embedding 列不出检索面） */\n  private def rowToView(row: Map[String, Any]): ${view} = ${view}(\n    ${sortedFields.map((f) => `${scalaId(f.name)} = row("${snake(f.name)}").asInstanceOf[${f.resolved.sig}]`).join(",\n    ")})`;
  const bodyOf = (m) =>
    ({ upsert: upsertLogic, findByIdentity: identityLogic, delete: deleteLogic, search: searchLogic })[m.name];
  const deps = new Set([
    "scala.concurrent.Future",
    "scala.concurrent.ExecutionContext",
    `${TRAIT_PKG}.${view}Repository`,
    "net.imadz.metarch.infrastructure.persistence.vector.PgVectorStore",
    "net.imadz.metarch.infrastructure.persistence.vector.OllamaEmbeddingClient",
  ]);
  return {
    bodyOf,
    deps,
    extraMembers,
    ctorParams: [
      { name: "pgVectorStore", type: "PgVectorStore" },
      { name: "embeddingClient", type: "OllamaEmbeddingClient" },
    ],
  };
}

// ── Phase 2 R10: index/DDL emitters (Q5/Q9) ─────────────────────────
// SQL DDL for every SQL-backed view: main table + list sub-tables, with the
// three index tiers adjudicated in Q5 (primary key, tenantId on every view,
// finder-field secondary indexes, (tenantId, first key) paging composite).
// Style follows the golden conf/sql/2.sql (backticked identifiers, epoch
// BIGINT for instants, TINYINT(1) booleans, TEXT for prose-named columns).
const SQL_COL_TYPE = (f) => {
  const r = f.resolved;
  switch (r.kind) {
    case "Int": return "INT";
    case "Long": return "BIGINT";
    case "Instant": return "BIGINT";
    case "Boolean": return "TINYINT(1)";
    case "BigDecimal": return "DECIMAL(19,4)";
    case "Double": return "DOUBLE";
    default:
      return /^(content|description|info|text|body|summary)$/i.test(f.name) || /Json$/.test(f.name)
        ? "TEXT"
        : "VARCHAR(255)";
  }
};
export function generateViewDdl(canonical, basePkg = "net.imadz.metarch") {
  const { fieldsByView, storageByView, viewNames, voByName } = indexCanonical(canonical);
  const blocks = [];
  for (const view of viewNames) {
    const fields = fieldsByView.get(view) || [];
    if (!fields.length) continue;
    const storage = storageByView.get(view) || {};
    if ((storage.kind || "sql") !== "sql") continue;
    for (const f of fields) if (!f.resolved) f.resolved = resolveFieldType(f, basePkg);
    const keys = fields.filter((f) => f.isKey).map((f) => f.name);
    const table = `${view.toLowerCase()}_table`;
    const scalars = fields.filter((f) => f.resolved.kind !== "List");
    const lists = fields.filter((f) => f.resolved.kind === "List");
    const colDefs = scalars.map((f) => `  \`${f.name}\` ${SQL_COL_TYPE(f)}`).join(",\n");
    const pk = keys.map((k) => `\`${k}\``).join(", ");
    const idx = [];
    if (fields.some((f) => f.name === "tenantId")) idx.push(`  INDEX \`idx_${table}_tenant\` (\`tenantId\`)`);
    for (const f of scalars) {
      if (f.isKey || f.name === "tenantId") continue;
      if (/_id$/i.test(f.name) || /Id$/.test(f.name)) idx.push(`  INDEX \`idx_${table}_${f.name.toLowerCase()}\` (\`${f.name}\`)`);
    }
    if (fields.some((f) => f.name === "tenantId") && keys.length)
      idx.push(`  INDEX \`idx_${table}_tenant_page\` (\`tenantId\`, ${pk})`);
    blocks.push(
      `CREATE TABLE IF NOT EXISTS \`${table}\` (\n${colDefs},\n  PRIMARY KEY (${pk})${idx.length ? ",\n" + idx.join(",\n") : ""}\n);`
    );
    for (const f of lists) {
      const sub = `${view.toLowerCase()}_${f.name.toLowerCase()}_table`;
      const inner = f.resolved.inner;
      let valCols;
      if (inner.kind === "VO") {
        const vo = voByName.get(inner.sig);
        valCols = (vo ? vo.fields : []).map(
          (mf) => `  \`${mf.name}\` ${SQL_COL_TYPE({ name: mf.name, resolved: resolveType(mf.dataType, basePkg) })}`
        );
      } else {
        valCols = [`  \`value\` ${SQL_COL_TYPE({ name: "value", resolved: inner })}`];
      }
      const keyCols = keys.map((k) => {
        const kf = fields.find((x) => x.name === k);
        return `  \`${k}\` ${SQL_COL_TYPE(kf)}`;
      });
      const subIdx = [`  INDEX \`idx_${sub}_value\` (${inner.kind === "VO" ? valCols.map((c) => c.trim().split(" ")[0]).join(", ") : "`value`"})`];
      blocks.push(
        `CREATE TABLE IF NOT EXISTS \`${sub}\` (\n${[...keyCols, "  `idx` INT", ...valCols].join(",\n")},\n  PRIMARY KEY (${pk}, \`idx\`)${subIdx.length ? ",\n" + subIdx.join(",\n") : ""}\n);`
      );
    }
  }
  if (!blocks.length) return null;
  return {
    path: "conf/sql/view-tables.sql",
    content:
      `-- @generated by CodegenMain:225ed28b\n-- Source: read-model storage declarations (truth tree) — Phase 2 structured read models\n-- MySQL dialect; H2 test-compatible (list fields live in sub-tables, Q1/Q2 裁决)\n\n` +
      blocks.join("\n\n") +
      "\n",
  };
}

// Mongo index spec: emitted as a bootstrap constant list (Q9). Collections
// are de-duplicated (the catalog family shares one collection, told apart by
// the keyField "_id" + kind); field indexes cover tenantId and finder fields.
export function generateMongoIndexSpec(canonical, basePkg = "net.imadz.metarch") {
  const { fieldsByView, storageByView, viewNames } = indexCanonical(canonical);
  const collections = new Map(); // collection -> keyField
  const fieldIndexes = new Map(); // "collection|field" -> true
  for (const view of viewNames) {
    const fields = fieldsByView.get(view) || [];
    if (!fields.length) continue;
    const storage = storageByView.get(view) || {};
    if (storage.kind !== "mongo") continue;
    const coll = storage.collection || "";
    if (!coll) continue;
    const keyField = storage.kindValue ? "_id" : storage.keyField || "";
    if (!collections.has(coll)) collections.set(coll, keyField);
    if (fields.some((f) => f.name === "tenantId")) fieldIndexes.set(`${coll}|tenantId`, true);
    for (const f of fields) {
      if (f.isKey || f.name === "tenantId") continue;
      if (/_id$/i.test(f.name) || /Id$/.test(f.name)) fieldIndexes.set(`${coll}|${f.name}`, true);
    }
  }
  if (!collections.size) return null;
  const collLines = [...collections.entries()]
    .sort()
    .map(([c, k]) => `    ("${c}", "${k}")`)
    .join(",\n");
  const idxLines = [...fieldIndexes.keys()]
    .sort()
    .map((s) => {
      const [c, f] = s.split("|");
      return `    ("${c}", "${f}")`;
    })
    .join(",\n");
  return {
    path: "app/net/imadz/metarch/infrastructure/persistence/mongo/MongoViewIndexSpec.scala",
    content:
      `// @generated by CodegenMain:225ed28b\n// @knowledge-release 1.0.0\npackage net.imadz.metarch.infrastructure.persistence.mongo\n\n/** Mongo 读模型索引规格（Phase 2 Q5/Q9：生成器从树派生·bootstrap 时按此清单 ensureIndex）。\n  * collections：(collection, keyField)——目录族 6 合 1 时 keyField 为 "_id"（含 kind 前缀）。\n  * fieldIndexes：(collection, field)——tenantId 全视图 + finder 字段二级索引。 */\nobject MongoViewIndexSpec {\n\n  val collections: List[(String, String)] = List(\n${collLines}\n  )\n\n  val fieldIndexes: List[(String, String)] = List(\n${idxLines}\n  )\n}\n`,
  };
}

// ── entry point ─────────────────────────────────────────────────────
export function generateViewRepos(canonical, basePkg = "net.imadz.metarch") {
  const { fieldsByView, storageByView, viewNames, voByName } = indexCanonical(canonical);
  const out = [];
  for (const view of viewNames) {
    const fields = fieldsByView.get(view) || [];
    if (!fields.length) continue;
    // resolve types once (renderers share f.resolved)
    for (const f of fields) if (!f.resolved) f.resolved = resolveFieldType(f, basePkg);
    const storage = storageByView.get(view) || {};
    const kind = storage.kind === "mongo" ? "mongo" : storage.kind === "graph" ? "graph" : storage.kind === "vector" ? "vector" : "sql";
    const implName =
      kind === "mongo" ? `${view}MongoRepositoryImpl` : `${view}RepositoryImpl`;
    let methods, impl;
    if (kind === "graph") {
      methods = graphMethods(view, fields, storage);
      impl = graphBodies(view, storage);
    } else if (kind === "vector") {
      methods = vectorMethods(view);
      impl = vectorBodies(view, fields, storage);
    } else {
      const t = tableMethods(view, fields);
      // Phase 2 R3: SQL traits gain the tenant paged/count pair and element
      // finders for queryable list fields (appended after the table methods,
      // mirroring the Mongo extra-methods layout).
      methods =
        kind === "mongo"
          ? [...t.methods, ...mongoExtraMethods(view, fields)]
          : [...t.methods, ...mongoExtraMethods(view, fields), ...elementFinders(view, fields)];
      impl =
        kind === "mongo"
          ? mongoBodies(view, fields, storage, voByName, basePkg)
          : sqlBodies(view, fields, t.keys, voByName, basePkg);
    }
    out.push({
      path: `app/net/imadz/metarch/application/projection/repository/${view}Repository.scala`,
      content: renderTrait(view, fields, methods, implName, kind, basePkg),
    });
    out.push({
      path: `app/net/imadz/metarch/infrastructure/repositories/projection/${implName}.scala`,
      content: renderImpl(view, fields, methods, implName, kind, basePkg, impl.bodyOf, impl.extraMembers, impl.ctorParams, impl.deps),
    });
  }
  return out;
}
