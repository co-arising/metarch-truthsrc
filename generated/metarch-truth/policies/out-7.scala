package generated.policy

// Policy: 成员加入后维护租户名册
// Triggers: 
// Invokes: 

object 成员加入后维护租户名册Policy {
  /** whenever TenantMemberJoined then UpdateTenantMemberRoster（S2-32 名册双写联动兑现·⑤层 AcceptTenantInvitation.update-roster 声明） */
  def decide(event: Any): Seq[Any] = event match {

    case _ => Seq.empty
  }
}
