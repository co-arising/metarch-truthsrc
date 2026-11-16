package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.TypeResolverDSL
import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.execution._
import net.imadz.meta.products._

/** Test-only independent inventory oracle. Every phase calls a real generated aggregate. */
object ProductHostVerificationTemplate {
  private def quote(value: String): String = ujson.write(value)
  private def sym(value: String): String = NamingConventions.productSymbol(value)
  private def typeText(ref: net.imadz.codegen.scaffolding.cqrs.TypeRef): String = ref.fqn + (if (ref.typeParams.isEmpty) "" else ref.typeParams.map(typeText).mkString("[", ", ", "]"))
  private def tpe(value: NominalType, m: ProductApplicationModel): String = typeText(TypeResolverDSL.productType(value, m.domain.packages))
  private def field(r: QualifiedReference, m: ProductApplicationModel): ReferenceDeclaration = m.domain.layout.declarations.find(_.ref == r).get
  private def method(p: HostParticipant, phase: HostPhase): String = NamingConventions.strictSymbol(p.stepId + "_" + phase.phase.wire)
  private def make(value: String, t: NominalType, model: ProductApplicationModel): String = t match {
    case NominalType.Named(r) => tpe(t, model) + "(" + make(value, field(r, model).valueType.get, model) + ")"
    case NominalType.Primitive("integer") => value
    case _ => quote(value)
  }
  private def raw(v: String, t: NominalType, m: ProductApplicationModel): String = t match { case NominalType.Named(r) => raw(v + ".value", field(r, m).valueType.get, m); case _ => v }
  private def technicalOperation(h: SagaHostContract, port: HostTechnicalPort, pin: ArtifactPort, pkg: String, model: ProductApplicationModel): String = {
    if (!Set("phase-execute", "phase-query").contains(port.role)) ""
    else {
      val p = h.participants.find(_.phases.exists(pf => pf.executePort.ref == port.port.ref || pf.query.port.ref == port.port.ref)).get
      val pf = p.phases.find(pf => pf.executePort.ref == port.port.ref || pf.query.port.ref == port.port.ref).get
      val receipt = tpe(pf.evidence.receiptType, model)
      if (port.role == "phase-query") ", (input: " + tpe(pin.inputType, model) + ", identity: OperationIdentity) => Future.successful(receipts.get(identity).map(_.asInstanceOf[" + receipt + "]))"
      else {
        val aggregate = pkg + ".domain." + p.aggregate.id + "Aggregate"
        val event = pkg + ".domain." + p.aggregate.id + "Protocol." + pf.confirmation.event.id
        val identities = pf.evidence.identity.map { i =>
          val value = i.key match {
            case SagaIdentityPart.Transaction => "identity.transaction.transactionId"
            case SagaIdentityPart.DefinitionVersion => "identity.transaction.definitionVersion.toString"
            case SagaIdentityPart.ArgsDigest => "identity.transaction.argsDigest"
            case SagaIdentityPart.Participant => "identity.participantId"
            case SagaIdentityPart.Resource => "identity.resource"
            case SagaIdentityPart.Step => "identity.stepId"
            case SagaIdentityPart.Phase => "identity.phase.toString.toLowerCase(java.util.Locale.ROOT)"
          }
          field(i.member, model).valueType.get match { case n: NominalType.Named => tpe(n, model) + "(" + value + ")"; case _ => value }
        }
        val values = identities ++ pf.evidence.payload.map(i => "event." + sym(i.output))
        ", (input: " + tpe(pin.inputType, model) + ", identity: OperationIdentity) => { technicalCalls.incrementAndGet(); actor_" + p.participantId + ".ask[" + aggregate + ".Reply](reply => " + aggregate + ".Execute(" + pkg + ".domain." + p.aggregate.id + "Protocol." + pf.command.id + "(" + pf.parameters.map(m => "input." + sym(m.parameter.id)).mkString(", ") + "), reply)).map { case " + aggregate + ".Accepted(events) => val event = events.collectFirst { case e: " + event + " => e }.get; val receipt = " + receipt + "(" + values.mkString(", ") + "); receipts.put(identity, receipt); receipt; case " + aggregate + ".Refused(code) => throw new IllegalStateException(code) } }"
      }
    }
  }

  private def technicalCompletion(h: SagaHostContract, p: HostTechnicalPort, pin: ArtifactPort, pkg: String, stem: String, model: ProductApplicationModel): String = {
    if (!Set("authority", "result-delivery").contains(p.role)) ""
    else {
      val r = h.results.find(r => r.authorityPort.ref == p.port.ref || r.deliveryPort.ref == p.port.ref).get
      val context = pkg + ".application." + stem + "TechnicalPorts.CompletionContext"
      val record = tpe(r.inputType, model)
      if (p.role == "authority") {
        val trigger = model.hosts.find(_.contract.id == h.id).get.runtime.triggers.find(_.declaration.id == h.entry.triggerId).get.declaration
        val values = r.inputs.map { m => m.input match {
          case SagaValueSource.TransactionId => field(m.parameter, model).valueType.get match { case t: NominalType.Named => tpe(t, model) + "(context.identity.transactionId)"; case _ => "context.identity.transactionId" }
          case SagaValueSource.Args(slot) => trigger.args.find(_.slot == slot).get.source match { case SagaValueSource.SourceField(id) => "input." + sym(id); case _ => throw new IllegalArgumentException("complete original result lineage required") }
          case _ => throw new IllegalArgumentException("result receipt adapter required")
        } }
        ", completion = (input: " + tpe(pin.inputType, model) + ", context: " + context + ") => { authorityCalls.incrementAndGet(); Future.successful(" + record + values.mkString("(", ", ", ")") + ") }"
      } else {
        val producer = model.domain.aggregates.flatMap(_.external).find(_.event == r.event).get
        ", completion = (input: " + record + ", context: " + context + ") => resultDeliveryGate.get().flatMap { _ => require(context.original.allocation.value == \"allocation-last\"); deliveryCounts.update(" + quote(r.kind.wire) + ", deliveryCounts.getOrElse(" + quote(r.kind.wire) + ", 0) + 1); actor_allocation.ask[" + pkg + ".domain.AllocationOrderAggregate.Reply](reply => " + pkg + ".domain.AllocationOrderAggregate.Ingest" + NamingConventions.strictSymbol(producer.id) + "(input, \"owned-test-authority\", reply)).map { case " + pkg + ".domain.AllocationOrderAggregate.Accepted(_) => delivered.put(" + quote(r.kind.wire) + ", context.original.allocation.value); !loseDeliveryAck.compareAndSet(true, false); case _ => false } }"
      }
    }
  }

  /** Test-only host I/O negatives: missing completion, authority record mismatch with zero delivery, denied entry with zero phase effects. */
  private def hostIoNegatives(h: SagaHostContract, pkg: String, stem: String, model: ProductApplicationModel): String = {
    val succeeded = h.results.find(_.kind.wire == "succeeded").get
    val authorityBinding = NamingConventions.strictSymbol(succeeded.authorityPort.ref.id)
    val entryBinding = NamingConventions.strictSymbol(h.entry.port.ref.id)
    val technicalPorts = pkg + ".application." + stem + "TechnicalPorts"
    val originalType = tpe(h.entry.inputType, model)
    val recordType = tpe(succeeded.inputType, model)
    val txMember = succeeded.inputs.find(_.input == SagaValueSource.TransactionId).get
    val txType = field(txMember.parameter, model).valueType.get match { case n: NominalType.Named => tpe(n, model); case _ => throw new IllegalArgumentException("succeeded transaction-id member must be nominal") }
    "      val authorityProbeIdentity = TransactionIdentity(\"wrong-tx\", \"wrong-definition\", 1, \"wrong-args\", \"wrong-definition-digest\", " + pkg + ".application." + stem + "Definition.argsCodec.pin, \"wrong-plan-digest\")\n" +
      "      val missingCompletion = technicalBindings.copy(" + authorityBinding + " = technicalBindings." + authorityBinding + ".copy(completion = null))\n" +
      "      intercept[IllegalArgumentException] { " + technicalPorts + ".install(missingCompletion) }\n" +
      "      val wrongAuthority = " + technicalPorts + ".install(technicalBindings.copy(" + authorityBinding + " = technicalBindings." + authorityBinding + ".copy(completion = (_: " + originalType + ", _: " + technicalPorts + ".CompletionContext) => Future.successful(" + recordType + "(" + txType + "(\"wrong-authority-tx\"))))))\n" +
      "      val beforeWrongDelivery = deliveryCounts.toMap\n" +
      "      intercept[IllegalArgumentException] { Await.result(" + pkg + ".application." + stem + "HostIO.deliver(\"succeeded\", original, authorityProbeIdentity, wrongAuthority), 3.seconds) }\n" +
      "      assert(deliveryCounts.toMap == beforeWrongDelivery)\n" +
      "      val deniedEntry = " + technicalPorts + ".install(technicalBindings.copy(" + entryBinding + " = technicalBindings." + entryBinding + ".copy(run = (_: " + originalType + ") => Future.successful(false))))\n" +
      "      val deniedHost = kit.spawn(" + pkg + ".application." + stem + "Host(\"owned-denied-host\", coordinator, deniedEntry))\n" +
      "      deniedHost ! " + pkg + ".application." + stem + "Host.Submit(original, reply.ref)\n" +
      "      reply.expectMessage(" + pkg + ".application." + stem + "Host.Waiting(\"entry or association not admitted\"))\n" +
      "      assert(executeCounts.isEmpty && deliveryCounts.isEmpty)\n" +
      "      val beforeHostEntry = technicalCalls.get()\n"
  }

  private val extendedRoles = Set("resource-policy", "external-submission", "external-query", "external-event", "occurrence-source", "readside", "deployment")
  private def optionalElement(t: NominalType): NominalType = t match { case NominalType.Optional(e) => e; case _ => throw new IllegalArgumentException("optional record output required") }
  private def recordMembersOf(t: NominalType, model: ProductApplicationModel): Vector[ReferenceDeclaration] = t match {
    case NominalType.Named(r) => field(r, model).valueType.get.asInstanceOf[NominalType.Record].members.map(field(_, model))
    case _ => throw new IllegalArgumentException("nominal record required")
  }
  private def extendedLiteral(id: String): String = id match {
    case "status" => "unknown"
    case "producer" => "owned-occurrence-producer"
    case "authorization" => "owned-test-authority"
    case "identity" => "request-A"
    case "endpoint" => "tcp://loopback:0"
    case "route" => "/inventory"
    case "secretRef" => "secret-refs/inventory-hmac"
    case _ => "extended-A"
  }
  private def extendedMember(m: ReferenceDeclaration, keyIds: Set[String], sourceExpr: String, model: ProductApplicationModel): String = {
    if (keyIds.contains(m.ref.id)) sourceExpr + "." + sym(m.ref.id)
    else m.valueType.get match {
      case NominalType.Primitive("integer") => "3L"
      case NominalType.Primitive("boolean") => "true"
      case NominalType.Primitive("string") => quote(extendedLiteral(m.ref.id))
      case n: NominalType.Named => tpe(n, model) + "(" + quote(extendedLiteral(m.ref.id)) + ")"
      case _ => throw new IllegalArgumentException("finite extended record member required")
    }
  }
  private def extendedRecord(t: NominalType, keyIds: Set[String], sourceExpr: String, model: ProductApplicationModel): String =
    tpe(t, model) + "(" + recordMembersOf(t, model).map(m => extendedMember(m, keyIds, sourceExpr, model)).mkString(", ") + ")"
  private def envelopeLiteral(t: NominalType, authorization: String, model: ProductApplicationModel): String =
    tpe(t, model) + "(" + recordMembersOf(t, model).map { m =>
      m.ref.id match {
        case "producer" => "\"owned-occurrence-producer\""
        case "authorization" => "\"" + authorization + "\""
        case "identity" => "\"request-A\""
        case _ => extendedMember(m, Set.empty, "input", model)
      }
    }.mkString(", ") + ")"

  private def technicalObjects(h: SagaHostContract, pkg: String, stem: String, model: ProductApplicationModel, working: Boolean = false,
                              originalLiteral: String = ""): String = {
    val companion = pkg + ".application." + stem + "TechnicalPorts"
    val keyIds = h.association.inputKeys.map(_.id).toSet
    val envelopeMembers: Option[Vector[ReferenceDeclaration]] = h.technicalPorts.find(_.role == "external-event").flatMap { gate =>
      model.ports.find(a => a.ref == gate.port.ref && a.version == gate.port.version).map { pin =>
        field(pin.inputType.asInstanceOf[NominalType.Named].ref, model).valueType.get.asInstanceOf[NominalType.Record].members.map(field(_, model))
      }
    }
    def workingRun(p: HostTechnicalPort, pin: ArtifactPort): Option[String] = if (!working) None else p.role match {
      case "resource-policy" => Some("(_: " + tpe(pin.inputType, model) + ") => { technicalCalls.incrementAndGet(); Future.successful(true) }")
      case "external-event" =>
        val members = envelopeMembers.get
        members.foreach { m => if (Set("producer", "authorization").contains(m.ref.id) && m.valueType.get != NominalType.Primitive("string")) throw new IllegalArgumentException("primitive string envelope admission members required") }
        Some("(input: " + tpe(pin.inputType, model) + ") => { technicalCalls.incrementAndGet(); Future.successful(input.authorization == \"owned-test-authority\" && input.producer == \"owned-occurrence-producer\") }")
      case "occurrence-source" =>
        Some("(_: " + tpe(pin.inputType, model) + ") => { technicalCalls.incrementAndGet(); Future.successful(" + originalLiteral + ") }")
      case "external-submission" =>
        Some("(_: " + tpe(pin.inputType, model) + ") => { technicalCalls.incrementAndGet(); Future.successful(" + extendedRecord(pin.outputType, keyIds, "original", model) + ") }")
      case "external-query" =>
        Some("(input: " + tpe(pin.inputType, model) + ") => { technicalCalls.incrementAndGet(); Future.successful(Some(" + extendedRecord(optionalElement(pin.outputType), keyIds, "input", model) + ")) }")
      case "readside" =>
        Some("(input: " + tpe(pin.inputType, model) + ") => { technicalCalls.incrementAndGet(); Future.successful(Some(" + extendedRecord(optionalElement(pin.outputType), keyIds, "input", model) + ")) }")
      case "deployment" =>
        Some("(_: " + tpe(pin.inputType, model) + ") => { technicalCalls.incrementAndGet(); Future.successful(true) }")
      case _ => None
    }
    val rows = h.technicalPorts.map { p =>
      val pin = model.ports.find(a => a.ref == p.port.ref && a.version == p.port.version).get
      val run = workingRun(p, pin).getOrElse {
        val output = if (Set("entry", "association", "resource-policy").contains(p.role)) "Future.successful(true)" else "Future.failed(new IllegalStateException(\"test technical object not invoked by this phase adapter\"))"
        "(_: " + tpe(pin.inputType, model) + ") => { technicalCalls.incrementAndGet(); " + output + " }"
      }
      "        " + companion + ".Implementation[" + tpe(pin.inputType, model) + ", " + tpe(pin.outputType, model) + "](" + quote(p.implementation.id) + ", " + quote(p.implementation.version) + ", " + run + technicalOperation(h, p, pin, pkg, model) + technicalCompletion(h, p, pin, pkg, stem, model) + ")"
    }
    val first = NamingConventions.strictSymbol(h.technicalPorts.head.port.ref.id)
    "      val receipts = scala.collection.concurrent.TrieMap.empty[OperationIdentity, Any]\n      val technicalCalls = new java.util.concurrent.atomic.AtomicInteger(0)\n      val loseDeliveryAck = new java.util.concurrent.atomic.AtomicBoolean(false)\n      val deliveryCounts = scala.collection.concurrent.TrieMap.empty[String, Int]\n      val delivered = scala.collection.concurrent.TrieMap.empty[String, String]\n      val authorityCalls = new java.util.concurrent.atomic.AtomicInteger(0)\n      val resultDeliveryGate = new java.util.concurrent.atomic.AtomicReference[Future[Unit]](Future.successful(()))\n      val technicalBindings = " + companion + ".Bindings(\n" + rows.mkString(",\n") + "\n      )\n      val installedTechnical = " + companion + ".install(technicalBindings)\n" +
      "      intercept[IllegalArgumentException] { " + companion + ".install(technicalBindings.copy(" + first + " = null)) }\n" +
      "      intercept[IllegalArgumentException] { " + companion + ".install(technicalBindings.copy(" + first + " = technicalBindings." + first + ".copy(version = \"wrong\"))) }\n" +
      "      intercept[IllegalArgumentException] { " + companion + ".install(technicalBindings.copy(" + first + " = technicalBindings." + first + ".copy(run = null))) }\n"
  }

  private def resultMatrix(pkg: String, definition: String, host: String): String = s"""      val observedKinds = scala.collection.mutable.Set("succeeded", "rejected-before-effects")
      for ((mode, expectedResult, expectedEvent) <- Vector(("compensated", "compensated", "ReservationCompensated"), ("recovery-required", "recovery-required", "ReservationRecoveryRequired"), ("outcome-unknown", "outcome-unknown", "ReservationOutcomeUnknown"))) {
        fault.set(mode)
        val input = original.copy(requestId = $pkg.domain.values.ReservationRequestId("request-" + mode))
        val pid = "matrix-coordinator-" + mode
        var current = kit.spawn($definition.coordinator(pid, ports, authorizer))
        var matrixHost = kit.spawn($host("matrix-host-" + mode, current, installedTechnical))
        matrixHost ! $host.Submit(input, reply.ref)
        val started = reply.expectMessageType[$host.Accepted]
        status.awaitAssert { current ! StrictSagaCoordinator.GetStatus(status.ref); terminal = status.expectMessageType[StrictSagaCoordinator.Status].state; assert($host.classify(terminal).contains(expectedResult)) }
        val countBeforeAttach = executeCounts.toMap
        current ! StrictSagaCoordinator.Attach(started.identity, status.ref)
        assert(status.expectMessageType[StrictSagaCoordinator.Status].state.identity.contains(started.identity))
        assert(executeCounts.toMap == countBeforeAttach)
        if (mode == "outcome-unknown") loseDeliveryAck.set(true)
        matrixHost ! $host.Observe(reply.ref)
        if (mode == "outcome-unknown") {
          reply.expectMessage($host.Waiting("delivery unacknowledged"))
          actor_allocation ! $pkg.domain.AllocationOrderAggregate.GetState(allocation.ref)
          assert(allocation.receiveMessage().result == expectedEvent)
          kit.stop(matrixHost)
          matrixHost = kit.spawn($host("matrix-host-" + mode, current, installedTechnical))
          matrixHost ! $host.Submit(input, reply.ref)
        }
        reply.expectMessage($host.ResultRecorded(expectedResult))
        observedKinds += expectedResult
        actor_allocation ! $pkg.domain.AllocationOrderAggregate.GetState(allocation.ref)
        assert(allocation.receiveMessage().result == expectedEvent)
        if (mode == "compensated") {
          assert(terminal.status == StrictStatus.Aborted)
          assert(terminal.evidence.keys.exists(_.phase == Phase.Compensate))
          assert(!terminal.commitDecision)
        } else {
          assert(terminal.status == StrictStatus.RecoveryRequired && terminal.commitDecision)
          kit.stop(current)
          kit.stop(matrixHost)
          current = kit.spawn($definition.coordinator(pid, ports, authorizer))
          matrixHost = kit.spawn($host("matrix-host-" + mode, current, installedTechnical))
          matrixHost ! $host.Submit(input, reply.ref)
          reply.expectMessage($host.ResultRecorded(expectedResult))
          assert(executeCounts.toMap == countBeforeAttach)
          current ! StrictSagaCoordinator.Reconcile(started.identity, "denied", 20, status.ref)
          status.expectMessageType[StrictSagaCoordinator.Denied]
          assert(executeCounts.toMap == countBeforeAttach)
          current ! StrictSagaCoordinator.Reconcile(started.identity, "owned-test-reconcile", 20, status.ref)
          assert(status.expectMessageType[StrictSagaCoordinator.Status].state.identity.contains(started.identity))
          status.awaitAssert { current ! StrictSagaCoordinator.GetStatus(status.ref); terminal = status.expectMessageType[StrictSagaCoordinator.Status].state; assert(terminal.status == StrictStatus.Succeeded) }
          val firstCommit = OperationIdentity(started.identity, "warehouse", "warehouse-A", "reserve-sku", Phase.Commit)
          assert(queryCounts.getOrElse(firstCommit, 0) == (if (mode == "outcome-unknown") 1 else 0))
          assert(executeCounts(firstCommit) == (if (mode == "outcome-unknown") 1 else 2))
          matrixHost ! $host.Observe(reply.ref)
          reply.expectMessage($host.ResultRecorded("succeeded"))
          actor_allocation ! $pkg.domain.AllocationOrderAggregate.GetState(allocation.ref)
          assert(allocation.receiveMessage().result == "ReservationSucceeded")
          matrixHost ! $host.Submit(input.copy(sku = $pkg.domain.values.SkuId("conflicting-sku")), reply.ref)
          reply.expectMessageType[$host.Conflict]
        }
      }
      assert(observedKinds == Set("succeeded", "rejected-before-effects", "compensated", "recovery-required", "outcome-unknown"))
      assert(deliveryCounts("outcome-unknown") == 2)
"""

  private def admissionReentry(h: SagaHostContract, pkg: String, stem: String, model: ProductApplicationModel): String = {
    ProductHostIOTemplate.resourcePolicy(h).map { policy =>
      val host = pkg + ".application." + stem + "Host"
      val definition = pkg + ".application." + stem + "Definition"
      val technical = pkg + ".application." + stem + "TechnicalPorts"
      val originalType = tpe(h.entry.inputType, model)
      val members = recordMembersOf(h.entry.inputType, model)
      val requestType = tpe(members.find(_.ref.id == "requestId").get.valueType.get, model)
      val skuType = tpe(members.find(_.ref.id == "sku").get.valueType.get, model)
      val entry = NamingConventions.strictSymbol(h.entry.port.ref.id)
      val association = NamingConventions.strictSymbol(h.association.port.ref.id)
      val resource = NamingConventions.strictSymbol(policy.port.ref.id)
      s"""      val admissionJournal = akka.persistence.testkit.scaladsl.PersistenceTestKit(kit.system)
      assert(!admissionJournal.persistedInStorage("extended-denied-policy-host").contains($host.AdmissionGranted))
      val reentryOriginal = original.copy(requestId = $requestType("request-admission"))
      val entryAdmissions = new java.util.concurrent.atomic.AtomicInteger(0)
      val associationAdmissions = new java.util.concurrent.atomic.AtomicInteger(0)
      val policyAdmissions = new java.util.concurrent.atomic.AtomicInteger(0)
      val oldAdmissionGate = scala.concurrent.Promise[Boolean]()
      val admissionBase = technicalBindings.copy(
        $entry = technicalBindings.$entry.copy(run = (_: $originalType) => { entryAdmissions.incrementAndGet(); Future.successful(true) }),
        $association = technicalBindings.$association.copy(run = (_: $originalType) => { associationAdmissions.incrementAndGet(); Future.successful(true) }))
      val heldAdmission = $technical.install(admissionBase.copy($resource = technicalBindings.$resource.copy(run = (_: $originalType) => { policyAdmissions.incrementAndGet(); oldAdmissionGate.future })))
      var reentryCoordinator = kit.spawn($definition.coordinator("extended-admission-coordinator", $definition.fromTechnical(heldAdmission), authorizer))
      var reentryHost = kit.spawn($host("extended-admission-host", reentryCoordinator, heldAdmission))
      val admissionReply1 = kit.createTestProbe[$host.Reply]()
      val admissionReply2 = kit.createTestProbe[$host.Reply]()
      val admissionConflict = kit.createTestProbe[$host.Reply]()
      val beforeAdmissionReceipts = receipts.toMap
      val beforeAdmissionDeliveries = deliveryCounts.toMap
      val beforeAdmissionAuthority = authorityCalls.get()
      reentryHost ! $host.Submit(reentryOriginal, admissionReply1.ref)
      admissionReply1.awaitAssert { assert(policyAdmissions.get() == 1) }
      reentryHost ! $host.Submit(reentryOriginal, admissionReply2.ref)
      reentryHost ! $host.Submit(reentryOriginal.copy(sku = $skuType("conflicting-admission-sku")), admissionConflict.ref)
      admissionConflict.expectMessageType[$host.Conflict]
      assert(entryAdmissions.get() == 1 && associationAdmissions.get() == 1 && policyAdmissions.get() == 1)
      assert(receipts.toMap == beforeAdmissionReceipts && deliveryCounts.toMap == beforeAdmissionDeliveries && authorityCalls.get() == beforeAdmissionAuthority)
      assert(admissionJournal.persistedInStorage("extended-admission-host").count(_.isInstanceOf[$host.Associated]) == 1)
      assert(!admissionJournal.persistedInStorage("extended-admission-host").contains($host.AdmissionGranted))
      kit.stop(reentryHost)
      val newAdmissionGate = scala.concurrent.Promise[Boolean]()
      val replacementAdmission = $technical.install(admissionBase.copy($resource = technicalBindings.$resource.copy(run = (_: $originalType) => { policyAdmissions.incrementAndGet(); newAdmissionGate.future })))
      reentryHost = kit.spawn($host("extended-admission-host", reentryCoordinator, replacementAdmission))
      reentryHost ! $host.Submit(reentryOriginal, admissionReply1.ref)
      admissionReply1.awaitAssert { assert(policyAdmissions.get() == 2) }
      reentryHost ! $host.Submit(reentryOriginal, admissionReply2.ref)
      reentryHost ! $host.Submit(reentryOriginal.copy(sku = $skuType("conflicting-admission-sku")), admissionConflict.ref)
      admissionConflict.expectMessageType[$host.Conflict]
      oldAdmissionGate.success(true)
      admissionReply1.expectNoMessage(200.millis)
      admissionReply2.expectNoMessage(200.millis)
      assert(receipts.toMap == beforeAdmissionReceipts && deliveryCounts.toMap == beforeAdmissionDeliveries)
      assert(!admissionJournal.persistedInStorage("extended-admission-host").contains($host.AdmissionGranted))
      newAdmissionGate.success(true)
      val admissionIdentity1 = admissionReply1.expectMessageType[$host.Accepted].identity
      val admissionIdentity2 = admissionReply2.expectMessageType[$host.Accepted].identity
      assert(admissionIdentity1 == admissionIdentity2)
      val admissionStatus = kit.createTestProbe[StrictSagaCoordinator.Reply]()
      admissionStatus.awaitAssert { reentryCoordinator ! StrictSagaCoordinator.GetStatus(admissionStatus.ref); val state = admissionStatus.expectMessageType[StrictSagaCoordinator.Status].state; assert(state.status == StrictStatus.Succeeded && state.identity.contains(admissionIdentity1)); assert(state.evidence.values.count(_.isInstanceOf[Evidence.Confirmed]) == 6) }
      assert(admissionJournal.persistedInStorage("extended-admission-host").count(_ == $host.AdmissionGranted) == 1)
      reentryHost ! $host.Observe(admissionReply1.ref)
      admissionReply1.expectMessage($host.ResultRecorded("succeeded"))
      val admittedReceipts = receipts.toMap
      val admittedDeliveries = deliveryCounts.toMap
      val recoveryAdmission = $technical.install(admissionBase.copy($resource = technicalBindings.$resource.copy(run = (_: $originalType) => { policyAdmissions.incrementAndGet(); throw new IllegalStateException("durable admission must not invoke policy again") })))
      kit.stop(reentryHost)
      kit.stop(reentryCoordinator)
      reentryCoordinator = kit.spawn($definition.coordinator("extended-admission-coordinator", $definition.fromTechnical(recoveryAdmission), authorizer))
      reentryHost = kit.spawn($host("extended-admission-host", reentryCoordinator, recoveryAdmission))
      reentryHost ! $host.Submit(reentryOriginal, admissionReply1.ref)
      admissionReply1.expectMessage($host.ResultRecorded("succeeded"))
      assert(entryAdmissions.get() == 2 && associationAdmissions.get() == 2 && policyAdmissions.get() == 2)
      assert(receipts.toMap == admittedReceipts && deliveryCounts.toMap == admittedDeliveries)
      assert(admissionJournal.persistedInStorage("extended-admission-host").count(_ == $host.AdmissionGranted) == 1)
      reentryCoordinator ! StrictSagaCoordinator.GetStatus(admissionStatus.ref)
      assert(admissionStatus.expectMessageType[StrictSagaCoordinator.Status].state.identity.contains(admissionIdentity1))
"""
    }.getOrElse("")
  }

  /** Lean independent oracle for declared extended roles: denials stay effect-free; typed roundtrips go through Installed. */
  private def extendedPortsSpec(model: ProductApplicationModel): Vector[ProductSourceModel] = {
    val hosts = model.hosts.filter(row => row.contract.saga.ref.context == "inventory" && row.contract.technicalPorts.exists(p => extendedRoles(p.role)))
    if (hosts.isEmpty) Vector.empty
    else {
      var text = "import akka.actor.testkit.typed.scaladsl.ActorTestKit\nimport akka.actor.typed.scaladsl.AskPattern._\nimport akka.persistence.testkit.PersistenceTestKitPlugin\nimport com.typesafe.config.ConfigFactory\nimport net.imadz.infra.saga.strict._\nimport org.scalatest.funsuite.AnyFunSuite\nimport scala.concurrent.{Await, ExecutionContext, Future}\nimport scala.concurrent.duration._\nimport akka.util.Timeout\n\nfinal class GeneratedExtendedPortsSpec extends AnyFunSuite {\n"
      hosts.foreach { row =>
        val h = row.contract; val pkg = model.domain.packages(h.saga.ref.context); val stem = NamingConventions.strictSymbol(h.id)
        val definition = pkg + ".application." + stem + "Definition"; val host = pkg + ".application." + stem + "Host"
        val companion = pkg + ".application." + stem + "TechnicalPorts"
        text += "  test(" + quote(h.id + " extended typed port roles deny without effects and roundtrip installed objects") + ") {\n    val kit = ActorTestKit(ConfigFactory.parseString(\"akka.actor.provider = local\").withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))\n    implicit val ec: ExecutionContext = kit.system.executionContext\n    implicit val timeout: Timeout = 3.seconds\n    implicit val scheduler: akka.actor.typed.Scheduler = kit.system.scheduler\n    try {\n"
        h.participants.foreach { p =>
          val aggregate = p.aggregate.id
          val computations = if (aggregate == "Warehouse") "new " + pkg + ".domain.WarehouseComputations { def ReservationIdentity(state: " + pkg + ".domain.WarehouseState, p: " + pkg + ".domain.WarehouseProtocol.ReserveSkuQuantity): " + pkg + ".domain.values.ReservationId = " + pkg + ".domain.values.ReservationId(\"reservation-\" + p.txid.value) }" else "new " + pkg + ".domain." + aggregate + "Computations {}"
          val authority = if (model.domain.aggregates.find(_.declaration.ref == p.aggregate).get.external.nonEmpty) ", new " + pkg + ".domain." + aggregate + "Aggregate.ExternalAuthority { def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean = authorization == \"owned-test-authority\" }" else ""
          text += "      val actor_" + p.participantId + " = kit.spawn(" + pkg + ".domain." + aggregate + "Aggregate(\"extended-" + p.participantId + "\", " + pkg + ".domain." + aggregate + "State.empty, " + computations + authority + "))\n"
        }
        val members = field(h.entry.inputType.asInstanceOf[NominalType.Named].ref, model).valueType.get.asInstanceOf[NominalType.Record].members
        val originalLiteral = tpe(h.entry.inputType, model) + "(" + members.map { r =>
          val value = if (r.id == "warehouse") "warehouse-A" else if (r.id == "destination") "warehouse-B" else if (r.id == "allocation") "allocation-last" else if (r.id == "sku") "sku-A" else "request-A"
          val t = field(r, model).valueType.get
          if (t == NominalType.Primitive("integer")) "3L" else make(value, t, model)
        }.mkString(", ") + ")"
        text += "      val original = " + originalLiteral + "\n"
        text += technicalObjects(h, pkg, stem, model, working = true, originalLiteral = originalLiteral)
        val keyIds = h.association.inputKeys.map(_.id).toSet
        text += "      val ports = " + definition + ".fromTechnical(installedTechnical)\n      val authorizer = new ReconcileAuthorizer { def authorize(identity: TransactionIdentity, token: String): Either[String, String] = if (token == \"owned-test-reconcile\") Right(\"owned-test-principal\") else Left(\"test reconciliation denied\") }\n      val coordinator = kit.spawn(" + definition + ".coordinator(\"extended-coordinator-" + stem + "\", ports, authorizer))\n      val reply = kit.createTestProbe[" + host + ".Reply]()\n"
        def methodOf(role: String): String = NamingConventions.strictSymbol(h.technicalPorts.find(_.role == role).get.port.ref.id)
        def pinOf(role: String): ArtifactPort = { val p = h.technicalPorts.find(_.role == role).get; model.ports.find(a => a.ref == p.port.ref && a.version == p.port.version).get }
        ProductHostIOTemplate.resourcePolicy(h).filter(_ => h.entry.startOwner.kind == "direct").foreach { _ =>
          val m = methodOf("resource-policy")
          text += "      intercept[IllegalArgumentException] { " + companion + ".install(technicalBindings.copy(" + m + " = technicalBindings." + m + ".copy(run = null))) }\n" +
            "      val deniedPolicy = " + companion + ".install(technicalBindings.copy(" + m + " = technicalBindings." + m + ".copy(run = (_: " + tpe(h.entry.inputType, model) + ") => Future.successful(false))))\n" +
            "      val deniedPolicyHost = kit.spawn(" + host + "(\"extended-denied-policy-host\", coordinator, deniedPolicy))\n" +
            "      deniedPolicyHost ! " + host + ".Submit(original, reply.ref)\n" +
            "      reply.expectMessage(" + host + ".Waiting(\"resource policy denied\"))\n" +
            "      assert(receipts.isEmpty && deliveryCounts.isEmpty && authorityCalls.get() == 0)\n"
        }
        ProductHostIOTemplate.occurrenceBridge(h).filter(_ => h.entry.startOwner.kind == "direct").foreach { case (gate, _) =>
          val envelopeType = pinOf("external-event").inputType
          val owned = envelopeLiteral(envelopeType, "owned-test-authority", model)
          val forged = envelopeLiteral(envelopeType, "forged-authorization", model)
          text += "      val occurrenceHost = kit.spawn(" + host + "(\"extended-occurrence-host\", coordinator, installedTechnical))\n" +
            "      occurrenceHost ! " + host + ".SubmitOccurrence(" + forged + ", reply.ref)\n" +
            "      reply.expectMessage(" + host + ".Waiting(\"occurrence source denied\"))\n" +
            "      assert(receipts.isEmpty && deliveryCounts.isEmpty)\n" +
            "      occurrenceHost ! " + host + ".SubmitOccurrence(" + owned + ", reply.ref)\n" +
            "      reply.expectMessageType[" + host + ".Accepted]\n" +
            "      val extendedStatus = kit.createTestProbe[StrictSagaCoordinator.Reply]()\n" +
            "      var extendedTerminal: StrictState = null\n" +
            "      extendedStatus.awaitAssert { coordinator ! StrictSagaCoordinator.GetStatus(extendedStatus.ref); extendedTerminal = extendedStatus.expectMessageType[StrictSagaCoordinator.Status].state; assert(extendedTerminal.status == StrictStatus.Succeeded) }\n" +
            "      occurrenceHost ! " + host + ".Observe(reply.ref)\n" +
            "      reply.expectMessage(" + host + ".ResultRecorded(\"succeeded\"))\n"
        }
        h.technicalPorts.find(_.role == "external-submission").foreach { _ =>
          val pin = pinOf("external-submission"); val m = methodOf("external-submission")
          val literal = extendedRecord(pin.outputType, keyIds, "original", model)
          text += "      assert(Await.result(installedTechnical." + m + "(original), 3.seconds) == " + literal + ")\n"
        }
        h.technicalPorts.find(_.role == "external-query").foreach { _ =>
          val pin = pinOf("external-query"); val m = methodOf("external-query")
          val query = extendedRecord(pin.inputType, keyIds, "original", model)
          val receipt = extendedRecord(optionalElement(pin.outputType), keyIds, "externalAssociation", model)
          text += "      val externalAssociation = " + query + "\n" +
            "      assert(Await.result(installedTechnical." + m + "(externalAssociation), 3.seconds).contains(" + receipt + "))\n" +
            "      val absentReceipt = " + companion + ".install(technicalBindings.copy(" + m + " = technicalBindings." + m + ".copy(run = (_: " + tpe(pin.inputType, model) + ") => Future.successful(None))))\n" +
            "      assert(Await.result(absentReceipt." + m + "(externalAssociation), 3.seconds).isEmpty)\n"
        }
        if (ProductHostIOTemplate.occurrenceBridge(h).isEmpty || h.entry.startOwner.kind == "pipeline") {
          h.technicalPorts.find(_.role == "external-event").foreach { _ =>
            val pin = pinOf("external-event"); val m = methodOf("external-event")
            text += "      assert(!Await.result(installedTechnical." + m + "(" + envelopeLiteral(pin.inputType, "forged-authorization", model) + "), 3.seconds))\n" +
              "      assert(Await.result(installedTechnical." + m + "(" + envelopeLiteral(pin.inputType, "owned-test-authority", model) + "), 3.seconds))\n" +
              "      assert(receipts.isEmpty && deliveryCounts.isEmpty)\n"
          }
          h.technicalPorts.find(_.role == "occurrence-source").foreach { _ =>
            val pin = pinOf("occurrence-source"); val m = methodOf("occurrence-source")
            text += "      assert(Await.result(installedTechnical." + m + "(" + envelopeLiteral(pin.inputType, "owned-test-authority", model) + "), 3.seconds) == original)\n" +
              "      assert(receipts.isEmpty && deliveryCounts.isEmpty)\n"
          }
        }
        h.technicalPorts.find(_.role == "readside").foreach { _ =>
          val pin = pinOf("readside"); val m = methodOf("readside")
          val query = extendedRecord(pin.inputType, keyIds, "original", model)
          val view = extendedRecord(optionalElement(pin.outputType), keyIds, "original", model)
          text += "      assert(Await.result(installedTechnical." + m + "(" + query + "), 3.seconds) == Some(" + view + "))\n"
        }
        h.technicalPorts.find(_.role == "deployment").foreach { _ =>
          val pin = pinOf("deployment"); val m = methodOf("deployment")
          val target = extendedRecord(pin.inputType, Set.empty, "input", model)
          text += "      val deploymentTarget = " + target + "\n" +
            "      assert(Await.result(installedTechnical." + m + "(deploymentTarget), 3.seconds))\n" +
            "      val notReady = " + companion + ".install(technicalBindings.copy(" + m + " = technicalBindings." + m + ".copy(run = (_: " + tpe(pin.inputType, model) + ") => Future.successful(false))))\n" +
            "      assert(!Await.result(notReady." + m + "(deploymentTarget), 3.seconds))\n"
        }
        ProductHostIOTemplate.resourcePolicy(h).foreach { _ =>
          text += "      assert(Await.result(installedTechnical." + methodOf("resource-policy") + "(original), 3.seconds))\n"
        }
        text += "      assert(" + companion + ".bindingOwnership.size == " + h.technicalPorts.size + ")\n" +
          "      assert(" + companion + ".bindingOwnership.forall(_.boundary == \"handwritten-composition-root\"))\n"
        def wrongKey(t: NominalType, value: String): String = {
          val key = recordMembersOf(t, model).find(m => keyIds(m.ref.id)).get
          value + ".copy(" + sym(key.ref.id) + " = " + make("wrong-original-association", key.valueType.get, model) + ")"
        }
        h.technicalPorts.filter(p => Set("external-submission", "external-query", "readside")(p.role)).foreach { p =>
          val pin = pinOf(p.role); val m = methodOf(p.role)
          val input = if (p.role == "external-submission") "original" else extendedRecord(pin.inputType, keyIds, "original", model)
          val recordType = if (p.role == "external-submission") pin.outputType else optionalElement(pin.outputType)
          val record = extendedRecord(recordType, keyIds, "original", model)
          val response = wrongKey(recordType, record)
          val result = if (p.role == "external-submission") response else "Some(" + response + ")"
          text += "      val wrong_" + m + " = " + companion + ".install(technicalBindings.copy(" + m + " = technicalBindings." + m + ".copy(run = (_: " + tpe(pin.inputType, model) + ") => Future.successful(" + result + "))))\n" +
            "      intercept[IllegalArgumentException] { Await.result(wrong_" + m + "." + m + "(" + input + "), 3.seconds) }\n"
        }
        h.technicalPorts.find(_.role == "deployment").foreach { _ =>
          val m = methodOf("deployment"); val pin = pinOf("deployment")
          val secret = recordMembersOf(pin.inputType, model).find(_.ref.id == "secretRef").get
          text += "      val beforeSecretCallback = technicalCalls.get()\n" +
            "      intercept[IllegalArgumentException] { Await.result(installedTechnical." + m + "(deploymentTarget.copy(secretRef = " + make("not-a-declared-secret-reference", secret.valueType.get, model) + ")), 3.seconds) }\n" +
            "      assert(technicalCalls.get() == beforeSecretCallback)\n"
        }
        if (h.entry.startOwner.kind == "direct") text += admissionReentry(h, pkg, stem, model)
        text += "    } finally kit.shutdownTestKit()\n  }\n"
      }
      text += "}\n"
      hosts.map(_.contract.saga.ref.context).distinct.foreach { context =>
        val pkg = model.domain.packages(context)
        text = "import " + pkg + ".domain.values._\nimport " + pkg + ".application._\n" + text.replace(pkg + ".domain.values.", "").replace(pkg + ".application.", "")
      }
      Vector(ProductSourceModel("src/test/scala/GeneratedExtendedPortsSpec.scala", text, "generated-test", hosts.map(_.contract.source), model.footprint))
    }
  }

  private val specImports = "import akka.actor.testkit.typed.scaladsl.ActorTestKit\nimport akka.actor.typed.scaladsl.AskPattern._\nimport akka.persistence.testkit.PersistenceTestKitPlugin\nimport com.typesafe.config.ConfigFactory\nimport net.imadz.infra.saga.strict._\nimport org.scalatest.funsuite.AnyFunSuite\nimport scala.concurrent.{Await, ExecutionContext, Future}\nimport scala.concurrent.duration._\nimport akka.util.Timeout\n\n"
  private def testOpen(title: String): String = "  test(" + quote(title) + ") {\n    val kit = ActorTestKit(ConfigFactory.parseString(\"akka.actor.provider = local\").withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))\n    implicit val ec: ExecutionContext = kit.system.executionContext\n    implicit val timeout: Timeout = 3.seconds\n    implicit val scheduler: akka.actor.typed.Scheduler = kit.system.scheduler\n    try {\n"

  /** Shared per-host setup: aggregate actors, exact technical bindings, fault-injecting ports, coordinator. */
  private def specSetup(row: ProductApplicationHost, model: ProductApplicationModel): String = {
    val h = row.contract; val pkg = model.domain.packages(h.saga.ref.context); val stem = NamingConventions.strictSymbol(h.id)
    val definition = pkg + ".application." + stem + "Definition"; val args = tpe(h.argsType, model)
    var text = ""
    h.participants.foreach { p =>
      val aggregate = p.aggregate.id
      val computations = if (aggregate == "Warehouse") "new " + pkg + ".domain.WarehouseComputations { def ReservationIdentity(state: " + pkg + ".domain.WarehouseState, p: " + pkg + ".domain.WarehouseProtocol.ReserveSkuQuantity): " + pkg + ".domain.values.ReservationId = " + pkg + ".domain.values.ReservationId(\"reservation-\" + p.txid.value) }" else "new " + pkg + ".domain." + aggregate + "Computations {}"
      val authority = if (model.domain.aggregates.find(_.declaration.ref == p.aggregate).get.external.nonEmpty) ", new " + pkg + ".domain." + aggregate + "Aggregate.ExternalAuthority { def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean = authorization == \"owned-test-authority\" }" else ""
      text += "      val actor_" + p.participantId + " = kit.spawn(" + pkg + ".domain." + aggregate + "Aggregate(\"generated-" + p.participantId + "\", " + pkg + ".domain." + aggregate + "State.empty, " + computations + authority + "))\n"
    }
    text += technicalObjects(h, pkg, stem, model)
    text += "      val executeCounts = scala.collection.concurrent.TrieMap.empty[OperationIdentity, Int]\n      val delegated = " + definition + ".fromTechnical(installedTechnical)\n      val queryCounts = scala.collection.concurrent.TrieMap.empty[OperationIdentity, Int]\n      val injectedAbsence = scala.collection.concurrent.TrieMap.empty[OperationIdentity, Boolean]\n      val fault = new java.util.concurrent.atomic.AtomicReference[String](\"\")\n      val ports = new " + definition + ".Ports {\n        val technical = installedTechnical\n        val installed = technical.declarations\n"
    h.participants.foreach { p => p.phases.foreach { pf =>
      val m = method(p, pf); val receipt = tpe(pf.evidence.receiptType, model)
      val idValues = pf.evidence.identity.map { member =>
        val value = member.key match {
          case SagaIdentityPart.Transaction => "request.identity.transaction.transactionId"
          case SagaIdentityPart.DefinitionVersion => "request.identity.transaction.definitionVersion.toString"
          case SagaIdentityPart.ArgsDigest => "request.identity.transaction.argsDigest"
          case SagaIdentityPart.Participant => "request.identity.participantId"
          case SagaIdentityPart.Resource => "request.identity.resource"
          case SagaIdentityPart.Step => "request.identity.stepId"
          case SagaIdentityPart.Phase => "request.identity.phase.toString.toLowerCase(java.util.Locale.ROOT)"
        }
        field(member.member, model).valueType.get match { case n: NominalType.Named => tpe(n, model) + "(" + value + ")"; case _ => value }
      }
      val values = (idValues ++ pf.evidence.payload.map(m => "event." + sym(m.output))).mkString(", ")
      text += "        val " + m + ": PhasePort[" + args + ", " + receipt + "] = new PhasePort[" + args + ", " + receipt + "] {\n          val receiptCodec = " + definition + "." + m + "Codec\n          val querySafety = QuerySafety.DeclaredReadOnly\n          def execute(request: OperationRequest[" + args + "]): Future[PhaseOutcome[" + receipt + "]] = {\n            executeCounts.update(request.identity, executeCounts.getOrElse(request.identity, 0) + 1)\n            if (request.identity.stepId == \"reserve-destination\" && request.identity.phase == Phase.Prepare && fault.compareAndSet(\"compensated\", \"\")) {\n              injectedAbsence.put(request.identity, true)\n              return Future.successful(NotExecuted(request.identity, \"test-only injected fenced absence before destination effect\", safeToRetry = true))\n            }\n            if (request.identity.stepId == \"reserve-sku\" && request.identity.phase == Phase.Commit && fault.compareAndSet(\"recovery-required\", \"\")) {\n              injectedAbsence.put(request.identity, true)\n              return Future.successful(NotExecuted(request.identity, \"test-only commit was not dispatched\", safeToRetry = true))\n            }\n            delegated." + m + ".execute(request).map {\n              case c: ConfirmedReceipt[" + receipt + "] =>\n                injectedAbsence.remove(request.identity)\n                if (request.identity.stepId == \"reserve-sku\" && request.identity.phase == Phase.Commit && fault.compareAndSet(\"outcome-unknown\", \"\")) Unknown(request.identity, \"test-only reply lost after actual event persistence\") else c\n              case Unknown(_, reason) if request.args.quantity == 0L && reason.contains(\"quantity-positive\") => NotExecuted(request.identity, \"test-only authoritative zero quantity guard before any effect\", safeToRetry = true)\n              case other => other\n            }\n          }\n          def query(request: OperationRequest[" + args + "]): Future[PhaseOutcome[" + receipt + "]] = {\n            queryCounts.update(request.identity, queryCounts.getOrElse(request.identity, 0) + 1)\n            if (injectedAbsence.contains(request.identity)) Future.successful(NotExecuted(request.identity, \"test-only exact injected absence\", safeToRetry = true)) else delegated." + m + ".query(request)\n          }\n        }\n"
    } }
    text += "      }\n      val missingObjects = new " + definition + ".Ports {\n        val technical = installedTechnical\n        val installed = ports.installed\n"
    h.participants.foreach(p => p.phases.foreach(pf => text += "        def " + method(p, pf) + ": PhasePort[" + args + ", " + tpe(pf.evidence.receiptType, model) + "] = null\n"))
    text += "      }\n      intercept[IllegalArgumentException] { " + definition + ".definition(missingObjects) }\n      assert(executeCounts.isEmpty && queryCounts.isEmpty)\n      val authorizer = new ReconcileAuthorizer { def authorize(identity: TransactionIdentity, token: String): Either[String, String] = if (token == \"owned-test-reconcile\") Right(\"owned-test-principal\") else Left(\"test reconciliation denied\") }\n      val coordinator = kit.spawn(" + definition + ".coordinator(\"generated-coordinator-" + stem + "\", ports, authorizer))\n"
    text
  }

  /** Independent recovery oracle: injected absence, reconcile and restart windows stay exact, in its own bounded file. */
  private def recoverySpec(model: ProductApplicationModel): Vector[ProductSourceModel] = {
    val hosts = model.hosts.filter(row => row.contract.saga.ref.context == "inventory" && row.contract.entry.startOwner.kind != "pipeline")
    if (hosts.isEmpty) Vector.empty
    else {
      var text = specImports + "final class GeneratedHostRecoverySpec extends AnyFunSuite {\n"
      hosts.foreach { row =>
        val h = row.contract; val pkg = model.domain.packages(h.saga.ref.context); val stem = NamingConventions.strictSymbol(h.id)
        val definition = pkg + ".application." + stem + "Definition"; val host = pkg + ".application." + stem + "Host"
        text += testOpen(h.id + " injected absence, late reconcile and same identity restart keep exact recovery effects")
        text += specSetup(row, model)
        val members = field(h.entry.inputType.asInstanceOf[NominalType.Named].ref, model).valueType.get.asInstanceOf[NominalType.Record].members
        val values = members.map { r =>
          val value = if (r.id == "warehouse") "warehouse-A" else if (r.id == "destination") "warehouse-B" else if (r.id == "allocation") "allocation-last" else if (r.id == "sku") "sku-A" else "request-A"
          val t = field(r, model).valueType.get
          if (t == NominalType.Primitive("integer")) "3L" else make(value, t, model)
        }.mkString(", ")
        text += "      val reply = kit.createTestProbe[" + host + ".Reply]()\n      val original = " + tpe(h.entry.inputType, model) + "(" + values + ")\n      val status = kit.createTestProbe[StrictSagaCoordinator.Reply]()\n      var terminal: StrictState = null\n      val allocation = kit.createTestProbe[" + pkg + ".domain.AllocationOrderState]()\n"
        text += resultMatrix(pkg, definition, host)
        text += "    } finally kit.shutdownTestKit()\n  }\n"
      }
      text += "}\n"
      hosts.map(_.contract.saga.ref.context).distinct.foreach { context =>
        val pkg = model.domain.packages(context)
        text = "import " + pkg + ".domain.values._\nimport " + pkg + ".application._\n" + text.replace(pkg + ".domain.values.", "").replace(pkg + ".application.", "")
      }
      Vector(ProductSourceModel("src/test/scala/GeneratedHostRecoverySpec.scala", text, "generated-test", hosts.map(_.contract.source), model.footprint))
    }
  }

  /** Installation-only oracle: every declared port and its role-specific callbacks are required before actors start. */
  private def requiredBindingsSpec(model: ProductApplicationModel): Vector[ProductSourceModel] = {
    val hosts = model.hosts.filter(_.contract.saga.ref.context == "inventory")
    if (hosts.isEmpty) Vector.empty
    else {
      var text = "import org.scalatest.funsuite.AnyFunSuite\nimport scala.concurrent.Future\nimport net.imadz.infra.saga.strict.OperationIdentity\n\nfinal class GeneratedRequiredBindingsSpec extends AnyFunSuite {\n"
      hosts.foreach { row =>
        val h = row.contract; val pkg = model.domain.packages(h.saga.ref.context); val stem = NamingConventions.strictSymbol(h.id)
        val companion = pkg + ".application." + stem + "TechnicalPorts"
        text += "  test(" + quote(h.id + " requires every exact technical object before host startup") + ") {\n"
        text += "    val bindings = " + companion + ".Bindings(\n" + h.technicalPorts.map { p =>
          val pin = model.ports.find(a => a.ref == p.port.ref && a.version == p.port.version).get
          val in = tpe(pin.inputType, model); val out = tpe(pin.outputType, model)
          val callback = "Future.failed(new IllegalStateException(\"installation-only test callback must not execute\"))"
          "      " + companion + ".Implementation[" + in + ", " + out + "](" + quote(p.implementation.id) + ", " + quote(p.implementation.version) + ", (_: " + in + ") => " + callback +
            (if (Set("phase-execute", "phase-query")(p.role)) ", operation = (_: " + in + ", _: OperationIdentity) => " + callback else "") +
            (if (Set("authority", "result-delivery")(p.role)) ", completion = (_: " + in + ", _: " + companion + ".CompletionContext) => " + callback else "") + ")"
        }.mkString(",\n") + "\n    )\n"
        text += "    val installed = " + companion + ".install(bindings)\n    assert(installed.declarations.size == " + h.technicalPorts.size + ")\n    assert(" + companion + ".bindingOwnership.map(_.port).toSet == installed.declarations.keySet)\n    intercept[IllegalArgumentException] { " + companion + ".install(null) }\n"
        val invalid = h.technicalPorts.flatMap { p =>
          val method = NamingConventions.strictSymbol(p.port.ref.id)
          val replacements = Vector("null" -> "null", "id" -> ("bindings." + method + ".copy(id = \"wrong-id\")"), "version" -> ("bindings." + method + ".copy(version = \"wrong-version\")"), "run" -> ("bindings." + method + ".copy(run = null)")) ++
            (if (Set("phase-execute", "phase-query")(p.role)) Vector("operation" -> ("bindings." + method + ".copy(operation = null)")) else Vector.empty) ++
            (if (Set("authority", "result-delivery")(p.role)) Vector("completion" -> ("bindings." + method + ".copy(completion = null)")) else Vector.empty)
          replacements.map { case (kind, value) => "      " + quote(p.port.ref.id + "/" + kind) + " -> (() => " + companion + ".install(bindings.copy(" + method + " = " + value + ")))" }
        }
        text += "    val invalid: Vector[(String, () => " + companion + ".Installed)] = Vector(\n" + invalid.mkString(",\n") + "\n    )\n    invalid.foreach { case (name, run) => withClue(name) { intercept[IllegalArgumentException] { run() } } }\n  }\n"
      }
      text += "}\n"
      hosts.map(_.contract.saga.ref.context).distinct.foreach { context =>
        val pkg = model.domain.packages(context)
        text = "import " + pkg + ".domain.values._\nimport " + pkg + ".application._\n" + text.replace(pkg + ".domain.values.", "").replace(pkg + ".application.", "")
      }
      Vector(ProductSourceModel("src/test/scala/GeneratedRequiredBindingsSpec.scala", text, "generated-test", hosts.map(_.contract.source), model.footprint))
    }
  }

  def generate(model: ProductApplicationModel): Vector[ProductSourceModel] = {
    val hosts = model.hosts.filter(_.contract.saga.ref.context == "inventory")
    if (hosts.isEmpty) Vector.empty
    else {
      var text = specImports + "final class GeneratedFiniteHostSpec extends AnyFunSuite {\n"
      hosts.foreach { row =>
        val h = row.contract; val pkg = model.domain.packages(h.saga.ref.context); val stem = NamingConventions.strictSymbol(h.id)
        val definition = pkg + ".application." + stem + "Definition"; val host = pkg + ".application." + stem + "Host"
        text += testOpen(h.id + " actual generated three-participant calls, last destination and same identity reattach")
        text += specSetup(row, model)
        if (h.entry.startOwner.kind == "pipeline") text += (if (model.childPlans.nonEmpty) ProductChildVerificationTemplate.oracle(row, pkg) else ProductInvocationVerificationTemplate.oracle(row, pkg, model, model.effectHosts.find(_.pipeline.ref.id == h.entry.startOwner.ref.get.id)))
        else {
        val members = field(h.entry.inputType.asInstanceOf[NominalType.Named].ref, model).valueType.get.asInstanceOf[NominalType.Record].members
        val values = members.map { r =>
          val value = if (r.id == "warehouse") "warehouse-A" else if (r.id == "destination") "warehouse-B" else if (r.id == "allocation") "allocation-last" else if (r.id == "sku") "sku-A" else "request-A"
          val t = field(r, model).valueType.get
          if (t == NominalType.Primitive("integer")) "3L" else make(value, t, model)
        }.mkString(", ")
        text += "      val hostActor = kit.spawn(" + host + "(\"generated-host-" + stem + "\", coordinator, installedTechnical))\n      val reply = kit.createTestProbe[" + host + ".Reply]()\n      val original = " + tpe(h.entry.inputType, model) + "(" + values + ")\n      assert(Await.result(installedTechnical." + NamingConventions.strictSymbol(h.entry.port.ref.id) + "(original), 3.seconds))\n      assert(Await.result(installedTechnical." + NamingConventions.strictSymbol(h.association.port.ref.id) + "(original), 3.seconds))\n      assert(technicalCalls.get() == 2)\n" + hostIoNegatives(h, pkg, stem, model) + "      hostActor ! " + host + ".ReceiveEntry(" + pkg + ".domain." + h.entry.source.owner.head + "Protocol." + h.entry.source.id + members.map(r => "original." + sym(r.id)).mkString("(", ", ", ")") + ", reply.ref)\n      val first = reply.expectMessageType[" + host + ".Accepted]\n      assert(" + host + ".nextResult(Some(\"succeeded\"), Some(\"outcome-unknown\")).isEmpty)\n      assert(" + host + ".nextResult(Some(\"outcome-unknown\"), Some(\"succeeded\")).contains(\"succeeded\"))\n      assert(" + host + ".classify(StrictState(status = StrictStatus.RecoveryRequired, evidence = Map(OperationIdentity(first.identity, \"test\", \"test\", \"test\", Phase.Prepare) -> Evidence.Uncertain(OperationIdentity(first.identity, \"test\", \"test\", \"test\", Phase.Prepare), \"unknown\")))).contains(\"outcome-unknown\"))\n      val status = kit.createTestProbe[StrictSagaCoordinator.Reply]()\n      var terminal: StrictState = null\n      status.awaitAssert { coordinator ! StrictSagaCoordinator.GetStatus(status.ref); terminal = status.expectMessageType[StrictSagaCoordinator.Status].state; assert(terminal.status == StrictStatus.Succeeded) }\n      assert(terminal.participants.size == 3)\n      assert(terminal.evidence.values.count(_.isInstanceOf[Evidence.Confirmed]) == 6)\n      val allocation = kit.createTestProbe[" + pkg + ".domain.AllocationOrderState]()\n      actor_allocation ! " + pkg + ".domain.AllocationOrderAggregate.GetState(allocation.ref)\n      assert(allocation.receiveMessage().status == \"allocated\")\n      hostActor ! " + host + ".Observe(reply.ref)\n      reply.expectMessage(" + host + ".ResultRecorded(\"succeeded\"))\n      assert(delivered.get(\"succeeded\").contains(\"allocation-last\"))\n      actor_allocation ! " + pkg + ".domain.AllocationOrderAggregate.GetState(allocation.ref)\n      assert(allocation.receiveMessage().result == \"ReservationSucceeded\")\n      val before = receipts.size\n      coordinator ! StrictSagaCoordinator.Attach(first.identity, status.ref)\n      assert(status.expectMessageType[StrictSagaCoordinator.Status].state.identity.contains(first.identity))\n      assert(receipts.size == before)\n      kit.stop(hostActor)\n      val resumed = kit.spawn(" + host + "(\"generated-host-" + stem + "\", coordinator, installedTechnical))\n      resumed ! " + host + ".Submit(original, reply.ref)\n      reply.expectMessage(" + host + ".ResultRecorded(\"succeeded\"))\n      assert(receipts.size == before)\n      val rejectedCoordinator = kit.spawn(" + definition + ".coordinator(\"rejected-coordinator-" + stem + "\", ports, authorizer))\n      val rejectedHost = kit.spawn(" + host + "(\"rejected-host-" + stem + "\", rejectedCoordinator, installedTechnical))\n      val rejectedInput = original.copy(requestId = " + pkg + ".domain.values.ReservationRequestId(\"request-rejected\"), quantity = 0L)\n      rejectedHost ! " + host + ".Submit(rejectedInput, reply.ref)\n      reply.expectMessageType[" + host + ".Accepted]\n      status.awaitAssert { rejectedCoordinator ! StrictSagaCoordinator.GetStatus(status.ref); terminal = status.expectMessageType[StrictSagaCoordinator.Status].state; assert(terminal.status == StrictStatus.Aborted) }\n      assert(!terminal.evidence.values.exists(_.isInstanceOf[Evidence.Confirmed]))\n      rejectedHost ! " + host + ".Observe(reply.ref)\n      reply.expectMessage(" + host + ".ResultRecorded(\"rejected-before-effects\"))\n      assert(delivered.get(\"rejected-before-effects\").contains(\"allocation-last\"))\n      actor_allocation ! " + pkg + ".domain.AllocationOrderAggregate.GetState(allocation.ref)\n      assert(allocation.receiveMessage().result == \"ReservationRejected\")\n      assert(receipts.size == before)\n"
        text += "    } finally kit.shutdownTestKit()\n  }\n"
        }
      }
      text += "}\n"
      hosts.map(_.contract.saga.ref.context).distinct.foreach { context =>
        val pkg = model.domain.packages(context)
        text = "import " + pkg + ".domain.values._\nimport " + pkg + ".application._\n" + text.replace(pkg + ".domain.values.", "").replace(pkg + ".application.", "")
      }
      Vector(ProductSourceModel("src/test/scala/GeneratedFiniteHostSpec.scala", text, "generated-test", hosts.map(_.contract.source), model.footprint)) ++ recoverySpec(model) ++ extendedPortsSpec(model) ++ requiredBindingsSpec(model)
    }
  }
}
