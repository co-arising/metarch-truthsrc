package generated.readmodel

import scala.math.BigDecimal

/** Read model: DefineContextRelationDecisionView — served by  */
final case class ReadModelDefineContextRelation(relationId: String, upstreamContextId: String, downstreamContextId: String, kind: String, integration: String, description: String, createdAt: String, createdBy: String, tenantId: String)

object ReadModelDefineContextRelationView {
  def empty: ReadModelDefineContextRelation = ReadModelDefineContextRelation("", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
