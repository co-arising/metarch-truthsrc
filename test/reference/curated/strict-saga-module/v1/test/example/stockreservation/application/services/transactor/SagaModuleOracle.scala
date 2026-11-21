package example.stockreservation.application.services.transactor

import example.stockreservation.application.services.transactor.StockTransferSagaModule
import net.imadz.infra.saga.strict._

/** 期望直陈（Support 层）：模块合同常量与关键合同对象的期望字面量。行为/结构
  * 性质共同消费；全部值与 technical-input 冻结实例逐字一致。 */
object SagaModuleOracle {
  import StockTransferSagaModule._

  val name: String = "stock-transfer"
  val version: Int = 1
  val digest: String = "sha256:6d7dbbcfe6d0aa09b5b83723dee9f7ca85727eec8d48e6d8f0f239db483b8610"
  val argsPin: CodecPin = CodecPin("stock-transfer-args", 1)
  val candidateArtifact: String = "StockTransferSagaModule"
  val artifactStatus: String = "generated"

  val expectedArgsCodec: ArgsCodecContract = ArgsCodecContract(
    "example.stockreservation.saga.codec.StockTransferArgsCodec",
    "stock-transfer-v1", "1.0.0", Vector("1.0.0"), argsPin)

  val expectedHostRequirements: HostRequirements = HostRequirements(
    Vector("durable-receipt", "exact-resource-addressing", "read-only-evidence-query"),
    30000, 8, 64, 500, true, Vector("reservation-conservation"),
    "durable-before-commit", "durable-before-compensate", "forward-recovery",
    "reconcile-before-resume",
    "confirmed-reservations", "empty-release-and-fence", "stable-operation",
    "authorized-reconciliation-evidence", 3, 5000, 2000, 250)

  val expectedSourceAddress: AddressContract = AddressContract(
    "source-warehouse", "source-warehouse-id", "warehouse-id", "warehouse",
    "example.stockreservation.domain.warehouse.WarehouseRegistry", "exact-resource")
  val expectedTargetAddress: AddressContract = AddressContract(
    "target-warehouse", "target-warehouse-id", "warehouse-id", "warehouse",
    "example.stockreservation.domain.warehouse.WarehouseRegistry", "exact-resource")

  val prepareOnePin: CodecPin = CodecPin("stock-transfer-reserve-source-stock-prepare", 1)
  val prepareTwoPin: CodecPin = CodecPin("stock-transfer-commit-target-stock-prepare", 2)

  val identityWires: Vector[String] =
    Vector("txid", "definition-version", "args-digest", "participant", "resource",
      "step", "phase")
  val operationWires: Vector[String] =
    Vector("txid", "definition-version", "participant", "resource", "step", "phase")
  val resultWires: Vector[String] = Vector("confirmed", "not-executed", "unknown")

  val expectedStepIds: Vector[String] =
    Vector("reserve-source-stock", "commit-target-stock")
  val expectedParticipants: Vector[String] =
    Vector("source-warehouse", "target-warehouse")
  val expectedPhases: Set[Phase] = Set(Phase.Prepare, Phase.Commit, Phase.Compensate)

  val prepareContract: PhaseContract = reserveSourceStockPrepareBindingContract
  val stepFieldOrder: Vector[String] =
    Vector("transactionId", "sourceWarehouseId", "sku", "quantity")
  val transferModes: Set[String] = Set("STANDARD", "URGENT")
}
