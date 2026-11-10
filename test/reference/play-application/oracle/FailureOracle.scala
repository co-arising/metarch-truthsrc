package example.inventory.playreference.oracle

import play.api.Mode
import play.api.libs.json._
import play.core.server.{AkkaHttpServer, ServerConfig}
import java.net.URI
import java.net.http.{HttpClient, HttpRequest, HttpResponse}
import java.nio.file.{Files, Paths}
import java.time.Duration
import scala.concurrent.{Await, Promise}
import scala.concurrent.duration._

object FailureOracle {
  private var count = 0
  private def check(value: Boolean, id: String): Unit = { assert(value, id); count += 1; println("CASE " + id) }
  def main(args: Array[String]): Unit = {
    require(args.length == 2)
    val mode = args(0)
    val data = Paths.get(args(1))
    require(Files.isDirectory(data))
    val driver = Class.forName(sys.props("oracle.driver")).getDeclaredConstructor().newInstance().asInstanceOf[OracleDriver]
    if (mode == "initialization") {
      driver.rejectInitialization(data)
      check(true, "partial-initialization-cleaned")
      println("PLAY_FAILURE_ORACLE_PASSED mode=" + mode + " assertions=" + count)
      return
    }
    val target = driver.open(data, "write", mode)
    var server: Option[AkkaHttpServer] = None
    try {
      Await.result(target.ready, 10.seconds)
      val started = AkkaHttpServer.fromApplication(target.application,
        ServerConfig(rootDir = data.toFile, port = Some(0), address = "127.0.0.1", mode = Mode.Test))
      server = Some(started)
      val client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build()
      val root = "http://127.0.0.1:" + started.httpPort.get
      def request(method: String, path: String, body: String = ""): HttpResponse[String] = {
        val builder = HttpRequest.newBuilder(URI.create(root + path)).timeout(Duration.ofSeconds(5))
          .header("Authorization", "Bearer local-operator-token-0000000001")
          .header("X-CSRF-Token", "local-csrf-token-0000000000001")
        if (method == "POST") builder.header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)) else builder.GET()
        client.send(builder.build(), HttpResponse.BodyHandlers.ofString())
      }
      val body = "{\"txid\":\"failure-fixture\",\"skuId\":\"sku-1\",\"quantity\":\"1\"}"
      mode match {
        case "authority-unavailable" | "authority-unexpected" | "csrf-unavailable" =>
          val response = request(if (mode == "csrf-unavailable") "POST" else "GET",
            if (mode == "csrf-unavailable") "/api/v1/warehouses/east/reserve" else "/api/v1/warehouses/east/receipts", body)
          check(response.statusCode() == (if (mode == "authority-unexpected") 500 else 503), "authority-failure-status")
          check(response.body() == (if (mode == "authority-unexpected") "{\"code\":\"internal-error\"}" else "{\"code\":\"service-unavailable\"}"), "authority-error-redacted")
          check(Await.result(target.persistenceIds, 5.seconds).isEmpty && target.commandInvocations == 0, "authority-failure-no-domain-call")
        case "ask-timeout" =>
          val response = request("POST", "/api/v1/warehouses/east/reserve", body)
          check(response.statusCode() == 504 && response.body() == "{\"code\":\"outcome-unknown\"}", "ask-timeout-outcome-unknown")
          val end = 5.seconds.fromNow
          var sequences = Vector.empty[Long]
          while (end.hasTimeLeft() && sequences.isEmpty) {
            sequences = Await.result(target.sequences("warehouse-east-v1"), 2.seconds)
            if (sequences.isEmpty) Thread.sleep(25)
          }
          check(sequences == Vector(1L), "timeout-can-still-persist")
          check(target.commandInvocations == 1, "timeout-does-not-resubmit")
        case "invalid-output" =>
          val response = request("POST", "/api/v1/warehouses/east/reserve", body)
          check(response.statusCode() == 500 && response.body() == "{\"code\":\"internal-error\"}", "output-contract-violation-not-returned")
        case "drain" =>
          val release = Promise[Unit]()
          val pending = target.hold(release.future)
          val closing = target.close()
          check(!closing.isCompleted, "close-waits-for-admitted-request")
          check(request("GET", "/api/v1/warehouses/east/receipts").statusCode() == 503, "closing-refuses-new-admission")
          release.success(())
          check(Await.result(pending, 2.seconds), "admitted-request-completes")
          check(Await.result(closing, 11.seconds), "admission-drained-before-resources")
        case "source-failure" =>
          Await.result(target.failSource(), 6.seconds)
          val end = 2.seconds.fromNow
          while (target.accepting && end.hasTimeLeft()) Thread.sleep(10)
          check(!target.accepting && request("GET", "/ready").statusCode() == 503, "source-failure-invalidates-readiness")
          check(request("GET", "/api/v1/warehouses/east/receipts").statusCode() == 503, "source-failure-denies-admission")
          check(!Await.result(target.close(), 11.seconds), "runner-failure-not-clean-close")
        case "unicode" =>
          val firstKey = "界" * 85
          val secondKey = "😀" * 64
          for (key <- Vector(firstKey, secondKey)) {
            val response = request("POST", "/api/v1/warehouses/east/commit", Json.stringify(Json.obj("txid" -> key, "skuId" -> "sku-1", "reservationId" -> "r")))
            check(response.statusCode() == 200, "utf8-boundary-command")
          }
          val end = 8.seconds.fromNow
          var page = Json.parse(request("GET", "/api/v1/warehouses/east/receipts?limit=1").body())
          while ((page \ "next").asOpt[String].isEmpty && end.hasTimeLeft()) {
            Thread.sleep(25)
            page = Json.parse(request("GET", "/api/v1/warehouses/east/receipts?limit=1").body())
          }
          val cursor = (page \ "next").as[String]
          val next = request("GET", "/api/v1/warehouses/east/receipts?limit=1&after=" + cursor)
          check(next.statusCode() == 200 && (Json.parse(next.body()) \ "rows").as[JsArray].value.size == 1, "multibyte-keyset-roundtrip")
          val tooLong = request("POST", "/api/v1/warehouses/east/reserve", Json.stringify(Json.obj("txid" -> ("界" * 86), "skuId" -> "s", "quantity" -> "1")))
          check(tooLong.statusCode() == 400, "utf8-overflow-denied")
          check(Await.result(target.sequences("warehouse-east-v1"), 5.seconds) == Vector(1L, 2L), "unicode-rejection-no-extra-event")
        case _ => throw new IllegalArgumentException("unknown fault mode")
      }
      if (!Set("drain", "source-failure").contains(mode)) check(Await.result(target.close(), 11.seconds), "failure-fixture-close-drained")
      println("PLAY_FAILURE_ORACLE_PASSED mode=" + mode + " assertions=" + count)
    } finally {
      server match { case Some(value) => value.stop(); case None => play.api.Play.stop(target.application) }
      Await.result(target.terminated, 12.seconds)
    }
  }
}
