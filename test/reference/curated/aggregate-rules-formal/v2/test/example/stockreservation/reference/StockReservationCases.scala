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

  private def quantitiesGen(branch: ReserveBranch): Gen[Long] = branch match {
    case NonPositive | SeveralFailures => nonPositiveGen
    case _ => positiveGen
  }

  private def locationsGen(branch: ReserveBranch): Gen[LocationsMode] = branch match {
    case MissingLocation | SeveralFailures | DuplicateWithMissingLocation => Gen.oneOf(MissingFirst, MissingLast)
    case _ => Gen.oneOf(NoLocations, DistinctLocations, RepeatedLocations)
  }

  private final case class PayloadChoice(notes: NotesMode, locations: LocationsMode, opaque: Boolean, count: Int)
  private def payloadGen(branch: ReserveBranch, notes: Option[NotesMode], locations: Option[LocationsMode],
      opaqueNotes: Option[Boolean]): Gen[PayloadChoice] =
    for {
      notesMode <- notes.map(Gen.const(_)).getOrElse(Gen.oneOf(NoNotes, EmptyNotes, NestedNotes))
      locationsMode <- locations.map(Gen.const(_)).getOrElse(locationsGen(branch))
      opaque <- opaqueNotes.map(Gen.const(_)).getOrElse(Gen.oneOf(true, false))
      noteCount <- Gen.choose(0, 5)
    } yield PayloadChoice(notesMode, locationsMode, opaque, noteCount)

  private final case class QuantityChoice(quantity: Long, available: Long)
  private def quantityGen(branch: ReserveBranch, exactStock: Boolean): Gen[QuantityChoice] =
    for {
      quantity <- quantitiesGen(branch)
      available <- stockGen(branch, quantity, exactStock)
    } yield QuantityChoice(quantity, available)

  private final case class ContextChoice(suffix: String, note: String, history: Int)
  private def contextGen(history: Option[Int]): Gen[ContextChoice] =
    for {
      suffix <- suffixGen
      text <- noteGen
      historyCount <- history.map(Gen.const(_)).getOrElse(Gen.oneOf(0, 1, 2, 4))
    } yield ContextChoice(suffix, text, historyCount)

  def reserveGen(
      branch: ReserveBranch,
      notes: Option[NotesMode] = None,
      locations: Option[LocationsMode] = None,
      exactStock: Boolean = false,
      history: Option[Int] = None,
      opaqueNotes: Option[Boolean] = None
  ): Gen[ReserveCase] =
    for {
      quantity <- quantityGen(branch, exactStock)
      payload <- payloadGen(branch, notes, locations, opaqueNotes)
      context <- contextGen(history)
    } yield ReserveCase(
      branch, quantity.quantity, quantity.available, payload.notes, payload.locations,
      context.suffix, context.note, context.history, payload.opaque, payload.count
    )

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

  private def earlierGuardsPass(sample: ReserveCase): Boolean =
    sample.params.quantity > 0L && !sample.state.reservations.contains(sample.requestId) &&
      (sample.params.locations.toSet -- sample.state.registeredLocations).isEmpty

  private def quantityMargin(sample: ReserveCase): Option[BigInt] =
    sample.state.available.get(sample.sku).map(stock => BigInt(stock) - BigInt(sample.quantity))

  private def firstGuardPremise(sample: ReserveCase): Boolean = sample.branch match {
    case NonPositive => sample.quantity <= 0L
    case SeveralFailures => sample.quantity <= 0L && duplicateMissing(sample)
    case _ => false
  }

  private def duplicateMissing(sample: ReserveCase): Boolean =
    sample.state.reservations.contains(sample.requestId) &&
      (sample.params.locations.toSet -- sample.state.registeredLocations).nonEmpty

  private def positiveDuplicate(sample: ReserveCase): Boolean =
    sample.quantity > 0L && sample.state.reservations.contains(sample.requestId)

  private def positiveMissingLocation(sample: ReserveCase): Boolean =
    sample.quantity > 0L && !sample.state.reservations.contains(sample.requestId) &&
      (sample.params.locations.toSet -- sample.state.registeredLocations).nonEmpty

  private def reservationGuardPremise(sample: ReserveCase): Boolean = sample.branch match {
    case DuplicateRequest => positiveDuplicate(sample)
    case DuplicateWithMissingLocation => sample.quantity > 0L && duplicateMissing(sample)
    case MissingLocation => positiveMissingLocation(sample)
    case _ => false
  }

  private def stockGuardPremise(sample: ReserveCase): Boolean = {
    val margin = quantityMargin(sample)
    val branchMatches = sample.branch match {
      case ShortStock => margin.exists(_ < 0)
      case MissingSku => margin.isEmpty
      case CanReserve => margin.exists(_ >= 0)
      case _ => false
    }
    earlierGuardsPass(sample) && branchMatches
  }

  private def legalSnapshot(sample: ReserveCase): Boolean =
    sample.state.available.values.forall(_ >= 0L) &&
      sample.state.confirmedRequests.subsetOf(sample.state.reservations.keySet) &&
      sample.historyCount >= 0 && sample.noteCount >= 0

  def reservePremise(sample: ReserveCase): Boolean =
    legalSnapshot(sample) && (firstGuardPremise(sample) || reservationGuardPremise(sample) || stockGuardPremise(sample))

  private def identityPremise(branch: ConfirmBranch, existing: Boolean, matches: Boolean): Boolean = branch match {
    case MissingReservation => !existing
    case WrongIdentity | WrongIdentityAlreadyConfirmed => existing && !matches
    case AlreadyConfirmed | CanConfirm => matches
  }

  private def confirmationPremise(branch: ConfirmBranch, confirmed: Boolean): Boolean = branch match {
    case WrongIdentityAlreadyConfirmed | AlreadyConfirmed => confirmed
    case _ => !confirmed
  }

  def confirmPremise(sample: ConfirmCase): Boolean = {
    val existing = sample.state.reservations.get(sample.requestId)
    val matches = existing.exists(_.reservationId == sample.params.reservationId)
    val confirmed = sample.state.confirmedRequests.contains(sample.requestId)
    identityPremise(sample.branch, existing.nonEmpty, matches) && confirmationPremise(sample.branch, confirmed)
  }
}
