package example.stockreservation.projections

import java.time.Instant

import org.scalacheck.Gen

import example.stockreservation.application.projection.repository.StockLedgerSnapshotTable.StockLedgerSnapshotView
import example.stockreservation.application.projection.repository.StockLedgerTable.StockLedgerView
import example.stockreservation.domain.entities.ReservationEntity._

/** 独立输入形状：事件与既有行的生成器——oracle 与性质共用的数据面。
  * 时间生成器排除 epoch0（epoch0→now 的路径由 directed negative 单独钉住）。 */
object ApplyEventCases {

  val zeroUuid: String = "00000000-0000-0000-0000-000000000000"

  val instants: Gen[Instant] =
    Gen.chooseNum(-400000000000L, 400000000000L).map(Instant.ofEpochMilli).filter(_ != Instant.EPOCH)

  val ids: Gen[java.util.UUID] = Gen.uuid

  val entityIds: Gen[String] = Gen.uuid.map(_.toString).filter(_ != zeroUuid)

  val labels: Gen[String] = Gen.chooseNum(0, 24).map(n => "label-" + n)

  val tags: Gen[String] = Gen.chooseNum(0, 24).map(n => "tag-" + n)

  val reservedEvents: Gen[Reserved] =
    Gen.zip(ids, labels, Gen.chooseNum(0, 9999), labels, instants)
      .map { case (skuId, label, quantity, tenantId, occurredAt) =>
        Reserved(skuId, label, quantity, tenantId, occurredAt)
      }

  val quantityAdjustedEvents: Gen[QuantityAdjusted] = for {
    delta <- Gen.chooseNum(-500, 500)
    occurredAt <- instants
  } yield QuantityAdjusted(delta, occurredAt)

  val tagUpsertedEvents: Gen[TagUpserted] = tags.map(TagUpserted)

  val cancellationEvents: Gen[ReservationCancelled] = ids.map(ReservationCancelled)

  val snapshotRecordedEvents: Gen[SnapshotRecorded] = for {
    tenantId <- labels
    totalAmount <- Gen.chooseNum(-1000000L, 1000000L)
    occurredAt <- instants
  } yield SnapshotRecorded(tenantId, totalAmount, occurredAt)

  val snapshotAmendedEvents: Gen[SnapshotAmended] = Gen.chooseNum(-10000L, 10000L).map(SnapshotAmended)

  val ledgerRows: Gen[StockLedgerView] =
    Gen.zip(ids, labels, Gen.chooseNum(0, 9999), Gen.frequency(1 -> true, 3 -> false),
      Gen.chooseNum(-1000000L, 1000000L), Gen.listOf(tags), Gen.option(instants), labels, labels)
      .map { case (skuId, label, quantity, reservedFlag, totalAmount, tagList, stamp, kind, tenantId) =>
        StockLedgerView(skuId, label, quantity, reservedFlag, totalAmount, tagList, stamp, kind, tenantId)
      }

  val snapshotRows: Gen[StockLedgerSnapshotView] =
    Gen.zip(ids, labels, Gen.chooseNum(-1000000L, 1000000L), Gen.chooseNum(0, 5000),
      Gen.frequency(1 -> true, 3 -> false), Gen.option(instants))
      .map { case (snapshotId, tenantId, totalAmount, eventCount, openFlag, stamp) =>
        StockLedgerSnapshotView(snapshotId, tenantId, totalAmount, eventCount, openFlag, stamp)
      }
}
