// 来源：curated 参考件 net/imadz/infrastructure/auth/Endpoint.scala
// （包适配：net.imadz.infrastructure.auth → net.imadz.common.auth，与 raw import 对齐）。
// 裁剪到本样消费面：仅 global 门（raw S1 只消费 api.global.read() 零角色档），
// authenticate 验签管线与 finishImpl 错误折叠/崩溃护栏逐字保真（认证段拆出 verify
// 仅为 CC 门 5 收敛，分支集合不变）；tenant/anonymous/dispatchView 门、角色阶梯
// （RoleGate/Roles 词表）与 body 解码面属平台面，不入本族。
package net.imadz.common.auth

import javax.inject.{Inject, Singleton}
import play.api.libs.json.{Json, OWrites}
import play.api.mvc._
import play.api.Logger

import scala.concurrent.{ExecutionContext, Future}

/** 声明式 controller 基座（EP_Declarative_Controller_DSL B1 三门裁剪版的本族消费面）：
  * 方法名即 scope，handler 参数类型即权限承诺；身份经 TokenService 验签
  * （Bearer 解析＋本地验签＋30s clock skew 容忍），错误折叠与崩溃护栏收在 finishImpl。 */
@Singleton
final class Endpoint @Inject() (
    defaultAction: DefaultActionBuilder,
    anyParser: BodyParsers.Default,
    tokens: TokenService)(implicit ec: ExecutionContext) {

  private val log = Logger(classOf[Endpoint])

  /** 全局身份缺省：任何已验签登录者恒有 User 基础身份（curated 词表 Global 层）。 */
  private val DefaultGlobalRole: String = "User"

  // ---------- 域根：api.global（零角色档＝raw S1 消费面；raw 调用面 api.global.read()） ----------

  final class GlobalRoot {
    final class GReader {
      def apply[T](handler: GlobalCtx => Future[Either[ApiError, T]])
                  (implicit w: OWrites[T]): Action[AnyContent] =
        defaultAction(anyParser).async { raw =>
          authenticate(raw).fold(f => f, vt => finishImpl(handler(toGlobal(vt))))
        }
    }

    def read(): GReader = new GReader
  }

  val global: GlobalRoot = new GlobalRoot

  // ---------- 内部管线 ----------

  /** 认证段：Bearer 解析 + 本地验签（与 AuthAction.invokeBlock 同源：30s clock skew 容忍） */
  private def authenticate[A](raw: Request[A]): Either[Future[Result], VerifiedToken] = {
    def unauth(code: String, msg: String): Future[Result] =
      Future.successful(Results.Unauthorized(
        Json.obj("errorCode" -> code, "message" -> msg)))

    val tokenOpt = raw.headers.get("Authorization")
      .filter(_.startsWith("Bearer "))
      .map(_.drop(7).trim)

    tokenOpt match {
      case None => Left(unauth("INVALID_TOKEN", "missing or malformed Authorization header"))
      case Some(token) => verify(token)
    }
  }

  /** 验签段：签名/exp/算法白名单（curated 三分支原样：有效/过期/无效）。 */
  private def verify(token: String): Either[Future[Result], VerifiedToken] =
    tokens.verifyAccess(token) match {
      case Some(vt) if vt.expiresAtEpochSec >=
          java.time.Instant.now().getEpochSecond - 30 => Right(vt)
      case Some(_) => Left(Future.successful(Results.Unauthorized(
        Json.obj("errorCode" -> "TOKEN_EXPIRED", "message" -> "access token expired"))))
      case None => Left(Future.successful(Results.Unauthorized(
        Json.obj("errorCode" -> "INVALID_TOKEN", "message" -> "token verification failed"))))
    }

  /** 全局段：globalRole 缺省 User（词表 Global 层；S1 状态门零角色声明）。 */
  private def toGlobal(vt: VerifiedToken): GlobalCtx = GlobalCtx(vt.userId, DefaultGlobalRole)

  /** 统一出口：错误折叠 + 防崩 recover（R1 固化；M3 语义锚点=INTERNAL_ERROR 形状单点） */
  private def finishImpl[T](fut: Future[Either[ApiError, T]])
                           (implicit w: OWrites[T]): Future[Result] =
    fut.recoverWith {
      case ex =>
        log.error("ENDPOINT_CRASH_GUARD", ex)
        Future.successful(Left(ApiError(500, "INTERNAL_ERROR", "unexpected server failure")))
    }.map(e => ApiError.toResult(e))
}

/** 全局业务上下文（Ctx＝业务上下文，非 request wrapper；curated 原样）。 */
final case class GlobalCtx(userId: String, globalRole: String)
