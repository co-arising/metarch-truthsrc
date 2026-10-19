package generated.policy

// Policy: 补丁合并后回锚落点
// Triggers: KnowledgePatchMergeCommitted
// Invokes: RecordConceptLandings

object 补丁合并后回锚落点Policy {
  /** 补丁合并（KnowledgePatchMergeCommitted）→ 逐条把**带回锚知识**的更新增量回锚到 Concept 聚合（扇出 list<ConceptDelta>·只取 action=update 且 anchors/guards/规则引用/字段任一非空）。与创建腿「概念增量后确立概念」分职：那条走 insert（建概念·此刻还没有代码），本条走 update（回锚·代码已生成）。锚/守卫/规则引用/字段都是生成期发现的（锚＝知识图与代码图的桥梁知识·守卫＝命令前置不变式知识——挂账A 2026-09-29 并入回锚语义·规则引用＝三槽不变式引用——4c 并入·字段＝Field 图节点知识——服务图完整性批 2026-09-29 并入），HTTP 调用方手上没有它们，故只能由本策略搬运。 */
  def decide(event: Any): Seq[Any] = event match {

    case _ => Seq.empty
  }
}
