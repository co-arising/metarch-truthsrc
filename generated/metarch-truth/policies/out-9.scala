package generated.policy

// Policy: 概念确立后检测冲突
// Triggers: ConceptEstablished
// Invokes: DetectConceptConflict

object 概念确立后检测冲突Policy {
  /** whenever ConceptEstablished then DetectConceptConflict（S203 E→E 直连正解·冲突检测为系统自动语义） */
  def decide(event: Any): Seq[Any] = event match {

    case _ => Seq.empty
  }
}
