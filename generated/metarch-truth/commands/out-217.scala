package generated.command

import net.imadz.common.CborSerializable

/** 在两个概念之间创建关系边 */
final case class RelateConcept(edgeId: String, sourceId: String, targetId: String, relationType: String, condition: String, mapping: String, order: String, metadata: String, triggeredBy: String, tenantId: String) extends CborSerializable
