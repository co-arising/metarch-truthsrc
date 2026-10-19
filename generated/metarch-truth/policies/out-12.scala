package generated.policy

// Policy: DoR通过后请求合并知识
// Triggers: DoRPassed
// Invokes: RequestKnowledgeMerge

object DoR通过后请求合并知识Policy {
  /** DoR 门通过（DoRPassed）→ 创建合并请求（MR 门·知识管理员审阅合入·占位→正式两段式） */
  def decide(event: Any): Seq[Any] = event match {

    case _ => Seq.empty
  }
}
