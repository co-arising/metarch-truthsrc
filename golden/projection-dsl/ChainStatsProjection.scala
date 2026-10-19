package goldens.projectiondsl

// Stubs (in real use, from event-dsl)
final case class OrderCredited(customerId: String)
final case class OrderRejected(customerId: String)

/** Projection: Chain Statistics Projection → ChainStatistics */
object ChainStatsProjection {
  def handle(event: Any): Unit = event match {
      case e: OrderCredited =>
        // TODO(intent): update ChainStatistics from OrderCredited
      case e: OrderRejected =>
        // TODO(intent): update ChainStatistics from OrderRejected
    case _ => ()
  }
}
