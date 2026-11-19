package example.stockreservation.application.aggregates

import akka.actor.typed.ActorRef
import net.imadz.common.CommonTypes.Id

import example.stockreservation.domain.entities.ReservationState

/** 预订聚合协议（S1 状态查询面）：命令携带解析后 Id 与 replyTo（BC 合同双参形状，
  * 参数序＝(解析Id, replyTo)，raw 位置实参序保真）。reply 必须有 state 成员。 */
sealed trait ReservationCommand

final case class GetReservationState(idCid: Id, replyTo: ActorRef[GetReservationStateReply])
  extends ReservationCommand

/** GetReservationState 回执：state 字段平铺的序列化源（controller 层 OWrites 消费 .state）。 */
final case class GetReservationStateReply(state: ReservationState)
