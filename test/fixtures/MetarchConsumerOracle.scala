package truthsrc.compat

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths}
import net.imadz.codegen.ingest.application.{AssemblyEngine, MergeEngine}
import net.imadz.codegen.ingest.domain.{WorkshopState, WorkshopStateJson}

object MetarchConsumerOracle {
  private def read(path: String): WorkshopState = {
    val text = new String(Files.readAllBytes(Paths.get(path)), StandardCharsets.UTF_8)
    WorkshopStateJson.read(text).fold(message => throw new IllegalArgumentException(message), identity)
  }

  def main(args: Array[String]): Unit = {
    require(args.length == 2, "Two explicit WorkshopState product files are required")
    val baseline = read(args(0))
    val candidate = read(args(1))
    val before = AssemblyEngine.assemble(baseline).fold(message => throw new IllegalArgumentException(message), identity)
    val after = AssemblyEngine.assemble(candidate).fold(message => throw new IllegalArgumentException(message), identity)
    val checks = Seq(
      "parsedState" -> (baseline == candidate),
      "mergedNotes" -> (MergeEngine.mergedNotes(baseline) == MergeEngine.mergedNotes(candidate)),
      "mergedFieldModel" -> (MergeEngine.mergedFieldModel(baseline) == MergeEngine.mergedFieldModel(candidate)),
      "mergedBehaviorFolds" -> (MergeEngine.mergedBehaviorFolds(baseline) == MergeEngine.mergedBehaviorFolds(candidate)),
      "assembledSystem" -> (before.system == after.system),
      "parkedNotes" -> (before.parked == after.parked),
      "warnings" -> (before.warnings == after.warnings)
    )
    val passed = checks.forall(_._2)
    println(ujson.write(ujson.Obj(
      "schemaVersion" -> "truthsrc.metarch-consumer-oracle/v1",
      "passed" -> passed,
      "checks" -> ujson.Obj.from(checks.map { case (name, result) => name -> ujson.Bool(result) }),
      "sessions" -> baseline.sessions.size,
      "notes" -> baseline.allNotes.size,
      "mergedNotes" -> MergeEngine.mergedNotes(baseline).size,
      "aggregates" -> before.system.application.aggregates.size,
      "parkedNotes" -> before.parked.size,
      "warnings" -> before.warnings.size
    )))
    if (!passed) sys.exit(2)
  }
}
