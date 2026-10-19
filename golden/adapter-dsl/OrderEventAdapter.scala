package goldens.adapdsl

/** Persistence adapter: OrderEvent <-> journal */
object OrderEventAdapter {
  def toJournal(event: OrderEvent): String = ??? // TODO: serialize
  def fromJournal(json: String): OrderEvent = ??? // TODO: deserialize
}
