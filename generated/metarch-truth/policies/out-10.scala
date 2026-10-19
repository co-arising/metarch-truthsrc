package generated.policy

// Policy: 补丁合并后应用到目录
// Triggers: 
// Invokes: 

object 补丁合并后应用到目录Policy {
  /** KnowledgePatchMerged 发生后触发 ApplyKnowledgePatch——补丁合并进链（MERGED）后自动应用到目录（headPatchId 前移 + FF/祖先冲突判定），补上「MERGE 完就停」的缺环 */
  def decide(event: Any): Seq[Any] = event match {

    case _ => Seq.empty
  }
}
