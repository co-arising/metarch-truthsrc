package example.stockreservation.application.services.transactor

import net.imadz.infra.saga.strict.CodecPin

/** 期望直陈（Support 层）：frozen 字面量，不从被测代码推导。 */
object CompositionOracle {

  val namespacePrefix: String = "wafer-transfer"
  val childNamespacePrefix: String = "wafer-child"
  val singletonPrefix: String = "composition-"
  val childCompletedCode: String = "ChildCompleted"
  val childFailedCode: String = "ChildFailed"
  val childRejectedCode: String = "ChildRejected"
  val allStepsSucceeded: String = "AllStepsSucceeded"
  val conflictingIdentityCode: String = "ConflictingIdentity"
  val rejectedCode: String = "Rejected"
  val compensatedCode: String = "Compensated"

  val stepIds: Vector[String] = Vector("split-transfer", "await-child-run", "merge-transfer")
  val splitStep: String = "split-transfer"
  val awaitStep: String = "await-child-run"
  val mergeStep: String = "merge-transfer"

  val stageCursors: Vector[String] = Vector("receive#0", "process#1", "finalize#2")

  val splitModulePid: String = "strict-saga/wafer-transfer-split"
  val mergeModulePid: String = "strict-saga/wafer-transfer-merge"

  val argsPin: CodecPin = CodecPin("wafer-transfer-split-args", 1)
  val mergeArgsPin: CodecPin = CodecPin("wafer-transfer-merge-args", 1)

  val splitDigest: String =
    "sha256:341f1a82f50a18db167f3d639c758e0e6979d4ff8105cc3dc1385a03d3387213"
  val mergeDigest: String =
    "sha256:42a80323e7a97b74ebb60f17cc990af25609c32857f27b3bbe499326b820f449"

  /** 探得事实（2026-11-20）：planDigest 是运行时按 participant/receipt codec 计划
    * 重算的冻结值，与 args 无关（占用者与正常流同计划同 digest）。 */
  val splitPlanDigest: String =
    "sha256:f1f40c12f20c88ba9554305eadc9d06c673327c2087476122b639e070b72ffa6"

  val supportedCapabilities: Vector[String] = Vector(
    "durable-commit-decision", "durable-abort-decision", "typed-nonterminal-unknown",
    "safe-status-reattach", "receipt-reconciliation", "participant-idempotency-query",
    "pinned-definition-codec", "manual-evidence-authorization", "cancel-before-prepare-fencing",
    "durable-manifest", "durable-receipt", "exact-resource-addressing",
    "read-only-evidence-query")
  val declaredInvariants: Vector[String] = Vector("wafer-conservation")
  val declaredTypeIds: Vector[String] = Vector(
    "transaction-id", "lot-id", "wafer-list", "manifest", "count")

  val removalRefusalCode: Int = 6001
  val additionRefusalCode: Int = 6002

  /** 上游 #40 模块字节身份（approved golden 的族工件 sha256 全量）。 */
  val upstreamModuleSha256: String =
    "74ea17451219916e6158ff1bce1e5665ad6d2a148b55f55946e0fb69b2b8c13f"

  def hex(bytes: Array[Byte]): String =
    bytes.map(byte => f"${byte & 0xff}%02x").mkString
}
