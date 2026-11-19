package example.stockreservation.application.aggregates

import akka.actor.typed.ActorRef
import net.imadz.common.CommonTypes.Id

import example.stockreservation.domain.entities.StockState

/** 库存聚合协议（S1 状态查询面；与预订面同构独立命名空间）。 */
sealed trait StockCommand

final case class GetStockState(idCid: Id, replyTo: ActorRef[GetStockStateReply])
  extends StockCommand

final case class GetStockStateReply(state: StockState)
