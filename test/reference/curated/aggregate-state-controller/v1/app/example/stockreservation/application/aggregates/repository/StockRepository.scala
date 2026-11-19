package example.stockreservation.application.aggregates.repository

import akka.cluster.sharding.typed.scaladsl.EntityRef

import example.stockreservation.application.aggregates.StockCommand

/** 库存聚合仓储端口（BC 合同；与预订端口同构独立）。 */
trait StockRepository {
  def entityRef(id: String): EntityRef[StockCommand]
}
