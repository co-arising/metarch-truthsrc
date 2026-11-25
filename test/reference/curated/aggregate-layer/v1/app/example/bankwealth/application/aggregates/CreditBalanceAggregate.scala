package example.bankwealth.application.aggregates

import akka.cluster.sharding.typed.scaladsl.EntityTypeKey
import example.bankwealth.application.aggregates.CreditBalanceProtocol.{Command, CommandHandler}
import example.bankwealth.domain.services.CreditBalanceComputations

object CreditBalanceAggregate {

  val EntityKey: EntityTypeKey[Command] = EntityTypeKey("CreditBalance")
  val tags: Vector[String] = Vector.tabulate(1)(i => s"credit-balance-$$i")

  def commandHandler(hosts: CreditBalanceComputations): CommandHandler =
    behaviors.CreditBalanceBehaviors(hosts)
}
