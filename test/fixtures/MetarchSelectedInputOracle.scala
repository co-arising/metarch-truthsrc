package truthsrc.compat

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths}
import net.imadz.codegen.ingest.application.{AssemblyEngine, MergeEngine}
import net.imadz.codegen.ingest.infrastructure.StateFileStore
import net.imadz.codegen.ingest.domain.WorkshopStateJson
import net.imadz.meta.IngestedSystem

object MetarchSelectedInputOracle {
  def main(args: Array[String]): Unit = {
    require(args.length == 2, "Expected baseline file and selected/rejected mode")
    require(sys.env.contains("TRUTHSRC_METARCH_INPUT"), "Explicit selected input required")
    val selected = StateFileStore.load("metarch")
    if (args(1) == "rejected") {
      require(selected.isLeft, "Default load must reject")
      val rejected = try { IngestedSystem.systemMetadata; false } catch { case _: IllegalStateException => true }
      require(rejected, "Default metadata must not return an empty success")
      println(ujson.write(ujson.Obj("passed" -> true, "mode" -> "rejected", "defaultLoadRejected" -> true, "defaultMetadataRejected" -> true)))
    } else {
      require(args(1) == "selected", "Unknown oracle mode")
      val raw = new String(Files.readAllBytes(Paths.get(args(0))), StandardCharsets.UTF_8)
      val baseline = WorkshopStateJson.read(raw).fold(message => throw new IllegalArgumentException(message), identity)
      val candidate = selected.fold(message => throw new IllegalArgumentException(message), identity)
      val before = AssemblyEngine.assemble(baseline).fold(message => throw new IllegalArgumentException(message), identity)
      val after = AssemblyEngine.assemble(candidate).fold(message => throw new IllegalArgumentException(message), identity)
      val checks = Seq(
        "parsedState" -> (baseline == candidate),
        "mergedNotes" -> (MergeEngine.mergedNotes(baseline) == MergeEngine.mergedNotes(candidate)),
        "mergedFieldModel" -> (MergeEngine.mergedFieldModel(baseline) == MergeEngine.mergedFieldModel(candidate)),
        "mergedBehaviorFolds" -> (MergeEngine.mergedBehaviorFolds(baseline) == MergeEngine.mergedBehaviorFolds(candidate)),
        "assemblyResult" -> (before == after),
        "defaultMetadata" -> (IngestedSystem.systemMetadata == before.system),
        "repeatDefaultMetadata" -> (IngestedSystem.systemMetadata == before.system),
        "saveRejected" -> StateFileStore.save(candidate).isLeft,
        "filePathRejected" -> (try { StateFileStore.statePath("metarch"); false } catch { case _: UnsupportedOperationException => true })
      )
      require(checks.forall(_._2), "Default selected consumer mismatch: " + checks.filterNot(_._2).map(_._1).mkString(","))
      println(ujson.write(ujson.Obj("passed" -> true, "mode" -> "selected", "checks" -> ujson.Obj.from(checks.map { case (name, result) => name -> ujson.Bool(result) }),
        "notes" -> candidate.allNotes.size, "mergedNotes" -> MergeEngine.mergedNotes(candidate).size,
        "aggregates" -> after.system.application.aggregates.size)))
    }
  }
}
