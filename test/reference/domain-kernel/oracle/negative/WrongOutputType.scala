package example.counter.oracle.controls

import example.counter.domain.ports.CounterComputations
import example.counter.domain.values.Reading

// Must fail type-checking: the required result is nominal Ratio, not String.
final class WrongOutputType extends CounterComputations {
  override def acceptedRatio(reading: Reading, count: Long, minimum: Long): String =
    "wrong-result"
}
