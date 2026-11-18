package example.stockreservation.domain.values

private[values] object ValueChecks {
  private val identifierCharacters: Set[Char] =
    (('a' to 'z') ++ ('A' to 'Z') ++ ('0' to '9') ++ Vector('.', '_', '-')).toSet

  private def bounded(value: String, maximum: Int): Boolean =
    value != null && value.nonEmpty && value.length <= maximum

  def identifier(value: String): Boolean =
    bounded(value, 64) && value.forall(identifierCharacters.contains)

  private def printableAscii(character: Char): Boolean = character >= ' ' && character <= '~'

  def reservation(value: String): Boolean =
    bounded(value, 384) && value.forall(printableAscii)
}

final case class WarehouseId(value: String) {
  require(ValueChecks.identifier(value), "WarehouseId must be a nonempty bounded ASCII identifier")
}

final case class RequestId(value: String) {
  require(ValueChecks.identifier(value), "RequestId must be a nonempty bounded ASCII identifier")
}

final case class SkuId(value: String) {
  require(ValueChecks.identifier(value), "SkuId must be a nonempty bounded ASCII identifier")
}

final case class LocationId(value: String) {
  require(ValueChecks.identifier(value), "LocationId must be a nonempty bounded ASCII identifier")
}

final case class ReservationId(value: String) {
  require(ValueChecks.reservation(value), "ReservationId must be nonempty bounded printable ASCII")
}

final case class ReservationNote(value: String) {
  require(value != null && value.length <= 256, "ReservationNote must be a bounded non-null string")
}
