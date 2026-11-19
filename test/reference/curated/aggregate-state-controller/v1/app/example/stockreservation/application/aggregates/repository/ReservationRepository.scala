package example.stockreservation.application.aggregates.repository

import akka.cluster.sharding.typed.scaladsl.EntityRef

import example.stockreservation.application.aggregates.ReservationCommand

/** 预订聚合仓储端口（BC 合同）：entityRef(String) 后可 ask；实参保持原始 String id，
  * 不经格式改写。实现在 infrastructure（聚合仓储实现族），本族只消费端口。 */
trait ReservationRepository {
  def entityRef(id: String): EntityRef[ReservationCommand]
}
