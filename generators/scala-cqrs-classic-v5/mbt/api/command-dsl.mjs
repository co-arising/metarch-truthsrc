import { ProductError } from '../../../../lib/products/request.mjs';
import { typeRef } from '../../../../lib/classic-architecture/types.mjs';
import { CommandDslModel } from './models.mjs';

export const CommandDslPackage = 'net.imadz.infrastructure.api';
export function buildClassicCommandDsl(interfaces, _ctx) {
  if (!Array.isArray(interfaces?.controllers))
    throw new ProductError('CLASSIC_API_METADATA', 'InterfaceLayer.controllers must be the original sequence');
  const hasGate = interfaces.controllers.some(controller => {
    if (!Array.isArray(controller.endpoints))
      throw new ProductError('CLASSIC_API_METADATA', 'ControllerMetadata.endpoints must be the original sequence');
    return controller.endpoints.some(endpoint => {
      if (endpoint.gate === undefined)
        throw new ProductError('CLASSIC_API_METADATA', 'endpoint.gate requires explicit null or GateRef');
      return endpoint.gate !== null;
    });
  });
  // Presence, not truthiness or active/skip status; all five support constructs
  // are emitted once for the original interface layer, never per controller.
  return hasGate ? CommandDslModel(typeRef('CommandDsl', CommandDslPackage),
    [typeRef('ApiError', 'net.imadz.common.auth')]) : null;
}

// Static template explicitly mandated by frozen CommandDslTemplate.scala
// L15-L64. This is SOURCE template text, not stored in a Model, not loaded from
// expected and not adapted to a sample. Main prepends the generation stamp once.
export function renderClassicCommandDsl(_model) {
  return `// 来源：ingested-app B5-L（S2-32 R3.3 手放版为形状基准·R5c 起由 CodegenMain 管线发射——同源覆盖等价；
// 包适配：net.imadz.metarch.{auth,api} → net.imadz.infrastructure.api；auth 面收敛到 net.imadz.common.auth）
package net.imadz.infrastructure.api

import net.imadz.common.auth.ApiError

/** CommandDsl —— gen_api_layer B2 支撑件（ingested-app 生成件静态拷贝，形状逐字对齐）。
  * OkReceipt＝命令成功回执（形状逐字对齐 CommandResults.ok：status/aggregateId/events/occurredAt/decisionView）；
  * ViewListDto/ViewItem＝读侧信封（view/total/page/pageSize/items 与 item 单键包裹）；
  * IdGuard/InstantGuard＝边界翻译单点（.get 异常流的声明式替代，PARAM_INVALID 形状保留）。 */

final case class OkReceipt(aggregateId: String, decisionView: play.api.libs.json.JsValue)
object OkReceipt {
  implicit val writes: play.api.libs.json.OWrites[OkReceipt] = (r: OkReceipt) => play.api.libs.json.Json.obj(
    "status" -> "ok",
    "aggregateId" -> r.aggregateId,
    "events" -> play.api.libs.json.Json.arr(),
    "occurredAt" -> new java.time.format.DateTimeFormatterBuilder().appendInstant(3).toFormatter.format(java.time.Instant.now()),
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
