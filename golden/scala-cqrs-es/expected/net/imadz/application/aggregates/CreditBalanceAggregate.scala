package net.imadz..application.aggregates

import akka.cluster.sharding.typed.scaladsl.EntityTypeKey
import akka.persistence.typed.scaladsl.Effect
import net.imadz..application.aggregates.behaviors.CreditBalanceBehaviors
import net.imadz..domain.entities.CreditBalanceEntity.CreditBalanceState
import net.imadz..domain.values.CreditBalanceEvent

object CreditBalanceAggregate {

// Commands are defined in Protocol
// Replies are defined in Protocol




  // Wiring (Separated Behavior) - Type alias now in Protocol
  def commandHandler: net.imadz..application.aggregates.CreditBalanceCommandHandler = CreditBalanceBehaviors.apply



  val entityTypeKey: EntityTypeKey[CreditBalanceCommand] = EntityTypeKey("CreditBalance")
  val tags: Vector[String] = Vector.tabulate(5)(i => s"credit-balance-$i")


}
