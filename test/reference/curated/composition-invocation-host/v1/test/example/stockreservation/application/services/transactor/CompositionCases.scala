package example.stockreservation.application.services.transactor

/** 测试用例值域（Support 层）：组合 fixture 的操作名/批次/lot 恒等值。 */
object CompositionCases {

  val seedFrom: Vector[String] = Vector("w-001", "w-002", "w-003", "w-004")
  val splitWafers: Vector[String] = Vector("w-001", "w-002")
  val childBaseWafers: Vector[String] = Vector("w-101")
  val occupierWafers: Vector[String] = Vector("w-901", "w-902")
  val manifestSeed: String = "manifest-seed-v1"
  val fromLot: String = "parent-lot"
  val toLot: String = "child-lot"
  val reconcileToken: String = "wafer-composition-reconcile-token"

  private val operationCounter = new java.util.concurrent.atomic.AtomicInteger(0)

  def nextOperation(prefix: String): String = prefix + "-" + operationCounter.incrementAndGet()
}
