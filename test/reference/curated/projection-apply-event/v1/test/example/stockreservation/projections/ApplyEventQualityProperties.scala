package example.stockreservation.projections

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths}

import scala.jdk.CollectionConverters._

import org.scalacheck.{Gen, Properties}
import org.scalacheck.Prop.forAll
import org.scalacheck.Prop.secure

import example.stockreservation.projections.quality.ScalaSourceMetrics
import example.stockreservation.projections.quality.ScalaSourceMetrics.Layer

/** 结构性质（真实提交源面）＋度量器元性质（合成源）。
  * 结构面钉住：import 面（表视图先行、判定事件序）、helper 定序与条件缺席、
  * 函数判定序、kernel 零机制 token、时钟读取只在 ts、身份解析零随机；
  * directed negative 用合成文本验证检查器判别力。
  * 元性质钉住引擎核心计数语义与本族边界增量（Instant/UUID 面、命名实参习语）。 */
object ApplyEventQualityProperties extends Properties("projection-apply-event.quality.v1") {

  private val ledgerPath = "app/example/stockreservation/application/projection/handlers/StockLedgerApplyEvent.scala"
  private val snapshotPath = "app/example/stockreservation/application/projection/handlers/StockLedgerSnapshotApplyEvent.scala"

  private val ledgerImports = Vector(
    "example.stockreservation.application.projection.repository.StockLedgerTable.StockLedgerView",
    "example.stockreservation.domain.entities.ReservationEntity.Reserved",
    "example.stockreservation.domain.entities.ReservationEntity.QuantityAdjusted",
    "example.stockreservation.domain.entities.ReservationEntity.TagUpserted",
    "example.stockreservation.domain.entities.ReservationEntity.ReservationCancelled")

  private val snapshotImports = Vector(
    "example.stockreservation.application.projection.repository.StockLedgerSnapshotTable.StockLedgerSnapshotView",
    "example.stockreservation.domain.entities.ReservationEntity.SnapshotRecorded",
    "example.stockreservation.domain.entities.ReservationEntity.SnapshotAmended")

  private val ledgerHelpers = Vector("emptyRow", "ts", "strOr", "upsertBy")
  private val snapshotHelpers = Vector("emptyRow", "ts")
  private val ledgerFunctions = Vector("onReserved", "onQuantityAdjusted", "onTagUpserted", "onReservationCancelled")
  private val snapshotFunctions = Vector("onSnapshotRecorded", "onSnapshotAmended")

  private val zeroMechanismTokens =
    Vector("Await", "???", "==== BEGIN MANUAL ====", "net.imadz.metarch", "ActorRef", "java.sql")

  private def appTexts: Map[String, String] = {
    val listing = Paths.get(sys.props("quality.sources"))
    Files.readAllLines(listing, StandardCharsets.UTF_8).asScala.toVector
      .map(_.split("\t", -1)).filter(columns => columns.length == 3)
      .map(columns => columns(0) -> new String(Files.readAllBytes(Paths.get(columns(1))), StandardCharsets.UTF_8))
      .filter(entry => entry._1.startsWith("app/")).toMap
  }

  private def importsOf(source: String): Vector[String] =
    source.split("\n").toVector.map(_.trim).filter(_.startsWith("import ")).map(_.stripPrefix("import "))

  private def defsOf(source: String, keyword: String): Vector[String] =
    source.split("\n").toVector.map(_.trim).filter(_.startsWith(keyword))
      .map(line => line.stripPrefix(keyword).takeWhile(ch => ch != '(' && ch != '[' && ch != ':').trim)

  private def clockReads(source: String): Int =
    source.split("Instant.now").length - 1

  private def importFaceIs(source: String, expected: Vector[String]): Boolean =
    importsOf(source) == expected

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

  property("structure: the import face is the table view first then judged event order") = secure {
    val texts = appTexts
    importFaceIs(texts(ledgerPath), ledgerImports) && importFaceIs(texts(snapshotPath), snapshotImports)
  }

  property("structure: helpers are emitted in fixed order per file") = secure {
    val texts = appTexts
    defsOf(texts(ledgerPath), "private def ") == ledgerHelpers &&
      defsOf(texts(snapshotPath), "private def ") == snapshotHelpers
  }

  property("structure: functions follow judged order per file") = secure {
    val texts = appTexts
    defsOf(texts(ledgerPath), "def ") == ledgerFunctions &&
      defsOf(texts(snapshotPath), "def ") == snapshotFunctions
  }

  property("structure: untriggered helpers stay absent in the snapshot family") = secure {
    val snapshot = appTexts(snapshotPath)
    !snapshot.contains("strOr(") && !snapshot.contains("upsertBy(")
  }

  property("structure: kernel files carry zero mechanism and no raw debt tokens") = secure {
    appTexts.forall { case (_, text) => zeroMechanismTokens.forall(token => !text.contains(token)) }
  }

  property("structure: the clock read stays confined to ts and identity stays deterministic") = secure {
    val texts = appTexts
    texts.forall { case (path, text) =>
      if (path.endsWith("ApplyEvent.scala")) clockReads(text) == 1 else clockReads(text) == 0
    } && !texts.values.exists(_.contains("randomUUID"))
  }

  property("structure: negative: reordered faces fail their order checks") = secure {
    val syntheticImports = "package p\n\nimport b.B\nimport a.A\n\nobject X"
    val syntheticHelpers = "object X {\n  private def strOr(s: String): String = s\n  private def ts(i: java.time.Instant): Option[java.time.Instant] = None\n}"
    !importFaceIs(syntheticImports, Vector("a.A", "b.B")) &&
      defsOf(syntheticHelpers, "private def ") == Vector("strOr", "ts") &&
      defsOf(syntheticHelpers, "private def ") != ledgerHelpers
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

  property("AST: boundary mode admits the projection Instant and UUID declared face") = secure {
    val source = "object Sample { def face(i: java.time.Instant): java.util.UUID = java.util.UUID.fromString(i.toString) }"
    scopes(source, Layer.Boundary).nonEmpty &&
      violations(source, Layer.Domain).contains("implicit-domain-time-randomness-or-mutation")
  }

  property("AST: named-argument syntax is the admitted boundary idiom that domain rejects") = secure {
    val source = "object Sample { case class R(x: Int); def face(): R = R(x = 1) }"
    scopes(source, Layer.Boundary).nonEmpty &&
      violations(source, Layer.Domain).contains("mutable-domain-state")
  }

  property("AST: boundary mode still rejects Await reflection Random and Clock") = secure {
    val awaiting = "object Sample { def face(f: scala.concurrent.Future[Int]): Int = Await.result(f, scala.concurrent.duration.Duration.Inf) }"
    val reflecting = "object Sample { def face(a: Any): Int = a.asInstanceOf[Int] }"
    val randomTime = "object Sample { def face(seed: Long): Long = scala.util.Random(seed).nextLong() + java.time.Clock.systemUTC().millis() }"
    violations(awaiting, Layer.Boundary).contains("implicit-domain-time-randomness-or-mutation") &&
      violations(reflecting, Layer.Boundary).contains("reflection-or-global-domain-effect") &&
      violations(randomTime, Layer.Boundary).contains("implicit-domain-time-randomness-or-mutation")
  }

  property("AST: boundary application files reject infrastructure imports") = secure {
    val outward = "import example.stockreservation.infrastructure.projection.Store; object Sample { def face(): Int = 1 }"
    violations(outward, Layer.Boundary, "app/x/application/projection/Handlers.scala")
      .contains("outside-or-effectful-domain-import")
  }

  property("AST: effectful import prefixes stay rejected in both directions") = secure {
    val effectful = "import java.util.HashMap; object Sample { def face(): Int = 1 }"
    violations(effectful, Layer.Boundary, "app/x/infrastructure/projection/Impl.scala")
      .contains("outside-or-effectful-domain-import") &&
      violations(effectful, Layer.Boundary, "app/x/application/projection/Handlers.scala")
        .contains("outside-or-effectful-domain-import")
  }

  property("AST: domain mode still rejects application and infrastructure imports") = secure {
    val source = "import example.stockreservation.infrastructure.projection.Store; object Sample { def face(): Int = 1 }"
    violations(source, Layer.Domain).contains("outside-or-effectful-domain-import")
  }

  property("negative: invalid syntax cannot become an empty successful report") = secure {
    ScalaSourceMetrics.analyze("broken.scala", "object {", Layer.Domain).isLeft
  }

  property("negative: mutable var and assignment stay rejected at the boundary") = secure {
    val source = "object Bad { var state = 0; def face(): Unit = { state = 1; () } }"
    violations(source, Layer.Boundary).contains("mutable-domain-state") &&
      violations(source, Layer.Domain).contains("mutable-domain-state")
  }
}
