package net.imadz.codegen.scaffolding.cqrs.verification

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, MetadataRegistry}
import net.imadz.meta.{DomainDrivenMetadata, Examples}
import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers

import java.io.File
import scala.io.Source

trait VerificationSpecBase extends AnyFlatSpec with Matchers {

  // 1. Setup Generator Context
  val system = Examples.bankingSystem

  val allMetas: Seq[DomainDrivenMetadata] = {
    val domain = system.domain
    val app = system.application
    val infra = system.infrastructure
    val faces = system.interfaces

    domain.valueObjects ++ domain.entities ++ domain.services ++ domain.invariants ++ domain.behaviors ++
      app.services ++ app.queries ++ app.sagas ++ app.behaviors ++ app.aggregates ++ app.repositories ++
      infra.repositories ++ infra.projections ++
      faces.controllers
  }

  val ctx = GeneratorContext(
    rootPackage = "net.imadz",
    frameworkPackage = "net.imadz.framework",
    moduleName = "",
    metaRegistry = MetadataRegistry(allMetas)
  )

  // 2. Golden Master Setup
  val targetProjectRoot = new File(
    "reference_project/app"
  )

  def readGoldenMasterFile(relativePath: String): String = {
    val file = new File(targetProjectRoot, relativePath)
    if (!file.exists())
      fail(s"Golden Master file not found: ${file.getAbsolutePath}")
    Source.fromFile(file, "UTF-8").mkString
  }

  def normalize(s: String): String = {
    s.replaceAll("\\s+", " ").trim
  }
}
