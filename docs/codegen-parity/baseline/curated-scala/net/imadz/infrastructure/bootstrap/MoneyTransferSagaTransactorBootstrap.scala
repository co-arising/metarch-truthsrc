package net.imadz.infrastructure.bootstrap

import akka.actor.typed.Scheduler
import net.imadz.application.services.transactor.MoneyTransferSagaDefinition

import scala.concurrent.ExecutionContext

/** saga_v3: registers the money-transfer saga definition on this node —
  * must run before sharding recovers any entity. */
trait MoneyTransferSagaTransactorBootstrap {

  def initMoneyTransferSagaTransactor(implicit ec: ExecutionContext, scheduler: Scheduler): Unit = {
    MoneyTransferSagaDefinition.register
    ()
  }
}
