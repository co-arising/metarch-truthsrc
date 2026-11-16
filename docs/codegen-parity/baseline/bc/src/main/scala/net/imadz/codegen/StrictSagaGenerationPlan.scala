package net.imadz.codegen

import java.nio.file.{Files, LinkOption, Path, Paths}
import net.imadz.codegen.scaffolding.cqrs._
import net.imadz.codegen.scaffolding.cqrs.builder.application.transactor.StrictSagaModuleBuilder
import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.StrictSagaModuleModel
import net.imadz.meta.SystemMetadata
import net.imadz.meta.execution.{AdmittedSagaInputV3, SagaValueSource}
import net.imadz.codegen.structure.NamingConventions

/** Prepared only from an admitted v3 capability and the actual base. No raw typed/flag shortcut. */
final class StrictSagaGenerationPlan private (
    val admitted: AdmittedSagaInputV3, val models: Vector[StrictSagaModuleModel],
    val target: Path, val multiProject: Boolean, val paths: Vector[Path], val sources: Vector[String]) {
  def validateAgainst(base: SystemMetadata, actualTarget: Path, actualMulti: Boolean): Unit = {
    require(actualTarget.toAbsolutePath.normalize == target && actualMulti == multiProject, "strict plan output mismatch")
    StrictSagaGenerationPlan.requireAdmitted(admitted, base)
    paths.foreach(StrictSagaGenerationPlan.safePath(target, _))
  }
}
object StrictSagaGenerationPlan {
  private[codegen] def requireAdmitted(input: AdmittedSagaInputV3, base: SystemMetadata): Unit = {
    require(input != null, "strict v3 input required")
    val diagnostics = input.validateAgainst(base) // actual base, not a retained alias or digest-only check
    require(diagnostics.isEmpty, diagnostics.mkString("Strict v3 actual-base validation failed: ", "; ", ""))
    require(input.sagas.nonEmpty, "strict generation cannot succeed with zero sagas")
  }
  private[codegen] def safePath(target: Path, output: Path): Unit = {
    require(output.startsWith(target) && output != target, "strict output outside target")
    var current: Path = output
    while (current != null) {
      require(!Files.isSymbolicLink(current), "symlink in strict target path")
      if (Files.exists(current, LinkOption.NOFOLLOW_LINKS)) {
        if (current != output) require(Files.isDirectory(current), "non-directory strict ancestor")
        else {
          require(Files.isRegularFile(current), "strict output is not a regular file")
          val links = Files.getAttribute(current, "unix:nlink", LinkOption.NOFOLLOW_LINKS).asInstanceOf[Number].longValue
          require(links == 1L, "hardlinked strict output")
        }
      }
      current = current.getParent
    }
  }
  def prepare(input: AdmittedSagaInputV3, base: SystemMetadata, targetPath: String, multi: Boolean): StrictSagaGenerationPlan = {
    requireAdmitted(input, base)
    val raw = Paths.get(targetPath)
    require(raw.isAbsolute, "strict generation requires an explicit absolute target")
    val target = raw.normalize
    require(target.getParent != null && target.getNameCount > 1, "strict target cannot be filesystem root")
    val workspace = Paths.get("").toAbsolutePath.normalize.getParent
    require(target != workspace, "strict target cannot be workspace root")
    // Existing workspace repositories/shared apps are not strict engineering staging targets.
    Vector("backkend-codegen", "metarch-truthsrc", "metarch-truth", "ingested-app", "metarch-app", "saga-core",
      "monarch-core", "monarch-persistence", "playAkkaCQRS", "bank-batch-transactor-demo", "fab-simulator-demo", "auth-core", "common-core")
      .foreach(name => require(!target.startsWith(workspace.resolve(name)), "strict target overlaps a protected repository"))
    require(!target.startsWith(Paths.get("").toAbsolutePath.normalize), "strict target overlaps generator repository")
    val ctx = GeneratorContext.fromSystemMetadata(base)
    val models = input.sagas.map(StrictSagaModuleBuilder.build(_, ctx))
    val declared = models.map(_.selfType.fqn)
    require(declared.distinct.size == declared.size, "duplicate strict module output")
    val baseNames = ctx.metaRegistry.resolveAll[net.imadz.meta.DomainDrivenMetadata].map(_.name).toSet
    models.foreach { m =>
      require(m.selfType.fqn == m.pinned.execution.contract.binding.module.dottedPath, "strict module FQN must not be rewritten")
      require(ctx.typeResolver.strictIndependentNamespace(m.selfType), "strict output requires an independent namespace outside runtime and legacy output territories")
      require(!baseNames(m.selfType.name) && !ctx.typeResolver.strictReservedOutputs(m.selfType.fqn), "strict module clashes with a declared base output")
      val names = Vector("Args", "TriggerStart", "PhaseContract", "TriggerContract", "CompletionContract", "Host", "HostRequirements",
        "AddressContract", "ValueSource", "SlotContract", "TypeContract", "ValueShape", "BoundedText", "BooleanShape", "IntegerShape",
        "EnumerationShape", "ValueObjectShape", "MoneyShape", "ArgsCodecContract", "InputContract", "ConfirmationContract", "QueryContract", "ReceiptContract", "IdempotencyContract") ++
        m.phases.flatMap(p => Vector(p.inputType.name, p.receiptType.name, p.stem + "HostBinding")) ++
        m.triggers.map(t => NamingConventions.firstUpper(t.member) + "Binding") ++
        m.completions.flatMap(c => Vector(c.inputType.name, NamingConventions.firstUpper(c.member) + "Binding"))
      require(names.distinct.size == names.size, "duplicate strict declared nested name")
      val members = m.phases.flatMap(p => Vector(p.member, p.member + "Contract", p.member + "Port")) ++
        m.steps.map(_.address).distinct.flatMap(a => Vector(a.member, a.member + "Contract")) ++
        m.triggers.flatMap(t => Vector(t.member, t.member + "Contract", t.member + "Start")) ++
        m.completions.flatMap(c => Vector(c.member, c.member + "Contract", c.member + "Event")) ++
        Vector("Name", "Version", "DefinitionDigest", "ArgsPin", "CandidateArtifact", "ArtifactStatus", "UpstreamRunnable",
          "UpstreamRuntimeBindingVerified", "UpstreamBlocked", "RequiredTypes", "RequiredArgsCodec", "RequiredHost",
          "checkedArgsCodec", "definition", "behavior")
      require(members.distinct.size == members.size, "duplicate strict host member")
      (Vector(m.argsFields) ++ m.phases.flatMap(p => Vector(p.inputFields, p.outputFields)) ++ m.completions.map(_.fields)).foreach { fs =>
        require(fs.map(_.name).distinct.size == fs.size, "duplicate strict field")
        fs.foreach(f => require(f.name.matches("[A-Za-z_][A-Za-z0-9_]*"), "unsafe strict field"))
      }
      m.phases.foreach(p => p.inputs.foreach(i => require(i.source match {
        case _: SagaValueSource.Args | SagaValueSource.TransactionId | _: SagaValueSource.StepReceipt => true
        case _ => false
      }, "unsupported phase mapping")))
      m.completions.foreach(c => c.execution.inputs.foreach(i => require(i.source match {
        case _: SagaValueSource.Args | SagaValueSource.TransactionId => true
        case _ => false
      }, "unsupported completion mapping")))
    }
    val paths = models.map(m => target.resolve(if (multi) "modules/glue/src/main/scala" else "app")
      .resolve(NamingConventions.strictPackagePath(m.selfType.packageName)).resolve(NamingConventions.strictFileName(m.selfType.name)))
    require(paths.distinct.size == paths.size, "duplicate strict output path")
    paths.foreach(safePath(target, _))
    val sources = models.map(net.imadz.codegen.scaffolding.cqrs.template.application.transactor.StrictSagaModuleTemplate.generate)
    new StrictSagaGenerationPlan(input, models, target, multi, paths, sources)
  }
}
