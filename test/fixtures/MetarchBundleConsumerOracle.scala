package truthsrc.compat

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths}
import net.imadz.codegen.ingest.application.{AssemblyEngine, MergeEngine}
import net.imadz.codegen.ingest.domain.WorkshopStateJson
import net.imadz.codegen.ingest.infrastructure.StateFileStore
import net.imadz.meta.IngestedSystem

object MetarchBundleConsumerOracle {
  def main(args: Array[String]): Unit = {
    require(args.length == 2, "Explicit baseline WorkshopState and bundle manifest are required")
    val baseline = WorkshopStateJson.read(new String(Files.readAllBytes(Paths.get(args(0))), StandardCharsets.UTF_8))
      .fold(message => throw new IllegalArgumentException(message), identity)
    val candidate = StateFileStore.loadBundle(Paths.get(args(1)))
      .fold(message => throw new IllegalArgumentException(message), identity)
    val before = AssemblyEngine.assemble(baseline).fold(message => throw new IllegalArgumentException(message), identity)
    val after = AssemblyEngine.assemble(candidate).fold(message => throw new IllegalArgumentException(message), identity)
    val entry = IngestedSystem.systemMetadataFromBundle(Paths.get(args(1)))
      .fold(message => throw new IllegalArgumentException(message), identity)
    val checks = Seq(
      "parsedState" -> (baseline == candidate),
      "mergedNotes" -> (MergeEngine.mergedNotes(baseline) == MergeEngine.mergedNotes(candidate)),
      "mergedFieldModel" -> (MergeEngine.mergedFieldModel(baseline) == MergeEngine.mergedFieldModel(candidate)),
      "mergedBehaviorFolds" -> (MergeEngine.mergedBehaviorFolds(baseline) == MergeEngine.mergedBehaviorFolds(candidate)),
      "assembledResult" -> (before == after),
      "explicitEntry" -> (entry == before.system)
    )
    println(ujson.write(ujson.Obj("passed" -> checks.forall(_._2),
      "checks" -> ujson.Obj.from(checks.map { case (name, value) => name -> ujson.Bool(value) }),
      "notes" -> candidate.allNotes.size, "mergedNotes" -> MergeEngine.mergedNotes(candidate).size,
      "aggregates" -> after.system.application.aggregates.size)))
    if (!checks.forall(_._2)) sys.exit(2)
  }
}
