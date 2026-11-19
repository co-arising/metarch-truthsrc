// 来源：curated 参考件 net/imadz/infrastructure/auth/ApiError.scala
// （包适配：net.imadz.infrastructure.auth → net.imadz.common.auth，与 raw import 对齐；
//  curated Endpoint 文件头自证该包适配实践）。
// 裁剪到本样消费面：错误形状、writes 隐式与 toResult 折叠；
// forbidden/badRequest/notFound/conflict/param 助手与 ApiRaw 出口属平台错误面，不入本族。
package net.imadz.common.auth

import play.api.libs.json.{JsObject, Json, OWrites, Writes}
import play.api.mvc.Results.Status
import play.api.mvc.Result

/** 错误形状单点（G5 收敛）：全站唯一 ApiError → Result 折叠规则；
  * payload 缺省 None＝旧 wire 形状零漂移。 */
final case class ApiError(status: Int, errorCode: String, message: String,
                          payload: Option[JsObject] = None)

object ApiError {
  implicit val writes: Writes[ApiError] = e =>
    Json.obj("errorCode" -> e.errorCode, "message" -> e.message) ++ e.payload.getOrElse(Json.obj())

  /** 单点折叠：handler 一律返回 Either[ApiError, T]，DSL 内部统一翻译为 Result */
  def toResult[T](e: Either[ApiError, T])(implicit w: OWrites[T]): Result = e match {
    case Right(t) => Status(200)(w.writes(t))
    case Left(err) => Status(err.status)(Json.toJson(err))
  }
}
