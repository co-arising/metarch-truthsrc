package example.stockreservation.infrastructure.persistence

import akka.actor.typed.ActorSystem
import akka.contrib.persistence.mongodb.{MongoReadJournal, ScalaDslMongoReadJournal}
import akka.persistence.query.PersistenceQuery
import akka.stream.{KillSwitches, Materializer, UniqueKillSwitch}
import akka.stream.scaladsl.{Keep, Sink}
import example.stockreservation.application.services.transactor.{ChildJournalSignal,
  CompositionChildJournal}
import net.imadz.monarch.persistence.PersistentMonarch

/** Mongo 观察适配器（D1 拆分）：raw watchChild 的 journal 细节原样落地——live
  * eventsByPersistenceId 从 offset 0（历史重放进同一决策）、KillSwitch 归宿主、
  * 事件映射逐项一致。门环境无 mongod（实证）：本适配器编译面覆盖；行为门经
  * CompositionChildJournal 端口走测试树的 testkit 适配器（F8 裁定）。插件 id
  * 用 MongoReadJournal.Identifier 常量（3.0.8 的 companion 无 Identifier 的
  * 位置在 ScalaDslMongoReadJournal，#41 探针同款）。 */
final class MongoCompositionChildJournal(system: ActorSystem[_])(implicit mat: Materializer)
  extends CompositionChildJournal {

  def watch(pid: String)(observer: ChildJournalSignal => Unit): UniqueKillSwitch = {
    val readJournal = PersistenceQuery(system)
      .readJournalFor[ScalaDslMongoReadJournal](MongoReadJournal.Identifier)
    readJournal.eventsByPersistenceId(pid, 0L, Long.MaxValue)
      .viaMat(KillSwitches.single)(Keep.right)
      .toMat(Sink.foreach { envelope =>
        envelope.event match {
          case _: PersistentMonarch.RunCompleted => observer(ChildJournalSignal.RunFinished)
          case failed: PersistentMonarch.RunFailedEvt =>
            observer(ChildJournalSignal.RunFailed(failed.reason))
          case stage: PersistentMonarch.StageDone =>
            observer(ChildJournalSignal.StageReached(stage.cursor))
          case _ => ()
        }
      })(Keep.left)
      .run()
  }
}
