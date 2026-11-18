package example.stockreservation.connectors

import org.scalacheck.{Gen, Prop, Properties}
import org.scalacheck.Prop.forAll

import example.stockreservation.connectors.quality.ScalaSourceMetrics
import example.stockreservation.connectors.quality.ScalaSourceMetrics.Layer

object CatalogQualityProperties extends Properties("connector-implementation.source-quality.v1") {
  private def scopes(text: String, layer: Layer): Vector[ScalaSourceMetrics.Scope] = {
    val report = ScalaSourceMetrics.analyze("sample.scala", text, layer)
      .fold(error => throw new IllegalArgumentException(error), identity)
    require(report.violations.isEmpty, report.violations.toString)
    report.scopes
  }

  private def method(text: String, layer: Layer = Layer.Support): ScalaSourceMetrics.Scope =
    scopes(s"object Sample { def choose(a: Boolean): Int = $text }", layer)
      .find(_.kind == "method").getOrElse(throw new IllegalArgumentException("Missing method"))

  private def complexity(body: String): Int = method(body).counts.complexity

  private def violations(text: String, layer: Layer, file: String = "sample.scala"): Set[String] =
    ScalaSourceMetrics.analyze(file, text, layer).toOption.get.violations.map(_.reason).toSet

  private val lengths = Gen.choose(0, 7)

  property("AST: generated if chains have independently known complexity") = forAll(lengths) { length =>
    val body = (0 until length).map(_ => "if (a) 1 else ").mkString + "0"
    complexity(body) == length + 1
  }

  property("AST: generated short-circuit operators are counted") = forAll(lengths) { length =>
    val expression = Vector.fill(length + 1)("a").mkString(" && ")
    method(expression).counts.complexity == length + 1
  }

  property("AST: comments and branch-like literal text add no decisions") = forAll(lengths) { length =>
    val noise = "/* if match case && || */" * length
    method(s"{ $noise \"if match case && ||\" }").counts.complexity == 1
  }

  property("AST: else-if is one control nesting level") = Prop.secure {
    method("if (a) 1 else if (a) 2 else 3").counts == ScalaSourceMetrics.Counts(2, 1)
  }
  property("AST: nested then branches retain real depth") = Prop.secure {
    method("if (a) { if (a) 1 else 2 } else 3").counts == ScalaSourceMetrics.Counts(2, 2)
  }
  property("AST: HOF closure decisions count both in parent and closure") = Prop.secure {
    val report = ScalaSourceMetrics.analyze("sample.scala",
      "object Sample { def choose = List(1).map(x => if (x > 0) 1 else 2) }", Layer.Support).toOption.get
    val counts = report.scopes.filter(scope => Set("method", "lambda").contains(scope.kind)).map(_.counts.complexity)
    counts.size == 2 && counts.forall(_ == 2)
  }
  property("AST: partial functions and pattern alternatives are explicit paths") = Prop.secure {
    method("{ case 1 | 2 => 1; case _ => 0 }: PartialFunction[Int,Int]").counts.complexity == 3
  }
  property("AST: match guards and nonexhaustive exits are counted") = Prop.secure {
    method("a match { case 1 if a > 0 => 2; case _ => 3 }").counts.complexity == 3
  }
  property("AST: for generators and guards are not invisible") = Prop.secure {
    method("for { x <- List(1); if x > 0 } yield x").counts.complexity == 3
  }
  property("AST: while and do loops are counted once each") = Prop.secure {
    method("{ while(a) (); do () while(a) }").counts.complexity == 3
  }
  property("AST: defaults and initialization are registered") = Prop.secure {
    val report = ScalaSourceMetrics.analyze("sample.scala",
      "class Sample(a: Boolean = true) { val b = if(a) 1 else 2; def choose(x: Int = 1) = x }", Layer.Support).toOption.get
    Set("method", "value", "initialization", "default-parameter").subsetOf(report.scopes.map(_.kind).toSet)
  }
  property("AST: abstract declarations register with no executable body") = Prop.secure {
    val report = ScalaSourceMetrics.analyze("sample.scala",
      "trait Sample { def face(script: String): Int; def bare(): Int }", Layer.Boundary).toOption.get
    val declared = report.scopes.filter(_.kind == "abstract-declaration")
    declared.size == 2 && declared.forall(_.counts == ScalaSourceMetrics.Counts(-1, 0))
  }
  property("AST: overflow complexity is measured exactly, never clamped") = Prop.secure {
    val body = (0 until 6).map(_ => "if (a) 1 else ").mkString + "0"
    method(body).counts.complexity == 7
  }
  property("AST: boundary mode admits the Future contract that domain mode rejects") = Prop.secure {
    val source = "object Sample { def face(): scala.concurrent.Future[Int] = Future.successful(1) }"
    scopes(source, Layer.Boundary).nonEmpty &&
      violations(source, Layer.Domain).contains("implicit-domain-time-randomness-or-mutation")
  }
  property("AST: boundary mode still rejects Await and reflection") = Prop.secure {
    val awaiting = "object Sample { def face(f: scala.concurrent.Future[Int]): Int = Await.result(f, scala.concurrent.duration.Duration.Inf) }"
    val reflecting = "object Sample { def face(a: Any): Int = a.asInstanceOf[Int] }"
    violations(awaiting, Layer.Boundary).contains("implicit-domain-time-randomness-or-mutation") &&
      violations(reflecting, Layer.Boundary).contains("reflection-or-global-domain-effect")
  }
  property("AST: boundary infrastructure files admit application imports; application files reject them") = Prop.secure {
    val portImport = "import example.stockreservation.application.connectors.Port; object Sample { def face(): Int = 1 }"
    val implImport = "import example.stockreservation.infrastructure.connectors.Impl; object Sample { def face(): Int = 1 }"
    val infrastructureFile = "app/x/infrastructure/connectors/Impl.scala"
    val applicationFile = "app/x/application/connectors/Port.scala"
    violations(portImport, Layer.Boundary, infrastructureFile).isEmpty &&
      violations(implImport, Layer.Boundary, applicationFile).contains("outside-or-effectful-domain-import")
  }
  property("AST: boundary mode still rejects effectful import prefixes in both directions") = Prop.secure {
    val effectful = "import java.util.HashMap; object Sample { def face(): Int = 1 }"
    violations(effectful, Layer.Boundary, "app/x/infrastructure/connectors/Impl.scala")
      .contains("outside-or-effectful-domain-import") &&
      violations(effectful, Layer.Boundary, "app/x/application/connectors/Port.scala")
        .contains("outside-or-effectful-domain-import")
  }
  property("AST: domain mode still rejects application and infrastructure imports") = Prop.secure {
    val source = "import example.stockreservation.infrastructure.connectors.Impl; object Sample { def face(): Int = 1 }"
    violations(source, Layer.Domain).contains("outside-or-effectful-domain-import")
  }
  property("negative: invalid syntax cannot become an empty successful report") = Prop.secure {
    ScalaSourceMetrics.analyze("broken.scala", "object {", Layer.Domain).isLeft
  }
  property("negative: mutable domain state is rejected") = Prop.secure {
    violations("object Bad { var state = 0 }", Layer.Domain).contains("mutable-domain-state")
  }
  property("negative: outer dependencies and time are rejected") = Prop.secure {
    val source = "import example.stockreservation.infrastructure.Store; object Bad { val t = System.nanoTime() }"
    val reasons = violations(source, Layer.Domain)
    reasons.contains("outside-or-effectful-domain-import") && reasons.contains("reflection-or-global-domain-effect")
  }
  property("negative: boundary mode still rejects mutable collection and mutation term names") = Prop.secure {
    val typed = "import scala.collection.mutable.ArrayBuffer; object Bad { def face(): Int = { val b = ArrayBuffer(1); b.append(2); 0 } }"
    val reasons = violations(typed, Layer.Boundary)
    reasons.contains("outside-or-effectful-domain-import") &&
      reasons.contains("implicit-domain-time-randomness-or-mutation")
  }
}
