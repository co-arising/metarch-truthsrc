package example.stockreservation.projections

import java.time.Instant

import org.scalacheck.Properties
import org.scalacheck.Prop.forAll
import org.scalacheck.Prop.secure

import example.stockreservation.application.projection.handlers.StockLedgerApplyEvent
import example.stockreservation.application.projection.handlers.StockLedgerSnapshotApplyEvent
import example.stockreservation.domain.entities.ReservationEntity.LedgerReopened
import example.stockreservation.domain.entities.ReservationEntity.LedgerSettled
import example.stockreservation.domain.entities.ReservationEntity.QuantityAdjusted
import example.stockreservation.domain.entities.ReservationEntity.Reserved
import example.stockreservation.domain.entities.ReservationEntity.TagUpserted

/** 行为性质：四形函数与 helper 全部经由公开函数面实测——私有 helper 不直调。
  * 时间口径：normal 时间戳直译（epoch0/null 归一走 negative 的「非 epoch0」断言）。 */
object ApplyEventProperties extends Properties("projection-apply-event.stock-ledger.v1") {
  import ApplyEventCases._

  property("create: from-None create projects all event columns onto the shared empty row") =
    forAll(reservedEvents) { e =>
      StockLedgerApplyEvent.onReserved(None, e) == ApplyEventOracle.expectedReserved(None, e)
    }

  property("create: over-existing preserves unprojected columns") =
    forAll(ledgerRows, reservedEvents) { (row, e) =>
      val next = StockLedgerApplyEvent.onReserved(Some(row), e)
      next.totalAmount == row.totalAmount && next.tags == row.tags
    }

  property("create: negative: the existing row argument is never mutated") =
    forAll(ledgerRows, reservedEvents) { (row, e) =>
      val before = row.copy()
      StockLedgerApplyEvent.onReserved(Some(row), e)
      row == before
    }

  property("update-only: projects the delta and stamps the event time") =
    forAll(ledgerRows, quantityAdjustedEvents) { (row, e) =>
      StockLedgerApplyEvent.onQuantityAdjusted(row, e) == ApplyEventOracle.expectedAdjusted(row, e)
    }

  property("upsert: a hit replaces in slot preserving position and size") =
    forAll(ledgerRows, tags) { (row, tag) =>
      val seeded = if (row.tags.nonEmpty) row else row.copy(tags = List("seed-a", "seed-b"))
      val hit = seeded.tags.head
      val next = StockLedgerApplyEvent.onTagUpserted(seeded, TagUpserted(hit))
      val slot = seeded.tags.indexOf(hit)
      next.tags.size == seeded.tags.size && next.tags.indexOf(hit) == slot && next.tags(slot) == hit
    }

  property("upsert: a miss appends preserving prior order") =
    forAll(ledgerRows, tagUpsertedEvents) { (row, e) =>
      val seeded = row.copy(tags = row.tags.filter(_ != e.tag))
      StockLedgerApplyEvent.onTagUpserted(seeded, e).tags == seeded.tags :+ e.tag
    }

  property("update-only: settle and reopen patch their columns exactly") =
    forAll(ledgerRows, settledEvents, reopenedEvents) { (row, settled, reopened) =>
      StockLedgerApplyEvent.onLedgerSettled(row, settled) == ApplyEventOracle.expectedSettled(row, settled) &&
        StockLedgerApplyEvent.onLedgerReopened(row, reopened) == ApplyEventOracle.expectedReopened(row, reopened)
    }

  property("update-only: negative: a None patch clears the column and preserves the rest") =
    forAll(ledgerRows, reopenedEvents) { (row, reopened) =>
      val next = StockLedgerApplyEvent.onLedgerReopened(row, reopened)
      next.settledAt == None && next.quantity == row.quantity && next.tags == row.tags &&
        next.totalAmount == row.totalAmount && next.`type` == row.`type`
    }

  property("delete: emits the literal partition key and the id string key") =
    forAll(cancellationEvents) { e =>
      val keys = StockLedgerApplyEvent.onReservationCancelled(e)
      keys._1 == "ledger-root" && keys._2 == e.cancelledId.toString && keys._2 == keys._2.toLowerCase
    }

  property("ts: normal timestamps pass through exactly") =
    forAll(ledgerRows, quantityAdjustedEvents) { (row, e) =>
      StockLedgerApplyEvent.onQuantityAdjusted(row, e).lastEventAt == Some(e.occurredAt)
    }

  property("ts: negative: epoch-zero and null timestamps never yield an epoch-zero instant") = secure {
    val epoch = StockLedgerApplyEvent.onQuantityAdjusted(StockLedgerApplyEvent.onReserved(None,
      Reserved(java.util.UUID.randomUUID(), "label", 1, "tenant", Instant.ofEpochMilli(1))),
      QuantityAdjusted(0, Instant.EPOCH))
    val nullStamp = StockLedgerApplyEvent.onQuantityAdjusted(epoch, QuantityAdjusted(0, null))
    epoch.lastEventAt.get.toEpochMilli != 0L && nullStamp.lastEventAt.get.toEpochMilli != 0L
  }

  property("str-or: null labels default to empty") = secure {
    val row = StockLedgerApplyEvent.onReserved(None,
      Reserved(java.util.UUID.randomUUID(), null, 1, "tenant", Instant.ofEpochMilli(1)))
    row.label == ""
  }

  property("persistence-id: create threads entityId into identity and the tenant param") =
    forAll(snapshotRecordedEvents, entityIds) { (e, entityId) =>
      val row = StockLedgerSnapshotApplyEvent.onSnapshotRecorded(e, entityId)
      row == ApplyEventOracle.expectedSnapshotRecorded(e, entityId) &&
        row.snapshotId == net.imadz.common.Id.of(entityId) && row.tenantId == e.tenantId
    }

  property("persistence-id: negative: identity never falls back to the zero uuid") =
    forAll(snapshotRecordedEvents, entityIds) { (e, entityId) =>
      StockLedgerSnapshotApplyEvent.onSnapshotRecorded(e, entityId).snapshotId !=
        net.imadz.common.Id.of("00000000-0000-0000-0000-000000000000")
    }

  property("snapshot-amend: preserves identity and count") =
    forAll(snapshotRows, snapshotAmendedEvents) { (row, e) =>
      val next = StockLedgerSnapshotApplyEvent.onSnapshotAmended(row, e)
      next.snapshotId == row.snapshotId && next.eventCount == row.eventCount &&
        next.totalAmount == row.totalAmount + e.delta
    }

  property("purity: repeated application with the same input is deterministic") =
    forAll(ledgerRows, reservedEvents) { (row, e) =>
      val once = StockLedgerApplyEvent.onReserved(Some(row), e)
      StockLedgerApplyEvent.onReserved(Some(row), e) == once
    }
}
