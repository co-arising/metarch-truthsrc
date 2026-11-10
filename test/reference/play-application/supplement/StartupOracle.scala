package example.inventory.playreference.supplement

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.Behaviors
import com.typesafe.config.ConfigFactory
import example.inventory.composition.{WarehouseApplication, WarehouseLoader, WarehouseSettings}
import example.inventory.extensions.{ConfiguredWarehouseAuthority, ReservationIdentity}
import example.inventory.application.api.WarehouseApi._
import play.api.{ApplicationLoader, Configuration, Environment, Mode}
import play.api.libs.json.Json
import play.core.server.{AkkaHttpServer, ServerConfig}
import java.net.URI
import java.net.http.{HttpClient, HttpRequest, HttpResponse}
import java.nio.file.{Files, Paths}
import java.time.Duration
import java.util.concurrent.{CountDownLatch, TimeUnit}
import scala.concurrent.{Await, ExecutionContext, Future}
import scala.concurrent.duration._
import scala.util.Try

object StartupOracle {
  private var count = 0
  private def check(value: Boolean, id: String): Unit = { assert(value, id); count += 1; println("CASE " + id) }
  def main(args: Array[String]): Unit = {
    require(args.length == 1)
    val data = Paths.get(args(0))
    val delayed = Files.createDirectory(data.resolve("delayed"))
    val lifecycle = ActorSystem[Nothing](Behaviors.empty, "DelayedLifecycle", ConfigFactory.parseString("""
      akka.actor.provider=local
      akka.loglevel=WARNING
      akka.actor.default-dispatcher.executor="thread-pool-executor"
      akka.actor.default-dispatcher.thread-pool-executor.fixed-pool-size=1
    """))
    val entered = new CountDownLatch(1)
    val release = new CountDownLatch(1)
    lifecycle.executionContext.execute(new Runnable { def run(): Unit = { entered.countDown(); release.await() } })
    check(entered.await(2, TimeUnit.SECONDS), "startup-callback-held")
    val credentials = Vector(Configuration("token" -> "local-operator-token-0000000001", "csrf" -> "local-csrf-token-0000000000001",
      "id" -> "operator", "roles" -> Seq("operator"), "resources" -> Seq("east", "west")))
    try {
      val service = WarehouseApplication.open(WarehouseSettings(delayed.resolve("journal"), delayed.resolve("readside"), "late-ready", true, true),
        new ReservationIdentity, new ConfiguredWarehouseAuthority(credentials), lifecycle)
      check(!service.accepting && !service.ready.isCompleted, "not-ready-before-startup")
      val closing = service.close()
      release.countDown()
      Await.result(closing, 11.seconds)
      check(Try(Await.result(service.ready, 3.seconds)).isFailure && !service.accepting, "late-ready-cannot-reopen-closing")
      check(Await.result(service.admit(Future.successful(Right(()): Outcome[Unit])), 1.second) == Left(Unavailable), "late-ready-admission-stays-closed")
      check(service.domainSystem.whenTerminated.isCompleted, "late-ready-domain-runtime-terminated")
    } finally {
      release.countDown(); lifecycle.terminate(); Await.result(lifecycle.whenTerminated, 8.seconds)
    }
    val loaded = Files.createDirectory(data.resolve("loader"))
    val context = ApplicationLoader.createContext(new Environment(loaded.toFile, getClass.getClassLoader, Mode.Test), initialSettings = Map(
      "play.http.secret.key" -> "independent-loader-local-only-secret", "akka.actor.provider" -> "local",
      "warehouse.journal" -> loaded.resolve("journal").toString, "warehouse.readside" -> loaded.resolve("readside").toString,
      "warehouse.namespace" -> "loader-oracle", "warehouse.freshJournal" -> java.lang.Boolean.TRUE, "warehouse.freshReadside" -> java.lang.Boolean.TRUE,
      "warehouse.credentials" -> java.util.Collections.singletonList(java.util.Map.of[String, AnyRef](
        "token", "local-operator-token-0000000001", "csrf", "local-csrf-token-0000000000001", "id", "operator",
        "roles", java.util.Collections.singletonList("operator"), "resources", java.util.Arrays.asList("east", "west")))))
    val application = new WarehouseLoader().load(context)
    var server: Option[AkkaHttpServer] = None
    try {
      val running = AkkaHttpServer.fromApplication(application, ServerConfig(rootDir=loaded.toFile, port=Some(0), address="127.0.0.1", mode=Mode.Test))
      server = Some(running)
      val client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build()
      def get(path: String, authenticated: Boolean = false) = {
        val request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + running.httpPort.get + path)).timeout(Duration.ofSeconds(5))
        if (authenticated) request.header("Authorization", "Bearer local-operator-token-0000000001")
        client.send(request.GET().build(), HttpResponse.BodyHandlers.ofString())
      }
      val end = 8.seconds.fromNow
      while (get("/ready").statusCode() != 200 && end.hasTimeLeft()) Thread.sleep(25)
      check(get("/ready").statusCode() == 200, "actual-loader-reaches-ready")
      check(get("/api/v1/warehouses/east/receipts").statusCode() == 401, "loader-authority-required")
      val page = get("/api/v1/warehouses/east/receipts", true)
      check(page.statusCode() == 200 && (Json.parse(page.body()) \ "rows").as[Vector[play.api.libs.json.JsValue]].isEmpty, "loader-query-connected")
    } finally {
      server match { case Some(value) => value.stop(); case None => play.api.Play.stop(application) }
      Await.result(application.actorSystem.whenTerminated, 12.seconds)
    }
    check(application.actorSystem.whenTerminated.isCompleted, "loader-http-runtime-terminated")
    println("PLAY_STARTUP_ORACLE_PASSED assertions=" + count)
  }
}
