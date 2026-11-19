package controllers

import example.stockreservation.application.aggregates.GetReservationState
import example.stockreservation.application.aggregates.GetReservationStateReply
import example.stockreservation.application.aggregates.GetStockState
import example.stockreservation.application.aggregates.GetStockStateReply
import example.stockreservation.application.aggregates.repository.ReservationRepository
import example.stockreservation.application.aggregates.repository.StockRepository
import example.stockreservation.domain.entities.ReservationState
import example.stockreservation.domain.entities.StockState
import javax.inject.Inject
import javax.inject.Singleton
import net.imadz.common.CommonTypes.Id
import net.imadz.common.auth.ApiError
import net.imadz.common.auth.Endpoint
import net.imadz.metarch.infrastructure.api.IdGuard
import play.api.libs.json.{Json, OWrites, Writes}
import play.api.mvc._
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._

/** AggregateStateApiController: S1 聚合面写侧强一致状态查询（每聚合 Get<X>State 直读·2026-09-27 生成范式）
  * 序列化收在 controller 层（用户裁决：domain/application 不引入 play-json）。 */
@Singleton
class AggregateStateApiController @Inject() (
    api: Endpoint,
    reservationRepository: ReservationRepository,
    stockRepository: StockRepository,
    val cc: ControllerComponents)(implicit ec: ExecutionContext) extends BaseController {

  override def controllerComponents: ControllerComponents = cc
  private implicit val timeout: akka.util.Timeout = akka.util.Timeout(5.seconds)

  // Instant → ISO-8601 串（用户裁决：序列化收 controller 层——不进 domain）
  // null-safe：empty 状态的 Instant 中性值是 null（生成器 empty 工厂），写 JsNull 不炸
  private implicit val s1InstantWrites: Writes[java.time.Instant] =
    (i: java.time.Instant) => Json.toJson(Option(i).map(_.toString))
  // Id(UUID) → 串（同上·controller 层私有·null-safe）
  private implicit val s1IdWrites: Writes[Id] =
    (i: Id) => Json.toJson(Option(i).map(_.toString))

  /** S1 聚合面：ReservationState → JSON（逐字段手写·无字段数上限） */
  private val writesReservationState: OWrites[ReservationState] =
    (st: ReservationState) => Json.obj(
      "reservationId" -> Json.toJson[Id](st.reservationId),
      "skuId" -> Json.toJson[Id](st.skuId),
      "quantity" -> Json.toJson[Int](st.quantity),
      "reserved" -> Json.toJson[Boolean](st.reserved),
      "label" -> Json.toJson[String](st.label),
      "tenantId" -> Json.toJson[String](st.tenantId),
      "occurredAt" -> Json.toJson[java.time.Instant](st.occurredAt),
      "settledAt" -> Json.toJson[java.time.Instant](st.settledAt))

  /** S1 聚合面：StockState → JSON（逐字段手写·无字段数上限） */
  private val writesStockState: OWrites[StockState] =
    (st: StockState) => Json.obj(
      "stockId" -> Json.toJson[Id](st.stockId),
      "skuId" -> Json.toJson[Id](st.skuId),
      "available" -> Json.toJson[Int](st.available),
      "updatedAt" -> Json.toJson[java.time.Instant](st.updatedAt))

  /** S1 聚合面：GetReservationStateReply 信封（state 字段平铺）——implicit 供 DSL apply[T] 隐参取用 */
  private implicit val writesGetReservationStateReply: OWrites[GetReservationStateReply] =
    (r: GetReservationStateReply) =>
      (writesReservationState: OWrites[ReservationState]).writes(r.state)

  /** S1 聚合面：GetStockStateReply 信封（state 字段平铺）——implicit 供 DSL apply[T] 隐参取用 */
  private implicit val writesGetStockStateReply: OWrites[GetStockStateReply] =
    (r: GetStockStateReply) =>
      (writesStockState: OWrites[StockState]).writes(r.state)

  /** S1 聚合面：reservation 写侧状态强一致查询（Get<X>State → Reply·不产事件） */
  def reservation(id: String): Action[AnyContent] =
    api.global.read().apply[GetReservationStateReply] {
      _ => {
        IdGuard.parse("reservationId" -> id) match {
          case Right(Seq(reservationIdCid)) =>
            reservationRepository.entityRef(id).ask {
              (replyTo: akka.actor.typed.ActorRef[GetReservationStateReply]) =>
                GetReservationState(reservationIdCid, replyTo)
            }.map(reply => Right(reply): Either[ApiError, GetReservationStateReply])
          case Left(err) =>
            scala.concurrent.Future.successful(
              Left(err): Either[ApiError, GetReservationStateReply])
        }
      }
    }

  /** S1 聚合面：stock 写侧状态强一致查询（Get<X>State → Reply·不产事件） */
  def stock(id: String): Action[AnyContent] =
    api.global.read().apply[GetStockStateReply] {
      _ => {
        IdGuard.parse("stockId" -> id) match {
          case Right(Seq(stockIdCid)) =>
            stockRepository.entityRef(id).ask {
              (replyTo: akka.actor.typed.ActorRef[GetStockStateReply]) =>
                GetStockState(stockIdCid, replyTo)
            }.map(reply => Right(reply): Either[ApiError, GetStockStateReply])
          case Left(err) =>
            scala.concurrent.Future.successful(Left(err): Either[ApiError, GetStockStateReply])
        }
      }
    }
}
