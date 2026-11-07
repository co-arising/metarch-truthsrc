package example.counter.domain.ports

import example.counter.domain.values._

trait CounterComputations {
  def acceptedRatio(reading: Reading, count: Long, minimum: Long): Ratio
}
