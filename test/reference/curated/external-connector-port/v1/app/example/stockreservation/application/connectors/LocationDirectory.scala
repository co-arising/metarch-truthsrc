package example.stockreservation.application.connectors

import example.stockreservation.domain.values.{LocationId, WarehouseId}
import scala.util.{Failure, Success, Try}

/** Typed snapshot of the external warehouse location directory. Locations are kept
  * verbatim in declared order, including repeated entries; no dedup, no reordering. */
final case class LocationDirectory(warehouseId: WarehouseId, locations: Vector[LocationId])

object LocationDirectory {

  private val directoryVerb = "DIRECTORY"
  private val fieldSeparator = "\\|"
  private val locationSeparator = ","
  private val verbArity = 3

  /** Decodes one directory payload line: `DIRECTORY|<warehouseId>|<loc1>,<loc2,...>`.
    * An empty location tail decodes to the empty vector; any other malformed shape fails. */
  def decode(raw: String): Try[LocationDirectory] = parse(raw) match {
    case Right(directory) => Success(directory)
    case Left(violation) => Failure(violation)
  }

  private def parse(raw: String): Either[ProtocolViolation, LocationDirectory] =
    if (raw.contains('\n') || raw.contains('\r')) Left(ProtocolViolation("payload is not a single line"))
    else {
      val fields = raw.split(fieldSeparator, -1).toVector
      if (fields.length != verbArity || fields.head != directoryVerb)
        Left(ProtocolViolation("unknown directory payload: " + raw))
      else warehouse(fields(1)).flatMap { warehouseId =>
        typedLocations(fields(2)).map(locations => LocationDirectory(warehouseId, locations))
      }
    }

  private def warehouse(text: String): Either[ProtocolViolation, WarehouseId] =
    Try(WarehouseId.apply(text)).fold(
      problem => Left(ProtocolViolation("warehouse rejected: " + problem.getMessage)),
      typed => Right(typed))

  private def typedLocations(text: String): Either[ProtocolViolation, Vector[LocationId]] =
    if (text.isEmpty) Right(Vector.empty)
    else sequence(text.split(locationSeparator, -1).toVector.map(typedLocation))

  private def typedLocation(text: String): Either[ProtocolViolation, LocationId] =
    Try(LocationId.apply(text)).fold(
      problem => Left(ProtocolViolation("location rejected: " + problem.getMessage)),
      typed => Right(typed))

  private def sequence(decoded: Vector[Either[ProtocolViolation, LocationId]])
    : Either[ProtocolViolation, Vector[LocationId]] =
    decoded.foldRight[Either[ProtocolViolation, Vector[LocationId]]](Right(Vector.empty)) { (item, tail) =>
      item.flatMap(head => tail.map(head +: _))
    }
}
