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
    const desc = withDesc && f.description ? ` ${f.description}` : "";
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
  return { fieldsByView, storageByView, viewNames };
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

function graphMethods(view, storage) {
  const label = storage.nodeLabel || "";
  const props = { name: "props", type: "Map[String, String]" };
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
    f.resolved = resolveType(f.dataType, basePkg);
    for (const d of f.resolved.deps) dtoDeps.add(d);
  }
  const dtoSig = (f) =>
    f.resolved.kind === "Instant" && view !== PAUSE_VIEW ? "Option[Instant]" : f.resolved.sig;
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
  const dtoCompanion = `object ${view}Table {\n${dtoDoc}case class ${view}(${dtoParams}) {\n\n}\n}`;
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
function sqlBodies(view, fields, keys) {
  const sortedFields = [...fields].sort((a, b) => (a.name < b.name ? -1 : 1));
  const table = `${view.toLowerCase()}_table`;
  const bareInstant = view === PAUSE_VIEW;
  const bindExpr = (f) => {
    const fid = scalaId(f.name);
    const r = f.resolved;
    if (r.kind === "Instant")
      return bareInstant
        ? `(if (view.${fid} == null) null else java.lang.Long.valueOf(view.${fid}.toEpochMilli))`
        : `(view.${fid}.map(x => java.lang.Long.valueOf(x.toEpochMilli)).orNull)`;
    if (r.kind === "List") return `Json.toJson(view.${fid}).toString()`;
    if (r.kind === "Id") return `view.${fid}.toString`;
    return `view.${fid}`;
  };
  const readExpr = (f) => {
    const col = f.name;
    const r = f.resolved;
    if (r.kind === "Int") return `rs.int("${col}")`;
    if (r.kind === "Long") return `rs.long("${col}")`;
    if (r.kind === "Boolean") return `rs.boolean("${col}")`;
    if (r.kind === "BigDecimal") return `rsBigDecimal("${col}")`;
    if (r.kind === "Instant") {
      const e = `rs.longOpt("${col}").map(java.time.Instant.ofEpochMilli)`;
      return bareInstant ? `${e}.orNull` : e;
    }
    if (r.kind === "List") return `Json.parse(rs.string("${col}")).as[List[${r.inner.sig}]]`;
    if (r.kind === "Id") return `Id.of(rs.string("${col}"))`;
    return `rs.string("${col}")`;
  };
  const colList = sortedFields.map((f) => "`" + f.name + "`").join(", ");
  const bodyOf = (m) => {
    if (m.name === "upsert") {
      const placeholders = sortedFields.map(() => "?").join(", ");
      const updates = sortedFields
        .map((f) => f.name)
        .filter((n) => !keys.includes(n))
        .map((c) => "`" + c + "` = VALUES(`" + c + "`)")
        .join(", ");
      const binds = sortedFields.map(bindExpr).join(",\n          ");
      return `DB.localTx { implicit session =>\n  sql"""INSERT INTO ${table}\n        (${colList})\n        VALUES (${placeholders})\n        ON DUPLICATE KEY UPDATE ${updates}"""\n    .bind(\n          ${binds}\n        )\n    .update.apply()\n}`;
    }
    const terminal = m.ret.includes("Option[") ? "headOption" : "list";
    const where = m.params.length
      ? `\n              WHERE ${m.params.map((prm) => "`" + prm.name + "` = ?").join(" AND ")}`
      : "";
    const bindClause = m.params.length ? `\n          .bind(${m.params.map((prm) => scalaId(prm.name)).join(", ")})` : "";
    const mapBody = sortedFields.map((f) => `${scalaId(f.name)} = ${readExpr(f)}`).join(",\n            ");
    return `Future {\n      DB readOnly { implicit session =>\n        sql"""SELECT ${colList}\n              FROM ${table}${where}"""${bindClause}\n          .map(rs => ${view}(\n            ${mapBody}\n          ))\n          .${terminal}.apply()\n      }\n    }`;
  };
  const deps = new Set(["scala.concurrent.Future", "scala.concurrent.ExecutionContext", `${TRAIT_PKG}.${view}Repository`]);
  if (sortedFields.some((f) => f.resolved.kind === "List")) deps.add("play.api.libs.json.Json");
  if (sortedFields.some((f) => f.resolved.kind === "Id")) deps.add("net.imadz.common.Id");
  for (const f of sortedFields) {
    if (f.resolved.kind === "List" && f.resolved.inner) for (const d of f.resolved.inner.deps) deps.add(d);
  }
  return { bodyOf, deps, extraMembers: null, ctorParams: null };
}

// ── Mongo bodies — buildMongo port ──────────────────────────────────
function mongoBodies(view, fields, storage) {
  const sortedFields = [...fields].sort((a, b) => (a.name < b.name ? -1 : 1));
  const collection = storage.collection || "";
  const keyField = storage.keyField || "";
  const kv = storage.kindValue || "";
  const keyCol = kv ? "_id" : keyField;
  const keyFieldType = (fields.find((f) => f.name === keyField) || {}).resolved;
  const composite = (expr) => (kv ? `"${kv}:" + ${expr}` : expr);
  const writeExpr = (f) => {
    const fid = scalaId(f.name);
    if (f.resolved.kind === "Instant") return `view.${fid}.map(x => JsString(x.toString))`;
    if (f.resolved.kind === "Id") return `(if (view.${fid} == null) JsNull else Json.toJson(view.${fid}))`;
    return `Json.toJson(view.${fid})`;
  };
  const readExpr = (f) => {
    const j = `(v ${BS2} "${f.name}")`;
    if (f.resolved.kind === "Instant")
      return `${j}.asOpt[Long].map(java.time.Instant.ofEpochMilli).orElse(${j}.asOpt[String].map(java.time.Instant.parse))`;
    if (f.resolved.kind === "Id") return `${j}.asOpt[${f.resolved.sig}].getOrElse(null)`;
    if (f.resolved.kind === "List") return `${j}.asOpt[List[${f.resolved.inner.sig}]].getOrElse(Nil)`;
    return `${j}.as[${f.resolved.sig}]`;
  };
  const kindEntry = kv ? `,\n      "kind" -> JsString("${kv}")` : "";
  const safeRowDef = kv
    ? `  /** [6合1 kind 判别式] decode 前 kind 门——同 collection 多视图列同形不设防＝静默混族读：\n    * kind 不匹配按毒行跳过（与字段级 decode 失败同路径） */\n  private def safeRowToView(json: String): Option[${view}] =\n    for {\n      v <- scala.util.Try(play.api.libs.json.Json.parse(json)).toOption\n      k <- (v ${BS2}${BS2} "kind").headOption.flatMap(_.asOpt[String]) if k == "${kv}"\n      row <- scala.util.Try(rowToView(v)).toOption\n    } yield row\n\n`
    : `  /** JSON 串 → DTO·毒行隔离 wrapper（S9 反例验证 2026-10-08：decode 失败＝单行披露跳过不炸集合——\n    * guards 型全表 500 事故的 Mongo 路免疫面；对照 store 侧 docsToJsons 只挡 toJson 失败，本层挡字段级 decode 失败） */\n  private def safeRowToView(json: String): Option[${view}] =\n    scala.util.Try(rowToView(json)).toOption\n\n`;
  const rowEntries = sortedFields.map((f) => `${scalaId(f.name)} = ${readExpr(f)}`).join(",\n      ");
  const rowToViewDef = kv
    ? `  private def rowToView(v: play.api.libs.json.JsValue): ${view} = ${view}(\n      ${rowEntries})`
    : `  private def rowToView(json: String): ${view} = {\n    val v = play.api.libs.json.Json.parse(json)\n    ${view}(\n      ${rowEntries})\n  }`;
  const writeEntries = sortedFields.map((f) => `"${f.name}" -> ${writeExpr(f)}`).join(",\n      ");
  const extraMembers = `/** DTO → JSON 串（视图行整取整写——Mongo 文档载体；字段级显式 codec） */\n  private def viewToJson(view: ${view}): String =\n    play.api.libs.json.Json.stringify(play.api.libs.json.Json.obj(\n      ${writeEntries}${kindEntry}))\n\n${safeRowDef}${rowToViewDef}`;
  const bodyOf = (m) => {
    switch (m.name) {
      case "upsert":
        return `viewStore.putDocument("${collection}", "${keyCol}", ${composite(`view.${scalaId(keyField)}.toString`)}, viewToJson(view))`;
      case "findByIdentity": {
        const keyParam = keyField;
        const valExpr =
          view === "SubmitKnowledgePatchDecisionView"
            ? keyParam
            : composite(`${keyParam}.toString`);
        if (kv) return `viewStore.findByKey("${collection}", "${keyCol}", ${valExpr}).map(_.flatMap(safeRowToView))`;
        if (BARE_FIND_BY_KEY.has(view))
          return `viewStore.findByKey("${collection}", ${keyParam}, ${valExpr}).map(_.flatMap(safeRowToView))`;
        return `viewStore.findByKey("${collection}", "${keyCol}", ${valExpr}).map(_.flatMap(safeRowToView))`;
      }
      case "findByTenantPaged": {
        if (kv) return `viewStore.findByTenantPaged("${collection}", tenantId, limit, offset, Map("kind" -> "${kv}")).map(rows => rows.flatMap(safeRowToView).toList)`;
        if (view === "ParkConceptDecisionView")
          return `viewStore.findByTenantPaged("${collection}", tenantId, limit, offset, Map.empty).map(rows => rows.flatMap(safeRowToView).toList)`;
        return `viewStore.findByTenantPaged("${collection}", tenantId, limit, offset).map(rows => rows.flatMap(safeRowToView).toList)`;
      }
      case "countByTenant":
        return `viewStore.findAll("${collection}").map(rows => rows.flatMap(safeRowToView).count(_.tenantId == tenantId))`;
      case "findAll":
        return `viewStore.findAll("${collection}").map(rows => rows.flatMap(safeRowToView).toList)`;
      default: {
        const conds = [
          ...(kv ? [`"kind" -> "${kv}"`] : []),
          ...m.params.map((prm) => `"${prm.name}" -> ${scalaId(prm.name)}`),
        ];
        return `viewStore.findByFields("${collection}", Map(${conds.join(", ")})).map(rows => rows.flatMap(safeRowToView).toList)`;
      }
    }
  };
  const deps = new Set([
    "scala.concurrent.Future",
    "scala.concurrent.ExecutionContext",
    `${TRAIT_PKG}.${view}Repository`,
    "net.imadz.metarch.infrastructure.persistence.mongo.MongoViewStore",
    "play.api.libs.json.Json",
    "play.api.libs.json.JsString",
  ]);
  if (sortedFields.some((f) => f.resolved.kind === "Id")) deps.add("play.api.libs.json.JsNull");
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

// ── entry point ─────────────────────────────────────────────────────
export function generateViewRepos(canonical, basePkg = "net.imadz.metarch") {
  const { fieldsByView, storageByView, viewNames } = indexCanonical(canonical);
  const out = [];
  for (const view of viewNames) {
    const fields = fieldsByView.get(view) || [];
    if (!fields.length) continue;
    // resolve types once (renderers share f.resolved)
    for (const f of fields) if (!f.resolved) f.resolved = resolveType(f.dataType, basePkg);
    const storage = storageByView.get(view) || {};
    const kind = storage.kind === "mongo" ? "mongo" : storage.kind === "graph" ? "graph" : storage.kind === "vector" ? "vector" : "sql";
    const implName =
      kind === "mongo" ? `${view}MongoRepositoryImpl` : `${view}RepositoryImpl`;
    let methods, impl;
    if (kind === "graph") {
      methods = graphMethods(view, storage);
      impl = graphBodies(view, storage);
    } else if (kind === "vector") {
      methods = vectorMethods(view);
      impl = vectorBodies(view, fields, storage);
    } else {
      const t = tableMethods(view, fields);
      methods = kind === "mongo" ? [...t.methods, ...mongoExtraMethods(view, fields)] : t.methods;
      impl = kind === "mongo" ? mongoBodies(view, fields, storage) : sqlBodies(view, fields, t.keys);
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
