package example.stockreservation.application.services.transactor

import akka.stream.UniqueKillSwitch

/** 应用观察端口（D1 拆分的产物）：子计划 journal 的唯一权威终态观察面。
  * raw 的 watchChild 把 Mongo read journal、KillSwitch 管理与事件映射混在
  * application 宿主里；本端口把"观察"提升为应用合同——宿主只依赖信号语义
  * （RunFinished/RunFailed/StageReached），具体 journal 归适配器：
  * production = MongoCompositionChildJournal（infrastructure/persistence），
  * 测试 = persistence-testkit read journal 适配器（测试树）。KillSwitch
  * 所有权归调用者；watch 同一 pid 的重复调用由宿主侧去重（childWatch 槽）。
  * 信号与 raw watchChild 的事件映射逐项一致：RunCompleted→RunFinished、
  * RunFailedEvt(reason)→RunFailed、StageDone(cursor)→StageReached。 */
sealed trait ChildJournalSignal

object ChildJournalSignal {
  case object RunFinished extends ChildJournalSignal
  final case class RunFailed(reason: String) extends ChildJournalSignal
  final case class StageReached(cursor: String) extends ChildJournalSignal
}

trait CompositionChildJournal {
  def watch(pid: String)(observer: ChildJournalSignal => Unit): UniqueKillSwitch
}
