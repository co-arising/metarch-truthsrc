package generated.readmodel

import scala.math.BigDecimal

/** Read model: ClassifySubdomainDecisionView — served by undefined */
final case class ReadModelClassifySubdomain(subdomainId: String, name: String, description: String, kind: String, buyOrBuild: String)

object ReadModelClassifySubdomainView {
  def empty: ReadModelClassifySubdomain = ReadModelClassifySubdomain("", "", "", "", "")
  // TODO(intent): projection logic from 
}
