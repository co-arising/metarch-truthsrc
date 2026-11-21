package example.stockreservation.application.services.transactor

import com.google.protobuf.ByteString
import example.stockreservation.application.services.transactor.StockTransferSagaModule
import net.imadz.infra.saga.strict._
import java.util.UUID
import scala.util.Try

/** 测试供给（Support 层）：探针编解码与记录件。canonical 编码＝长度前缀 UTF-8 字段
  * （与 runtime Digests.plan 同族框架），encode/decode 精确互逆；pin 与模块合同逐字
  * 对齐（step2.prepare 收据 pin=2，其余 1）。记录线程安全（协调器自身线程回放，
  * 测试线程在 ask 回复后读取）。 */
final class ValueLog[A] {
  private val entries = new java.util.concurrent.ConcurrentLinkedQueue[A]()
  def record(value: A): Unit = { entries.add(value); () }
  def recorded: Vector[A] = {
    val builder = Vector.newBuilder[A]
    val iterator = entries.iterator
    while (iterator.hasNext) builder += iterator.next()
    builder.result()
  }
  def size: Int = entries.size
}

object ProbeFrames {
  def framed(parts: Vector[String]): ByteString = {
    val buffer = new java.io.ByteArrayOutputStream()
    val out = new java.io.DataOutputStream(buffer)
    out.writeInt(parts.size)
    parts.foreach { part =>
      val bytes = part.getBytes(java.nio.charset.StandardCharsets.UTF_8)
      out.writeInt(bytes.length)
      out.write(bytes)
    }
    out.flush()
    ByteString.copyFrom(buffer.toByteArray)
  }
  def unframed(bytes: ByteString, count: Int): Vector[String] = {
    val input = new java.io.DataInputStream(new java.io.ByteArrayInputStream(bytes.toByteArray))
    val declared = input.readInt()
    require(declared == count, "probe framing field count mismatch")
    Vector.fill(declared) {
      val length = input.readInt()
      val target = new Array[Byte](length)
      input.readFully(target)
      new String(target, java.nio.charset.StandardCharsets.UTF_8)
    }
  }
}

final class ProbeArgsCodec(val pin: CodecPin) extends PayloadCodec[StockTransferSagaModule.Args] {
  def encode(value: StockTransferSagaModule.Args): ByteString = ProbeFrames.framed(Vector(
    value.sourceWarehouseId.toString, value.targetWarehouseId.toString, value.sku,
    value.quantity.toString, value.transferMode))
  def decode(bytes: ByteString): Try[StockTransferSagaModule.Args] = Try {
    val parts = ProbeFrames.unframed(bytes, 5)
    StockTransferSagaModule.Args(UUID.fromString(parts(0)), UUID.fromString(parts(1)),
      parts(2), parts(3).toInt, parts(4))
  }
}

final class ProbeReceiptCodec[R](val pin: CodecPin, count: Int, build: Vector[String] => R,
    fields: R => Vector[String]) extends PayloadCodec[R] {
  def encode(value: R): ByteString = ProbeFrames.framed(fields(value))
  def decode(bytes: ByteString): Try[R] = Try(ProbeFrames.unframed(bytes, count)).map(build)
}

object ProbeReceipts {
  import StockTransferSagaModule._
  val reserveSourceStockPrepare: PayloadCodec[ReserveSourceStockPrepareReceipt] =
    new ProbeReceiptCodec(CodecPin("stock-transfer-reserve-source-stock-prepare", 1), 2,
      p => ReserveSourceStockPrepareReceipt(UUID.fromString(p(0)), p(1).toInt),
      r => Vector(r.reservationId.toString, r.reservedQuantity.toString))
  val reserveSourceStockCommit: PayloadCodec[ReserveSourceStockCommitReceipt] =
    new ProbeReceiptCodec(CodecPin("stock-transfer-reserve-source-stock-commit", 1), 1,
      p => ReserveSourceStockCommitReceipt(p(0).toInt),
      r => Vector(r.committedQuantity.toString))
  val reserveSourceStockCompensate: PayloadCodec[ReserveSourceStockCompensateReceipt] =
    new ProbeReceiptCodec(CodecPin("stock-transfer-reserve-source-stock-compensate", 1), 1,
      p => ReserveSourceStockCompensateReceipt(p(0).toInt),
      r => Vector(r.releasedQuantity.toString))
  val commitTargetStockPrepare: PayloadCodec[CommitTargetStockPrepareReceipt] =
    new ProbeReceiptCodec(CodecPin("stock-transfer-commit-target-stock-prepare", 2), 2,
      p => CommitTargetStockPrepareReceipt(UUID.fromString(p(0)), p(1).toInt),
      r => Vector(r.orderId.toString, r.confirmedQuantity.toString))
  val commitTargetStockCommit: PayloadCodec[CommitTargetStockCommitReceipt] =
    new ProbeReceiptCodec(CodecPin("stock-transfer-commit-target-stock-commit", 1), 1,
      p => CommitTargetStockCommitReceipt(p(0).toInt),
      r => Vector(r.settledQuantity.toString))
  val commitTargetStockCompensate: PayloadCodec[CommitTargetStockCompensateReceipt] =
    new ProbeReceiptCodec(CodecPin("stock-transfer-commit-target-stock-compensate", 1), 1,
      p => CommitTargetStockCompensateReceipt(p(0).toInt),
      r => Vector(r.cancelledQuantity.toString))
  val reserveSourceStockPrepareAlt: PayloadCodec[ReserveSourceStockPrepareReceipt] =
    new ProbeReceiptCodec(CodecPin("stock-transfer-reserve-source-stock-prepare", 1), 2,
      p => ReserveSourceStockPrepareReceipt(UUID.fromString(p(0)), p(1).toInt),
      r => Vector(r.reservationId.toString, r.reservedQuantity.toString))
}

/** 非规范 codec（pin 正确、decode 后再编码≠原字节）——canonical 往返护栏的负测面。 */
final class NonCanonicalArgsCodec(val pin: CodecPin) extends PayloadCodec[StockTransferSagaModule.Args] {
  private val delegate = new ProbeArgsCodec(pin)
  def encode(value: StockTransferSagaModule.Args): ByteString = delegate.encode(value)
  def decode(bytes: ByteString): Try[StockTransferSagaModule.Args] =
    delegate.decode(bytes).map(value => value.copy(quantity = value.quantity + 1))
}

object ProbeFixtures {
  val reservationOne: UUID = UUID.fromString("00000000-0000-0000-0000-000000000001")
  val orderTwo: UUID = UUID.fromString("00000000-0000-0000-0000-000000000002")
  val warehouseOne: UUID = UUID.fromString("00000000-0000-0000-0000-000000000011")
  val warehouseTwo: UUID = UUID.fromString("00000000-0000-0000-0000-000000000012")
  val defaultQuantity: Int = 25
}
