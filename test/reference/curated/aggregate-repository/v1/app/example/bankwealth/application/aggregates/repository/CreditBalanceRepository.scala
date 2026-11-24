package example.bankwealth.application.aggregates.repository

import akka.actor.typed.ActorRef
import example.bankwealth.application.aggregates.CreditBalanceProtocol.Command

object CreditBalanceRepository {
  final case class Handle(persistenceId: String, ref: ActorRef[Command])
}

trait CreditBalanceRepository[K] extends AutoCloseable {
  def get(id: K): CreditBalanceRepository.Handle
}
