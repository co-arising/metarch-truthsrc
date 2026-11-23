package example.bankwealth.application

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths}

import scala.jdk.CollectionConverters._

import org.scalacheck.{Gen, Properties}
import org.scalacheck.Prop.forAll
import org.scalacheck.Prop.secure

import example.bankwealth.application.quality.ScalaSourceMetrics
import example.bankwealth.application.quality.ScalaSourceMetrics.Layer

/** 结构性质（真实金样源面）＋度量器元性质（合成源）。
  * 结构面钉住：R2(b) 容纳面的 var/assign 住宿地、throw 失闭清单、try 只住在
  * safe 缝、100 列版式（L1）、机制令牌零容忍、知识常数双记账、import 面、
  * 30 行义务表与按角色 record 形；元性质钉引擎计数语义与本族增量
  * （var 字段禁／局部 var 宿、throw 宿、序列化层禁 try、匿名端口实现面）。 */
object BankPaymentQualityProperties extends Properties("pipeline-invocation-face.quality.v1") {

  private val hostPath = "pipeline-invocation-face/app/example/bankwealth/application/BankPaymentHost.scala"
  private val hostIOPath = "pipeline-invocation-face/app/example/bankwealth/application/BankPaymentHostIO.scala"
  private val portsPath = "pipeline-invocation-face/app/example/bankwealth/application/BankPaymentPorts.scala"
  private val bindingsPath = "pipeline-invocation-face/app/example/bankwealth/application/BankPaymentPortBindings.scala"
  private val definitionPath = "pipeline-invocation-face/app/example/bankwealth/application/BankPaymentSagaDefinition.scala"
  private val executionPath = "pipeline-invocation-face/app/example/bankwealth/application/BankCashPaymentExecution.scala"
  private val serializerPath = "pipeline-invocation-face/app/example/bankwealth/application/BankPaymentHostSerializer.scala"
  private val dispatchEffectPath = "effect-face/app/example/bankwealth/application/BankSipDispatchEffectHost.scala"
  private val taEffectPath = "effect-face/app/example/bankwealth/application/BankTaEffectHost.scala"

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

  private def scopes(text: String, layer: Layer): Vector[ScalaSourceMetrics.Scope] = {
    val report = ScalaSourceMetrics.analyze("sample.scala", text, layer)
      .fold(error => throw new IllegalArgumentException(error), identity)
    require(report.violations.isEmpty, report.violations.toString)
    report.scopes
  }

  private def method(text: String, layer: Layer = Layer.Support): ScalaSourceMetrics.Scope =
    scopes(s"object Sample { def choose(a: Boolean): Int = $text }", layer)
      .find(_.kind == "method").getOrElse(throw new IllegalArgumentException("Missing method"))

  private def violations(text: String, layer: Layer): Set[String] =
    ScalaSourceMetrics.analyze("sample.scala", text, layer).toOption.get.violations.map(_.reason).toSet

  private val lengths = Gen.choose(0, 7)

  // ---- 结构：R2(b) 容纳面 -----------------------------------------------------

  private val sanctionedVarFiles =
    Vector(hostPath, dispatchEffectPath, taEffectPath).sorted

  property("structure: local var coalescing lives only in the three hosts") = secure {
    val varFiles = goldenTexts.toVector
      .collect { case (path, text) if lines(text, " var ").nonEmpty => path }.sorted
    varFiles == sanctionedVarFiles &&
      lines(goldenTexts(hostPath), " var ").count(_.contains("var admission")) == 1 &&
      lines(goldenTexts(dispatchEffectPath), " var ").forall(line =>
        Vector("var pending", "var round", "var waiters").exists(line.contains)) &&
      lines(goldenTexts(taEffectPath), " var ").forall(line =>
        Vector("var pending", "var round", "var waiters").exists(line.contains))
  }

  property("structure: assignment stays inside the sanctioned coalescing files") = secure {
    import scala.meta._
    import scala.meta.parsers._
    implicit val dialect: scala.meta.Dialect = scala.meta.dialects.Scala213
    def countAssigns(tree: Tree, parent: Tree): Int = {
      val here = tree match {
        case _: Term.Assign if !parent.isInstanceOf[Term.ArgClause] => 1
        case _ => 0
      }
      here + tree.children.map(child => countAssigns(child, tree)).sum
    }
    def assigns(path: String): Int = goldenTexts(path).parse[Source] match {
      case Parsed.Success(source) => countAssigns(source, source)
      case error: Parsed.Error => throw new IllegalArgumentException(error.message)
    }
    val assignFiles = goldenTexts.keys.toVector.filter(path => assigns(path) > 0).sorted
    assignFiles == sanctionedVarFiles &&
      assigns(hostPath) >= 3 && assigns(dispatchEffectPath) >= 6 && assigns(taEffectPath) >= 6
  }

  // ---- 结构：throw 失闭清单与 try 缝 -------------------------------------------

  property("structure: fail-closed throws stay in the executions, effect hosts and serializers only") = secure {
    val throwFiles = goldenTexts.toVector
      .collect { case (path, text) if text.contains("throw new") => path }.sorted
    val expected = Vector(executionPath, serializerPath, dispatchEffectPath, taEffectPath).sorted ++ goldenTexts.keys
      .filter(path => path.endsWith("BankSipDispatchExecution.scala") || path.endsWith("BankTaSubmissionExecution.scala")
        || path.endsWith("EffectHostSerializer.scala")).toVector
    throwFiles == expected.sorted &&
      !throwFiles.contains(hostPath) && !throwFiles.contains(bindingsPath) &&
      !throwFiles.contains(definitionPath) && !throwFiles.contains(hostIOPath) &&
      !throwFiles.contains(portsPath)
  }

  property("structure: try-catch stays confined to the effect hosts' safe seam") = secure {
    val tryFiles = goldenTexts.toVector
      .collect { case (path, text) if text.split("\n").exists(line => line.trim.startsWith("try ")) => path }.sorted
    tryFiles == Vector(dispatchEffectPath, taEffectPath).sorted &&
      goldenTexts(dispatchEffectPath).split("\n").count(_.trim.startsWith("try ")) == 1 &&
      goldenTexts(taEffectPath).split("\n").count(_.trim.startsWith("try ")) == 1
  }

  // ---- 结构：版式与机制零容忍 ---------------------------------------------------

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

  // ---- 结构：知识常数双记账 ------------------------------------------------------

  property("structure: the definition identity is pinned in host and definition alike") = secure {
    val digest = "sha256:c13f703e76eaee9bfceeff701ecc5f41dd011d6db6890c6820a7faa944538f64"
    goldenTexts(hostPath).contains(digest) && goldenTexts(definitionPath).contains(digest) &&
      goldenTexts(hostPath).contains("truthsrc-pipeline-invocation-v1") &&
      lines(goldenTexts(hostPath), "\"iteration\", \"absent\", \"chunk\", \"absent\"").size == 1
  }

  property("structure: the R1 retry constants are pinned in all three executions") = secure {
    val retryFaces = goldenTexts.toVector
      .collect { case (path, text) if path.endsWith("Execution.scala") => text }
    retryFaces.size == 3 && retryFaces.forall { text =>
      text.contains("RetryInitial = 100.millis") && text.contains("RetryFactor = 2") &&
        text.contains("RetryMax = 5.seconds") && text.contains("StageDeadline = 60.seconds") &&
        text.contains("backoffMillis")
    }
  }

  property("structure: the serializer identity and manifest are pinned") = secure {
    goldenTexts(serializerPath).contains("742000") && goldenTexts(serializerPath).contains("\"event-v1\"")
  }

  // ---- 结构：import 面 -----------------------------------------------------------

  private val hostImports = Vector(
    "scala.concurrent.Future",
    "akka.actor.typed.{ActorRef, Behavior}",
    "akka.actor.typed.scaladsl.Behaviors",
    "akka.persistence.typed.PersistenceId",
    "akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}",
    "com.google.protobuf.ByteString",
    "example.bankwealth.domain.values.{BankPaymentArgs, BankPaymentOriginal, BankPaymentResult}",
    "net.imadz.infra.saga.strict._")

  property("structure: the host import face is the judged exact list") = secure {
    importsOf(goldenTexts(hostPath)) == hostImports
  }

  property("structure: java and mutable-collection imports stay banned everywhere") = secure {
    val banned = Vector("java.io", "java.nio", "java.time", "java.util", "java.sql", "scala.collection.mutable")
    goldenTexts.forall { case (_, text) =>
      importsOf(text).forall(imported => !banned.exists(imported.startsWith))
    }
  }

  // ---- 结构：绑定表与按角色 record -------------------------------------------------

  private val obligationIds = Vector(
    "BankPaymentEntry", "BankPaymentAssociation",
    "ReserveInvestorFundsPrepareExecute", "ReserveInvestorFundsPrepareQueryPort",
    "ReserveInvestorFundsCommitExecute", "ReserveInvestorFundsCommitQueryPort",
    "ReserveInvestorFundsCompensateExecute", "ReserveInvestorFundsCompensateQueryPort",
    "CreditFundCollectionPrepareExecute", "CreditFundCollectionPrepareQueryPort",
    "CreditFundCollectionCommitExecute", "CreditFundCollectionCommitQueryPort",
    "CreditFundCollectionCompensateExecute", "CreditFundCollectionCompensateQueryPort",
    "ReserveCashFundOrderPrepareExecute", "ReserveCashFundOrderPrepareQueryPort",
    "ReserveCashFundOrderCommitExecute", "ReserveCashFundOrderCommitQueryPort",
    "ReserveCashFundOrderCompensateExecute", "ReserveCashFundOrderCompensateQueryPort",
    "BankPaymentSucceededAuthority", "BankPaymentSucceededDelivery",
    "BankPaymentRejectedBeforeEffectsAuthority", "BankPaymentRejectedBeforeEffectsDelivery",
    "BankPaymentCompensatedAuthority", "BankPaymentCompensatedDelivery",
    "BankPaymentRecoveryRequiredAuthority", "BankPaymentRecoveryRequiredDelivery",
    "BankPaymentOutcomeUnknownAuthority", "BankPaymentOutcomeUnknownDelivery")

  property("structure: the obligation table carries exactly the declared ids in order") = secure {
    val bindings = goldenTexts(bindingsPath)
    val declared = """Obligation\("([A-Za-z]+)"""".r.findAllMatchIn(bindings).map(_.group(1)).toVector
    declared == obligationIds &&
      bindings.contains("RunBinding") && bindings.contains("OperationBinding") &&
      bindings.contains("CompletionBinding") && bindings.contains("requireExact") &&
      !bindings.contains("Implementation(") &&
      !"(?<!!)\bnull\b".r.findFirstMatchIn(bindings.replaceAll("\\s*!=\\s*null", "")).isDefined
  }

  property("structure: the port surface owns declarations only, no ask implementations") = secure {
    val ports = goldenTexts(portsPath)
    ports.contains("trait BankPaymentPorts") && !ports.contains("Future.successful") &&
      goldenTexts(hostIOPath).contains("completionFace") &&
      goldenTexts(hostIOPath).contains("import BankPaymentHost.ResultKind")
  }

  // ---- 元性质：引擎计数语义 --------------------------------------------------------

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

  property("AST: match alternatives and guards are explicit paths") = secure {
    method("a match { case 1 | 2 => 1; case _ => 0 }").counts.complexity == 3 &&
      method("a match { case 1 if a > 0 => 2; case _ => 3 }").counts.complexity == 3
  }

  property("AST: else-if is one control nesting level") = secure {
    method("if (a) 1 else if (a) 2 else 3").counts == ScalaSourceMetrics.Counts(2, 1)
  }

  property("AST: HOF closure decisions count both in parent and closure") = secure {
    val report = ScalaSourceMetrics.analyze("sample.scala",
      "object Sample { def choose = Vector(1).map(x => if (x > 0) 1 else 2) }", Layer.Support).toOption.get
    val counts = report.scopes.filter(scope => Set("method", "lambda").contains(scope.kind)).map(_.counts.complexity)
    counts.size == 2 && counts.forall(_ == 2)
  }

  property("AST: overflow complexity is measured exactly, never clamped") = secure {
    val body = (0 until 6).map(_ => "if (a) 1 else ").mkString + "0"
    method(body).counts.complexity == 7
  }

  property("AST: defaults and initialization are registered") = secure {
    val report = ScalaSourceMetrics.analyze("sample.scala",
      "class Sample(a: Boolean = true) { val b = if(a) 1 else 2; def choose(x: Int = 1) = x }", Layer.Support).toOption.get
    Set("method", "value", "initialization", "default-parameter").subsetOf(report.scopes.map(_.kind).toSet)
  }

  property("AST: named arguments sit in argument position and are admitted") = secure {
    val source = "object Sample { case class R(x: Int); def face(r: R): R = r.copy(x = 1); def make(): R = new R(x = 1) }"
    violations(source, Layer.Host).isEmpty && violations(source, Layer.Serializer).isEmpty
  }

  // ---- 元性质：本族增量 ------------------------------------------------------------

  property("negative: a var field is rejected while the local coalescing var is admitted") = secure {
    val field = "object Bad { var y = 0; def face(): Int = 1 }"
    val local = "object Good { def face(): Int = { var y = 0; y = 1; y } }"
    violations(field, Layer.Host).contains("mutable-field-state") &&
      violations(local, Layer.Host).isEmpty
  }

  property("negative: nonlocal returns stay rejected in both golden layers") = secure {
    val source = "object Bad { def face(): Int = { return 1 } }"
    violations(source, Layer.Host).contains("nonlocal-domain-return") &&
      violations(source, Layer.Serializer).contains("nonlocal-domain-return")
  }

  property("AST: fail-closed throw and the anonymous port face are admitted") = secure {
    val source = "object Sample { trait P { def go(): Int }; def face(): P = new P { def go(): Int = if (a) 1 else throw new IllegalArgumentException(\"no\") } }"
    violations(source, Layer.Host).isEmpty
  }

  property("negative: try stays banned in the serializer layer only") = secure {
    val source = "object Sample { def face(): Int = try { 1 } catch { case _: Throwable => 2 } }"
    violations(source, Layer.Serializer).contains("serializer-catch-control") &&
      violations(source, Layer.Host).isEmpty
  }

  property("negative: java import statements stay rejected with the fully-qualified form sanctioned") = secure {
    val imported = "import java.time.Instant\nobject Sample { def face(): java.time.Instant = java.time.Instant.now() }"
    val qualified = "object Sample { def face(): Int = 1 }"
    violations(imported, Layer.Host).contains("outside-or-effectful-domain-import") &&
      violations(qualified, Layer.Host).isEmpty
  }

  property("negative: timers randomness and stdout stay rejected as plain names") = secure {
    val awaiting = "object Sample { def face(f: scala.concurrent.Future[Int]): Int = scala.concurrent.Await.result(f, scala.concurrent.duration.Duration.Inf) }"
    val noisy = "object Sample { def face(): Unit = println(\"side effect\") }"
    violations(awaiting, Layer.Host).contains("implicit-domain-time-randomness-or-mutation") &&
      violations(noisy, Layer.Host).contains("implicit-domain-time-randomness-or-mutation")
  }

  property("negative: invalid syntax cannot become an empty successful report") = secure {
    ScalaSourceMetrics.analyze("broken.scala", "object {", Layer.Host).isLeft
  }
}
