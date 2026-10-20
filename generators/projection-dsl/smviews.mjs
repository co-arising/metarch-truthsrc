// === projection-dsl/smviews — STORYMAPPING-VIEW family (B-SMVIEWS) ===
// Pure generator for the 10 storyMapping-stage readModel notes that were
// never promoted to canonical.readModels:
//   graph  (8): CatalogGraphView, ConceptGraphView, ConceptEdgeGraphView,
//               ContextGraphView, ContextRelationGraphView, NoteGraphView,
//               QuestionGraphView, SubdomainGraphView
//   vector (1): KnowledgeSemanticView (multi-source Note+Concept, M3 shape)
//   lookup (1): UserLookupByEmailOrPhoneView (no info.storage; identityKeys)
//
// generateSmViews(canonical) -> [{ path, content }]
// Paths are project-root relative (app/net/imadz/metarch/application/...).
//
// Wiring rule (derived, golden-verified): a view's handler set = its sm
// note's `links` event entries, deduped, in link order, partitioned by the
// event's owning aggregate (canonical aggregates event pool). This matches
// the DecisionView rule for single-source views and extends it to the one
// multi-source view (KnowledgeSemanticView: Note flow + Concept flow).
// View shells reuse projection-dsl/emit.mjs templates verbatim (standard /
// single-handler / M3 multi-aggregate variants).
//
// Handler MANUAL bodies:
//   - graph.* upsertNode/updateNodeProps/deleteNode/mergeEdge refCodes and
//     vector view.copy/view.delete refCodes are translated mechanically
//     from info.projectionRefCodes (see translators below) — RAW-identical.
//   - G-residual bodies (golden is hand-written logic not derivable from
//     canonical data) emit the standard `???` MANUAL stub — strip-identical
//     only. Residual triggers: graph.manual(...) refCodes; prose refCodes
//     (UserLookup); duplicate prop keys in a graph refCode (lossy);
//     non-scalar prop values (List/VO payloads cannot fold into
//     Map[String,String] mechanically).

const BASE_PKG = "net.imadz.metarch";
const PKG = `${BASE_PKG}.application.projection`;

const sorted = (arr) => [...arr].sort();
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
// acronym-aware snake (same rule as projection-dsl/emit.mjs)
const projectionIdOf = (viewName) =>
  viewName
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
const protoPkgOf = (aggName) =>
  aggName.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();

// ── canonical indexing ─────────────────────────────────────────────────────
function indexCanonical(canonical) {
  const notes = [];
  for (const session of canonical.sessions || [])
    for (const scope of session.scopes || [])
      for (const note of scope.notes || []) notes.push(note);
  const eventOwner = new Map(); // eventName -> aggregate object
  const eventPayloadTypes = new Map(); // "Agg|Event" -> Map(field->dataType)
  for (const a of canonical.aggregates || []) {
    for (const e of a.events || []) {
      if (!eventOwner.has(e.name)) eventOwner.set(e.name, a);
      const m = new Map((e.payloads || []).map((p) => [p.name, p.dataType]));
      eventPayloadTypes.set(`${a.name}|${e.name}`, m);
    }
  }
  const promoted = new Set((canonical.readModels || []).map((r) => r.name));
  // storyMapping-stage readModel notes not promoted to canonical.readModels
  const smNotes = new Map();
  for (const n of notes) {
    if (n.type !== "readModel" || !n.name) continue;
    if (n.stage && n.stage !== "storyMapping") continue;
    if (promoted.has(n.name)) continue;
    if (!smNotes.has(n.name)) smNotes.set(n.name, n);
  }
  return { eventOwner, eventPayloadTypes, smNotes };
}

// Per-view wiring: source aggregates in link order; per-source events in
// link order (deduped).
function wiringOf(note, eventOwner) {
  const aggOrder = [];
  const linkedEvents = [];
  for (const l of note.links || []) {
    if (typeof l !== "string") continue;
    if (l.startsWith("aggregate:")) {
      const a = l.slice("aggregate:".length);
      if (!aggOrder.includes(a)) aggOrder.push(a);
    } else if (l.startsWith("event:")) {
      const e = l.slice("event:".length);
      if (!linkedEvents.includes(e)) linkedEvents.push(e);
    }
  }
  const sources = aggOrder.map((aggName) => ({
    aggName,
    events: linkedEvents.filter(
      (e) => eventOwner.get(e) && eventOwner.get(e).name === aggName
    ),
  }));
  return sources.filter((s) => s.events.length);
}

// ── refCode parsing helpers ────────────────────────────────────────────────
// split "k = v, k2 = v2" on top-level commas that precede a new key
function splitArgs(s) {
  const parts = [];
  let depth = 0, cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{" || ch === "(") depth++;
    if (ch === "}" || ch === ")") depth--;
    if (ch === "," && depth === 0 && /^\s*[A-Za-z_`][\w`]*\s*=/.test(s.slice(i + 1))) {
      parts.push(cur.trim()); cur = ""; continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.map((p) => {
    const eq = p.indexOf("=");
    return { key: p.slice(0, eq).trim(), value: p.slice(eq + 1).trim() };
  });
}

const NON_SCALAR = /^(List|Array|Seq|Map|Set)</;
const TOSTRING_TYPES = new Set([
  "Integer", "Int", "Long", "Double", "Float", "Boolean", "Bool",
  "Instant", "Datetime", "BigDecimal", "Decimal", "Number", "Timestamp",
]);
function baseType(t) {
  let s = String(t || "").trim();
  const m = s.match(/^(?:List|Array|Option|Seq)<(.*)>$/);
  if (m) return baseType(m[1]);
  return s.replace(/\s*\(.*\)$/, "").trim();
}
// graph prop value: event.f -> po.f (+ .toString for non-String proto scalars)
function graphValue(value, fieldTypes) {
  if (value.startsWith('"')) return { text: value, scalar: true };
  const m = value.match(/^event\.(`?\w+`?)(?:\.(\w+))?$/);
  if (!m) return { text: value, scalar: false };
  const field = m[1].replace(/`/g, "");
  if (m[2]) return { text: `po.${m[1]}.${m[2]}`, scalar: false }; // e.g. .size
  const rawType = fieldTypes ? fieldTypes.get(field) : null;
  if (rawType && NON_SCALAR.test(String(rawType).trim()))
    return { text: `po.${m[1]}`, scalar: false };
  const bt = baseType(rawType);
  return {
    text: TOSTRING_TYPES.has(bt) ? `po.${m[1]}.toString` : `po.${m[1]}`,
    scalar: true,
  };
}

// ── MANUAL body translators ────────────────────────────────────────────────
// Returns { lines: [...] } for mechanical bodies, or { residual: reason }.
function translateGraph(refCode, ctx) {
  if (refCode.includes("graph.manual("))
    return { residual: "graph.manual(...) refCode — hand-written body in golden" };
  const segments = refCode.split(/;\s*(?=graph\.)/).map((s) => s.trim());
  const calls = [];
  let nodeKeyField = null;
  for (const seg of segments) {
    let m;
    if ((m = seg.match(/^graph\.(upsertNode|updateNodeProps)\(key = event\.(`?\w+`?),\s*props = \{([\s\S]*)\}\)$/))) {
      const [, op, keyField, propsStr] = m;
      nodeKeyField = keyField;
      const args = splitArgs(propsStr);
      const keys = args.map((a) => a.key);
      if (new Set(keys).size !== keys.length)
        return { residual: `duplicate prop keys in refCode (${keys.join(",")}) — refCode is lossy vs golden body` };
      const pairs = [];
      for (const a of args) {
        const v = graphValue(a.value, ctx.fieldTypes);
        if (!v.scalar)
          return { residual: `non-scalar prop value '${a.key} = ${a.value}' — cannot fold into Map[String,String] mechanically` };
        pairs.push(`"${a.key}" -> ${v.text}`);
      }
      calls.push(`${ctx.repoVar}.${op}(po.${keyField}, Map(${pairs.join(", ")}))`);
    } else if ((m = seg.match(/^graph\.deleteNode\(key = event\.(`?\w+`?),\s*tenantId = event\.tenantId\)$/))) {
      calls.push(`${ctx.repoVar}.deleteNode(po.${m[1]}, po.tenantId)`);
    } else if ((m = seg.match(/^graph\.mergeEdge\(edgeType = "([^"]+)",\s*toKey = event\.(`?\w+`?)\)$/))) {
      if (!nodeKeyField)
        return { residual: "mergeEdge without preceding node op — no from-key derivable" };
      calls.push(`${ctx.repoVar}.mergeEdge("${m[1]}", po.${nodeKeyField}, po.${m[2]}, po.tenantId)`);
    } else {
      return { residual: `unparseable graph refCode segment: ${seg.slice(0, 80)}` };
    }
  }
  if (!calls.length) return { residual: "empty graph refCode" };
  calls[calls.length - 1] +=
    " // 结构（label/keyName/keySpace 前缀/端点 match）烧在 ④Impl——Strict 悬空停车场";
  return {
    lines: [
      `        // 图投影意图（元数据 referenceCode·graph 方言）：${refCode}`,
      `        event match {`,
      `          case ${ctx.protoObj}.Event.${ctx.eventName}(po) =>`,
      ...calls.map((c) => `            ${c}`),
      `          case _ => () // 非本投影关注事件`,
      `        }`,
    ],
  };
}

function stripStrOr(v) {
  const m = v.match(/^strOr\((.*)\)$/);
  return m ? m[1] : v;
}
function copyArgsOf(refCode) {
  const start = refCode.indexOf("copy(");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start + 4; i < refCode.length; i++) {
    if (refCode[i] === "(") depth++;
    if (refCode[i] === ")") { depth--; if (depth === 0) return refCode.slice(start + 5, i); }
  }
  return null;
}
function translateVector(refCode, ctx) {
  let m;
  if ((m = refCode.match(/^view\.delete\(([\s\S]*)\)$/))) {
    const args = splitArgs(m[1]);
    const st = args.find((a) => a.key === "sourceType");
    const si = args.find((a) => a.key === "sourceId");
    if (!st || !si) return { residual: "view.delete missing sourceType/sourceId" };
    const siField = si.value.replace(/^event\./, "");
    return {
      lines: [
        `        // 删除事件折叠（fold 词表 view.delete·元数据 referenceCode）：${refCode}`,
        `        event match {`,
        `          case ${ctx.protoObj}.Event.${ctx.eventName}(po) =>`,
        `            ${ctx.repoVar}.delete(${st.value}, po.${siField}) // (sourceType, sourceId) 删行——sourceId 全局唯一·租户门由行键承载`,
        `          case _ => () // 非本投影关注事件`,
        `        }`,
      ],
    };
  }
  const argsStr = copyArgsOf(refCode);
  if (argsStr != null && /(^|\s)view\.copy\(|(^|\s)row\.copy\(/.test(refCode)) {
    const args = splitArgs(argsStr).map((a) => ({ key: a.key, value: stripStrOr(a.value) }));
    // golden MANUAL header drops backtick quoting (event.`type` -> event.type);
    // the body copy keeps it (po.`type`).
    const headerArgs = args.map((a) => `${a.key} = ${a.value.replace(/`/g, "")}`).join(", ");
    const bodyArgs = args
      .map((a) => `${a.key} = ${a.value.replace(/^event\./, "po.")}`)
      .join(", ");
    const st = args.find((a) => a.key === "sourceType");
    const si = args.find((a) => a.key === "sourceId");
    if (!st || !si) return { residual: "view.copy missing sourceType/sourceId" };
    const siField = si.value.replace(/^event\./, "");
    return {
      lines: [
        `        // 投影意图（元数据 referenceCode）：view.copy(${headerArgs})`,
        `        event match {`,
        `          case ${ctx.protoObj}.Event.${ctx.eventName}(po) =>`,
        `            val existing = scala.concurrent.Await.result(${ctx.repoVar}.findByIdentity(po.tenantId, ${st.value}, po.${siField}), scala.concurrent.duration.Duration("10s"))`,
        `            val view = existing.getOrElse(net.imadz.metarch.application.projection.repository.KnowledgeSemanticViewTable.KnowledgeSemanticView(`,
        `                  tenantId = "", sourceType = "", sourceId = "", name = "", kind = "", embedText = "", meta = ""`,
        `                )).copy(${bodyArgs})`,
        `            ${ctx.repoVar}.upsert(view) // 投影内同步嵌入（bge-m3·1024d）在 Impl upsert 内完成——M3 拍板`,
        `          case _ => () // 非本投影关注事件`,
        `        }`,
      ],
    };
  }
  return { residual: `unparseable vector refCode: ${refCode.slice(0, 80)}` };
}

function manualBodyFor(note, viewName, eventName, ctx) {
  const refCode = (note.info && note.info.projectionRefCodes || {})[eventName];
  if (!refCode) return { residual: "no projectionRefCodes entry for event" };
  const kind = note.info && note.info.storage && note.info.storage.kind;
  if (kind === "graph") return translateGraph(refCode, ctx);
  if (kind === "vector") return translateVector(refCode, ctx);
  return { residual: "lookup view — refCode is prose, golden body is hand-written re-key/status logic" };
}

// ── view shells (ported verbatim from projection-dsl/emit.mjs) ────────────
function singleSourceView(v) {
  const { viewName, aggregateName, entityName, protoPkg, protoObj, events } = v;
  const protoEventType = `${protoObj}.Event`;
  const repositoryName = `${viewName}Repository`;
  const projectionId = projectionIdOf(viewName);
  const handlerImports = sorted(events.map((e) =>
    `import ${PKG}.handlers.${viewName}On${e}Handler`)).join("\n");
  const eventImports = sorted(events.map((e) =>
    `import ${BASE_PKG}.domain.entities.${entityName}.${e}`)).join("\n");
  const handlerNews = events.map((e) =>
    `        new ${viewName}On${e}Handler(repository)`).join(",\n");
  const compositeParams = events.map((e) =>
    `    ${lowerFirst(e)}: ${viewName}On${e}Handler`).join(",\n");
  const matchCases = events.map((e) =>
    `        case ${protoEventType}.${e}(_) => ${lowerFirst(e)}.process(session, envelope)`).join("\n");
  const text = `// @generated by CodegenMain:225ed28b
// @knowledge-release 1.0.0
package ${PKG}

import akka.actor.typed.ActorSystem
import akka.actor.typed.ActorSystem
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import akka.contrib.persistence.mongodb.MongoReadJournal
import akka.contrib.persistence.mongodb.MongoReadJournal
import akka.persistence.query.Offset
import akka.projection.Projection
import akka.projection.ProjectionId
import akka.projection.eventsourced.EventEnvelope
import akka.projection.eventsourced.scaladsl.EventSourcedProvider
import akka.projection.jdbc.scaladsl.JdbcHandler
import akka.projection.jdbc.scaladsl.JdbcProjection
import akka.projection.scaladsl.{ExactlyOnceProjection, SourceProvider}
import javax.inject.Inject
import javax.inject.Singleton
import net.imadz.common.application.projection.ScalikeJdbcSession
import net.imadz.common.application.projection.ScalikeJdbcSetup
import net.imadz.common.application.projection.{ScalikeJdbcSession, ScalikeJdbcSetup}
import ${BASE_PKG}.application.aggregates.${aggregateName}
${handlerImports}
import ${PKG}.repository.${repositoryName}
${eventImports}
import ${BASE_PKG}.infrastructure.proto.${protoPkg}.${protoObj}
import ${BASE_PKG}.infrastructure.proto.${protoPkg}._

/**
 * ${viewName}: Akka Projection 定义。
 * 负责从事件源 (${aggregateName}) 读取事件并协调给 Handler。
 */
@Singleton
object ${viewName} {


  val projectionName = "${viewName}"


  
  // Akka Persistence Query Source Provider
  private def sourceProvider(tag: String)(implicit system: ActorSystem[_]): SourceProvider[Offset, EventEnvelope[${protoEventType}]] = {
    EventSourcedProvider.eventsByTag[${protoEventType}](
      system = system,
      readJournalPluginId = MongoReadJournal.Identifier,
      tag = tag
    )
  }


  
  /**
   * 创建 Projection 实例，使用 ExactlyOnce 语义。
   * @param index 分片索引，用于计算 Tag (e.g. tag-0, tag-1)
   */
  def createProjection(system: ActorSystem[_], sharding: ClusterSharding, index: Int, repository: ${PKG}.repository.${repositoryName}): ExactlyOnceProjection[Offset, EventEnvelope[${protoEventType}]] = {
    implicit val sys: ActorSystem[_] = system
    // [FIX] 计算 Tag: baseName + index (需要与 Aggregate Bootstrap 保持一致)
    val tag = s"${aggregateName.replace("Aggregate", "")}Tag$index"

    JdbcProjection.exactlyOnce(
      projectionId = ProjectionId("${projectionId}", tag),
      sourceProvider = sourceProvider(tag),
      handler = () => new ${viewName}CompositeHandler(
${handlerNews}
      ), // [FIX 挂账⑥(a) BUG-014] 组合分发器：修复单 handler 装配缺陷（原仅接线单事件 handler，其余事件落入 ??? 兜底中断投影流）
      sessionFactory = () => new ScalikeJdbcSession()
    )
  }


  /**
   * ${viewName} 组合分发器：按事件类型把 envelope 路由到对应 per-event Handler；
   * 未知事件优雅跳过（不抛异常、不打日志），保证投影流不中断。
   */
  private class ${viewName}CompositeHandler(
${compositeParams}
  ) extends JdbcHandler[EventEnvelope[${protoEventType}], ScalikeJdbcSession] {

    override def process(session: ScalikeJdbcSession, envelope: EventEnvelope[${protoEventType}]): Unit =
      envelope.event match {
${matchCases}
        case _ => ()
      }
  }




}
`;
  if (events.length !== 1) return text;
  // single-handler variant (emit.mjs singleHandlerView)
  const e0 = events[0];
  let out = text.replace("import akka.projection.jdbc.scaladsl.JdbcHandler\n", "");
  const compositeBlock = `      handler = () => new ${viewName}CompositeHandler(\n${handlerNews}\n      ), // [FIX 挂账⑥(a) BUG-014] 组合分发器：修复单 handler 装配缺陷（原仅接线单事件 handler，其余事件落入 ??? 兜底中断投影流）`;
  out = out.replace(
    compositeBlock,
    `      handler = () => new ${viewName}On${e0}Handler(repository), // [FIX] Instantiate Handler with Repo`
  );
  const marker = `  /**\n   * ${viewName} 组合分发器`;
  const cut = out.indexOf(marker);
  if (cut > 0) out = out.slice(0, cut) + "\n\n\n}\n";
  return out;
}

function multiSourceView(viewName, sources) {
  const repositoryName = `${viewName}Repository`;
  const projectionId = projectionIdOf(viewName);
  const primary = sources[0];
  const allEvents = sources.flatMap((s) => s.events.map((e) => ({ ...s, event: e })));
  const aggImports = sorted(sources.map((s) =>
    `import ${BASE_PKG}.application.aggregates.${s.aggName}Aggregate`)).join("\n");
  const handlerImports = sorted(allEvents.map(({ event }) =>
    `import ${PKG}.handlers.${viewName}On${event}Handler`)).join("\n");
  const eventImports = sorted(allEvents.map(({ entityName, event }) =>
    `import ${BASE_PKG}.domain.entities.${entityName}.${event}`)).join("\n");
  const protoLines = new Set();
  for (const s of sources) {
    protoLines.add(`import ${BASE_PKG}.infrastructure.proto.${s.protoPkg}.${s.protoObj}`);
    protoLines.add(`import ${BASE_PKG}.infrastructure.proto.${s.protoPkg}.${s.protoObj}.Event`);
  }
  protoLines.add(`import ${BASE_PKG}.infrastructure.proto.${primary.protoPkg}._`);
  const protoImports = sorted([...protoLines]).join("\n");

  const blocks = sources.map((s) => {
    const protoEventType = `${s.protoObj}.Event`;
    const news = s.events.map((e) =>
      `        new ${viewName}On${e}Handler(repository)`).join(",\n");
    const params = s.events.map((e) =>
      `    ${lowerFirst(e)}: ${viewName}On${e}Handler`).join(",\n");
    const cases = s.events.map((e) =>
      `        case ${s.protoObj}.Event.${e}(_) => ${lowerFirst(e)}.process(session, envelope)`).join("\n")
      + "\n        case _ => ()";
    return `  /** [M3 多聚合投影] ${s.aggName} 源聚合的事件流（信封 ${protoEventType}，与本视图其他聚合流互不混流） */
  private def sourceProvider${s.aggName}(tag: String)(implicit system: ActorSystem[_]): SourceProvider[Offset, EventEnvelope[${protoEventType}]] = {
    EventSourcedProvider.eventsByTag[${protoEventType}](
      system = system,
      readJournalPluginId = MongoReadJournal.Identifier,
      tag = tag
    )
  }

  /**
   * [M3 多聚合投影] ${s.aggName} 流投影实例（ExactlyOnce·tag=<${s.aggName}Tag><index>·offset 独立）。
   * @param index 该聚合 tag 分片索引（由 Bootstrap 按聚合顺序偏移后传入）
   */
  def createProjectionFor${s.aggName}(system: ActorSystem[_], sharding: ClusterSharding, index: Int, repository: ${PKG}.repository.${repositoryName}): ExactlyOnceProjection[Offset, EventEnvelope[${protoEventType}]] = {
    implicit val sys: ActorSystem[_] = system
    val tag = s"${s.aggName}Tag$index"

    JdbcProjection.exactlyOnce(
      projectionId = ProjectionId("${projectionId}", tag),
      sourceProvider = sourceProvider${s.aggName}(tag),
      handler = () => new ${viewName}${s.aggName}CompositeHandler(
${news}),
      sessionFactory = () => new ScalikeJdbcSession()
    )
  }

  /**
   * ${viewName} ${s.aggName} 流组合分发器：按事件类型把 envelope 路由到对应 per-event Handler；
   * 未知事件（其他聚合 tag 流不可达，防御性）优雅跳过，保证投影流不中断。
   */
  private class ${viewName}${s.aggName}CompositeHandler(
${params}
  ) extends JdbcHandler[EventEnvelope[${protoEventType}], ScalikeJdbcSession] {

    override def process(session: ScalikeJdbcSession, envelope: EventEnvelope[${protoEventType}]): Unit =
      envelope.event match {
${cases}
      }
  }`;
  }).join("\n\n\n");

  return `// @generated by CodegenMain:225ed28b
// @knowledge-release 1.0.0
package ${PKG}

import akka.actor.typed.ActorSystem
import akka.actor.typed.ActorSystem
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import akka.contrib.persistence.mongodb.MongoReadJournal
import akka.contrib.persistence.mongodb.MongoReadJournal
import akka.persistence.query.Offset
import akka.projection.Projection
import akka.projection.ProjectionId
import akka.projection.eventsourced.EventEnvelope
import akka.projection.eventsourced.scaladsl.EventSourcedProvider
import akka.projection.jdbc.scaladsl.JdbcHandler
import akka.projection.jdbc.scaladsl.JdbcProjection
import akka.projection.scaladsl.{ExactlyOnceProjection, SourceProvider}
import javax.inject.Inject
import javax.inject.Singleton
import net.imadz.common.application.projection.ScalikeJdbcSession
import net.imadz.common.application.projection.ScalikeJdbcSetup
import net.imadz.common.application.projection.{ScalikeJdbcSession, ScalikeJdbcSetup}
${aggImports}
${handlerImports}
import ${PKG}.repository.${repositoryName}
${eventImports}
${protoImports}

/**
 * ${viewName}: Akka Projection 定义。
 * 负责从事件源 (${primary.aggName}Aggregate) 读取事件并协调给 Handler。
 */
@Singleton
object ${viewName} {


  val projectionName = "${viewName}"


${blocks}



}
`;
}

// ── handler shell (ported verbatim from projection-dsl/emit.mjs) ───────────
function handlerFile(v) {
  const { viewName, entityName, protoPkg, protoObj, eventName, refCode, manualLines } = v;
  const protoEventType = `${protoObj}.Event`;
  const repositoryName = `${viewName}Repository`;
  const handlerName = `${viewName}On${eventName}Handler`;
  const manual = manualLines.join("\n");
  return `// @generated by CodegenMain:225ed28b
// @knowledge-release 1.0.0
package ${PKG}.handlers

import akka.projection.eventsourced.EventEnvelope
import akka.projection.jdbc.scaladsl.JdbcHandler
import javax.inject.Inject
import net.imadz.common.application.projection.ScalikeJdbcSession
import ${PKG}.repository.${repositoryName}
import ${BASE_PKG}.domain.entities.${entityName}.${eventName}
import ${BASE_PKG}.infrastructure.proto.${protoPkg}.${protoObj}
import scala.concurrent.ExecutionContext
import scala.concurrent.Future

/**
 * ${handlerName}: 投影处理器，负责处理${handlerName.replace(/Handler$/, "")}相关事件
 */// @Singleton
class ${handlerName} @Inject() (${lowerFirst(viewName)}Repository: ${repositoryName}) extends JdbcHandler[EventEnvelope[${protoEventType}], ScalikeJdbcSession] {


  
  override def process(session: ScalikeJdbcSession, envelope: EventEnvelope[${protoEventType}]): Unit = {
    envelope.event match {
      case event: ${protoEventType} =>
        // Logic for protobuf event: ${protoEventType}
        // 投影意图（元数据 referenceCode）：${refCode}
        // ==== BEGIN MANUAL ====
${manual}
        // ==== END MANUAL ====

      case _ =>
        () // 非本投影事件流：显式跳过。原 ??? 会使未预期事件（跨聚合 tag 串流实证）打爆投影流——Squad-C/BUG-012 家族教训，2026-08-26 模板根治
    }

  }



}

`;
}

// ── main entry ─────────────────────────────────────────────────────────────
export function generateSmViews(canonical) {
  const { eventOwner, eventPayloadTypes, smNotes } = indexCanonical(canonical);
  const out = [];
  const projRel = "app/net/imadz/metarch/application/projection";
  for (const viewName of [...smNotes.keys()].sort()) {
    const note = smNotes.get(viewName);
    const sources = wiringOf(note, eventOwner).map((s) => ({
      aggName: s.aggName,
      events: s.events,
      aggregateName: `${s.aggName}Aggregate`,
      entityName: `${s.aggName}Entity`,
      protoPkg: protoPkgOf(s.aggName),
      protoObj: `${s.aggName}EventPO`,
    }));
    if (!sources.length) continue;
    const viewContent = sources.length === 1
      ? singleSourceView({ viewName, ...sources[0] })
      : multiSourceView(viewName, sources);
    out.push({ path: `${projRel}/${viewName}.scala`, content: viewContent });
    const refCodes = (note.info && note.info.projectionRefCodes) || {};
    for (const s of sources) {
      for (const eventName of s.events) {
        const repoVar = `${lowerFirst(viewName)}Repository`;
        const ctx = {
          repoVar,
          protoObj: s.protoObj,
          eventName,
          fieldTypes: eventPayloadTypes.get(`${s.aggName}|${eventName}`),
        };
        const body = manualBodyFor(note, viewName, eventName, ctx);
        const manualLines = body.lines || [`        ???`];
        out.push({
          path: `${projRel}/handlers/${viewName}On${eventName}Handler.scala`,
          content: handlerFile({
            viewName,
            entityName: s.entityName,
            protoPkg: s.protoPkg,
            protoObj: s.protoObj,
            eventName,
            refCode: refCodes[eventName] || "???",
            manualLines,
          }),
          ...(body.residual ? { residual: body.residual } : {}),
        });
      }
    }
  }
  return out;
}

export default generateSmViews;
