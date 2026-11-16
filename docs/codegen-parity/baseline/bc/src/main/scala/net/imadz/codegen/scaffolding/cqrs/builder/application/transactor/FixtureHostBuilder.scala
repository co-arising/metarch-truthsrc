package net.imadz.codegen.scaffolding.cqrs.builder.application.transactor

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.codegen.scaffolding.cqrs.model.application.transactor._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta._
import net.imadz.meta.execution._

/** P4 Slice 2: mechanical derivation of the fixture-host emission from the admitted
  * v3 contract plus the aggregate metadata. Fail-closed on every derivation that
  * cannot be carried out — the emitted host discharges the generated SagaModule.Host
  * obligations exactly, and nothing here invents business semantics:
  *   - execute = ask the aggregate entity with the phase command (input slots in
  *     command order), receipt = same-name projection of the phase inputs onto the
  *     declared outputs (txid-addressed, per the P4 re-cut);
  *   - prepare query = the aggregate's read-only state-query command, answered by
  *     `contains(txid)` on the state field whose writtenBy lineage names the phase
  *     confirmation event + txid slot (four-field precise determination);
  *   - commit/compensate query = the phase-marker fields (SCHEMA.md P5 phase-marker
  *     convention): `committed`/`compensated` found fail-closed by name + writtenBy
  *     lineage + txid-keyed map type, answered by the same `contains(txid)` shape —
  *     the business folds remove the prepare entry, so only a dedicated durable
  *     marker distinguishes "already executed" from "never prepared";
  *   - guard rejection reply (error: Some) = NotExecuted with the error as proof,
  *     safeToRetry=true — no events were persisted, the TCC auto-compensate path.
  *   - completion publication = the result event's exactly-one producing command
  *     (produces reverse index, fail-closed) asked on the initiating entity.
  */
object FixtureHostBuilder {

  /** What the emitted FixtureHost actually implements (requireImplemented is a
    * declaration against THIS set, never an echo of the contract). */
  private val SupportedCapabilities = Vector(
    "durable-commit-decision", "durable-abort-decision", "typed-nonterminal-unknown", "safe-status-reattach",
    "receipt-reconciliation", "participant-idempotency-query", "pinned-definition-codec",
    "manual-evidence-authorization", "cancel-before-prepare-fencing", "durable-manifest")

  private def wireOf(d: SagaCommitDecision): String = d match { case DurableBeforeCommit => "durable-before-commit" }
  private def wireOf(d: SagaAbortDecision): String = d match { case DurableBeforeCompensate => "durable-before-compensate" }
  private def wireOf(d: SagaAfterCommit): String = d match { case ForwardRecovery => "forward-recovery" }
  private def wireOf(d: SagaUnknownPolicy): String = d match { case ReconcileBeforeResume => "reconcile-before-resume" }
  private def wireOf(d: SagaCompensationPolicy): String = d match { case ConfirmedReservations => "confirmed-reservations" }
  private def wireOf(d: SagaCancellationPolicy): String = d match { case EmptyReleaseAndFence => "empty-release-and-fence" }
  private def wireOf(d: SagaRetryIdentity): String = d match { case StableOperation => "stable-operation" }
  private def wireOf(d: SagaManualRecovery): String = d match { case AuthorizedReconciliationEvidence => "authorized-reconciliation-evidence" }

  def build(pinned: PinnedSagaExecution, module: StrictSagaModuleModel, ctx: GeneratorContext): FixtureHostModel = {
    val s = pinned.execution
    val pkg = module.selfType.packageName
    val moduleRef = "SagaModule"

    def fail(msg: String): Nothing = throw new IllegalStateException(s"fixture host derivation: $msg")

    // ---- type table: wire shapes + runtime aliases ----
    val types = s.args.types
    def shapeOf(typeId: String): FixtureWireShape = types.find(_.id == typeId).getOrElse(fail(s"type \"$typeId\" is not in the binding type table")).shape match {
      case _: SagaTypeShape.Id | _: SagaTypeShape.Text | _: SagaTypeShape.ManifestReference => FixtureTextShape
      case c: SagaTypeShape.Collection =>
        types.find(_.id == c.elementType).map(_.shape) match {
          case Some(SagaTypeShape.Id(min, max)) => FixtureCollectionShape(c.minItems, c.maxItems, min, max)
          case Some(SagaTypeShape.Text(min, max)) => FixtureCollectionShape(c.minItems, c.maxItems, min, max)
          case _ => fail("collection element must be declared bounded text: " + c.elementType)
        }
      case _: SagaTypeShape.Money                      => FixtureMoneyShape
      case other => fail(s"type \"$typeId\" shape ${other.getClass.getSimpleName} is outside the fixture wire (bounded text / money)")
    }
    def boundsOf(typeId: String): Option[(Int, Int)] = types.find(_.id == typeId).getOrElse(fail(s"type \"$typeId\" is not in the binding type table")).shape match {
      case i: SagaTypeShape.Id    => Some((i.minLength, i.maxLength))
      case t: SagaTypeShape.Text  => Some((t.minLength, t.maxLength))
      case _: SagaTypeShape.Money | _: SagaTypeShape.Collection => None
      case _: SagaTypeShape.ManifestReference => Some((1, 128))
      case other                  => fail(s"type \"$typeId\" shape ${other.getClass.getSimpleName} is outside the fixture wire")
    }
    // Wire field order guard: length-prefixed text run first, money tail after —
    // the emitted codecs parse in exactly that order.
    def checkOrder(fields: Vector[(String, FixtureWireShape)], what: String): Unit = {
      val seenMoney = fields.dropWhile(_._2 != FixtureMoneyShape)
      if (seenMoney.exists(_._2 != FixtureMoneyShape)) fail(s"$what: money slot must not precede a text slot on the fixture wire (${seenMoney.map(f => s"${f._1}/${f._2}")})")
    }
    def argFieldRef(typeId: String): TypeRef =
      module.argsFields.find(f => s.args.slots.exists(sl => sl.slot == f.name && sl.typeId == typeId))
        .map(_.typeRef).getOrElse(fail(s"no args slot carries type \"$typeId\" to anchor its runtime FQN"))

    val argsFields = s.args.slots.map(sl => (sl.slot, shapeOf(sl.typeId)))
    checkOrder(argsFields, "args")
    val typeAliases = types.map { b =>
      val fqn = b.shape match {
        case _: SagaTypeShape.Id | _: SagaTypeShape.Text | _: SagaTypeShape.ManifestReference => "String"
        case _: SagaTypeShape.Collection => "Vector[String]"
        case _: SagaTypeShape.Money                      => argFieldRef(b.id).fqn
        case other                                       => fail(s"type \"${b.id}\" shape ${other.getClass.getSimpleName} is outside the fixture wire")
      }
      FixtureTypeAlias(b.id, fqn, b.shape.isInstanceOf[SagaTypeShape.Money], b.shape.isInstanceOf[SagaTypeShape.Collection])
    }

    // ---- contract-named implementation faces ----
    val argsCodecName = lastSegment(s.contract.binding.codec.mapper.dottedPath, "args codec mapper")
    val moneyCodecName = types.collectFirst { case b: SagaTypeBinding if b.shape.isInstanceOf[SagaTypeShape.Money] => b.shape.asInstanceOf[SagaTypeShape.Money].codec.dottedPath }
      .getOrElse("")
      .split('.').last
    val entryName = lastSegment(s.contract.binding.engine.entrypoint.dottedPath, "entrypoint")
    Seq((argsCodecName, "args codec"), (moneyCodecName, "money codec"), (entryName, "entrypoint")).filter(_._1.nonEmpty).foreach { case (n, what) =>
      if (!n.matches("[A-Za-z_][A-Za-z0-9_]*")) fail(s"$what name \"$n\" is not a plain Scala object name")
    }

    // ---- aggregate runtime faces (protocol / entity key / reply / state query / behavior factory) ----
    val aggregatesRoot = ctx.layout.application.aggregates.root
    val faces = s.contract.definition.payload.participants.map(_.aggregate.targetName).distinct.map { aggName =>
      val agg = ctx.metaRegistry.resolveByName[AggregateRootMetadata](aggName)
        .getOrElse(fail(s"aggregate \"$aggName\" is not in the metadata registry"))
      val base = NamingConventions.getBaseName(aggName)
      val protocolFqn = s"$aggregatesRoot.${base}Protocol"
      val aggregateKeyFqn = s"$aggregatesRoot.${NamingConventions.aggregateRootName(base)}.entityTypeKey"
      val replyName = agg.replyFamily.replies.headOption.getOrElse(fail(s"aggregate \"$aggName\" has no reply family")).name
      val query = agg.commandFamily.commands.find(_.isReadOnly)
        .getOrElse(fail(s"aggregate \"$aggName\" declares no read-only state-query command — prepare evidence queries have no durable read face"))
      val queryReplyName = query.replyToType.getOrElse(fail(s"read-only query \"${query.name}\" carries no reply type")).targetName
      FixtureAggregateFace(base, protocolFqn, aggregateKeyFqn, s"$protocolFqn.${agg.commandFamily.name}", s"$protocolFqn.$replyName",
        s"$protocolFqn.${query.name}", s"$protocolFqn.$queryReplyName",
        s"${ctx.layout.application.aggregates.behaviors}.${base}Behaviors",
        s"${ctx.layout.domain.entities.behaviors}.${base}EventHandler",
        s"${ctx.layout.domain.entities.root}.${agg.entityRef.targetName}")
    }.toVector
    def faceOf(aggName: String): FixtureAggregateFace =
      faces.find(_.base == NamingConventions.getBaseName(aggName))
        .getOrElse(fail(s"no runtime face for aggregate \"$aggName\""))

    /** State fields of an aggregate's declared state (fail-closed). */
    def stateFieldsOf(aggName: String): Vector[FieldMetadata] = {
      val agg = ctx.metaRegistry.resolveByName[AggregateRootMetadata](aggName).getOrElse(fail(s"aggregate \"$aggName\" missing"))
      ctx.metaRegistry.resolveByName[ValueObjectMetadata](agg.stateRef.targetName)
        .map(_.fields.toVector).getOrElse(fail(s"state \"${agg.stateRef.targetName}\" missing"))
    }
    /** Event family of an aggregate (fail-closed). */
    def eventFamilyOf(aggName: String): EventFamilyMetadata = {
      val agg = ctx.metaRegistry.resolveByName[AggregateRootMetadata](aggName).getOrElse(fail(s"aggregate \"$aggName\" missing"))
      ctx.metaRegistry.resolveByName[EventFamilyMetadata](agg.eventFamilyRef.targetName)
        .getOrElse(fail(s"event family \"${agg.eventFamilyRef.targetName}\" missing"))
    }
    /** Key MetaType of a declared Map field, or None for non-map fields. The marker
      * key check compares STRUCTURALLY against the same step's prepare-evidence map
      * (one txid keyspace) — resolved MetaTypes carry runtime names, not contract ids. */
    def keyMetaOf(f: FieldMetadata): Option[MetaType] = f.fieldType match {
      case CustomType(_, _, Seq(key, _*)) => Some(key)
      case _ => None
    }

    // ---- phase ports ----
    val phaseByStem = module.phases.map(p => p.stem -> p).toMap
    // Per-step prepare-evidence key MetaType (the txid keyspace the step's markers share).
    val stepPrepareKey = scala.collection.mutable.Map.empty[String, Option[MetaType]]
    val stepPrepareValue = scala.collection.mutable.Map.empty[String, FixturePrepareValueEvidence]
    val ports = module.phases.map { p =>
      val tech = p.technical
      val aggName = tech.command.owner.targetName
      val face = faceOf(aggName)
      val inputSlots = tech.inputs.map(_.slot)
      val txidInput = tech.inputs.find(_.source == SagaValueSource.TransactionId)
        .getOrElse(fail(s"phase \"${p.stem}\" declares no transaction-identity input"))
      val txidSlot = txidInput.slot
      val receiptFields = tech.outputs.map(o => (o.slot, shapeOf(o.typeId)))
      checkOrder(receiptFields, s"receipt of \"${p.stem}\"")
      val missing = tech.outputs.map(_.slot).filterNot(inputSlots.contains)
      if (missing.nonEmpty) fail(s"phase \"${p.stem}\" receipt slots ${missing.mkString(", ")} have no same-name input (receipt = same-name projection of the phase inputs)")
      val commandMeta = ctx.metaRegistry.resolveByName[AggregateRootMetadata](aggName).get.commandFamily.commands
        .find(_.name == tech.command.command.targetName).get
      val commandExpr = s"${face.base}Protocol.${tech.command.command.targetName}(${tech.inputs.map { i =>
        val conversion = commandMeta.parameters.find(_.name == i.slot).map(_.parameterType) match {
          case Some(CustomType("List", _, _)) if shapeOf(i.typeId).isInstanceOf[FixtureCollectionShape] => ".toList"
          case _ => ""
        }
        "input." + i.slot + conversion
      }.mkString(", ")}, replyTo)"
      val receiptExpr = s"$moduleRef.${p.receiptType.name}(${tech.outputs.map(o => s"input.${o.slot}").mkString(", ")})"
      // P5 spec face: the command shape and the input slot carrying the entity address
      // (the args-sourced slot naming the step's own resource).
      val resourceSlotName = tech.inputs.collectFirst {
        case i if i.source.isInstanceOf[SagaValueSource.Args] && i.source.asInstanceOf[SagaValueSource.Args].slot == p.address.resourceSlot => i.slot
      }.getOrElse(fail(s"phase \"${p.stem}\" declares no args-sourced slot for its own resource \"${p.address.resourceSlot}\""))
      // Phase evidence (the durable carrier the idempotency query reads):
      //   prepare = the state field whose writtenBy lineage names the phase
      //     confirmation event + txid slot (P4 four-field precise determination —
      //     unambiguous: only the prepared map carries that event's txid slot);
      //   commit/compensate = the phase-marker fields (SCHEMA.md P5) — the business
      //     folds REMOVE the prepare entry, so only a dedicated marker distinguishes
      //     "already executed" from "never prepared". Triple fail-closed: field name
      //     + writtenBy lineage + a key type structurally equal to the SAME step's
      //     prepare-evidence map (one txid keyspace; a plain lineage find is not
      //     enough — the balance also carries the confirmation's txid slot via the
      //     indexed delta read).
      val evidence = tech.phase match {
        case SagaPhase.Prepare =>
          val confirmationEvent = tech.confirmation.event.event.targetName
          val stateFields = stateFieldsOf(aggName)
          val field = stateFields.find(_.writtenBy.contains(s"$confirmationEvent.$txidSlot"))
            .getOrElse(fail(s"no state field writes $confirmationEvent.$txidSlot — prepare evidence has no four-field carrier"))
          stepPrepareKey += (p.stepId -> keyMetaOf(field))
          Some(field.name)
        case SagaPhase.Commit | SagaPhase.Compensate =>
          val marker = tech.phase match { case SagaPhase.Commit => "committed"; case SagaPhase.Compensate => "compensated"; case _ => "" }
          val confirmationEvent = tech.confirmation.event.event.targetName
          val stateFields = stateFieldsOf(aggName)
          val expectedKey = stepPrepareKey.getOrElse(p.stepId,
            fail(s"phase \"${p.stem}\" has no prepare-evidence map in its step to anchor the marker key type"))
          val hits = stateFields.filter(f => f.name == marker && f.writtenBy.contains(s"$confirmationEvent.$txidSlot") && keyMetaOf(f) == expectedKey)
          if (hits.size != 1)
            fail(s"phase \"${p.stem}\" marker evidence is not exactly one \"$marker\" field written by $confirmationEvent.$txidSlot and keyed like its prepare evidence (found ${hits.size}: ${hits.map(_.name).mkString(", ")}) — declare the phase-marker convention fields (SCHEMA.md P5)")
          Some(hits.head.name)
        case _ => None
      }
      val prepareValueEvidence = if (tech.phase == SagaPhase.Prepare && tech.inputs.exists(i => shapeOf(i.typeId) == FixtureMoneyShape)) {
        def invalid(msg: String): Nothing = fail("Prepare value evidence: " + p.stem + ": " + msg)
        val values = tech.inputs.filter(i => shapeOf(i.typeId) == FixtureMoneyShape)
        if (values.size != 1) invalid("exactly one Money input required")
        val valueSlot = values.head.slot
        if (!tech.outputs.exists(o => o.slot == valueSlot && o.typeId == values.head.typeId))
          invalid("Money receipt must carry the same input slot and type")
        val eventName = tech.confirmation.event.event.targetName
        val candidates = stateFieldsOf(aggName).filter(_.writtenBy.contains(eventName + "." + txidSlot))
        if (candidates.size != 1) invalid("exactly one txid evidence map required")
        val carrier = candidates.head
        val expectedKey = commandMeta.parameters.find(_.name == txidSlot).get.parameterType
        val expectedValue = commandMeta.parameters.find(_.name == valueSlot).get.parameterType
        carrier.fieldType match {
          case CustomType("Map", _, Seq(key, value)) if key == expectedKey && value == expectedValue => ()
          case _ => invalid("carrier must be a txid-keyed map of the declared Money type")
        }
        val semantics = ctx.formalSemantics.toVector.flatMap(_.aggregates)
          .filter(a => NamingConventions.getBaseName(a.aggregate) == NamingConventions.getBaseName(aggName))
        if (semantics.size != 1) invalid("real aggregate formal semantics required")
        val rows = semantics.head.folds.filter(_.event == eventName).flatMap(_.assignments).filter(_.slot == carrier.name)
        if (rows.size != 1 || rows.head.op != "put" || rows.head.key != Some("event." + txidSlot) || rows.head.value != Some("event." + valueSlot))
          invalid("confirmation must put the exact event txid and Money into the carrier")
        val bindings = semantics.head.emissions.filter(_.event == eventName).flatMap(_.bindings)
        if (bindings.filter(_._1 == txidSlot) != Vector(txidSlot -> ("param." + txidSlot)) ||
            bindings.filter(_._1 == valueSlot) != Vector(valueSlot -> ("param." + valueSlot)))
          invalid("confirmation txid and Money must originate in the matching command inputs")
        Some(FixturePrepareValueEvidence(carrier.name, valueSlot))
      } else None
      prepareValueEvidence.foreach(value => stepPrepareValue += (p.stepId -> value))
      val terminalEvidence = if (tech.phase != SagaPhase.Prepare && stepPrepareValue.contains(p.stepId)) {
        def invalid(msg: String): Nothing = fail("Terminal evidence: " + p.stem + ": " + msg)
        val prepared = stepPrepareValue(p.stepId)
        val stepPhases = module.phases.filter(_.stepId == p.stepId)
        val prepare = stepPhases.filter(_.technical.phase == SagaPhase.Prepare)
        if (prepare.size != 1) invalid("exactly one admitted Money Prepare required")
        val prepareTech = prepare.head.technical
        val liveFields = stateFieldsOf(aggName).filter(_.name == prepared.mapField)
        if (liveFields.size != 1) invalid("exactly one live Prepare map required")
        val liveType = liveFields.head.fieldType
        val semantics = ctx.formalSemantics.toVector.flatMap(_.aggregates)
          .filter(a => NamingConventions.getBaseName(a.aggregate) == NamingConventions.getBaseName(aggName))
        if (semantics.size != 1) invalid("real aggregate formal semantics required")
        for (phase <- Vector(SagaPhase.Commit, SagaPhase.Compensate)) {
          val paired = stepPhases.filter(_.technical.phase == phase)
          if (paired.size != 1) invalid("exactly one paired terminal phase required")
          val terminal = paired.head.technical
          val pairedTxid = terminal.inputs.filter(_.source == SagaValueSource.TransactionId)
          val pairedResource = terminal.inputs.filter(i => i.source == SagaValueSource.Args(p.address.resourceSlot))
          if (terminal.command.owner != prepareTech.command.owner || paired.head.address != prepare.head.address ||
              pairedTxid.size != 1 || pairedTxid.head.slot != txidSlot || pairedTxid.head.typeId != txidInput.typeId ||
              pairedResource.size != 1 || pairedResource.head.slot != resourceSlotName ||
              terminal.outputs.size != 1 || terminal.outputs.head.slot != txidSlot || terminal.outputs.head.typeId != txidInput.typeId)
            invalid("paired phases must share aggregate, resource, txid and a txid-only receipt")
          val marker = if (phase == SagaPhase.Commit) "committed" else "compensated"
          val opposite = if (phase == SagaPhase.Commit) "compensated" else "committed"
          val eventName = terminal.confirmation.event.event.targetName
          val markerFields = stateFieldsOf(aggName).filter(_.name == marker)
          if (markerFields.size != 1 || markerFields.head.fieldType != liveType ||
              !markerFields.head.writtenBy.contains(eventName + "." + txidSlot))
            invalid("marker must be the same txid-keyed Money map type as the admitted Prepare")
          val folds = semantics.head.folds.filter(_.event == eventName)
          if (folds.size != 1) invalid("exactly one terminal confirmation fold required")
          val rows = folds.head.assignments
          val put = rows.filter(_.slot == marker)
          val remove = rows.filter(_.slot == prepared.mapField)
          if (put.size != 1 || put.head.op != "put" || put.head.key != Some("event." + txidSlot) ||
              put.head.value != Some("state." + prepared.mapField + "[event." + txidSlot + "]") ||
              remove.size != 1 || remove.head.op != "remove" || remove.head.key != Some("event." + txidSlot) ||
              rows.exists(_.slot == opposite))
            invalid("terminal confirmation must move the exact live value to only its own marker")
          val bindings = semantics.head.emissions.filter(_.event == eventName).flatMap(_.bindings)
          if (bindings.filter(_._1 == txidSlot) != Vector(txidSlot -> ("param." + txidSlot)))
            invalid("terminal txid must have exactly one matching command-parameter origin")
        }
        val marker = if (tech.phase == SagaPhase.Commit) "committed" else "compensated"
        Some(FixtureTerminalEvidence(prepared.mapField, marker, if (tech.phase == SagaPhase.Commit) "compensated" else "committed"))
      } else None
      FixturePhasePort(p.stem, p.stepId, p.participantId, tech.phase.runtimeName, face.base,
        s"$moduleRef.${p.inputType.name}", s"$moduleRef.${p.receiptType.name}",
        tech.codecs.runtimeCodec.id, tech.codecs.runtimeCodec.version, commandExpr, receiptExpr,
        receiptFields, evidence, txidSlot, tech.command.command.targetName, inputSlots,
        tech.inputs.map(i => (i.slot, shapeOf(i.typeId))), resourceSlotName, prepareValueEvidence, terminalEvidence)
    }

    // ---- triggers ----
    val triggers = module.triggers.map { t =>
      val decl = t.execution.declaration
      if (decl.args.exists(!_.source.isInstanceOf[SagaValueSource.SourceField]))
        fail(s"trigger \"${t.execution.declaration.id}\" maps an arg outside its own source fields")
      val argSources = decl.args.map { a =>
        val src = a.source.asInstanceOf[SagaValueSource.SourceField]
        if (src.slot != a.slot) fail(s"trigger \"${decl.id}\" arg \"${a.slot}\" maps source field \"${src.slot}\" — fixture mapping is same-name")
        (a.slot, boundsOf(a.typeId))
      }
      val moneySlots = decl.args.filter(a => shapeOf(a.typeId) == FixtureMoneyShape).map(_.slot)
      FixtureTriggerModel(t.member, t.member + "Contract",
        "SagaModule." + NamingConventions.firstUpper(t.member) + "Binding", t.sourceType.fqn,
        t.execution.declaration.source.isInstanceOf[SagaTriggerSource.Command],
        decl.idempotency.sourceSlot, argSources, moneySlots,
        decl.args.flatMap(a => shapeOf(a.typeId) match {
          case shape: FixtureCollectionShape => Some(a.slot -> shape)
          case _ => None
        }))
    }

    // ---- completions ----
    val completions = module.completions.map { c =>
      val aggName = c.execution.event.owner.targetName
      val agg = ctx.metaRegistry.resolveByName[AggregateRootMetadata](aggName).getOrElse(fail(s"aggregate \"$aggName\" missing"))
      val familyFqn = s"${c.eventType.packageName}.${agg.eventFamilyRef.targetName}"
      val slots = c.execution.inputs.map(_.slot)
      // Publication face (SCHEMA.md P5 result-publication convention): the result
      // event's exactly-one producing command, resolved from the produces reverse
      // index — never from name matching. The host completion flow asks it on the
      // initiating entity; the guard's succeed-empty makes republication idempotent.
      val event = eventFamilyOf(aggName).events.find(_.name == c.execution.event.event.targetName)
        .getOrElse(fail(s"completion \"${c.member}\" event \"${c.execution.event.event.targetName}\" is not in the aggregate event family"))
      val face = faceOf(aggName)
      if (event.producedBy.size != 1)
        fail(s"completion event \"${event.name}\" must have exactly one producing publication command, found ${event.producedBy.size} (${event.producedBy.map(_.targetName).mkString(", ")}) — the result-publication channel has no unambiguous aggregate face")
      val publicationCommandFqn = s"${face.protocolFqn}.${event.producedBy.head.targetName}"
      FixtureCompletionModel(c.member, c.member + "Contract",
        "SagaModule." + NamingConventions.firstUpper(c.member) + "Binding", s"$moduleRef.${c.inputType.name}",
        c.execution.kind.wire, c.eventType.fqn, familyFqn, slots, publicationCommandFqn)
    }

    // ---- safety-spec funding seed (P5 verification emission): the NON-initiating
    // participant's prepare+commit confirmation pair, whose declared fold sequence
    // (record incoming credit, then book it) is the contract's own fund-entry flow.
    // Seed events carry exactly the confirmation payload slots (receipt outputs). ----
    val fundingSeedEvents = {
      val fundingStep = module.steps.lift(1).getOrElse(fail("safety-spec funding seed needs a second participant step"))
      Vector(SagaPhase.Prepare, SagaPhase.Commit).map { ph =>
        val phase = module.phases.find(p => p.stepId == fundingStep.stepId && p.technical.phase == ph)
          .getOrElse(fail(s"funding seed: step \"${fundingStep.stepId}\" declares no $ph phase"))
        val evtName = phase.technical.confirmation.event.event.targetName
        val aggName = phase.technical.command.owner.targetName
        val agg = ctx.metaRegistry.resolveByName[AggregateRootMetadata](aggName).getOrElse(fail(s"aggregate \"$aggName\" missing"))
        val event = eventFamilyOf(aggName).events.find(_.name == evtName)
          .getOrElse(fail(s"funding seed: confirmation event \"$evtName\" missing from aggregate \"$aggName\""))
        val face = faceOf(aggName)
        val slots = phase.technical.outputs.map(o => (o.slot, shapeOf(o.typeId)))
        checkOrder(slots, s"funding seed event $evtName")
        (s"${ctx.layout.domain.entities.root}.${agg.entityRef.targetName}.$evtName", slots)
      }
    }

    // ---- host requirements constants (mirroring the emitted RequiredHost) ----
    val host = s.host
    val safetyChecks = Vector(
      "commitDecision" -> wireOf(host.safety.commitDecision),
      "abortDecision" -> wireOf(host.safety.abortDecision),
      "afterCommit" -> wireOf(host.safety.afterCommit),
      "unknown" -> wireOf(host.safety.unknown),
      "compensation" -> wireOf(host.safety.compensation),
      "cancelBeforePrepare" -> wireOf(host.safety.cancelBeforePrepare),
      "retryIdentity" -> wireOf(host.safety.retryIdentity),
      "manualRecovery" -> wireOf(host.safety.manualRecovery))
    val capabilities = host.capabilities.map(_.capability)
    val supported = SupportedCapabilities ++ (if (argsFields.exists(_._2.isInstanceOf[FixtureCollectionShape]))
      Vector("bounded-collection-args", "args-anchored-manifest") else Vector.empty)
    val unsupported = capabilities.filterNot(supported.contains)
    if (unsupported.nonEmpty) fail(s"contract requires capabilities the emitted fixture host does not implement: ${unsupported.mkString(", ")}")

    val dependencyRefs = Set(module.selfType) ++
      faces.map(f => TypeRef(s"${f.base}Protocol", ctx.layout.application.aggregates.root)) ++
      faces.map(f => TypeRef(s"${NamingConventions.aggregateRootName(f.base)}", ctx.layout.application.aggregates.root)) ++
      completions.map(c => TypeRef(c.eventFqn.split('.').last, c.eventFqn.substring(0, c.eventFqn.lastIndexOf('.'))))

    FixtureHostModel(
      selfType = TypeRef("FixtureHost", pkg),
      packagePath = pkg,
      moduleType = module.selfType,
      argsCodecName = argsCodecName,
      argsPinId = pinned.pins.argsCodec.runtimeCodec.id,
      argsPinVersion = pinned.pins.argsCodec.runtimeCodec.version,
      moneyCodecName = moneyCodecName,
      entryName = entryName,
      argsFqn = s"$moduleRef.Args",
      argsFields = argsFields,
      typeAliases = typeAliases,
      faces = faces,
      phases = ports,
      triggers = triggers,
      completions = completions,
      capabilities = capabilities,
      supportedCapabilities = supported,
      businessInvariants = host.businessInvariants,
      safetyChecks = safetyChecks,
      interactionTimeoutMs = s.contract.definition.payload.resilience.phaseTimeoutMs,
      resourceMembers = module.phases.map(_.address.member).distinct.toVector,
      namespacePrefix = "strict-saga",
      publicationSlot = module.steps.headOption.map(_.address.resourceSlot)
        .getOrElse(fail("contract declares no steps — the result publication has no initiating resource slot")),
      publicationFaceBase = {
        val firstStep = module.steps.headOption.getOrElse(fail("contract declares no steps — no publication face"))
        val firstPhase = module.phases.find(_.stepId == firstStep.stepId)
          .getOrElse(fail(s"step \"${firstStep.stepId}\" declares no phases — no publication face"))
        faceOf(firstPhase.technical.command.owner.targetName).base
      },
      fundingSeedEvents = fundingSeedEvents,
      dependencyRefs = dependencyRefs,
      fundingEventFields = if (argsFields.exists(_._2.isInstanceOf[FixtureCollectionShape])) {
        val targetStep = module.steps(1)
        Vector(SagaPhase.Prepare, SagaPhase.Commit).map { ph =>
          val phase = targetStep.phases.find(_.technical.phase == ph).get
          val owner = phase.technical.command.owner.targetName
          val event = eventFamilyOf(owner).events.find(_.name == phase.technical.confirmation.event.event.targetName).get
          (fundingSeedEvents(if (ph == SagaPhase.Prepare) 0 else 1)._1,
            event.fields.map(f => f.name -> (f.fieldType match { case CustomType("Vector", _, _) | CustomType("List", _, _) => true; case _ => false })).toVector)
        }
      } else Vector.empty,
      fundingCommands = if (argsFields.exists(_._2.isInstanceOf[FixtureCollectionShape])) {
        module.steps(1).phases.filter(p => p.technical.phase == SagaPhase.Prepare || p.technical.phase == SagaPhase.Commit).map { p =>
          (faceOf(p.technical.command.owner.targetName).protocolFqn + "." + p.technical.command.command.targetName,
            p.technical.inputs.map(i => i.slot -> shapeOf(i.typeId)))
        }
      } else Vector.empty,
      preparedField = ports.headOption.flatMap(_.evidenceMapField).getOrElse(""),
      phaseCollections = ports.map(p => p.stem -> p.commandSlotShapes.collect { case (name, _: FixtureCollectionShape) => name }).toMap)
  }

  private def lastSegment(dotted: String, what: String): String = {
    val idx = dotted.lastIndexOf('.')
    if (idx <= 0 || idx == dotted.length - 1) throw new IllegalStateException(s"fixture host derivation: $what FQN \"$dotted\" has no package/object split")
    dotted.substring(idx + 1)
  }
}
