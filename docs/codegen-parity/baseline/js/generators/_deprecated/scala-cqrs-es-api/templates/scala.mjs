// scala.mjs — api-face templates, ported verbatim from the production gen_api_controllers
// templates: tpl_support.mjs (ViewKeys / CommandDsl) and rolemap_export.mjs (CommandRoleMap).
// Whitespace is load-bearing (golden-master byte identity) — do not reformat; the doc-comment
// texts are the live files' byte content, not prose to be "cleaned up".
import { ROLE_CONSTANTS } from '../builders/rolemap.mjs';

/** occurredAt 统一时戳表达式（逐字对齐 CommandResults.ok 的 appendInstant(3) 格式） */
export const OCC_EXPR = 'new java.time.format.DateTimeFormatterBuilder().appendInstant(3).toFormatter.format(java.time.Instant.now())';

const rolesSeq = (roles) => (roles.length
  ? `Seq(${roles.map((r) => `Roles.${ROLE_CONSTANTS[r]}`).join(', ')})`
  : 'Seq.empty[String]');

/** ViewKeys.scala 全文（读侧语义新名常量域——vm.views 派生） */
export function renderViewKeys(vm, fp) {
  return `${fp}
package net.imadz.metarch.infrastructure.auth

/** ViewKeys —— ⚠️ GENERATED（gen_api_layer 从 readmodels ＋ viewkey_rename_map.v1 导出；手改无效）。
  * 读侧语义命名（用户拍板 2026-08-27）：快照型→资源复数名；动作记录型→过去分词复数。
  * 硬切无过渡期：旧 key（命令名风格）路由不再发射，直接 404 VIEW_NOT_FOUND/缺路由。 */
object ViewKeys {
${vm.views.map((v) => `  val ${v.constName} = "${v.key}"`).join('\n')}
}
`;
}

/** CommandRoleMap.scala 全文（GENERATED；key=ViewKeys 新名；附 byCommand 命令粒度位） */
export function renderCommandRoleMap(m, fp) {
  // 尾逗号管理（2026-09-06 批2 修复）：join 带逗号会把逗号落在行尾注释之后——空集行
  // 的「// 无角色限制」注释吞掉逗号 → Map 条目失逗号 → 编译红。逗号改由各行自持。
  const viewLines = [...m.viewRoles.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([viewName, roles], i, arr) => {
      const c = m.viewConstOf(viewName);
      const comma = i < arr.length - 1 ? ',' : '';
      return roles.length
        ? `    ViewKeys.${c} -> ${rolesSeq(roles)}${comma}`
        : `    ViewKeys.${c} -> Seq.empty[String]${comma} // 无角色限制（scope 兜底）`;
    });
  const cmdLines = [...m.commandRoles.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cmd, roles]) => `    "${cmd}" -> ${rolesSeq(roles)}`);
  return `${fp}
package net.imadz.metarch.infrastructure.auth

import net.imadz.common.auth.Roles

/** CommandRoleMap —— ⚠️ GENERATED FILE（gen_api_layer / rolemap_export 从 .ingest notes 共链导出，手改无效）。
  *
  * 真源纪律（用户拍板 2026-08-27）：必须从真源导出——roles(c) = ∪ role: targets of notes that link command:c；
  * m[V] = ∪ roles(c ∈ commandsOf(V)) ∪ readRoles(V)（readmodels decisionSupport 反查聚合
  * ＋readModel 便签 role: 链显式读权并集——S2-88 读/写分离·只增不减）。
  *
  * 两索引各司其职：
  *   of(viewKey)      —— 读侧端点声明（视图关联命令 roles 并集）；
  *   ofCommand(cmd)   —— 写侧端点声明（命令粒度；authorize(scopeOf(cmd), userId) ∩ roles(cmd) 的直接实现）。
  *
  * 空集语义（写死·EP 验收#5）：Seq.empty = 角色不设限由 scope 兜底，≠全员放行
  * （UserProfiles/DeactivatedUsers 族＝global scope 兜底；B5 切 Enforce 前回归验证）。
  * 对账：与 .ingest/rolemap-whitelist.json 双向 diff（--emit-rolemap-diff / validate_rolelink_tiers --gate）。 */
object CommandRoleMap {
  // key = ViewKeys 新名（读侧语义）；值 = 该视图关联命令 roles 并集
  private val m: Map[String, Seq[String]] = Map(
${viewLines.join('\n')}
  )
  // 写侧命令粒度（roles(cmd)）
  private val byCommand: Map[String, Seq[String]] = Map(
${cmdLines.join(',\n')}
  )
  def of(viewKey: String): Seq[String] = m.getOrElse(viewKey, Nil)
  def ofCommand(command: String): Seq[String] = byCommand.getOrElse(command, Nil)
}
`;
}

/** CommandDsl.scala 全文（OkReceipt/ViewListDto/ViewItem/IdGuard/InstantGuard 支撑件） */
export function renderCommandDsl(fp) {
  return `${fp}
package net.imadz.metarch.infrastructure.api

import net.imadz.common.auth.ApiError

/** CommandDsl —— ⚠️ GENERATED（gen_api_layer B2 支撑件；手改无效）。
  * OkReceipt＝命令成功回执（形状逐字对齐 CommandResults.ok：status/aggregateId/events/occurredAt/decisionView）；
  * ViewListDto/ViewItem＝读侧信封（view/total/page/pageSize/items 与 item 单键包裹）；
  * IdGuard/InstantGuard＝边界翻译单点（.get 异常流的声明式替代，PARAM_INVALID 形状保留）。 */

final case class OkReceipt(aggregateId: String, decisionView: play.api.libs.json.JsValue)
object OkReceipt {
  implicit val writes: play.api.libs.json.OWrites[OkReceipt] = (r: OkReceipt) => play.api.libs.json.Json.obj(
    "status" -> "ok",
    "aggregateId" -> r.aggregateId,
    "events" -> play.api.libs.json.Json.arr(),
    "occurredAt" -> ${OCC_EXPR},
    "decisionView" -> r.decisionView)
}

final case class ViewListDto[V](view: String, total: Int, page: Int, pageSize: Int, items: Seq[V])
object ViewListDto {
  implicit def writes[V](implicit w: play.api.libs.json.Writes[V]): play.api.libs.json.OWrites[ViewListDto[V]] =
    (dto: ViewListDto[V]) => play.api.libs.json.Json.obj(
      "view" -> dto.view, "total" -> dto.total, "page" -> dto.page, "pageSize" -> dto.pageSize,
      "items" -> play.api.libs.json.Json.toJson(dto.items))
}

final case class ViewItem[V](item: V)
object ViewItem {
  implicit def writes[V](implicit w: play.api.libs.json.Writes[V]): play.api.libs.json.OWrites[ViewItem[V]] =
    (vi: ViewItem[V]) => play.api.libs.json.Json.obj("item" -> play.api.libs.json.Json.toJson(vi.item))
}

object IdGuard {
  /** Id 边界翻译单点：非法 UUID → 400 PARAM_INVALID "invalid id: …"（与既有直出形状逐字一致）
    * ⚠️ 类型位＝net.imadz.common.CommonTypes.Id（type alias UUID）；表达式位＝包级 object Id.of */
  def parse(pairs: (String, String)*): Either[ApiError, Seq[net.imadz.common.CommonTypes.Id]] =
    scala.util.Try(pairs.map { case (_, raw) => net.imadz.common.Id.of(raw) }).toEither
      .left.map(t => ApiError(400, "PARAM_INVALID", s"invalid id: \${Option(t.getMessage).getOrElse(t.getClass.getName)}"))
}

object InstantGuard {
  /** Instant 边界翻译单点：非 ISO-8601 → 400 PARAM_INVALID（与既有直出语义一致） */
  def parse(pairs: (String, String)*): Either[ApiError, Seq[java.time.Instant]] =
    scala.util.Try(pairs.map { case (_, raw) => java.time.Instant.parse(raw) }).toEither
      .left.map(t => ApiError(400, "PARAM_INVALID", s"must be ISO-8601 instant: \${Option(t.getMessage).getOrElse(t.getClass.getName)}"))
}
`;
}
