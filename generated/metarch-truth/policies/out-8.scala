package generated.policy

// Policy: 知识就绪后完成会话
// Triggers: KnowledgePatchReadyToMerged
// Invokes: CompleteSession

object 知识就绪后完成会话Policy {
  /** 知识补丁确认就绪（ReadyToMerged）→ 自动完成全部来源 Session（fanOut sessionIds·知识沉淀闭环） */
  def decide(event: Any): Seq[Any] = event match {

    case _ => Seq.empty
  }
}
