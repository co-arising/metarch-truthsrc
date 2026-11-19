package example.stockreservation.controllers.quality

import java.nio.file.Paths

import org.scalacheck.Test

import example.stockreservation.controllers.{ControllerProperties, ControllerQualityProperties}

object QualityMain {
  private def metric(scope: ScalaSourceMetrics.Scope): String = JsonOutput.obj(
    "file" -> JsonOutput.string(scope.file), "owner" -> JsonOutput.string(scope.owner),
    "kind" -> JsonOutput.string(scope.kind), "line" -> scope.line.toString,
    "column" -> scope.column.toString, "complexity" -> scope.counts.complexity.toString,
    "nesting" -> scope.counts.nesting.toString
  )

  private def analyze(): Unit = {
    val reports = QualityInputs.reports()
    val failed = reports.filterNot { case (input, report) => QualityInputs.withinLimits(input, report) }
    val scopes = reports.flatMap(_._2.scopes)
    val violations = reports.flatMap(_._2.violations).map(value => JsonOutput.obj(
      "file" -> JsonOutput.string(value.file), "line" -> value.line.toString,
      "reason" -> JsonOutput.string(value.reason)
    ))
    val excess = reports.flatMap { case (input, report) =>
      report.scopes.filter { scope =>
        val (cc, nesting) = QualityInputs.limit(scope, input.layer)
        scope.counts.complexity > cc || scope.counts.nesting > nesting
      }
    }
    JsonOutput.save(Paths.get(sys.props("quality.result")), JsonOutput.obj(
      "phase" -> JsonOutput.string("metrics"), "passed" -> failed.isEmpty.toString,
      "files" -> reports.size.toString, "scopes" -> JsonOutput.array(scopes.map(metric)),
      "violations" -> JsonOutput.array(violations), "excess" -> JsonOutput.array(excess.map(metric))
    ))
    require(failed.isEmpty, "Source quality gate failed; see metrics result")
  }

  private def testResult(name: String, result: Test.Result): String = JsonOutput.obj(
    "name" -> JsonOutput.string(name), "passed" -> result.passed.toString,
    "status" -> JsonOutput.string(result.status.toString), "succeeded" -> result.succeeded.toString,
    "discarded" -> result.discarded.toString, "elapsedMs" -> result.time.toString,
    "frequency" -> JsonOutput.string(result.freqMap.toString)
  )

  private def properties(seed: Long): Unit = {
    val suites = Vector(ControllerProperties, ControllerQualityProperties)
    import scala.jdk.CollectionConverters._
    val expected = java.nio.file.Files.readAllLines(Paths.get(sys.props("quality.expected")))
      .asScala.toVector.sorted
    require(expected.nonEmpty && expected.distinct.size == expected.size, "Independent property inventory required")
    val registered = suites.flatMap(_.properties.map(_._1)).sorted
    require(registered == expected, "Registered property inventory differs from frozen contract")
    val params = Test.Parameters.default.withWorkers(1).withMinSuccessfulTests(1000).withInitialSeed(seed)
    val results = suites.flatMap(suite => Test.checkProperties(params, suite))
    val names = results.map(_._1).sorted
    require(names == expected, "Missing or unexpected ScalaCheck properties")
    val passed = results.forall(_._2.passed)
    JsonOutput.save(Paths.get(sys.props("quality.result")), JsonOutput.obj(
      "phase" -> JsonOutput.string("properties"), "seed" -> seed.toString,
      "seedBase64" -> JsonOutput.string(org.scalacheck.rng.Seed(seed).toBase64),
      "minimumSuccessfulTests" -> "1000", "workers" -> "1", "passed" -> passed.toString,
      "results" -> JsonOutput.array(results.map { case (name, result) => testResult(name, result) })
    ))
    results.foreach { case (name, result) => println(s"$name: ${result.status}; succeeded=${result.succeeded}") }
    require(passed, "ScalaCheck failed; see property results")
  }

  def main(args: Array[String]): Unit = args.toList match {
    case "metrics" :: Nil => analyze()
    case "properties" :: seed :: Nil => properties(seed.toLong)
    case _ => throw new IllegalArgumentException("Expected metrics or properties <seed>")
  }
}
