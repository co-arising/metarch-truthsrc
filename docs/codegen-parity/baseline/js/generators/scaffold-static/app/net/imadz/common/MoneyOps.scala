package net.imadz.common

/** Minor-unit-string arithmetic for generated money value objects.
  *
  * The strict admission money base is the minor-unit-string shape
  * (minorUnits: String, currency: String); there is no BigDecimal money type in
  * generated aggregates. These ops are pure exact-integer arithmetic on the
  * minor-unit strings — no currency conversion, no rounding, no defaulting.
  * Generated guard/fold code composes them with the module's own Money
  * constructor and field accessors.
  */
object MoneyOps {

  /** Exact sign test on minor units. Throws on a non-numeric string — a money
    * value that fails to parse is a corruption, not a business answer. */
  def isPositive(minorUnits: String): Boolean = BigInt(minorUnits) > 0

  /** Exact three-way comparison of two minor-unit amounts. */
  def compare(a: String, b: String): Int = BigInt(a) compare BigInt(b)

  /** a + sign * b in exact minor units (sign is +1 or -1). */
  def shift(a: String, b: String, sign: Int): String = (BigInt(a) + BigInt(b) * sign).toString
}
