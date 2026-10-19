package generated.readmodel

import scala.math.BigDecimal

/** Read model: ClassifySubdomainDecisionView — served by  */
final case class ReadModelClassifySubdomain(subdomainId: String, name: String, description: String, kind: String, buyOrBuild: String, aggregateIds: String, classifiedAt: String, classifiedBy: String, tenantId: String)

object ReadModelClassifySubdomainView {
  def empty: ReadModelClassifySubdomain = ReadModelClassifySubdomain("", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
