package generated.readmodel

import scala.math.BigDecimal

/** Read model: DiscoverContextDecisionView — served by  */
final case class ReadModelDiscoverContext(contextId: String, name: String, description: String, subdomainIds: String, discoveredAt: String, discoveredBy: String, tenantId: String)

object ReadModelDiscoverContextView {
  def empty: ReadModelDiscoverContext = ReadModelDiscoverContext("", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
