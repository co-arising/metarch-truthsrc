package example.bankwealth.application.aggregates

import akka.cluster.sharding.typed.scaladsl.EntityTypeKey
import example.bankwealth.application.aggregates.SipPlanProtocol.{Command, CommandHandler}
import example.bankwealth.domain.services.SipPlanComputations

object SipPlanAggregate {

  val EntityKey: EntityTypeKey[Command] = EntityTypeKey("SipPlan")
  val tags: Vector[String] = Vector.tabulate(1)(i => s"sip-plan-$$i")

  def commandHandler(hosts: SipPlanComputations): CommandHandler =
    behaviors.SipPlanBehaviors(hosts)
}
