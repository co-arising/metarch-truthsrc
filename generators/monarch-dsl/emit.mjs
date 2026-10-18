#!/usr/bin/env node
// ═══ monarch-dsl emitter — MonarchSpec → Scala (monarch-persistence 0.2) ═══
// Vertical slice of the new-baseline generator. Input is a MonarchSpec JSON
// (the contract between tree-parsing and code-emitting); output is a Scala
// file shaped like golden/monarch-dsl.
//
// Usage: node emit.mjs <spec.json> <out.scala>

import { readFileSync, writeFileSync } from "fs";

const [specPath, outPath] = process.argv.slice(2);
if (!specPath || !outPath) {
  console.error("usage: node emit.mjs <spec.json> <out.scala>");
  process.exit(1);
}

const spec = JSON.parse(readFileSync(specPath, "utf8"));

function emitStageType() {
  const cases = spec.stages.map((s) => `  case object ${s.name} extends ${spec.stageType}`).join("\n");
  const chain = spec.stages.map((s) => s.name).join(", ");
  const names = spec.stages
    .map((s) => `    case ${s.name} => "${s.label}"`)
    .join("\n");
  return `sealed trait ${spec.stageType}
object ${spec.stageType} {
${cases}

  val chain: Seq[${spec.stageType}] = Seq(${chain})

  def stageName(s: ${spec.stageType}): String = s match {
${names}
  }
}`;
}

function emitStateType() {
  const fields = spec.stateFields.map((f) => `${f.name}: ${f.type}`).join(", ");
  return `final case class ${spec.stateType}(${fields})
object ${spec.stateType} {
  implicit val format: play.api.libs.json.Format[${spec.stateType}] =
    play.api.libs.json.Json.format[${spec.stateType}]

  val codec: StateCodec[${spec.stateType}] = StateCodec[${spec.stateType}](
    enc = st => play.api.libs.json.Json.toJson(st).toString.getBytes("UTF-8"),
    dec = bytes => play.api.libs.json.Json.parse(bytes).as[${spec.stateType}]
  )
}`;
}

function emitInterpreter() {
  const cases = spec.stages
    .map((s) => `        case ${spec.stageType}.${s.name} => ${s.logic}`)
    .join("\n");
  return `  /** Host's stage logic. Must be idempotent: at-least-once recovery may replay it. */
  private def runStage(stage: ${spec.stageType}, state: ${spec.stateType})(implicit
      ec: ExecutionContext
  ): Future[${spec.stateType}] =
    Future {
      stage match {
${cases}
      }
    }`;
}

const out = `package ${spec.package}

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import net.imadz.monarch.persistence.{PersistentMonarch, RunObserver, StateCodec}

import scala.concurrent.{ExecutionContext, Future}

// ── generated from MonarchSpec: ${spec.name} ──────────────────────────
// Generator: generators/monarch-dsl/emit.mjs (new baseline). Do not hand-edit;
// regenerate from the truth tree.

${emitStageType()}

${emitStateType()}

object ${spec.objectName} {

  type RunCommand = PersistentMonarch.Command[${spec.stateType}]

  /** One persistent entity per run. */
  def behavior(
      persistenceId: PersistenceId,
      observer: RunObserver[${spec.stateType}] = RunObserver.nop[${spec.stateType}]
  )(implicit ec: ExecutionContext): Behavior[RunCommand] =
    PersistentMonarch.behavior[${spec.stageType}, ${spec.stateType}](
      persistenceId = persistenceId,
      stages = ${spec.stageType}.chain, // must be deterministic across restarts
      interpreter = (stage, state) => runStage(stage, state),
      stateCodec = ${spec.stateType}.codec, // keep encoding stable across deploys
      stageName = ${spec.stageType}.stageName, // stable names form the cursor vocabulary
      observer = observer
    )

${emitInterpreter()}
}
`;

writeFileSync(outPath, out);
console.log(`emitted ${outPath} (${out.split("\n").length} lines)`);
