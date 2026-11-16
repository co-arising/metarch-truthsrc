package net.imadz.codegen.scaffolding.cqrs.model.application.transactor

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

/** P4 Slice 2 fixture-host emission IR. Every member is mechanically derived from
  * the admitted v3 contract plus the aggregate metadata (writtenBy state lineage,
  * the read-only state-query face); nothing is invented here. The template renders
  * the five fixture files (types / ExactMoneyCodec / ArgsCodec / FixtureHost /
  * StrictSagaEntry) that discharge the generated `SagaModule.Host` obligations.
  */
sealed trait FixtureWireShape
case object FixtureTextShape extends FixtureWireShape
case object FixtureMoneyShape extends FixtureWireShape
final case class FixtureCollectionShape(minItems: Int, maxItems: Int, minLength: Int, maxLength: Int) extends FixtureWireShape

/** One contract type implementation: `fixture.types.<id>` alias. Bounded text ids
  * alias String; the money type aliases the aggregate value object the folds mutate. */
final case class FixtureTypeAlias(id: String, targetFqn: String, money: Boolean, collection: Boolean = false)

/** One aggregate runtime face the host asks: phase commands, the uniform reply,
  * the read-only state query that backs prepare evidence, and the behavior
  * factory faces the emitted safety spec wires into its own sharding/entity
  * setup (P5 verification emission). */
final case class FixtureAggregateFace(
    base: String,             // CreditBalance
    protocolFqn: String,      // net.imadz.<module>.application.aggregates.CreditBalanceProtocol
    aggregateKeyFqn: String,  // net.imadz.<module>.application.aggregates.CreditBalanceAggregate.entityTypeKey
    commandsFamilyFqn: String,// ...CreditBalanceProtocol.CreditBalanceCommands
    replyFqn: String,         // ...CreditBalanceProtocol.CreditBalanceReply
    queryCommandFqn: String,  // ...CreditBalanceProtocol.GetBalance
    queryReplyFqn: String,    // ...CreditBalanceProtocol.GetCreditBalanceStateReply
    behaviorsFqn: String,     // ...application.aggregates.behaviors.CreditBalanceBehaviors (P5 spec face)
    eventHandlerFqn: String,  // ...domain.entities.behaviors.CreditBalanceEventHandler (P5 spec face)
    entityFqn: String         // ...domain.entities.CreditBalanceEntity (empty-state factory; P5 spec face)
)

final case class FixturePrepareValueEvidence(mapField: String, valueSlot: String)
final case class FixtureTerminalEvidence(liveMap: String, markerMap: String, oppositeMap: String)

final case class FixturePhasePort(
    stem: String,             // reserve_sourcePrepare
    stepId: String,
    participantId: String,
    phaseRuntime: String,     // Prepare | Commit | Compensate
    faceBase: String,         // FixtureAggregateFace.base this port asks
    inputType: String,        // SagaModule.Reserve_sourcePrepareInput
    receiptType: String,      // SagaModule.Reserve_sourcePrepareReceipt
    pinId: String,            // reserve-source-prepare-receipt
    pinVersion: Int,
    commandExpr: String,      // CreditBalanceProtocol.ReserveFunds(input.txid, input.resource, input.amount, replyTo)
    receiptExpr: String,      // SagaModule.Reserve_sourcePrepareReceipt(input.txid, input.amount)
    receiptFields: Vector[(String, FixtureWireShape)], // receipt case class fields, declared order
    evidenceMapField: Option[String],                  // prepare = writtenBy lineage field; commit/compensate = phase-marker field (P5)
    txidSlot: String,         // the transaction-identity input slot ("txid")
    commandName: String,      // ReserveFunds (P5 spec face)
    commandSlots: Vector[String], // input slot names in command parameter order (P5 spec face)
    commandSlotShapes: Vector[(String, FixtureWireShape)], // same order, wire shapes (P5 spec face)
    resourceSlotName: String, // the input slot carrying the entity address (P5 spec face)
    prepareValueEvidence: Option[FixturePrepareValueEvidence] = None,
    terminalEvidence: Option[FixtureTerminalEvidence] = None
)

final case class FixtureTriggerModel(
    member: String,           // from_commandTrigger
    contractMember: String,   // from_commandTriggerContract
    bindingType: String,      // SagaModule.From_commandTriggerBinding
    sourceFqn: String,        // ...CreditBalanceProtocol.StartTransfer
    sourceIsCommand: Boolean, // command trigger (entry-wired) vs event trigger (P5 event-stream source)
    idempotencyField: String, // operationId
    argSources: Vector[(String, Option[(Int, Int)])], // (slot, bounded text bounds); money slots absent
    moneySlots: Vector[String],
    collectionSlots: Vector[(String, FixtureCollectionShape)] = Vector.empty
)

final case class FixtureCompletionModel(
    member: String,           // succeededCompletion
    contractMember: String,   // succeededCompletionContract
    bindingType: String,      // SagaModule.SucceededCompletionBinding
    inputType: String,        // SagaModule.SucceededCompletionInput
    kindWire: String,         // succeeded | rejected-before-effects | compensated | recovery-required | outcome-unknown
    eventFqn: String,         // ...CreditBalanceEntity.result_succeeded
    eventFamilyFqn: String,   // ...CreditBalanceEntity.CreditBalanceEvents
    eventArgs: Vector[String], // input slot names in event field order
    publicationCommandFqn: String // ...CreditBalanceProtocol.RecordResultSucceeded (the event's one producer; P5)
)

final case class FixtureHostModel(
    override val selfType: TypeRef,     // fixture.FixtureHost
    packagePath: String,                // fixture
    moduleType: TypeRef,                // fixture.SagaModule
    argsCodecName: String,              // ArgsCodec (contract FQN fixture.ArgsCodec)
    argsPinId: String,                  // runtime args codec pin id (CodecPin(id, version))
    argsPinVersion: Int,
    moneyCodecName: String,             // ExactMoneyCodec (contract FQN fixture.ExactMoneyCodec)
    entryName: String,                  // StrictSagaEntry (binding entrypoint)
    argsFqn: String,                    // SagaModule.Args
    argsFields: Vector[(String, FixtureWireShape)],
    typeAliases: Vector[FixtureTypeAlias],
    faces: Vector[FixtureAggregateFace],
    phases: Vector[FixturePhasePort],
    triggers: Vector[FixtureTriggerModel],
    completions: Vector[FixtureCompletionModel],
    capabilities: Vector[String],       // RequiredHost.capabilities (requirements the emitted host covers)
    supportedCapabilities: Vector[String], // what the emitted implementation actually provides
    businessInvariants: Vector[String],
    safetyChecks: Vector[(String, String)], // (requirement field, expected constant)
    interactionTimeoutMs: Int,          // contract phaseTimeoutMs — the coordinator pin the host settings must carry
    resourceMembers: Vector[String],    // Host trait resource defs (sourceResource/targetResource)
    namespacePrefix: String,            // strict-saga
    publicationSlot: String,            // args slot naming the initiating entity the result publishes onto (P5: "from")
    publicationFaceBase: String,        // the aggregate face the publication command rides (P5)
    fundingSeedEvents: Vector[(String, Vector[(String, FixtureWireShape)])], // the target prepare+commit confirmation pair (FQN, payload slots) seeding initial funds in the emitted safety spec (P5)
    dependencyRefs: Set[TypeRef],       // builder-resolved import surface for the emitted files
    fundingEventFields: Vector[(String, Vector[(String, Boolean)])] = Vector.empty,
    fundingCommands: Vector[(String, Vector[(String, FixtureWireShape)])] = Vector.empty,
    preparedField: String = "",
    phaseCollections: Map[String, Vector[String]] = Map.empty
) extends ArtifactModel {
  override def dependencies: Set[TypeRef] = dependencyRefs
}
