package net.imadz.codegen

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths}
import org.scalatest.funsuite.AnyFunSuite

class ProductSharedExternalTypeSpec extends AnyFunSuite {
  test("independent typed generation retains distinct external bridges sharing a nominal result") {
    val out = Files.createTempDirectory("bc-shared-external-").toRealPath().resolve("source").toString
    val properties = Map(
      "codegen.semanticProductsFile" -> Paths.get("src/test/resources/semantic-products/compiled-shared-external-type.json").toAbsolutePath.toString,
      "codegen.productOptionsFile" -> Paths.get("src/test/resources/semantic-products/domain-generation-options.json").toAbsolutePath.toString,
      "codegen.targetDir" -> out
    )
    val plan = SemanticProductsGenerationPlan.prepare(properties, out)
    assert(!Files.exists(plan.target))
    val bridge = plan.entries.find(_.kind == "external-event-bridge").get
    assert(bridge.content.contains("def observation_ingress("))
    assert(bridge.content.contains("def reobservation_ingress("))
    assert(bridge.sources.map(s => s.document -> s.pointer) == Vector(
      "domain" -> "/aggregates/0", "domain" -> "/externalEventProducers/0", "domain" -> "/externalEventProducers/1"))
    plan.entries.foreach { entry =>
      val golden = Paths.get("reference_project/app/semantic-products-shared-external-type").resolve(entry.path)
      assert(Files.isRegularFile(golden), "missing golden: " + entry.path)
      assert(new String(Files.readAllBytes(golden), StandardCharsets.UTF_8) == entry.content, entry.path)
    }
    assert(SemanticProductsGenerationPlan.prepare(properties, out).entries == plan.entries)
  }
}
