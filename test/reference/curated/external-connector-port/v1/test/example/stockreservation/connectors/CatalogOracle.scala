package example.stockreservation.connectors

import scala.util.Try

import example.stockreservation.application.connectors.{AvailabilityOutcome, LocationDirectory, ProtocolViolation}
import example.stockreservation.domain.values.{LocationId, SkuId, WarehouseId}

/** Independent expected outcomes for the closed payload dispatch. Expectations are
  * stated as data, never derived from the production decoders. */
object CatalogOracle {

  sealed trait ExpectedProbe
  final case class ExpectAnswer(sku: SkuId, available: Long) extends ExpectedProbe
  final case class ExpectRefusal(code: String, message: String) extends ExpectedProbe
  final case object ExpectProtocolViolation extends ExpectedProbe

  sealed trait ExpectedDirectory
  final case class ExpectDirectory(warehouse: WarehouseId, locations: Vector[LocationId]) extends ExpectedDirectory
  final case object ExpectDirectoryProtocolViolation extends ExpectedDirectory

  def expectedProbe(shape: CatalogCases.ProbeShape): ExpectedProbe = shape match {
    case CatalogCases.AnswerLine(skuText, available) =>
      Try(SkuId(skuText)).fold(
        _ => ExpectProtocolViolation,
        sku => if (available < 0L) ExpectProtocolViolation else ExpectAnswer(sku, available))
    case CatalogCases.RefusalLine(code, message) =>
      if (code.isEmpty || message.isEmpty) ExpectProtocolViolation else ExpectRefusal(code, message)
    case CatalogCases.RawLine(_) => ExpectProtocolViolation
  }

  def expectedDirectory(shape: CatalogCases.DirectoryShape): ExpectedDirectory = shape match {
    case CatalogCases.DirectoryLine(warehouseText, locationTexts) =>
      val warehouse = Try(WarehouseId(warehouseText))
      val locations = locationTexts.map(text => Try(LocationId(text)))
      if (warehouse.isSuccess && locations.forall(_.isSuccess))
        ExpectDirectory(warehouse.get, locations.map(_.get))
      else ExpectDirectoryProtocolViolation
    case CatalogCases.RawDirectoryLine(_) => ExpectDirectoryProtocolViolation
  }

  def probeMatches(actual: Try[AvailabilityOutcome], expected: ExpectedProbe): Boolean = (actual, expected) match {
    case (scala.util.Success(AvailabilityOutcome.Answer(sku, available)), ExpectAnswer(wantSku, wantAvailable)) =>
      sku == wantSku && available == wantAvailable
    case (scala.util.Success(AvailabilityOutcome.Refused(code, message)), ExpectRefusal(wantCode, wantMessage)) =>
      code == wantCode && message == wantMessage
    case (scala.util.Failure(violation: ProtocolViolation), ExpectProtocolViolation) =>
      violation.evidence.nonEmpty
    case _ => false
  }

  def directoryMatches(actual: Try[LocationDirectory], expected: ExpectedDirectory): Boolean =
    (actual, expected) match {
      case (scala.util.Success(LocationDirectory(warehouse, locations)), ExpectDirectory(wantWarehouse, wantLocations)) =>
        warehouse == wantWarehouse && locations == wantLocations
      case (scala.util.Failure(violation: ProtocolViolation), ExpectDirectoryProtocolViolation) =>
        violation.evidence.nonEmpty
      case _ => false
    }
}
