package truthsrc.codegenparity

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths, StandardOpenOption}
import net.imadz.meta.Examples
import ujson.{Arr, Bool, Null, Num, Obj, Str, Value}

/** Independent, lossless architecture input capture; never reads generated output
  * or calls a generator Builder. Compile beside the explicitly pinned BC source.
  */
object ClassicMetadataExport {
  private val MaxSafeInteger = BigInt("9007199254740991")

  private def tagged(kind: String, value: String): Value =
    Obj("_type" -> Str(kind), "value" -> Str(value))

  private def integer(kind: String, value: BigInt): Value =
    if (value.abs <= MaxSafeInteger) Num(value.toDouble)
    else tagged(kind, value.toString)

  private def floating(kind: String, value: Double, text: String): Value = {
    val negativeZero = value == 0.0 && java.lang.Double.doubleToRawLongBits(value) < 0L
    if (java.lang.Double.isFinite(value) && !negativeZero &&
        math.abs(value) <= MaxSafeInteger.toDouble && value == math.rint(value)) Num(value)
    else tagged(kind, text)
  }

  def encode(value: Any): Value = value match {
    case null                    => Null
    case None                    => Null
    case Some(inner)             => encode(inner)
    case v: String               => Str(v)
    case v: Boolean              => Bool(v)
    case v: Byte                 => Num(v.toDouble)
    case v: Short                => Num(v.toDouble)
    case v: Int                  => Num(v.toDouble)
    case v: Long                 => integer("Long", BigInt(v))
    case v: BigInt               => integer("BigInt", v)
    case v: BigDecimal           => tagged("BigDecimal", v.bigDecimal.toString)
    case v: java.math.BigInteger => integer("BigInteger", BigInt(v))
    case v: java.math.BigDecimal => tagged("JavaBigDecimal", v.toString)
    case v: Double              => floating("Double", v, java.lang.Double.toString(v))
    case v: Float               => floating("Float", v.toDouble, java.lang.Float.toString(v))
    case v: Char                => tagged("Char", v.toString)
    case values: scala.collection.Map[_, _] =>
      val entries = values.iterator.map {
        case (key: String, entry) => key -> encode(entry)
        case _ => throw new IllegalArgumentException("Only string-keyed metadata maps are supported")
      }.toSeq.sortBy(_._1)
      Obj.from(entries)
    case values: scala.collection.Seq[_] => Arr.from(values.iterator.map(encode))
    case product: Product =>
      val fields = product.productElementNames.zip(product.productIterator).map {
        case (name, entry) =>
          require(name != "_type", "Metadata product field conflicts with the discriminator")
          name -> encode(entry)
      }.toSeq
      Obj.from(Seq("_type" -> Str(product.productPrefix)) ++ fields)
    case other =>
      throw new IllegalArgumentException("Unsupported metadata value type: " + other.getClass.getName)
  }

  private def checkEncoding(): Unit = {
    assert(encode(None) == Null)
    assert(encode(Some(List(1, 2))) == Arr(Num(1), Num(2)))
    assert(encode(Long.MaxValue) == tagged("Long", "9223372036854775807"))
    assert(encode(BigDecimal("12345678901234567890.123400")) ==
      tagged("BigDecimal", "12345678901234567890.123400"))
    assert(encode(0.1) == tagged("Double", "0.1"))
    assert(encode(-0.0) == tagged("Double", "-0.0"))
    assert(encode(1.0) == Num(1))
    assert(encode(Right("verbatim")) == Obj("_type" -> "Right", "value" -> "verbatim"))
    assert(encode(Map("z" -> 1, "a" -> 2)).obj.keys.toSeq == Seq("a", "z"))
  }

  def main(args: Array[String]): Unit = {
    require(args.length == 1, "Usage: ClassicMetadataExport /absolute/new-output.json")
    val output = Paths.get(args(0))
    require(output.isAbsolute, "Output path must be absolute")
    checkEncoding()
    val system = Examples.bankingSystem
    val document = Obj(
      "schemaVersion" -> "truthsrc.classic-architecture-input/v1",
      "system" -> encode(system)
    )
    val bytes = (ujson.write(document, indent = 2, escapeUnicode = false) + "\n")
      .getBytes(StandardCharsets.UTF_8)
    Files.write(output, bytes, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)
    println("System: " + system.name)
    println("Classic metadata input: " + output + " (" + bytes.length + " bytes; complete SystemMetadata)")
  }
}
