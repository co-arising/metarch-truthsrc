package example.stockreservation.application.aggregates

import akka.actor.typed.ActorRef
import akka.actor.typed.Behavior
import akka.actor.typed.receptionist.Receptionist
import akka.cluster.sharding.typed.scaladsl.EntityTypeKey
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.Effect
import akka.persistence.typed.scaladsl.EventSourcedBehavior
import akka.persistence.typed.scaladsl.ReplyEffect
import example.stockreservation.domain.entities.LotEntity
import example.stockreservation.domain.entities.LotState
import example.stockreservation.domain.events.LotEvent
import example.stockreservation.domain.events.{WaferAdditionCommitted, WaferAdditionReserved,
  WaferAdditionRestored, WaferRemovalCommitted, WaferRemovalReserved, WaferRemovalRestored}
import net.imadz.common.CborSerializable

/** 手写业务供给（#42 composition-invocation-host）：wafer lot 聚合协议面。
  * StartTransfer 是组合 plan 的共享触发命令（两个 wafer saga 的 trigger source
  * 逐字同一命令面，B04 合同）；它不在实体命令族内（触发器只是入口面，#40 的
  * TransferStockCommand 同款）。TCC 六命令的参数名逐字匹配组合 builder 的
  * seed 三分类（txid / resource / 集合载荷，F6 裁定）；LotReply 是 reply family
  * 的首回复（lotReplySink 类型）；GetLotState 是唯一只读 query，回执携带状态，
  * carried 的键集合即 oracle 的 carriedOf 面。 */
object LotProtocol {

  sealed trait LotCommand

  final case class ReserveWaferRemoval(txid: String, resource: String, wafers: List[String],
                                       replyTo: ActorRef[LotReply]) extends LotCommand with CborSerializable {
    require(txid != null && txid.nonEmpty, "transaction id required")
    require(resource != null && resource.nonEmpty, "resource required")
    require(wafers != null && wafers.nonEmpty, "wafers required")
  }

  final case class CommitWaferRemoval(txid: String, resource: String,
                                      replyTo: ActorRef[LotReply]) extends LotCommand with CborSerializable {
    require(txid != null && txid.nonEmpty, "transaction id required")
    require(resource != null && resource.nonEmpty, "resource required")
  }

  final case class RestoreWaferRemoval(txid: String, resource: String,
                                       replyTo: ActorRef[LotReply]) extends LotCommand with CborSerializable {
    require(txid != null && txid.nonEmpty, "transaction id required")
    require(resource != null && resource.nonEmpty, "resource required")
  }

  final case class ReserveWaferAddition(txid: String, resource: String, wafers: List[String],
                                        replyTo: ActorRef[LotReply]) extends LotCommand with CborSerializable {
    require(txid != null && txid.nonEmpty, "transaction id required")
    require(resource != null && resource.nonEmpty, "resource required")
    require(wafers != null && wafers.nonEmpty, "wafers required")
  }

  final case class CommitWaferAddition(txid: String, resource: String,
                                       replyTo: ActorRef[LotReply]) extends LotCommand with CborSerializable {
    require(txid != null && txid.nonEmpty, "transaction id required")
    require(resource != null && resource.nonEmpty, "resource required")
  }

  final case class RestoreWaferAddition(txid: String, resource: String,
                                        replyTo: ActorRef[LotReply]) extends LotCommand with CborSerializable {
    require(txid != null && txid.nonEmpty, "transaction id required")
    require(resource != null && resource.nonEmpty, "resource required")
  }

  final case class GetLotState(replyTo: ActorRef[LotState]) extends LotCommand

  final case class OperationError(code: Int, message: String) extends CborSerializable

  final case class LotReply(txid: String, error: Option[OperationError]) extends CborSerializable

  final case class StartTransfer(txid: String, from: String, to: String, wafers: List[String],
                                 manifest: String, replyTo: ActorRef[LotReply]) extends CborSerializable {
    require(txid != null && txid.nonEmpty, "transaction id required")
    require(from != null && from.nonEmpty, "from lot required")
    require(to != null && to.nonEmpty, "to lot required")
    require(wafers != null && wafers.nonEmpty, "wafers required")
    require(manifest != null && manifest.nonEmpty, "manifest required")
  }

  val entityKey: EntityTypeKey[LotCommand] = EntityTypeKey[LotCommand]("lot")

  private def refused(txid: String, replyTo: ActorRef[LotReply],
                      code: Int, message: String): ReplyEffect[LotEvent, LotState] =
    Effect.reply(replyTo)(LotReply(txid, Some(OperationError(code, message))))

  private def confirmed(txid: String, replyTo: ActorRef[LotReply]): ReplyEffect[LotEvent, LotState] =
    Effect.reply(replyTo)(LotReply(txid, None))

  def commandHandler(state: LotState, command: LotCommand): Effect[LotEvent, LotState] =
    if (isRemoval(command)) removalEffect(state, command)
    else if (isAddition(command)) additionEffect(state, command)
    else command match {
      case GetLotState(replyTo) => Effect.reply(replyTo)(state)
      case _ => Effect.none
    }

  private def isRemoval(command: LotCommand): Boolean = command match {
    case _: ReserveWaferRemoval | _: CommitWaferRemoval | _: RestoreWaferRemoval => true
    case _ => false
  }

  private def isAddition(command: LotCommand): Boolean = command match {
    case _: ReserveWaferAddition | _: CommitWaferAddition | _: RestoreWaferAddition => true
    case _ => false
  }

  private def removalEffect(state: LotState, command: LotCommand): Effect[LotEvent, LotState] =
    command match {
      case ReserveWaferRemoval(txid, _, wafers, replyTo) =>
        reserveRemovalEffect(state, txid, wafers, replyTo)
      case CommitWaferRemoval(txid, _, replyTo) => commitRemovalEffect(state, txid, replyTo)
      case RestoreWaferRemoval(txid, _, replyTo) => restoreRemovalEffect(state, txid, replyTo)
      case _ => Effect.none
    }

  private def additionEffect(state: LotState, command: LotCommand): Effect[LotEvent, LotState] =
    command match {
      case ReserveWaferAddition(txid, _, wafers, replyTo) =>
        reserveAdditionEffect(state, txid, wafers, replyTo)
      case CommitWaferAddition(txid, _, replyTo) => commitAdditionEffect(state, txid, replyTo)
      case RestoreWaferAddition(txid, _, replyTo) => restoreAdditionEffect(state, txid, replyTo)
      case _ => Effect.none
    }

  private def reserveRemovalEffect(state: LotState, txid: String, wafers: List[String],
                                   replyTo: ActorRef[LotReply]): ReplyEffect[LotEvent, LotState] =
    if (invalidRemoval(state, wafers)) refused(txid, replyTo, 6001,
      "removal requires carried wafers")
    else if (state.removalReservations.contains(txid) || state.committedRemovals.contains(txid))
      confirmed(txid, replyTo)
    else Effect.persist(WaferRemovalReserved(txid, wafers)).thenReply(replyTo)(_ =>
      LotReply(txid, None))

  private def invalidRemoval(state: LotState, wafers: List[String]): Boolean =
    wafers == null || wafers.isEmpty || !wafers.forall(state.carried.contains)

  private def commitRemovalEffect(state: LotState, txid: String,
                                  replyTo: ActorRef[LotReply]): ReplyEffect[LotEvent, LotState] =
    state.removalReservations.get(txid) match {
      case Some(wafers) =>
        Effect.persist(WaferRemovalCommitted(txid, wafers)).thenReply(replyTo)(_ =>
          LotReply(txid, None))
      case None => refused(txid, replyTo, 6003, "no removal reservation for this transaction")
    }

  private def restoreRemovalEffect(state: LotState, txid: String,
                                   replyTo: ActorRef[LotReply]): ReplyEffect[LotEvent, LotState] =
    state.removalReservations.get(txid) match {
      case Some(wafers) =>
        Effect.persist(WaferRemovalRestored(txid, wafers)).thenReply(replyTo)(_ =>
          LotReply(txid, None))
      case None => refused(txid, replyTo, 6003, "no removal reservation for this transaction")
    }

  private def reserveAdditionEffect(state: LotState, txid: String, wafers: List[String],
                                    replyTo: ActorRef[LotReply]): ReplyEffect[LotEvent, LotState] =
    if (invalidAddition(state, wafers)) refused(txid, replyTo, 6002,
      "addition refuses already carried wafers")
    else if (state.additionReservations.contains(txid) || state.committedAdditions.contains(txid))
      confirmed(txid, replyTo)
    else Effect.persist(WaferAdditionReserved(txid, wafers)).thenReply(replyTo)(_ =>
      LotReply(txid, None))

  private def invalidAddition(state: LotState, wafers: List[String]): Boolean =
    wafers == null || wafers.isEmpty || wafers.exists(state.carried.contains)

  private def commitAdditionEffect(state: LotState, txid: String,
                                   replyTo: ActorRef[LotReply]): ReplyEffect[LotEvent, LotState] =
    state.additionReservations.get(txid) match {
      case Some(wafers) =>
        Effect.persist(WaferAdditionCommitted(txid, wafers)).thenReply(replyTo)(_ =>
          LotReply(txid, None))
      case None => refused(txid, replyTo, 6004, "no addition reservation for this transaction")
    }

  private def restoreAdditionEffect(state: LotState, txid: String,
                                    replyTo: ActorRef[LotReply]): ReplyEffect[LotEvent, LotState] =
    state.additionReservations.get(txid) match {
      case Some(wafers) =>
        Effect.persist(WaferAdditionRestored(txid, wafers)).thenReply(replyTo)(_ =>
          LotReply(txid, None))
      case None => refused(txid, replyTo, 6004, "no addition reservation for this transaction")
    }

  def behavior(entityId: String): Behavior[LotCommand] =
    EventSourcedBehavior[LotCommand, LotEvent, LotState](
      persistenceId = PersistenceId(entityKey.name, entityId),
      emptyState = LotEntity.empty(entityId),
      commandHandler = commandHandler,
      eventHandler = LotEntity.applyEvent)
}
