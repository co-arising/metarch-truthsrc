package example.bankwealth.application.quality

import scala.meta._
import scala.meta.parsers._
import scala.meta.inputs.Position
import scala.meta.prettyprinters._

/** Structural metrics engine of the two host faces (pipeline-invocation and
  * effect), the closure-level verification unit. Layer policy:
  *
  *  - Host: the golden application sources. The sanctioned mutation face is
  *    exactly the R2(b) in-memory waiter coalescing — local `var`/assignment
  *    inside the behavior setup blocks (a `var` field, a nonlocal return,
  *    reflection, timers, randomness and mutable collections stay banned).
  *    `throw` is the sanctioned fail-closed value-domain refusal (codec slots,
  *    unrepresentable observations) and `try` is admitted only for the effect
  *    hosts' callback-boundary seam; both are pinned site-by-site by structural
  *    properties, not by this engine. Fully-qualified `java.*` references are
  *    the sanctioned zero-import form; java import statements stay banned.
  *  - Serializer: the three journal serializers. The akka serializer contract
  *    requires throwing on unrepresentable wire data — `throw` stays admitted,
  *    `try`/catch stays banned (total functions only).
  *  - Support: the property suites and this harness — no structural checks,
  *    5/2 default maxima with exact scope exceptions.
  *
  * Complexity is the source-structural McCabe measure of the template engine
  * (aggregate-state-controller): one plus decisions, match paths minus one,
  * short-circuit operators, for generators/guards, case guards; nesting counts
  * control constructs only, else-if continuation keeps the enclosing level. */
object ScalaSourceMetrics {
  final case class Counts(decisions: Int, nesting: Int) {
    def complexity: Int = 1 + decisions
  }
  final case class Scope(file: String, owner: String, kind: String, line: Int, column: Int, counts: Counts)
  final case class Violation(file: String, line: Int, reason: String)
  final case class Report(scopes: Vector[Scope], violations: Vector[Violation])

  sealed trait Layer
  object Layer {
    case object Host extends Layer
    case object Serializer extends Layer
    case object Support extends Layer
  }

  private val neutralNodes: Set[String] = Set(
    "Term.Name", "Term.Select", "Term.Apply", "Term.ApplyType", "Term.ApplyInfix", "Term.ApplyUnary",
    "Term.Tuple", "Term.Block", "Term.New", "Term.NewAnonymous", "Term.This", "Term.Super", "Term.Eta",
    "Term.Ascribe", "Term.Annotate", "Term.Interpolate", "Term.Repeated", "Term.Placeholder",
    "Term.Return", "Term.Throw", "Term.Assign", "Term.Try", "Term.TryWithHandler", "Term.Function",
    "Term.PartialFunction", "Term.Param", "Term.If", "Term.Match", "Term.While", "Term.Do", "Term.For",
    "Term.ForYield", "Term.AnonymousFunction"
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

  // Timers, randomness, wall clocks and stdout replace durable coordination —
  // banned as plain term names in every measured layer (fully-qualified forms
  // resolve through the same term-name check).
  private val bannedTermNames: Set[String] =
    Set("Await", "Random", "LocalDateTime", "Clock", "Date", "Array",
      "ArrayBuffer", "ListBuffer", "HashMap", "HashSet", "update", "set", "clear", "append",
      "println", "printStackTrace")

  // Array leaves the type ban: the byte-digest and akka wire faces legitimately
  // spell Array[Byte]; structural properties pin that it appears in no other form.
  private val bannedTypeNames: Set[String] =
    Set("Clock", "Date", "ArrayBuffer", "ListBuffer", "HashMap", "HashSet")

  // Named arguments (scalameta parses them as Term.Assign) sit in the argument
  // clause of a call; a Term.Assign anywhere else is a real assignment target.
  private def argumentClause(parent: Tree): Boolean = parent.isInstanceOf[Term.ArgClause]

  private def forbidden(tree: Tree, parent: Tree, layer: Layer): Option[String] = tree match {
    case _: Defn.Var if parent.isInstanceOf[Template] => Some("mutable-field-state")
    case _: Term.Return => Some("nonlocal-domain-return")
    case _: Term.Try | _: Term.TryWithHandler if layer == Layer.Serializer => Some("serializer-catch-control")
    case name: Type.Name if name.value == "Any" || (name.value == "AnyRef" && layer != Layer.Serializer) =>
      Some("untyped-domain-value")
    case name: Term.Name if Set("asInstanceOf", "getClass", "Class", "System", "Thread").contains(name.value) =>
      Some("reflection-or-global-domain-effect")
    case name: Type.Name if bannedTypeNames.contains(name.value) =>
      Some("implicit-domain-time-randomness-or-mutation")
    case name: Term.Name if bannedTermNames.contains(name.value) =>
      Some("implicit-domain-time-randomness-or-mutation")
    case _ => None
  }

  private def unsafeImport(tree: Tree, layer: Layer): Option[String] = tree match {
    case importer: Importer if layer != Layer.Support =>
      val path = importer.ref.syntax
      val prefixes = Vector("java.io", "java.nio", "java.time", "java.util", "scala.collection.mutable", "java.sql")
      if (prefixes.exists(path.startsWith)) Some("outside-or-effectful-domain-import")
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
      def visit(tree: Tree, parent: Tree, owner: String): Report = {
        val currentOwner = memberName(tree).map(name => owner + "." + name).getOrElse(owner)
        val childReports = tree.children.map(child => visit(child, tree, currentOwner))
        val unsupportedNode = unsupported(tree).toVector
        val structural = if (layer != Layer.Support) forbidden(tree, parent, layer).toVector ++ unsafeImport(tree, layer).toVector else Vector.empty
        val violations = (unsupportedNode ++ structural).map(reason => Violation(file, position(tree)._1, reason))
        Report(
          declaredScopes(file, currentOwner, tree) ++ childReports.flatMap(_.scopes),
          violations ++ childReports.flatMap(_.violations)
        )
      }
      visit(source, source, "root")
    }
}
