package example.stockreservation.connectors.quality

import scala.meta._
import scala.meta.parsers._
import scala.meta.inputs.Position
import scala.meta.prettyprinters._

object ScalaSourceMetrics {
  final case class Counts(decisions: Int, nesting: Int) {
    def complexity: Int = 1 + decisions
  }
  final case class Scope(file: String, owner: String, kind: String, line: Int, column: Int, counts: Counts)
  final case class Violation(file: String, line: Int, reason: String)
  final case class Report(scopes: Vector[Scope], violations: Vector[Violation])

  /** Source layer for the structural policy: pure domain, application/infrastructure
    * boundary (the connector port contract), or support (tests and quality harness). */
  sealed trait Layer
  object Layer {
    case object Domain extends Layer
    case object Boundary extends Layer
    case object Support extends Layer
  }

  private val neutralNodes: Set[String] = Set(
    "Term.Name", "Term.Select", "Term.Apply", "Term.ApplyType", "Term.ApplyInfix", "Term.ApplyUnary",
    "Term.Tuple", "Term.Block", "Term.New", "Term.This", "Term.Super", "Term.Eta", "Term.Ascribe",
    "Term.Annotate", "Term.Interpolate", "Term.Repeated", "Term.Placeholder", "Term.Return", "Term.Throw",
    "Term.Assign", "Term.Try", "Term.TryWithHandler", "Term.Function", "Term.PartialFunction",
    "Term.Param", "Term.If", "Term.Match", "Term.While", "Term.Do", "Term.For", "Term.ForYield",
    "Term.AnonymousFunction"
  )

  def parseSource(text: String): Either[String, Source] = {
    implicit val dialect: Dialect = dialects.Scala213
    text.parse[Source] match {
      case Parsed.Success(source) => Right(source)
      case error: Parsed.Error => Left(error.message)
    }
  }

  private def alternatives(pattern: Pat): Int = pattern match {
    case Pat.Alternative(left, right) => alternatives(left) + alternatives(right)
    case _ => 1
  }

  private def branchCount(cases: List[Case]): Int = {
    val paths = cases.map(entry => alternatives(entry.pat)).sum
    val hasDefault = cases.exists(entry => entry.pat.isInstanceOf[Pat.Wildcard] && entry.cond.isEmpty)
    math.max(0, paths - 1) + (if (hasDefault) 0 else 1)
  }

  private def ownDecisions(tree: Tree): Int = tree match {
    case _: Term.If | _: Term.While | _: Term.Do => 1
    case Term.ApplyInfix(_, operator, _, _) => if (Set("&&", "||").contains(operator.value)) 1 else 0
    case Term.Apply(Term.Select(_, operator), _) => if (Set("&&", "||").contains(operator.value)) 1 else 0
    case Term.Match(_, cases) => branchCount(cases)
    case Term.PartialFunction(cases) => branchCount(cases)
    case Term.Try(_, cases, _) => if (cases.isEmpty) 0 else branchCount(cases)
    case _: Enumerator.Generator | _: Enumerator.Guard => 1
    case entry: Case => if (entry.cond.nonEmpty) 1 else 0
    case _ => 0
  }

  private def control(tree: Tree): Boolean = tree match {
    case _: Term.If | _: Term.Match | _: Term.While | _: Term.Do | _: Term.For | _: Term.ForYield => true
    case _ => false
  }

  private def childCounts(parent: Tree, child: Tree, depth: Int): Counts = {
    val next = parent match {
      case statement: Term.If if child.eq(statement.elsep) && child.isInstanceOf[Term.If] => depth - 1
      case _ => depth
    }
    count(child, next)
  }

  private def nestedDefinition(tree: Tree): Boolean = tree match {
    case _: Defn.Def | _: Defn.Class | _: Defn.Trait | _: Defn.Object => true
    case _ => false
  }

  private def count(tree: Tree, depth: Int): Counts =
    if (nestedDefinition(tree)) Counts(0, depth)
    else {
      val here = depth + (if (control(tree)) 1 else 0)
      val nested = tree.children.map(child => childCounts(tree, child, here))
      Counts(ownDecisions(tree) + nested.map(_.decisions).sum, (here +: nested.map(_.nesting)).max)
    }

  def counts(body: Tree): Counts = count(body, 0)

  private def position(tree: Tree): (Int, Int) =
    if (tree.pos == Position.None) (0, 0) else (tree.pos.startLine + 1, tree.pos.startColumn + 1)

  private def scope(file: String, owner: String, kind: String, tree: Tree): Scope = {
    val (line, column) = position(tree)
    Scope(file, owner, kind, line, column, counts(tree))
  }

  private def memberName(tree: Tree): Option[String] = tree match {
    case definition: Defn.Def => Some(definition.name.value)
    case definition: Defn.Class => Some(definition.name.value)
    case definition: Defn.Trait => Some(definition.name.value)
    case definition: Defn.Object => Some(definition.name.value)
    case _ => None
  }

  private def declaredScopes(file: String, owner: String, tree: Tree): Vector[Scope] = tree match {
    case definition: Defn.Def => Vector(scope(file, owner, "method", definition.body))
    case constructor: Ctor.Secondary => Vector(scope(file, owner + ".<init>", "constructor", constructor))
    case value: Defn.Val => Vector(scope(file, owner + "." + value.pats.map(_.syntax).mkString(","), "value", value.rhs))
    case value: Defn.Var => value.rhs.toVector.map(body => scope(file, owner, "variable", body))
    case function: Term.Function => Vector(scope(file, owner + s".lambda@${position(function)._1}", "lambda", function))
    case function: Term.AnonymousFunction =>
      Vector(scope(file, owner + s".anonymous@${position(function)._1}", "anonymous-function", function))
    case function: Term.PartialFunction =>
      Vector(scope(file, owner + s".partial@${position(function)._1}", "partial-function", function))
    case template: Template =>
      template.stats.filterNot(isDeclaration).zipWithIndex.map { case (statement, index) =>
        scope(file, owner + s".<init:$index>", "initialization", statement)
      }.toVector
    case initialization: Init => Vector(scope(file, owner + ".<parent>", "parent-initialization", initialization))
    case declaration: Decl.Def =>
      Vector(Scope(file, owner + "." + declaration.name.value, "abstract-declaration",
        position(declaration)._1, position(declaration)._2, Counts(-1, 0)))
    case parameter: Term.Param => parameter.default.toVector.map(body => scope(file, owner, "default-parameter", body))
    case _ => Vector.empty
  }

  private def isDeclaration(tree: Tree): Boolean = tree match {
    case _: Defn.Def | _: Defn.Class | _: Defn.Object | _: Defn.Trait | _: Decl.Def | _: Defn.Type => true
    case _ => false
  }

  // Domain mode keeps the family aggregate-rules-formal v3 forbidden set unchanged.
  // Boundary mode admits only the Future contract (the async capability face) and
  // the port-to-implementation import clause; Await and everything else stay banned.
  private def bannedTermNames(layer: Layer): Set[String] =
    if (layer == Layer.Boundary)
      Set("Await", "Random", "UUID", "Instant", "LocalDateTime", "Clock", "Date", "Array",
        "ArrayBuffer", "ListBuffer", "HashMap", "HashSet", "update", "set", "clear", "append")
    else
      Set("Await", "Future", "Random", "UUID", "Instant", "LocalDateTime", "Clock", "Date",
        "Array", "ArrayBuffer", "ListBuffer", "HashMap", "HashSet", "update", "set", "clear", "append")

  private def forbidden(tree: Tree, layer: Layer): Option[String] = tree match {
    case _: Defn.Var | _: Term.Assign => Some("mutable-domain-state")
    case _: Term.Return => Some("nonlocal-domain-return")
    case _: Term.Throw | _: Term.Try | _: Term.TryWithHandler => Some("domain-exception-control")
    case name: Type.Name if name.value == "Any" || name.value == "AnyRef" => Some("untyped-domain-value")
    case name: Term.Name if Set("asInstanceOf", "getClass", "Class", "System", "Thread").contains(name.value) =>
      Some("reflection-or-global-domain-effect")
    case name: Type.Name if Set("Clock", "Date", "Array", "ArrayBuffer", "ListBuffer", "HashMap", "HashSet")
        .contains(name.value) => Some("implicit-domain-time-randomness-or-mutation")
    case name: Term.Name if bannedTermNames(layer).contains(name.value) =>
      Some("implicit-domain-time-randomness-or-mutation")
    case _ => None
  }

  // Import direction rules per layer, one named predicate each. Domain sources
  // admit no application or infrastructure imports. Boundary sources are
  // direction-aware: an application (kernel-facing) file must not import
  // infrastructure — the kernel isolation the multi-module form requires — while
  // an infrastructure file may import application and infrastructure. Support
  // sources are unrestricted.
  private def domainOutward(path: String): Boolean =
    path.contains(".application") || path.contains(".infrastructure")

  private def boundaryOutward(file: String, path: String): Boolean =
    file.contains("/application/") && path.contains(".infrastructure")

  private def outwardImport(file: String, layer: Layer, path: String): Boolean = layer match {
    case Layer.Domain => domainOutward(path)
    case Layer.Boundary => boundaryOutward(file, path)
    case Layer.Support => false
  }

  private def unsafeImport(tree: Tree, file: String, layer: Layer): Option[String] = tree match {
    case importer: Importer if layer != Layer.Support =>
      val path = importer.ref.syntax
      val prefixes = Vector("akka", "play", "java.io", "java.nio", "java.time", "java.util", "scala.collection.mutable", "java.sql")
      if (outwardImport(file, layer, path) || prefixes.exists(path.startsWith))
        Some("outside-or-effectful-domain-import")
      else None
    case _ => None
  }

  private def unrecognizedTerm(term: Term): Boolean =
    !term.isInstanceOf[Lit] && !neutralNodes(term.productPrefix) && ownDecisions(term) == 0 && !control(term)

  private def unsupported(tree: Tree): Option[String] = tree match {
    case term: Term if unrecognizedTerm(term) => Some("unsupported-term:" + term.productPrefix)
    case _ => None
  }

  def analyze(file: String, text: String, layer: Layer): Either[String, Report] =
    parseSource(text).map { source =>
      def visit(tree: Tree, owner: String): Report = {
        val currentOwner = memberName(tree).map(name => owner + "." + name).getOrElse(owner)
        val childReports = tree.children.map(child => visit(child, currentOwner))
        val unsupportedNode = unsupported(tree).toVector
        val structural = if (layer != Layer.Support) forbidden(tree, layer).toVector ++ unsafeImport(tree, file, layer).toVector else Vector.empty
        val violations = (unsupportedNode ++ structural).map(reason => Violation(file, position(tree)._1, reason))
        Report(
          declaredScopes(file, currentOwner, tree) ++ childReports.flatMap(_.scopes),
          violations ++ childReports.flatMap(_.violations)
        )
      }
      visit(source, "root")
    }
}
