package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.TypeResolverDSL
import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.products._

object ProductDomainTemplate {
  private def sym(value: String): String = NamingConventions.productSymbol(value)
  private def str(value: String): String = ujson.write(ujson.Str(value))
  private def typeText(ref: net.imadz.codegen.scaffolding.cqrs.TypeRef): String = ref.fqn +
    (if (ref.typeParams.isEmpty) "" else ref.typeParams.map(typeText).mkString("[", ", ", "]"))
  private def tpe(value: NominalType, model: ProductDomainModel): String = typeText(TypeResolverDSL.productType(value, model.packages))
  private def named(ref: QualifiedReference, model: ProductDomainModel): String = tpe(NominalType.Named(ref), model)
  private def path(pkg: String, suffix: String): String = NamingConventions.productPackagePath(pkg, suffix)
  private def declaration(ref: QualifiedReference, model: ProductDomainModel): ReferenceDeclaration = model.layout.declarations.find(_.ref == ref).get
  private def textual(value: String, t: NominalType, model: ProductDomainModel): String = t match {
    case NominalType.Named(r) => textual(value + ".value", declaration(r, model).valueType.get, model)
    case _ => value
  }
  private def descriptor(expression: DecisionExpression, model: ProductDomainModel): Option[ExactType] = expression match {
    case DecisionExpression.Reference(r) => declaration(r, model).valueType.collect { case NominalType.Named(ref) => ref }.flatMap(ref => model.exact.find(_.domain == ref))
    case DecisionExpression.Member(a, member) => descriptor(a, model).filter(_.amountMember.contains(member))
    case DecisionExpression.Binary(op, l, r) if Set("add", "subtract")(op) => descriptor(l, model).orElse(descriptor(r, model))
    case DecisionExpression.Binary("map-lookup", l, _) => l match {
      case DecisionExpression.Reference(ref) => declaration(ref, model).valueType.collect { case NominalType.Mapping(_, NominalType.Named(value)) => value }.flatMap(ref => model.exact.find(_.domain == ref))
      case _ => None
    }
    case _ => None
  }
  private def commandOf(expression: DecisionExpression): QualifiedReference = expression.references.find(_.kind == "parameter") match {
    case Some(r) => QualifiedReference(r.context, "command", Vector(r.owner.head), r.owner(1))
    case None => expression.references.find(_.kind == "state-field").map(r => QualifiedReference(r.context, "command", r.owner, "target"))
      .getOrElse(QualifiedReference("literal", "command", Vector("literal"), "literal"))
  }
  private def decisionType(expression: DecisionExpression, model: ProductDomainModel): NominalType =
    DomainDecision.infer(expression, commandOf(expression), model.layout, model.exact,
      model.footprint.find(_.id == "domain-decision").getOrElse(throw new IllegalArgumentException("explicit decision footprint required")).version)
      .fold(e => throw new IllegalArgumentException(e), identity)
  def decision(expression: DecisionExpression, model: ProductDomainModel): String = {
    import DecisionExpression._
    def render(e: DecisionExpression): String = decision(e, model)
    def scalar(e: DecisionExpression, exact: ExactType): String = decisionType(e, model) match {
      case _: NominalType.Named => "(" + render(e) + ")." + sym(exact.amountMember.map(_.id).getOrElse("value"))
      case _ => render(e)
    }
    def units(e: DecisionExpression, exact: ExactType): Vector[String] = {
      if (exact.form != "unit-decimal") Vector.empty
      else decisionType(e, model) match {
        case _: NominalType.Named => Vector("(" + render(e) + ")." + sym(exact.unitMember.get.id))
        case _ => e match {
          case Member(a, _) => Vector("(" + render(a) + ")." + sym(exact.unitMember.get.id))
          case Binary(op, l, r) if Set("add", "subtract")(op) => units(l, exact) ++ units(r, exact)
          case _ => Vector.empty
        }
      }
    }
    def checked(exact: ExactType, operands: Vector[DecisionExpression], result: String): String = {
      val values = operands.flatMap(units(_, exact)).distinct
      if (values.size <= 1) result else "{ require(" + values.tail.map(u => values.head + " == " + u).mkString(" && ") + ", \"exact units differ\"); " + result + " }"
    }
    expression match {
      case Reference(r) => (if (r.kind == "state-field") "state." else "p.") + sym(r.id)
      case BooleanLiteral(v) => v.toString
      case StringLiteral(v) => str(v)
      case IntegerLiteral(v) => "java.lang.Long.parseLong(" + str(v) + ")"
      case DecimalLiteral(v) => "BigDecimal(" + str(v) + ")"
      case Member(a, r) => "(" + render(a) + ")." + sym(r.id)
      case Unary("text-value", a) => "(" + render(a) + ").value"
      case Unary("not", a) => "!(" + render(a) + ")"
      case Unary("exact-positive", a) => "(" + render(a) + ").isPositive"
      case Unary(op, a) => "(" + render(a) + ")." + Map("is-empty" -> "isEmpty", "non-empty" -> "nonEmpty", "map-keys" -> "keys")(op)
      case Binary(op, l, r) if Set("add", "subtract")(op) => descriptor(expression, model) match {
        case None => "java.lang.Math." + (if (op == "add") "addExact" else "subtractExact") + "(" + render(l) + ", " + render(r) + ")"
        case Some(exact) =>
          val amount = named(exact.domain, model) + ".checkedAmount(" + named(exact.domain, model) + ".checkedAmount(" + scalar(l, exact) + ")" + (if (op == "add") " + " else " - ") + named(exact.domain, model) + ".checkedAmount(" + scalar(r, exact) + "))"
          val result = decisionType(expression, model) match {
            case _: NominalType.Named => named(exact.domain, model) + "(" + amount + (if (exact.form == "unit-decimal") ", " + units(l, exact).head else "") + ")"
            case _ => amount
          }
          checked(exact, Vector(l, r), result)
      }
      case Binary("collection-covered", l, r) => "(" + render(r) + ").forall((" + render(l) + ").contains)"
      case Binary("exact-sufficient", l, r) => decisionType(l, model) match {
        case _: NominalType.Mapping => "(" + render(l) + ").get((" + render(r) + ")." + sym(descriptor(r, model).get.unitMember.get.id) + ").exists(_.compareSameUnit(" + render(r) + ") >= 0)"
        case _ => "(" + render(l) + ").compareSameUnit(" + render(r) + ") >= 0"
      }
      case Binary("map-lookup", l, r) => "(" + render(l) + ")(" + render(r) + ")"
      case Binary("all-equal", l, r) => "(" + render(l) + ").forall(_ == " + render(r) + ")"
      case Binary(op, l, r) if Map("and" -> "&&", "or" -> "||", "equal" -> "==", "not-equal" -> "!=", "less" -> "<", "less-equal" -> "<=", "greater" -> ">", "greater-equal" -> ">=").contains(op) =>
        val operator = Map("and" -> "&&", "or" -> "||", "equal" -> "==", "not-equal" -> "!=", "less" -> "<", "less-equal" -> "<=", "greater" -> ">", "greater-equal" -> ">=")(op)
        descriptor(l, model).orElse(descriptor(r, model)).filter(_ => !Set("and", "or")(op)) match {
          case Some(exact) => checked(exact, Vector(l, r), "(" + scalar(l, exact) + " " + operator + " " + scalar(r, exact) + ")")
          case None => "(" + render(l) + " " + operator + " " + render(r) + ")"
        }
      case Binary(op, l, r) => "(" + render(l) + ")." + Map("map-contains" -> "contains", "map-get" -> "get", "contains" -> "contains")(op) + "(" + render(r) + ")"
    }
  }
  def literal(value: ImmutableJson, valueType: NominalType, model: ProductDomainModel): String = {
    import ImmutableJson._
    valueType match {
      case NominalType.Primitive("string") => str(value.asInstanceOf[Text].value)
      case NominalType.Primitive("boolean") => value.asInstanceOf[Flag].value.toString
      case NominalType.Primitive("integer") => "java.lang.Long.parseLong(" + str(value.asInstanceOf[Text].value) + ")"
      case NominalType.Primitive("decimal") => "BigDecimal(" + str(value.asInstanceOf[Text].value) + ")"
      case NominalType.Named(ref) =>
        val name = named(ref, model)
        model.exact.find(_.domain == ref) match {
          case Some(exact) if exact.form == "decimal" => name + "(BigDecimal(" + str(value.asInstanceOf[Text].value) + "))"
          case Some(exact) => name + "(BigDecimal(" + str(value.at("/" + JsonPointerEscape(exact.amountMember.get.id)).get.asInstanceOf[Text].value) + "), " + str(value.at("/" + JsonPointerEscape(exact.unitMember.get.id)).get.asInstanceOf[Text].value) + ")"
          case None => declaration(ref, model).valueType.get match {
            case NominalType.Record(members) => name + "(" + members.map(r => literal(value.at("/" + JsonPointerEscape(r.id)).get, declaration(r, model).valueType.get, model)).mkString(", ") + ")"
            case shape => name + "(" + literal(value, shape, model) + ")"
          }
        }
      case NominalType.Optional(element) => if (value.at("/present").contains(Flag(true))) "Some(" + literal(value.at("/value").get, element, model) + ")" else "None"
      case NominalType.Sequence(element) => "Vector(" + value.asInstanceOf[Items].values.map(literal(_, element, model)).mkString(", ") + ")"
      case NominalType.Mapping(k, v) => "Map(" + value.asInstanceOf[Items].values.map(row => literal(row.at("/key").get, k, model) + " -> " + literal(row.at("/value").get, v, model)).mkString(", ") + ")"
      case _ => throw new IllegalArgumentException("unsupported admitted literal")
    }
  }
  private def JsonPointerEscape(value: String): String = value.replace("~", "~0").replace("/", "~1")
  def value(expression: DomainValueExpression, model: ProductDomainModel): String = {
    import DomainValueExpression._
    def render(v: DomainValueExpression): String = value(v, model)
    def operand(v: DomainValueExpression): NominalType = v match {
      case Reference(r) => declaration(r, model).valueType.get
      case Literal(t, _) => t
      case Member(_, r) => declaration(r, model).valueType.get
      case Arithmetic(_, l, _) => operand(l)
      case _ => throw new IllegalArgumentException("unsupported arithmetic operand")
    }
    expression match {
      case Reference(r) => (if (r.kind == "state-field") "state." else if (r.kind == "event-slot") "event." else "p.") + sym(r.id)
      case Literal(t, v) => literal(v, t, model)
      case Host(r, _) => "hosts." + sym(r.id) + "(state, p)"
      case Member(a, r) => "(" + render(a) + ")." + sym(r.id)
      case MapGet(m, k) => "(" + render(m) + ").get(" + render(k) + ")"
      case Arithmetic(op, l, r) => operand(l) match {
        case NominalType.Primitive("integer") => "java.lang.Math." + (if (op == "add") "addExact" else "subtractExact") + "(" + render(l) + ", " + render(r) + ")"
        case _ => "(" + render(l) + ")." + (if (op == "add") "plus" else "minus") + "(" + render(r) + ")"
      }
    }
  }
  private def source(path: String, content: String, kind: String, sources: Vector[ProductSource], model: ProductDomainModel): ProductSourceModel =
    ProductSourceModel(path, "// @generated by CodegenMain:semantic-products-1\n" + content, kind, sources.distinct, model.footprint)
  def generate(model: ProductDomainModel): Vector[ProductSourceModel] = {
    val values = model.layout.declarations.filter(_.ref.kind == "type").map { d =>
      val pkg = model.packages(d.ref.context); val name = sym(d.ref.id)
      val body = model.exact.find(_.domain == d.ref) match {
        case Some(exact) =>
          val amount = sym(exact.amountMember.map(_.id).getOrElse("value")); val unit = exact.unitMember.map(r => sym(r.id))
          val same = unit.map(u => "require(" + u + " == other." + u + ", \"exact units differ\"); ").getOrElse("")
          def create(op: String): String = name + "(" + name + ".checkedAmount(" + name + ".checkedAmount(" + amount + ") " + op + " " + name + ".checkedAmount(other." + amount + "))" + unit.map(", " + _).getOrElse("") + ")"
          "final case class " + name + "(" + amount + ": BigDecimal" + unit.map(", " + _ + ": String").getOrElse("") + ") {\n  " + name + ".checkedAmount(" + amount + ")\n" +
            unit.map(u => "  require(Set(" + exact.units.map(str).mkString(", ") + ").contains(" + u + "), \"unsupported exact unit\")\n").getOrElse("") +
            "  def isPositive: Boolean = " + amount + " > 0\n  def compareSameUnit(other: " + name + "): Int = { " + same + amount + ".compare(other." + amount + ") }\n" +
            "  def plus(other: " + name + "): " + name + " = { " + same + create("+") + " }\n  def minus(other: " + name + "): " + name + " = { " + same + create("-") + " }\n}\n" +
            "object " + name + " { def checkedAmount(value: BigDecimal): BigDecimal = { require(value != null, \"exact amount required\"); val scaled = value.bigDecimal.setScale(" + exact.scale + ", java.math.RoundingMode.UNNECESSARY); require(scaled.precision <= " + exact.precision + ", \"exact precision exceeded\"); new scala.math.BigDecimal(scaled, java.math.MathContext.UNLIMITED) } }\n"
        case None => d.valueType.get match {
          case NominalType.Record(members) => "final case class " + name + "(" + members.map(r => sym(r.id) + ": " + tpe(declaration(r, model).valueType.get, model)).mkString(", ") + ")\n"
          case shape => "final case class " + name + "(value: " + tpe(shape, model) + ")\n"
        }
      }
      source(path(pkg, "domain/values/" + d.ref.id + ".scala"), "package " + pkg + ".domain.values\n\n" + body, "value-object", Vector(d.source), model)
    }
    values ++ model.aggregates.flatMap { a =>
      val pkg = model.packages(a.declaration.ref.context); val name = sym(a.declaration.ref.id)
      def file(suffix: String, content: String, kind: String, sources: Vector[ProductSource]): ProductSourceModel = source(path(pkg, "domain/" + a.declaration.ref.id + suffix + ".scala"), "package " + pkg + ".domain\n\n" + content, kind, Vector(a.declaration.source) ++ sources, model)
      val state = file("State", "final case class " + name + "State(" + a.defaults.map(d => sym(d.target.id) + ": " + tpe(d.valueType, model)).mkString(", ") + ")\nobject " + name + "State { def empty: " + name + "State = " + name + "State(" + a.defaults.map(d => literal(d.value, d.valueType, model)).mkString(", ") + ") }\n", "state", a.defaults.map(_.source))
      val protocol = file("Protocol", "object " + name + "Protocol {\n  sealed trait Command\n  sealed trait Event\n" + a.commands.map(c => "  final case class " + sym(c.command.id) + "(" + c.declaredSignature.map(p => sym(p.ref.id) + ": " + tpe(p.valueType, model)).mkString(", ") + ") extends Command\n").mkString + a.events.map(e => "  final case class " + sym(e.event.id) + "(" + e.declaredSlots.map(s => sym(s.ref.id) + ": " + tpe(s.valueType, model)).mkString(", ") + ") extends Event\n").mkString + "}\n", "protocol", a.commands.map(_.source) ++ a.events.map(_.source))
      val helpers = file("CommandHelpers", "import " + name + "Protocol._\n\ntrait " + name + "Computations {\n" + a.hosts.map(h => "  def " + sym(h.id.id) + "(state: " + name + "State, p: " + sym(h.command.id) + "): " + tpe(h.outputType, model) + "\n").mkString + "}\nobject " + name + "Computations {\n" + (if (a.hosts.isEmpty) "  val none: " + name + "Computations = new " + name + "Computations {}\n" else "") + "}\nobject " + name + "CommandHelpers {\n" + a.commands.map(c => "  def emit" + c.command.id + "(state: " + name + "State, p: " + sym(c.command.id) + ", hosts: " + name + "Computations): Vector[Event] = Vector(" + c.events.map(e => sym(e.event.id) + "(" + e.slots.map(s => value(s.producer, model)).mkString(", ") + ")").mkString(", ") + ")\n").mkString + "}\n", "command-helpers", a.commands.map(_.source) ++ a.hosts.map(_.source))
      val rules = file("Rules", "import " + name + "Protocol._\n\nobject " + name + "Rules {\n" + a.decisions.map(c => "  def " + sym(c.command.id) + "(state: " + name + "State, p: " + sym(c.command.id) + ", hosts: " + name + "Computations): Either[String, Vector[Event]] = {\n" + c.decisions.map(d => "    if (!(" + decision(d.predicate, model) + ")) return " + (d.onFalse match { case DecisionOnFalse.Reject(code) => "Left(" + str(code) + ")"; case DecisionOnFalse.SucceedEmpty => "Right(Vector.empty)" }) + "\n").mkString + "    Right(" + name + "CommandHelpers.emit" + c.command.id + "(state, p, hosts))\n  }\n").mkString + "}\n", "rules", a.decisions.flatMap(c => c.source +: c.decisions.map(_.source)))
      val events = file("EventHandler", "import " + name + "Protocol._\n\nobject " + name + "EventHandler {\n  def apply(state: " + name + "State, input: Event): " + name + "State = input match {\n" + a.folds.map(e => "    case event: " + sym(e.event.id) + " =>\n" + e.assignments.zipWithIndex.map { case (d, i) =>
        val base = "state." + sym(d.target.id)
        val update = d.update match {
          case FoldUpdate.SetValue(v) => value(v, model)
          case FoldUpdate.Collection("put", k, Some(v)) => base + ".updated(" + value(k, model) + ", " + value(v, model) + ")"
          case FoldUpdate.Collection("remove", k, _) => base + " - " + value(k, model)
          case FoldUpdate.Collection("put-all", k, Some(v)) => "{ val keys = " + value(k, model) + "; val item = " + value(v, model) + "; " + base + " ++ keys.map(_ -> item) }"
          case FoldUpdate.Collection("remove-all", k, _) => base + " -- " + value(k, model)
          case FoldUpdate.Arithmetic("integer-apply", delta, sign) => "java.lang.Math." + (if (sign == 1) "addExact" else "subtractExact") + "(" + base + ", " + value(delta, model) + ")"
          case FoldUpdate.Arithmetic("money-apply", delta, sign) => base + "." + (if (sign == 1) "plus" else "minus") + "(" + value(delta, model) + ")"
          case _ => throw new IllegalArgumentException("unsupported admitted fold")
        }
        "      val next" + i + ": " + tpe(d.valueType, model) + " = " + update + "\n"
      }.mkString + (if (e.assignments.isEmpty) "      state\n" else "      state.copy(" + e.assignments.zipWithIndex.map { case (d, i) => sym(d.target.id) + " = next" + i }.mkString(", ") + ")\n")).mkString + "  }\n}\n", "event-handler", a.folds.flatMap(e => e.source +: e.assignments.map(_.source)))
      val external = if (a.external.isEmpty) Vector.empty else Vector(file("ExternalEvents", "import " + name + "Protocol._\n\nobject " + name + "ExternalEvents {\n" + a.external.map(p =>
        "  def " + sym(p.id.replace('-', '_')) + "(output: " + tpe(p.outputType, model) + "): " + sym(p.event.id) + " = " + sym(p.event.id) + "(" + p.slots.map(s => "output." + sym(s.member.id)).mkString(", ") + ")\n" +
          "  def " + sym(p.id.replace('-', '_') + "_identity") + "(output: " + tpe(p.outputType, model) + "): Vector[String] = Vector(" + p.stableIdentityContract.keys.map(r => textual("output." + sym(r.id), declaration(r, model).valueType.get, model)).mkString(", ") + ")\n").mkString + "}\n", "external-event-bridge", a.external.map(_.source)))
      Vector(state, protocol, helpers, rules, events) ++ external
    }
  }
}
