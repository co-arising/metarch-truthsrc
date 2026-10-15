// vector_search.mjs — 【Template】M3 向量检索渲染（V4-13 port）——verbatim from the live
// gen_api_controllers/tpl_vector_search.mjs（批D·2026-09-07）.
// vector_views 直读（canonical.vectorViews·augment 侧＝live collectVectorViews 镜像·不经③层门）
// → VectorSearchApiController.scala：
//   POST /api/kb/semantic-search —— api.tenant.write 档（authAction tid 硬门＋body Reads 解码）；
//   查询侧同步嵌入（注入手写基建 OllamaEmbeddingClient——HTTP/池逻辑全在手写侧，模板机械发射调用）；
//   k 钳位 1..50 默认 8；sourceType 白名单＝真源 refCodes 字面量机械提取（note|concept）；
//   嵌入失败 → 503 EMBEDDING_UNAVAILABLE（degraded 语义·不静默降级）；租户门＝ts.tenantId 硬过滤。
import { id } from '../builders/core.mjs';

/** 渲染 VectorSearchApiController.scala 全文＋路由行（每向量视图一个端点；当前真源＝1 视图） */
export function renderVectorSearchController(vecViews, fp, noteAnchor = () => '') {
  const imports = [];
  const injections = [];
  const requestVos = [];
  const writes = [];
  const endpoints = [];
  const routeLines = [];
  for (const v of vecViews) {
    const viewVar = `${v.name.charAt(0).toLowerCase()}${v.name.slice(1)}`;
    const repoType = `${v.name}Repository`;
    injections.push(`${viewVar}Repository: ${repoType}`);
    imports.push(`import net.imadz.metarch.application.projection.repository.${repoType}`);
    imports.push(`import net.imadz.metarch.application.projection.repository.${v.name}Table.${v.name}`);
    const st = v.storage || {};
    const model = (st.embedding && st.embedding.model) || 'bge-m3';
    const dims = Number(st.dims || 0);
    const whitelist = v.sourceTypes.length ? v.sourceTypes : null; // null＝不过滤（真源未声明字面量）
    // 行序列化：DTO 全字段（embedding 列＝存储实现细节不在 DTO·天然不泄）
    const fieldWrites = v.fields.map((f) => `"${f.name}" -> Json.toJson(d.${id(f.name)})`).join(', ');
    writes.push(`  /** ${v.name} 行序列化（检索结果 items 元素） */
  implicit val ${viewVar}Writes: play.api.libs.json.OWrites[${v.name}] = (d: ${v.name}) => play.api.libs.json.Json.obj(
    ${fieldWrites}
  )`);
    requestVos.push(`  /** POST /api/kb/semantic-search 请求体（k 钳位 1..50 默认 8·sourceType 白名单 ${whitelist ? whitelist.join('|') : '（真源未声明·不过滤）'}） */
  case class ${v.name}SearchRequest(query: String, k: Option[Int] = None, sourceType: Option[String] = None)
  object ${v.name}SearchRequest {
    implicit val reads: play.api.libs.json.Reads[${v.name}SearchRequest] = play.api.libs.json.Json.reads[${v.name}SearchRequest]
  }`);
    // 校验链：query 必填 → sourceType 白名单（真源未声明字面量时不设）→ 检索主链
    const guardConds = [
      `      if (Option(req.query).forall(_.trim.isEmpty))
        Future.successful(Left(ApiError.badRequest("PARAM_INVALID", "query required")))`,
    ];
    if (whitelist) {
      guardConds.push(`      else if (req.sourceType.exists(st => st.nonEmpty && !Set(${whitelist.map((s) => `"${s}"`).join(', ')}).contains(st)))
        Future.successful(Left(ApiError.badRequest("PARAM_INVALID", "sourceType must be one of ${whitelist.join('|')}")))`);
    }
    // S7 #1b：向量视图端点逐视图锚（与 ViewApi 读端点同律——服务的是该视图知识）。
    endpoints.push(`${v.noteId ? noteAnchor(v.noteId, '  ') : ''}  /** POST /api/kb/semantic-search —— 租户内跨语言语义检索（${model}·${dims}d·cosine；tid 硬门） */
  def ${viewVar}Search: play.api.mvc.Action[play.api.mvc.AnyContent] =
    api.tenant.write[${v.name}SearchRequest]().apply[play.api.libs.json.JsObject] { (ts, req) =>
${guardConds.join('\n')}
      else {
        val k = math.max(1, math.min(50, req.k.getOrElse(8))) // 钳位 1..50·默认 8
        val stFilter = req.sourceType.filter(_.nonEmpty)
        // 查询侧同步嵌入（阻塞 IO 隔离在 Future；ollama 超时由 OllamaEmbeddingClient 保证）
        Future { embeddingClient.embed(req.query) }
          .flatMap { queryEmbedding =>
            ${viewVar}Repository.search(ts.tenantId, queryEmbedding, k, stFilter).map { rows =>
              Right(play.api.libs.json.Json.obj(
                "view" -> "kb-semantic-search",
                "query" -> req.query,
                "k" -> k,
                "sourceType" -> stFilter.fold[play.api.libs.json.JsValue](play.api.libs.json.JsNull)(s => play.api.libs.json.JsString(s)),
                "total" -> rows.size,
                "items" -> play.api.libs.json.Json.toJson(rows)(play.api.libs.json.Writes.list(${viewVar}Writes))
              ))
            }
          }.recover { case e: Throwable =>
            Left(ApiError(503, "EMBEDDING_UNAVAILABLE", s"embedding service unavailable: \${e.getMessage}")) // degraded 语义：不静默降级
          }
      }
    }`);
    routeLines.push(`POST     /api/kb/semantic-search        controllers.VectorSearchApiController.${viewVar}Search`);
  }

  const controller = `${fp}
package controllers

import javax.inject.{Inject, Singleton}
import net.imadz.metarch.application.projection.repository._
import net.imadz.common.auth.{ApiError, Endpoint}
import net.imadz.metarch.infrastructure.persistence.vector.OllamaEmbeddingClient
import play.api.libs.json._
import play.api.mvc._

import scala.concurrent.{ExecutionContext, Future}

${imports.join('\n')}

/** VectorSearchApiController: 租户知识语义检索 API（M3 向量读模型·${vecViews.length} 视图）。
  * 查询链＝OllamaEmbeddingClient.embed(query) → Repository.search(tenantId, embedding, k, sourceType)
  * （pgvector HNSW cosine 近邻·tid 硬门）；嵌入失败＝503 EMBEDDING_UNAVAILABLE（degraded 语义）。
  * ⚠️ GENERATED（gen_api_layer M3·tpl_vector_search）；手改无效。 */
@Singleton
class VectorSearchApiController @Inject() (
  embeddingClient: OllamaEmbeddingClient,
  ${injections.join(',\n  ')},
  api: Endpoint,
  val cc: ControllerComponents)(implicit ec: ExecutionContext)
  extends BaseController {

  override def controllerComponents: ControllerComponents = cc

${requestVos.join('\n\n')}

${writes.join('\n\n')}

${endpoints.join('\n\n')}
}
`;
  return { controller, routeLines, endpointsCount: endpoints.length };
}
