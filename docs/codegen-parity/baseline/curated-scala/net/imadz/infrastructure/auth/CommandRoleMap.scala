// 示例桩·生成模式同 ingested-app GENERATED（S2-32 R3.3 引入）：ingested-app 侧由 gen_api_layer / rolemap_export
// 从 .ingest notes 共链导出（roles(c) = ∪ role: targets）；本仓无真源管线，故读 banking 聚合实码手编最小映射——
// 命令名对齐 CreditBalanceProtocol（AddInitial/Deposit/Withdraw/ReserveFunds/DeductFunds/ReleaseReservedFunds/
// RecordIncomingCredits/CommitIncomingCredits/CancelIncomingCredit）＋ MoneyTransferProtocol
// （InitiateMoneyTransferTransaction/UpdateMoneyTransferTransactionStatus）。
// 角色赋值：用户发起的账务命令 = TenantMember/TenantOwner；saga 内部参与者命令 = System；
// 读视图 roles = 喂给该视图的命令 roles 并集（m[V] = ∪ roles(c ∈ commandsOf(V))）。
package net.imadz.infrastructure.auth

/** CommandRoleMap —— ⚠️ banking 示例桩（手编，非真源导出；生成模式同 ingested-app GENERATED）。
  *
  * 两索引各司其职：
  *   of(viewKey)      —— 读侧端点声明（视图关联命令 roles 并集）；
  *   ofCommand(cmd)   —— 写侧端点声明（命令粒度；authorize(scopeOf(cmd), userId) ∩ roles(cmd) 的直接实现）。
  *
  * 空集语义（与 ingested-app 写死语义一致）：Seq.empty = 角色不设限由 scope 兜底，≠全员放行。 */
object CommandRoleMap {
  // key = ViewKeys（读侧语义）；值 = 该视图关联命令 roles 并集
  private val m: Map[String, Seq[String]] = Map(
    ViewKeys.CreditBalances -> Seq(Roles.TenantMember, Roles.TenantOwner),
    ViewKeys.MonthlyIncomeExpenseSummaries -> Seq(Roles.TenantMember, Roles.TenantOwner),
    ViewKeys.MoneyTransferTransactions -> Seq(Roles.TenantMember, Roles.TenantOwner)
  )
  // 写侧命令粒度（roles(cmd)）——命令名对齐 CreditBalanceProtocol / MoneyTransferProtocol 实码
  private val byCommand: Map[String, Seq[String]] = Map(
    "AddInitial" -> Seq(Roles.TenantOwner),
    "Deposit" -> Seq(Roles.TenantMember, Roles.TenantOwner),
    "Withdraw" -> Seq(Roles.TenantMember, Roles.TenantOwner),
    "ReserveFunds" -> Seq(Roles.System),
    "DeductFunds" -> Seq(Roles.System),
    "ReleaseReservedFunds" -> Seq(Roles.System),
    "RecordIncomingCredits" -> Seq(Roles.System),
    "CommitIncomingCredits" -> Seq(Roles.System),
    "CancelIncomingCredit" -> Seq(Roles.System),
    "InitiateMoneyTransferTransaction" -> Seq(Roles.TenantMember, Roles.TenantOwner),
    "UpdateMoneyTransferTransactionStatus" -> Seq(Roles.System)
  )
  def of(viewKey: String): Seq[String] = m.getOrElse(viewKey, Nil)
  def ofCommand(command: String): Seq[String] = byCommand.getOrElse(command, Nil)
}
