package example.inventory.infrastructure.web

import example.inventory.application.api.WarehouseApi._
import example.inventory.domain.WarehouseProtocol._
import example.inventory.domain.values._
import java.nio.charset.{CodingErrorAction, StandardCharsets}
import java.nio.ByteBuffer
import java.util.Base64
import play.api.libs.json._
import scala.util.control.NonFatal

object WarehouseHttpCodec {
  private def scalar(value: String, max: Int = 256): Boolean = try {
    value != null && value.nonEmpty && !value.exists(Character.isISOControl) &&
      StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT)
        .encode(java.nio.CharBuffer.wrap(value)).remaining() <= max
  } catch { case _: java.nio.charset.CharacterCodingException => false }
  def warehouse(value: String): Outcome[WarehouseId] = if (scalar(value)) Right(WarehouseId(value)) else Left(InvalidRequest)
  def decodeBody(text: String): Outcome[JsObject] = try {
    val factory = new com.fasterxml.jackson.core.JsonFactory()
    factory.enable(com.fasterxml.jackson.core.JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
    val parser = factory.createParser(text)
    try {
      var roots = 0
      var depth = 0
      var token = parser.nextToken()
      while (token != null) {
        if (depth == 0) roots += 1
        if (token.isStructStart) depth += 1
        if (token.isStructEnd) depth -= 1
        require(roots == 1 && depth >= 0 && depth <= 64)
        token = parser.nextToken()
      }
      require(roots == 1 && depth == 0)
    } finally parser.close()
    Json.parse(text) match { case obj: JsObject => Right(obj); case _ => Left(InvalidRequest) }
  } catch { case NonFatal(_) => Left(InvalidRequest) }
  private def string(o: JsObject, key: String): String = {
    val value = (o \ key).as[String]
    require(scalar(value))
    value
  }
  private def guarded[A](body: => A): Outcome[A] = try Right(body) catch { case NonFatal(_) => Left(InvalidRequest) }
  def reserve(id: WarehouseId, obj: JsObject): Outcome[ReserveRequest] = guarded {
    require(obj.keys == Set("txid", "skuId", "quantity"))
    val quantity = (obj \ "quantity").as[String]
    require(quantity.matches("(?:0|-[1-9][0-9]*|[1-9][0-9]*)") && quantity.length <= 20)
    ReserveRequest(TxId(string(obj, "txid")), id, SkuId(string(obj, "skuId")), quantity.toLong)
  }
  def commit(id: WarehouseId, obj: JsObject): Outcome[CommitRequest] = guarded {
    require(obj.keys == Set("txid", "skuId", "reservationId"))
    CommitRequest(TxId(string(obj, "txid")), id, SkuId(string(obj, "skuId")), ReservationId(string(obj, "reservationId")))
  }
  def reserveResult(result: CommandResult[SkuQuantityReserved]): JsValue = result match {
    case NoChange => Json.obj("status" -> "no-change")
    case Applied(event) =>
      require(scalar(event.reservationId.value), "event output outside wire contract")
      Json.obj("status" -> "applied", "reservationId" -> event.reservationId.value)
  }
  def commitResult(result: CommandResult[SkuReservationCommitted]): JsValue = result match {
    case NoChange => Json.obj("status" -> "no-change")
    case Applied(event) =>
      require(scalar(event.txid.value), "event output outside wire contract")
      Json.obj("status" -> "applied", "txid" -> event.txid.value)
  }
  def cursor(resource: String, value: ReceiptPosition): String = Base64.getUrlEncoder.withoutPadding().encodeToString(
    Json.stringify(Json.obj("version" -> 1, "resource" -> resource, "mapKey" -> value.mapKey, "pidKey" -> value.pidKey)).getBytes(StandardCharsets.UTF_8))
  def query(resource: String, values: Map[String, Seq[String]]): Outcome[(Option[ReceiptPosition], Int)] = guarded {
    require(values.keySet.subsetOf(Set("after", "limit")) && values.values.forall(v => v.size == 1))
    val limit = values.get("limit").map(_.head).map { text => require(text.matches("[1-9][0-9]?")); text.toInt }.getOrElse(20)
    require(limit >= 1 && limit <= 64)
    val after = values.get("after").map(_.head).map { text =>
      require(text.nonEmpty && text.length <= 2048 && text.matches("[A-Za-z0-9_-]+"))
      val bytes = Base64.getUrlDecoder.decode(text)
      val decoded = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString
      val obj = decodeBody(decoded).fold(_ => throw new IllegalArgumentException("cursor"), identity)
      require(obj.keys == Set("version", "resource", "mapKey", "pidKey") && (obj \ "version").as[Int] == 1 && (obj \ "resource").as[String] == resource)
      val position = ReceiptPosition(string(obj, "mapKey"), (obj \ "pidKey").as[String])
      require(position.pidKey.matches("[0-9a-f]{64}") && cursor(resource, position) == text)
      position
    }
    (after, limit)
  }
  def page(resource: String, result: ReceiptPage): JsValue = Json.obj(
    "rows" -> JsArray(result.rows.map(row => Json.obj("txid" -> row.txid.value, "receipt" -> row.receipt))),
    "next" -> result.next.map(cursor(resource, _)))
  def status(error: Failure): Int = error match {
    case InvalidRequest => 400
    case NotAuthenticated => 401
    case NotAuthorized | CsrfDenied => 403
    case MissingResource => 404
    case _: DomainRejected => 422
    case Unavailable => 503
    case OutcomeUnknown => 504
    case InternalFailure => 500
  }
}
