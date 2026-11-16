package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.TypeResolverDSL
import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.execution.SagaValueSource
import net.imadz.meta.products._

/** Exact installed host callbacks; no second authority/delivery implementation path. */
object ProductHostIOTemplate {
  private def sym(s: String): String = NamingConventions.strictSymbol(s)
  private def q(s: String): String = ujson.write(s)
  private def typeText(t: net.imadz.codegen.scaffolding.cqrs.TypeRef): String = t.fqn + (if (t.typeParams.isEmpty) "" else t.typeParams.map(typeText).mkString("[", ", ", "]"))
  def resourcePolicy(h: SagaHostContract): Option[HostTechnicalPort] = h.technicalPorts.find(_.role == "resource-policy")
  def occurrenceBridge(h: SagaHostContract): Option[(HostTechnicalPort, HostTechnicalPort)] = for {
    gate <- h.technicalPorts.find(_.role == "external-event")
    source <- h.technicalPorts.find(_.role == "occurrence-source")
  } yield (gate, source)
  def generate(m: ProductApplicationModel): Vector[ProductSourceModel] = m.hosts.map { row =>
    val h = row.contract; val pkg = m.domain.packages(h.saga.ref.context); val stem = sym(h.id); val technical = stem + "TechnicalPorts"
    def field(r: QualifiedReference) = m.domain.layout.declarations.find(_.ref == r).get
    def tpe(t: NominalType) = typeText(TypeResolverDSL.productType(t, m.domain.packages))
    val original = tpe(h.entry.inputType)
    val trigger = row.runtime.triggers.find(_.declaration.id == h.entry.triggerId).get.declaration
    h.results.foreach { result =>
      val authority = m.ports.find(p => p.ref == result.authorityPort.ref && p.version == result.authorityPort.version)
      require(authority.exists(p => p.inputType == h.entry.inputType && p.outputType == result.inputType), "authority must consume the complete original and return the exact result record")
    }
    def resultValue(p: HostParameter): String = p.input match {
      case SagaValueSource.TransactionId => field(p.parameter).valueType.get match { case t: NominalType.Named => tpe(t) + "(identity.transactionId)"; case _ => "identity.transactionId" }
      case SagaValueSource.Args(slot) => trigger.args.find(_.slot == slot).get.source match { case SagaValueSource.SourceField(id) => "original." + sym(id); case _ => throw new IllegalArgumentException("complete original result lineage required") }
      case _ => throw new IllegalArgumentException("complete result receipt adapter required")
    }
    val admit = resourcePolicy(h) match {
      case Some(p) =>
        "  def admit(original: " + original + ", technical: " + technical + ".Installed)(implicit ec: ExecutionContext): Future[Option[String]] = {\n" +
          "    require(technical != null, \"exact installed host I/O required\")\n" +
          "    technical." + sym(h.entry.port.ref.id) + "(original).flatMap { allowed => if (!allowed) Future.successful(Some(\"entry or association not admitted\")) else technical." + sym(h.association.port.ref.id) + "(original).flatMap { associated => if (!associated) Future.successful(Some(\"entry or association not admitted\")) else technical." + sym(p.port.ref.id) + "(original).map(admitted => if (admitted) None else Some(\"resource policy denied\")) } }\n" +
          "  }\n"
      case None =>
        "  def admit(original: " + original + ", technical: " + technical + ".Installed)(implicit ec: ExecutionContext): Future[Boolean] = {\n" +
          "    require(technical != null, \"exact installed host I/O required\")\n" +
          "    technical." + sym(h.entry.port.ref.id) + "(original).flatMap { allowed => if (!allowed) Future.successful(false) else technical." + sym(h.association.port.ref.id) + "(original) }\n" +
          "  }\n"
    }
    val occurrence = occurrenceBridge(h).map { case (gate, source) =>
      val envelope = tpe(m.ports.find(port => port.ref == gate.port.ref && port.version == gate.port.version).get.inputType)
      "  def admitOccurrence(envelope: " + envelope + ", technical: " + technical + ".Installed)(implicit ec: ExecutionContext): Future[scala.util.Either[String, " + original + "]] = {\n" +
        "    require(technical != null, \"exact installed host I/O required\")\n" +
        "    technical." + sym(gate.port.ref.id) + "(envelope).flatMap { accepted => if (!accepted) Future.successful(scala.util.Left(\"occurrence source denied\")) else technical." + sym(source.port.ref.id) + "(envelope).map(restored => scala.util.Right(restored)) }\n" +
        "  }\n"
    }.getOrElse("")
    var text = "package " + pkg + ".application\n\nimport net.imadz.infra.saga.strict.TransactionIdentity\nimport scala.concurrent.{ExecutionContext, Future}\n\nobject " + stem + "HostIO {\n" + admit + occurrence + "  def deliver(kind: String, original: " + original + ", identity: TransactionIdentity, technical: " + technical + ".Installed)(implicit ec: ExecutionContext): Future[Boolean] = {\n    require(technical != null && identity != null, \"authoritative completion context and actual objects required\")\n    val context = " + technical + ".CompletionContext(original, identity)\n    kind match {\n"
    h.results.foreach { r =>
      text += "      case " + q(r.kind.wire) + " =>\n        val expected = " + tpe(r.inputType) + r.inputs.map(resultValue).mkString("(", ", ", ")") + "\n        technical." + sym(r.authorityPort.ref.id) + "Completion(original, context).flatMap { actual =>\n          require(actual == expected, \"authority result differs from complete original identity and event payload\")\n          technical." + sym(r.deliveryPort.ref.id) + "Completion(actual, context)\n        }\n"
    }
    text += "      case _ => Future.failed(new IllegalArgumentException(\"unmapped host result\"))\n    }\n  }\n}\n"
    ProductSourceModel(NamingConventions.productPackagePath(pkg, "application/" + stem + "HostIO.scala"), text, "technical-port", Vector(h.source), m.footprint)
  }
  def wire(text: String, stem: String, readOriginal: String, pending: String, policy: Boolean = false, occurrence: Option[(String, String)] = None): String = {
    val original = text.replace("coordinator: ActorRef[StrictSagaCoordinator.Command], delivery: Delivery)", "coordinator: ActorRef[StrictSagaCoordinator.Command], technical: " + stem + "TechnicalPorts.Installed)")
      .replace("coordinator != null && delivery != null", "coordinator != null && technical != null")
      .replace("delivered: Boolean = false)", "delivered: Boolean = false, admitted: Boolean = false)")
      .replace("  final case class DeliveryAcknowledged(kind: String) extends Event", "  final case class DeliveryAcknowledged(kind: String) extends Event\n  case object AdmissionGranted extends Event\n  private final case class Admitted(denial: Option[String], operation: String) extends Request" + occurrence.map { case (envelope, originalType) =>
        "\n  final case class SubmitOccurrence(envelope: " + envelope + ", replyTo: ActorRef[Reply]) extends Request\n  private final case class OccurrenceAdmitted(original: scala.util.Either[String, " + originalType + "], replyTo: ActorRef[Reply]) extends Request"
      }.getOrElse(""))
      .replace("    def observe(state: State, replyTo: ActorRef[Reply]): Unit = {\n", "    var admissionPending = false\n    var admissionReplies = Vector.empty[ActorRef[Reply]]\n    def takeAdmissionReplies(): ActorRef[Reply] = {\n      val replies = admissionReplies\n      admissionReplies = Vector.empty\n      admissionPending = false\n      context.spawnAnonymous(Behaviors.receiveMessage[Reply] { reply => replies.foreach(_ ! reply); Behaviors.stopped })\n    }\n    def observe(state: State, replyTo: ActorRef[Reply]): Unit = {\n      if (!state.admitted) {\n        admissionReplies :+= replyTo\n        if (!admissionPending) {\n          admissionPending = true\n          val original = " + readOriginal + "\n          val admission = scala.util.Try(" + stem + "HostIO.admit(original, technical)).getOrElse(" + (if (policy) "Future.successful(Some(\"host admission failed\"))" else "Future.successful(false)") + ")\n          context.pipeToSelf(admission)(result => Admitted(" + (if (policy) "result.getOrElse(Some(\"host admission failed\"))" else "if (result.getOrElse(false)) None else Some(\"entry or association not admitted\")") + ", state.operation))\n        }\n        return\n      }\n")
    val start = original.indexOf("      val result", original.indexOf("    def deliver("))
    val end = original.indexOf("      context.pipeToSelf(result)", start)
    require(start >= 0 && end >= 0, "complete typed host delivery body required")
    val wired = original.substring(0, start) + "      val result: Future[Boolean] = " + stem + "HostIO.deliver(kind, original, identity, technical)\n" + original.substring(end)
    val admittedCases = "      case Admitted(None, operation) if state.operation.nonEmpty && state.operation == operation && !state.admitted => Effect.persist(AdmissionGranted).thenRun((s: State) => observe(s, takeAdmissionReplies()))\n      case Admitted(Some(reason), operation) if state.operation == operation && !state.admitted => Effect.none.thenRun((_: State) => takeAdmissionReplies() ! " + pending + "(reason))\n      case _: Admitted => Effect.none\n"
    val occurrenceCases = occurrence.map { case (_, _) =>
      "      case SubmitOccurrence(envelope, replyTo) =>\n        context.pipeToSelf(" + stem + "HostIO.admitOccurrence(envelope, technical))(result => OccurrenceAdmitted(result.getOrElse(scala.util.Left(\"occurrence admission failed\")), replyTo))\n        Effect.none\n" +
        "      case OccurrenceAdmitted(scala.util.Right(original), replyTo) => context.self ! Submit(original, replyTo); Effect.none\n" +
        "      case OccurrenceAdmitted(scala.util.Left(reason), replyTo) => Effect.none.thenRun((_: State) => replyTo ! " + pending + "(reason))\n"
    }.getOrElse("")
    wired.replace("      case Observed(StrictSagaCoordinator.Denied(reason), replyTo)", occurrenceCases + admittedCases + "      case Observed(StrictSagaCoordinator.Denied(reason), replyTo)")
      .replace("      case DeliveryAcknowledged(_) => state.copy(delivered = true)", "      case DeliveryAcknowledged(_) => state.copy(delivered = true)\n      case AdmissionGranted => state.copy(admitted = true)")
  }
}
