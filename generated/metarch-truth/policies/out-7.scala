package generated.policy

// Policy: 立项后创建目录版本
// Triggers: ProjectInitiated
// Invokes: CreateCatalogVersion

object 立项后创建目录版本Policy {
  /** 项目启动后自动创建目录版本 v1.0.0（catalogId 与 Project 一对一） */
  def decide(event: Any): Seq[Any] = event match {

    case _ => Seq.empty
  }
}
