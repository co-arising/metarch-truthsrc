package example.bankwealth.application

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths}

import scala.jdk.CollectionConverters._

import org.scalacheck.Properties
import org.scalacheck.Prop.secure

import example.bankwealth.application.quality.ScalaSourceMetrics
import example.bankwealth.application.quality.ScalaSourceMetrics.Layer

/** 结构性质（效果面金样源面）：R2(b) 容纳面的 var 住宿地、throw 失闭清单、try 只住
  * safe 缝、100 列版式、机制令牌零容忍、义务表三行、常数双记账、import 面；
  * 外加两条引擎元性质把本面 layer 语义与共享引擎系紧。 */
object BankEffectQualityProperties extends Properties("effect-face.quality.v1") {

  private val dispatchHostPath = "effect-face/app/example/bankwealth/application/BankSipDispatchEffectHost.scala"
  private val taHostPath = "effect-face/app/example/bankwealth/application/BankTaEffectHost.scala"
  private val dispatchSerializerPath = "effect-face/app/example/bankwealth/application/BankSipDispatchEffectHostSerializer.scala"
  private val taSerializerPath = "effect-face/app/example/bankwealth/application/BankTaEffectHostSerializer.scala"
  private val dispatchExecutionPath = "effect-face/app/example/bankwealth/application/BankSipDispatchExecution.scala"
  private val taExecutionPath = "effect-face/app/example/bankwealth/application/BankTaSubmissionExecution.scala"

  private def goldenTexts: Map[String, String] = {
    val listing = Paths.get(sys.props("quality.sources"))
    Files.readAllLines(listing, StandardCharsets.UTF_8).asScala.toVector
      .map(_.split("\t", -1)).filter(columns => columns.length == 3 && columns(2) != "support")
      .map(columns => columns(0) -> new String(Files.readAllBytes(Paths.get(columns(1))), StandardCharsets.UTF_8))
      .toMap
  }

  private def importsOf(source: String): Vector[String] =
    source.split("\n").toVector.map(_.trim).filter(_.startsWith("import ")).map(_.stripPrefix("import "))

  private def lines(source: String, marker: String): Vector[String] =
    source.split("\n").toVector.filter(_.contains(marker))

  private def effectTexts: Map[String, String] =
    goldenTexts.filter { case (path, _) => path.startsWith("effect-face/") }

  private def violations(text: String, layer: Layer): Set[String] =
    ScalaSourceMetrics.analyze("sample.scala", text, layer).toOption.get.violations.map(_.reason).toSet

  // ---- 结构：容纳面与失闭清单 -----------------------------------------------------

  property("structure: local var coalescing lives only in the two effect hosts") = secure {
    val varFiles = effectTexts.toVector
      .collect { case (path, text) if lines(text, " var ").nonEmpty => path }.sorted
    varFiles == Vector(dispatchHostPath, taHostPath).sorted &&
      effectTexts.values.forall(text =>
        lines(text, " var ").forall(line =>
          Vector("var pending", "var round", "var waiters").exists(line.contains)))
  }

  property("structure: fail-closed throws stay in the executions, effect hosts and serializers only") = secure {
    val throwFiles = effectTexts.toVector
      .collect { case (path, text) if text.contains("throw new") => path }.sorted
    val expected = Vector(dispatchHostPath, taHostPath, dispatchSerializerPath, taSerializerPath,
      dispatchExecutionPath, taExecutionPath).sorted
    throwFiles == expected
  }

  property("structure: try-catch stays confined to the effect hosts' safe seam") = secure {
    val tryFiles = effectTexts.toVector
      .collect { case (path, text) if text.split("\n").exists(line => line.trim.startsWith("try ")) => path }.sorted
    tryFiles == Vector(dispatchHostPath, taHostPath).sorted
  }

  // ---- 结构：版式、机制、常数 ------------------------------------------------------

  property("structure: golden sources hold the 120-column layout discipline") = secure {
    goldenTexts.forall { case (_, text) =>
      text.split("\n").toVector.filterNot(line => line.trim.startsWith("import ")).forall(_.length <= 120)
    }
  }

  private val zeroMechanismTokens =
    Vector("Await", "println", "printStackTrace", "randomUUID", "Thread.sleep",
      "System.nanoTime", "System.currentTimeMillis", "Instant.now", "LocalDateTime")

  property("structure: golden sources carry no mechanism tokens") = secure {
    goldenTexts.forall { case (_, text) =>
      zeroMechanismTokens.forall(token => !text.contains(token))
    }
  }

  property("structure: the serializer identities and shared manifest are pinned") = secure {
    goldenTexts(dispatchSerializerPath).contains("744000") &&
      goldenTexts(taSerializerPath).contains("744001") &&
      effectTexts.values.filter(text => text.contains("SerializerWithStringManifest"))
        .forall(text => text.contains("\"effect-event-v1\"")) &&
      !effectTexts.values.exists(text => text.contains("\"event-v1\""))
  }

  property("structure: the R1 retry constants are pinned in both executions") = secure {
    Vector(dispatchExecutionPath, taExecutionPath).forall { path =>
      val text = goldenTexts(path)
      text.contains("RetryInitial = 100.millis") && text.contains("RetryFactor = 2") &&
        text.contains("RetryMax = 5.seconds") && text.contains("StageDeadline = 60.seconds") &&
        text.contains("backoffMillis")
    }
  }

  property("structure: binding artifacts and versions are pinned per case") = secure {
    goldenTexts(dispatchHostPath).contains("\"BankSipTechnical\"") &&
      goldenTexts(taHostPath).contains("\"BankTaTechnical\"") &&
      goldenTexts(dispatchHostPath).contains("bank-sip-dispatch") &&
      goldenTexts(taHostPath).contains("bank-ta-submission-v1") &&
      goldenTexts(dispatchHostPath).contains("DispatchSipCash") &&
      goldenTexts(taHostPath).contains("SubmitPaidTaRequest")
  }

  // ---- 结构：义务表与 import 面 ----------------------------------------------------

  property("structure: the obligation tables carry exactly the declared ids per case") = secure {
    val dispatchIds = """\("([A-Za-z]+)", "(execute|query|reconcile)"""".r
      .findAllMatchIn(goldenTexts(dispatchHostPath)).map(_.group(1)).toVector
    val taIds = """\("([A-Za-z]+)", "(execute|query|reconcile)"""".r
      .findAllMatchIn(goldenTexts(taHostPath)).map(_.group(1)).toVector
    dispatchIds == Vector("BankSipDispatchExecute", "BankSipDispatchQuery", "BankSipDispatchReconcilePort") &&
      taIds == Vector("BankTaEffectExecute", "BankTaEffectQuery", "BankTaEffectReconcilePort") &&
      effectTexts.values.forall(text =>
        !"(?<!!)\bnull\b".r.findFirstMatchIn(text.replaceAll("\\s*!=\\s*null", "")).isDefined)
  }

  private val dispatchHostImports = Vector(
    "scala.concurrent.{ExecutionContext, Future}",
    "scala.util.control.NonFatal",
    "akka.actor.typed.{ActorRef, Behavior}",
    "akka.actor.typed.scaladsl.Behaviors",
    "akka.persistence.typed.{PersistenceId, RecoveryCompleted}",
    "akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}",
    "com.google.protobuf.ByteString",
    "example.bankwealth.domain.values.{BankSipDispatchOperation, BankSipDispatchObservation, BankSipDispatchReconcile, BankSipDispatchRequest}")

  property("structure: the effect host import face is the judged exact list") = secure {
    importsOf(goldenTexts(dispatchHostPath)) == dispatchHostImports
  }

  property("structure: java and mutable-collection imports stay banned everywhere") = secure {
    val banned = Vector("java.io", "java.nio", "java.time", "java.util", "java.sql", "scala.collection.mutable")
    goldenTexts.forall { case (_, text) =>
      importsOf(text).forall(imported => !banned.exists(imported.startsWith))
    }
  }

  // ---- 元性质：本面 layer 语义与共享引擎系紧 -----------------------------------------

  property("negative: a var field is rejected while the local coalescing var is admitted") = secure {
    val field = "object Bad { var y = 0; def face(): Int = 1 }"
    val local = "object Good { def face(): Int = { var y = 0; y = 1; y } }"
    violations(field, Layer.Host).contains("mutable-field-state") &&
      violations(local, Layer.Host).isEmpty
  }

  property("negative: java import statements stay rejected in the host layer") = secure {
    val imported = "import java.time.Instant\nobject Sample { def face(): java.time.Instant = java.time.Instant.now() }"
    violations(imported, Layer.Host).contains("outside-or-effectful-domain-import")
  }
}
