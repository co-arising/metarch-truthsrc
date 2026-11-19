package example.stockreservation.controllers

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths}

import scala.jdk.CollectionConverters._

import org.scalacheck.{Gen, Properties}
import org.scalacheck.Prop.forAll
import org.scalacheck.Prop.secure

import example.stockreservation.controllers.quality.ScalaSourceMetrics
import example.stockreservation.controllers.quality.ScalaSourceMetrics.Layer

/** 结构性质（真实提交源面）＋度量器元性质（合成源）。
  * 结构面钉住：生成面控制器形态（import 面／成员序／ctor 序／每聚合 IdGuard＋ask 形状）、
  * play/akka 的 Y2 文件白名单、时钟/身份解析 confinement、100 列版式、领域状态与仓储
  * 端口形状；directed negative 用合成文本验证检查器判别力。
  * 元性质钉住引擎核心计数语义、E2b 上下文规则与本族 Y2 边界增量。 */
object ControllerQualityProperties extends Properties("aggregate-state-controller.quality.v1") {

  private val controllerPath = "app/controllers/AggregateStateApiController.scala"
  private val endpointPath = "app/net/imadz/common/auth/Endpoint.scala"
  private val apiErrorPath = "app/net/imadz/common/auth/ApiError.scala"
  private val tokenServicePath = "app/net/imadz/common/auth/TokenService.scala"
  private val idGuardPath = "app/net/imadz/metarch/infrastructure/api/IdGuard.scala"
  private val idSupplyPath = "app/net/imadz/common/Id.scala"
  private val reservationStatePath = "app/example/stockreservation/domain/entities/ReservationEntity.scala"
  private val stockStatePath = "app/example/stockreservation/domain/entities/StockEntity.scala"
  private val reservationProtocolPath = "app/example/stockreservation/application/aggregates/ReservationProtocol.scala"
  private val stockProtocolPath = "app/example/stockreservation/application/aggregates/StockProtocol.scala"
  private val reservationRepoPath = "app/example/stockreservation/application/aggregates/repository/ReservationRepository.scala"
  private val stockRepoPath = "app/example/stockreservation/application/aggregates/repository/StockRepository.scala"

  private val zeroMechanismTokens =
    Vector("Await", "???", "ActorSystem", "net.imadz.codegen", "java.sql")

  private val controllerImports = Vector(
    "example.stockreservation.application.aggregates.GetReservationState",
    "example.stockreservation.application.aggregates.GetReservationStateReply",
    "example.stockreservation.application.aggregates.GetStockState",
    "example.stockreservation.application.aggregates.GetStockStateReply",
    "example.stockreservation.application.aggregates.repository.ReservationRepository",
    "example.stockreservation.application.aggregates.repository.StockRepository",
    "example.stockreservation.domain.entities.ReservationState",
    "example.stockreservation.domain.entities.StockState",
    "javax.inject.Inject",
    "javax.inject.Singleton",
    "net.imadz.common.CommonTypes.Id",
    "net.imadz.common.auth.ApiError",
    "net.imadz.common.auth.Endpoint",
    "net.imadz.metarch.infrastructure.api.IdGuard",
    "play.api.libs.json.{Json, OWrites, Writes}",
    "play.api.mvc._",
    "scala.concurrent.ExecutionContext",
    "scala.concurrent.duration._")

  private def appTexts: Map[String, String] = {
    val listing = Paths.get(sys.props("quality.sources"))
    Files.readAllLines(listing, StandardCharsets.UTF_8).asScala.toVector
      .map(_.split("\t", -1)).filter(columns => columns.length == 3)
      .map(columns => columns(0) -> new String(Files.readAllBytes(Paths.get(columns(1))), StandardCharsets.UTF_8))
      .filter(entry => entry._1.startsWith("app/")).toMap
  }

  private def importsOf(source: String): Vector[String] =
    source.split("\n").toVector.map(_.trim).filter(_.startsWith("import ")).map(_.stripPrefix("import "))

  private def indexIn(source: String, marker: String): Int =
    source.split("\n").indexWhere(_.contains(marker))

  private def orderedMarkers(source: String, markers: Vector[String]): Boolean = {
    val indices = markers.map(indexIn(source, _))
    indices.forall(index => index >= 0) && indices == indices.sorted
  }

  private def scopes(text: String, layer: Layer): Vector[ScalaSourceMetrics.Scope] = {
    val report = ScalaSourceMetrics.analyze("sample.scala", text, layer)
      .fold(error => throw new IllegalArgumentException(error), identity)
    require(report.violations.isEmpty, report.violations.toString)
    report.scopes
  }

  private def method(text: String, layer: Layer = Layer.Support): ScalaSourceMetrics.Scope =
    scopes(s"object Sample { def choose(a: Boolean): Int = $text }", layer)
      .find(_.kind == "method").getOrElse(throw new IllegalArgumentException("Missing method"))

  private def violations(text: String, layer: Layer, file: String = "sample.scala"): Set[String] =
    ScalaSourceMetrics.analyze(file, text, layer).toOption.get.violations.map(_.reason).toSet

  private val lengths = Gen.choose(0, 7)

  property("structure: the controller import face is the judged dynamic and fixed order") = secure {
    importsOf(appTexts(controllerPath)) == controllerImports
  }

  property("structure: controller member order is shared writers then state writers then reply writers then endpoints") = secure {
    orderedMarkers(appTexts(controllerPath), Vector(
      "private implicit val s1InstantWrites", "private implicit val s1IdWrites",
      "private val writesReservationState", "private val writesStockState",
      "private implicit val writesGetReservationStateReply", "private implicit val writesGetStockStateReply",
      "def reservation(", "def stock("))
  }

  property("structure: the constructor carries the endpoint then entries-order repositories then controller components") = secure {
    orderedMarkers(appTexts(controllerPath), Vector(
      "    api: Endpoint,", "    reservationRepository: ReservationRepository,",
      "    stockRepository: StockRepository,", "    val cc: ControllerComponents)"))
  }

  property("structure: each endpoint parses its own idParam label and asks with the raw string id") = secure {
    val controller = appTexts(controllerPath)
    controller.contains("IdGuard.parse(\"reservationId\" -> id)") &&
      controller.contains("IdGuard.parse(\"stockId\" -> id)") &&
      controller.contains("reservationRepository.entityRef(id).ask") &&
      controller.contains("stockRepository.entityRef(id).ask")
  }

  property("structure: each ask records the parsed cid before the reply channel") = secure {
    val controller = appTexts(controllerPath)
    controller.contains("GetReservationState(reservationIdCid, replyTo)") &&
      controller.contains("GetStockState(stockIdCid, replyTo)")
  }

  property("structure: play imports stay in the controller and the two auth supplies only") = secure {
    val playFiles = appTexts.toVector
      .collect { case (path, text) if text.split("\n").exists(_.trim.startsWith("import play")) => path }.sorted
    playFiles == Vector(apiErrorPath, controllerPath, endpointPath).sorted
  }

  property("structure: akka imports stay in the protocol and repository supplies only") = secure {
    val akkaFiles = appTexts.toVector
      .collect { case (path, text) if text.split("\n").exists(_.trim.startsWith("import akka")) => path }.sorted
    val controller = appTexts(controllerPath)
    akkaFiles == Vector(reservationProtocolPath, stockProtocolPath, reservationRepoPath, stockRepoPath).sorted &&
      !controller.split("\n").exists(_.trim.startsWith("import akka"))
  }

  property("structure: clock reads stay confined to the platform auth supply") = secure {
    val clockPaths = appTexts.toVector
      .collect { case (path, text) if text.split("Instant.now").length > 1 => path }.sorted
    clockPaths == Vector(endpointPath)
  }

  property("structure: identity string parsing stays confined to the common supply") = secure {
    val fromStringPaths = appTexts.toVector
      .collect { case (path, text) if text.contains("UUID.fromString") => path }.sorted
    fromStringPaths == Vector(idSupplyPath)
  }

  property("structure: boundary id translation stays confined to the guard") = secure {
    val ofPaths = appTexts.toVector
      .collect { case (path, text) if text.contains("Id.of(") => path }.sorted
    ofPaths == Vector(idGuardPath)
  }

  property("structure: app sources carry no random identity generation") = secure {
    !appTexts.values.exists(_.contains("randomUUID"))
  }

  property("structure: app sources carry no mechanism tokens") = secure {
    appTexts.forall { case (_, text) => zeroMechanismTokens.forall(token => !text.contains(token)) }
  }

  property("structure: app sources hold the 100-column layout discipline") = secure {
    appTexts.forall { case (_, text) =>
      text.split("\n").toVector.filterNot(line => line.trim.startsWith("import ")).forall(_.length <= 100)
    }
  }

  property("structure: domain states import only the common identity supply") = secure {
    importsOf(appTexts(reservationStatePath)) == Vector("net.imadz.common.CommonTypes.Id") &&
      importsOf(appTexts(stockStatePath)) == Vector("net.imadz.common.CommonTypes.Id")
  }

  property("structure: repositories are ports without ask implementations") = secure {
    val reservationPort = appTexts(reservationRepoPath)
    val stockPort = appTexts(stockRepoPath)
    reservationPort.contains("def entityRef(id: String): EntityRef[ReservationCommand]") &&
      stockPort.contains("def entityRef(id: String): EntityRef[StockCommand]") &&
      !reservationPort.contains(".ask") && !stockPort.contains(".ask")
  }

  property("negative: reordered members fail the order check") = secure {
    val synthetic = "object X {\n  private val b = 1\n  private val a = 2\n}"
    !orderedMarkers(synthetic, Vector("private val a", "private val b")) &&
      orderedMarkers(synthetic, Vector("private val b", "private val a"))
  }

  property("negative: java.util import statements stay rejected in boundary") = secure {
    val effectful = "import java.util.HashMap; object Sample { def face(): Int = 1 }"
    violations(effectful, Layer.Boundary, "app/x/infrastructure/projection/Impl.scala")
      .contains("outside-or-effectful-domain-import") &&
      violations(effectful, Layer.Boundary, "app/controllers/Sample.scala")
        .contains("outside-or-effectful-domain-import")
  }

  property("negative: application-to-infrastructure imports stay rejected") = secure {
    val outward = "import example.stockreservation.infrastructure.projection.Store; object Sample { def face(): Int = 1 }"
    violations(outward, Layer.Boundary, "app/x/application/projection/Handlers.scala")
      .contains("outside-or-effectful-domain-import")
  }

  property("negative: domain-to-application imports stay rejected") = secure {
    val source = "import example.stockreservation.application.aggregates.X; object Sample { def face(): Int = 1 }"
    violations(source, Layer.Domain, "app/x/domain/entities/Sample.scala")
      .contains("outside-or-effectful-domain-import")
  }

  property("negative: invalid syntax cannot become an empty successful report") = secure {
    ScalaSourceMetrics.analyze("broken.scala", "object {", Layer.Domain).isLeft
  }

  property("AST: if chains have independently known complexity") = forAll(lengths) { length =>
    val body = (0 until length).map(_ => "if (a) 1 else ").mkString + "0"
    method(body).counts.complexity == length + 1
  }

  property("AST: short-circuit operators are counted") = forAll(lengths) { length =>
    val expression = Vector.fill(length + 1)("a").mkString(" && ")
    method(expression).counts.complexity == length + 1
  }

  property("AST: comments and branch-like literal text add no decisions") = forAll(lengths) { length =>
    val noise = "/* if match case && || */" * length
    method(s"{ $noise \"if match case && ||\" }").counts.complexity == 1
  }

  property("AST: else-if is one control nesting level") = secure {
    method("if (a) 1 else if (a) 2 else 3").counts == ScalaSourceMetrics.Counts(2, 1)
  }

  property("AST: HOF closure decisions count both in parent and closure") = secure {
    val report = ScalaSourceMetrics.analyze("sample.scala",
      "object Sample { def choose = List(1).map(x => if (x > 0) 1 else 2) }", Layer.Support).toOption.get
    val counts = report.scopes.filter(scope => Set("method", "lambda").contains(scope.kind)).map(_.counts.complexity)
    counts.size == 2 && counts.forall(_ == 2)
  }

  property("AST: match alternatives and guards are explicit paths") = secure {
    method("a match { case 1 | 2 => 1; case _ => 0 }").counts.complexity == 3 &&
      method("a match { case 1 if a > 0 => 2; case _ => 3 }").counts.complexity == 3
  }

  property("AST: defaults and initialization are registered") = secure {
    val report = ScalaSourceMetrics.analyze("sample.scala",
      "class Sample(a: Boolean = true) { val b = if(a) 1 else 2; def choose(x: Int = 1) = x }", Layer.Support).toOption.get
    Set("method", "value", "initialization", "default-parameter").subsetOf(report.scopes.map(_.kind).toSet)
  }

  property("AST: overflow complexity is measured exactly, never clamped") = secure {
    val body = (0 until 6).map(_ => "if (a) 1 else ").mkString + "0"
    method(body).counts.complexity == 7
  }

  property("AST: named arguments sit in argument position and are admitted in both layers") = secure {
    val source = "object Sample { case class R(x: Int); def face(r: R): R = r.copy(x = 1); def make(): R = new R(x = 1) }"
    violations(source, Layer.Boundary).isEmpty && violations(source, Layer.Domain).isEmpty
  }

  property("negative: assignment targets stay rejected in both layers") = secure {
    val source = "object Bad { var y = 0; def face(): Unit = { y = 1; () } }"
    violations(source, Layer.Boundary).contains("mutable-domain-state") &&
      violations(source, Layer.Domain).contains("mutable-domain-state")
  }

  property("AST: boundary mode admits the play and akka declared face") = secure {
    val declared = "import play.api.mvc._\nimport akka.util.Timeout\n" +
      "object Sample { def face(i: java.time.Instant): Int = java.time.Instant.now().getEpochSecond.toInt }"
    scopes(declared, Layer.Boundary).nonEmpty && violations(declared, Layer.Boundary).isEmpty
  }

  property("negative: java.time import statements stay rejected with the fully-qualified form sanctioned") = secure {
    val imported = "import java.time.Instant\nobject Sample { def face(): java.time.Instant = java.time.Instant.now() }"
    val qualified = "object Sample { def face(): java.time.Instant = java.time.Instant.now() }"
    violations(imported, Layer.Boundary).contains("outside-or-effectful-domain-import") &&
      violations(qualified, Layer.Boundary).isEmpty
  }

  property("AST: boundary mode still rejects Await reflection Random and Clock") = secure {
    val awaiting = "object Sample { def face(f: scala.concurrent.Future[Int]): Int = Await.result(f, scala.concurrent.duration.Duration.Inf) }"
    val reflecting = "object Sample { def face(a: Any): Int = a.asInstanceOf[Int] }"
    val randomTime = "object Sample { def face(seed: Long): Long = scala.util.Random(seed).nextLong() + java.time.Clock.systemUTC().millis() }"
    violations(awaiting, Layer.Boundary).contains("implicit-domain-time-randomness-or-mutation") &&
      violations(reflecting, Layer.Boundary).contains("reflection-or-global-domain-effect") &&
      violations(randomTime, Layer.Boundary).contains("implicit-domain-time-randomness-or-mutation")
  }
}
