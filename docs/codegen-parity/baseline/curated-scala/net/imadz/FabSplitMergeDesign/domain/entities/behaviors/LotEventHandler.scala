package net.imadz.FabSplitMergeDesign.domain.entities.behaviors

import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.CancelAddWaferConfirmed
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.CommitAddWaferConfirmed
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.CommitWaferRemovalConfirmed
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.LotEvents
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.LotEventsEventHandler
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.LotEventsEventHandler
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.LotState
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.ReleaseReservedWaferConfirmed
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.ReserveAddWaferConfirmed
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.ReserveWaferRemovalConfirmed
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.TransferRequested
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.result_compensated
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.result_outcome_unknown
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.result_recovery_required
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.result_rejected_before_effects
import net.imadz.FabSplitMergeDesign.domain.entities.LotEntity.result_succeeded

object LotEventHandler {
  def apply: LotEventsEventHandler = (state, event) => event match {
    case event: ReserveWaferRemovalConfirmed =>
      state.copy(
        reservedRemovals = state.reservedRemovals + (event.txid -> event.reservation),
        carried = state.carried -- event.wafers
      )

    case event: CommitWaferRemovalConfirmed =>
      state.copy(
        committed = state.committed + (event.txid -> event.receiptId),
        reservedRemovals = state.reservedRemovals - event.txid
      )

    case event: ReleaseReservedWaferConfirmed =>
      state.copy(
        compensated = state.compensated + (event.txid -> "released-removal"),
        carried = state.carried ++ event.wafers.map(k => k -> "carried"),
        reservedRemovals = state.reservedRemovals - event.txid
      )

    case event: ReserveAddWaferConfirmed =>
      state.copy(
        reservedAdditions = state.reservedAdditions + (event.txid -> event.reservation)
      )

    case event: CommitAddWaferConfirmed =>
      state.copy(
        committed = state.committed + (event.txid -> event.receiptId),
        carried = state.carried ++ event.wafers.map(k => k -> "carried"),
        reservedAdditions = state.reservedAdditions - event.txid
      )

    case event: CancelAddWaferConfirmed =>
      state.copy(
        compensated = state.compensated + (event.txid -> "canceled-addition"),
        reservedAdditions = state.reservedAdditions - event.txid
      )

    case event: TransferRequested =>
      state

    case event: result_succeeded =>
      state.copy(
        sagaResults = state.sagaResults + (event.txid -> "succeeded")
      )

    case event: result_rejected_before_effects =>
      state.copy(
        sagaResults = state.sagaResults + (event.txid -> "rejected-before-effects")
      )

    case event: result_compensated =>
      state.copy(
        sagaResults = state.sagaResults + (event.txid -> "compensated")
      )

    case event: result_recovery_required =>
      state.copy(
        sagaResults = state.sagaResults + (event.txid -> "recovery-required")
      )

    case event: result_outcome_unknown =>
      state.copy(
        sagaResults = state.sagaResults + (event.txid -> "outcome-unknown")
      )
    case _ => state // 默认兜底，或者抛异常
  }


}
