package net.imadz.codegen.scaffolding.cqrs.template.application.transactor

import net.imadz.codegen.scaffolding.cqrs.{FieldDef, TypeRef}
import net.imadz.codegen.scaffolding.cqrs.model.application.transactor._
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.execution._

/** Real strict runtime API; named technical mappers remain mandatory host obligations. */
object StrictSagaModuleTemplate extends CodeTemplate[StrictSagaModuleModel] {
  private def text(s: String): String = ujson.write(ujson.Str(s), escapeUnicode = true)
  private def id(s: String): String = NamingConventions.scalaIdentifier(s)
  private def tpe(t: TypeRef): String =
    t.fqn + (if (t.typeParams.isEmpty) "" else t.typeParams.map(tpe).mkString("[", ", ", "]"))
  private def fields(fs: Vector[FieldDef]): String = fs.map(f => id(f.name) + ": " + tpe(f.typeRef)).mkString(", ")
  private def pin(p: SagaRuntimeCodec): String = s"CodecPin(${text(p.id)}, ${p.version})"

  def generate(m: StrictSagaModuleModel): String = {
    val s = m.pinned.execution
    val addresses = m.steps.map(_.address).distinct
    val typeContracts = s.args.types.map { t =>
      val shape = t.shape match {
        case SagaTypeShape.Id(min, max) => s"BoundedText(\"id\", $min, $max)"
        case SagaTypeShape.Text(min, max) => s"BoundedText(\"text\", $min, $max)"
        case SagaTypeShape.Bool => "BooleanShape"
        case SagaTypeShape.Integer(min, max) => s"IntegerShape(${min}L, ${max}L)"
        case SagaTypeShape.Enumeration(values) => values.map(text).mkString("EnumerationShape(Vector(", ", ", "))")
        case SagaTypeShape.ValueObject(fs) => fs.map(f => s"SlotContract(${text(f.slot)}, ${text(f.typeId)})").mkString("ValueObjectShape(Vector(", ", ", "))")
        case SagaTypeShape.Money(scale, precision, codec, _, _) => s"MoneyShape($scale, $precision, ${text(codec.dottedPath)}, \"ISO-4217\", \"minor-unit-string\")"
        case SagaTypeShape.Collection(element, min, max) =>
          val elementShape = s.args.types.find(_.id == element).map(_.shape).getOrElse(throw new IllegalArgumentException("Missing collection element")) match {
            case SagaTypeShape.Id(a, b) => s"BoundedText(\"id\", $a, $b)"
            case SagaTypeShape.Text(a, b) => s"BoundedText(\"text\", $a, $b)"
            case _ => throw new IllegalArgumentException("Collection element must be bounded text")
          }
          s"SequenceShape($elementShape, $min, $max)"
        case SagaTypeShape.ManifestReference(true, version) => s"ManifestRefShape(${text(version)})"
        case _: SagaTypeShape.ManifestReference => throw new IllegalArgumentException("Unreadable manifest reference")
      }
      s"TypeContract(${text(t.id)}, ${text(t.canonicalType)}, ${text(t.implementation.dottedPath)}, $shape)"
    }.mkString("Vector(", ",\n    ", ")")
    def strings(xs: Seq[String]): String = xs.map(text).mkString("Vector(", ", ", ")")
    def inputContract(i: SagaInput): String = {
      val source = i.source match {
        case SagaValueSource.Args(slot) => s"ValueSource(\"args\", ${text(slot)}, \"\", \"\")"
        case SagaValueSource.SourceField(slot) => s"ValueSource(\"source-field\", ${text(slot)}, \"\", \"\")"
        case SagaValueSource.ReceiptField(slot) => s"ValueSource(\"receipt-field\", ${text(slot)}, \"\", \"\")"
        case SagaValueSource.TransactionId => "ValueSource(\"transaction-id\", \"\", \"\", \"\")"
        case SagaValueSource.StepReceipt(step, phase, slot) => s"ValueSource(\"step-receipt\", ${text(slot)}, ${text(step)}, ${text(phase.wire)})"
      }
      s"InputContract(${text(i.slot)}, ${text(i.typeId)}, $source)"
    }
    def inputs(xs: Vector[SagaInput]): String = xs.map(inputContract).mkString("Vector(", ", ", ")")
    def tech(p: StrictPhaseModel): String = {
      val x = p.technical
      s"""PhaseContract(${text(p.stepId)}, ${text(p.participantId)}, Phase.${x.phase.runtimeName}, ${text(x.port.dottedPath)},
    ${text(x.commandMapper.dottedPath)}, ${text(x.command.owner.targetName)}, ${text(x.command.contractName)},
    ${inputs(x.inputs)}, ${x.outputs.map(o => s"SlotContract(${text(o.slot)}, ${text(o.typeId)})").mkString("Vector(", ", ", ")")},
    ConfirmationContract(${text(x.confirmation.event.owner.targetName)}, ${text(x.confirmation.event.contractName)}, ${text(x.confirmation.mapper.dottedPath)}, ${inputs(x.confirmation.outputs)}),
    QueryContract(${text(x.query.mapper.dottedPath)}, "read-only", ${strings(x.query.identity.map(_.wire))}, ${strings(x.query.results.map(_.wire))}),
    ReceiptContract(${text(x.receipt.mapper.dottedPath)}, ${text(x.receipt.version)}, ${x.receipt.durable}, ${strings(x.receipt.identity.map(_.wire))}, "exact", "reservation-decision-effect-reconciliation"),
    IdempotencyContract(${text(x.idempotency.mapper.dottedPath)}, ${strings(x.idempotency.identity.map(_.wire))}, "reject", "excluded"),
    ${text(x.codecs.contractCodec.id)}, ${text(x.codecs.contractCodec.version)}, ${pin(x.codecs.runtimeCodec)})"""
    }
    def source(i: SagaInput, p: StrictPhaseModel): String = i.source match {
      case SagaValueSource.Args(slot) => s"request.args.${id(slot)}"
      case SagaValueSource.TransactionId => "request.identity.transaction.transactionId"
      case SagaValueSource.StepReceipt(step, phase, slot) =>
        val read = p.reads.find(r => r.producerStep == step && r.producerPhase == phase).get
        s"${read.local}.${id(slot)}"
      case _ => throw new IllegalArgumentException("Unsupported phase value source")
    }
    val phaseCode = m.phases.map { p =>
      val reads = p.reads.map { r =>
        s"""        val ${r.local} = request.receipt(
          OperationIdentity(request.identity.transaction, ${text(r.producerParticipant)},
            host.${r.producerAddress.member}(request.args.${id(r.producerAddress.resourceSlot)}), ${text(r.producerStep)}, Phase.${r.producerPhase.runtimeName}),
          ${pin(r.pin)}, host.${r.codecMember}.receiptCodec).get"""
      }.mkString("\n")
      val input = p.inputs.map(source(_, p)).mkString(", ")
      s"""  final case class ${p.inputType.name}(${fields(p.inputFields)})
  final case class ${p.receiptType.name}(${fields(p.outputFields)})
  val ${p.member}Contract: PhaseContract = ${tech(p)}
  trait ${p.stem}HostBinding {
    def contract: PhaseContract
    def receiptCodec: PayloadCodec[${p.receiptType.name}]
    def querySafety: QuerySafety
    def execute(identity: OperationIdentity, input: ${p.inputType.name}): Future[PhaseOutcome[${p.receiptType.name}]]
    def query(identity: OperationIdentity, input: ${p.inputType.name}): Future[PhaseOutcome[${p.receiptType.name}]]
  }
  private def ${p.member}Port(host: Host)(implicit ec: ExecutionContext): PhasePort[Args, ${p.receiptType.name}] = {
    val binding = host.${p.member}
    require(binding != null && binding.contract == ${p.member}Contract, "technical phase binding mismatch")
    val codec = binding.receiptCodec
    require(codec != null && codec.pin == ${pin(p.technical.codecs.runtimeCodec)}, "phase receipt codec pin mismatch")
    require(binding.querySafety == QuerySafety.DeclaredReadOnly, "read-only durable query required")
    new PhasePort[Args, ${p.receiptType.name}] {
      def receiptCodec: PayloadCodec[${p.receiptType.name}] = {
        require(binding.receiptCodec eq codec, "host receipt codec replacement")
        require(binding.contract == ${p.member}Contract, "technical phase binding drift")
        codec
      }
      def querySafety: QuerySafety = binding.querySafety
      private def input(request: OperationRequest[Args]): Future[${p.inputType.name}] = Future.fromTry(Try {
        require(request.identity.stepId == ${text(p.stepId)} && request.identity.participantId == ${text(p.participantId)} &&
          request.identity.phase == Phase.${p.technical.phase.runtimeName} &&
          request.identity.resource == host.${p.address.member}(request.args.${id(p.address.resourceSlot)}), "consumer identity mismatch")
$reads
        ${p.inputType.name}($input)
      })
      def execute(request: OperationRequest[Args]): Future[PhaseOutcome[${p.receiptType.name}]] =
        input(request).flatMap(value => binding.execute(request.identity, value))
      def query(request: OperationRequest[Args]): Future[PhaseOutcome[${p.receiptType.name}]] =
        input(request).flatMap(value => binding.query(request.identity, value))
    }
  }"""
    }.mkString("\n\n")
    val triggerCode = m.triggers.map { tr =>
      val e = tr.execution
      s"""  val ${tr.member}Contract = TriggerContract(${text(e.declaration.id)}, ${text(e.declaration.source.owner.targetName)},
    ${text(e.declaration.idempotency.sourceSlot)}, ${text(e.declaration.idempotency.typeId)}, ${inputs(e.declaration.args)},
    ${text(e.binding.argsMapper.dottedPath)}, ${text(e.binding.idempotencyMapper.dottedPath)}, "saga-version", "reject-different-args")
  trait ${NamingConventions.firstUpper(tr.member)}Binding {
    def contract: TriggerContract
    // Whole typed trigger, including the explicit idempotency source; never first/drop remaining.
    def map(source: ${tpe(tr.sourceType)}): TriggerStart
  }
  def ${tr.member}Start(source: ${tpe(tr.sourceType)}, host: Host, replyTo: ActorRef[StrictSagaCoordinator.Reply]): StrictSagaCoordinator.Start = {
    val binding = host.${tr.member}
    require(binding != null && binding.contract == ${tr.member}Contract, "trigger binding mismatch")
    val mapped = binding.map(source)
    require(mapped != null && mapped.transactionId != null && mapped.transactionId.nonEmpty, "stable host idempotency transaction id required")
    val codec = checkedArgsCodec(host)
    val bytes = codec.encode(mapped.args)
    require(bytes != null && codec.decode(bytes).map(codec.encode).get == bytes, "canonical trigger args required")
    require(codec.pin == ArgsPin, "args codec drift")
    StrictSagaCoordinator.Start(mapped.transactionId, bytes, replyTo)
  }"""
    }.mkString("\n\n")
    val completionCode = m.completions.map { c =>
      val values = c.execution.inputs.map { i => i.source match {
        case SagaValueSource.TransactionId => "identity.transactionId"
        case SagaValueSource.Args(slot) => s"args.${id(slot)}"
        case _ => throw new IllegalArgumentException("Unsupported completion source")
      }}.mkString(", ")
      s"""  final case class ${c.inputType.name}(${fields(c.fields)})
  val ${c.member}Contract = CompletionContract(${text(c.execution.kind.wire)}, ${text(c.execution.event.owner.targetName)},
    ${text(c.execution.event.contractName)}, ${text(c.execution.mapper.dottedPath)}, ${inputs(c.execution.inputs)})
  trait ${NamingConventions.firstUpper(c.member)}Binding {
    def contract: CompletionContract
    def map(identity: TransactionIdentity, input: ${c.inputType.name}): ${tpe(c.eventType)}
  }
  // Explicit mapping only: the host must observe the matching durable result and publish idempotently.
  def ${c.member}Event(identity: TransactionIdentity, args: Args, host: Host): ${tpe(c.eventType)} = {
    require(identity.definitionName == Name && identity.definitionVersion == Version && identity.definitionDigest == DefinitionDigest, "completion identity mismatch")
    val binding = host.${c.member}
    require(binding != null && binding.contract == ${c.member}Contract, "completion binding mismatch")
    binding.map(identity, ${c.inputType.name}($values))
  }"""
    }.mkString("\n\n")
    val participantCode = m.steps.map { p =>
      val bindings = p.phases.map(ph => s"Phase.${ph.technical.phase.runtimeName} -> PhaseBinding(${ph.member}Port(host))").mkString(", ")
      s"""      StrictParticipant[Args](${text(p.stepId)}, ${text(p.participantId)}, host.${p.address.member}(args.${id(p.address.resourceSlot)}), Map($bindings))"""
    }.mkString(",\n")
    val addressContracts = addresses.map(a => s"  val ${a.member}Contract = AddressContract(${text(a.participant)}, ${text(a.resourceSlot)}, ${text(a.addressing.resourceType)}, ${text(a.addressing.aggregate.targetName)}, ${text(a.addressing.resolver.dottedPath)}, \"exact-resource\")").mkString("\n")
    val addressChecks = addresses.map(a => s"    require(host.${a.member}Contract == ${a.member}Contract, \"exact resource binding mismatch\")").mkString("\n")
    val hostMembers = addresses.flatMap(a => Vector(
      s"    def ${a.member}Contract: AddressContract",
      s"    def ${a.member}(resource: ${tpe(a.resourceType)}): String // pure exact-resource addressing; no I/O")) ++
      m.phases.map(p => s"    def ${p.member}: ${p.stem}HostBinding") ++
      m.triggers.map(t => s"    def ${t.member}: ${NamingConventions.firstUpper(t.member)}Binding") ++
      m.completions.map(c => s"    def ${c.member}: ${NamingConventions.firstUpper(c.member)}Binding")
    val collectionShapes = if (s.args.types.exists(t => t.shape.isInstanceOf[SagaTypeShape.Collection] || t.shape.isInstanceOf[SagaTypeShape.ManifestReference]))
      "\n  final case class SequenceShape(element: ValueShape, minItems: Int, maxItems: Int) extends ValueShape\n  final case class ManifestRefShape(version: String) extends ValueShape" else ""
    val blockers = s.blocked.map(text).mkString("Vector(", ", ", ")")
    val hostRequirements = s"""HostRequirements(${strings(s.host.capabilities.map(_.capability))}, ${s.host.totalDeadline.totalTimeoutMs},
    ${s.host.admission.maxParticipants}, ${s.host.admission.maxInFlight}, ${s.host.admission.maxItemsPerChunk},
    ${s.host.admission.manifest.durable}, ${strings(s.host.businessInvariants)},
    "durable-before-commit", "durable-before-compensate", "forward-recovery", "reconcile-before-resume",
    "confirmed-reservations", "empty-release-and-fence", "stable-operation", "authorized-reconciliation-evidence",
    ${s.contract.definition.payload.resilience.maxAttempts}, ${s.contract.definition.payload.resilience.phaseTimeoutMs},
    ${s.contract.definition.payload.resilience.queryTimeoutMs}, ${s.contract.definition.payload.resilience.backoffMs})"""
    s"""package ${m.selfType.packageName}

import akka.actor.typed.{ActorRef, Behavior}
import akka.persistence.typed.PersistenceId
import net.imadz.infra.saga.strict._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

/** Generated/buildable candidate; NOT runtime verified. No production dependency is selected.
  * Host adapters must implement all named technical mappers and durable outcomes; FQN is not an ABI.
  * Independent strict persistence namespace, admission/deadline enforcement and idempotent completion
  * publication remain host obligations. Upstream blocked/readiness flags are not rewritten. */
object ${m.selfType.name} {
  val Name = ${text(s.runtimeIdentity.name)}
  val Version = ${m.pinned.pins.runtimeVersion}
  val DefinitionDigest = ${text(s.definitionDigest)}
  val ArgsPin = ${pin(m.pinned.pins.argsCodec.runtimeCodec)}
  val CandidateArtifact = ${text(s.target.artifact)}
  val ArtifactStatus = ${text(s.target.artifactStatus)}
  val UpstreamRunnable = ${s.runnable}
  val UpstreamRuntimeBindingVerified = ${s.runtimeBindingVerified}
  val UpstreamBlocked = $blockers
  final case class Args(${fields(m.argsFields)})
  final case class TriggerStart(transactionId: String, args: Args)
  final case class AddressContract(participant: String, resourceSlot: String, resourceType: String, aggregate: String, resolverFqn: String, mode: String)
$addressContracts
  final case class ValueSource(kind: String, slot: String, producerStep: String, producerPhase: String)
  final case class SlotContract(slot: String, typeId: String)
  final case class InputContract(slot: String, typeId: String, source: ValueSource)
  final case class ConfirmationContract(aggregate: String, event: String, mapperFqn: String, outputs: Vector[InputContract])
  final case class QueryContract(mapperFqn: String, mode: String, identity: Vector[String], results: Vector[String])
  final case class ReceiptContract(mapperFqn: String, version: String, durable: Boolean, identity: Vector[String], compatibility: String, evidence: String)
  final case class IdempotencyContract(mapperFqn: String, identity: Vector[String], payloadConflict: String, attempt: String)
  final case class PhaseContract(step: String, participant: String, phase: Phase, portFqn: String,
    commandMapperFqn: String, aggregate: String, command: String, inputs: Vector[InputContract], outputs: Vector[SlotContract],
    confirmation: ConfirmationContract, query: QueryContract, receipt: ReceiptContract, idempotency: IdempotencyContract,
    contractCodecId: String, contractCodecVersion: String, receiptPin: CodecPin)
  final case class TriggerContract(id: String, aggregate: String, idempotencySource: String, idempotencyType: String,
    args: Vector[InputContract], argsMapperFqn: String, idempotencyMapperFqn: String, scope: String, conflict: String)
  final case class CompletionContract(kind: String, aggregate: String, event: String, mapperFqn: String, inputs: Vector[InputContract])
  final case class TypeContract(id: String, canonicalType: String, implementationFqn: String, shape: ValueShape)
  sealed trait ValueShape
  final case class BoundedText(kind: String, minLength: Int, maxLength: Int) extends ValueShape
  case object BooleanShape extends ValueShape
  final case class IntegerShape(minimum: Long, maximum: Long) extends ValueShape
  final case class EnumerationShape(values: Vector[String]) extends ValueShape
  final case class ValueObjectShape(fields: Vector[SlotContract]) extends ValueShape
  final case class MoneyShape(scale: Int, precision: Int, codecFqn: String, currency: String, encoding: String) extends ValueShape$collectionShapes
  val RequiredTypes: Vector[TypeContract] = $typeContracts
  final case class ArgsCodecContract(mapperFqn: String, id: String, version: String, compatibleVersions: Vector[String], runtimePin: CodecPin)
  val RequiredArgsCodec = ArgsCodecContract(${text(s.args.codec.mapper.dottedPath)}, ${text(s.args.codec.id)}, ${text(s.args.codec.version)}, ${strings(s.args.codec.compatibleVersions)}, ArgsPin)
  final case class HostRequirements(capabilities: Vector[String], totalDeadlineMs: Int, maxParticipants: Int,
    maxInFlight: Int, maxItemsPerChunk: Int, durableManifest: Boolean, businessInvariants: Vector[String],
    commitDecision: String, abortDecision: String, afterCommit: String, unknown: String, compensation: String,
    cancelBeforePrepare: String, retryIdentity: String, manualRecovery: String,
    maxAttempts: Int, phaseTimeoutMs: Int, queryTimeoutMs: Int, backoffMs: Int)
  val RequiredHost = $hostRequirements
  trait Host {
    def argsCodec: PayloadCodec[Args] // canonical codec: ${s.args.codec.mapper.dottedPath}, ${s.args.codec.version}
    def settings: StrictSagaCoordinator.Settings // explicit reconcile budget; no guessed default
    // Fail closed when deadline/admission/retry/capability or named mapper ABI implementation is unavailable.
    // Returning normally is a host declaration, not runtime certification by generated code.
    def requireImplemented(requirements: HostRequirements, types: Vector[TypeContract], argsCodec: ArgsCodecContract): Unit
    def requireIndependentNamespace(persistenceId: PersistenceId): Unit
${hostMembers.mkString("\n")}
  }
  private def checkedArgsCodec(host: Host): PayloadCodec[Args] = {
    require(host != null && host.argsCodec != null, "host canonical args codec required")
    host.requireImplemented(RequiredHost, RequiredTypes, RequiredArgsCodec)
$addressChecks
    val codec = host.argsCodec
    require(codec.pin == ArgsPin, "args codec pin mismatch")
    codec
  }

$phaseCode

$triggerCode

$completionCode

  def definition(host: Host)(implicit ec: ExecutionContext): StrictSagaDefinition[Args] = {
    val codec = checkedArgsCodec(host)
    StrictSagaDefinition[Args](Name, Version, DefinitionDigest, codec, args => Vector(
$participantCode))
  }
  def behavior(persistenceId: PersistenceId, host: Host, authorizer: ReconcileAuthorizer)(implicit ec: ExecutionContext): Behavior[StrictSagaCoordinator.Command] = {
    require(persistenceId != null && authorizer != null, "explicit persistence id and authorizer required")
    host.requireIndependentNamespace(persistenceId)
    val settings = host.settings
    require(settings != null && settings.interactionTimeout.toMillis == ${s.coordinator.interactionTimeoutMs}, "coordinator timeout pin mismatch")
    StrictSagaCoordinator(persistenceId, definition(host), authorizer, settings)
  }
}
"""
  }
}
