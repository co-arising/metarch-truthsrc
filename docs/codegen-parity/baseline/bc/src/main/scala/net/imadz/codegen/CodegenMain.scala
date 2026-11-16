package net.imadz.codegen

import net.imadz.codegen.infra.FileSystem
import net.imadz.codegen.scaffolding.cqrs.{CQRSApplicationGenerator, ConcernScopeLoader, FieldKnowledgeAnchors, GeneratorContext, GeneratorVersion, ScopeFilter}
import net.imadz.meta.{SystemMetadata, SystemMetadataRegistry}
import net.imadz.meta.harness.SystemMetadataValidator

import java.io.{File, IOException}
import java.nio.file.{Files, Paths}
import scala.util.control.NonFatal

object CodegenMain {

  // Target project dir: overridable via -Dcodegen.targetDir, default is the
  // sibling directory "banking-app" relative to this repo's working dir.
  val targetDir = sys.props.getOrElse("codegen.targetDir", new File("../banking-app").getCanonicalPath)
  val appDir = s"$targetDir/app"
  val scaffoldDir = "scaffold"

  def main(args: Array[String]): Unit = {
    try run()
    catch {
      case NonFatal(e) =>
        System.err.println("\n[ERROR] Generation Failed:")
        e.printStackTrace(System.err)
        sys.exit(1)
    }
  }

  private[codegen] final case class Prepared(
      system: SystemMetadata,
      scope: ScopeFilter,
      excludedNatures: Set[String],
      releaseInfo: KnowledgeRelease.Info,
      multiProject: Boolean,
      strictV3: Option[net.imadz.meta.execution.AdmittedSagaInputV3] = None,
      formalSemantics: Option[net.imadz.meta.filesystem.FormalSemantics] = None,
      composition: Option[net.imadz.meta.execution.CompositionBindingAdapter.CompositionFacePlan] = None
  )

  private def resolveStandard(name: String): Either[String, SystemMetadata] =
    SystemMetadataRegistry.resolve(name, SystemMetadataRegistry.Standard)

  /** Read and validate legacy inputs plus the optional independent admitted v3 slot
    * before any target mkdir, scaffold copy or relocation. Strict structural plans
    * are subsequently prepared against the actual target before entering run's writes.
    */
  private[codegen] def prepare(
      properties: scala.collection.Map[String, String],
      scaffoldSource: String,
      resolveSystem: String => Either[String, SystemMetadata] = resolveStandard
  ): Prepared = {
    // Validation only: do not detect git or initialize the cached version here.
    // Injected maps are an engineering seam, not generator settings: production
    // run uses sys.props, as does GeneratorVersion.value during rendering.
    GeneratorVersion.validateProperties(properties)

    // Keep the existing system slots and Examples default; resolution failures
    // propagate, with no empty-system or Examples fallback. The formal file
    // input assembles the actual base from real truth-source documents and is
    // mutually exclusive with the registry slot.
    val systemFile = properties.get("codegen.systemFile")
    val systemBindings = properties.get("codegen.systemBindings")
    var canonicalJson: Option[ujson.Value] = None
    val assembled: Option[net.imadz.meta.filesystem.AssembledFormal] = (systemFile, systemBindings) match {
      case (Some(_), Some(_)) =>
        require(!properties.contains("codegen.system"),
          "codegen.systemFile/systemBindings are mutually exclusive with codegen.system")
        val canonical = net.imadz.meta.filesystem.FileSystemMetadata.readJsonFile(systemFile.get, "canonical")
        canonicalJson = Some(canonical)
        val bindingJson = net.imadz.meta.filesystem.FileSystemMetadata.readJsonFile(systemBindings.get, "bindings")
        Some(net.imadz.meta.filesystem.SerialCanonicalAdapter.assemble(canonical, bindingJson)
          .fold(errs => throw new IllegalArgumentException("Formal file input rejected:\n" + errs.mkString("\n")), identity))
      case (Some(_), None) => throw new IllegalArgumentException("codegen.systemBindings is required together with codegen.systemFile")
      case (None, Some(_)) => throw new IllegalArgumentException("codegen.systemFile is required together with codegen.systemBindings")
      case (None, None) => None
    }
    val system: SystemMetadata = assembled.map(_.system).getOrElse {
      val systemName = properties.getOrElse("codegen.system", "Examples")
      resolveSystem(systemName).fold(err => throw new IllegalArgumentException(err), identity)
    }
    val formalSemantics = assembled.map(_.semantics)
    val systemName = properties.getOrElse("codegen.system", "Examples")
    println(
      s"System: ${system.name}" +
        (if (systemName == "IngestedSystem") s"（workshop: ${system.contextName.getOrElse("?")}）" else "")
    )
    println(s"DEBUG: System Invariants: ${system.domain.invariants.map(_.name).mkString(", ")}")

    // Resolve concern arguments before harness reporting so an unknown concern
    // is diagnosed even when the selected metadata also has harness errors.
    val knownFamilies =
      system.application.aggregates.map(_.name).toSet ++
        system.infrastructure.projections.flatMap(_.effectiveAggregates).toSet
    val concernLoaded = ConcernScopeLoader.load(
      properties.get("codegen.scope-file"),
      properties.get("codegen.concern"),
      properties.get("codegen.families"),
      knownFamilies
    ).fold(err => throw new IllegalArgumentException(err), identity)
    concernLoaded.foreach { l =>
      println(s"Concern: ${l.concernName}（families: ${l.families.mkString(",")}）")
    }
    val scope = concernLoaded.map(_.filter).getOrElse(ScopeFilter.All)

    println("Running Harness Verifications...")
    val (errors, warnings) = SystemMetadataValidator.validate(system).partition(_.severity == "ERROR")
    if (warnings.nonEmpty) {
      System.err.println(s"\n[WARNINGS] ${warnings.size} non-blocking issue(s) detected:")
      warnings.foreach(w => System.err.println(w.toString))
    }
    if (errors.nonEmpty) {
      errors.foreach(err => System.err.println(err.toString))
      throw new IllegalArgumentException(s"Harness validation failed: ${errors.size} critical issue(s) found")
    }

    // Explicit independent v3 slot. Size is bounded before and during the read;
    // strict UTF-8/full JSON/projection/pins validation belongs to the existing admission API.
    val strictV3 = properties.get("codegen.sagaExecutionV3").map { name =>
      val path = Paths.get(name)
      require(path.isAbsolute && Files.isRegularFile(path) && Files.isReadable(path), "v3 input must be an explicit readable absolute file")
      val max = 8 * 1024 * 1024
      require(Files.size(path) <= max, "v3 input exceeds 8 MiB")
      val stream = Files.newInputStream(path)
      val bytes = try stream.readNBytes(max + 1) finally stream.close()
      require(bytes.length <= max, "v3 input exceeds 8 MiB")
      val token = net.imadz.meta.execution.AdmittedSagaInputV3.fromBytes(bytes, system)
        .fold(errors => throw new IllegalArgumentException(errors.mkString("; ")), identity)
      StrictSagaGenerationPlan.requireAdmitted(token, system)
      token
    }

    // P15 composition face: truthsrc.execution-binding/v1 beside the assembled
    // canonical. Requires the formal file inputs and the admitted v3 token —
    // the builder cross-checks every invocation entrypoint against it.
    val composition = properties.get("codegen.executionBinding").map { name =>
      require(assembled.isDefined, "codegen.executionBinding requires codegen.systemFile/systemBindings inputs")
      require(strictV3.isDefined, "codegen.executionBinding requires codegen.sagaExecutionV3 (admitted strict sagas)")
      val path = Paths.get(name)
      require(path.isAbsolute && Files.isRegularFile(path) && Files.isReadable(path), "execution binding must be an explicit readable absolute file")
      val max = 8 * 1024 * 1024
      require(Files.size(path) <= max, "execution binding exceeds 8 MiB")
      val bindingJson = net.imadz.meta.filesystem.FileSystemMetadata.readJsonFile(path.toString, "executionBinding")
      net.imadz.meta.execution.CompositionBindingAdapter.assemble(canonicalJson.get, bindingJson)
        .fold(errs => throw new IllegalArgumentException("Execution binding rejected:\n" + errs.mkString("\n")), identity)
    }

    // Preserve the existing, concern-independent exclusions and release loader
    // semantics, but finish both reads before entering the writing phase.
    val excludedNatures = ConcernScopeLoader.loadExclusions(properties.get("codegen.scope-file"))
    if (excludedNatures.nonEmpty)
      println(s"Aggregate state exclusions: nature ∈ {${excludedNatures.toList.sorted.mkString(",")}}")
    val releaseInfo = KnowledgeRelease.loadInfo(properties.get("codegen.knowledge-export"))
    releaseInfo.release.foreach(t => println(s"Knowledge release: $t（element hashes: ${releaseInfo.elementHashes.size}）"))

    // These are the generator's existing read-only setup steps, before its first
    // mkdir. Preflight them here without introducing another rendering/writing engine.
    GeneratorContext.fromSystemMetadata(system)
    FieldKnowledgeAnchors.solve(system)
    val scaffold = Paths.get(scaffoldSource)
    if (!Files.isDirectory(scaffold) || !Files.isReadable(scaffold))
      throw new IOException(s"Scaffold directory not found or unreadable: $scaffoldSource")
    val entries = Files.walk(scaffold)
    try entries.forEach { p =>
      if (!Files.isReadable(p)) throw new IOException(s"Scaffold entry unreadable: $p")
    }
    finally entries.close()

    Prepared(system, scope, excludedNatures, releaseInfo, properties.get("codegen.multiProject").contains("true"), strictV3, formalSemantics, composition)
  }

  /** Narrow test seam: exceptions propagate to main, which owns the process exit.
    * Production still uses the original scaffold and CQRS generator writers.
    */
  private[codegen] def run(
      outputDir: String = targetDir,
      scaffoldSource: String = scaffoldDir,
      properties: scala.collection.Map[String, String] = sys.props,
      resolveSystem: String => Either[String, SystemMetadata] = resolveStandard
  ): Unit = {
    println("Initializing CQRS/ES Generator...")
    println(s"Target Directory: $outputDir")
    if (properties.contains("codegen.semanticProductsFile")) {
      val plan = SemanticProductsGenerationPlan.prepare(properties, outputDir)
      CQRSApplicationGenerator.generateProducts(plan)
      if (plan.designModel.isDefined) println("Success! Deterministic design-review projection generated; no runnable application, CQRS read side or deployment.")
      else println("Success! Independent semantic-product source profile generated.")
      return
    }
    require(!properties.contains("codegen.productTargetProfile"), "productTargetProfile requires explicit semanticProductsFile")
    require(!properties.contains("codegen.productOptionsFile"), "productOptionsFile requires semanticProductsFile")
    val input = prepare(properties, scaffoldSource, resolveSystem)
    val strictPlan = input.strictV3.map { token =>
      require(properties.get("codegen.targetDir").contains(outputDir), "strict entry requires explicit actual codegen.targetDir")
      require(!properties.get("codegen.direct").contains("true"), "strict entry does not support direct mode")
      StrictSagaGenerationPlan.prepare(token, input.system, outputDir, input.multiProject)
    }

    Files.createDirectories(Paths.get(outputDir))
    println(s"Copying scaffold from '$scaffoldSource' to '$outputDir'...")
    FileSystem.copyDirectory(scaffoldSource, outputDir).unsafeRun()

    // Keep the existing multi-project scaffold relocation (13 common files).
    // AuthAction/IdCodec/LoginRateLimiter remain in the root Play app.
    if (input.multiProject) {
      val relocations = Map(
        "kernel" -> List(
          "CborSerializable.scala", "CommonTypes.scala",
          "auth/ApiError.scala", "auth/Endpoint.scala", "auth/PasswordHashing.scala",
          "auth/RoleGate.scala", "auth/RoleResolver.scala", "auth/TokenService.scala",
          "serialization/PrimitiveConverter.scala",
          "application/CommandHandlerReplyingBehavior.scala"),
        "glue" -> List(
          "serialization/ObjectIdOffsetSerializer.scala",
          "application/projection/ScalikeJdbcSession.scala",
          "application/projection/ScalikeJdbcSetup.scala"))
      val commonRoot = new File(outputDir, "app/net/imadz/common")
      relocations.foreach { case (module, files) =>
        files.foreach { rel =>
          val src = new File(commonRoot, rel)
          if (src.exists()) {
            val dst = new File(outputDir, s"modules/$module/src/main/scala/net/imadz/common/$rel")
            Files.createDirectories(dst.toPath.getParent)
            Files.move(src.toPath, dst.toPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING)
          }
        }
      }
      println("Multi-project scaffold relocated to kernel/glue (13 common files)")
    }

    println("Running Code Generator...")
    val genRoot = if (input.multiProject) outputDir else new File(outputDir, "app").getPath
    strictPlan match {
      case Some(plan) => CQRSApplicationGenerator.generateAdmitted(
        input.system, genRoot, plan, input.scope, input.excludedNatures,
        input.releaseInfo.release.orNull, input.releaseInfo.elementHashes, input.formalSemantics, input.composition)
      case None =>
        require(input.composition.isEmpty, "codegen.executionBinding requires codegen.sagaExecutionV3 (strict generation)")
        CQRSApplicationGenerator.generate(
        input.system, genRoot, input.scope, input.excludedNatures,
        input.releaseInfo.release.orNull, input.releaseInfo.elementHashes, input.formalSemantics)
    }
    KnowledgeRelease.writeManifest(outputDir, input.releaseInfo)
    // P2: behavioral semantic attachment for both generators (js behavior
    // bridge reads formal-semantics.json; typed consumer available in-repo).
    input.formalSemantics.foreach { fs =>
      val out = Paths.get(outputDir, "formal-semantics.json")
      Files.write(out,
        ujson.write(net.imadz.meta.filesystem.FormalSemantics.toJson(fs), indent = 2)
          .getBytes(java.nio.charset.StandardCharsets.UTF_8))
      println(s"Formal semantics: $out（emissions/folds/guards per aggregate）")
    }
    println("\nSuccess! System generated successfully.")
  }
}
