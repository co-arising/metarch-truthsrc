package example.counter.oracle.controls

import example.counter.domain.{CounterProtocol, CounterState}
import example.counter.domain.invariant.params.CounterRuleParams
import example.counter.domain.ports.CounterComputations
import example.counter.domain.values.{Ratio, Reading}

final class ValidHost extends CounterComputations {
  override def acceptedRatio(reading: Reading, count: Long, minimum: Long): Ratio =
    reading.ratio
}

object ValidHostUse {
  def accepted(state: CounterState, command: CounterProtocol.SetCount): Ratio = {
    val params = CounterRuleParams.SetCountParams(state, command, new ValidHost)
    params.hosts.acceptedRatio(params.command.reading, params.command.count, params.state.minimum)
  }
}
