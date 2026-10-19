package generated.policy

// Policy: 租户入驻后TenantOwner可创建工作组
// Triggers: 
// Invokes: 

object 租户入驻后TenantOwner可创建工作组Policy {
  /** 租户入驻完成后，TenantOwner 可创建工作组（接力：组织入驻 → 专项立项） */
  def decide(event: Any): Seq[Any] = event match {

    case _ => Seq.empty
  }
}
