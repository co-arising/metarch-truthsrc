package example.stockreservation.application.services.transactor

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths}
import org.scalacheck.Prop.secure
import org.scalacheck.Properties
import scala.meta._
import StrictWire._
import scala.meta.parsers._
import scala.meta.prettyprinters._
/** 结构/引擎元合同（Support 层）：布局路径、上游字节身份、语义 payload digest、
  * 模块孪生、import 白名单、F11 四 var 槽白名单、观察端口面、引擎计数语义、
  * 分层违规、收据 pin 锁定、两 suite 编译面登记。 */
object CompositionQualityProperties extends Properties("composition-invocation-host.quality.v1") {
  import CompositionOracle._

  /** 断言助手：失败即抛，成功回布尔（性质体收尾恒为 Prop 可转换）。 */
  private def check(cond: Boolean, message: => String): Boolean = {
    if (!cond) throw new AssertionError(message)
    true
  }

  private def candidateRoot: java.nio.file.Path =
    Paths.get(sys.props("quality.candidate"))

  private def read(relative: String): String =
    new String(Files.readAllBytes(candidateRoot.resolve(relative)), StandardCharsets.UTF_8)

  private def sha256(text: String): String =
    CompositionOracle.hex(java.security.MessageDigest.getInstance("SHA-256")
      .digest(text.getBytes(StandardCharsets.UTF_8)))

  private def parse(relative: String): Source = {
    implicit val dialect: Dialect = dialects.Scala213
    read(relative).parse[Source] match {
      case Parsed.Success(source) => source
      case error: Parsed.Error => throw new IllegalStateException(
        relative + ": " + error.message)
    }
  }

  private def all(tree: Tree): Vector[Tree] = (tree +: tree.children.flatMap(all)).toVector

  private def importsOf(tree: Tree): Vector[String] = all(tree).collect {
    case importer: Importer => importer.ref.syntax
  }.toVector


  private def varNames(relative: String): Vector[String] = all(parse(relative)).collect {
    case v: Defn.Var => v.pats.map(_.syntax).mkString(",")
  }.toVector

  private val appTree = Vector(
    "app/example/stockreservation/application/aggregates/LotProtocol.scala",
    "app/example/stockreservation/application/services/transactor/WaferSplitSagaModule.scala",
    "app/example/stockreservation/application/services/transactor/WaferMergeSagaModule.scala",
    "app/example/stockreservation/application/services/transactor/SplitFixtureHost.scala",
    "app/example/stockreservation/application/services/transactor/MergeFixtureHost.scala",
    "app/example/stockreservation/application/services/transactor/WaferSplitSagaEntry.scala",
    "app/example/stockreservation/application/services/transactor/WaferMergeSagaEntry.scala",
    "app/example/stockreservation/application/services/transactor/CompositionChildJournal.scala",
    "app/example/stockreservation/application/services/transactor/WaferChildPlan.scala",
    "app/example/stockreservation/application/services/transactor/WaferTransferHost.scala",
    "app/example/stockreservation/application/services/transactor/StrictWire.scala",
    "app/example/stockreservation/domain/entities/LotEntity.scala",
    "app/example/stockreservation/domain/events/LotEvents.scala",
    "app/example/stockreservation/infrastructure/persistence/MongoCompositionChildJournal.scala",
    "app/example/stockreservation/infrastructure/bootstrap/CompositionBootstrap.scala",
    "app/net/imadz/common/Id.scala",
    "test/example/stockreservation/application/services/transactor/CompositionCases.scala",
    "test/example/stockreservation/application/services/transactor/CompositionOracle.scala",
    "test/example/stockreservation/application/services/transactor/CompositionFixture.scala",
    "test/example/stockreservation/application/services/transactor/CompositionProperties.scala",
    "test/example/stockreservation/application/services/transactor/CompositionQualityProperties.scala",
    "test/example/stockreservation/application/services/transactor/FixtureCompositionSpec.scala",
    "test/example/stockreservation/application/services/transactor/FixtureCompositionDeploymentSpec.scala",
    "quality/ScalaSourceMetrics.scala", "quality/QualityInputs.scala",
    "quality/JsonOutput.scala", "quality/QualityMain.scala")

  property("composition tree layout matches the composed family paths") = secure {
    check(appTree.forall(relative => Files.exists(candidateRoot.resolve(relative))),
      "every declared tree path must exist")
  }

  property("wafer module digests match the frozen semantic payloads") = secure {
    check("sha256:" + sha256(read("semantic-payload-wafer-split.json")) == splitDigest,
      "split digest pin")
    check("sha256:" + sha256(read("semantic-payload-wafer-merge.json")) == mergeDigest,
      "merge digest pin")
  }

  property("the two wafer modules are identity twins") = secure {
    val split = read("app/example/stockreservation/application/services/transactor/" +
      "WaferSplitSagaModule.scala")
    val merge = read("app/example/stockreservation/application/services/transactor/" +
      "WaferMergeSagaModule.scala")
    val substitutions = Vector(
      ("WaferSplitSagaModule", "WaferMergeSagaModule"),
      ("wafer-transfer-split", "wafer-transfer-merge"),
      ("WaferSplitArgsCodec", "WaferMergeArgsCodec"),
      ("wafer-transfer-split-v1", "wafer-transfer-merge-v1"),
      (splitDigest.drop(7), mergeDigest.drop(7)))
    val normalized = substitutions.foldLeft(split) { case (text, (a, b)) => text.replace(a, b) }
    check(normalized == merge, "the merge module must be the split module's identity twin")
  }

  property("the composition host imports no infrastructure and no mongo face") = secure {
    val hostImports = importsOf(parse(
      "app/example/stockreservation/application/services/transactor/WaferTransferHost.scala"))
    check(hostImports.forall(prefix => !prefix.contains("infrastructure")),
      "application must not import infrastructure: " + hostImports)
    check(!read("app/example/stockreservation/application/services/transactor/" +
      "WaferTransferHost.scala").contains("ScalaDslMongoReadJournal"),
      "the host must not touch the mongo read journal directly (D1)")
    check(!read("app/example/stockreservation/application/services/transactor/" +
      "WaferTransferHost.scala").contains("PersistenceQuery"),
      "the host must observe the child through the port (D1)")
  }

  property("the host depends on the child journal port, not any adapter") = secure {
    val host = read("app/example/stockreservation/application/services/transactor/" +
      "WaferTransferHost.scala")
    check(host.contains("childJournal.watch(childPid)"), "the host must watch through the port")
    check(host.contains("CompositionChildJournal"), "the port type must be the dependency face")
    check(!host.contains("MongoCompositionChildJournal") &&
      !host.contains("TestKitChildJournal"),
      "no adapter may leak into the application host")
  }

  property("the application tree carries zero mutable slots (F11 revised)") = secure {
    val appFiles = appTree.filter(relative =>
      relative.startsWith("app/") && relative.endsWith(".scala"))
    check(appFiles.forall(relative => varNames(relative).isEmpty),
      "zero Defn.Var across the application tree (algorithmic elimination): " +
        appFiles.filter(relative => varNames(relative).nonEmpty))
  }

  property("monarch imports appear only in the three declared faces") = secure {
    val monarchFiles = appTree.filter { relative =>
      relative.startsWith("app/") && relative.endsWith(".scala") &&
        read(relative).contains("net.imadz.monarch.persistence")
    }
    check(monarchFiles.toSet == Set(
      "app/example/stockreservation/application/services/transactor/WaferChildPlan.scala",
      "app/example/stockreservation/application/services/transactor/WaferTransferHost.scala",
      "app/example/stockreservation/infrastructure/persistence/MongoCompositionChildJournal.scala"),
      "the monarch import whitelist: " + monarchFiles)
  }

  property("strict runtime imports stay in the module and host faces") = strictImportWhitelist

  private def strictImportWhitelist: org.scalacheck.Prop = secure {
    val whitelist = Set(
      "app/example/stockreservation/application/services/transactor/WaferSplitSagaModule.scala",
      "app/example/stockreservation/application/services/transactor/WaferMergeSagaModule.scala",
      "app/example/stockreservation/application/services/transactor/SplitFixtureHost.scala",
      "app/example/stockreservation/application/services/transactor/MergeFixtureHost.scala",
      "app/example/stockreservation/application/services/transactor/WaferSplitSagaEntry.scala",
      "app/example/stockreservation/application/services/transactor/WaferMergeSagaEntry.scala",
      "app/example/stockreservation/application/services/transactor/WaferTransferHost.scala")
    val strictFiles = appTree.filter { relative =>
      relative.startsWith("app/") && relative.endsWith(".scala") &&
        read(relative).contains("net.imadz.infra.saga.strict")
    }
    check(strictFiles.toSet == whitelist, "the strict runtime import whitelist: " + strictFiles)
  }

  property("mongo faces stay in the persistence adapter and the two suites") = secure {
    val mongoFiles = appTree.filter { relative =>
      relative.startsWith("app/") && relative.endsWith(".scala") &&
        read(relative).contains("org.mongodb.scala")
    }
    val testMongo = Vector(
      "test/example/stockreservation/application/services/transactor/FixtureCompositionSpec.scala",
      "test/example/stockreservation/application/services/transactor/" +
        "FixtureCompositionDeploymentSpec.scala")
    check(mongoFiles.isEmpty && testMongo.forall(relative =>
      read(relative).contains("org.mongodb.scala")),
      "the mongo compile face stays in the suites (adapter rides the akka read journal)")
  }

  property("domain lot supply carries zero mechanism imports") = secure {
    val domainFiles = Vector(
      "app/example/stockreservation/domain/entities/LotEntity.scala",
      "app/example/stockreservation/domain/events/LotEvents.scala")
    check(domainFiles.forall { relative =>
      val prefixes = importsOf(parse(relative))
      prefixes.forall(prefix => prefix.startsWith("net.imadz.common") ||
        prefix.startsWith("example.stockreservation"))
    }, "domain imports must stay pure (zero akka/strict/mongo faces)")
  }

  property("receipt codec pins lock every phase face of both hosts") = secure {
    pinsFace()
  }

  private def pinsFace(): Boolean =
    hostContractFace(CompositionFixture.splitFixtureHost, WaferSplitSagaModule) &&
      hostContractFace(CompositionFixture.mergeFixtureHost, WaferMergeSagaModule) &&
      CompositionFixture.splitFixtureHost.argsCodec.pin == WaferSplitSagaModule.argsPin &&
      CompositionFixture.mergeFixtureHost.argsCodec.pin == WaferMergeSagaModule.argsPin

  private def hostContractFace(
      host: AnyRef, module: AnyRef): Boolean = {
    val contracts = (host, module) match {
      case (h: SplitFixtureHost, m: WaferSplitSagaModule.type) => Vector(
        h.removeFromLotPrepareBinding.contract == m.removeFromLotPrepareBindingContract,
        h.removeFromLotCommitBinding.contract == m.removeFromLotCommitBindingContract,
        h.removeFromLotCompensateBinding.contract == m.removeFromLotCompensateBindingContract,
        h.addToLotPrepareBinding.contract == m.addToLotPrepareBindingContract,
        h.addToLotCommitBinding.contract == m.addToLotCommitBindingContract,
        h.addToLotCompensateBinding.contract == m.addToLotCompensateBindingContract)
      case _ => Vector(
        CompositionFixture.mergeFixtureHost.removeFromLotPrepareBinding.contract ==
          WaferMergeSagaModule.removeFromLotPrepareBindingContract,
        CompositionFixture.mergeFixtureHost.removeFromLotCommitBinding.contract ==
          WaferMergeSagaModule.removeFromLotCommitBindingContract,
        CompositionFixture.mergeFixtureHost.removeFromLotCompensateBinding.contract ==
          WaferMergeSagaModule.removeFromLotCompensateBindingContract,
        CompositionFixture.mergeFixtureHost.addToLotPrepareBinding.contract ==
          WaferMergeSagaModule.addToLotPrepareBindingContract,
        CompositionFixture.mergeFixtureHost.addToLotCommitBinding.contract ==
          WaferMergeSagaModule.addToLotCommitBindingContract,
        CompositionFixture.mergeFixtureHost.addToLotCompensateBinding.contract ==
          WaferMergeSagaModule.addToLotCompensateBindingContract)
    }
    contracts.forall(identity)
  }

  property("wafer args codec frames the five-slot canonical order") = secure {
    val codec = CompositionFixture.splitFixtureHost.argsCodec
    val args = WaferSplitSagaModule.Args("t-1", "lot-a", "lot-b", List("w-1", "w-2"), "m-1")
    val framed = codec.encode(args)
    val expected = StrictWire.lengthPrefixed("t-1") ++
      StrictWire.lengthPrefixed("lot-a") ++
      StrictWire.lengthPrefixed("lot-b") ++
      StrictWire.lengthPrefixedAll(Vector("w-1", "w-2")) ++
      StrictWire.lengthPrefixed("m-1")
    check(framed == expected, "canonical args framing")
    check(codec.decode(framed).get == args, "canonical args roundtrip")
    check(codec.pin == argsPin, "args pin")
  }

  property("negative: wafer args codec rejects trailing bytes and short framing") = secure {
    val codec = CompositionFixture.splitFixtureHost.argsCodec
    val framed = codec.encode(WaferSplitSagaModule.Args("t-1", "lot-a", "lot-b",
      List("w-1"), "m-1"))
    val trailing = framed ++ StrictWire.lengthPrefixed("extra")
    check(codec.decode(trailing).isFailure, "trailing bytes must fail closed")
    check(codec.decode(framed.substring(0, framed.size - 2)).isFailure, "truncation must fail closed")
    check(codec.decode(StrictWire.lengthPrefixed("only")).isFailure,
      "a short frame must fail closed")
  }

  property("engine counting semantics: if, else-if, match and short-circuit counters") = secure {
    import example.stockreservation.application.services.transactor.quality.ScalaSourceMetrics
    val snippet = "package p\nclass A {\n  def f(x: Int): Int =\n    if (x > 0) 1 else if (x < 0) 2 else 3\n  def g(x: Int): Int = x match {\n    case 1 => 0\n    case _ => 1\n  }\n  def h(a: Boolean, b: Boolean): Boolean = a && b\n}\n"
    val report = ScalaSourceMetrics.analyze("probe.scala", snippet,
      ScalaSourceMetrics.Layer.Boundary).fold(error => sys.error(error), identity)
    val f = report.scopes.find(_.owner.endsWith(".f")).get
    val g = report.scopes.find(_.owner.endsWith(".g")).get
    val h = report.scopes.find(_.owner.endsWith(".h")).get
    check(f.counts.complexity == 3 && f.counts.nesting == 1,
      "else-if continues the enclosing if level (no extra nesting): " + f.counts)
    check(g.counts.complexity == 2 && g.counts.nesting == 1,
      "match paths minus one with a default (match is a control node): " + g.counts)
    check(h.counts.complexity == 2 && h.counts.nesting == 0,
      "short-circuit && counts one decision: " + h.counts)
  }

  property("negative: the engine bans anonymous implementations at every layer") = secure {
    import example.stockreservation.application.services.transactor.quality.ScalaSourceMetrics
    val snippet = "package p\nclass A {\n  val r = new Runnable { def run(): Unit = () }\n}\n"
    val report = ScalaSourceMetrics.analyze("probe.scala", snippet,
      ScalaSourceMetrics.Layer.Boundary)
    check(report.isRight && report.toOption.get.violations.nonEmpty,
      "Term.NewAnonymous must be flagged")
  }

  property("negative: boundary source importing infrastructure is rejected") = secure {
    import example.stockreservation.application.services.transactor.quality.ScalaSourceMetrics
    val snippet = "package p\nimport example.stockreservation.infrastructure.persistence.MongoCompositionChildJournal\nclass A\n"
    val report = ScalaSourceMetrics.analyze(
      "app/example/x/application/p/A.scala", snippet,
      ScalaSourceMetrics.Layer.Boundary)
    check(report.isRight && report.toOption.get.violations.nonEmpty,
      "application-to-infrastructure imports must be flagged")
  }

  property("negative: Defn.Var stays flagged in every boundary file") = secure {
    import example.stockreservation.application.services.transactor.quality.ScalaSourceMetrics
    val snippet = "package p\nclass A {\n  var state: Int = 0\n}\n"
    val report = ScalaSourceMetrics.analyze("app/p/A.scala", snippet,
      ScalaSourceMetrics.Layer.Boundary)
    check(report.isRight && report.toOption.get.violations.exists(_.reason ==
      "mutable-domain-state"), "Defn.Var outside the host must stay flagged")
  }

  property("both suites carry the frozen composition entry faces") = secure {
    val recovery = read("test/example/stockreservation/application/services/transactor/" +
      "FixtureCompositionSpec.scala")
    val deployment = read("test/example/stockreservation/application/services/transactor/" +
      "FixtureCompositionDeploymentSpec.scala")
    check(recovery.contains("final class FixtureCompositionSpec extends") &&
      recovery.contains("WaferSplitSagaEntry") && recovery.contains("WaferMergeSagaEntry"),
      "recovery suite entry faces")
    check(deployment.contains("object FixtureCompositionDeploymentNode") &&
      deployment.contains("FixtureCompositionDeploymentSpec extends") &&
      deployment.contains("spawnClusterSingletonForTest"),
      "deployment suite node + spec faces")
  }


}
