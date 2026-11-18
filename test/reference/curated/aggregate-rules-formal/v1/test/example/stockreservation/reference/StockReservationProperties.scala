package example.stockreservation.reference

import org.scalacheck.{Gen, Prop, Properties}
import org.scalacheck.Prop.{collect, forAll}

import net.imadz.common.CommonTypes.iMadzError

import example.stockreservation.domain.entities.StockReservationEntity._
import example.stockreservation.domain.invariant.StockReservationRules._
import example.stockreservation.domain.services.{LengthPrefixedReservationIdentity, ReservationIdentity}
import example.stockreservation.domain.values._
import example.stockreservation.reference.StockReservationCases._
import example.stockreservation.reference.StockReservationOracle._

object StockReservationProperties extends Properties("aggregate-rules-formal.stock-reservation.v1") {
  property("reserve: mixed cases have exact outcomes, payloads, order and dependency calls") =
    forAll(anyReserve) { sample =>
      collect((sample.branch.toString, sample.notesMode.toString, sample.locationsMode.toString)) {
        Prop(reserveMatches(sample, ProductionReserve))
      }
    }

  reserveBranches.foreach { branch =>
    property(s"reserve: directed $branch") = forAll(reserveGen(branch)) { sample =>
      reserveMatches(sample, ProductionReserve)
    }
  }

  confirmBranches.foreach { branch =>
    property(s"confirm: directed $branch") = forAll(confirmGen(branch)) { sample => confirmMatches(sample) }
  }

  Vector[NotesMode](NoNotes, EmptyNotes, NestedNotes).foreach { notes =>
    property(s"payload: directed $notes") = forAll(reserveGen(CanReserve, notes = Some(notes))) { sample =>
      reserveMatches(sample, ProductionReserve)
    }
  }

  Vector[LocationsMode](NoLocations, DistinctLocations, RepeatedLocations).foreach { locations =>
    property(s"coverage: directed $locations") =
      forAll(reserveGen(CanReserve, locations = Some(locations))) { sample =>
        reserveMatches(sample, ProductionReserve)
      }
  }

  property("payload: unregistered opaque note keys are not filtered") =
    forAll(reserveGen(CanReserve, notes = Some(NestedNotes), opaqueNotes = Some(true))) { sample =>
      reserveMatches(sample, ProductionReserve)
    }

  Vector(0, 1, 4).foreach { history =>
    property(s"state: successful reservation with $history unrelated historical records") =
      forAll(reserveGen(CanReserve, history = Some(history))) { sample => reserveMatches(sample, ProductionReserve) }
  }

  property("stock: exactly sufficient admits rather than requiring surplus") =
    forAll(reserveGen(CanReserve, exactStock = true)) { sample => reserveMatches(sample, ProductionReserve) }

  property("compute: throwing dependency propagates the very same exception after one call") =
    forAll(reserveGen(CanReserve)) { sample => exceptionMatches(sample, ProductionReserve) }

  property("compute: rejecting branches never evaluate even a throwing dependency") =
    forAll(Gen.oneOf(reserveBranches.filterNot(_ == CanReserve)).flatMap(branch => reserveGen(branch))) { sample =>
      val observed = observeReserve(sample, ProductionReserve, Some(new IllegalStateException("must not run")))
      observed.outcome == Returned(expectedReserve(sample)) && observed.calls.isEmpty && observed.stateUnchanged
    }

  property("pure: repeated decisions return identical values without changing the snapshot") =
    forAll(anyReserve) { sample =>
      val first = observeReserve(sample, ProductionReserve)
      val second = observeReserve(sample, ProductionReserve)
      first == second && first.stateUnchanged && reserveMatches(sample, ProductionReserve)
    }

  property("confirm: reference projection makes a correct repeated confirmation empty") =
    forAll(reserveGen(CanReserve)) { sample =>
      val original = sample.state.copy()
      val observed = observeReserve(sample, ProductionReserve)
      observed.outcome match {
        case Returned(Right(events)) if expectedReserve(sample) == Right(events) =>
          val reserved = project(sample.state, events)
          val params = ConfirmReservationParams(sample.requestId, sentinelId)
          val expected = List(ReservationConfirmed(sample.requestId, sentinelId))
          val result = ConfirmReservationRule(reserved, params)
          val confirmed = project(reserved, expected)
          val wrong = params.copy(reservationId = ReservationId("wrong-after-confirm"))
          result == Right(expected) && ConfirmReservationRule(confirmed, params) == Right(Nil) &&
            ConfirmReservationRule(confirmed, wrong).left.map(e => ErrorRecord(e.code, e.message)) ==
              Left(ErrorRecord(
                "STOCK_RESERVATION_ID_MISMATCH", "The reservation identity does not match the request."
              )) &&
            confirmed.reservations == reserved.reservations && sample.state == original
        case _ => false
      }
    }

  property("shrinker: reserve preserves premise, branch, categories and a strictly decreasing measure") =
    forAll(anyReserve) { sample =>
      reservePremise(sample) && shrinkReserve.shrink(sample).forall { smaller =>
        reservePremise(smaller) && smaller.branch == sample.branch &&
          smaller.notesMode == sample.notesMode && smaller.locationsMode == sample.locationsMode &&
          smaller.opaqueNoteKey == sample.opaqueNoteKey &&
          countCategory(smaller.historyCount) == countCategory(sample.historyCount) &&
          countCategory(smaller.noteCount) == countCategory(sample.noteCount) &&
          smaller.measure < sample.measure &&
          (sample.branch != CanReserve ||
            (smaller.availableQuantity == smaller.quantity) == (sample.availableQuantity == sample.quantity))
      }
    }

  property("shrinker: confirm keeps the missing, mismatching or confirmed relation") =
    forAll(anyConfirm) { sample =>
      confirmPremise(sample) && shrinkConfirm.shrink(sample).forall { smaller =>
        confirmPremise(smaller) && smaller.branch == sample.branch && smaller.measure < sample.measure &&
          countCategory(smaller.historyCount) == countCategory(sample.historyCount)
      }
    }

  private def boundary(branch: ReserveBranch, quantity: Long, stock: Long): ReserveCase =
    ReserveCase(branch, quantity, stock, NestedNotes, RepeatedLocations, "edge", "边界\n\"\\")

  property("boundaries: signed Long endpoints, exact stock and short by one") = Prop.secure {
    val rejected = Vector(Long.MinValue, -1L, 0L).map(quantity => boundary(NonPositive, quantity, 0L))
    val admitted = Vector(1L, Long.MaxValue).map(quantity => boundary(CanReserve, quantity, quantity))
    val insufficient = boundary(ShortStock, Long.MaxValue, Long.MaxValue - 1L)
    (rejected ++ admitted :+ insufficient).forall(sample => reserveMatches(sample, ProductionReserve))
  }

  property("boundaries: absence at either end, empty and repeated collection semantics") = Prop.secure {
    Vector(MissingFirst, MissingLast).forall { mode =>
      val sample = ReserveCase(MissingLocation, 1L, 1L, EmptyNotes, mode, "edge", "")
      reserveMatches(sample, ProductionReserve)
    } && Vector(NoLocations, RepeatedLocations).forall { mode =>
      val sample = ReserveCase(CanReserve, 1L, 1L, NoNotes, mode, "edge", "")
      reserveMatches(sample, ProductionReserve)
    }
  }

  property("identity: fixed independent encoding vector") = Prop.secure {
    LengthPrefixedReservationIdentity.reservationId(WarehouseId("WH"), RequestId("RQ"), SkuId("SK"), 17L) ==
      ReservationId("stock-reservation:v1|2:WH|2:RQ|2:SK|2:17")
  }

  // Independent decoder checks framing and field order rather than calling the encoder for expected bytes.
  private def decodeIdentity(value: String): Option[Vector[String]] = {
    def segment(text: String): Option[String] = text.split(":", 2).toList match {
      case size :: data :: Nil if size.forall(_.isDigit) && size.nonEmpty && size.length <= 3 =>
        if (size.toInt == data.length) Some(data) else None
      case _ => None
    }
    val parts = value.split("\\|", -1).toVector
    if (parts.headOption.contains("stock-reservation:v1") && parts.size == 5) {
      val decoded = parts.tail.map(segment)
      if (decoded.forall(_.nonEmpty)) Some(decoded.flatten) else None
    } else None
  }

  property("identity: deterministic reversible framing including maximum ID lengths") =
    forAll(reserveGen(CanReserve)) { sample =>
      val actual = LengthPrefixedReservationIdentity.reservationId(
        sample.warehouseId, sample.requestId, sample.sku, sample.quantity
      )
      decodeIdentity(actual.value).contains(Vector(
        sample.warehouseId.value, sample.requestId.value, sample.sku.value, sample.quantity.toString
      )) && actual == LengthPrefixedReservationIdentity.reservationId(
        sample.warehouseId, sample.requestId, sample.sku, sample.quantity
      )
    }

  property("identity: adjacent argument boundaries cannot collide") = Prop.secure {
    val left = LengthPrefixedReservationIdentity.reservationId(WarehouseId("ab"), RequestId("c"), SkuId("d"), 1L)
    val right = LengthPrefixedReservationIdentity.reservationId(WarehouseId("a"), RequestId("bc"), SkuId("d"), 1L)
    val longest = "a" * 64
    val maximum = LengthPrefixedReservationIdentity.reservationId(
      WarehouseId(longest), RequestId(longest), SkuId(longest), Long.MaxValue
    )
    left != right && decodeIdentity(maximum.value).contains(Vector(longest, longest, longest, Long.MaxValue.toString))
  }

  property("identity: full legal identifier alphabet and independent argument order") =
    forAll(identityGen) { sample =>
      val actual = LengthPrefixedReservationIdentity.reservationId(
        sample.warehouseId, sample.requestId, sample.sku, sample.quantity
      )
      decodeIdentity(actual.value).contains(Vector(
        sample.warehouseId.value, sample.requestId.value, sample.sku.value, sample.quantity.toString
      ))
    }

  property("shrinker: identity retains nominal nonempty IDs and strict decrease") =
    forAll(identityGen) { sample =>
      shrinkIdentity.shrink(sample).forall { smaller =>
        Vector(smaller.warehouseId.value, smaller.requestId.value, smaller.sku.value).forall { value =>
          value.nonEmpty && value.length <= 64 &&
            value.forall(c => c.isLetterOrDigit && c <= 127 || c == '.' || c == '_' || c == '-')
        } && smaller.measure < sample.measure
      }
    }

  property("payload: maximum-length special notes and a completely fresh snapshot") = Prop.secure {
    val sample = ReserveCase(
      CanReserve, 1L, 1L, NestedNotes, DistinctLocations, "fresh", "中\n\"\\" * 64,
      historyCount = 0, opaqueNoteKey = true, noteCount = 3
    )
    sample.state.reservations.isEmpty && sample.state.confirmedRequests.isEmpty &&
      reserveMatches(sample, ProductionReserve)
  }

  // Test-only typed faulty alternatives. No production file is changed or source text rewritten.
  private object DropSecondEvent extends ReserveDecision {
    def apply(s: StockReservationState, p: ReserveUnitsParams, i: ReservationIdentity) =
      ProductionReserve(s, p, i).map(_.take(1))
  }
  private object ReverseEvents extends ReserveDecision {
    def apply(s: StockReservationState, p: ReserveUnitsParams, i: ReservationIdentity) =
      ProductionReserve(s, p, i).map(_.reverse)
  }
  private object EagerIdentity extends ReserveDecision {
    def apply(s: StockReservationState, p: ReserveUnitsParams, i: ReservationIdentity) = {
      i.reservationId(s.warehouseId, p.requestId, p.sku, p.quantity)
      ProductionReserve(s, p, i)
    }
  }
  private object DoubleIdentity extends ReserveDecision {
    def apply(s: StockReservationState, p: ReserveUnitsParams, i: ReservationIdentity) =
      ProductionReserve(s, p, i).map { events =>
        i.reservationId(s.warehouseId, p.requestId, p.sku, p.quantity)
        events
      }
  }
  private object SwallowException extends ReserveDecision {
    def apply(s: StockReservationState, p: ReserveUnitsParams, i: ReservationIdentity) =
      try ProductionReserve(s, p, i)
      catch { case _: IllegalStateException => Right(Nil) }
  }
  private object DuplicateFirst extends ReserveDecision {
    def apply(s: StockReservationState, p: ReserveUnitsParams, i: ReservationIdentity) =
      if (s.reservations.contains(p.requestId)) Left(ReservationRejection.RequestAlreadyReserved.toError)
      else ProductionReserve(s, p, i)
  }
  private object StrictStock extends ReserveDecision {
    def apply(s: StockReservationState, p: ReserveUnitsParams, i: ReservationIdentity) =
      if (s.available.get(p.sku).contains(p.quantity)) Left(ReservationRejection.StockUnavailable.toError)
      else ProductionReserve(s, p, i)
  }
  private object ExistsCoverage extends ReserveDecision {
    def apply(s: StockReservationState, p: ReserveUnitsParams, i: ReservationIdentity) =
      if (p.locations.isEmpty) Left(ReservationRejection.UnknownLocation.toError)
      else if (p.locations.exists(s.registeredLocations.contains)) {
        val admittedState = s.copy(registeredLocations = s.registeredLocations ++ p.locations)
        ProductionReserve(admittedState, p, i)
      } else ProductionReserve(s, p, i)
  }
  private object CollapseSomeEmpty extends ReserveDecision {
    def apply(s: StockReservationState, p: ReserveUnitsParams, i: ReservationIdentity) =
      ProductionReserve(s, p, i).map(_.map {
        case e: UnitsReserved if e.locationNotes.contains(Map.empty) => e.copy(locationNotes = None)
        case e => e
      })
  }
  private object LocationBeforeDuplicate extends ReserveDecision {
    def apply(s: StockReservationState, p: ReserveUnitsParams, i: ReservationIdentity) =
      if (p.quantity > 0L && !p.locations.forall(s.registeredLocations.contains))
        Left(ReservationRejection.UnknownLocation.toError)
      else ProductionReserve(s, p, i)
  }
  private object FilterOpaqueNotes extends ReserveDecision {
    def apply(s: StockReservationState, p: ReserveUnitsParams, i: ReservationIdentity) =
      ProductionReserve(s, p, i).map(_.map {
        case e: UnitsReserved => e.copy(locationNotes =
          e.locationNotes.map(_.filter { case (key, _) => s.registeredLocations.contains(key) }))
        case e => e
      })
  }
  private object RequireHistory extends ReserveDecision {
    def apply(s: StockReservationState, p: ReserveUnitsParams, i: ReservationIdentity) =
      if (s.reservations.isEmpty) Left(ReservationRejection.StockUnavailable.toError)
      else ProductionReserve(s, p, i)
  }
  private object ConfirmedFirst extends ConfirmDecision {
    def apply(s: StockReservationState, p: ConfirmReservationParams) =
      if (s.confirmedRequests.contains(p.requestId)) Right(Nil) else ProductionConfirm(s, p)
  }

  property("negative controls: full observation rejects each named defective alternative") = Prop.secure {
    val success = boundary(CanReserve, 1L, 1L)
    val rejected = boundary(NonPositive, 0L, 1L)
    val several = ReserveCase(SeveralFailures, 0L, 1L, NoNotes, MissingFirst, "edge", "")
    val empty = success.copy(locationsMode = NoLocations)
    val someEmpty = success.copy(notesMode = EmptyNotes)
    val wrongConfirmed = ConfirmCase(WrongIdentityAlreadyConfirmed, "edge")
    val duplicateMissing = ReserveCase(DuplicateWithMissingLocation, 1L, 1L, NoNotes, MissingFirst, "edge", "")
    val opaque = success.copy(opaqueNoteKey = true, noteCount = 2)
    val fresh = success.copy(historyCount = 0)
    !reserveMatches(success, DropSecondEvent) && !reserveMatches(success, ReverseEvents) &&
      !reserveMatches(rejected, EagerIdentity) && !reserveMatches(success, DoubleIdentity) &&
      !exceptionMatches(success, SwallowException) && !reserveMatches(several, DuplicateFirst) &&
      !reserveMatches(success, StrictStock) && !reserveMatches(empty, ExistsCoverage) &&
      !reserveMatches(someEmpty, CollapseSomeEmpty) && !confirmMatches(wrongConfirmed, ConfirmedFirst) &&
      !reserveMatches(duplicateMissing, LocationBeforeDuplicate) && !reserveMatches(opaque, FilterOpaqueNotes) &&
      !reserveMatches(fresh, RequireHistory)
  }
}
