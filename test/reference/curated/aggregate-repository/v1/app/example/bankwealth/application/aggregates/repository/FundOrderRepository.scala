package example.bankwealth.application.aggregates.repository

import akka.actor.typed.ActorRef
import example.bankwealth.application.aggregates.FundOrderProtocol.Command

object FundOrderRepository {
  final case class Handle(persistenceId: String, ref: ActorRef[Command])
}

trait FundOrderRepository[K] extends AutoCloseable {
  def get(id: K): FundOrderRepository.Handle
}
