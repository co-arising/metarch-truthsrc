package example.bankwealth.application.quality

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Path, Paths}

import example.bankwealth.application.quality.ScalaSourceMetrics.Layer

object QualityInputs {
  final case class Input(relative: String, path: Path, layer: Layer)

  def layerOf(column: String): Layer = column match {
    case "host" => Layer.Host
    case "serializer" => Layer.Serializer
    case "support" => Layer.Support
    case other => throw new IllegalArgumentException("Unknown source layer: " + other)
  }

  def sources(): Vector[Input] = {
    val listing = Paths.get(sys.props("quality.sources"))
    val rows = Files.readAllLines(listing, StandardCharsets.UTF_8)
    import scala.jdk.CollectionConverters._
    val inputs = rows.asScala.toVector.map { row =>
      val columns = row.split("\t", -1)
      require(columns.length == 3, "Exact source listing required")
      Input(columns(0), Paths.get(columns(1)), layerOf(columns(2)))
    }
    require(inputs.nonEmpty && inputs.map(_.relative).distinct.size == inputs.size, "Nonempty unique sources required")
    inputs
  }

  def text(input: Input): String = new String(Files.readAllBytes(input.path), StandardCharsets.UTF_8)

  def reports(): Vector[(Input, ScalaSourceMetrics.Report)] = sources().map { input =>
    val result = ScalaSourceMetrics.analyze(input.relative, text(input), input.layer)
    input -> result.fold(error => throw new IllegalArgumentException(error), identity)
  }

  final case class ExceptionRule(file: String, owner: String, kind: String, maximum: Int, nesting: Int, reason: String)

  def exceptions(): Vector[ExceptionRule] = {
    import scala.jdk.CollectionConverters._
    val path = Paths.get(sys.props("quality.exceptions"))
    Files.readAllLines(path, StandardCharsets.UTF_8).asScala.toVector.filter(_.nonEmpty).map { row =>
      val columns = row.split("\t", -1)
      require(columns.length == 6, "Exact scope exception required")
      ExceptionRule(columns(0), columns(1), columns(2), columns(3).toInt, columns(4).toInt, columns(5))
    }
  }

  // The golden-face maxima are judged frozen bounds at the measured maxima of
  // the hand-balanced golden shapes (quality-policy.json): a scope that outgrows
  // them is a shape-rewrite signal, never a bound bump.
  private def layerLimit(layer: Layer): (Int, Int) = layer match {
    case Layer.Host => (45, 5)
    case Layer.Serializer => (11, 2)
    case Layer.Support => (5, 2)
  }

  def limit(scope: ScalaSourceMetrics.Scope, layer: Layer): (Int, Int) = {
    val selected = exceptions().filter(rule => rule.file == scope.file && rule.owner == scope.owner && rule.kind == scope.kind)
    require(selected.size <= 1, "Ambiguous scope exception")
    if (layer == Layer.Host || layer == Layer.Serializer) layerLimit(layer)
    else selected.headOption.map(rule => (rule.maximum, rule.nesting)).getOrElse(layerLimit(layer))
  }

  def withinLimits(input: Input, report: ScalaSourceMetrics.Report): Boolean =
    report.violations.isEmpty && report.scopes.nonEmpty && report.scopes.forall { scope =>
      val (complexity, nesting) = limit(scope, input.layer)
      scope.counts.complexity <= complexity && scope.counts.nesting <= nesting
    }
}
