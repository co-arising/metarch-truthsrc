// 来源：ingested-app B5-L（S2-32 R3.3 引入·包适配：net.imadz.metarch.infrastructure.auth → net.imadz.infrastructure.auth）。
// 裁剪为三核心门版 anonymous/global/tenant——metarch 五域根阶梯（workgroup/project/workshop）是 org 模型专有，
// banking 无组织模型不入（Vega 裁定）；AnonymousRoot＝GlobalRoot GWriter 管线删 authenticate 的复刻。
package net.imadz.infrastructure.auth

import net.imadz.common.auth.{TenantIdentity, TokenService, VerifiedToken}

import javax.inject.{Inject, Singleton}
import play.api.Configuration
import play.api.libs.json.{JsValue, Json, OWrites, Reads}
import play.api.mvc._
import play.api.Logger

import scala.concurrent.{ExecutionContext, Future}

/** ============================================================
  * Endpoint DSL —— 声明式 controller 基座（EP_Declarative_Controller_DSL B1；ingested-app B5-L 三门裁剪版）。
  *
  * 三核心门 × 类型阶梯：方法名即 scope，handler 参数类型即权限承诺（.get 无存在必要）：
  *   api.global.read()               → GlobalCtx(userId, globalRole)   User/SystemOperator
  *   api.tenant.read(roles*)          → TenantCtx(userId, tenantId, tenantRole)   token mrole
  *   api.anonymous.write[Req]         → (Request, body) 免登录：无 token、无 session（身份自证走 body；B5-L L1）
  *   api.dispatchView(viewKey, …)     → 单端点多分支（sealed ViewBranch 注册点声明权限）
  *
  * 与存量关系（Atlas 评审约束：只增不改）：不触碰 AuthAction/TenantRequired/TenantSession——
  * 阶梯类型以 Ctx 后缀独立命名（业务上下文，非 request wrapper）；本类自带验签管线
  * （与 AuthAction.invokeBlock 同源逻辑），存量 controller 继续走 AuthAction，B4 全切。
  * Naming 映射（lab 标杆 → 本文件）：GlobalSession→GlobalCtx、TenantSession→TenantCtx、Session→AuthedCtx。
  *
  * 内聚四事：G1 租户门卫（内联 match 的消灭）/G4 角色声明（词表 13 值，见 RoleGate.Roles）/
  * G5 错误单点折叠/R1 crash guard（BUG-003/005/008 语义固化，重生成不可能裸漏 HTML 错误页）。
  * ============================================================ */
// 类型阶梯（顶层：path-independent，外部 controller/spec 可引用）
// ---------- 类型阶梯（Ctx=业务上下文，非 request wrapper） ----------

sealed trait AuthedCtx {
  def userId: String
}
final case class GlobalCtx(userId: String, globalRole: String) extends AuthedCtx
final case class TenantCtx(userId: String, tenantId: String, tenantRole: String) extends AuthedCtx


// Dispatch 分支策略（顶层）
// ---------- Dispatch：单端点多分支、分支级权限策略（形态 D） ----------

sealed trait ViewBranch {
  def roles: Seq[String]
}
final case class TenantBranch(roles: Seq[String],
  run: (TenantCtx, Int, Int) => Future[Either[ApiError, JsValue]]) extends ViewBranch
final case class GlobalBranch(
  run: (GlobalCtx, Int, Int) => Future[Either[ApiError, JsValue]]) extends ViewBranch {
  def roles: Seq[String] = Nil // 全局视图 scope 即控（G6 类型化豁免的 dispatch 版）
}

@Singleton
final class Endpoint @Inject() (
  defaultAction: DefaultActionBuilder,
  anyParser: BodyParsers.Default,
  tokens: TokenService,
  config: Configuration
)(implicit ec: ExecutionContext) {

  private val log = Logger(classOf[Endpoint])
  private val gate: RoleGate = RoleGate.fromConfig(
    config.getOptional[String]("auth.roleGate.mode").getOrElse("migration"))

  /** 全局身份缺省：任何已验签登录者恒有 User 基础身份（词表 Global 层）。
    * TODO(B5): token 增加 gr claim / IdentityStore.roles 接线后替换缺省。 */
  private val DefaultGlobalRole: String = Roles.User

  // ---------- 内部管线 ----------

  private def forbiddenRoles(declared: Seq[String]): Future[Result] =
    Future.successful(Results.Forbidden(
      Json.obj("errorCode" -> "ROLE_REQUIRED", "message" -> s"requires one of: ${declared.mkString(",")}")))

  /** 认证段：Bearer 解析 + 本地验签（与 AuthAction.invokeBlock 同源：30s clock skew 容忍） */
  private def authenticate[A](raw: Request[A]): Either[Future[Result], VerifiedToken] = {
    def unauth(code: String, msg: String): Future[Result] =
      Future.successful(Results.Unauthorized(Json.obj("errorCode" -> code, "message" -> msg)))

    val tokenOpt = raw.headers.get("Authorization")
      .filter(_.startsWith("Bearer "))
      .map(_.drop(7).trim)

    tokenOpt match {
      case None => Left(unauth("INVALID_TOKEN", "missing or malformed Authorization header"))
      case Some(token) =>
        tokens.verifyAccess(token) match {
          case Some(vt) if vt.expiresAtEpochSec >= java.time.Instant.now().getEpochSecond - 30 => Right(vt)
          case Some(_) => Left(unauth("TOKEN_EXPIRED", "access token expired"))
          case None => Left(unauth("INVALID_TOKEN", "token verification failed"))
        }
    }
  }

  /** 租户段：VerifiedToken → TenantCtx（tenantId 非空的唯一构造点） */
  private def toTenant[A](vt: VerifiedToken, raw: Request[A], roles: Seq[String]): Either[Future[Result], TenantCtx] =
    vt.tenant match {
      case Some(TenantIdentity(tid, mrole)) =>
        roles match {
          case Nil => Right(TenantCtx(vt.userId, tid, mrole))
          case declared if declared.contains(mrole) => Right(TenantCtx(vt.userId, tid, mrole))
          case _ if mrole.isEmpty && gate.mode == RoleMode.Migration =>
            log.warn(s"ROLE_GATE_MIGRATION: declared [${roles.mkString(",")}] but token carries no mrole - passing")
            Right(TenantCtx(vt.userId, tid, mrole))
          case _ => Left(forbiddenRoles(roles))
        }
      case None => Left(Future.successful(Results.Forbidden(
        Json.obj("errorCode" -> "TENANT_REQUIRED",
          "message" -> "session carries no tenant context; re-login to bind a tenant"))))
    }

  /** 全局段：globalRole 缺省 User（词表 Global 层） */
  private def toGlobal[A](vt: VerifiedToken, roles: Seq[String]): Either[Future[Result], GlobalCtx] = {
    val gr = DefaultGlobalRole
    roles match {
      case Nil => Right(GlobalCtx(vt.userId, gr))
      case declared if declared.contains(gr) => Right(GlobalCtx(vt.userId, gr))
      case _ if gate.mode == RoleMode.Migration =>
        log.warn(s"ROLE_GATE_MIGRATION(global): declared [${roles.mkString(",")}] but globalRole=$gr - passing")
        Right(GlobalCtx(vt.userId, gr))
      case _ => Left(forbiddenRoles(roles))
    }
  }

  /** 统一出口：错误折叠 + 防崩 recover（R1 固化；M3 语义锚点=INTERNAL_ERROR 形状单点） */
  private def finishImpl[T](fut: Future[Either[ApiError, T]])(implicit w: OWrites[T]): Future[Result] =
    fut.recoverWith {
      case ex =>
        log.error("ENDPOINT_CRASH_GUARD", ex)
        Future.successful(Left(ApiError(500, "INTERNAL_ERROR", "unexpected server failure")))
    }.map(e => ApiError.toResult(e))

  /** JsValue 版（dispatch 形态 D 专用） */
  private def finishRaw(fut: Future[Either[ApiError, JsValue]]): Future[Result] =
    fut.recoverWith {
      case ex =>
        log.error("ENDPOINT_CRASH_GUARD", ex)
        Future.successful(Left(ApiError(500, "INTERNAL_ERROR", "unexpected server failure")))
    }.map {
      case Right(js) => Results.Ok(js)
      case Left(err) => Results.Status(err.status)(Json.toJson(err))
    }

  /** body 解码共享段（阶梯全类型通用；400 PARAM_INVALID 契约与 S2_9c tenantCommand/CommandParamValidationSpec 对齐，形状单点） */
  private def decodeBody[S, R, T](s: S, bodyOpt: Option[JsValue], reads: Reads[R])
                                 (handler: (S, R) => Future[Either[ApiError, T]])(implicit w: OWrites[T]): Future[Result] =
    bodyOpt.fold(Future.successful(Results.BadRequest(
      Json.obj("errorCode" -> "PARAM_INVALID", "message" -> "request body is not valid JSON"))))(body =>
      reads.reads(body).fold(
        err => Future.successful(Results.BadRequest(
          Json.obj("errorCode" -> "PARAM_INVALID", "message" -> play.api.libs.json.JsError.toJson(err).toString()))),
        req => finishImpl(handler(s, req))
      ))

  // ---------- 域根 1：api.global ----------

  final class GlobalRoot {
    final class GReader(roles: Seq[String]) {
      def apply[T](handler: GlobalCtx => Future[Either[ApiError, T]])(implicit w: OWrites[T]): Action[AnyContent] =
        defaultAction(anyParser).async { raw =>
          authenticate(raw).fold(f => f, vt =>
            toGlobal(vt, roles).fold(f => f, gs => finishImpl(handler(gs))))
        }
    }
    def read(roles: String*): GReader = new GReader(roles)

    final class GWriter[R](roles: Seq[String])(implicit reads: Reads[R]) {
      def apply[T](handler: (GlobalCtx, R) => Future[Either[ApiError, T]])(implicit w: OWrites[T]): Action[AnyContent] =
        defaultAction(anyParser).async { raw =>
          authenticate(raw).fold(f => f, vt =>
            toGlobal(vt, roles).fold(f => f, gs => decodeBody(gs, raw.body.asJson, reads)(handler)))
        }
    }
    def write[R](roles: String*)(implicit reads: Reads[R]): GWriter[R] = new GWriter[R](roles)
  }

  // ---------- 域根 2：api.tenant ----------

  final class TenantRoot {
    final class TReader(roles: Seq[String]) {
      def apply[T](handler: TenantCtx => Future[Either[ApiError, T]])(implicit w: OWrites[T]): Action[AnyContent] =
        defaultAction(anyParser).async { raw =>
          authenticate(raw).fold(f => f, vt =>
            toTenant(vt, raw, roles).fold(f => f, s => finishImpl(handler(s))))
        }
    }
    def read(roles: String*): TReader = new TReader(roles)

    final class TWriter[R](roles: Seq[String])(implicit reads: Reads[R]) {
      def apply[T](handler: (TenantCtx, R) => Future[Either[ApiError, T]])(implicit w: OWrites[T]): Action[AnyContent] =
        defaultAction(anyParser).async { raw =>
          authenticate(raw).fold(f => f, vt =>
            toTenant(vt, raw, roles).fold(f => f, s => decodeBody(s, raw.body.asJson, reads)(handler)))
        }
    }
    def write[R](roles: String*)(implicit reads: Reads[R]): TWriter[R] = new TWriter[R](roles)
  }

  // ---------- 域根：api.anonymous（免登录：无 token、无 session；身份自证走 body。B5-L L1/样例 A） ----------

  final class AnonymousRoot {
    final class AnonWriter[R](implicit reads: Reads[R]) {
      def apply[T](handler: (Request[AnyContent], R) => Future[Either[ApiError, T]])(implicit w: OWrites[T]): Action[AnyContent] =
        defaultAction(anyParser).async { raw =>
          decodeBody(raw, raw.body.asJson, reads)((req, body) => handler(req, body))
        }
    }
    def write[R](implicit reads: Reads[R]): AnonWriter[R] = new AnonWriter[R]
  }

  // ---------- 域根实例（方法名即 scope） ----------

  val global: GlobalRoot = new GlobalRoot
  val tenant: TenantRoot = new TenantRoot
  val anonymous: AnonymousRoot = new AnonymousRoot

  /** 单端点多分支入口：GET /views/:viewKey?page&pageSize 契约的 DSL 支持 */
  def dispatchView(viewKey: String, page: Int, pageSize: Int, registry: Map[String, ViewBranch]): Action[AnyContent] =
    defaultAction(anyParser).async { raw =>
      registry.get(viewKey) match {
        case None =>
          Future.successful(Results.NotFound(
            Json.obj("errorCode" -> "VIEW_NOT_FOUND", "message" -> s"unknown viewKey: $viewKey")))
        case Some(TenantBranch(roles, run)) =>
          authenticate(raw).fold(f => f, vt =>
            toTenant(vt, raw, roles).fold(f => f, ts => finishRaw(run(ts, page, pageSize))))
        case Some(GlobalBranch(run)) =>
          authenticate(raw).fold(f => f, vt =>
            toGlobal(vt, Nil).fold(f => f, gs => finishRaw(run(gs, page, pageSize))))
      }
    }
}
