package net.imadz.codegen

import java.nio.file.{Files, LinkOption, Path, Paths}
import java.nio.charset.StandardCharsets
import net.imadz.codegen.scaffolding.cqrs.builder.products.{ProductDomainBuilder, ProductSerializationBuilder, ProductApplicationBuilder, ProductDesignBuilder}
import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.scaffolding.cqrs.template.products.{ProductDomainTemplate, ProductSerializationTemplate, ProductBuildTemplate, ProductActorTemplate, ProductAdapterTemplate, ProductApplicationTemplate, ProductInvocationHostTemplate, ProductHostSupportTemplate, ProductHostVerificationTemplate, ProductExecutionTemplate, ProductExecutionVerificationTemplate, ProductChildPlanTemplate, ProductChildHostTemplate, ProductHostIOTemplate, ProductDesignTemplate}
import net.imadz.meta.products.SemanticProductAdapter

/** Private constructor: generation takes independently admitted typed products, not caller source text. */
final class SemanticProductsGenerationPlan private (
    val target: Path, private val domainModel: Option[ProductDomainModel],
    val designModel: Option[ProductDesignModel], private[codegen] val entries: Vector[ProductSourceModel]) {
  def model: ProductDomainModel = domainModel.getOrElse(throw new IllegalStateException("design review is not a domain application model"))
}
object SemanticProductsGenerationPlan {
  private val legacy = Set("codegen.system", "codegen.systemFile", "codegen.systemBindings", "codegen.sagaExecutionV3", "codegen.executionBinding", "codegen.multiProject", "codegen.direct", "codegen.scope-file", "codegen.concern", "codegen.families")
  private[codegen] def prepare(properties: scala.collection.Map[String, String], output: String): SemanticProductsGenerationPlan = {
    require(legacy.forall(k => !properties.contains(k)), "semanticProductsFile is mutually exclusive with legacy system/strict execution/concern slots")
    require(properties.get("codegen.targetDir").contains(output), "semantic products require an explicit actual targetDir")
    val target = Paths.get(output)
    require(target.isAbsolute && target.normalize == target, "absolute normalized target required")
    var parent = target
    while (parent != null) { require(!Files.isSymbolicLink(parent), "target ancestor is a symlink"); parent = parent.getParent }
    require(!Files.exists(target, LinkOption.NOFOLLOW_LINKS), "semantic product generation requires a new exclusive target")
    val inputPath = Paths.get(properties("codegen.semanticProductsFile"))
    require(inputPath.isAbsolute && Files.isRegularFile(inputPath, LinkOption.NOFOLLOW_LINKS) && !Files.isSymbolicLink(inputPath), "absolute regular product file required")
    val set = SemanticProductAdapter.fromFile(inputPath.toString).fold(e => throw new IllegalArgumentException(e.mkString("\n")), identity)
    val file = properties.getOrElse("codegen.productOptionsFile", throw new IllegalArgumentException("explicit productOptionsFile required"))
    val path = Paths.get(file)
    require(path.isAbsolute && Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS) && !Files.isSymbolicLink(path), "absolute regular options file required")
    val options = net.imadz.meta.filesystem.FileSystemMetadata.readJsonFile(file, "product options")
    if (properties.get("codegen.productTargetProfile").contains("product-design-review@1")) {
      require(options.obj.isEmpty, "design-review target accepts only explicit empty options, not packages/runtime/deployment")
      val model = ProductDesignBuilder.build(set)
      def render(): Vector[ProductSourceModel] = ProductDesignTemplate.generate(model)
      val first = render(); validateEntries(first)
      val second = render(); validateEntries(second)
      require(first == second, "independent full design-review source plan determinism required")
      return new SemanticProductsGenerationPlan(target, None, Some(model), first.sortBy(_.path))
    }
    val profile = properties.getOrElse("codegen.productTargetProfile", "scala-cqrs-domain@1")
    val serviceProfile = profile == "scala-cqrs-play-service@1"
    val application = profile match {
      case "scala-cqrs-domain@1" | "scala-cqrs-domain@2" => false
      case "scala-cqrs-application@1" | "scala-cqrs-child-application@1" | "scala-cqrs-effect-application@1" |
           "scala-cqrs-application@2" | "scala-cqrs-child-application@2" | "scala-cqrs-effect-application@2" | "scala-cqrs-play-service@1" => true
      case _ => throw new IllegalArgumentException("unsupported explicit product target profile")
    }
    val nominalText = profile.endsWith("@2") || serviceProfile
    require(options.obj.keySet == (Set("packages", "verificationCases") ++ (if (application) Set("runtimeArtifact") else Set.empty[String]) ++ (if (serviceProfile) Set("service") else Set.empty[String])), "exact target options required")
    val hasService = set.products.exists { p => p.payload match {
      case net.imadz.meta.products.ArtifactContractProduct(rows) => rows.exists(_.deployment.service.nonEmpty)
      case _ => false
    }}
    require(hasService == serviceProfile, "service deployment requires its explicit service profile")
    val packages = options("packages").arr.toVector.map { p =>
      require(p.obj.keySet == Set("context", "package"), "closed context package mapping required")
      p("context").str -> p("package").str
    }
    require(packages.map(_._1).distinct.size == packages.size, "duplicate package context")
    val initial = ProductDomainBuilder.build(set, packages.toMap, application, nominalText)
    val dependencies = set.products.collectFirst { case net.imadz.meta.products.SemanticProduct(_, _, p: net.imadz.meta.products.DomainDependencyProduct) => p }.get
    val folds = set.products.collectFirst { case net.imadz.meta.products.SemanticProduct(_, _, p: net.imadz.meta.products.DomainFoldProduct) => p }.get
    val verification = net.imadz.meta.products.ProductVerificationCases.decode(options("verificationCases"), initial.layout, initial.exact, dependencies, folds)
    val model = initial.copy(wire = ProductSerializationBuilder.build(initial), verificationCases = verification)
    val appModel = if (!application) None else {
      val a = options("runtimeArtifact")
      require(a.obj.keySet == Set("coordinate", "sha256", "repository", "symbolicTarget"), "closed explicit runtime artifact binding required")
      val artifact = ProductRuntimeArtifact(a("coordinate").str, a("sha256").str, a("repository").str, a("symbolicTarget").str)
      val repo = Paths.get(java.net.URI.create(artifact.repository))
      val jar = repo.resolve("net/imadz/saga-core_2.13/0.2.1-p23.20261027.1/saga-core_2.13-0.2.1-p23.20261027.1.jar")
      require(Files.isRegularFile(jar, LinkOption.NOFOLLOW_LINKS) && !Files.isSymbolicLink(jar), "actual frozen runtime jar required")
      val sha = java.security.MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(jar)).map(b => f"${b & 0xff}%02x").mkString
      require(sha == artifact.sha256, "actual runtime artifact bytes differ from pin")
      val applicationModel = ProductApplicationBuilder.build(set, model, artifact)
      val effectProfile = Set("scala-cqrs-effect-application@1", "scala-cqrs-effect-application@2")(profile) || serviceProfile
      val childProfile = Set("scala-cqrs-child-application@1", "scala-cqrs-child-application@2")(profile)
      require(applicationModel.effectHosts.isEmpty || effectProfile, "effect hosts require explicit effect application profile")
      require(!effectProfile || applicationModel.effectHosts.nonEmpty, "effect application requires full typed effect-host product")
      require(applicationModel.childPlans.isEmpty || childProfile || effectProfile, "child plan generation requires an explicit child application profile")
      require(!childProfile || applicationModel.childPlans.nonEmpty, "child application requires complete typed child product")
      if (applicationModel.pipelines.nonEmpty) {
        Vector("monarch-core" -> "046ce5a54d4900674b9d87396bd57aefd93070e74e00b90820147c043c506b09", "monarch-persistence" -> "5cf3dd2784fad05fe42102b1c5df16685bc814318e2a21121c458eb26e8205bd").foreach { case (name, expected) =>
          val file = repo.resolve("net/imadz/" + name + "_2.13/0.2.1-p23.20261027.1/" + name + "_2.13-0.2.1-p23.20261027.1.jar")
          require(Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS) && !Files.isSymbolicLink(file), "actual frozen Monarch jar required")
          val digest = java.security.MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(file)).map(b => f"${b & 0xff}%02x").mkString
          require(digest == expected, "actual frozen Monarch artifact differs from target pin")
        }
      }
      Some(applicationModel)
    }
    val serviceModel = if (serviceProfile) Some(net.imadz.codegen.scaffolding.cqrs.builder.products.ProductServiceBuilder.build(appModel.get, options("service"), target)) else None
    def applicationBuild(a: ProductApplicationModel): Vector[ProductSourceModel] = serviceModel.map(net.imadz.codegen.scaffolding.cqrs.template.products.ProductServiceTemplate.build).getOrElse(ProductHostSupportTemplate.build(a))
    def render(): Vector[ProductSourceModel] = ProductDomainTemplate.generate(model) ++ ProductActorTemplate.generate(model, application) ++ ProductSerializationTemplate.generate(model) ++ ProductAdapterTemplate.generate(model) ++ appModel.map(a => applicationBuild(a) ++ ProductApplicationTemplate.generate(a) ++ ProductInvocationHostTemplate.generate(a) ++ ProductHostSupportTemplate.generate(a) ++ ProductHostIOTemplate.generate(a) ++ ProductHostVerificationTemplate.generate(a) ++ ProductExecutionTemplate.generate(a) ++ ProductExecutionVerificationTemplate.generate(a) ++ ProductChildPlanTemplate.generate(a) ++ ProductChildHostTemplate.generate(a) ++ net.imadz.codegen.scaffolding.cqrs.template.products.ProductEffectHostTemplate.generate(a) ++ net.imadz.codegen.scaffolding.cqrs.template.products.ProductEffectSupportTemplate.generate(a) ++ net.imadz.codegen.scaffolding.cqrs.template.products.ProductEffectVerificationTemplate.generate(a)).getOrElse(ProductBuildTemplate.generate(model)) ++ serviceModel.toVector.flatMap(s => net.imadz.codegen.scaffolding.cqrs.template.products.ProductServiceTemplate.generate(s) ++ net.imadz.codegen.scaffolding.cqrs.template.products.ProductServiceTestTemplate.generate(s) ++ net.imadz.codegen.scaffolding.cqrs.template.products.ProductServiceConfigurationTemplate.generate(s))
    def isolatedRender(): Vector[ProductSourceModel] = serviceModel.map(s => net.imadz.codegen.scaffolding.cqrs.template.products.ProductServiceTemplate.isolateTests(s, render())).getOrElse(render())
    val first = isolatedRender(); val second = isolatedRender()
    require(first == second, "independent source plan determinism required")
    require(first.nonEmpty && first.map(_.path.toLowerCase(java.util.Locale.ROOT)).distinct.size == first.size, "complete unique source paths required")
    first.foreach { entry =>
      require(!entry.path.startsWith("/") && !entry.path.contains("\\") && entry.path.split("/", -1).forall(p => p.nonEmpty && p != "." && p != ".."), "unsafe source entry path")
      require(entry.content.nonEmpty && !entry.content.contains("???") && entry.sources.nonEmpty, "complete generated source/evidence required")
    }
    new SemanticProductsGenerationPlan(target, Some(model), None, first.sortBy(_.path))
  }
  private def validateEntries(entries: Vector[ProductSourceModel]): Unit = {
    require(entries.nonEmpty && entries.map(_.path.toLowerCase(java.util.Locale.ROOT)).distinct.size == entries.size, "complete unique design-review paths required")
    val reserved = Set("anchors.json", "truthsrc.ledger.json", ".git", ".truthsrc", "node_modules")
    entries.foreach { entry =>
      val parts = entry.path.split("/", -1).toVector
      require(!entry.path.startsWith("/") && !entry.path.contains("\\") && !entry.path.contains(":"), "unsafe design-review path")
      require(parts.forall(p => p.nonEmpty && p != "." && p != ".." && !reserved(p.toLowerCase(java.util.Locale.ROOT))), "reserved or aliased design-review path")
      require(entry.content.nonEmpty && entry.content.length <= 65536 && !entry.content.contains("???") && entry.sources.nonEmpty, "bounded complete design-review content/evidence required")
      require(Set("design-model", "design-plane", "design-source-index")(entry.kind), "unsupported design-review entry kind")
      require(entry.footprint == ProductDesignBuilder.Required && entry.dependencies.isEmpty, "exact design-review product footprint required")
    }
  }
}
