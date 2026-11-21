package example.stockreservation.application.aggregates

import akka.actor.typed.{ActorRef, Behavior}
import akka.cluster.sharding.typed.scaladsl.EntityTypeKey
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import example.stockreservation.domain.entities.{WarehouseEntity, WarehouseState}
import example.stockreservation.domain.events._

/** 手写业务供给（#41 strict-fixture-host，boundary 层）：warehouse 参与聚合协议。
  * 6 个相位命令逐字对齐模块 PhaseContract.command（reserve-stock / commit-stock /
  * release-stock / place-stock-order / settle-stock-order / cancel-stock-order）
  * ＋只读状态查询＋发布命令。2 态 typed 回执（F9 裁定）：PhaseReply(result:
  * Either[OperationError, R])——收据值由聚合产出（F8 裁定），拒绝携带 code/message。
  * 预订 id 与订单 id 由 txid 确定性派生（nameUUIDFromBytes，无随机面）；
  * RecordTransferCompleted 幂等：同一 txid 重复发布重放确认不落新事件。 */
object WarehouseProtocol {

  final case class OperationError(code: Int, message: String) {
    require(code > 0, "positive error code required")
    require(message != null && message.nonEmpty, "error message required")
  }

  final case class PhaseReply[R](result: Either[OperationError, R])

  final case class ReservedStock(reservationId: java.util.UUID, reservedQuantity: Int)
  final case class CommittedStock(committedQuantity: Int)
  final case class ReleasedStock(releasedQuantity: Int)
  final case class PlacedOrder(orderId: java.util.UUID, confirmedQuantity: Int)
  final case class SettledOrder(settledQuantity: Int)
  final case class CancelledOrder(cancelledQuantity: Int)
  final case class CompletionAcknowledgement(transactionId: String)

  sealed trait WarehouseCommand

  sealed trait WarehouseReservationCommand extends WarehouseCommand

  final case class ReserveStock(transactionId: String, sku: String, quantity: Int,
                                replyTo: ActorRef[PhaseReply[ReservedStock]])
    extends WarehouseReservationCommand {
    require(transactionId != null && transactionId.nonEmpty, "transaction id required")
    require(sku != null && sku.nonEmpty, "sku required")
    require(quantity > 0, "positive quantity required")
  }

  final case class CommitStock(transactionId: String, reservationId: java.util.UUID,
                               replyTo: ActorRef[PhaseReply[CommittedStock]])
    extends WarehouseReservationCommand {
    require(transactionId != null && transactionId.nonEmpty, "transaction id required")
    require(reservationId != null, "reservation id required")
  }

  final case class ReleaseStock(transactionId: String, reservationId: java.util.UUID,
                                replyTo: ActorRef[PhaseReply[ReleasedStock]])
    extends WarehouseReservationCommand {
    require(transactionId != null && transactionId.nonEmpty, "transaction id required")
    require(reservationId != null, "reservation id required")
  }

  sealed trait WarehouseOrderCommand extends WarehouseCommand

  final case class PlaceStockOrder(transactionId: String, sku: String, quantity: Int,
                                   replyTo: ActorRef[PhaseReply[PlacedOrder]])
    extends WarehouseOrderCommand {
    require(transactionId != null && transactionId.nonEmpty, "transaction id required")
    require(sku != null && sku.nonEmpty, "sku required")
    require(quantity > 0, "positive quantity required")
  }

  final case class SettleStockOrder(transactionId: String, orderId: java.util.UUID,
                                    replyTo: ActorRef[PhaseReply[SettledOrder]])
    extends WarehouseOrderCommand {
    require(transactionId != null && transactionId.nonEmpty, "transaction id required")
    require(orderId != null, "order id required")
  }

  final case class CancelStockOrder(transactionId: String, orderId: java.util.UUID,
                                    replyTo: ActorRef[PhaseReply[CancelledOrder]])
    extends WarehouseOrderCommand {
    require(transactionId != null && transactionId.nonEmpty, "transaction id required")
    require(orderId != null, "order id required")
  }

  final case class GetWarehouseState(replyTo: ActorRef[WarehouseState]) extends WarehouseCommand {
    require(replyTo != null, "reply ref required")
  }

  final case class RecordTransferCompleted(transactionId: String,
                                           replyTo: ActorRef[PhaseReply[CompletionAcknowledgement]])
    extends WarehouseCommand {
    require(transactionId != null && transactionId.nonEmpty, "transaction id required")
  }



  val entityKey: EntityTypeKey[WarehouseCommand] = EntityTypeKey[WarehouseCommand]("warehouse")

  def behavior(entityId: String): Behavior[WarehouseCommand] =
    EventSourcedBehavior(
      persistenceId = PersistenceId(entityKey.name, entityId),
      emptyState = WarehouseEntity.empty(java.util.UUID.fromString(entityId)),
      commandHandler = (state, command) => commandEffect(state, command),
      eventHandler = (state, event) => WarehouseEntity.applyEvent(state, event))

  private def commandEffect(state: WarehouseState,
                            command: WarehouseCommand): Effect[WarehouseEvent, WarehouseState] =
    command match {
      case c: WarehouseReservationCommand => reservationEffect(state, c)
      case c: WarehouseOrderCommand => orderEffect(state, c)
      case RecordTransferCompleted(transactionId, replyTo) =>
        recordCompleted(state, transactionId, replyTo)
      case GetWarehouseState(replyTo) => Effect.reply(replyTo)(state)
    }

  private def reservationEffect(
      state: WarehouseState,
      command: WarehouseReservationCommand
  ): Effect[WarehouseEvent, WarehouseState] =
    command match {
      case ReserveStock(transactionId, sku, quantity, replyTo) =>
        reserveStock(state, transactionId, sku, quantity, replyTo)
      case CommitStock(transactionId, reservationId, replyTo) =>
        commitStock(state, transactionId, reservationId, replyTo)
      case ReleaseStock(transactionId, reservationId, replyTo) =>
        releaseStock(state, transactionId, reservationId, replyTo)
    }

  private def orderEffect(
      state: WarehouseState,
      command: WarehouseOrderCommand
  ): Effect[WarehouseEvent, WarehouseState] =
    command match {
      case PlaceStockOrder(transactionId, sku, quantity, replyTo) =>
        placeOrder(state, transactionId, sku, quantity, replyTo)
      case SettleStockOrder(transactionId, orderId, replyTo) =>
        settleOrder(state, transactionId, orderId, replyTo)
      case CancelStockOrder(transactionId, orderId, replyTo) =>
        cancelOrder(state, transactionId, orderId, replyTo)
    }

  private def reserveStock(
      state: WarehouseState,
      transactionId: String,
      sku: String,
      quantity: Int,
      replyTo: ActorRef[PhaseReply[ReservedStock]]
  ): Effect[WarehouseEvent, WarehouseState] =
    state.reserved.get(transactionId).fold[Effect[WarehouseEvent, WarehouseState]](
      reserveFresh(state, transactionId, sku, quantity, replyTo))(
      mark => Effect.reply(replyTo)(
        PhaseReply(Right(ReservedStock(mark.reservationId, mark.quantity)))))

  private def reserveFresh(
      state: WarehouseState,
      transactionId: String,
      sku: String,
      quantity: Int,
      replyTo: ActorRef[PhaseReply[ReservedStock]]
  ): Effect[WarehouseEvent, WarehouseState] =
    if (state.available.getOrElse(sku, 0) < quantity)
      Effect.reply(replyTo)(
        PhaseReply(Left(OperationError(6001, "insufficient stock at warehouse"))))
    else {
      val reservationId = derivedId("reserve", transactionId)
      Effect.persist(StockReserved(transactionId, reservationId, sku, quantity))
        .thenRun(_ => replyTo ! PhaseReply(Right(ReservedStock(reservationId, quantity))))
    }

  private def commitStock(
      state: WarehouseState,
      transactionId: String,
      reservationId: java.util.UUID,
      replyTo: ActorRef[PhaseReply[CommittedStock]]
  ): Effect[WarehouseEvent, WarehouseState] =
    state.reserved.get(transactionId).fold[Effect[WarehouseEvent, WarehouseState]](
      Effect.reply(replyTo)(
        PhaseReply(Left(OperationError(6002, "unknown reservation for transaction")))))(
      mark => commitMatched(state, transactionId, reservationId, mark, replyTo))

  private def commitMatched(
      state: WarehouseState,
      transactionId: String,
      reservationId: java.util.UUID,
      mark: example.stockreservation.domain.entities.WarehouseReservationMark,
      replyTo: ActorRef[PhaseReply[CommittedStock]]
  ): Effect[WarehouseEvent, WarehouseState] =
    if (mark.reservationId == reservationId)
      Effect.persist(StockCommitted(transactionId, mark.reservationId, mark.sku, mark.quantity))
        .thenRun(_ => replyTo ! PhaseReply(Right(CommittedStock(mark.quantity))))
    else
      Effect.reply(replyTo)(PhaseReply(Left(OperationError(6003, "reservation id mismatch"))))

  private def releaseStock(
      state: WarehouseState,
      transactionId: String,
      reservationId: java.util.UUID,
      replyTo: ActorRef[PhaseReply[ReleasedStock]]
  ): Effect[WarehouseEvent, WarehouseState] =
    state.reserved.get(transactionId).fold[Effect[WarehouseEvent, WarehouseState]](
      Effect.reply(replyTo)(
        PhaseReply(Left(OperationError(6002, "unknown reservation for transaction")))))(
      mark => releaseMatched(state, transactionId, reservationId, mark, replyTo))

  private def releaseMatched(
      state: WarehouseState,
      transactionId: String,
      reservationId: java.util.UUID,
      mark: example.stockreservation.domain.entities.WarehouseReservationMark,
      replyTo: ActorRef[PhaseReply[ReleasedStock]]
  ): Effect[WarehouseEvent, WarehouseState] =
    if (mark.reservationId == reservationId)
      Effect.persist(StockReleased(transactionId, mark.reservationId, mark.sku, mark.quantity))
        .thenRun(_ => replyTo ! PhaseReply(Right(ReleasedStock(mark.quantity))))
    else
      Effect.reply(replyTo)(PhaseReply(Left(OperationError(6003, "reservation id mismatch"))))

  private def placeOrder(
      state: WarehouseState,
      transactionId: String,
      sku: String,
      quantity: Int,
      replyTo: ActorRef[PhaseReply[PlacedOrder]]
  ): Effect[WarehouseEvent, WarehouseState] =
    state.orders.get(transactionId).fold[Effect[WarehouseEvent, WarehouseState]](
      {
        val orderId = derivedId("order", transactionId)
        Effect.persist(StockOrderPlaced(transactionId, orderId, sku, quantity))
          .thenRun(_ => replyTo ! PhaseReply(Right(PlacedOrder(orderId, quantity))))
      })(
      mark => Effect.reply(replyTo)(PhaseReply(Right(PlacedOrder(mark.orderId, mark.quantity)))))

  private def settleOrder(
      state: WarehouseState,
      transactionId: String,
      orderId: java.util.UUID,
      replyTo: ActorRef[PhaseReply[SettledOrder]]
  ): Effect[WarehouseEvent, WarehouseState] =
    state.orders.get(transactionId).fold[Effect[WarehouseEvent, WarehouseState]](
      Effect.reply(replyTo)(
        PhaseReply(Left(OperationError(6004, "unknown stock order for transaction")))))(
      mark => settleMatched(state, transactionId, orderId, mark, replyTo))

  private def settleMatched(
      state: WarehouseState,
      transactionId: String,
      orderId: java.util.UUID,
      mark: example.stockreservation.domain.entities.WarehouseOrderMark,
      replyTo: ActorRef[PhaseReply[SettledOrder]]
  ): Effect[WarehouseEvent, WarehouseState] =
    if (mark.orderId == orderId)
      Effect.persist(StockOrderSettled(transactionId, mark.orderId, mark.sku, mark.quantity))
        .thenRun(_ => replyTo ! PhaseReply(Right(SettledOrder(mark.quantity))))
    else
      Effect.reply(replyTo)(PhaseReply(Left(OperationError(6005, "order id mismatch"))))

  private def cancelOrder(
      state: WarehouseState,
      transactionId: String,
      orderId: java.util.UUID,
      replyTo: ActorRef[PhaseReply[CancelledOrder]]
  ): Effect[WarehouseEvent, WarehouseState] =
    state.orders.get(transactionId).fold[Effect[WarehouseEvent, WarehouseState]](
      Effect.reply(replyTo)(
        PhaseReply(Left(OperationError(6004, "unknown stock order for transaction")))))(
      mark => cancelMatched(state, transactionId, orderId, mark, replyTo))

  private def cancelMatched(
      state: WarehouseState,
      transactionId: String,
      orderId: java.util.UUID,
      mark: example.stockreservation.domain.entities.WarehouseOrderMark,
      replyTo: ActorRef[PhaseReply[CancelledOrder]]
  ): Effect[WarehouseEvent, WarehouseState] =
    if (mark.orderId == orderId)
      Effect.persist(StockOrderCancelled(transactionId, mark.orderId, mark.sku, mark.quantity))
        .thenRun(_ => replyTo ! PhaseReply(Right(CancelledOrder(mark.quantity))))
    else
      Effect.reply(replyTo)(PhaseReply(Left(OperationError(6005, "order id mismatch"))))

  private def recordCompleted(
      state: WarehouseState,
      transactionId: String,
      replyTo: ActorRef[PhaseReply[CompletionAcknowledgement]]
  ): Effect[WarehouseEvent, WarehouseState] =
    if (state.completedTransfers.contains(transactionId))
      Effect.reply(replyTo)(PhaseReply(Right(CompletionAcknowledgement(transactionId))))
    else
      Effect.persist(TransferCompletedRecorded(transactionId, state.warehouseId))
        .thenRun(_ => replyTo ! PhaseReply(Right(CompletionAcknowledgement(transactionId))))

  private def derivedId(prefix: String, transactionId: String): java.util.UUID =
    java.util.UUID.nameUUIDFromBytes(
      s"$prefix:$transactionId".getBytes(java.nio.charset.StandardCharsets.UTF_8))
}
