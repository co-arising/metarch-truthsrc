package example.counter.infrastructure.serialization

import example.counter.domain.CounterProtocol.CountSet
import example.counter.domain.CounterState
import example.counter.domain.values._
import example.counter.{protobuf => pb}

object DomainConverters {
  private def required[A](value: Option[A], path: String): A =
    value.getOrElse(throw new IllegalArgumentException("missing required message: " + path))

  def encodeRatio(value: Ratio): pb.RatioValue =
    pb.RatioValue(f0 = ExactValueCodecs.RatioCodec.toWire(value).value)

  def decodeRatio(value: pb.RatioValue): Ratio =
    ExactValueCodecs.RatioCodec.fromWire(WireRatio(value.f0))

  def encodeDistance(value: Distance): pb.DistanceValue = {
    val wire = ExactValueCodecs.DistanceCodec.toWire(value)
    pb.DistanceValue(f0 = wire.wAmount, f1 = wire.wUnit)
  }

  def decodeDistance(value: pb.DistanceValue): Distance =
    ExactValueCodecs.DistanceCodec.fromWire(WireDistance(value.f0, value.f1))

  def encodeWireRatio(value: WireRatio): pb.WireRatioValue =
    pb.WireRatioValue(f0 = value.value)

  def decodeWireRatio(value: pb.WireRatioValue): WireRatio =
    WireRatio(value.f0)

  def encodePoRatio(value: PoRatio): pb.PoRatioValue =
    pb.PoRatioValue(f0 = value.value)

  def decodePoRatio(value: pb.PoRatioValue): PoRatio =
    PoRatio(value.f0)

  def encodeWireDistance(value: WireDistance): pb.WireDistanceValue =
    pb.WireDistanceValue(f0 = value.wAmount, f1 = value.wUnit)

  def decodeWireDistance(value: pb.WireDistanceValue): WireDistance =
    WireDistance(wAmount = value.f0, wUnit = value.f1)

  def encodePoDistance(value: PoDistance): pb.PoDistanceValue =
    pb.PoDistanceValue(f0 = value.pAmount, f1 = value.pUnit)

  def decodePoDistance(value: pb.PoDistanceValue): PoDistance =
    PoDistance(pAmount = value.f0, pUnit = value.f1)

  private def encodeReadingValueField4Value(value: Option[String]): pb.ReadingValueField4Value =
    value match {
      case Some(text) => pb.ReadingValueField4Value(present = true, f0 = text)
      case None => pb.ReadingValueField4Value(present = false)
    }

  private def decodeReadingValueField4Value(value: pb.ReadingValueField4Value): Option[String] = {
    if (value.present) Some(value.f0)
    else {
      require(value.f0.isEmpty, "absent optional carries a value: ReadingValueField4Value")
      None
    }
  }

  private def encodeReadingValueField4(value: Option[Option[String]]): pb.ReadingValueField4 =
    value match {
      case Some(inner) => pb.ReadingValueField4(present = true, f0 = Some(encodeReadingValueField4Value(inner)))
      case None => pb.ReadingValueField4(present = false)
    }

  private def decodeReadingValueField4(value: pb.ReadingValueField4): Option[Option[String]] = {
    if (value.present) Some(decodeReadingValueField4Value(required(value.f0, "ReadingValueField4.f0")))
    else {
      require(value.f0.isEmpty, "absent optional carries a value: ReadingValueField4")
      None
    }
  }

  private def encodeReadingValueField5Element(value: Option[Long]): pb.ReadingValueField5Element =
    value match {
      case Some(number) => pb.ReadingValueField5Element(present = true, f0 = number)
      case None => pb.ReadingValueField5Element(present = false)
    }

  private def decodeReadingValueField5Element(value: pb.ReadingValueField5Element): Option[Long] = {
    if (value.present) Some(value.f0)
    else {
      require(value.f0 == 0L, "absent optional carries a value: ReadingValueField5Element")
      None
    }
  }

  private def encodeReadingValueField5(value: Vector[Option[Long]]): pb.ReadingValueField5 =
    pb.ReadingValueField5(present = true, f0 = value.map(encodeReadingValueField5Element))

  private def decodeReadingValueField5(value: pb.ReadingValueField5): Vector[Option[Long]] = {
    require(value.present, "required sequence is absent: ReadingValueField5")
    value.f0.map(decodeReadingValueField5Element).toVector
  }

  private def encodeReadingValueField6Entry(key: String, value: Ratio): pb.ReadingValueField6Entry =
    pb.ReadingValueField6Entry(f0 = key, f1 = Some(encodeRatio(value)))

  private def decodeReadingValueField6Entry(value: pb.ReadingValueField6Entry): (String, Ratio) =
    value.f0 -> decodeRatio(required(value.f1, "ReadingValueField6Entry.f1"))

  private def encodeReadingValueField6(value: Map[String, Ratio]): pb.ReadingValueField6 =
    pb.ReadingValueField6(present = true, f0 = value.toVector.sortBy(_._1).map {
      case (key, ratio) => encodeReadingValueField6Entry(key, ratio)
    })

  private def decodeReadingValueField6(value: pb.ReadingValueField6): Map[String, Ratio] = {
    require(value.present, "required map is absent: ReadingValueField6")
    val entries = value.f0.map(decodeReadingValueField6Entry)
    require(entries.map(_._1).distinct.size == entries.size, "duplicate map key: ReadingValueField6")
    entries.toMap
  }

  def encodeReading(value: Reading): pb.ReadingValue =
    pb.ReadingValue(
      f0 = value.label,
      f1 = value.note,
      f2 = Some(encodeRatio(value.ratio)),
      f3 = Some(encodeDistance(value.distance)),
      f4 = Some(encodeReadingValueField4(value.maybe)),
      f5 = Some(encodeReadingValueField5(value.samples)),
      f6 = Some(encodeReadingValueField6(value.ratios))
    )

  def decodeReading(value: pb.ReadingValue): Reading =
    Reading(
      label = value.f0,
      note = value.f1,
      ratio = decodeRatio(required(value.f2, "ReadingValue.f2")),
      distance = decodeDistance(required(value.f3, "ReadingValue.f3")),
      maybe = decodeReadingValueField4(required(value.f4, "ReadingValue.f4")),
      samples = decodeReadingValueField5(required(value.f5, "ReadingValue.f5")),
      ratios = decodeReadingValueField6(required(value.f6, "ReadingValue.f6"))
    )

  def encodeCounterState(value: CounterState): pb.CounterSnapshot =
    pb.CounterSnapshot(
      f0 = value.id,
      f1 = value.count,
      f2 = value.minimum,
      f3 = value.maximum,
      f4 = Some(encodeReading(value.reading)),
      f5 = Some(encodeRatio(value.accepted))
    )

  def decodeCounterState(value: pb.CounterSnapshot): CounterState =
    CounterState(
      id = value.f0,
      count = value.f1,
      minimum = value.f2,
      maximum = value.f3,
      reading = decodeReading(required(value.f4, "CounterSnapshot.f4")),
      accepted = decodeRatio(required(value.f5, "CounterSnapshot.f5"))
    )

  def encodeCounterCountSet(value: CountSet): pb.CounterCountSet =
    pb.CounterCountSet(
      f0 = value.id,
      f1 = value.count,
      f2 = Some(encodeReading(value.reading)),
      f3 = Some(encodeRatio(value.accepted))
    )

  def decodeCounterCountSet(value: pb.CounterCountSet): CountSet =
    CountSet(
      id = value.f0,
      count = value.f1,
      reading = decodeReading(required(value.f2, "CounterCountSet.f2")),
      accepted = decodeRatio(required(value.f3, "CounterCountSet.f3"))
    )
}
