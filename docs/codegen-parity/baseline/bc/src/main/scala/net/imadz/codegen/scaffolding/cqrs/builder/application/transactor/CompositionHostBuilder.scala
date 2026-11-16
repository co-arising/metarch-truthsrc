package net.imadz.codegen.scaffolding.cqrs.builder.application.transactor

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta._
import net.imadz.meta.execution.{AdmittedSagaInputV3, CompositionBindingAdapter, SagaPhase, SagaTriggerSource, SagaTypeShape}

/** Structural composition faces. Target-language expressions are rendered only
  * by InvocationHostTemplate; names and types come from the admitted bindings
  * and the existing metadata resolver. */
final case class CompositionHostModel(
    pipelineId: String, hostPkg: String, hostName: String, hostObjStem: String, pidPrefix: String,
    stepIds: Vector[String], splitStepId: String, awaitStepId: String, mergeStepId: String,
    splitModuleFqn: String, splitEntryFqn: String, splitHostObj: String,
    mergeModuleFqn: String, mergeEntryFqn: String, mergeHostObj: String,
    awaitPayloadSlots: Vector[(String, Boolean)], wafersSlot: String, childRunSlot: String,
    childCompletedCode: String, child: ChildPlanRender, triggerCtor: CommandCtor,
    splitCtorArgs: Vector[CtorArg], mergeCtorArgs: Vector[CtorArg],
    protocolFqn: String, replyFqn: String, specFaces: AggregateSpecFace)

final case class ChildPlanRender(planId: String, planObj: String, stageType: String, stateType: String,
                                 pidPrefix: String, stages: Vector[String], stateFields: Vector[(String, String, String)])

sealed trait CompositionArgSource
object CompositionArgSource {
  case object TransactionId extends CompositionArgSource
  final case class Input(slot: String) extends CompositionArgSource
  final case class Checkpoint(stepId: String, slot: String) extends CompositionArgSource
  final case class Seed(slot: String) extends CompositionArgSource
}
final case class CtorArg(param: String, source: CompositionArgSource, collection: Option[String])
final case class CommandCtor(fqn: String, args: Vector[CtorArg])
final case class AggregateSpecFace(entityKeyFqn: String, entityFqn: String,
                                   behaviorsFqn: String, eventHandlerFqn: String, commandFamilyFqn: String,
                                   queryCtor: String, stateField: String,
                                   seedPrepare: CommandCtor, seedCommit: CommandCtor)

object CompositionHostBuilder {
  private def fail(msg: String): Nothing = throw new IllegalStateException("composition face: " + msg)

  def build(plan: CompositionBindingAdapter.CompositionFacePlan, token: AdmittedSagaInputV3,
            ctx: GeneratorContext): CompositionHostModel = {
    import CompositionArgSource._
    val splitStepId = plan.steps.head._1
    val mergeStepId = plan.steps.last._1
    def invocation(id: String) = plan.invocations.find(_.stepId == id).getOrElse(fail("invocation row missing: " + id))
    val splitFace = invocation(splitStepId)
    val mergeFace = invocation(mergeStepId)
    def admitted(face: CompositionBindingAdapter.SagaInvocationFace) = {
      val saga = token.sagas.find(_.execution.sagaId == face.sagaId).map(_.execution)
        .getOrElse(fail("saga not admitted: " + face.sagaId))
      if (saga.contract.definition.version != face.version ||
          saga.contract.binding.engine.entrypoint.dottedPath != face.entrypoint)
        fail("invocation version/entrypoint does not match its admitted saga: " + face.sagaId)
      if (face.args.map(a => a._1 -> a._3) != saga.contract.definition.payload.args.map(a => a.slot -> a.typeId))
        fail("invocation args do not match the admitted saga slots/types: " + face.sagaId)
      saga
    }
    val splitSaga = admitted(splitFace)
    val mergeSaga = admitted(mergeFace)
    val splitModule = ctx.typeResolver.strictModule(splitSaga.contract.binding.module)
    val mergeModule = ctx.typeResolver.strictModule(mergeSaga.contract.binding.module)
    val compositionModule = ctx.typeResolver.strictModule(FullQualifiedName(plan.module))
    val hostStem = NamingConventions.removeSuffix(compositionModule.name, "Module")
    val hostPkg = NamingConventions.strictSiblingPackage(compositionModule.packageName, "composition")
    val hostName = NamingConventions.strictNestedName(hostStem, "Host")
    val pidPrefix = NamingConventions.strictKebab(hostStem)

    def trigger(saga: net.imadz.meta.execution.StrictSagaExecutionMetadata) =
      saga.contract.definition.payload.triggers.headOption.getOrElse(fail("saga declares no trigger"))
    val sourceCmd = trigger(splitSaga).source match {
      case SagaTriggerSource.Command(ref) => ref
      case _ => fail("split trigger must be a command trigger")
    }
    if (trigger(mergeSaga).source != trigger(splitSaga).source) fail("bounded composition requires one shared trigger command face")
    val aggName = sourceCmd.owner.targetName
    val agg = ctx.metaRegistry.resolveByName[AggregateRootMetadata](aggName).getOrElse(fail("aggregate missing: " + aggName))
    val protocol = ctx.typeResolver.aggregateProtocol(agg)
    val replyName = agg.replyFamily.replies.headOption.getOrElse(fail("reply family missing")).name
    val triggerCmd = agg.commandFamily.commands.find(_.name == sourceCmd.command.targetName)
      .getOrElse(fail("trigger command missing in base"))
    def nested(name: String): String = ctx.typeResolver.strictNested(protocol, name).fqn
    def collection(tpe: MetaType): Option[String] = tpe match {
      case CustomType(name, _, _) if Set("List", "Vector", "Seq").contains(name) => Some(name)
      case _ => None
    }
    def ctorArgs(face: CompositionBindingAdapter.SagaInvocationFace): Vector[CtorArg] =
      triggerCmd.parameters.map { p =>
        val source = if (p.name == trigger(splitSaga).idempotency.sourceSlot) TransactionId else face.args.find(_._1 == p.name) match {
          case Some((_, ref, _)) if ref.startsWith("input:") => Input(ref.drop(6))
          case Some((_, ref, _)) => ref.split(":", -1).toVector match {
            case Vector("step", step, slot) if step == plan.awaitStepId && slot == plan.wafersSlot => Checkpoint(step, slot)
            case _ => fail("unsupported checkpoint argument: " + ref)
          }
          case None => fail("trigger param has no declared args mapping: " + p.name)
        }
        CtorArg(p.name, source, collection(p.parameterType))
      }.toVector
    val splitCtor = CommandCtor(nested(triggerCmd.name), ctorArgs(splitFace))
    val mergeCtor = CommandCtor(nested(triggerCmd.name), ctorArgs(mergeFace))

    val childParticipant = mergeSaga.contract.definition.payload.participants.find(_.resourceSlot == "to")
      .getOrElse(fail("merge saga has no funding participant"))
    def phaseCommand(phase: SagaPhase): String = {
      val step = mergeSaga.contract.definition.payload.steps.find(_.participantId == childParticipant.id)
        .getOrElse(fail("merge child step missing"))
      step.phases.find(_.phase == phase).getOrElse(fail("merge child phase missing")).command.contractName
    }
    def seedCtor(contractName: String): CommandCtor = {
      val cmd = agg.commandFamily.commands.find(_.name == NamingConventions.strictSymbol(contractName))
        .getOrElse(fail("seed command missing in base: " + contractName))
      CommandCtor(nested(cmd.name), cmd.parameters.map { p =>
        val coll = collection(p.parameterType)
        val slot = if (coll.nonEmpty) "wafers" else if (p.name == "txid") "txid" else if (p.name == "resource") "entityId"
          else fail("seed param outside the declared txid/resource/payload face: " + p.name)
        CtorArg(p.name, Seed(slot), coll)
      }.toVector)
    }
    val query = agg.commandFamily.commands.find(_.isReadOnly).getOrElse(fail("aggregate declares no state query"))
    val state = ctx.metaRegistry.resolveByName[ValueObjectMetadata](agg.stateRef.targetName).getOrElse(fail("state vo missing"))
    val carried = state.fields.find { f => f.fieldType match {
      case CustomType("Map", _, _) => f.name == "carried"
      case _ => false
    }}.getOrElse(fail("state declares no carried wafer map")).name
    val specFace = AggregateSpecFace(
      ctx.typeResolver.aggregateRoot(agg).fqn, ctx.typeResolver.entity(agg.entityRef.targetName).fqn,
      ctx.typeResolver.aggregateBehavior(agg).fqn, ctx.typeResolver.entityEventHandler(agg.entityRef.targetName).fqn,
      nested(agg.commandFamily.name), nested(query.name), carried,
      seedCtor(phaseCommand(SagaPhase.Prepare)), seedCtor(phaseCommand(SagaPhase.Commit)))

    val types = splitSaga.args.types.map(t => t.id -> t.shape).toMap
    val payload = plan.inputs.filter(i => i._1 != "operation" && i._1 != "occurrence").map { case (id, tpe) =>
      id -> types.get(tpe).exists(_.isInstanceOf[SagaTypeShape.Collection])
    }
    val childFields = plan.child.stateFields.map { case (name, tpe) =>
      if (tpe == "Int") (name, "Int", "zero") else (name, "Vector[String]", "collection")
    }
    val planObj = NamingConventions.strictNestedName(NamingConventions.strictPascal(plan.child.planId), "Plan")
    CompositionHostModel(plan.pipelineId, hostPkg, hostName, hostStem, pidPrefix,
      plan.steps.map(_._1), splitStepId, plan.awaitStepId, mergeStepId,
      splitModule.fqn, splitFace.entrypoint, "FixtureHost", mergeModule.fqn, mergeFace.entrypoint, "FixtureHost",
      payload, plan.wafersSlot, plan.childRunSlot, plan.childCompletedCode,
      ChildPlanRender(plan.child.planId, planObj, "ChildStage", "ChildPlanState", plan.childPidPrefix, plan.child.stages, childFields),
      splitCtor, splitCtor.args, mergeCtor.args, protocol.fqn, nested(replyName), specFace)
  }
}
