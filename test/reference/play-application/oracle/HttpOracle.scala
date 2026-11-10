package example.inventory.playreference.oracle

import play.api.Mode
import play.api.libs.json._
import play.core.server.{AkkaHttpServer, ServerConfig}
import java.net.URI
import java.net.http.{HttpClient, HttpRequest, HttpResponse}
import java.nio.file.{Files, Paths}
import java.time.Duration
import scala.concurrent.Await
import scala.concurrent.duration._

object HttpOracle {
  private val operatorToken = "local-operator-token-0000000001"
  private val readerToken = "local-reader-token-00000000001"
  private val csrfToken = "local-csrf-token-0000000000001"
  private var count = 0
  private def check(value: Boolean, id: String): Unit = { assert(value, id); count += 1; println("CASE " + id) }
  def main(args: Array[String]): Unit = {
    require(args.length == 2)
    val phase = args(0)
    require(Set("write", "reopen", "fresh").contains(phase))
    val data = Paths.get(args(1))
    require(Files.isDirectory(data))
    val driver = Class.forName(sys.props.getOrElse("oracle.driver", "example.inventory.playreference.oracle.ReferenceDriver")).getDeclaredConstructor().newInstance().asInstanceOf[OracleDriver]
    val target = driver.open(data, phase)
    var server: Option[AkkaHttpServer] = None
    try {
      Await.result(target.ready, 10.seconds)
      val started = AkkaHttpServer.fromApplication(target.application,
        ServerConfig(rootDir = data.toFile, port = Some(0), address = "127.0.0.1", mode = Mode.Test))
      server = Some(started)
      val client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build()
      val root = "http://127.0.0.1:" + started.httpPort.get
      def request(method: String, path: String, body: String = "", token: String = operatorToken,
          csrf: String = csrfToken, contentType: String = "application/json"): HttpResponse[String] = {
        val builder = HttpRequest.newBuilder(URI.create(root + path)).timeout(Duration.ofSeconds(5))
        if (token.nonEmpty) builder.header("Authorization", "Bearer " + token)
        if (csrf.nonEmpty) builder.header("X-CSRF-Token", csrf)
        if (method == "POST") builder.header("Content-Type", contentType).POST(HttpRequest.BodyPublishers.ofString(body)) else builder.GET()
        client.send(builder.build(), HttpResponse.BodyHandlers.ofString())
      }
      def query(path: String = "/api/v1/warehouses/east/receipts", token: String = operatorToken) = request("GET", path, token = token)
      def reserve(tx: String, warehouse: String = "east", quantity: String = "2") = request("POST", "/api/v1/warehouses/" + warehouse + "/reserve",
        Json.stringify(Json.obj("txid" -> tx, "skuId" -> "sku-1", "quantity" -> quantity)))
      def commit(tx: String, warehouse: String = "east", id: String = "reservation") = request("POST", "/api/v1/warehouses/" + warehouse + "/commit",
        Json.stringify(Json.obj("txid" -> tx, "skuId" -> "sku-1", "reservationId" -> id)))
      def rows(): JsArray = (Json.parse(query().body()) \ "rows").as[JsArray]
      def waitRows(expected: Int): Unit = {
        val end = 8.seconds.fromNow
        while (end.hasTimeLeft() && rows().value.size != expected) Thread.sleep(40)
        check(rows().value.size == expected, "projection-visible")
      }
      check(request("GET", "/ready").statusCode() == 200, "readiness")
      if (phase == "write") {
        check(query(token = "").statusCode() == 401, "auth-missing")
        check(query(token = "unrecognized-local-token-000").statusCode() == 401, "auth-invalid")
        check(query(token = readerToken).statusCode() == 200, "reader-query")
        check(query("/api/v1/warehouses/west/receipts", readerToken).statusCode() == 403, "resource-denied")
        check(query("/warehouses/west/receipts", readerToken).statusCode() == 403, "page-resource-denied")
        val body = "{\"txid\":\"denied\",\"skuId\":\"sku-1\",\"quantity\":\"1\"}"
        check(request("POST", "/api/v1/warehouses/east/reserve", body, token = readerToken).statusCode() == 403, "role-denied")
        check(request("POST", "/api/v1/warehouses/east/reserve", body, csrf = "").statusCode() == 403, "csrf-denied")
        check(request("POST", "/api/v1/warehouses/east/reserve", body.replace("\"1\"", "1")).statusCode() == 400, "json-number-denied")
        check(request("POST", "/api/v1/warehouses/east/reserve", body.replace("\"1\"", "\"1e2\"")).statusCode() == 400, "json-exponent-denied")
        check(request("POST", "/api/v1/warehouses/east/reserve", body.replace("\"1\"", "\"9223372036854775808\"")).statusCode() == 400, "long-overflow-denied")
        check(request("POST", "/api/v1/warehouses/east/reserve", body.dropRight(1) + ",\"txid\":\"duplicate\"}").statusCode() == 400, "duplicate-json-denied")
        check(request("POST", "/api/v1/warehouses/east/reserve", body.dropRight(1) + ",\"warehouseId\":\"west\"}").statusCode() == 400, "unknown-field-denied")
        check(request("POST", "/api/v1/warehouses/east/reserve", body, contentType = "text/plain").statusCode() == 415, "media-type-denied")
        check(request("POST", "/api/v1/warehouses/east/reserve", " " * 65537).statusCode() == 413, "body-bound")
        check(Await.result(target.persistenceIds, 5.seconds).isEmpty, "denied-requests-no-actor")
        check(reserve("zero", quantity = "0").statusCode() == 422, "domain-rejected")
        check(Await.result(target.sequences("warehouse-east-v1"), 5.seconds).isEmpty, "domain-rejection-no-events")
        for (tx <- Vector("<script>alert(1)</script>", "middle", "z-last")) {
          val response = reserve(tx, quantity = "9223372036854775807")
          check(response.statusCode() == 200, "command-persisted")
          val reservationId = (Json.parse(response.body()) \ "reservationId").as[String]
          check(reservationId.length == 64, "actual-reservation-identity")
          check(commit(tx, id = reservationId).statusCode() == 200, "commit-persisted")
        }
        check(commit("middle", warehouse = "west").statusCode() == 200, "second-resource-command")
        waitRows(3)
        val first = Json.parse(query("/api/v1/warehouses/east/receipts?limit=1").body())
        val cursor = (first \ "next").as[String]
        check((first \ "rows").as[JsArray].value.size == 1, "query-keyset-first")
        val second = Json.parse(query("/api/v1/warehouses/east/receipts?limit=1&after=" + cursor).body())
        check((second \ "rows").as[JsArray].value.head.\("txid").as[String] == "middle", "query-keyset-next")
        check(query("/api/v1/warehouses/west/receipts?after=" + cursor).statusCode() == 400, "cursor-resource-denied")
        check(query("/api/v1/warehouses/east/receipts?limit=1&limit=2").statusCode() == 400, "duplicate-query-denied")
        check(query("/api/v1/warehouses/east/receipts?limit=65").statusCode() == 400, "query-limit-denied")
      } else {
        waitRows(3)
        val response = commit("middle")
        check(response.statusCode() == 200 && (Json.parse(response.body()) \ "status").as[String] == "no-change", "recovered-no-change")
      }
      val east = Await.result(target.sequences("warehouse-east-v1"), 5.seconds)
      check(east == (1L to 6L).toVector, "real-journal-sequences");
      check(Await.result(target.sequences("warehouse-west-v1"), 5.seconds).size == 1, "resource-stream-isolated")
      val html = query("/warehouses/east/receipts?limit=1", readerToken)
      check(html.statusCode() == 200 && html.body().contains("&lt;script&gt;") && !html.body().contains("<script>"), "html-escaped")
      check(html.body().contains("rel=\"next\"") && html.body().contains("&amp;limit=1"), "html-pagination-link")
      check(html.headers().firstValue("Cache-Control").orElse("") == "no-store", "no-store")
      val close = target.close()
      check(target.close() eq close, "close-idempotent")
      val report = Await.result(close, 12.seconds)
      check(report, "close-drained")
      check(query().statusCode() == 503, "closed-admission")
      if (phase == "write") {
        val readside = data.resolve("readside")
        driver.validateStorage(data.resolve("journal"), readside, false, false)
        check(true, "existing-storage-positive")
        val empty = Files.createDirectory(data.resolve("empty-journal"))
        val rejected = scala.util.Try(driver.validateStorage(empty, readside, false, false))
        check(rejected.failed.toOption.exists(_.getMessage.contains("CURRENT")), "old-readside-empty-journal-denied")
        val reused = scala.util.Try(driver.validateStorage(data.resolve("journal"), readside, false, true))
        check(reused.failed.toOption.exists(_.getMessage.contains("readside open mode mismatch")), "old-readside-not-fresh-rebuild")
      }
      println("PLAY_APPLICATION_ORACLE_PASSED phase=" + phase + " assertions=" + count)
    } finally {
      server match {
        case Some(value) => value.stop()
        case None => play.api.Play.stop(target.application)
      }
      Await.result(target.terminated, 12.seconds)
    }
  }
}
