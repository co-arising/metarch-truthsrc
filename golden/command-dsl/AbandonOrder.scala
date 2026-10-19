package goldens.commanddsl

import net.imadz.common.CborSerializable

/** Route a failed item to abandon. */
final case class AbandonOrder(chain: String, customerId: String) extends CborSerializable
