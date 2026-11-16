package net.imadz.codegen

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths}
import org.scalatest.funsuite.AnyFunSuite

class ProductConverterPartitionSpec extends AnyFunSuite {
  test("wide nonbank converters retain all methods in bounded deterministic sources and exact goldens") {
    val root = Paths.get("src/test/resources/semantic-products").toAbsolutePath
    val target = Files.createTempDirectory("bc-wide-converter-").toRealPath().resolve("absent").toString
    val properties = Map("codegen.semanticProductsFile" -> root.resolve("compiled-tickets-wide-converters.json").toString,
      "codegen.productOptionsFile" -> root.resolve("tickets-domain-v4-options.json").toString,
      "codegen.productTargetProfile" -> "scala-cqrs-domain@2", "codegen.targetDir" -> target)
    val plan = SemanticProductsGenerationPlan.prepare(properties, target)
    assert(!Files.exists(Paths.get(target)))
    assert(SemanticProductsGenerationPlan.prepare(properties, target).entries == plan.entries)
    val converters = plan.entries.filter(_.kind == "converter")
    val facade = converters.find(_.path.endsWith("/DomainConverters.scala")).get
    val parts = converters.filter(_.path.matches(".*DomainConvertersPart[0-9]+\\.scala"))
    assert(parts.size >= 2)
    assert(converters.map(_.content.length).sum > 65536)
    assert(converters.forall(_.content.length <= 65536))
    assert(parts.forall(p => facade.dependencies.contains(p.path)))
    val body = parts.map(_.content).mkString("\n")
    (0 until 40).foreach { i =>
      assert(body.sliding(("def encodePassengerRecord" + i + "PB(").length).count(_ == "def encodePassengerRecord" + i + "PB(") == 1)
      assert(body.sliding(("def decodePassengerRecord" + i + "PB(").length).count(_ == "def decodePassengerRecord" + i + "PB(") == 1)
    }
    assert(body.contains("value.`type`"))
    plan.entries.foreach { entry =>
      val file = Paths.get("reference_project/app/semantic-products-wide-converters").resolve(entry.path)
      assert(Files.isRegularFile(file), entry.path)
      assert(new String(Files.readAllBytes(file), StandardCharsets.UTF_8) == entry.content, entry.path)
    }
  }
}
