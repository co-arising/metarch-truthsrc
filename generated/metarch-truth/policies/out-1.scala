package generated.policy

// Policy: 租户入驻后创建者自动成为Owner
// Triggers: 
// Invokes: 

object 租户入驻后创建者自动成为OwnerPolicy {
  /** 组织入驻完成后，创建租户的用户自动成为该租户 Owner（接力：TenantOnboarded → AssignTenantOwner → TenantOwnerChanged） */
  def decide(event: Any): Seq[Any] = event match {

    case _ => Seq.empty
  }
}
