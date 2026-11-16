package net.imadz.FabSplitMergeDesign.domain.invariant

import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.LotEvents
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.LotState
import net.imadz.common.CommonTypes.InvariantRule
import net.imadz.common.CommonTypes.iMadzError
import scala.collection.immutable.Vector

object LotRules {
/** Formal-path rules from the truth tree (P4 state deepening; golden-master
  * semantics transcribed mechanically). Guards evaluate in declaration
  * order; succeed-empty failures reply success with no events. */
  final case class ReserveWaferRemovalParams(txid: String, resource: String, wafers: Vector[String])

  object ReserveWaferRemovalRule extends InvariantRule[LotEvents, LotState, ReserveWaferRemovalParams] {
    def apply(state: LotState, p: ReserveWaferRemovalParams): Either[iMadzError, List[LotEvents]] = {
      if (state.reservedRemovals.contains(p.txid)) Right(Nil) // Removal already reserved for this transaction: idempotent success, no events (mirror of golden master 60008 semantics).
      else if (!(p.wafers.forall(state.carried.contains))) Left(iMadzError("61003", "Source lot does not carry the full frozen wafer set (conservation precondition).")) // Source lot does not carry the full frozen wafer set (conservation precondition).
      else Right(List(LotEntity.ReserveWaferRemovalConfirmed(p.txid, p.txid + ":receipt:reservation", p.wafers)))
    }
  }

  final case class CommitWaferRemovalParams(txid: String, resource: String)

  object CommitWaferRemovalRule extends InvariantRule[LotEvents, LotState, CommitWaferRemovalParams] {
    def apply(state: LotState, p: CommitWaferRemovalParams): Either[iMadzError, List[LotEvents]] = {
      if (!(state.reservedRemovals.contains(p.txid))) Left(iMadzError("61006", "No reserved removal found for this transaction.")) // No reserved removal found for this transaction.
      else Right(List(LotEntity.CommitWaferRemovalConfirmed(p.txid, p.txid + ":receipt:receiptId")))
    }
  }

  final case class ReleaseReservedWaferParams(txid: String, resource: String, wafers: Vector[String])

  object ReleaseReservedWaferRule extends InvariantRule[LotEvents, LotState, ReleaseReservedWaferParams] {
    def apply(state: LotState, p: ReleaseReservedWaferParams): Either[iMadzError, List[LotEvents]] = {
      if (!(state.reservedRemovals.contains(p.txid))) Left(iMadzError("61006", "No reserved removal found for this transaction.")) // No reserved removal found for this transaction.
      else Right(List(LotEntity.ReleaseReservedWaferConfirmed(p.txid, p.wafers)))
    }
  }

  final case class ReserveAddWaferParams(txid: String, resource: String, wafers: Vector[String])

  object ReserveAddWaferRule extends InvariantRule[LotEvents, LotState, ReserveAddWaferParams] {
    def apply(state: LotState, p: ReserveAddWaferParams): Either[iMadzError, List[LotEvents]] = {
      if (state.reservedAdditions.contains(p.txid)) Left(iMadzError("61007", "Addition already registered for this transaction (deterministic target-prepare rejection — the auto-abort/compensate face).")) // Addition already registered for this transaction (deterministic target-prepare rejection — the auto-abort/compensate face).
      else Right(List(LotEntity.ReserveAddWaferConfirmed(p.txid, p.txid + ":receipt:reservation", p.wafers)))
    }
  }

  final case class CommitAddWaferParams(txid: String, resource: String, wafers: Vector[String])

  object CommitAddWaferRule extends InvariantRule[LotEvents, LotState, CommitAddWaferParams] {
    def apply(state: LotState, p: CommitAddWaferParams): Either[iMadzError, List[LotEvents]] = {
      if (!(state.reservedAdditions.contains(p.txid))) Left(iMadzError("61008", "Addition cannot be found or already committed.")) // Addition cannot be found or already committed.
      else Right(List(LotEntity.CommitAddWaferConfirmed(p.txid, p.txid + ":receipt:receiptId", p.wafers)))
    }
  }

  final case class CancelAddWaferParams(txid: String, resource: String)

  object CancelAddWaferRule extends InvariantRule[LotEvents, LotState, CancelAddWaferParams] {
    def apply(state: LotState, p: CancelAddWaferParams): Either[iMadzError, List[LotEvents]] = {
      if (!(state.reservedAdditions.contains(p.txid))) Left(iMadzError("61009", "Addition cannot be found or already canceled.")) // Addition cannot be found or already canceled.
      else Right(List(LotEntity.CancelAddWaferConfirmed(p.txid)))
    }
  }

  final case class StartTransferParams(operationId: String, from: String, to: String, wafers: Vector[String], manifest: String)

  object StartTransferRule extends InvariantRule[LotEvents, LotState, StartTransferParams] {
    def apply(state: LotState, p: StartTransferParams): Either[iMadzError, List[LotEvents]] = {
      Right(List(LotEntity.TransferRequested(p.operationId, p.from, p.to, p.wafers, p.manifest)))
    }
  }

  final case class RecordResultSucceededParams(txid: String)

  object RecordResultSucceededRule extends InvariantRule[LotEvents, LotState, RecordResultSucceededParams] {
    def apply(state: LotState, p: RecordResultSucceededParams): Either[iMadzError, List[LotEvents]] = {
      if (state.sagaResults.contains(p.txid)) Right(Nil) // Result already recorded for this transaction: idempotent republication success, no events (designed strict TCC outcome ledger 61010).
      else Right(List(LotEntity.result_succeeded(p.txid)))
    }
  }

  final case class RecordResultRejectedBeforeEffectsParams(txid: String)

  object RecordResultRejectedBeforeEffectsRule extends InvariantRule[LotEvents, LotState, RecordResultRejectedBeforeEffectsParams] {
    def apply(state: LotState, p: RecordResultRejectedBeforeEffectsParams): Either[iMadzError, List[LotEvents]] = {
      if (state.sagaResults.contains(p.txid)) Right(Nil) // Result already recorded for this transaction: idempotent republication success, no events (designed strict TCC outcome ledger 61010).
      else Right(List(LotEntity.result_rejected_before_effects(p.txid)))
    }
  }

  final case class RecordResultCompensatedParams(txid: String)

  object RecordResultCompensatedRule extends InvariantRule[LotEvents, LotState, RecordResultCompensatedParams] {
    def apply(state: LotState, p: RecordResultCompensatedParams): Either[iMadzError, List[LotEvents]] = {
      if (state.sagaResults.contains(p.txid)) Right(Nil) // Result already recorded for this transaction: idempotent republication success, no events (designed strict TCC outcome ledger 61010).
      else Right(List(LotEntity.result_compensated(p.txid)))
    }
  }

  final case class RecordResultRecoveryRequiredParams(txid: String)

  object RecordResultRecoveryRequiredRule extends InvariantRule[LotEvents, LotState, RecordResultRecoveryRequiredParams] {
    def apply(state: LotState, p: RecordResultRecoveryRequiredParams): Either[iMadzError, List[LotEvents]] = {
      if (state.sagaResults.contains(p.txid)) Right(Nil) // Result already recorded for this transaction: idempotent republication success, no events (designed strict TCC outcome ledger 61010).
      else Right(List(LotEntity.result_recovery_required(p.txid)))
    }
  }

  final case class RecordResultOutcomeUnknownParams(txid: String)

  object RecordResultOutcomeUnknownRule extends InvariantRule[LotEvents, LotState, RecordResultOutcomeUnknownParams] {
    def apply(state: LotState, p: RecordResultOutcomeUnknownParams): Either[iMadzError, List[LotEvents]] = {
      if (state.sagaResults.contains(p.txid)) Right(Nil) // Result already recorded for this transaction: idempotent republication success, no events (designed strict TCC outcome ledger 61010).
      else Right(List(LotEntity.result_outcome_unknown(p.txid)))
    }
  }
}
