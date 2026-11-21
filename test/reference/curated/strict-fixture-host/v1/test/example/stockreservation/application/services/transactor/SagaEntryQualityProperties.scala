package example.stockreservation.application.services.transactor

import example.stockreservation.application.services.transactor.quality.ScalaSourceMetrics
import example.stockreservation.application.services.transactor.quality.ScalaSourceMetrics.Layer
import java.nio.file.{Files, Paths}
import org.scalacheck.Prop.secure
import org.scalacheck.Properties

/** 结构/引擎元合同：布局路径、import 面白名单、frozen 字面量、命名类纪律（E1）、
  * 上游模块字节身份（W8 式 sha256 复核）、引擎计数语义、E2b、Y2、域方向与
  * 全 app 面分层净检。全部 secure＝单次评估 Proved。 */
object SagaEntryQualityProperties extends Properties("strict-fixture-host.quality.v1") {
  import SagaEntryOracle._

  private val modulePath = "application/services/transactor/StockTransferSagaModule.scala"
  private val orderPath = "application/aggregates/StockOrderProtocol.scala"
  private val warehouseProtocolPath = "application/aggregates/WarehouseProtocol.scala"
  private val warehouseEntityPath = "domain/entities/WarehouseEntity.scala"
  private val phaseEventsPath = "domain/events/WarehousePhaseEvents.scala"
  private val warehouseEventsPath = "domain/events/StockWarehouseEvents.scala"
  private val typesPath = "application/services/transactor/types.scala"
  private val wirePath = "application/services/transactor/StrictWire.scala"
  private val argsCodecPath = "application/services/transactor/StockTransferArgsCodec.scala"
  private val hostPath = "application/services/transactor/FixtureHost.scala"
  private val entryPath = "application/services/transactor/StockTransferSagaEntry.scala"
  private val idPath = "net/imadz/common/Id.scala"

  private val appPaths: Vector[String] = Vector(
    modulePath, orderPath, warehouseProtocolPath, warehouseEntityPath, phaseEventsPath,
    warehouseEventsPath, typesPath, wirePath, argsCodecPath, hostPath, entryPath)

  // The gate JVM runs with the attempt directory as cwd; the frozen candidate
  // root arrives through -Dquality.candidate so every structure property reads
  // the pinned source bytes regardless of the working directory.
  private val candidateRoot = Paths.get(sys.props("quality.candidate"))

  private def readApp(relative: String): String = {
    val base = if (relative.startsWith("net/"))
      candidateRoot.resolve("app").resolve(relative)
    else candidateRoot.resolve("app/example/stockreservation").resolve(relative)
    new String(Files.readAllBytes(base.toAbsolutePath()), "UTF-8")
  }

  private def importsOf(path: String): Vector[String] =
    readApp(path).linesIterator.filter(_.trim.startsWith("import ")).toVector

  private def freeOfReflectionTokens(text: String): Boolean =
    !text.contains("asInstanceOf") && !text.contains("getClass") && freeOfGlobalTokens(text)

  private def freeOfGlobalTokens(text: String): Boolean =
    !text.contains("System.") && !text.contains("Thread.") && !text.contains(".randomUUID") &&
      !text.contains("Await.")

  private def entryOnlyFaces(): Boolean = {
    val entryImports = importsOf(entryPath)
    val streamFace = Vector("akka.stream.", "akka.contrib.persistence.mongodb",
      "akka.cluster.typed.")
    entryImports.exists(_.contains("akka.contrib.persistence.mongodb")) &&
      entryImports.exists(_.contains("akka.persistence.query")) &&
      streamFace.forall(token => entryImports.exists(_.contains(token))) &&
      appPaths.filterNot(_ == entryPath).forall { path =>
        val imports = importsOf(path)
        !streamFace.exists(token => imports.exists(_.contains(token)))
      }
  }

  private def wireFace(): Boolean = {
    val text = readApp(wirePath)
    Vector("implicit final class StrictWireOps", "extends AnyVal", "def lengthPrefixedAll",
      "def readPrefixedAll", "CodingErrorAction.REPORT").forall(text.contains) &&
      !text.contains("var ") && !text.contains("while")
  }

  private def entryFaces(): Boolean = {
    val text = readApp(entryPath)
    Vector("val NamespacePrefix = \"strict-saga\"",
      "PersistenceId.ofUniqueId(s\"$NamespacePrefix/", "def spawn(").forall(token =>
        text.contains(token)) &&
      Vector("def spawnClusterSingleton(", "def installEventSource(", "def status(",
        "def completionEvent(", "def publishCompletion(",
        "final case class FixtureReconcileAuthorizer", "MessageDigest.isEqual",
        "fixture-reconciler").forall(token => text.contains(token))
  }

  private def violations(text: String, layer: Layer, file: String = "sample.scala"
  ): Set[String] =
    ScalaSourceMetrics.analyze(file, text, layer).toOption.get.violations.map(_.reason).toSet

  private def scopesOf(text: String, layer: Layer): Vector[ScalaSourceMetrics.Scope] = {
    val report = ScalaSourceMetrics.analyze("sample.scala", text, layer)
      .fold(error => throw new IllegalArgumentException(error), identity)
    require(report.violations.isEmpty, report.violations.toString)
    report.scopes
  }

  private def method(text: String, layer: Layer = Layer.Support): ScalaSourceMetrics.Scope =
    scopesOf(s"object Sample { def choose(a: Boolean): Int = $text }", layer)
      .find(_.kind == "method").getOrElse(throw new IllegalArgumentException("Missing method"))

  property("structure: the app tree lands on the approved fixture paths exactly") = secure {
    val present = (appPaths.map("app/example/stockreservation/" + _) :+
      "app/" + idPath).forall(p => Files.exists(candidateRoot.resolve(p)))
    present && appPaths.size == 11
  }

  property("structure: the upstream module is consumed byte-identical to the approved golden") =
    secure {
      val bytes = Files.readAllBytes(
        candidateRoot.resolve("app/example/stockreservation/" + modulePath))
      java.security.MessageDigest.getInstance("SHA-256").digest(bytes)
        .map(b => f"$b%02x").mkString == upstreamModuleSha256
    }

  property("structure: akka imports appear only in module, protocol, host and entry faces") =
    secure {
      val akkaFaces = Set(modulePath, warehouseProtocolPath, hostPath, entryPath)
      appPaths.forall { path =>
        val imports = readApp(path).linesIterator.filter(_.trim.startsWith("import "))
        if (akkaFaces.contains(path)) true
        else !imports.exists(_.contains("akka."))
      } && readApp(modulePath).contains("import akka.actor.typed.")
    }

  property("structure: the strict runtime imports only in module, codec, host and entry faces") =
    secure {
      val strictFaces = Set(modulePath, argsCodecPath, hostPath, entryPath)
      appPaths.forall { path =>
        val imports = readApp(path).linesIterator.filter(_.trim.startsWith("import "))
        if (strictFaces.contains(path)) true
        else !imports.exists(_.contains("net.imadz.infra.saga"))
      }
    }

  property("structure: the mongo read journal and stream face live only in the entry") = secure {
    entryOnlyFaces()
  }

  property("structure: the protobuf ByteString import stays in the wire faces") = secure {
    val wireFaces = Set(wirePath, argsCodecPath, hostPath)
    wireFaces.forall(path => readApp(path).contains("import com.google.protobuf.ByteString")) &&
      appPaths.filterNot(wireFaces.contains).forall { path =>
        !readApp(path).linesIterator.exists(_.contains("com.google.protobuf"))
      }
  }

  property("structure: every app source line stays inside the 100 column layout") = secure {
    (appPaths.map(readApp) :+ readApp(idPath)).flatMap { text =>
      text.linesIterator.zipWithIndex.collect { case (line, index) if line.length > 100 =>
        index + 1 }
    }.isEmpty
  }

  property("structure: no app source carries reflection or global effect tokens") = secure {
    (appPaths.map(readApp) :+ readApp(idPath)).forall(freeOfReflectionTokens)
  }

  property("structure: the domain supplies stay pure with zero akka and runtime imports") = secure {
    Vector(warehouseEntityPath, phaseEventsPath, warehouseEventsPath).forall { path =>
      val text = readApp(path)
      val imports = text.linesIterator.filter(_.trim.startsWith("import ")).toVector
      imports.nonEmpty && !imports.exists(l =>
        l.contains("akka.") || l.contains("net.imadz.infra.saga")) &&
        !text.contains("Future") && !text.contains("var ")
    }
  }

  property("structure: warehouse commands name the six module phase commands verbatim") = secure {
    val text = readApp(warehouseProtocolPath)
    Vector("ReserveStock(", "CommitStock(", "ReleaseStock(", "PlaceStockOrder(",
      "SettleStockOrder(", "CancelStockOrder(").forall(text.contains) &&
      text.contains("EntityTypeKey[WarehouseCommand](\"warehouse\")") &&
      Vector("final case class GetWarehouseState(", "final case class RecordTransferCompleted(")
        .forall(text.contains)
  }

  property("structure: the warehouse event family carries the eight journal records") = secure {
    val text = readApp(phaseEventsPath)
    Vector("StockReserved(", "StockCommitted(", "StockReleased(", "StockOrderPlaced(",
      "StockOrderSettled(", "StockOrderCancelled(", "StockRestocked(",
      "TransferCompletedRecorded(").forall(text.contains) &&
      text.contains("sealed trait WarehouseReservationEvent") &&
      text.contains("sealed trait WarehouseOrderEvent")
  }

  property("structure: the wire object carries the raw no-money branch constructs") = secure {
    wireFace()
  }

  property("structure: the args codec pins the module pin literal with five text slots") = secure {
    val text = readApp(argsCodecPath)
    text.contains("CodecPin(\"stock-transfer-args\", 1)") &&
      text.contains("PayloadCodec[StockTransferSagaModule.Args]") &&
      text.contains(trailingMessage) && text.contains("StrictWire.readPrefixed(bytes, 5)")
  }

  property("structure: six named receipt codec classes pin the frozen codec ids in order") = secure {
    val text = readApp(hostPath)
    Vector(
      "private final class ReserveSourceStockPrepareReceiptCodec",
      "private final class ReserveSourceStockCommitReceiptCodec",
      "private final class ReserveSourceStockCompensateReceiptCodec",
      "private final class CommitTargetStockPrepareReceiptCodec",
      "private final class CommitTargetStockCommitReceiptCodec",
      "private final class CommitTargetStockCompensateReceiptCodec")
      .forall(text.contains) &&
      text.contains("CodecPin(\"stock-transfer-commit-target-stock-prepare\", 2)") &&
      Vector(reservePreparePin.id, reserveCommitPin.id, reserveCompensatePin.id,
        targetPreparePin.id, targetCommitPin.id, targetCompensatePin.id)
        .forall(id => text.contains("\"" + id + "\""))
  }

  property("structure: six named binding classes and named trigger and completion classes") =
    secure {
      val text = readApp(hostPath)
      Vector(
        "private final class ReserveSourceStockPrepareBinding",
        "private final class ReserveSourceStockCommitBinding",
        "private final class ReserveSourceStockCompensateBinding",
        "private final class CommitTargetStockPrepareBinding",
        "private final class CommitTargetStockCommitBinding",
        "private final class CommitTargetStockCompensateBinding",
        "private final class TransferStockRequestedTrigger",
        "private final class WarehouseStockReceivedTrigger",
        "private final class SucceededCompletionMapper").forall(text.contains) &&
        text.contains("extends ReserveSourceStockPrepareHostBinding") &&
        text.contains("extends SucceededCompletionBinding")
    }

  property("structure: the host declares the ten fixed capabilities and one invariant") = secure {
    val text = readApp(hostPath)
    supportedCapabilities.forall(cap => text.contains("\"" + cap + "\"")) &&
      declaredInvariants.forall(inv => text.contains("\"" + inv + "\"")) &&
      text.contains("val SupportedCapabilities: Set[String]") &&
      text.contains("val DeclaredInvariants: Set[String]")
  }

  property("structure: the host guards the eight safety wiring literals") = secure {
    val text = readApp(hostPath)
    Vector("durable-before-commit", "durable-before-compensate", "forward-recovery",
      "reconcile-before-resume", "confirmed-reservations", "empty-release-and-fence",
      "stable-operation", "authorized-reconciliation-evidence").forall(text.contains) &&
      text.contains("requirements.durableManifest") &&
      text.contains("positive budget required")
  }

  property("structure: host interactions derive every ask from the identity resource") = secure {
    val text = readApp(hostPath)
    Vector.fill(1)(text).exists(t =>
      "warehouseReplyAsk\\(identity\\.resource".r.findAllIn(t).size == 6 &&
        "warehouseStateAsk\\(identity\\.resource".r.findAllIn(t).size == 6)
  }

  property("structure: the entry declares namespace, spawn faces, event source and authorizer") =
    secure {
      entryFaces()
    }

  property("structure: the entry publication resolves the first-step resource via the host") =
    secure {
      val text = readApp(entryPath)
      text.contains("host.sourceWarehouseResource(args.sourceWarehouseId)") &&
        text.contains("RecordTransferCompleted(completed.transactionId, replyTo)")
    }

  property("structure: the identity supply stays in the shared common path") = secure {
    Files.exists(candidateRoot.resolve("app/net/imadz/common/Id.scala")) &&
      readApp(idPath).contains("type Id = java.util.UUID")
  }

  property("engine: infix conjunction adds one decision per operator and match adds one per case") =
    secure {
      method("if (a && b && c) 1 else 0").counts.complexity == 4 &&
        method("a match { case x => 1 case _ => 0 }").counts.complexity == 2 &&
        method("a match { case x => 1 case y => 2 case _ => 0 }").counts.complexity == 3
    }

  property("engine: e2b admits named arguments in call clauses and rejects real assignments") =
    secure {
      val named = scopesOf(
        "object S {\n  case class P(a: Int, b: Int)\n  def f(p: P): Int = f(P(b = 1, a = 2))\n}",
        Layer.Boundary)
      named.nonEmpty &&
        violations("object S {\n  var v: Int = 0\n  def f(): Int = { v = 1; v }\n}",
          Layer.Boundary).contains("mutable-domain-state")
    }

  property("engine: anonymous implementations are unsupported terms at every layer") = secure {
    violations("object S { def f(): java.lang.Runnable = new java.lang.Runnable { def run(): Unit = () } }",
      Layer.Support).contains("unsupported-term:Term.NewAnonymous") &&
      violations("object S { def f(): java.lang.Runnable = new java.lang.Runnable { def run(): Unit = () } }",
        Layer.Boundary).contains("unsupported-term:Term.NewAnonymous")
  }

  property("engine: the boundary face admits akka and strict while banning effectful prefixes") =
    secure {
      val hostLayer = ScalaSourceMetrics.analyze(hostPath, readApp(hostPath), Layer.Boundary)
        .fold(error => throw new IllegalArgumentException(error), identity)
      hostLayer.violations.isEmpty && hostLayer.scopes.nonEmpty &&
        violations("import java.util.UUID\nobject S { val v: UUID = null }",
          Layer.Boundary, "app/x/Module.scala").contains("outside-or-effectful-domain-import") &&
        violations("import net.imadz.infrastructure.other.Thing\nobject S { val v: Thing = null }",
          Layer.Boundary, "app/y/application/Module.scala")
          .contains("outside-or-effectful-domain-import")
    }

  property("engine: support sources skip structural checks but never skip the unsupported-term gate") =
    secure {
      val support = ScalaSourceMetrics.analyze("test/SagaEntryFixture.scala",
        "object S {\n  var v: Int = 1\n  def f(): Int = { v = 2; v }\n}", Layer.Support)
        .fold(error => throw new IllegalArgumentException(error), identity)
      support.violations.isEmpty && support.scopes.nonEmpty &&
        violations("object S { def f(): java.lang.Runnable = new java.lang.Runnable { def run(): Unit = () } }",
          Layer.Support).contains("unsupported-term:Term.NewAnonymous")
    }

  property("engine: domain layer rejects outward imports and future and uuid term names") = secure {
    violations(
      "import example.stockreservation.application.aggregates.TransferStockCommand\nobject S { val v: TransferStockCommand = null }",
      Layer.Domain, "app/z/domain/S.scala").contains("outside-or-effectful-domain-import") &&
      violations(
        "import scala.concurrent.Future\nimport java.util.UUID\nobject S { def f(): Future[UUID] = Future.successful(UUID.randomUUID()) }",
        Layer.Domain).contains("implicit-domain-time-randomness-or-mutation")
  }

  property("engine: the whole committed app face analyzes clean at its declared layers") = secure {
    val layers = Map(
      modulePath -> Layer.Boundary, orderPath -> Layer.Boundary,
      warehouseProtocolPath -> Layer.Boundary, warehouseEntityPath -> Layer.Domain,
      phaseEventsPath -> Layer.Domain, warehouseEventsPath -> Layer.Domain,
      typesPath -> Layer.Boundary, wirePath -> Layer.Boundary,
      argsCodecPath -> Layer.Boundary, hostPath -> Layer.Boundary,
      entryPath -> Layer.Boundary)
    val clean = appPaths.forall { path =>
      val report = ScalaSourceMetrics.analyze(path, readApp(path), layers(path))
        .fold(error => throw new IllegalArgumentException(error), identity)
      report.violations.isEmpty && (report.scopes.nonEmpty ||
        path == typesPath) // the alias-only types object has no executable scopes
    }
    clean && appPaths.size == 11
  }
}
