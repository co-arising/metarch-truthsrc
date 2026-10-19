package goldens.eventdsl

import net.imadz.common.CborSerializable

/** A successfully classified recharge item settled. */
final case class OrderCredited(chain: String, customerId: String, amount: BigDecimal) extends CborSerializable
