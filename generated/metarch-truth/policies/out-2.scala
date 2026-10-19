package generated.policy

// Policy: 注册选择新建租户后自动入驻
// Triggers: UserRegistered
// Invokes: OnboardTenant

object 注册选择新建租户后自动入驻Policy {
  /** 注册时选择新建租户（authMethod 含建租选项）则触发 OnboardTenant，注册者自动成为租户 Owner（S2-49 A4：叙事链确权为 policy 便签） */
  def decide(event: Any): Seq[Any] = event match {

    case _ => Seq.empty
  }
}
