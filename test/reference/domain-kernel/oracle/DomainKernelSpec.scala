package example.counter.oracle

import java.math.{BigDecimal => JBigDecimal, MathContext, RoundingMode}

import org.scalatest.funsuite.AnyFunSuite

import example.counter.{protobuf => pb}
import example.counter.domain.{CounterProtocol, CounterState}
import example.counter.domain.invariant.params.CounterRuleParams
import example.counter.domain.ports.CounterComputations
import example.counter.domain.values._
import example.counter.infrastructure.serialization.DomainConverters._
import example.counter.infrastructure.serialization.ExactValueCodecs.{DistanceCodec, RatioCodec}

final class DomainKernelSpec extends AnyFunSuite {
  private val nines38 = "9" * 38
  private val overflow38 = "1" + ("0" * 38)
  private val quantumText = "0." + ("0" * 37) + "1"
  private val maximumRatioText = "0." + nines38
  private val labelSentinel = "left:中文:🧪"
  private val noteSentinel = "right:Ω:𝄞:" + 0.toChar + ""
  private val idSentinel = "counter:雪:🚀"

  private def decimal(text: String): BigDecimal =
    new BigDecimal(new JBigDecimal(text), MathContext.UNLIMITED)

  private def lowPrecisionDecimal(text: String): BigDecimal =
    new BigDecimal(new JBigDecimal(text), new MathContext(2, RoundingMode.HALF_UP))

  private def rejects(body: => Any): Unit = {
    // The contract does not prescribe an exception class or diagnostic wording.
    // AssertionError/NotImplementedError are deliberately not accepted as validation.
    intercept[RuntimeException] { body }
    ()
  }

  private def readingSentinel: Reading = Reading(
    label = labelSentinel,
    note = noteSentinel,
    ratio = Ratio(decimal("0.12345678901234567890123456789012345678")),
    distance = Distance(decimal("-12345678901234567890123456789012345678"), "km"),
    maybe = Some(Some("inner:🚀:" + 0.toChar + "")),
    samples = Vector(Some(Long.MinValue), None, Some(0L), Some(Long.MaxValue)),
    ratios = scala.collection.immutable.ListMap(
      "z" -> Ratio(decimal("0.25")),
      "🧪" -> Ratio(decimal("-0.5")),
      "a" -> Ratio(decimal(quantumText)),
      "Ω" -> Ratio(decimal(maximumRatioText))
    )
  )

  private def stateSentinel: CounterState = CounterState(
    id = idSentinel,
    count = -42L,
    minimum = Long.MinValue,
    maximum = Long.MaxValue,
    reading = readingSentinel,
    accepted = Ratio(decimal("0.87654321098765432109876543210987654321"))
  )

  private def eventSentinel: CounterProtocol.CountSet = CounterProtocol.CountSet(
    id = idSentinel,
    count = Long.MinValue,
    reading = readingSentinel,
    accepted = Ratio(decimal("-0.87654321098765432109876543210987654321"))
  )

  private def ratioThroughBytes(value: Ratio): Ratio =
    decodeRatio(pb.RatioValue.parseFrom(encodeRatio(value).toByteArray))

  private def distanceThroughBytes(value: Distance): Distance =
    decodeDistance(pb.DistanceValue.parseFrom(encodeDistance(value).toByteArray))

  private def readingThroughBytes(value: Reading): Reading =
    decodeReading(pb.ReadingValue.parseFrom(encodeReading(value).toByteArray))

  private def stateThroughBytes(value: CounterState): CounterState =
    decodeCounterState(pb.CounterSnapshot.parseFrom(encodeCounterState(value).toByteArray))

  private def eventThroughBytes(value: CounterProtocol.CountSet): CounterProtocol.CountSet =
    decodeCounterCountSet(pb.CounterCountSet.parseFrom(encodeCounterCountSet(value).toByteArray))

  private def rejectReading(message: pb.ReadingValue): Unit =
    rejects(decodeReading(pb.ReadingValue.parseFrom(message.toByteArray)))

  private def rejectState(message: pb.CounterSnapshot): Unit =
    rejects(decodeCounterState(pb.CounterSnapshot.parseFrom(message.toByteArray)))

  private def rejectEvent(message: pb.CounterCountSet): Unit =
    rejects(decodeCounterCountSet(pb.CounterCountSet.parseFrom(message.toByteArray)))

  test("every nominal value root survives actual protobuf bytes without field swaps") {
    val ratio = Ratio(decimal("-0.12345678901234567890123456789012345678"))
    val distance = Distance(decimal(nines38), "km")
    assert(ratioThroughBytes(ratio) == ratio)
    assert(distanceThroughBytes(distance) == distance)
    assert(encodeRatio(ratio).f0 == "-12345678901234567890123456789012345678")
    assert(encodeDistance(distance).f0 == nines38)
    assert(encodeDistance(distance).f1 == "km")

    // Wire/PO nominals are string records, not aliases for domain exact values.
    val wireRatio = WireRatio("wire-left:🧪")
    val poRatio = PoRatio("po-right:𝄞")
    val wireDistance = WireDistance("wire-amount:中", "wire-unit:🚀")
    val poDistance = PoDistance("po-amount:Ω", "po-unit:🧪")
    assert(decodeWireRatio(pb.WireRatioValue.parseFrom(encodeWireRatio(wireRatio).toByteArray)) == wireRatio)
    assert(decodePoRatio(pb.PoRatioValue.parseFrom(encodePoRatio(poRatio).toByteArray)) == poRatio)
    assert(decodeWireDistance(pb.WireDistanceValue.parseFrom(encodeWireDistance(wireDistance).toByteArray)) == wireDistance)
    assert(decodePoDistance(pb.PoDistanceValue.parseFrom(encodePoDistance(poDistance).toByteArray)) == poDistance)
    assert(encodeWireRatio(wireRatio).f0 == wireRatio.value)
    assert(encodePoRatio(poRatio).f0 == poRatio.value)
    assert(encodeWireDistance(wireDistance).f0 == wireDistance.wAmount)
    assert(encodeWireDistance(wireDistance).f1 == wireDistance.wUnit)
    assert(encodePoDistance(poDistance).f0 == poDistance.pAmount)
    assert(encodePoDistance(poDistance).f1 == poDistance.pUnit)

    val reading = readingSentinel
    val encoded = encodeReading(reading)
    assert(encoded.f0 == labelSentinel)
    assert(encoded.f1 == noteSentinel)
    assert(encoded.f2.contains(encodeRatio(reading.ratio)))
    assert(encoded.f3.contains(encodeDistance(reading.distance)))
    assert(readingThroughBytes(reading) == reading)
  }

  test("state and event bytes preserve independent same-type sentinels and Long extrema") {
    val state = stateSentinel
    val snapshot = encodeCounterState(state)
    assert(snapshot.f0 == idSentinel)
    assert(snapshot.f1 == -42L)
    assert(snapshot.f2 == Long.MinValue)
    assert(snapshot.f3 == Long.MaxValue)
    assert(snapshot.f4.contains(encodeReading(state.reading)))
    assert(snapshot.f5.contains(encodeRatio(state.accepted)))
    assert(stateThroughBytes(state) == state)

    val event = eventSentinel
    val encoded = encodeCounterCountSet(event)
    assert(encoded.f0 == idSentinel)
    assert(encoded.f1 == Long.MinValue)
    assert(encoded.f2.contains(encodeReading(event.reading)))
    assert(encoded.f3.contains(encodeRatio(event.accepted)))
    assert(eventThroughBytes(event) == event)
    assert(eventThroughBytes(event.copy(count = Long.MaxValue)) == event.copy(count = Long.MaxValue))
    assert(stateThroughBytes(state.copy(count = Long.MinValue)) == state.copy(count = Long.MinValue))
    assert(stateThroughBytes(state.copy(count = Long.MaxValue)) == state.copy(count = Long.MaxValue))
  }

  test("nested optional states including Some(None) and Some(Some(empty)) have distinct bytes") {
    val alternatives: Vector[Option[Option[String]]] = Vector(
      None,
      Some(None),
      Some(Some("")),
      Some(Some("中:🧪:" + 0.toChar + ""))
    )
    val encodings = alternatives.map { maybe =>
      val value = readingSentinel.copy(maybe = maybe, samples = Vector.empty, ratios = Map.empty)
      val encoded = encodeReading(value)
      assert(encoded.f4.nonEmpty)
      assert(encoded.f5.exists(wrapper => wrapper.present && wrapper.f0.isEmpty))
      assert(encoded.f6.exists(wrapper => wrapper.present && wrapper.f0.isEmpty))
      assert(readingThroughBytes(value) == value)
      encoded.toByteArray.toVector
    }
    assert(encodings.distinct.size == alternatives.size)

    val absent = encodeReading(readingSentinel.copy(maybe = None)).f4.get
    assert(!absent.present)
    assert(absent.f0.isEmpty)
    val someNone = encodeReading(readingSentinel.copy(maybe = Some(None))).f4.get
    assert(someNone.present)
    assert(someNone.f0.exists(inner => !inner.present && inner.f0.isEmpty))
    val someEmpty = encodeReading(readingSentinel.copy(maybe = Some(Some("")))).f4.get
    assert(someEmpty.present)
    assert(someEmpty.f0.exists(inner => inner.present && inner.f0.isEmpty))
  }

  test("optional sequence elements distinguish absent values from zero and preserve Long extrema") {
    val value = readingSentinel.copy(samples = Vector(None, Some(0L), Some(Long.MinValue), Some(Long.MaxValue)))
    val wrapper = encodeReading(value).f5.get
    assert(wrapper.present)
    assert(wrapper.f0.map(_.present).toVector == Vector(false, true, true, true))
    assert(wrapper.f0.map(_.f0).toVector == Vector(0L, 0L, Long.MinValue, Long.MaxValue))
    assert(readingThroughBytes(value) == value)
    assert(readingThroughBytes(value.copy(samples = Vector.empty)).samples.isEmpty)
  }

  test("map encoding sorts String keys and is independent of insertion order") {
    val first = readingSentinel
    val reverse = scala.collection.immutable.ListMap(first.ratios.toVector.reverse: _*)
    val second = first.copy(ratios = reverse)
    val encoded = encodeReading(first)
    assert(encoded.f6.get.present)
    assert(encoded.f6.get.f0.map(_.f0).toVector == first.ratios.keys.toVector.sorted)
    assert(encoded.toByteArray.toVector == encodeReading(second).toByteArray.toVector)
    assert(readingThroughBytes(first).ratios == first.ratios)
    val emptyKey = first.copy(ratios = Map("" -> Ratio(decimal("-0.25"))))
    assert(readingThroughBytes(emptyKey) == emptyKey)
    assert(readingThroughBytes(first.copy(ratios = Map.empty)).ratios.isEmpty)
  }

  test("decoders require every message-valued Reading child including empty-container wrappers") {
    val good = encodeReading(readingSentinel)
    val missing = Vector(
      good.copy(f2 = None),
      good.copy(f3 = None),
      good.copy(f4 = None),
      good.copy(f5 = None),
      good.copy(f6 = None)
    )
    missing.zipWithIndex.foreach { case (message, index) =>
      withClue(s"missing Reading child $index: ") { rejectReading(message) }
    }
    rejectReading(pb.ReadingValue())
    rejectReading(good.copy(f2 = Some(pb.RatioValue())))
    rejectReading(good.copy(f3 = Some(pb.DistanceValue())))
  }

  test("state and event decoders require reading and accepted messages at their own paths") {
    val state = encodeCounterState(stateSentinel)
    rejectState(state.copy(f4 = None))
    rejectState(state.copy(f5 = None))
    rejectState(state.copy(f4 = Some(pb.ReadingValue())))
    rejectState(state.copy(f5 = Some(pb.RatioValue())))
    rejectState(pb.CounterSnapshot())

    val event = encodeCounterCountSet(eventSentinel)
    rejectEvent(event.copy(f2 = None))
    rejectEvent(event.copy(f3 = None))
    rejectEvent(event.copy(f2 = Some(pb.ReadingValue())))
    rejectEvent(event.copy(f3 = Some(pb.RatioValue())))
    rejectEvent(pb.CounterCountSet())
  }

  test("optional presence rejects missing required inner nodes and carried absent payloads") {
    val good = encodeReading(readingSentinel)
    val absentInner = pb.ReadingValueField4Value(present = false, f0 = "")
    val carriedInner = pb.ReadingValueField4Value(present = true, f0 = "carried")
    val malformed = Vector(
      pb.ReadingValueField4(present = true, f0 = None),
      pb.ReadingValueField4(present = false, f0 = Some(absentInner)),
      pb.ReadingValueField4(present = false, f0 = Some(carriedInner)),
      pb.ReadingValueField4(
        present = true,
        f0 = Some(pb.ReadingValueField4Value(present = false, f0 = "carried"))
      )
    )
    malformed.zipWithIndex.foreach { case (wrapper, index) =>
      withClue(s"malformed optional $index: ") { rejectReading(good.copy(f4 = Some(wrapper))) }
    }
    val validNone = good.copy(f4 = Some(pb.ReadingValueField4(present = false, f0 = None)))
    assert(decodeReading(pb.ReadingValue.parseFrom(validNone.toByteArray)).maybe == None)
    val validSomeNone = good.copy(f4 = Some(pb.ReadingValueField4(present = true, f0 = Some(absentInner))))
    assert(decodeReading(pb.ReadingValue.parseFrom(validSomeNone.toByteArray)).maybe == Some(None))
  }

  test("required sequence and map wrappers reject false presence even with no entries") {
    val good = encodeReading(readingSentinel)
    rejectReading(good.copy(f5 = Some(pb.ReadingValueField5(present = false, f0 = Vector.empty))))
    rejectReading(good.copy(f5 = Some(good.f5.get.copy(present = false))))
    rejectReading(good.copy(f6 = Some(pb.ReadingValueField6(present = false, f0 = Vector.empty))))
    rejectReading(good.copy(f6 = Some(good.f6.get.copy(present = false))))
    val carriedAbsentElement = pb.ReadingValueField5Element(present = false, f0 = Long.MinValue)
    rejectReading(good.copy(f5 = Some(pb.ReadingValueField5(present = true, f0 = Vector(carriedAbsentElement)))))
    val validAbsentElement = pb.ReadingValueField5Element(present = false, f0 = 0L)
    val valid = good.copy(f5 = Some(pb.ReadingValueField5(present = true, f0 = Vector(validAbsentElement))))
    assert(decodeReading(pb.ReadingValue.parseFrom(valid.toByteArray)).samples == Vector(None))
  }

  test("map entries require nested values and reject duplicate keys before map collapse") {
    val good = encodeReading(readingSentinel)
    val firstRatio = encodeRatio(Ratio(decimal("0.25")))
    val secondRatio = encodeRatio(Ratio(decimal("-0.5")))
    val missing = pb.ReadingValueField6Entry(f0 = "required", f1 = None)
    rejectReading(good.copy(f6 = Some(pb.ReadingValueField6(present = true, f0 = Vector(missing)))))
    val invalid = pb.ReadingValueField6Entry(f0 = "invalid", f1 = Some(pb.RatioValue(f0 = "01")))
    rejectReading(good.copy(f6 = Some(pb.ReadingValueField6(present = true, f0 = Vector(invalid)))))

    Vector("duplicate", "", "中:🧪").foreach { key =>
      Vector(firstRatio, secondRatio).foreach { otherRatio =>
        val entries = Vector(
          pb.ReadingValueField6Entry(f0 = key, f1 = Some(firstRatio)),
          pb.ReadingValueField6Entry(f0 = key, f1 = Some(otherRatio))
        )
        withClue(s"duplicate key [$key]: ") {
          rejectReading(good.copy(f6 = Some(pb.ReadingValueField6(present = true, f0 = entries))))
        }
      }
    }
  }

  test("Ratio codecs use canonical p38 minor coefficients for wire and PO") {
    val cases = Vector(
      "0" -> "0",
      "1" -> quantumText,
      "-1" -> ("-" + quantumText),
      nines38 -> maximumRatioText,
      ("-" + nines38) -> ("-" + maximumRatioText)
    )
    cases.foreach { case (coefficient, text) =>
      val ratio = Ratio(decimal(text))
      assert(RatioCodec.toWire(ratio) == WireRatio(coefficient))
      assert(RatioCodec.toPo(ratio) == PoRatio(coefficient))
      assert(RatioCodec.fromWire(WireRatio(coefficient)) == ratio)
      assert(RatioCodec.fromPo(PoRatio(coefficient)) == ratio)
      assert(ratioThroughBytes(ratio) == ratio)
      assert(decodeRatio(pb.RatioValue.parseFrom(pb.RatioValue(f0 = coefficient).toByteArray)) == ratio)
    }
    assert(RatioCodec.toWire(Ratio(decimal("0.1250000"))) == WireRatio("125" + ("0" * 35)))
    assert(RatioCodec.toWire(Ratio(decimal("-0.000"))) == WireRatio("0"))
  }

  test("Distance codecs use canonical p38 scale-zero fixed text and preserve declared units") {
    Vector("m", "km").foreach { unit =>
      Vector("0", "1", "-1", nines38, "-" + nines38).foreach { text =>
        val distance = Distance(decimal(text), unit)
        assert(DistanceCodec.toWire(distance) == WireDistance(text, unit))
        assert(DistanceCodec.toPo(distance) == PoDistance(text, unit))
        assert(DistanceCodec.fromWire(WireDistance(text, unit)) == distance)
        assert(DistanceCodec.fromPo(PoDistance(text, unit)) == distance)
        assert(distanceThroughBytes(distance) == distance)
        assert(decodeDistance(pb.DistanceValue.parseFrom(pb.DistanceValue(f0 = text, f1 = unit).toByteArray)) == distance)
      }
    }
    assert(DistanceCodec.toWire(Distance(decimal("12.000"), "m")) == WireDistance("12", "m"))
    assert(DistanceCodec.toPo(Distance(decimal("-0.000"), "km")) == PoDistance("0", "km"))
  }

  test("minor parsing rejects noncanonical text and coefficients outside p38 on every input boundary") {
    val malformed = Vector(
      "", "+1", "-0", "00", "01", "-00", "-01", "0.0", "1.0", ".1", "1.",
      "1e0", "1E0", " 1", "1 ", "\t1", "1\n", "--1", "-", "+", "1_0", "1,0",
      "NaN", "Infinity", "١", "１", "" + 0.toChar + "1", "1" + 0.toChar + "", overflow38, "-" + overflow38
    )
    malformed.foreach { text =>
      withClue(s"minor text [$text]: ") {
        rejects(RatioCodec.fromWire(WireRatio(text)))
        rejects(RatioCodec.fromPo(PoRatio(text)))
        rejects(decodeRatio(pb.RatioValue.parseFrom(pb.RatioValue(f0 = text).toByteArray)))
      }
    }
  }

  test("fixed parsing rejects noncanonical scale-zero text and p38 overflow on every input boundary") {
    val malformed = Vector(
      "", "+1", "-0", "00", "01", "-00", "-01", "0.0", "1.0", "-1.0", "1.", ".1", "1.5",
      "1e0", "1E0", " 1", "1 ", "\t1", "1\n", "--1", "-", "+", "1_0", "1,000",
      "NaN", "Infinity", "١", "１", "" + 0.toChar + "1", "1" + 0.toChar + "", overflow38, "-" + overflow38
    )
    malformed.foreach { text =>
      withClue(s"fixed text [$text]: ") {
        rejects(DistanceCodec.fromWire(WireDistance(text, "m")))
        rejects(DistanceCodec.fromPo(PoDistance(text, "m")))
        rejects(decodeDistance(pb.DistanceValue.parseFrom(pb.DistanceValue(f0 = text, f1 = "m").toByteArray)))
      }
    }
  }

  test("unit admission is exact for constructors, copy, codecs and protobuf decoding") {
    Vector("", "M", "Km", "cm", " m", "m ", "km\n", "🧪").foreach { unit =>
      withClue(s"unit [$unit]: ") {
        rejects(Distance(decimal("1"), unit))
        rejects(Distance(decimal("1"), "m").copy(unit = unit))
        rejects(DistanceCodec.fromWire(WireDistance("1", unit)))
        rejects(DistanceCodec.fromPo(PoDistance("1", unit)))
        rejects(decodeDistance(pb.DistanceValue.parseFrom(pb.DistanceValue(f0 = "1", f1 = unit).toByteArray)))
      }
    }
  }

  test("constructors and copy validate both p38 endpoints without rounding") {
    val maxRatio = Ratio(decimal(maximumRatioText))
    val minRatio = Ratio(decimal("-" + maximumRatioText))
    assert(maxRatio.value == decimal(maximumRatioText))
    assert(minRatio.value == decimal("-" + maximumRatioText))
    assert(decimal(Ratio.checkedAmount(maxRatio.value).toString) == decimal(maximumRatioText))
    assert(decimal(Ratio.checkedAmount(minRatio.value).toString) == decimal("-" + maximumRatioText))
    Vector("1", "-1", quantumText + "1", "-" + quantumText + "1").foreach { text =>
      rejects(Ratio(decimal(text)))
      rejects(maxRatio.copy(value = decimal(text)))
    }
    val normalizedRatio = Ratio(decimal("0.1250000000000000000000000000000000000000"))
    assert(normalizedRatio.value == decimal("0.125"))
    assert(normalizedRatio.copy(value = decimal("0.25")) == Ratio(decimal("0.25")))

    val maxDistance = Distance(decimal(nines38), "m")
    val minDistance = Distance(decimal("-" + nines38), "km")
    assert(maxDistance.amount == decimal(nines38))
    assert(minDistance.amount == decimal("-" + nines38))
    assert(decimal(Distance.checkedAmount(maxDistance.amount).toString) == decimal(nines38))
    assert(decimal(Distance.checkedAmount(minDistance.amount).toString) == decimal("-" + nines38))
    Vector(overflow38, "-" + overflow38, "0.1", "-0.1").foreach { text =>
      rejects(Distance(decimal(text), "m"))
      rejects(maxDistance.copy(amount = decimal(text)))
    }
    assert(Distance(decimal("12.000"), "m").amount == decimal("12"))
    assert(maxDistance.copy(amount = decimal("-12"), unit = "km") == Distance(decimal("-12"), "km"))
  }

  test("positivity is strict and same-unit comparison uses exact values at p38 extrema") {
    assert(!Ratio(decimal("0")).isPositive)
    assert(!Ratio(decimal("-" + quantumText)).isPositive)
    assert(Ratio(decimal(quantumText)).isPositive)
    assert(!Distance(decimal("0"), "m").isPositive)
    assert(!Distance(decimal("-1"), "km").isPositive)
    assert(Distance(decimal("1"), "m").isPositive)
    Vector("m", "km").foreach { unit =>
      val min = Distance(decimal("-" + nines38), unit)
      val max = Distance(decimal(nines38), unit)
      assert(min.compareSameUnit(max) < 0)
      assert(max.compareSameUnit(min) > 0)
      assert(max.compareSameUnit(max.copy()) == 0)
      assert(Distance(decimal("12.000"), unit).compareSameUnit(Distance(decimal("12"), unit)) == 0)
    }
  }

  test("plus and minus are exact and reject result overflow at both p38 scale extrema") {
    val ratioMax = Ratio(decimal(maximumRatioText))
    val ratioMin = Ratio(decimal("-" + maximumRatioText))
    val quantum = Ratio(decimal(quantumText))
    assert(ratioMax.plus(ratioMin) == Ratio(decimal("0")))
    assert(ratioMax.minus(ratioMax) == Ratio(decimal("0")))
    assert(Ratio(decimal("0")).minus(quantum) == Ratio(decimal("-" + quantumText)))
    assert(ratioMax.minus(quantum) == Ratio(decimal("0." + ("9" * 37) + "8")))
    rejects(ratioMax.plus(quantum))
    rejects(ratioMin.minus(quantum))
    rejects(ratioMax.minus(ratioMin))
    rejects(ratioMin.plus(ratioMin))

    Vector("m", "km").foreach { unit =>
      val max = Distance(decimal(nines38), unit)
      val min = Distance(decimal("-" + nines38), unit)
      val one = Distance(decimal("1"), unit)
      assert(max.plus(min) == Distance(decimal("0"), unit))
      assert(max.minus(max) == Distance(decimal("0"), unit))
      assert(Distance(decimal("0"), unit).minus(one) == Distance(decimal("-1"), unit))
      assert(max.minus(one) == Distance(decimal(("9" * 37) + "8"), unit))
      rejects(max.plus(one))
      rejects(min.minus(one))
      rejects(max.minus(min))
      rejects(min.plus(min))
    }
  }

  test("arithmetic ignores low precision operand MathContext and never rounds intermediate results") {
    val ratioText = "0.12345678901234567890123456789012345678"
    val ratioInput = lowPrecisionDecimal(ratioText)
    assert(ratioInput.mc.getPrecision == 2)
    assert(ratioInput.bigDecimal.toPlainString == ratioText)
    val ratio = Ratio(ratioInput)
    val quantum = Ratio(lowPrecisionDecimal(quantumText))
    val expectedSum = Ratio(decimal("0.12345678901234567890123456789012345679"))
    val expectedDifference = Ratio(decimal("0.12345678901234567890123456789012345677"))
    assert(ratio.plus(quantum) == expectedSum)
    assert(quantum.plus(ratio) == expectedSum)
    assert(ratio.minus(quantum) == expectedDifference)
    assert(ratio.minus(ratio) == Ratio(decimal("0")))
    assert(RatioCodec.toWire(ratio) == WireRatio("12345678901234567890123456789012345678"))

    val distanceText = "12345678901234567890123456789012345678"
    val distanceInput = lowPrecisionDecimal(distanceText)
    assert(distanceInput.mc.getPrecision == 2)
    assert(distanceInput.bigDecimal.toPlainString == distanceText)
    val distance = Distance(distanceInput, "km")
    val one = Distance(lowPrecisionDecimal("1"), "km")
    val distanceSum = Distance(decimal("12345678901234567890123456789012345679"), "km")
    assert(distance.plus(one) == distanceSum)
    assert(one.plus(distance) == distanceSum)
    assert(distance.minus(one) == Distance(decimal("12345678901234567890123456789012345677"), "km"))
    assert(distance.minus(distance) == Distance(decimal("0"), "km"))
    assert(DistanceCodec.toWire(distance) == WireDistance(distanceText, "km"))
  }

  test("comparison and arithmetic reject unequal admitted units instead of converting them") {
    val metres = Distance(decimal("1000"), "m")
    val kilometres = Distance(decimal("1"), "km")
    rejects(metres.compareSameUnit(kilometres))
    rejects(kilometres.compareSameUnit(metres))
    rejects(metres.plus(kilometres))
    rejects(kilometres.plus(metres))
    rejects(metres.minus(kilometres))
    rejects(kilometres.minus(metres))
    rejects(Distance(decimal("0"), "m").plus(Distance(decimal("0"), "km")))
  }

  test("state constructor defaults and empty preserve authored nonzero values and nested presence") {
    val expectedReading = Reading(
      label = "left-default",
      note = "right-default",
      ratio = Ratio(decimal("0.12500000000000000000000000000000000000")),
      distance = Distance(decimal("-12"), "m"),
      maybe = Some(None),
      samples = Vector(Some(Long.MinValue), None, Some(Long.MaxValue)),
      ratios = Map("base" -> Ratio(decimal("0.50000000000000000000000000000000000000")))
    )
    val expected = CounterState(
      id = "counter-default",
      count = -7L,
      minimum = Long.MinValue,
      maximum = Long.MaxValue,
      reading = expectedReading,
      accepted = Ratio(decimal("0.25000000000000000000000000000000000000"))
    )
    val defaultState = CounterState()
    assert(defaultState == expected)
    assert(CounterState.empty == expected)
    assert(defaultState.copy() == expected)
    assert(CounterState(count = 9L) == expected.copy(count = 9L))
    assert(stateThroughBytes(defaultState) == expected)
    assert(stateThroughBytes(CounterState.empty) == expected)
    assert(defaultState.reading.maybe == Some(None))
    assert(defaultState.minimum == Long.MinValue)
    assert(defaultState.maximum == Long.MaxValue)
  }

  test("RuleParams retain state command and host without evaluating the host") {
    val state = stateSentinel
    val command = CounterProtocol.SetCount(idSentinel, Long.MaxValue, readingSentinel)
    val expected = Ratio(decimal("0.75"))
    final class FakeHost extends CounterComputations {
      var calls = Vector.empty[(Reading, Long, Long)]
      override def acceptedRatio(reading: Reading, count: Long, minimum: Long): Ratio = {
        calls = calls :+ ((reading, count, minimum))
        expected
      }
    }
    val host = new FakeHost
    val params = CounterRuleParams.SetCountParams(state, command, host)
    assert(params.state eq state)
    assert(params.command eq command)
    assert(params.hosts eq host)
    assert(host.calls.isEmpty)
    val result: Ratio = params.hosts.acceptedRatio(params.command.reading, params.command.count, params.state.minimum)
    assert(result == expected)
    assert(host.calls == Vector((command.reading, Long.MaxValue, Long.MinValue)))
    val copied = params.copy()
    assert(copied == params)
    assert(copied.hosts eq host)
    assert(host.calls.size == 1)
  }
}
