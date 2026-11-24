package example.bankwealth.application.aggregates.repository

import akka.actor.typed.ActorRef
import example.bankwealth.application.aggregates.SipPlanProtocol.Command

object SipPlanRepository {
  final case class Handle(persistenceId: String, ref: ActorRef[Command])
}

trait SipPlanRepository[K] extends AutoCloseable {
  def get(id: K): SipPlanRepository.Handle
}
