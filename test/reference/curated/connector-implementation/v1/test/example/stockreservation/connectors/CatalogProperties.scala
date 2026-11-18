package example.stockreservation.connectors

import org.scalacheck.{Gen, Prop, Properties}
import org.scalacheck.Prop.forAll

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths}

import com.google.inject.Guice
import scala.concurrent.{Await, ExecutionContext, Future}
import scala.concurrent.duration._
import scala.util.{Failure, Success, Try}

import example.stockreservation.application.connectors.{
  AvailabilityOutcome,
  LocationDirectory,
  ProtocolViolation,
  StockCatalogConnector
}
import example.stockreservation.infrastructure.bootstrap.StockCatalogModule
import example.stockreservation.infrastructure.connectors.StockCatalogConnectorImpl
import example.stockreservation.infrastructure.process.NodeSubprocessRunner
import example.stockreservation.connectors.CatalogCases._
import example.stockreservation.connectors.CatalogOracle._

object CatalogProperties extends Properties("connector-implementation.stock-catalog-impl.v1") {

  private def port(runner: NodeSubprocessRunner): StockCatalogConnector =
    new StockCatalogConnectorImpl(runner, ExecutionContext.parasitic)

  private def completed[T](pending: Future[T]): Try[T] = Try(Await.result(pending, 5.seconds))

  private def signature[T](result: Try[T]): String = result match {
    case Success(_) => "success"
    case Failure(violation: ProtocolViolation) => "violation:" + violation.evidence
    case Failure(other) => "failure:" + other.getClass.getName
  }

  private def failedWithProtocolViolation[T](result: Try[T]): Boolean =
    result.isFailure && result.failed.get.isInstanceOf[ProtocolViolation]

  private val probeCallShapes: Gen[ProbeShape] =
    Gen.frequency((3, answerShapes), (2, refusalShapes))

  private val implementationRelativePath: String =
    "app/example/stockreservation/infrastructure/connectors/StockCatalogConnectorImpl.scala"

  private val beginMarker: String = "// ==== BEGIN MANUAL ===="
  private val endMarker: String = "// ==== END MANUAL ===="

  private def implementationLines: Vector[String] = {
    import scala.jdk.CollectionConverters._
    val rows = Files.readAllLines(Paths.get(sys.props("quality.sources")), StandardCharsets.UTF_8).asScala.toVector
    val columns = rows.map(_.split("\t", -1))
      .find(row => row.length == 3 && row(0) == implementationRelativePath)
      .getOrElse(throw new IllegalArgumentException("Implementation source missing from quality listing"))
    Files.readAllLines(Paths.get(columns(1)), StandardCharsets.UTF_8).asScala.toVector
  }

  private def markerIndices(lines: Vector[String], marker: String): Vector[Int] =
    lines.zipWithIndex.collect { case (line, index) if line.trim == marker => index }.toVector

  private def manualBlockHolds(lines: Vector[String]): Boolean = {
    val begins = markerIndices(lines, beginMarker)
    val ends = markerIndices(lines, endMarker)
    val overrides = lines.count(_.trim.startsWith("override def"))
    begins.length == overrides && ends == begins.map(_ + 2) && begins.forall(index =>
      lines(index - 1).contains("override def") && lines(index + 1).contains("lift(runner.run") &&
        lines(index + 3).trim == "}")
  }

  property("delegation: each port call invokes the runner exactly once with the script verbatim") =
    forAll(nameText) { script =>
      val runner = new ScriptedRunner(Vector(Success("ANSWER|sku-fixed|10")))
      completed(port(runner).probeAvailability(script))
      runner.invocations == Vector(script)
    }

  property("delegation: runner success lifts to the exact typed outcome") = forAll(probeCallShapes) { shape =>
    val line = probeLine(shape)
    val runner = new ScriptedRunner(Vector(Success(line)))
    val result = completed(port(runner).probeAvailability("script-fixed"))
    result == AvailabilityOutcome.decode(line) && probeMatches(result, expectedProbe(shape))
  }

  property("delegation: repeated calls with the same runner output yield identical outcomes") =
    forAll(probeCallShapes) { shape =>
      val line = probeLine(shape)
      val runner = new ScriptedRunner(Vector(Success(line)))
      val first = completed(port(runner).probeAvailability("script-fixed"))
      val second = completed(port(runner).probeAvailability("script-fixed"))
      signature(first) == signature(second)
    }

  property("delegation: negative: a runner failure propagates unchanged and is never retried") = Prop.secure {
    val crash = new RuntimeException("subprocess crashed")
    val runner = new ScriptedRunner(Vector(Failure(crash), Success("ANSWER|sku-fixed|10")))
    val result = completed(port(runner).probeAvailability("script-fixed"))
    result == Failure(crash) && runner.invocations == Vector("script-fixed")
  }

  property("delegation: negative: a synchronous helper failure propagates unchanged from the call itself") =
    Prop.secure {
      val crash = new RuntimeException("helper machinery broke synchronously")
      val runner = new ThrowingRunner(crash)
      val attempted = Try(port(runner).probeAvailability("script-fixed"))
      (attempted.failed.get eq crash) && runner.invocations == Vector("script-fixed")
    }

  property("delegation: negative: a malformed payload lands on the failure channel, never a synthesized outcome") =
    forAll(malformedProbeShapes) { line =>
      val probeRunner = new ScriptedRunner(Vector(Success(line)))
      val probeResult = completed(port(probeRunner).probeAvailability("script-fixed"))
      val probeAlone = failedWithProtocolViolation(probeResult) &&
        probeRunner.invocations == Vector("script-fixed")
      val directoryRunner = new ScriptedRunner(Vector(Success("DIRECTORY|ware house|loc-fixed")))
      val directoryResult = completed(port(directoryRunner).locationDirectory())
      val directoryAlone = failedWithProtocolViolation(directoryResult) &&
        directoryRunner.invocations == Vector(boundDirectoryScript)
      probeAlone && directoryAlone
    }

  property("delegation: a refusal stays on the success channel as a typed value distinct from failure") =
    forAll(refusalShapes) { shape =>
      val line = probeLine(shape)
      val runner = new ScriptedRunner(Vector(Success(line)))
      val result = completed(port(runner).probeAvailability("script-fixed"))
      result.isSuccess && probeMatches(result, expectedProbe(shape))
    }

  property("delegation: the bound directory script is used verbatim for the parameterless method") = Prop.secure {
    val runner = new ScriptedRunner(Vector(Success("DIRECTORY|warehouse-fixed|loc-a,loc-b")))
    val result = completed(port(runner).locationDirectory())
    result == LocationDirectory.decode("DIRECTORY|warehouse-fixed|loc-a,loc-b") &&
      runner.invocations == Vector(boundDirectoryScript)
  }

  property("delegation: directory success lifts to the exact typed directory") =
    forAll(nameText, Gen.resize(6, Gen.listOf(nameText))) { (warehouseText, locationTexts) =>
      val shape = DirectoryLine(warehouseText, locationTexts.toVector)
      val runner = new ScriptedRunner(Vector(Success(directoryLine(shape))))
      val result = completed(port(runner).locationDirectory())
      result == LocationDirectory.decode(directoryLine(shape)) &&
        directoryMatches(result, expectedDirectory(shape))
    }

  property("assembly: the infrastructure module binds the port to its implementation") = Prop.secure {
    val runner = new ScriptedRunner(Vector(Success("ANSWER|sku-fixed|10")))
    val injector = Guice.createInjector(new StockCatalogModule,
      new CatalogSeamModule(runner, ExecutionContext.parasitic))
    val resolved = injector.getInstance(classOf[StockCatalogConnector])
    val typed = resolved.isInstanceOf[StockCatalogConnectorImpl]
    val working = completed(resolved.probeAvailability("script-fixed")).get ==
      AvailabilityOutcome.decode("ANSWER|sku-fixed|10").get
    typed && working
  }

  property("manual: the implementation artifact keeps one paired MANUAL block per method") = Prop.secure {
    manualBlockHolds(implementationLines)
  }

  property("manual: negative: unpaired or duplicated markers fail the structural check") = Prop.secure {
    val lines = implementationLines
    val unpaired = lines.filterNot(_.trim == endMarker)
    val duplicated = lines :+ beginMarker
    !manualBlockHolds(unpaired) && !manualBlockHolds(duplicated)
  }
}
