package example.stockreservation.application.services.transactor

import java.util.UUID
import net.imadz.infra.saga.strict.CodecPin

/** 期望直陈（Support 层）：frozen 字面量，不从被测代码推导。 */
object SagaEntryOracle {

  val namespacePrefix: String = "strict-saga"
  val modulePid: String = "strict-saga/stock-transfer"
  val coordinatorName: String = "stock-transfer-strict-saga-coordinator"
  val replySinkName: String = "stock-transfer-completion-reply-sink"
  val reconcilePrincipal: String = "fixture-reconciler"
  val tokenMismatch: String = "reconciliation token mismatch"
  val reconcileToken: String = "fixture-reconcile-token-2026"
  val wrongToken: String = "not-the-token"

  val argsPin: CodecPin = CodecPin("stock-transfer-args", 1)
  val reservePreparePin: CodecPin = CodecPin("stock-transfer-reserve-source-stock-prepare", 1)
  val reserveCommitPin: CodecPin = CodecPin("stock-transfer-reserve-source-stock-commit", 1)
  val reserveCompensatePin: CodecPin = CodecPin(
    "stock-transfer-reserve-source-stock-compensate", 1)
  val targetPreparePin: CodecPin = CodecPin("stock-transfer-commit-target-stock-prepare", 2)
  val targetCommitPin: CodecPin = CodecPin("stock-transfer-commit-target-stock-commit", 1)
  val targetCompensatePin: CodecPin = CodecPin(
    "stock-transfer-commit-target-stock-compensate", 1)

  val supportedCapabilities: Vector[String] = Vector(
    "durable-commit-decision", "durable-abort-decision", "typed-nonterminal-unknown",
    "safe-status-reattach", "receipt-reconciliation", "participant-idempotency-query",
    "pinned-definition-codec", "manual-evidence-authorization", "cancel-before-prepare-fencing",
    "durable-manifest", "durable-receipt", "exact-resource-addressing",
    "read-only-evidence-query")
  val declaredInvariants: Vector[String] = Vector("reservation-conservation")

  val declaredTypeIds: Vector[String] = Vector(
    "transaction-id", "warehouse-id", "sku", "quantity", "transfer-mode", "transfer-id")

  val trailingMessage: String = "what wire: trailing bytes after the declared fields"
  val countMismatchMessage: String = "what wire: field count mismatch"

  val unsupportedCapability: String = "unbounded-streaming"
  val insufficientCode: Int = 6001
  val unknownReservationCode: Int = 6002

  /** 长度前缀文本框架的 frozen 字节向量（hex）：StrictWire oracle。 */
  val framedAlpha: String =
    "0000000d" + "736b752d616c7068612d303031" // "sku-alpha-001" utf8 hex, 13 bytes

  def hex(bytes: Array[Byte]): String =
    bytes.map(byte => f"${byte & 0xff}%02x").mkString

  def unhex(value: String): Array[Byte] = {
    val data = new scala.collection.mutable.ArrayBuffer[Byte]
    var index = 0
    while (index + 1 < value.length) {
      data += java.lang.Integer.parseInt(value.substring(index, index + 2), 16).toByte
      index += 2
    }
    data.toArray
  }

  /** 模块上游字节身份（#40 approved golden 的族工件 sha256 全量）。 */
  val upstreamModuleSha256: String =
    "74ea17451219916e6158ff1bce1e5665ad6d2a148b55f55946e0fb69b2b8c13f"
}
