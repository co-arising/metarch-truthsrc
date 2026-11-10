package example.inventory.extensions

import example.inventory.domain.ports.WarehouseComputations
import example.inventory.domain.values._
import java.nio.charset.StandardCharsets.UTF_8
import java.nio.ByteBuffer
import java.security.MessageDigest

final class ReservationIdentity extends WarehouseComputations {
  override def reservationIdentity(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long): ReservationId = {
    val digest = MessageDigest.getInstance("SHA-256")
    Vector(txid.value, warehouseId.value, skuId.value, quantity.toString).foreach { value =>
      val bytes = value.getBytes(UTF_8)
      digest.update(ByteBuffer.allocate(4).putInt(bytes.length).array())
      digest.update(bytes)
    }
    ReservationId(digest.digest().map(b => f"${b & 255}%02x").mkString)
  }
}
