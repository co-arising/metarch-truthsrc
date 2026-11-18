package example.stockreservation.domain.values

private[values] object ValueChecks {
  def identifier(value: String): Boolean =
    value != null && value.nonEmpty && value.length <= 64 &&
      value.forall(c => c.isLetterOrDigit && c <= 127 || c == '.' || c == '_' || c == '-')

  def reservation(value: String): Boolean =
    value != null && value.nonEmpty && value.length <= 384 && value.forall(c => c >= ' ' && c <= '~')
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
