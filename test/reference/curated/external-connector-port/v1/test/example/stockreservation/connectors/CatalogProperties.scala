package example.stockreservation.connectors

import org.scalacheck.{Gen, Prop, Properties}
import org.scalacheck.Prop.forAll

import com.google.inject.{AbstractModule, Guice}
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
import example.stockreservation.infrastructure.connectors.{NodeSubprocessRunner, StockCatalogConnectorImpl}
import example.stockreservation.connectors.CatalogCases._
import example.stockreservation.connectors.CatalogOracle._

object CatalogProperties extends Properties("external-connector-port.stock-catalog.v1") {

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

  property("probe: answer lines decode to the exact typed answer") = forAll(answerShapes) { shape =>
    probeMatches(AvailabilityOutcome.decode(probeLine(shape)), expectedProbe(shape))
  }

  property("probe: refusal lines decode to the exact typed refusal") = forAll(refusalShapes) { shape =>
    probeMatches(AvailabilityOutcome.decode(probeLine(shape)), expectedProbe(shape))
  }

  property("probe: decoding is total and deterministic for arbitrary payloads") = forAll(arbitraryText) { raw =>
    val first = Try(AvailabilityOutcome.decode(raw))
    val second = Try(AvailabilityOutcome.decode(raw))
    first.isSuccess && second.isSuccess && signature(first.get) == signature(second.get)
  }

  property("probe: negative: directed malformed shapes never decode to an answer or refusal") = Prop.secure {
    val directed = Vector(WrongVerb, MissingField, ExtraField, NonNumericCount, NegativeCount,
      IllegalSkuText, EmptyFinalField, EmptyRefusalCode, MultilinePayload, EmptyPayload)
    directed.forall { shape =>
      val line = malformedProbe(shape, "sku-fixed", "E_FIXED", "problem message")
      probeMatches(AvailabilityOutcome.decode(line), expectedProbe(RawLine(line)))
    }
  }

  property("directory: directory lines decode to the exact warehouse and location vector") =
    forAll(nameText, Gen.resize(6, Gen.listOf(nameText))) { (warehouseText, locationTexts) =>
      val shape = DirectoryLine(warehouseText, locationTexts.toVector)
      directoryMatches(LocationDirectory.decode(directoryLine(shape)), expectedDirectory(shape))
    }

  property("directory: empty location tail decodes to the empty vector") = Prop.secure {
    val shape = DirectoryLine("warehouse-fixed", Vector.empty)
    directoryMatches(
      LocationDirectory.decode(s"DIRECTORY|warehouse-fixed|"),
      expectedDirectory(shape))
  }

  property("directory: negative: directed malformed shapes never decode to a directory") = Prop.secure {
    val directed = Vector(DirectoryWrongVerb, DirectoryMissingField, DirectoryExtraField,
      DirectoryIllegalWarehouse, DirectoryIllegalLocation, DirectoryTrailingLocationSeparator,
      DirectoryMultilinePayload)
    directed.forall { shape =>
      val line = malformedDirectory(shape, "warehouse-fixed", "loc-fixed")
      directoryMatches(LocationDirectory.decode(line), expectedDirectory(RawDirectoryLine(line)))
    }
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

  property("delegation: negative: a runner failure propagates unchanged and is never retried") = Prop.secure {
    val crash = new RuntimeException("subprocess crashed")
    val runner = new ScriptedRunner(Vector(Failure(crash), Success("ANSWER|sku-fixed|10")))
    val result = completed(port(runner).probeAvailability("script-fixed"))
    result == Failure(crash) && runner.invocations == Vector("script-fixed")
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
}
