package example.stockreservation.application.services.transactor

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths}

import scala.jdk.CollectionConverters._

import org.scalacheck.Properties
import org.scalacheck.Prop.{forAll, secure}

import example.stockreservation.application.services.transactor.StockTransferSagaModule
import example.stockreservation.application.services.transactor.quality.ScalaSourceMetrics
import example.stockreservation.application.services.transactor.quality.ScalaSourceMetrics.Layer

/** 结构性质（真实提交源面）＋度量器元性质（合成源）。
  * 结构面钉住：模块 import 面／常量字面量／合同声明序／六相位块序与端口护栏序、
  * 单收据双槽读取、Host 成员序、definition/behavior 形状、akka 与 strict runtime
  * 的文件白名单、命名 CamelCase 与 wire ID 不动、100 列版式、供给纯度。
  * 元性质钉住引擎计数语义、E2b 上下文规则、NewAnonymous 判别（E1 命名化裁定依据）
  * 与本族边界分层判定。 */
object SagaModuleQualityProperties extends Properties("strict-saga-module.quality.v1") {
  import SagaModuleOracle._

  private val modulePath =
    "app/example/stockreservation/application/services/transactor/StockTransferSagaModule.scala"
  private val commandPath = "app/example/stockreservation/application/aggregates/StockOrderProtocol.scala"
  private val eventsPath = "app/example/stockreservation/domain/events/StockWarehouseEvents.scala"
  private val idSupplyPath = "app/net/imadz/common/Id.scala"

  private def appTexts: Map[String, String] = {
    val listing = Paths.get(sys.props("quality.sources"))
    Files.readAllLines(listing, StandardCharsets.UTF_8).asScala.toVector
      .map(_.split("\t", -1)).filter(columns => columns.length == 3)
      .map(columns => columns(0) -> new String(Files.readAllBytes(Paths.get(columns(1))),
        StandardCharsets.UTF_8))
      .filter(entry => entry._1.startsWith("app/")).toMap
  }

  private def module: String = appTexts(modulePath)

  private def importsOf(source: String): Vector[String] =
    source.split("\n").toVector.map(_.trim).filter(_.startsWith("import "))
      .map(_.stripPrefix("import "))

  private def indexIn(source: String, marker: String): Int =
    source.split("\n").indexWhere(_.contains(marker))

  private def orderedMarkers(source: String, markers: Vector[String]): Boolean = {
    val indices = markers.map(indexIn(source, _))
    indices.forall(index => index >= 0) && indices == indices.sorted
  }

  private def countOf(source: String, marker: String): Int =
    source.split("\n").count(_.contains(marker))

  private def sliceBetween(source: String, from: String, until: String): String = {
    val lines = source.split("\n")
    val start = lines.indexWhere(_.contains(from))
    val end = lines.indexWhere(_.contains(until), start + 1)
    require(start >= 0 && end > start, "slice markers must exist in order")
    lines.slice(start, end).mkString("\n")
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

  private val moduleImports = Vector(
    "akka.actor.typed.{ActorRef, Behavior}",
    "akka.persistence.typed.PersistenceId",
    "example.stockreservation.application.aggregates.TransferStockCommand",
    "example.stockreservation.domain.events.{StockReceivedEvent, StockTransferCompletedEvent}",
    "net.imadz.infra.saga.strict._",
    "scala.concurrent.{ExecutionContext, Future}",
    "scala.util.Try")

  property("structure: the module import face is the judged dynamic and fixed order") = secure {
    importsOf(module) == moduleImports
  }

  property("structure: the honest candidate header comment is preserved verbatim") = secure {
    val header = sliceBetween(module, "/** Generated/buildable candidate", "object StockTransferSagaModule")
    header.contains("NOT runtime verified") &&
      header.contains("No production dependency is selected") &&
      header.contains("FQN is not an ABI") &&
      header.contains("Upstream blocked/readiness flags are not rewritten")
  }

  property("structure: the upstream identity constants are emitted in raw order with frozen values") = secure {
    orderedMarkers(module, Vector("val name = ", "val version = ", "val definitionDigest = ",
      "val argsPin = ", "val candidateArtifact = ", "val artifactStatus = ",
      "val upstreamRunnable = ", "val upstreamRuntimeBindingVerified = ",
      "val upstreamBlocked = ")) &&
      Vector("val name = \"stock-transfer\"", "val version = 1",
        s"val definitionDigest = \"$digest\"",
        "val argsPin = CodecPin(\"stock-transfer-args\", 1)",
        "val candidateArtifact = \"StockTransferSagaModule\"",
        "val artifactStatus = \"generated\"", "val upstreamRunnable = true",
        "val upstreamRuntimeBindingVerified = true",
        "val upstreamBlocked = Vector()").forall(marker => module.contains(marker))
  }

  property("structure: Args and TriggerStart carry the raw shapes with camelized slots") = secure {
    orderedMarkers(module, Vector("final case class Args(", "final case class TriggerStart(",
      "final case class AddressContract(")) &&
      orderedMarkers(module, Vector("sourceWarehouseId: java.util.UUID",
        "targetWarehouseId: java.util.UUID", "sku: String", "quantity: Int",
        "transferMode: String"))
  }

  property("structure: the address contracts are emitted in payload participant order") = secure {
    orderedMarkers(module, Vector(
      "val sourceWarehouseResourceContract = AddressContract(",
      "val targetWarehouseResourceContract = AddressContract(")) &&
      StockTransferSagaModule.sourceWarehouseResourceContract == expectedSourceAddress &&
      StockTransferSagaModule.targetWarehouseResourceContract == expectedTargetAddress
  }

  property("structure: the technical contract case classes are emitted in raw order") = secure {
    orderedMarkers(module, Vector("final case class ValueSource(", "final case class SlotContract(",
      "final case class InputContract(", "final case class ConfirmationContract(",
      "final case class QueryContract(", "final case class ReceiptContract(",
      "final case class IdempotencyContract(", "final case class PhaseContract(",
      "final case class TriggerContract(", "final case class CompletionContract(",
      "final case class TypeContract(", "sealed trait ValueShape"))
  }

  property("structure: the value shape family emits exactly the five exercised shapes") = secure {
    orderedMarkers(module, Vector("final case class BoundedText(", "case object BooleanShape",
      "final case class IntegerShape(", "final case class EnumerationShape(",
      "final case class ValueObjectShape(", "final case class MoneyShape(")) &&
      !module.contains("final case class SequenceShape") &&
      !module.contains("final case class ManifestRefShape")
  }

  property("structure: requiredTypes is emitted in the declared type registry order") = secure {
    orderedMarkers(module, Vector(
      "TypeContract(\"transaction-id\"",
      "\"warehouse-id\", \"WarehouseId\", \"net.imadz.common.CommonTypes.Id\", BoundedText(\"id\", 36, 36))",
      "TypeContract(\"sku\"", "TypeContract(\"quantity\"",
      "TypeContract(\"transfer-mode\"",
      "\"transfer-id\", \"TransferId\", \"net.imadz.common.CommonTypes.Id\", BoundedText(\"id\", 36, 36)))"))
  }

  property("structure: requiredArgsCodec and requiredHost equal the frozen oracle contracts") = secure {
    StockTransferSagaModule.requiredArgsCodec == expectedArgsCodec &&
      StockTransferSagaModule.requiredHost == expectedHostRequirements
  }

  property("structure: each phase block orders input, receipt, contract, binding, port and def") = secure {
    orderedMarkers(module, Vector(
      "final case class ReserveSourceStockPrepareInput(",
      "final case class ReserveSourceStockPrepareReceipt(",
      "val reserveSourceStockPrepareBindingContract: PhaseContract",
      "trait ReserveSourceStockPrepareHostBinding",
      "private final class ReserveSourceStockPreparePort(",
      "private def reserveSourceStockPrepareBindingPort(host: Host)(")) &&
      orderedMarkers(module, Vector(
        "final case class CommitTargetStockPrepareInput(",
        "final case class CommitTargetStockPrepareReceipt(",
        "val commitTargetStockPrepareBindingContract: PhaseContract",
        "trait CommitTargetStockPrepareHostBinding",
        "private final class CommitTargetStockPreparePort(",
        "private def commitTargetStockPrepareBindingPort(host: Host)("))
  }

  property("structure: the phase blocks are emitted in schedule prepare order") = secure {
    orderedMarkers(module, Vector(
      "final case class ReserveSourceStockPrepareInput(",
      "final case class ReserveSourceStockCommitInput(",
      "final case class ReserveSourceStockCompensateInput(",
      "final case class CommitTargetStockPrepareInput(",
      "final case class CommitTargetStockCommitInput(",
      "final case class CommitTargetStockCompensateInput("))
  }

  property("structure: the receipt pins are frozen with one non-one version") = secure {
    Vector(
      ("stock-transfer-reserve-source-stock-prepare", 1, 5),
      ("stock-transfer-commit-target-stock-prepare", 2, 4),
      ("stock-transfer-reserve-source-stock-commit", 1, 2),
      ("stock-transfer-commit-target-stock-commit", 1, 2),
      ("stock-transfer-reserve-source-stock-compensate", 1, 2),
      ("stock-transfer-commit-target-stock-compensate", 1, 2)).forall { case (pinId, version, expected) =>
      countOf(module, s"CodecPin(\"$pinId\", $version)") == expected
    }
  }

  property("structure: every phase port re-checks codec identity and contract drift on each read") = secure {
    Vector(
      "require(binding.receiptCodec eq codec, \"host receipt codec replacement\")",
      "\"technical phase binding drift\"",
      "def querySafety: QuerySafety = binding.querySafety",
      "Future.fromTry(Try {",
      "\"consumer identity mismatch\"",
      "\"read-only durable query required\"").forall(marker => countOf(module, marker) == 6)
  }

  property("structure: step-two prepare reads one producer receipt for two input slots") = secure {
    val port = sliceBetween(module, "private final class CommitTargetStockPreparePort(",
      "private def commitTargetStockPrepareBindingPort(host: Host)(")
    countOf(port, "request.receipt(") == 1 &&
      countOf(port, "reserveSourceStockPrepare0.reservedQuantity") == 1 &&
      countOf(port, "reserveSourceStockPrepare0.reservationId") == 1 &&
      countOf(module, "val reserveSourceStockPrepare0 = request.receipt(") == 3 &&
      countOf(module, "val commitTargetStockPrepare0 = request.receipt(") == 2
  }

  property("structure: the host declares addresses then phase bindings then triggers then completion") = secure {
    orderedMarkers(module, Vector(
      "def sourceWarehouseResource(resource: java.util.UUID): String",
      "def reserveSourceStockPrepareBinding: ReserveSourceStockPrepareHostBinding",
      "def commitTargetStockCompensateBinding: CommitTargetStockCompensateHostBinding",
      "def transferStockRequestedTrigger: TransferStockRequestedTriggerBinding",
      "def warehouseStockReceivedTrigger: WarehouseStockReceivedTriggerBinding",
      "def succeededCompletion: SucceededCompletionBinding")) &&
      orderedMarkers(module, Vector("def argsCodec: PayloadCodec[Args]",
        "def settings: StrictSagaCoordinator.Settings",
        "def requireImplemented(", "def requireIndependentNamespace("))
  }

  property("structure: checkedArgsCodec guards host, implementation, addresses and pin in order") = secure {
    orderedMarkers(module, Vector(
      "require(host != null && host.argsCodec != null, \"host canonical args codec required\")",
      "host.requireImplemented(requiredHost, requiredTypes, requiredArgsCodec)",
      "host.sourceWarehouseResourceContract == sourceWarehouseResourceContract",
      "host.targetWarehouseResourceContract == targetWarehouseResourceContract",
      "require(codec.pin == argsPin, \"args codec pin mismatch\")"))
  }

  property("structure: trigger blocks keep the whole-typed-trigger comment and start guard order") = secure {
    countOf(module, "// Whole typed trigger, including the explicit idempotency source; never first/drop remaining.") == 2 &&
      orderedMarkers(module, Vector(
        "val transferStockRequestedTriggerContract = TriggerContract(",
        "trait TransferStockRequestedTriggerBinding",
        "def transferStockRequestedTriggerStart(",
        "val warehouseStockReceivedTriggerContract = TriggerContract(",
        "trait WarehouseStockReceivedTriggerBinding",
        "def warehouseStockReceivedTriggerStart(")) &&
      countOf(module, "\"saga-version\", \"reject-different-args\")") == 2
  }

  property("structure: the completion block is map-only with the explicit publication comment") = secure {
    orderedMarkers(module, Vector("final case class SucceededCompletionInput(",
      "val succeededCompletionContract = CompletionContract(",
      "trait SucceededCompletionBinding",
      "def succeededCompletionEvent(")) &&
      module.contains("// Explicit mapping only: the host must observe the matching durable result and") &&
      module.contains("// publish idempotently.")
  }

  property("structure: definition builds participants in prepare order with phase maps in TCC order") = secure {
    orderedMarkers(module, Vector(
      "StrictSagaDefinition[Args](name, version, definitionDigest, codec, args => Vector(",
      "host.sourceWarehouseResource(args.sourceWarehouseId),",
      "Phase.Prepare -> PhaseBinding(reserveSourceStockPrepareBindingPort(host))",
      "Phase.Commit -> PhaseBinding(reserveSourceStockCommitBindingPort(host))",
      "Phase.Compensate -> PhaseBinding(reserveSourceStockCompensateBindingPort(host))",
      "host.targetWarehouseResource(args.targetWarehouseId),",
      "Phase.Prepare -> PhaseBinding(commitTargetStockPrepareBindingPort(host))",
      "Phase.Commit -> PhaseBinding(commitTargetStockCommitBindingPort(host))",
      "Phase.Compensate -> PhaseBinding(commitTargetStockCompensateBindingPort(host))"))
  }

  property("structure: behavior guards pid and authorizer then namespace then timeout pin") = secure {
    orderedMarkers(module, Vector(
      "require(persistenceId != null && authorizer != null,",
      "host.requireIndependentNamespace(persistenceId)",
      "val settings = host.settings",
      "require(settings != null && settings.interactionTimeout.toMillis == 1000,",
      "StrictSagaCoordinator(persistenceId, definition(host), authorizer, settings)"))
  }

  property("structure: akka and the strict runtime import only in the module file") = secure {
    val akkaFiles = appTexts.filter { case (_, text) =>
      importsOf(text).exists(importName => importName.startsWith("akka."))
    }
    val strictFiles = appTexts.filter { case (_, text) =>
      importsOf(text).exists(importName => importName.startsWith("net.imadz.infra.saga"))
    }
    akkaFiles.keySet == Set(modulePath) && strictFiles.keySet == Set(modulePath)
  }

  property("structure: the domain supply stays pure and the command supply imports only the identity face") = secure {
    importsOf(appTexts(eventsPath)) == Vector("net.imadz.common.CommonTypes.Id") &&
      importsOf(appTexts(commandPath)) == Vector("net.imadz.common.CommonTypes.Id") &&
      appTexts(eventsPath).contains("final case class StockReceivedEvent(") &&
      appTexts(eventsPath).contains("final case class StockTransferCompletedEvent(") &&
      appTexts(commandPath).contains("final case class TransferStockCommand(")
  }

  property("structure: no app source imports a banned prefix and the identity face is fully qualified") = secure {
    val banned = Vector("java.io", "java.nio", "java.time", "java.util",
      "scala.collection.mutable", "java.sql")
    val allImports = appTexts.values.flatMap(importsOf).toVector
    allImports.forall(importName => !banned.exists(prefix => importName.startsWith(prefix))) &&
      countOf(module, "java.util.UUID") >= 10 &&
      !module.contains("import java.util.UUID")
  }

  property("structure: app sources carry no reflection or global effect tokens") = secure {
    val tokens = Vector("getClass", "asInstanceOf", "System.", "Thread.", "Await.", "???")
    appTexts.values.forall(text => !tokens.exists(token => text.contains(token)))
  }

  property("structure: every app source line stays inside the 100 column layout") = secure {
    appTexts.values.forall(text => text.split("\n").toVector
      .forall(line => line.startsWith("import ") || line.length <= 100))
  }

  property("structure: the module lands on the approved three-layer transactor path") = secure {
    val declared = appTexts.keySet(modulePath) &&
      module.startsWith("package example.stockreservation.application.services.transactor")
    declared && module.contains("object StockTransferSagaModule {") &&
      !module.contains("_Resource") && !module.contains("Reserve_source")
  }

  property("structure: the camelCase member composition keeps raw wire ids untouched") = secure {
    orderedMarkers(module, Vector(
      "val reserveSourceStockPrepareBindingContract",
      "trait ReserveSourceStockPrepareHostBinding",
      "def reserveSourceStockPrepareBindingPort",
      "val transferStockRequestedTriggerContract", "def transferStockRequestedTriggerStart",
      "val succeededCompletionContract", "def succeededCompletionEvent")) &&
      countOf(module, "\"reserve-source-stock\"") == 14 &&
      countOf(module, "\"commit-target-stock\"") == 11
  }

  property("engine: infix conjunction adds one decision per operator and match adds one per case") = secure {
    method("if (a && b && c) 1 else 0").counts.complexity == 4 &&
      method("a match { case x => 1 case _ => 0 }").counts.complexity == 2 &&
      method("a match { case x => 1 case y => 2 case _ => 0 }").counts.complexity == 3
  }

  property("engine: e2b admits named arguments in call clauses and rejects real assignments") = secure {
    val named = scopesOf("object S {\n  case class P(a: Int, b: Int)\n  def f(p: P): Int = f(P(b = 1, a = 2))\n}",
      Layer.Boundary)
    named.nonEmpty && violations("object S {\n  var v: Int = 0\n  def f(): Int = { v = 1; v }\n}",
      Layer.Boundary).contains("mutable-domain-state")
  }

  property("engine: anonymous implementations are unsupported terms at every layer") = secure {
    violations("object S { def f(): java.lang.Runnable = new java.lang.Runnable { def run(): Unit = () } }",
      Layer.Support).contains("unsupported-term:Term.NewAnonymous") &&
      violations("object S { def f(): java.lang.Runnable = new java.lang.Runnable { def run(): Unit = () } }",
      Layer.Boundary).contains("unsupported-term:Term.NewAnonymous")
  }

  property("engine: y2 boundary admits the module face and still bans the effectful prefixes") = secure {
    val moduleLayer = ScalaSourceMetrics.analyze(modulePath, module, Layer.Boundary)
      .fold(error => throw new IllegalArgumentException(error), identity)
    moduleLayer.violations.isEmpty && moduleLayer.scopes.nonEmpty &&
      violations("import java.util.UUID\nobject S { val v: UUID = null }",
        Layer.Boundary, "app/x/Module.scala").contains("outside-or-effectful-domain-import") &&
      violations("import net.imadz.infrastructure.other.Thing\nobject S { val v: Thing = null }",
        Layer.Boundary, "app/y/application/Module.scala")
        .contains("outside-or-effectful-domain-import")
  }

  property("engine: support sources skip structural checks but never skip the unsupported-term gate") = secure {
    val support = ScalaSourceMetrics.analyze("test/ProbeHost.scala",
      "object S {\n  var v: Int = 1\n  def f(): Int = { v = 2; v }\n}", Layer.Support)
      .fold(error => throw new IllegalArgumentException(error), identity)
    support.violations.isEmpty && support.scopes.nonEmpty &&
      violations("object S { def f(): java.lang.Runnable = new java.lang.Runnable { def run(): Unit = () } }",
        Layer.Support).contains("unsupported-term:Term.NewAnonymous")
  }

  property("engine: domain layer rejects outward imports and future and uuid term names") = secure {
    violations("import example.stockreservation.application.aggregates.TransferStockCommand\nobject S { val v: TransferStockCommand = null }",
      Layer.Domain, "app/z/domain/S.scala").contains("outside-or-effectful-domain-import") &&
      violations("import scala.concurrent.Future\nimport java.util.UUID\nobject S { def f(): Future[UUID] = Future.successful(UUID.randomUUID()) }",
        Layer.Domain).contains("implicit-domain-time-randomness-or-mutation")
  }

  property("structure: the frozen definition digest is the sha256 of the semantic payload bytes") = secure {
    val payload = java.nio.file.Files.readAllBytes(Paths.get(sys.props("quality.semantic")))
    val hex = java.security.MessageDigest.getInstance("SHA-256").digest(payload)
      .map(b => f"$b%02x").mkString
    StockTransferSagaModule.definitionDigest == "sha256:" + hex
  }

  property("engine: the whole committed app face analyzes clean at its declared layers") = secure {
    val layers = Map(modulePath -> Layer.Boundary, commandPath -> Layer.Boundary,
      eventsPath -> Layer.Domain, idSupplyPath -> Layer.Support)
    val clean = appTexts.toVector.forall { case (relative, text) =>
      val report = ScalaSourceMetrics.analyze(relative, text,
        layers.getOrElse(relative, Layer.Support))
        .fold(error => throw new IllegalArgumentException(error), identity)
      report.violations.isEmpty && report.scopes.nonEmpty
    }
    clean && appTexts.size == 4
  }
}
