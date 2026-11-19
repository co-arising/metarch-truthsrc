// 来源：curated 参考件 net/imadz/common/auth/TokenService.scala（包名同名对齐）。
// 裁决 O1（2026-11-20 用户确认）：裁剪到本样消费面——仅验签读取与两类 token 记录；
// JWT 签发/验签实现及其 pdi.jwt 依赖属平台 common/auth-core jar，不入本族金样。
package net.imadz.common.auth

/** 本地验签读取面（P1 本地验签；HS256 实现属平台 jar）。 */
trait TokenService {
  def verifyAccess(token: String): Option[VerifiedToken]
}

/** 验签通过后的 token 记录（curated 原样）。 */
case class VerifiedToken(userId: String, tokenVersion: Int, expiresAtEpochSec: Long,
                         tenant: Option[TenantIdentity] = None)

/** 租户上下文（EP_S2_9 D5-A：登录时经名册验证后烧入 token；v1 仅 tenantId，不造值）。 */
case class TenantIdentity(tenantId: String, role: String)
