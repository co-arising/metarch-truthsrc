package example.counter.domain.invariant.params

import example.counter.domain.CounterProtocol
import example.counter.domain.CounterState
import example.counter.domain.ports.CounterComputations

object CounterRuleParams {
  final case class SetCountParams(
    state: CounterState,
    command: CounterProtocol.SetCount,
    hosts: CounterComputations
  )
}
