package example.stockreservation.application.services.transactor

import com.google.protobuf.ByteString
import net.imadz.infra.saga.strict.{CodecPin, PayloadCodec}
import scala.util.{Failure, Try}

import StrictWire._

/** Canonical args codec face declared by the module contract:
  * example.stockreservation.saga.codec.StockTransferArgsCodec, 1.0.0, runtime
  * pin stock-transfer-args/1. Field order is the module Args order:
  * source-warehouse-id, target-warehouse-id, sku, quantity, transfer-mode
  * (F7 ruling: UUID and Int ride the text wire via toString/fromString and
  * toString/toInt — the #40 probe framing precedent; conversions throw inside
  * Try and fail closed). Trailing bytes after the declared fields are rejected
  * with the raw wire message verbatim. */
final class StockTransferArgsCodec extends PayloadCodec[StockTransferSagaModule.Args] {

  override val pin: CodecPin = CodecPin("stock-transfer-args", 1)

  override def encode(value: StockTransferSagaModule.Args): ByteString =
    StrictWire.lengthPrefixed(value.sourceWarehouseId.toString) ++
      StrictWire.lengthPrefixed(value.targetWarehouseId.toString) ++
      StrictWire.lengthPrefixed(value.sku) ++
      StrictWire.lengthPrefixed(value.quantity.toString) ++
      StrictWire.lengthPrefixed(value.transferMode)

  override def decode(bytes: ByteString): Try[StockTransferSagaModule.Args] =
    StrictWire.readPrefixed(bytes, 5).flatMap {
      case (Vector(sourceId, targetId, skuText, quantityText, modeText), rest) =>
        if (rest.isEmpty)
          Try(StockTransferSagaModule.Args(java.util.UUID.fromString(sourceId),
            java.util.UUID.fromString(targetId), skuText, quantityText.toInt, modeText))
        else Failure(new IllegalArgumentException(
            "what wire: trailing bytes after the declared fields"))
      case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))
    }
}
