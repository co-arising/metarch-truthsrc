package example.stockreservation.projections

import java.time.Instant

import org.scalacheck.Properties
import org.scalacheck.Prop.forAll
import org.scalacheck.Prop.secure

import com.google.inject.Guice

import example.stockreservation.application.projection.handlers.StockLedgerApplyEvent
import example.stockreservation.application.projection.handlers.StockLedgerApplyEventSemantics
import example.stockreservation.application.projection.handlers.StockLedgerSnapshotApplyEvent
import example.stockreservation.application.projection.handlers.StockLedgerSnapshotApplyEventSemantics
import example.stockreservation.application.projection.repository.StockLedgerSnapshotTable.StockLedgerSnapshotView
import example.stockreservation.application.projection.repository.StockLedgerTable.StockLedgerView
import example.stockreservation.domain.entities.ReservationEntity.LedgerReopened
import example.stockreservation.domain.entities.ReservationEntity.LedgerSettled
import example.stockreservation.domain.entities.ReservationEntity.QuantityAdjusted
import example.stockreservation.domain.entities.ReservationEntity.Reserved
import example.stockreservation.domain.entities.ReservationEntity.SnapshotAmended
import example.stockreservation.domain.entities.ReservationEntity.SnapshotRecorded
import example.stockreservation.domain.entities.ReservationEntity.TagUpserted
import example.stockreservation.infrastructure.bootstrap.StockLedgerProjectionModule
import example.stockreservation.infrastructure.projection.StockLedgerApplyEventSemanticsImpl
import example.stockreservation.infrastructure.projection.StockLedgerSnapshotApplyEventSemanticsImpl

/** 行为性质三段：kernel 六函数走桩语义（完全确定）；impl 走真实 Injector 解析的
  * 手写实现（时钟/白纸/文本语义专测）；装配走真实 Guice 绑定。 */
object ApplyEventProperties extends Properties("projection-apply-event.stock-ledger.v1") {
  import ApplyEventCases._

  private val ledger = new StockLedgerApplyEvent(ApplyEventOracle.ledgerStub)
  private val snapshots = new StockLedgerSnapshotApplyEvent(ApplyEventOracle.snapshotStub)

  private val impls = Guice.createInjector(new StockLedgerProjectionModule)
  private val ledgerSem = impls.getInstance(classOf[StockLedgerApplyEventSemantics])
  private val snapshotSem = impls.getInstance(classOf[StockLedgerSnapshotApplyEventSemantics])

  property("create: from-None create projects all event columns onto the stub empty row") =
    forAll(reservedEvents) { e =>
      ledger.onReserved(None, e) == ApplyEventOracle.expectedReserved(None, e)
    }

  property("create: over-existing preserves unprojected columns") =
    forAll(ledgerRows, reservedEvents) { (row, e) =>
      val next = ledger.onReserved(Some(row), e)
      next.totalAmount == row.totalAmount && next.tags == row.tags
    }

  property("create: negative: the existing row argument is never mutated") =
    forAll(ledgerRows, reservedEvents) { (row, e) =>
      val before = row.copy()
      ledger.onReserved(Some(row), e)
      row == before
    }

  property("update-only: projects the delta and stamps the event time") =
    forAll(ledgerRows, quantityAdjustedEvents) { (row, e) =>
      ledger.onQuantityAdjusted(row, e) == ApplyEventOracle.expectedAdjusted(row, e)
    }

  property("update-only: settle and reopen patch their columns exactly") =
    forAll(ledgerRows, settledEvents, reopenedEvents) { (row, settled, reopened) =>
      ledger.onLedgerSettled(row, settled) == ApplyEventOracle.expectedSettled(row, settled) &&
        ledger.onLedgerReopened(row, reopened) == ApplyEventOracle.expectedReopened(row, reopened)
    }

  property("update-only: negative: a None patch clears the column and preserves the rest") =
    forAll(ledgerRows, reopenedEvents) { (row, reopened) =>
      val next = ledger.onLedgerReopened(row, reopened)
      next.settledAt == None && next.quantity == row.quantity && next.tags == row.tags &&
        next.totalAmount == row.totalAmount && next.`type` == row.`type`
    }

  property("upsert: a hit replaces in slot preserving position and size") =
    forAll(ledgerRows, tags) { (row, tag) =>
      val seeded = if (row.tags.nonEmpty) row else row.copy(tags = List("seed-a", "seed-b"))
      val hit = seeded.tags.head
      val next = ledger.onTagUpserted(seeded, TagUpserted(hit))
      val slot = seeded.tags.indexOf(hit)
      next.tags.size == seeded.tags.size && next.tags.indexOf(hit) == slot && next.tags(slot) == hit
    }

  property("upsert: a miss appends preserving prior order") =
    forAll(ledgerRows, tagUpsertedEvents) { (row, e) =>
      val seeded = row.copy(tags = row.tags.filter(_ != e.tag))
      ledger.onTagUpserted(seeded, e).tags == seeded.tags :+ e.tag
    }

  property("delete: emits the literal partition key and the id string key") =
    forAll(cancellationEvents) { e =>
      val keys = ledger.onReservationCancelled(e)
      keys._1 == "ledger-root" && keys._2 == e.cancelledId.toString && keys._2 == keys._2.toLowerCase
    }

  property("ts: normal timestamps pass through the semantics hook unchanged") =
    forAll(ledgerRows, quantityAdjustedEvents) { (row, e) =>
      ledger.onQuantityAdjusted(row, e).lastEventAt == Option(e.occurredAt)
    }

  property("persistence-id: create threads entityId into identity and the tenant param") =
    forAll(snapshotRecordedEvents, entityIds) { (e, entityId) =>
      val row = snapshots.onSnapshotRecorded(e, entityId)
      row == ApplyEventOracle.expectedSnapshotRecorded(e, entityId) &&
        row.snapshotId == net.imadz.common.Id.of(entityId) && row.tenantId == e.tenantId
    }

  property("persistence-id: negative: identity never falls back to the zero uuid") =
    forAll(snapshotRecordedEvents, entityIds) { (e, entityId) =>
      snapshots.onSnapshotRecorded(e, entityId).snapshotId != net.imadz.common.Id.of(ApplyEventOracle.zeroUuid)
    }

  property("snapshot-amend: preserves identity and count") =
    forAll(snapshotRows, snapshotAmendedEvents) { (row, e) =>
      val next = snapshots.onSnapshotAmended(row, e)
      next.snapshotId == row.snapshotId && next.eventCount == row.eventCount &&
        next.totalAmount == row.totalAmount + e.delta
    }

  property("purity: repeated application with the same input is deterministic") =
    forAll(ledgerRows, reservedEvents) { (row, e) =>
      val once = ledger.onReserved(Some(row), e)
      ledger.onReserved(Some(row), e) == once
    }

  property("impl: the ledger empty row carries the ten business defaults") = secure {
    ledgerSem.emptyRow == StockLedgerView(net.imadz.common.Id.of(ApplyEventOracle.zeroUuid),
      "", 0, false, 0L, Nil, None, None, "", "")
  }

  property("impl: the snapshot empty row threads entityId into identity and the tenant param") =
    forAll(entityIds, labels) { (entityId, tenant) =>
      snapshotSem.emptyRow(entityId, tenant) ==
        StockLedgerSnapshotView(net.imadz.common.Id.of(entityId), tenant, 0, 0, false, None)
    }

  property("impl: negative: the snapshot identity never falls back to the zero uuid") =
    forAll(entityIds) { entityId =>
      snapshotSem.emptyRow(entityId, "t").snapshotId != net.imadz.common.Id.of(ApplyEventOracle.zeroUuid)
    }

  property("impl: stamped passes normal timestamps through unchanged") =
    forAll(instants) { i =>
      ledgerSem.stamped(i) == Some(i) && snapshotSem.stamped(i) == Some(i)
    }

  property("impl: negative: epoch-zero and null normalize to the named untimestamped default") = secure {
    ledgerSem.stamped(Instant.EPOCH).get.toEpochMilli != 0L &&
      ledgerSem.stamped(null).get.toEpochMilli != 0L &&
      snapshotSem.stamped(Instant.EPOCH).get.toEpochMilli != 0L
  }

  property("impl: text defaults null to empty and passes normal text") =
    forAll(labels) { s =>
      ledgerSem.text(s) == s && ledgerSem.text(null) == ""
    }

  property("assembly: the module binds each semantics face to its handwritten impl") = secure {
    ledgerSem.isInstanceOf[StockLedgerApplyEventSemanticsImpl] &&
      snapshotSem.isInstanceOf[StockLedgerSnapshotApplyEventSemanticsImpl]
  }
}
