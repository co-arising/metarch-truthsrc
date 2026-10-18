package goldens.sagadsl

import akka.actor.typed.{ActorRef, RecipientRef}
import net.imadz.infra.saga.SagaParticipant.SagaResult
import net.imadz.infra.saga.dsl._

/** Golden sample: transfer saga on the saga-core 0.2 DSL.
 *
 *  Covers the DSL surface the generator targets:
 *  - `SagaDefinition[E, C, A]` (name/version/argsCodec/steps/preCheck/errorText/onResult)
 *  - `SagaStep.builder[E, C](stepId)` fluent TCC builder
 *    (.prepare/.commit/.compensate → .ref → .command → .mapReply → .build())
 *  - `SagaRegistry.register`
 *  - `ArgsCodec.playJson`
 *
 *  TCC semantics: prepare = reserve, commit = settle, compensate = release.
 *  Mirrors `SagaDslAcceptanceSpec` (saga-core test kit).
 */

// ── domain ─────────────────────────────────────────────────────────────
final case class TransferArgs(fromAccount: String, toAccount: String, amount: Long)
object TransferArgs {
  implicit val format: play.api.libs.json.Format[TransferArgs] =
    play.api.libs.json.Json.format[TransferArgs]
}

/** Context the steps resolve participant refs from. Wired by the app. */
trait TransferContext {
  def ledger: RecipientRef[LedgerCommand]
}

// ── ledger protocol (simplified) ─────────────────────────────────────────
sealed trait LedgerCommand
final case class Reserve(from: String, to: String, amount: Long, txId: String, replyTo: ActorRef[LedgerReply])
    extends LedgerCommand
final case class Settle(txId: String, replyTo: ActorRef[LedgerReply]) extends LedgerCommand
final case class Release(txId: String, replyTo: ActorRef[LedgerReply]) extends LedgerCommand
final case class LedgerReply(ok: Boolean, error: Option[String])

// ── saga definition ──────────────────────────────────────────────────────
object TransferSaga {

  private def mapLedger(r: LedgerReply): Either[String, SagaResult[String]] =
    r.error.map(Left(_)).getOrElse(Right(SagaResult("ok")))

  val definition: SagaDefinition[String, TransferContext, TransferArgs] =
    SagaDefinition[String, TransferContext, TransferArgs](
      name = "transfer",
      version = 1,
      argsCodec = ArgsCodec.playJson[TransferArgs],
      steps = args =>
        Seq(
          SagaStep
            .builder[String, TransferContext]("reserve")
            .inGroup(1)
            .withResilience(ResiliencePolicy(maxRetries = 3))
            .prepare
              .ref(ctx => ctx.ledger)
              .command[LedgerReply]((txId, replyTo) =>
                Reserve(args.fromAccount, args.toAccount, args.amount, txId, replyTo))
              .mapReply(mapLedger)
            .commit
              .ref(ctx => ctx.ledger)
              .command[LedgerReply]((txId, replyTo) => Settle(txId, replyTo))
              .mapReply(mapLedger)
            .compensate
              .ref(ctx => ctx.ledger)
              .command[LedgerReply]((txId, replyTo) => Release(txId, replyTo))
              .mapReply(mapLedger)
            .build()
        ),
      preCheck = args =>
        if (args.amount > 0) Right(args) else Left("amount must be positive"),
      errorText = e => ("TRANSFER_REJECTED", e),
      onResult = (_, _) => Seq.empty // business events emitted on completion
    )

  /** Call once at node startup, before cluster sharding recovers entities. */
  def register(): Unit = SagaRegistry.register(definition)
}
