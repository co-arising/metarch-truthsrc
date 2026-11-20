// 来源：curated 参考件 net/imadz/infrastructure/auth/Endpoint.scala
// （包适配：net.imadz.infrastructure.auth → net.imadz.common.auth，与 raw import 对齐）。
// 裁剪到本样消费面：仅 global 门（raw S1 只消费 api.global.read() 零角色档）。
// API 形状保真（2026-11-20 walkthrough R-A 修订）：read 恢复 curated 的 varargs 签名
// read(roles: String*)，零参调用即零声明角色＝任何已验签登录者（缺省 User）；声明角色
// 须命中用户身份（curated 的 Nil/declared/forbidden 三分支原样），仅删 migration gate
// 分支——那一支依赖平台 RoleGate.fromConfig 机制。authenticate/verify 段与 finishImpl
// 错误折叠/崩溃护栏逐字保真（verify 拆出仅为 CC 门 5 收敛，分支集合不变）。
// tenant/anonymous/dispatchView 门、RoleGate 词表与 body 解码面属平台面，不入本族。
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

  // ---------- 域根：api.global（curated varargs 签名原样；raw 调用面＝零参） ----------

  final class GlobalRoot {
    final class GReader(roles: Seq[String]) {
      def apply[T](handler: GlobalCtx => Future[Either[ApiError, T]])
                  (implicit w: OWrites[T]): Action[AnyContent] =
        defaultAction(anyParser).async { raw =>
          authenticate(raw).fold(f => f, vt =>
            toGlobal(vt, roles).fold(f => f, gs => finishImpl(handler(gs))))
        }
    }

    def read(roles: String*): GReader = new GReader(roles)
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

  /** 全局段：零声明角色＝任何已验签登录者（缺省 User）；声明角色须命中用户身份
    * （curated 三分支原样；migration gate 分支收归平台）。 */
  private def toGlobal(vt: VerifiedToken, roles: Seq[String]): Either[Future[Result], GlobalCtx] =
    roles match {
      case Nil => Right(GlobalCtx(vt.userId, DefaultGlobalRole))
      case declared if declared.contains(DefaultGlobalRole) =>
        Right(GlobalCtx(vt.userId, DefaultGlobalRole))
      case _ => Left(forbiddenRoles(roles))
    }

  private def forbiddenRoles(declared: Seq[String]): Future[Result] =
    Future.successful(Results.Forbidden(
      Json.obj("errorCode" -> "ROLE_REQUIRED",
        "message" -> s"requires one of: ${declared.mkString(",")}")))

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
