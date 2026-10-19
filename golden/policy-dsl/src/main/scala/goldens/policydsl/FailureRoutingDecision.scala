package goldens.policydsl

// Stubs (in real use, from event-dsl/command-dsl)
final case class RunCompleted(failedCount: Int, suspicious: Boolean)
final case class AbandonOrder(customerId: String)
final case class EscalateToManual(customerId: String)

// Policy: Failure Routing Decision
object FailureRoutingDecision {
  def decide(event: Any): Seq[Any] = event match {
    case e: RunCompleted if e.failedCount > 0 =>
      Seq(AbandonOrder("c1"))
    case e: RunCompleted if e.suspicious =>
      Seq(EscalateToManual("c1"))
    case _ => Seq.empty
  }
}
