package example.stockreservation.connectors

import org.scalacheck.Gen

import com.google.inject.AbstractModule
import example.stockreservation.infrastructure.process.{LocalProcessRunner, ProcessRequest}
import scala.collection.mutable.ListBuffer
import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

/** Closed payload shapes and generators for the stock-catalog tool gate implementation sample. */
object CatalogCases {

  sealed trait ProbeShape
  final case class AnswerLine(skuText: String, available: Long) extends ProbeShape
  final case class RefusalLine(code: String, message: String) extends ProbeShape
  final case class RawLine(text: String) extends ProbeShape

  sealed trait DirectoryShape
  final case class DirectoryLine(warehouseText: String, locationTexts: Vector[String]) extends DirectoryShape
  final case class RawDirectoryLine(text: String) extends DirectoryShape

  val answerVerb: String = "ANSWER"
  val refusedVerb: String = "REFUSED"
  val directoryVerb: String = "DIRECTORY"
  val probeScript: String = "stockreservation/availability-probe.v1"
  val probeTimeoutMs: Long = 10000L
  val directoryScript: String = "stockreservation/location-directory.v1"
  val directoryTimeoutMs: Long = 10000L

  def probeLine(shape: ProbeShape): String = shape match {
    case AnswerLine(skuText, available) => s"$answerVerb|$skuText|$available"
    case RefusalLine(code, message) => s"$refusedVerb|$code|$message"
    case RawLine(text) => text
  }

  def directoryLine(shape: DirectoryShape): String = shape match {
    case DirectoryLine(warehouseText, locationTexts) =>
      s"$directoryVerb|$warehouseText|${locationTexts.mkString(",")}"
    case RawDirectoryLine(text) => text
  }

  // Closed malformed dispatch: every family of protocol violation has a named shape.
  sealed trait MalformedProbe
  case object WrongVerb extends MalformedProbe
  case object MissingField extends MalformedProbe
  case object ExtraField extends MalformedProbe
  case object NonNumericCount extends MalformedProbe
  case object NegativeCount extends MalformedProbe
  case object IllegalSkuText extends MalformedProbe
  case object EmptyFinalField extends MalformedProbe
  case object EmptyRefusalCode extends MalformedProbe
  case object MultilinePayload extends MalformedProbe
  case object EmptyPayload extends MalformedProbe

  def malformedProbe(shape: MalformedProbe, skuText: String, code: String, message: String): String = shape match {
    case WrongVerb => s"PROBE|$skuText|7"
    case MissingField => s"$answerVerb|$skuText"
    case ExtraField => s"$answerVerb|$skuText|7|extra"
    case NonNumericCount => s"$answerVerb|$skuText|seven"
    case NegativeCount => s"$answerVerb|$skuText|-2"
    case IllegalSkuText => s"$answerVerb|sk u/1|7"
    case EmptyFinalField => s"$answerVerb|$skuText|"
    case EmptyRefusalCode => s"$refusedVerb||$message"
    case MultilinePayload => s"$answerVerb|$skuText|7\nsecond"
    case EmptyPayload => ""
  }

  sealed trait MalformedDirectory
  case object DirectoryWrongVerb extends MalformedDirectory
  case object DirectoryMissingField extends MalformedDirectory
  case object DirectoryExtraField extends MalformedDirectory
  case object DirectoryIllegalWarehouse extends MalformedDirectory
  case object DirectoryIllegalLocation extends MalformedDirectory
  case object DirectoryTrailingLocationSeparator extends MalformedDirectory
  case object DirectoryMultilinePayload extends MalformedDirectory

  def malformedDirectory(shape: MalformedDirectory, warehouseText: String, locationText: String): String = shape match {
    case DirectoryWrongVerb => s"CATALOG|$warehouseText|$locationText"
    case DirectoryMissingField => s"$directoryVerb|$warehouseText"
    case DirectoryExtraField => s"$directoryVerb|$warehouseText|$locationText|extra"
    case DirectoryIllegalWarehouse => s"$directoryVerb|ware house|$locationText"
    case DirectoryIllegalLocation => s"$directoryVerb|$warehouseText|$locationText/2"
    case DirectoryTrailingLocationSeparator => s"$directoryVerb|$warehouseText|$locationText,"
    case DirectoryMultilinePayload => s"$directoryVerb|$warehouseText|$locationText\nmore"
  }

  val legalNameCharacters: Vector[Char] =
    (('A' to 'Z') ++ ('a' to 'z') ++ ('0' to '9') ++ Vector('.', '_', '-')).toVector

  val legalCodeCharacters: Vector[Char] = ('A' to 'Z').toVector :+ '_'

  val messageCharacters: Vector[Char] =
    (('a' to 'z') ++ ('0' to '9') ++ Vector(' ', '.', '!')).toVector

  val arbitraryCharacters: Vector[Char] =
    legalNameCharacters ++ Vector('|', '\n', '\r', ' ', 'ü', ':', '=', ',')

  val nameText: Gen[String] = for {
    length <- Gen.choose(1, 12)
    characters <- Gen.containerOfN[Vector, Char](length, Gen.oneOf(legalNameCharacters))
  } yield characters.mkString

  val codeText: Gen[String] = for {
    length <- Gen.choose(1, 8)
    characters <- Gen.containerOfN[Vector, Char](length, Gen.oneOf(legalCodeCharacters))
  } yield characters.mkString

  val messageText: Gen[String] = for {
    length <- Gen.choose(1, 24)
    characters <- Gen.containerOfN[Vector, Char](length, Gen.oneOf(messageCharacters))
  } yield characters.mkString

  val arbitraryText: Gen[String] = for {
    length <- Gen.choose(0, 16)
    characters <- Gen.containerOfN[Vector, Char](length, Gen.oneOf(arbitraryCharacters))
  } yield characters.mkString

  val availableQuantity: Gen[Long] = Gen.chooseNum(0L, 1000000L)

  val answerShapes: Gen[AnswerLine] = for {
    skuText <- nameText
    available <- availableQuantity
  } yield AnswerLine(skuText, available)

  val refusalShapes: Gen[RefusalLine] = for {
    code <- codeText
    message <- messageText
  } yield RefusalLine(code, message)

  val malformedProbeShapes: Gen[String] = for {
    skuText <- nameText
    code <- codeText
    message <- messageText
    shape <- Gen.oneOf(
      WrongVerb, MissingField, ExtraField, NonNumericCount, NegativeCount,
      IllegalSkuText, EmptyFinalField, EmptyRefusalCode, MultilinePayload, EmptyPayload)
  } yield malformedProbe(shape, skuText, code, message)

  val malformedDirectoryShapes: Gen[String] = for {
    warehouseText <- nameText
    locationText <- nameText
    shape <- Gen.oneOf(
      DirectoryWrongVerb, DirectoryMissingField, DirectoryExtraField, DirectoryIllegalWarehouse,
      DirectoryIllegalLocation, DirectoryTrailingLocationSeparator, DirectoryMultilinePayload)
  } yield malformedDirectory(shape, warehouseText, locationText)

  /** Scripted runner: records every requested binding verbatim and plays a fixed response queue. */
  final class ScriptedRunner(responses: Vector[Try[String]]) extends LocalProcessRunner {
    private val requested: ListBuffer[ProcessRequest] = ListBuffer.empty
    private var served: Int = 0

    override def run(request: ProcessRequest): Future[String] = {
      requested += request
      val response = responses(served min (responses.length - 1))
      served += 1
      Future.fromTry(response)
    }

    def invocations: Vector[ProcessRequest] = requested.toVector
  }

  /** Throwing runner: models a helper whose machinery fails synchronously at
    * invocation — the call itself throws, no Future is ever constructed. */
  final class ThrowingRunner(error: RuntimeException) extends LocalProcessRunner {
    private val requested: ListBuffer[ProcessRequest] = ListBuffer.empty

    override def run(request: ProcessRequest): Future[String] = {
      requested += request
      throw error
    }

    def invocations: Vector[ProcessRequest] = requested.toVector
  }

  /** Test seam module: supplies the sample-owned seams (runner, execution context)
    * that the production binding does not fix, so the assembly property resolves the
    * infrastructure gate binding exactly. */
  final class CatalogSeamModule(runner: LocalProcessRunner, ec: ExecutionContext) extends AbstractModule {
    override def configure(): Unit = {
      bind(classOf[LocalProcessRunner]).toInstance(runner)
      bind(classOf[ExecutionContext]).toInstance(ec)
    }
  }
}
