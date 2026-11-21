package example.stockreservation.infrastructure.bootstrap

import akka.actor.typed.ActorSystem
import akka.stream.{Materializer, SystemMaterializer}
import example.stockreservation.application.services.transactor.CompositionChildJournal
import example.stockreservation.infrastructure.persistence.MongoCompositionChildJournal

/** 装配点（D1）：production 组合的唯一绑定面——子计划观察端口接 Mongo 适配器。
  * 宿主工厂以端口为参数（F3，application 不得反向 import infrastructure）；
  * 生产装配与测试装配各自调用本对象获得绑定实现。 */
object CompositionBootstrap {

  def childJournal(system: ActorSystem[_]): CompositionChildJournal = {
    implicit val materializer: Materializer = SystemMaterializer(system).materializer
    new MongoCompositionChildJournal(system)
  }
}
