// 示例桩·生成模式同 ingested-app GENERATED（S2-32 R3.3 引入）：ingested-app 侧由 gen_api_layer 从 readmodels
// ＋ viewkey_rename_map.v1 导出；本仓读 banking 读侧实码手编——GetBalanceQuery（余额）、
// MonthlyIncomeAndExpenseSummaryProjection（月度收支汇总）、MoneyTransferTransactionEntity（转账事务）。
package net.imadz.infrastructure.auth

/** ViewKeys —— ⚠️ banking 示例桩（手编，非真源导出）。
  * 读侧语义命名（用户拍板 2026-08-27）：快照型→资源复数名。 */
object ViewKeys {
  val CreditBalances = "credit-balances"
  val MonthlyIncomeExpenseSummaries = "monthly-income-expense-summaries"
  val MoneyTransferTransactions = "money-transfer-transactions"
}
