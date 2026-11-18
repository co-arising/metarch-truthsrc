package example.stockreservation.reference

import org.scalacheck.{Gen, Prop, Properties}
import org.scalacheck.Prop.forAll

import example.stockreservation.quality.{QualityInputs, ScalaSourceMetrics}

object StockReservationQualityProperties extends Properties("aggregate-rules-formal.source-quality.v2") {
  private def method(text: String): ScalaSourceMetrics.Scope = {
    val report = ScalaSourceMetrics.analyze("sample.scala", text, domain = false)
      .fold(error => throw new IllegalArgumentException(error), identity)
    require(report.violations.isEmpty, report.violations.toString)
    report.scopes.find(_.kind == "method").getOrElse(throw new IllegalArgumentException("Missing method"))
  }

  private def complexity(body: String): Int = method(s"object Sample { def choose(a: Boolean): Int = $body }")
    .counts.complexity

  private val lengths = Gen.choose(0, 7)

  property("AST: generated if chains have independently known complexity") = forAll(lengths) { length =>
    val body = (0 until length).map(_ => "if (a) 1 else ").mkString + "0"
    complexity(body) == length + 1
  }

  property("AST: generated short-circuit operators are counted") = forAll(lengths) { length =>
    val expression = Vector.fill(length + 1)("a").mkString(" && ")
    val source = s"object Sample { def choose(a: Boolean): Boolean = $expression }"
    method(source).counts.complexity == length + 1
  }

  property("AST: comments and branch-like literal text add no decisions") = forAll(lengths) { length =>
    val noise = "/* if match case && || */" * length
    method(s"object Sample { def text = { $noise \"if match case && ||\" } }").counts.complexity == 1
  }

  property("AST: else-if is one control nesting level") = Prop.secure {
    method("object Sample { def choose(a: Boolean) = if (a) 1 else if (a) 2 else 3 }")
      .counts == ScalaSourceMetrics.Counts(2, 1)
  }
  property("AST: nested then branches retain real depth") = Prop.secure {
    method("object Sample { def choose(a: Boolean) = if (a) { if (a) 1 else 2 } else 3 }")
      .counts == ScalaSourceMetrics.Counts(2, 2)
  }
  property("AST: HOF closure decisions count both in parent and closure") = Prop.secure {
    val report = ScalaSourceMetrics.analyze("sample.scala",
      "object Sample { def choose = List(1).map(x => if (x > 0) 1 else 2) }", domain = false).toOption.get
    val counts = report.scopes.filter(scope => Set("method", "lambda").contains(scope.kind)).map(_.counts.complexity)
    counts.size == 2 && counts.forall(_ == 2)
  }
  property("AST: partial functions and pattern alternatives are explicit paths") = Prop.secure {
    val source = "object Sample { def choose = { case 1 | 2 => 1; case _ => 0 }: PartialFunction[Int,Int] }"
    method(source).counts.complexity == 3
  }
  property("AST: match guards and nonexhaustive exits are counted") = Prop.secure {
    method("object Sample { def choose(a: Int) = a match { case 1 if a > 0 => 2; case _ => 3 } }")
      .counts.complexity == 3
  }
  property("AST: for generators and guards are not invisible") = Prop.secure {
    method("object Sample { def choose = for { x <- List(1); if x > 0 } yield x }").counts.complexity == 3
  }
  property("AST: while and do loops are counted once each") = Prop.secure {
    method("object Sample { def choose(a: Boolean) = { while(a) (); do () while(a) } }")
      .counts.complexity == 3
  }
  property("AST: defaults and initialization are registered") = Prop.secure {
    val report = ScalaSourceMetrics.analyze("sample.scala",
      "class Sample(a: Boolean = true) { val b = if(a) 1 else 2; def choose(x: Int = 1) = x }", false).toOption.get
    Set("method", "value", "initialization", "default-parameter").subsetOf(report.scopes.map(_.kind).toSet)
  }
  property("negative: invalid syntax cannot become an empty successful report") = Prop.secure {
    ScalaSourceMetrics.analyze("broken.scala", "object {", true).isLeft
  }
  property("negative: mutable domain state is rejected") = Prop.secure {
    ScalaSourceMetrics.analyze("bad.scala", "object Bad { var state = 0 }", true)
      .toOption.get.violations.exists(_.reason == "mutable-domain-state")
  }
  property("negative: outer dependencies and time are rejected") = Prop.secure {
    val source = "import example.stockreservation.infrastructure.Store; object Bad { val t = System.nanoTime() }"
    val reasons = ScalaSourceMetrics.analyze("bad.scala", source, true).toOption.get.violations.map(_.reason).toSet
    Set("outside-or-effectful-domain-import", "reflection-or-global-domain-effect").subsetOf(reasons)
  }
  property("negative: HOF cannot hide a scope exceeding five") = Prop.secure {
    val chain = Vector.fill(6)("if (x > 0) 1 else ").mkString + "0"
    val report = ScalaSourceMetrics.analyze("bad.scala", s"object Bad { def run = List(1).map(x => $chain) }", true)
      .toOption.get
    report.scopes.filter(scope => Set("method", "lambda").contains(scope.kind)).forall(_.counts.complexity == 7)
  }
  property("negative: parent by-name arguments cannot hide branches") = Prop.secure {
    val source = "class Base(a: => Int); class Sample extends Base(if(true) 1 else if(false) 2 else 3)"
    val report = ScalaSourceMetrics.analyze("bad.scala", source, true).toOption.get
    report.scopes.exists(scope => scope.kind == "parent-initialization" && scope.counts.complexity == 3)
  }
  property("negative: qualified clock and mutable arrays are rejected") = Prop.secure {
    val source = "object Bad { val clock = java.time.Clock.systemUTC(); val a = Array(0); def run = a.update(0,1) }"
    ScalaSourceMetrics.analyze("bad.scala", source, true).toOption.get.violations
      .exists(_.reason == "implicit-domain-time-randomness-or-mutation")
  }
  property("source: every admitted file has executable scopes and obeys the fixed quality policy") = Prop.secure {
    val reports = QualityInputs.reports()
    reports.nonEmpty && reports.forall { case (input, report) => QualityInputs.withinLimits(input, report) }
  }
  private def scopePresent(rule: QualityInputs.ExceptionRule, input: QualityInputs.Input,
      report: ScalaSourceMetrics.Report): Boolean =
    !input.domain && report.scopes.exists(scope =>
      scope.file == rule.file && scope.owner == rule.owner && scope.kind == rule.kind)

  property("source: exception list is precise, justified and cannot relax domain methods") = Prop.secure {
    val rules = QualityInputs.exceptions()
    val reports = QualityInputs.reports()
    rules.forall { rule =>
      rule.reason.nonEmpty && reports.exists { case (input, report) => scopePresent(rule, input, report) }
    }
  }
}
