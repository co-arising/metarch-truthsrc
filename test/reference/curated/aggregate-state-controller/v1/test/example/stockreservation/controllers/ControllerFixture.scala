package example.stockreservation.controllers

import scala.concurrent.{Await, ExecutionContext, Future}
import scala.concurrent.duration._

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.Behaviors
import akka.actor.testkit.typed.scaladsl.TestProbe
import akka.cluster.sharding.typed.scaladsl.{EntityRef, EntityTypeKey}
import akka.cluster.sharding.typed.testkit.scaladsl.TestEntityRef
import akka.stream.Materializer
import com.typesafe.config.ConfigFactory

import play.api.libs.typedmap.TypedMap
import play.api.mvc.{
  AnyContent,
  BodyParsers,
  DefaultActionBuilder,
  DefaultControllerComponents,
  Headers,
  Request,
  RequestHeader
}
import play.api.mvc.request.{RemoteConnection, RequestTarget}
import play.api.http.{DefaultFileMimeTypes, FileMimeTypesConfiguration}

import net.imadz.common.auth.{Endpoint, TokenService, VerifiedToken}
import example.stockreservation.application.aggregates.{ReservationCommand, StockCommand}
import example.stockreservation.application.aggregates.repository.{ReservationRepository, StockRepository}
import controllers.AggregateStateApiController

/** 行为性质夹具（support 层）：真实 play Action 管线（DefaultActionBuilder＋
  * BodyParsers.Default＋DefaultControllerComponents）＋本地 typed ActorSystem＋
  * 官方 TestEntityRef 缝（akka.cluster.sharding.typed.testkit.scaladsl——
  * sharding 不可用时的合法 EntityRef 构造）。身份用固定验签表；测试请求为
  * support 层的 FixedRequest（play-testkit 不在钉扎供给内，FakeRequest 不可用）。 */
object ControllerFixture {

  implicit val system: ActorSystem[Nothing] = ActorSystem.create[Nothing](
    Behaviors.ignore[Nothing], "controller-fixture",
    // daemonic＝akka 线程全部 daemon——主线程结束后 JVM 正常发起退出并执行 shutdown hook
    // （否则非 daemon 线程让 JVM 永不退出，性质相被外层超时击杀）。
    ConfigFactory.parseString(
      "akka { daemonic = on, loglevel = OFF, stdout-loglevel = OFF }"))

  /** JVM 退出前关闭 actor system（非 daemon 线程否则悬挂 QualityMain 的 JVM 退出）。 */
  private val shutdownHook = new Thread(() => {
    system.terminate()
    Await.result(system.whenTerminated, 30.seconds)
  })
  Runtime.getRuntime.addShutdownHook(shutdownHook)

  implicit val materializer: Materializer = Materializer(system)
  implicit val ec: ExecutionContext = system.executionContext

  private val playBodyParsers = play.api.mvc.PlayBodyParsers()(materializer)
  private val actionBuilder = DefaultActionBuilder(playBodyParsers.anyContent)
  private val anyParser = new BodyParsers.Default(playBodyParsers)
  private val components = DefaultControllerComponents(
    actionBuilder, playBodyParsers,
    new play.api.i18n.DefaultMessagesApi(),
    new play.api.i18n.DefaultLangs(),
    new DefaultFileMimeTypes(new FileMimeTypesConfiguration()), ec)

  /** 固定验签表：good-token 有效；expired-token 过期（authenticate 过期分支判例）。 */
  private val goodExpiry: Long = java.time.Instant.now().getEpochSecond + 3600
  private val expiredExpiry: Long = java.time.Instant.now().getEpochSecond - 3600

  private final class FixedVerifier extends TokenService {
    def verifyAccess(token: String): Option[VerifiedToken] =
      Map("good-token" -> goodExpiry, "expired-token" -> expiredExpiry).get(token)
        .map(expiry => VerifiedToken("controller-fixture", 1, expiry, None))
  }

  private final class ProbeReservationRepository(ref: akka.actor.typed.ActorRef[ReservationCommand])
    extends ReservationRepository {
    def entityRef(id: String): EntityRef[ReservationCommand] =
      TestEntityRef(EntityTypeKey[ReservationCommand]("Reservation"), id, ref)
  }

  private final class ProbeStockRepository(ref: akka.actor.typed.ActorRef[StockCommand])
    extends StockRepository {
    def entityRef(id: String): EntityRef[StockCommand] =
      TestEntityRef(EntityTypeKey[StockCommand]("Stock"), id, ref)
  }

  val endpoint: Endpoint = new Endpoint(actionBuilder, anyParser, new FixedVerifier)

  val reservationProbe: TestProbe[ReservationCommand] = TestProbe[ReservationCommand]()
  val stockProbe: TestProbe[StockCommand] = TestProbe[StockCommand]()

  val reservationRepository: ReservationRepository = new ProbeReservationRepository(reservationProbe.ref)
  val stockRepository: StockRepository = new ProbeStockRepository(stockProbe.ref)

  val controller: AggregateStateApiController =
    new AggregateStateApiController(endpoint, reservationRepository, stockRepository, components)

  /** 测试请求（support 层 Request 实现；play-testkit 不在供给内）。 */
  def rawRequest(headers: (String, String)*): Request[AnyContent] =
    new FixedRequest(
      "GET",
      RequestTarget("/api/state/reservation/x", "/api/state/reservation/x", Map.empty),
      Headers(headers: _*),
      TypedMap.empty,
      RemoteConnection("127.0.0.1", secure = false, None),
      "HTTP/1.1",
      AnyContent())

  def request(token: Option[String]): Request[AnyContent] =
    rawRequest(token.map(value => "Authorization" -> s"Bearer $value").toSeq: _*)

  private final class FixedRequest(
      fixedMethod: String,
      fixedTarget: RequestTarget,
      fixedHeaders: Headers,
      fixedAttrs: TypedMap,
      fixedConnection: RemoteConnection,
      fixedVersion: String,
      override val body: AnyContent) extends Request[AnyContent] {
    def self: RequestHeader = this
    def connection: RemoteConnection = fixedConnection
    def method: String = fixedMethod
    def target: RequestTarget = fixedTarget
    def version: String = fixedVersion
    def headers: Headers = fixedHeaders
    def attrs: TypedMap = fixedAttrs
  }

  /** 严格实体取体：toResult/writes 产出 HttpEntity.Strict（play 2.8 参数序＝data 在前）。 */
  def bodyOf(result: play.api.mvc.Result): String = result.body match {
    case play.api.http.HttpEntity.Strict(data, _) => data.decodeString("UTF-8")
  }

  def await(future: Future[play.api.mvc.Result]): play.api.mvc.Result =
    Await.result(future, 12.seconds)
}
