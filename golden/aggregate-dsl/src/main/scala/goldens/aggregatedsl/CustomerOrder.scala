package goldens.aggregatedsl

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class CustomerOrderState(chain: String, customerId: String, terminalState: String, amount: BigDecimal) extends CborSerializable

sealed trait CustomerOrderCommand extends CborSerializable
final case class SettleRecharge(customerId: String, amount: BigDecimal) extends CustomerOrderCommand
final case class SettlePurchase() extends CustomerOrderCommand
final case class AbandonOrder(customerId: String) extends CustomerOrderCommand
final case class EscalateToManual() extends CustomerOrderCommand
final case class ParkInExceptionPool() extends CustomerOrderCommand
final case class ReplayException() extends CustomerOrderCommand

sealed trait CustomerOrderEvent extends CborSerializable
final case class OrderCredited(customerId: String, amount: BigDecimal) extends CustomerOrderEvent
final case class OrderPaid() extends CustomerOrderEvent
final case class OrderRejected(customerId: String) extends CustomerOrderEvent
final case class OrderEscalated() extends CustomerOrderEvent
final case class OrderParkedInExceptionPool() extends CustomerOrderEvent
final case class ExceptionReplayed() extends CustomerOrderEvent

object CustomerOrder {
  def behavior(persistenceId: PersistenceId): Behavior[CustomerOrderCommand] =
    EventSourcedBehavior[CustomerOrderCommand, CustomerOrderEvent, CustomerOrderState](
      persistenceId = persistenceId,
      emptyState = CustomerOrderState("", "", "", BigDecimal(0)),
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: CustomerOrderState, cmd: CustomerOrderCommand): Effect[CustomerOrderEvent, CustomerOrderState] =
    cmd match {
      case cmd: SettleRecharge =>
        Effect.persist(OrderCredited(cmd.customerId, cmd.amount))
      case cmd: AbandonOrder =>
        Effect.persist(OrderRejected(cmd.customerId))
      case _ => Effect.unhandled
    }

  private def applyEvent(state: CustomerOrderState, event: CustomerOrderEvent): CustomerOrderState =
    event match {

      case _ => state
    }
}
