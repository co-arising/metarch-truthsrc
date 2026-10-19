package generated.readmodel

import scala.math.BigDecimal

/** Read model: DiscoverContextDecisionView — served by undefined */
final case class ReadModelDiscoverContext(contextId: String, name: String, description: String, subdomainIds: String, discoveredAt: String)

object ReadModelDiscoverContextView {
  def empty: ReadModelDiscoverContext = ReadModelDiscoverContext("", "", "", "", "")
  // TODO(intent): projection logic from 
}
