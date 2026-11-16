// views.mjs — 【Template】读侧渲染：ViewModel[] → ViewApiController.scala（形态 B 单行端点＋泛型 helper）
// ＋ ViewWrites.scala（per-view OWrites，空安全继承）；routes GET 行随视图模型产出。
// Verbatim port of the production gen_api_controllers/tpl_views.mjs (V4-4 inc13).
import { id } from '../builders/core.mjs';

/** 字段 → Json.obj 行表达式（空安全：Instant null→JsNull／UUID 可空→Option.map／List→JsArray——060a217/60b796a 教训）
 * S2-82-B3（2026-09-11）：List<VO>（typed 结构化列）→ Json.toJson——隐式 OFormat 来自
 * VO 自带 companion 的 jsonFormat（ValueObjectBuilder 按需发射·typed 列 VO 闭包）——零 import 全域自动发现。
 */
const voOfList = (t) => { const m = String(t).match(/^list[<[]\s*(\w+)\s*[>\]]?\s*$/i); return m ? m[1] : null; };
const jsExprOf = (f) => {
  const t = String(f.dataType || 'String');
  // P7 终形（EP_Functional_Terminal_Form_Template_Batch S5）：S2 后视图 Instant 字段＝Option[Instant]，
  // 行内 JsNull 三元 → jsInstant Option 版（JsNull 墙只此一处·判例册 J-11）
  if (/^instant$/i.test(t)) return `jsInstant(d.${id(f.name)})`;
  if (/^string \(uuid\)$/i.test(t)) return `Json.toJson(Option(d.${id(f.name)}).map(_.toString))`;
  if (voOfList(t)) return `Json.toJson(d.${id(f.name)})`;
  if (/^list[<[]/i.test(t) && !/^list[<[]\s*string/i.test(t)) return `JsArray(d.${id(f.name)}.map(v => JsString(v.toString)))`;
  return `Json.toJson(d.${id(f.name)})`;
};

const ROW_TYPE = (v) => `${v.viewName}Table.${v.viewName}`; // 视图行类型＝repository 包内嵌套（CodegenMain 2026-08-23 形态）

/** ViewWrites.scala 全文（per-view OWrites 独立隐式域） */
export function renderViewWrites(vm, fp, noteAnchor = () => '') {
  const writes = vm.views.map((v) => {
    const camel = v.key.split('-').filter(Boolean).map((s, i) => (i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1))).join('');
    const objLines = v.fields.map((f) => `      "${f.name}" -> ${jsExprOf(f)}`).join(',\n');
    // S7 #1b：行序列化 = 视图知识的发射面——逐视图锚（OFormats 的「成员」＝该视图）。
    const anchor = v.noteId ? noteAnchor(v.noteId, '  ') : '';
    return `${anchor}  /** ${v.viewName} 行序列化（per-view OWrites——E301-R 泛型 Json.obj 收敛） */
  implicit val ${camel}Writes: play.api.libs.json.OWrites[${ROW_TYPE(v)}] = (d: ${ROW_TYPE(v)}) => play.api.libs.json.Json.obj(
${objLines}
  )`;
  });
  return `${fp}
package controllers

import java.time.Instant
import net.imadz.metarch.application.projection.repository._
import play.api.libs.json.{JsArray, JsNull, JsString, JsValue, Json}

/** ViewWrites —— ⚠️ GENERATED（gen_api_layer B2：27 决策视图 per-view OWrites；手改无效）。
  * 空安全继承（060a217/60b796a NPE 教训）：Instant Option→jsInstant（JsNull 墙只此一处·J-11）／
  * UUID 可空→Option.map(_.toString)／List→JsArray。
  * ViewApiController 与（形态 D dispatch 未来的）registry 共用本隐式域。 */
object ViewWrites {
  /** Instant → JsString（ISO-8601 UTC·Instant.toString 以 Z 结尾）／None → JsNull */
  // 2026-10-06 双模（EP_View_Column_Writeback）：视图 Instant 列新旧 DTO 并存（WorkTicket 裸 Instant／
  //   ③层 regen 族 Option[Instant]）——helper 按实型分派，两种 DTO 同一 OWrites 文本。
  private def jsInstant(i: Any): play.api.libs.json.JsValue = i match {
    case null => JsNull
    case o: Option[_] => o.map(x => JsString(x.toString)).getOrElse(JsNull)
    case x: java.time.Instant => JsString(x.toString)
    case _ => JsNull
  }

${writes.join('\n\n')}
}
`;
}

/** ViewApiController.scala 全文（形态 B 单行端点＋泛型 helper） */
export function renderViewController(vm, fp, noteAnchor = () => '') {
  const repoParams = vm.views.map((v) => `${v.repoParam}: ${v.viewName}Repository`);
  const endpoints = [];
  const routeLines = [];
  for (const v of vm.views) {
    const camel = v.key.split('-').filter(Boolean).map((s, i) => (i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1))).join('');
    const constName = vm.constOf(v.viewName);
    // S7 #1b：读端点逐视图锚——两行端点（list/item）同号（服务的是同一视图知识）。
    const anchor = v.noteId ? noteAnchor(v.noteId, '  ') : '';
    if (v.hasTenant) {
      // [视图存储重设计 2026-10-08] engine=mongo（文档存储）：列表端点走 findByTenantPaged＋countByTenant
      // ——租户下推到存储层＋真分页（不再全表 findAll 内存滤）；Phase 0 起全部租户视图同款（此处
      // engine 轴逐视图分派·mysql 视图现仍走 findAll 内存滤——滚动迁移由 storage 轴驱动）。
      const listExpr = v.engine === 'mongo'
        ? `(for { p <- ${v.repoParam}.findByTenantPaged(ts.tenantId, pageSize, (page - 1).toLong * pageSize.toLong); t <- ${v.repoParam}.countByTenant(ts.tenantId) } yield ViewListDto(ViewKeys.${constName}, t.toInt, page, pageSize, p)).map(Right(_))`
        : `${v.repoParam}.findAll().map { list => val scoped = list.filter(v => tenantOf(v) == ts.tenantId); ViewListDto(vk, scoped.size, page, pageSize, scoped.sortBy(_.toString).slice((page - 1) * pageSize, page * pageSize)) }.map(Right(_))`;
      endpoints.push(`${anchor}  def ${camel}(page: Int, pageSize: Int): play.api.mvc.Action[play.api.mvc.AnyContent] = ${v.engine === 'mongo' ? `api.tenant.read(CommandRoleMap.of(ViewKeys.${constName}): _*).apply[ViewListDto[${ROW_TYPE(v)}]] { ts => pageGuard(page, pageSize).fold[Future[Either[ApiError, ViewListDto[${ROW_TYPE(v)}]]]](${listExpr})(e => Future.successful(Left(e))) }` : `tenantList[${ROW_TYPE(v)}](ViewKeys.${constName}, page, pageSize, ${v.repoParam}.findAll(), _.tenantId)`}`);
      endpoints.push(`${anchor}  def ${camel}Item(entityId: String): play.api.mvc.Action[play.api.mvc.AnyContent] = ${v.singleKey
        ? `tenantItem[${ROW_TYPE(v)}](ViewKeys.${constName}, entityId, ${v.repoParam}.findByIdentity(entityId), _.tenantId)`
        : `compositeItem(ViewKeys.${constName})`}`);
    } else {
      endpoints.push(`${anchor}  def ${camel}(page: Int, pageSize: Int): play.api.mvc.Action[play.api.mvc.AnyContent] = globalList[${ROW_TYPE(v)}](ViewKeys.${constName}, page, pageSize, ${v.repoParam}.findAll())`);
      endpoints.push(`${anchor}  def ${camel}Item(entityId: String): play.api.mvc.Action[play.api.mvc.AnyContent] = ${v.singleKey
        ? `globalItem[${ROW_TYPE(v)}](ViewKeys.${constName}, entityId, ${v.repoParam}.findByIdentity(entityId))`
        : `compositeItem(ViewKeys.${constName})`}`);
    }
    routeLines.push(`GET      /api/views/${v.key}            controllers.ViewApiController.${camel}(page: Int ?= 1, pageSize: Int ?= 20)`);
    routeLines.push(`GET      /api/views/${v.key}/:entityId  controllers.ViewApiController.${camel}Item(entityId: String)`);
  }
  const controller = `${fp}
package controllers

import javax.inject.{Inject, Singleton}
import net.imadz.metarch.application.projection.repository._
import net.imadz.common.auth.{ApiError, Endpoint}
import net.imadz.metarch.infrastructure.auth.{CommandRoleMap, ViewKeys}
import net.imadz.metarch.infrastructure.api.{ViewListDto, ViewItem}
import play.api.libs.json.{JsObject, OWrites, Json}
import play.api.mvc._
import ViewWrites._

import scala.concurrent.{ExecutionContext, Future}

/** ViewApiController: 决策视图读 API（B2 形态 B——27 显式单行声明端点＋泛型 helper＋ViewWrites per-view OWrites；
  * viewKey 硬切＝读侧语义新名（viewkey_rename_map.v1），旧通配路由不再发射（404 由缺路由承载，用户拍板 2026-08-27 无过渡期）。
  * 信封形状契约保留：list＝{view,total,page,pageSize,items}；item＝{item:{…}}；复合键 by-id＝400 PARAM_INVALID。 */
@Singleton
class ViewApiController @Inject() (
  ${repoParams.join(',\n  ')},
  api: Endpoint,
  val cc: ControllerComponents)(implicit ec: ExecutionContext)
  extends BaseController {

  override def controllerComponents: ControllerComponents = cc

  /** 分页参数门卫（契约保留：page>=1, 1<=pageSize<=200） */
  private def pageGuard(page: Int, pageSize: Int): Option[ApiError] =
    if (page < 1 || pageSize < 1 || pageSize > 200) Some(ApiError(400, "PARAM_INVALID", "page>=1, 1<=pageSize<=200 required")) else None

  /** 租户作用域 list（R1 隔离：tenantOf(v)==ts.tenantId 过滤——Ctx 化，.get 灭绝） */
  private def tenantList[V](vk: String, page: Int, pageSize: Int, all: Future[List[V]], tenantOf: V => String)(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =
    api.tenant.read(CommandRoleMap.of(vk): _*).apply[ViewListDto[V]] { ts =>
      pageGuard(page, pageSize).fold[Future[Either[ApiError, ViewListDto[V]]]](
        all.map { list =>
          val scoped = list.filter(v => tenantOf(v) == ts.tenantId)
          Right(ViewListDto(vk, scoped.size, page, pageSize, scoped.sortBy(_.toString).slice((page - 1) * pageSize, page * pageSize)))
        }
      )(e => Future.successful(Left(e)))
    }

  /** 全局身份视图 list（User 族，Altair 拍板——跨租户可见不过滤；scope=global 已控） */
  private def globalList[V](vk: String, page: Int, pageSize: Int, all: Future[List[V]])(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =
    api.global.read().apply[ViewListDto[V]] { _ =>
      pageGuard(page, pageSize).fold[Future[Either[ApiError, ViewListDto[V]]]](
        all.map { list =>
          Right(ViewListDto(vk, list.size, page, pageSize, list.sortBy(_.toString).slice((page - 1) * pageSize, page * pageSize)))
        }
      )(e => Future.successful(Left(e)))
    }

  /** 租户作用域 item（单键视图） */
  private def tenantItem[V](vk: String, entityId: String, fetch: Future[Option[V]], tenantOf: V => String)(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =
    api.tenant.read(CommandRoleMap.of(vk): _*).apply[ViewItem[V]] { ts =>
      fetch.map(dOpt => dOpt.filter(v => tenantOf(v) == ts.tenantId)
        .map(d => Right(ViewItem(d)))
        .getOrElse(Left(ApiError(404, "VIEW_ITEM_NOT_FOUND", s"view=\${vk} id=\${entityId}"))))
    }

  /** 全局身份视图 item（单键，不过滤） */
  private def globalItem[V](vk: String, entityId: String, fetch: Future[Option[V]])(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =
    api.global.read().apply[ViewItem[V]] { _ =>
      fetch.map(dOpt => dOpt.map(d => Right(ViewItem(d)))
        .getOrElse(Left(ApiError(404, "VIEW_ITEM_NOT_FOUND", s"view=\${vk} id=\${entityId}"))))
    }

  /** 复合键视图 item（F2 刻意契约）：by-id 语义化 400，不回退随机挂 */
  private def compositeItem(vk: String): play.api.mvc.Action[play.api.mvc.AnyContent] = {
    implicit val jsObjSelf: OWrites[JsObject] = identity
    api.tenant.read(CommandRoleMap.of(vk): _*).apply[JsObject] { _ =>
      Future.successful(Left(ApiError.badRequest("PARAM_INVALID", "复合键视图需列表查询后取行")))
    }
  }

  // ── 27 显式单行端点（形态 B；方法名＝viewKey 新名 camelCase） ──
${endpoints.join('\n')}
}
`;
  const viewWritesSrc = renderViewWrites(vm, fp, noteAnchor);
  return { controller, viewWritesSrc, routeLines, endpointsCount: endpoints.length, writesCount: vm.views.length };
}
