package generated.policy

// Policy: 目录应用后确认补丁合并
// Triggers: KnowledgePatched
// Invokes: ConfirmPatchMerged

object 目录应用后确认补丁合并Policy {
  /** 目录应用成功后回执补丁合并（Option A 两阶段·catalog 是权威） */
  def decide(event: Any): Seq[Any] = event match {

    case _ => Seq.empty
  }
}
