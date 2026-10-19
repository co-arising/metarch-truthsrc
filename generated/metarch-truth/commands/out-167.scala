package generated.command

import net.imadz.common.CborSerializable

/** 退役一条边（记录原因，不物理删除） */
final case class RetireEdge(edgeId: String, reason: String, tenantId: String, triggeredBy: String) extends CborSerializable
