package example.stockreservation.controllers

import java.time.Instant

import play.api.libs.json.{JsValue, Json}

import net.imadz.common.{CommonTypes, Id}
import example.stockreservation.application.aggregates.{
  GetReservationStateReply,
  GetStockStateReply
}
import example.stockreservation.domain.entities.{ReservationState, StockState}

/** 期望数据（support 层）：状态字面量、期望 JSON（字面解析直陈）、400/401/500 形状。 */
object ControllerOracle {

  val reservationId: CommonTypes.Id = Id.of("3f2a1b0c-9d8e-7f6a-5b4c-3d2e1f0a9b8c")
  val reservationSkuId: CommonTypes.Id = Id.of("1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d")
  val stockId: CommonTypes.Id = Id.of("9f8e7d6c-5b4a-3c2d-1e0f-9a8b7c6d5e4f")
  val stockSkuId: CommonTypes.Id = Id.of("2b3c4d5e-6f7a-4b5c-9d0e-1f2a3b4c5d6e")

  val occurredAt: Instant = Instant.parse("2026-11-20T07:30:00Z")
  val settledAt: Instant = Instant.parse("2026-11-20T09:15:30Z")
  val updatedAt: Instant = Instant.parse("2026-11-20T11:45:12Z")

  /** 未结算状态：settledAt＝null（控制器 s1InstantWrites 的 null-safe 判例）。 */
  val unsettledReservation: ReservationState = ReservationState(
    reservationId, reservationSkuId, 2, true, "pallet", "tenant-7", occurredAt, null)

  val settledReservation: ReservationState = ReservationState(
    reservationId, reservationSkuId, 2, true, "pallet", "tenant-7", occurredAt, settledAt)

  val stockState: StockState = StockState(stockId, stockSkuId, 42, updatedAt)

  val unsettledReply: GetReservationStateReply = GetReservationStateReply(unsettledReservation)
  val settledReply: GetReservationStateReply = GetReservationStateReply(settledReservation)
  val stockReply: GetStockStateReply = GetStockStateReply(stockState)

  val expectedUnsettledReservation: JsValue = Json.parse(
    "{\"reservationId\":\"3f2a1b0c-9d8e-7f6a-5b4c-3d2e1f0a9b8c\"," +
      "\"skuId\":\"1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d\"," +
      "\"quantity\":2,\"reserved\":true,\"label\":\"pallet\",\"tenantId\":\"tenant-7\"," +
      "\"occurredAt\":\"2026-11-20T07:30:00Z\",\"settledAt\":null}")

  val expectedSettledReservation: JsValue = Json.parse(
    "{\"reservationId\":\"3f2a1b0c-9d8e-7f6a-5b4c-3d2e1f0a9b8c\"," +
      "\"skuId\":\"1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d\"," +
      "\"quantity\":2,\"reserved\":true,\"label\":\"pallet\",\"tenantId\":\"tenant-7\"," +
      "\"occurredAt\":\"2026-11-20T07:30:00Z\",\"settledAt\":\"2026-11-20T09:15:30Z\"}")

  val expectedStock: JsValue = Json.parse(
    "{\"stockId\":\"9f8e7d6c-5b4a-3c2d-1e0f-9a8b7c6d5e4f\"," +
      "\"skuId\":\"2b3c4d5e-6f7a-4b5c-9d0e-1f2a3b4c5d6e\"," +
      "\"available\":42,\"updatedAt\":\"2026-11-20T11:45:12Z\"}")

  val missingTokenBody: String =
    "{\"errorCode\":\"INVALID_TOKEN\",\"message\":\"missing or malformed Authorization header\"}"
  val invalidTokenBody: String =
    "{\"errorCode\":\"INVALID_TOKEN\",\"message\":\"token verification failed\"}"
  val expiredTokenBody: String =
    "{\"errorCode\":\"TOKEN_EXPIRED\",\"message\":\"access token expired\"}"
  val internalErrorBody: String =
    "{\"errorCode\":\"INTERNAL_ERROR\",\"message\":\"unexpected server failure\"}"

  /** 400 形状（固定非法 id 的全等形状；JDK 消息逐字）。 */
  val fixedInvalidId = "not-a-uuid"
  val fixedInvalidIdBody: String =
    "{\"errorCode\":\"PARAM_INVALID\",\"message\":\"invalid id: Invalid UUID string: not-a-uuid\"}"

  /** 400 形状前缀（随机非法 id 只断言键位与回显前缀）。 */
  val paramInvalidPrefix: String = "{\"errorCode\":\"PARAM_INVALID\",\"message\":\"invalid id: "
}
