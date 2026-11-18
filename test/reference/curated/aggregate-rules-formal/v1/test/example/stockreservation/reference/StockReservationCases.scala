package example.stockreservation.reference

import org.scalacheck.{Gen, Shrink}

import example.stockreservation.domain.entities.StockReservationEntity._
import example.stockreservation.domain.invariant.StockReservationRules._
import example.stockreservation.domain.values._

object StockReservationCases {
  sealed trait ReserveBranch
  case object NonPositive extends ReserveBranch
  case object SeveralFailures extends ReserveBranch
  case object DuplicateRequest extends ReserveBranch
  case object DuplicateWithMissingLocation extends ReserveBranch
  case object MissingLocation extends ReserveBranch
  case object ShortStock extends ReserveBranch
  case object MissingSku extends ReserveBranch
  case object CanReserve extends ReserveBranch

  sealed trait NotesMode
  case object NoNotes extends NotesMode
  case object EmptyNotes extends NotesMode
  case object NestedNotes extends NotesMode

  sealed trait LocationsMode
  case object NoLocations extends LocationsMode
  case object DistinctLocations extends LocationsMode
  case object RepeatedLocations extends LocationsMode
  case object MissingFirst extends LocationsMode
  case object MissingLast extends LocationsMode

  sealed trait ConfirmBranch
  case object MissingReservation extends ConfirmBranch
  case object WrongIdentity extends ConfirmBranch
  case object WrongIdentityAlreadyConfirmed extends ConfirmBranch
  case object AlreadyConfirmed extends ConfirmBranch
  case object CanConfirm extends ConfirmBranch

  // Recipes rebuild related IDs and snapshots together, including during shrinking.
  final case class ReserveCase(
      branch: ReserveBranch,
      quantity: Long,
      availableQuantity: Long,
      notesMode: NotesMode,
      locationsMode: LocationsMode,
      suffix: String,
      noteText: String,
      historyCount: Int = 1,
      opaqueNoteKey: Boolean = false,
      noteCount: Int = 2
  ) {
    val warehouseId: WarehouseId = WarehouseId("warehouse-" + suffix)
    val requestId: RequestId = RequestId("request-" + suffix)
    val sku: SkuId = SkuId("sku-" + suffix)
    val firstLocation: LocationId = LocationId("first-" + suffix)
    val secondLocation: LocationId = LocationId("second-" + suffix)
    val absentLocation: LocationId = LocationId("absent-" + suffix)
    val storedId: ReservationId = ReservationId("stored-" + suffix)

    val locations: Vector[LocationId] = locationsMode match {
      case NoLocations => Vector.empty
      case DistinctLocations => Vector(firstLocation, secondLocation)
      case RepeatedLocations => Vector(firstLocation, firstLocation, secondLocation)
      case MissingFirst => Vector(absentLocation, firstLocation)
      case MissingLast => Vector(firstLocation, absentLocation)
    }
    val locationNotes: Option[Map[LocationId, Vector[ReservationNote]]] = notesMode match {
      case NoNotes => None
      case EmptyNotes => Some(Map.empty)
      case NestedNotes => Some(Map(
        (if (opaqueNoteKey) absentLocation else firstLocation) ->
          Vector.fill(noteCount)(ReservationNote(noteText)),
        secondLocation -> Vector.empty
      ))
    }
    val params: ReserveUnitsParams = ReserveUnitsParams(requestId, sku, quantity, locations, locationNotes)
    private val history: Map[RequestId, StoredReservation] = (0 until historyCount).map { index =>
      RequestId(s"history-$index-$suffix") -> StoredReservation(
        ReservationId(s"historical-$index-$suffix"), SkuId(s"old-sku-$index-$suffix"),
        index.toLong + 1L, Vector(secondLocation), Some(Map(secondLocation -> Vector(ReservationNote("old"))))
      )
    }.toMap
    private val existing = StoredReservation(storedId, sku, 1L, Vector.empty, None)
    private val records = branch match {
      case DuplicateRequest | DuplicateWithMissingLocation | SeveralFailures => history.updated(requestId, existing)
      case _ => history
    }
    private val quantities = branch match {
      case MissingSku => Map(SkuId("other-sku-" + suffix) -> 7L)
      case _ => Map(SkuId("other-sku-" + suffix) -> 7L, sku -> availableQuantity)
    }
    val state: StockReservationState = StockReservationState(
      warehouseId, quantities, Set(firstLocation, secondLocation), records, history.keySet
    )

    def measure: BigInt =
      BigInt(quantity).abs + BigInt(availableQuantity) + suffix.length + noteText.length + historyCount + noteCount
  }

  final case class ConfirmCase(branch: ConfirmBranch, suffix: String, historyCount: Int = 1) {
    val warehouseId: WarehouseId = WarehouseId("warehouse-" + suffix)
    val requestId: RequestId = RequestId("request-" + suffix)
    val storedId: ReservationId = ReservationId("stored-" + suffix)
    val suppliedId: ReservationId = branch match {
      case WrongIdentity | WrongIdentityAlreadyConfirmed => ReservationId("different-" + suffix)
      case _ => storedId
    }
    private val stored = StoredReservation(storedId, SkuId("sku-" + suffix), 1L, Vector.empty, None)
    private val history = (0 until historyCount).map { index => RequestId(s"history-$index-$suffix") -> stored }.toMap
    private val records = branch match {
      case MissingReservation => history
      case _ => history.updated(requestId, stored)
    }
    private val confirmed = branch match {
      case AlreadyConfirmed | WrongIdentityAlreadyConfirmed => history.keySet + requestId
      case _ => history.keySet
    }
    val state: StockReservationState = StockReservationState(
      warehouseId, Map(SkuId("sku-" + suffix) -> 5L), Set.empty, records, confirmed
    )
    val params: ConfirmReservationParams = ConfirmReservationParams(requestId, suppliedId)
    def measure: Int = suffix.length + historyCount
  }

  val reserveBranches: Vector[ReserveBranch] = Vector(
    NonPositive, SeveralFailures, DuplicateRequest, DuplicateWithMissingLocation,
    MissingLocation, ShortStock, MissingSku, CanReserve
  )
  val confirmBranches: Vector[ConfirmBranch] = Vector(
    MissingReservation, WrongIdentity, WrongIdentityAlreadyConfirmed, AlreadyConfirmed, CanConfirm
  )

  private val identifierChar: Gen[Char] = Gen.oneOf(
    ('a' to 'z') ++ ('A' to 'Z') ++ ('0' to '9') ++ Vector('.', '_', '-')
  )
  val identifierGen: Gen[String] =
    Gen.choose(1, 64).flatMap(size => Gen.listOfN(size, identifierChar).map(_.mkString))
  private val suffixGen: Gen[String] =
    Gen.choose(1, 48).flatMap(size => Gen.listOfN(size, identifierChar).map(_.mkString))
  private val noteGen: Gen[String] = Gen.frequency(
    3 -> Gen.oneOf("", "\"quoted\"", "path\\segment", "第一行\n第二行", "🙂"),
    7 -> Gen.choose(0, 256).flatMap(size =>
      Gen.listOfN(size, Gen.oneOf(Vector('a', 'Z', '0', '中', '文', '"', '\\', '\n', '\t'))).map(_.mkString))
  )
  private val positiveGen: Gen[Long] = Gen.frequency(
    3 -> Gen.oneOf(1L, Long.MaxValue), 7 -> Gen.choose(1L, Long.MaxValue)
  )
  private val nonPositiveGen: Gen[Long] = Gen.frequency(
    3 -> Gen.oneOf(Long.MinValue, -1L, 0L), 7 -> Gen.choose(Long.MinValue, 0L)
  )

  def reserveGen(
      branch: ReserveBranch,
      notes: Option[NotesMode] = None,
      locations: Option[LocationsMode] = None,
      exactStock: Boolean = false,
      history: Option[Int] = None,
      opaqueNotes: Option[Boolean] = None
  ): Gen[ReserveCase] = {
    val quantities = branch match {
      case NonPositive | SeveralFailures => nonPositiveGen
      case _ => positiveGen
    }
    val locationChoices: Gen[LocationsMode] = branch match {
      case MissingLocation | SeveralFailures | DuplicateWithMissingLocation => Gen.oneOf(MissingFirst, MissingLast)
      case _ => Gen.oneOf(NoLocations, DistinctLocations, RepeatedLocations)
    }
    for {
      quantity <- quantities
      available <- stockGen(branch, quantity, exactStock)
      notesMode <- notes.map(Gen.const(_)).getOrElse(Gen.oneOf(NoNotes, EmptyNotes, NestedNotes))
      locationsMode <- locations.map(Gen.const(_)).getOrElse(locationChoices)
      suffix <- suffixGen
      text <- noteGen
      historyCount <- history.map(Gen.const(_)).getOrElse(Gen.oneOf(0, 1, 2, 4))
      opaque <- opaqueNotes.map(Gen.const(_)).getOrElse(Gen.oneOf(true, false))
      noteCount <- Gen.choose(0, 5)
    } yield ReserveCase(
      branch, quantity, available, notesMode, locationsMode, suffix, text, historyCount, opaque, noteCount
    )
  }

  private def stockGen(branch: ReserveBranch, quantity: Long, exact: Boolean): Gen[Long] = branch match {
    case ShortStock => Gen.choose(0L, quantity - 1L)
    case CanReserve if exact => Gen.const(quantity)
    case CanReserve => Gen.frequency(
      4 -> Gen.const(quantity),
      6 -> Gen.choose(quantity, Long.MaxValue)
    )
    case _ => Gen.choose(0L, Long.MaxValue)
  }

  val anyReserve: Gen[ReserveCase] = Gen.oneOf(reserveBranches).flatMap(branch => reserveGen(branch))
  def confirmGen(branch: ConfirmBranch): Gen[ConfirmCase] =
    for { suffix <- suffixGen; history <- Gen.oneOf(0, 1, 2, 4) } yield ConfirmCase(branch, suffix, history)
  val anyConfirm: Gen[ConfirmCase] = Gen.oneOf(confirmBranches).flatMap(confirmGen)

  final case class IdentityCase(warehouseId: WarehouseId, requestId: RequestId, sku: SkuId, quantity: Long) {
    def measure: BigInt = warehouseId.value.length + requestId.value.length + sku.value.length + BigInt(quantity).abs
  }

  val identityGen: Gen[IdentityCase] = for {
    warehouse <- identifierGen
    request <- identifierGen
    sku <- identifierGen
    quantity <- Gen.choose(Long.MinValue, Long.MaxValue)
  } yield IdentityCase(WarehouseId(warehouse), RequestId(request), SkuId(sku), quantity)

  implicit val shrinkIdentity: Shrink[IdentityCase] = Shrink { sample =>
    Vector(
      sample.copy(warehouseId = WarehouseId(sample.warehouseId.value.take(1))),
      sample.copy(requestId = RequestId(sample.requestId.value.take(1))),
      sample.copy(sku = SkuId(sample.sku.value.take(1))),
      sample.copy(quantity = 0L)
    ).distinct.filter(_.measure < sample.measure).toStream
  }

  def countCategory(count: Int): Int = if (count <= 1) count else 2

  implicit val shrinkReserve: Shrink[ReserveCase] = Shrink { sample =>
    val minimumQuantity = sample.branch match {
      case NonPositive | SeveralFailures => 0L
      case _ => 1L
    }
    val minimumStock = sample.branch match {
      case CanReserve => if (sample.availableQuantity == sample.quantity) 1L else 2L
      case _ => 0L
    }
    val candidates = Vector(
      sample.copy(quantity = minimumQuantity, availableQuantity = minimumStock),
      sample.copy(suffix = "x"),
      sample.copy(noteText = ""),
      sample.copy(historyCount = countCategory(sample.historyCount), noteCount = countCategory(sample.noteCount))
    )
    candidates.distinct.filter(_.measure < sample.measure).toStream
  }

  implicit val shrinkConfirm: Shrink[ConfirmCase] = Shrink { sample =>
    Vector(sample.copy(suffix = "x"), sample.copy(historyCount = countCategory(sample.historyCount)))
      .distinct.filter(_.measure < sample.measure).toStream
  }

  def reservePremise(sample: ReserveCase): Boolean = {
    val p = sample.params
    val state = sample.state
    val absent = !state.reservations.contains(p.requestId)
    val missingLocations = p.locations.toSet -- state.registeredLocations
    val margin = state.available.get(p.sku).map(stock => BigInt(stock) - BigInt(p.quantity))
    val legal = state.available.values.forall(_ >= 0L) &&
      state.confirmedRequests.subsetOf(state.reservations.keySet) && sample.historyCount >= 0 && sample.noteCount >= 0
    val premise = sample.branch match {
      case NonPositive => p.quantity <= 0L
      case SeveralFailures => p.quantity <= 0L && !absent && missingLocations.nonEmpty
      case DuplicateRequest => p.quantity > 0L && !absent
      case DuplicateWithMissingLocation => p.quantity > 0L && !absent && missingLocations.nonEmpty
      case MissingLocation => p.quantity > 0L && absent && missingLocations.nonEmpty
      case ShortStock => p.quantity > 0L && absent && missingLocations.isEmpty && margin.exists(_ < 0)
      case MissingSku => p.quantity > 0L && absent && missingLocations.isEmpty && margin.isEmpty
      case CanReserve => p.quantity > 0L && absent && missingLocations.isEmpty && margin.exists(_ >= 0)
    }
    legal && premise
  }

  def confirmPremise(sample: ConfirmCase): Boolean = {
    val existing = sample.state.reservations.get(sample.requestId)
    val matches = existing.exists(_.reservationId == sample.params.reservationId)
    val confirmed = sample.state.confirmedRequests.contains(sample.requestId)
    sample.branch match {
      case MissingReservation => existing.isEmpty
      case WrongIdentity => existing.nonEmpty && !matches && !confirmed
      case WrongIdentityAlreadyConfirmed => existing.nonEmpty && !matches && confirmed
      case AlreadyConfirmed => matches && confirmed
      case CanConfirm => matches && !confirmed
    }
  }
}
