#!/usr/bin/env node
// ═══ saga-dsl emitter — SagaSpec → Scala (saga-core 0.2) ═══
// Vertical slice of the new-baseline generator. Input is a SagaSpec JSON
// (the contract between tree-parsing and code-emitting); output is a Scala
// file shaped like golden/saga-dsl.
//
// Usage: node emit.mjs <spec.json> <out.scala>

import { readFileSync, writeFileSync } from "fs";

const [specPath, outPath] = process.argv.slice(2);
if (!specPath || !outPath) {
  console.error("usage: node emit.mjs <spec.json> <out.scala>");
  process.exit(1);
}

const spec = JSON.parse(readFileSync(specPath, "utf8"));

function emitPhase(phase, p) {
  const args = p.commandArgs.join(", ");
  return `            .${phase}
              .ref(ctx => ctx.${spec.participantRef})
              .command[${p.replyType}]((txId, replyTo) =>
                ${p.command}(${args}))
              .mapReply(${spec.mapReply})`;
}

function emitStep(step) {
  const phases = ["prepare", "commit", "compensate"]
    .filter((ph) => step.phases[ph])
    .map((ph) => emitPhase(ph, step.phases[ph]))
    .join("\n");
  return `          SagaStep
            .builder[${spec.errorType}, ${spec.contextType}]("${step.id}")
            .inGroup(${step.group})
            .withResilience(ResiliencePolicy(maxRetries = ${step.maxRetries}))
${phases}
            .build()`;
}

function emitArgs() {
  const fields = spec.argsFields.map((f) => `${f.name}: ${f.type}`).join(", ");
  return `final case class ${spec.argsType}(${fields})
object ${spec.argsType} {
  implicit val format: play.api.libs.json.Format[${spec.argsType}] =
    play.api.libs.json.Json.format[${spec.argsType}]
}`;
}

const out = `package ${spec.package}

import akka.actor.typed.{ActorRef, RecipientRef, Scheduler}
import net.imadz.infra.saga.SagaParticipant.SagaResult
import net.imadz.infra.saga.dsl._

import scala.concurrent.ExecutionContext

// ── generated from SagaSpec: ${spec.name} v${spec.version} ────────────────
// Generator: generators/saga-dsl/emit.mjs (new baseline). Do not hand-edit;
// regenerate from the truth tree.

${emitArgs()}

${spec.prelude}
/** Context the steps resolve participant refs from. Wired by the app. */
trait ${spec.contextType} {
  def ${spec.participantRef}: RecipientRef[${spec.protocolType}]
}

object ${spec.objectName} {

${spec.helpers}
  /** Built where an ActorSystem is in scope (it provides both implicits). */
  def definition(implicit
      ec: ExecutionContext,
      scheduler: Scheduler
  ): SagaDefinition[${spec.errorType}, ${spec.contextType}, ${spec.argsType}] =
    SagaDefinition[${spec.errorType}, ${spec.contextType}, ${spec.argsType}](
      name = "${spec.name}",
      version = ${spec.version},
      argsCodec = ArgsCodec.playJson[${spec.argsType}],
      steps = args =>
        Seq(
${spec.steps.map(emitStep).join(",\n")}
        ),
      preCheck = args =>
        if (${spec.preCheck}) Right(args) else Left(${spec.preCheckError}),
      errorText = e => ("${spec.errorCode}", e),
      onResult = (_, _) => Seq.empty
    )

  /** Call once at node startup, before cluster sharding recovers entities. */
  def register()(implicit ec: ExecutionContext, scheduler: Scheduler): Unit =
    SagaRegistry.register(definition)
}
`;

writeFileSync(outPath, out);
console.log(`emitted ${outPath} (${out.split("\n").length} lines)`);
