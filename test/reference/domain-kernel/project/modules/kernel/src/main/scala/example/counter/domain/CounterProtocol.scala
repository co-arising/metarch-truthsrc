package example.counter.domain

import example.counter.domain.values._

object CounterProtocol {
  sealed trait Command
  sealed trait Event

  final case class SetCount(id: String, count: Long, reading: Reading) extends Command

  final case class CountSet(id: String, count: Long, reading: Reading, accepted: Ratio) extends Event
}
