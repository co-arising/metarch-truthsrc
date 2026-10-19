package goldens.invdsl

/** Invariant rules for OrderState */
object OrderInvariants {
  // Amount must be positive
  def amountPositive(s: OrderState): Either[String, Unit] =
    if (s.amount > 0) Right(()) else Left("AMOUNT_NEGATIVE: Amount must be positive")
}
