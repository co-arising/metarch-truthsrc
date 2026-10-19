package generated.policy

// Policy: 概念增量后确立概念
// Triggers: KnowledgePatched
// Invokes: EstablishConcept

object 概念增量后确立概念Policy {
  /** 目录应用补丁（KnowledgePatched）→ 逐条把「新建」增量转发为 Concept 聚合的 EstablishConcept（扇出 list<ConceptDelta>·只取 action=insert）。概念是独立聚合，「聚合只发自己事件」铁律下 catalog 发不出 EstablishConcept——本策略补上写侧最后一跳。 */
  def decide(event: Any): Seq[Any] = event match {

    case _ => Seq.empty
  }
}
