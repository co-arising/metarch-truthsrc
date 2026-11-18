import { ViewForm, GateKind } from './models.mjs';

// These are fixed helper fragments from ControllerTemplate.scala, not oracle
// files. Their activation is driven exclusively by the typed read models.
const pageGuard = `  /** 分页参数门卫（契约保留：page>=1, 1<=pageSize<=200） */
  private def pageGuard(page: Int, pageSize: Int): Option[ApiError] =
    if (page < 1 || pageSize < 1 || pageSize > 200) Some(ApiError(400, "PARAM_INVALID", "page>=1, 1<=pageSize<=200 required")) else None`;
const tenantList = `  /** 租户作用域 list（R1 隔离：tenantOf(v)==ts.tenantId 过滤——Ctx 化，.get 灭绝） */
  private def tenantList[V](vk: String, page: Int, pageSize: Int, all: Future[List[V]], tenantOf: V => String)(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =
    api.tenant.read(CommandRoleMap.of(vk): _*).apply[ViewListDto[V]] { ts =>
      pageGuard(page, pageSize).fold[Future[Either[ApiError, ViewListDto[V]]]](
        all.map { list =>
          val scoped = list.filter(v => tenantOf(v) == ts.tenantId)
          Right(ViewListDto(vk, scoped.size, page, pageSize, scoped.sortBy(_.toString).slice((page - 1) * pageSize, page * pageSize)))
        }
      )(e => Future.successful(Left(e)))
    }`;
const globalList = `  /** 全局身份视图 list（User 族，Altair 拍板——跨租户可见不过滤；scope=global 已控） */
  private def globalList[V](vk: String, page: Int, pageSize: Int, all: Future[List[V]])(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =
    api.global.read().apply[ViewListDto[V]] { _ =>
      pageGuard(page, pageSize).fold[Future[Either[ApiError, ViewListDto[V]]]](
        all.map { list =>
          Right(ViewListDto(vk, list.size, page, pageSize, list.sortBy(_.toString).slice((page - 1) * pageSize, page * pageSize)))
        }
      )(e => Future.successful(Left(e)))
    }`;
const tenantItem = `  /** 租户作用域 item（单键视图） */
  private def tenantItem[V](vk: String, entityId: String, fetch: Future[Option[V]], tenantOf: V => String)(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =
    api.tenant.read(CommandRoleMap.of(vk): _*).apply[ViewItem[V]] { ts =>
      fetch.map(dOpt => dOpt.filter(v => tenantOf(v) == ts.tenantId)
        .map(d => Right(ViewItem(d)))
        .getOrElse(Left(ApiError(404, "VIEW_ITEM_NOT_FOUND", s"view=\${vk} id=\${entityId}")))
    }`;
const globalItem = `  /** 全局身份视图 item（单键，不过滤） */
  private def globalItem[V](vk: String, entityId: String, fetch: Future[Option[V]])(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =
    api.global.read().apply[ViewItem[V]] { _ =>
      fetch.map(dOpt => dOpt.map(d => Right(ViewItem(d)))
        .getOrElse(Left(ApiError(404, "VIEW_ITEM_NOT_FOUND", s"view=\${vk} id=\${entityId}")))
    }`;
const compositeItem = `  /** 复合键视图 item（F2 刻意契约）：by-id 语义化 400，不回退随机挂 */
  private def compositeItem(vk: String): play.api.mvc.Action[play.api.mvc.AnyContent] = {
    implicit val jsObjSelf: OWrites[JsObject] = identity
    api.tenant.read(CommandRoleMap.of(vk): _*).apply[JsObject] { _ =>
      Future.successful(Left(ApiError.badRequest("PARAM_INVALID", "复合键视图需列表查询后取行")))
    }
  }`;

function hasForm(endpoints, form, tenant, singleKey) {
  return endpoints.some(e => e.readModel.form === form &&
    (e.gateKind === GateKind.Tenant) === tenant && e.readModel.singleKey === singleKey);
}
export function viewHelperFragments(model) {
  const reads = model.endpoints.filter(e => e.skip === null && e.readModel !== null);
  if (!reads.length) return [];
  const list = reads.filter(e => e.readModel.form === ViewForm.ListView);
  return [
    list.length ? pageGuard : null,
    list.some(e => e.gateKind === GateKind.Tenant) ? tenantList : null,
    list.some(e => e.gateKind !== GateKind.Tenant) ? globalList : null,
    hasForm(reads, ViewForm.ItemView, true, true) ? tenantItem : null,
    hasForm(reads, ViewForm.ItemView, false, true) ? globalItem : null,
    reads.some(e => e.readModel.form === ViewForm.ItemView && !e.readModel.singleKey) ? compositeItem : null,
  ].filter(fragment => fragment !== null);
}
export function viewCall(read, kind) {
  const row = `${read.rowType.packageName.split('.').at(-1)}.${read.rowType.name}`;
  const view = `ViewKeys.${read.constName}`, repo = read.repository.name;
  if (read.form === ViewForm.ListView) return kind === GateKind.Tenant
    ? `tenantList[${row}](${view}, page, pageSize, ${repo}.findAll(), _.tenantId)`
    : `globalList[${row}](${view}, page, pageSize, ${repo}.findAll())`;
  if (!read.singleKey) return `compositeItem(${view})`;
  return kind === GateKind.Tenant
    ? `tenantItem[${row}](${view}, entityId, ${repo}.findByIdentity(entityId), _.tenantId)`
    : `globalItem[${row}](${view}, entityId, ${repo}.findByIdentity(entityId))`;
}
export function viewFormNote(read) {
  if (read.form === ViewForm.ListView) return '分页列表（pageGuard＋ViewListDto 信封）';
  return read.singleKey ? '单行（ViewItem 信封＋by-entityId）' : '复合键 item＝400 PARAM_INVALID 刻意契约';
}
