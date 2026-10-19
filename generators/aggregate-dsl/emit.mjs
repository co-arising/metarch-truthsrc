#!/usr/bin/env node
// ═══ aggregate-dsl emitter v2 — AggregateSpec → 3 Scala files (old codegen 1:1) ═══
// Matches golden_master/net/imadz/application/aggregates/CreditBalance*.scala pattern:
//   <Name>Protocol.scala          — sealed Command trait + case classes (replyTo) + Confirmations + CommandHandler type alias
//   <Name>Aggregate.scala         — object with commandHandler wiring + entityTypeKey + tags
//   behaviors/<Name>Behaviors.scala — object extends <Name>CommandHelpers, runReplyingPolicy groups, AI_PROMPT for unhandled
// Usage: node emit.mjs <spec.json> <out.scala>
//   (out.scala is a placeholder; the 3 files are written alongside it in the same dir)

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const scalaType = (t) =>
  ({ string: "String", number: "BigDecimal", integer: "Int", long: "Long", boolean: "Boolean", timestamp: "Long" })[t] ?? "String";

const fieldsOf = (fields) =>
  (fields ?? []).map((f) => `${f.name}: ${scalaType(f.dataType)}`).join(", ");

const pascal = (s) =>
  String(s).split(/[-_ ]/).map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : "")).join("");

const objName = spec.objectName || pascal(spec.name || "Aggregate");
const pkg = spec.package || "generated.aggregate";
const stateType = spec.stateType || `${objName}State`;
const eventType = spec.eventType || `${objName}Event`;
const commandTrait = `${objName}Command`;
const confirmation = `${objName}Confirmation`;

// Commands with handlers (slice-derived) get runReplyingPolicy; others get AI_PROMPT
const handled = new Set((spec.commandHandlers ?? []).map((h) => h.command));
const commands = spec.commands ?? [];
const events = spec.events ?? [];

// ── 1. Protocol ──
const commandDefs = commands
  .map((c) => {
    const fields = fieldsOf(c.fields);
    const allFields = fields ? `${fields}, replyTo: ActorRef[${confirmation}]` : `replyTo: ActorRef[${confirmation}]`;
    return `  case class ${c.name}(${allFields}) extends ${commandTrait}`;
  })
  .join("\n");

const eventDefs = events
  .map((e) => `  case class ${e.name}(${fieldsOf(e.fields)}) extends ${eventType}`)
  .join("\n");

const protocol = `package ${pkg}

import akka.actor.typed.ActorRef
import net.imadz.common.CborSerializable

object ${objName}Protocol {

  // Commands
  sealed trait ${commandTrait} extends CborSerializable
${commandDefs}

  // Events
  sealed trait ${eventType} extends CborSerializable
${eventDefs}

  // Replies
  case class ${confirmation}(error: Option[String], message: String) extends CborSerializable

  // CommandHandler type alias (moved from Aggregate to break circular dependency)
  type ${objName}CommandHandler = (${stateType}, ${commandTrait}) => akka.persistence.typed.scaladsl.Effect[${eventType}, ${stateType}]

}
`;

// ── 2. Aggregate ──
const kebab = objName.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
const aggregate = `package ${pkg}

import akka.cluster.sharding.typed.scaladsl.EntityTypeKey
import akka.persistence.typed.scaladsl.Effect
import ${pkg}.behaviors.${objName}Behaviors

object ${objName}Aggregate {

// Commands are defined in Protocol
// Replies are defined in Protocol

  // Wiring (Separated Behavior) - Type alias now in Protocol
  def commandHandler: ${pkg}.${objName}CommandHandler = ${objName}Behaviors.apply

  val entityTypeKey: EntityTypeKey[${commandTrait}] = EntityTypeKey("${objName}")
  val tags: Vector[String] = Vector.tabulate(5)(i => s"${kebab}-$$i")

}
`;

// ── 3. Behaviors ──
const commandImports = commands.map((c) => `import ${pkg}.${c.name}`).join("\n");

const behaviorCases = commands
  .map((c) => {
    if (handled.has(c.name)) {
      const rule = `${c.name}RuleRule`; // old convention: <Cmd>RuleRule (cf. WithdrawRuleRule)
      const helper = `${c.name}Helper`;
      return `    case cmd: ${c.name} => runReplyingPolicy(${rule}, ${helper})(state, cmd).replyWith(cmd.replyTo)`;
    } else {
      return `    case ${c.name}(replyTo) =>
      /*
      >>> AI_PROMPT_START
      Context: Command Handler
      Task: Handle command '${c.name}'
      State: ${stateType}
      Available: repo
      Expected Result: Return Effect.persist(event) or Effect.reply
      <<< AI_PROMPT_END
      */
      ???`;
    }
  })
  .join("\n");

const behaviors = `package ${pkg}.behaviors

import akka.persistence.typed.scaladsl.Effect
import ${pkg}.${commandTrait}
import ${pkg}.${confirmation}
import ${pkg}.${objName}Protocol
import ${pkg}.${objName}Protocol._
${commandImports}
import net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy
import scala.concurrent.duration._

object ${objName}Behaviors extends ${objName}CommandHelpers {

  type ${objName}AggregateCommandHandler = (${stateType}, ${commandTrait}) => Effect[${eventType}, ${stateType}]
  def apply: ${objName}AggregateCommandHandler = (state, command) => defaultBehaviors(state).apply(command)

  private def defaultBehaviors(state: ${stateType}): PartialFunction[${commandTrait}, Effect[${eventType}, ${stateType}]] = {
${behaviorCases}
  }

}
`;

// ── Write ──
const outDir = dirname(outPath);
const behaviorsDir = join(outDir, "behaviors");
mkdirSync(behaviorsDir, { recursive: true });

writeFileSync(join(outDir, `${objName}Protocol.scala`), protocol);
writeFileSync(join(outDir, `${objName}Aggregate.scala`), aggregate);
writeFileSync(join(behaviorsDir, `${objName}Behaviors.scala`), behaviors);
// placeholder so run-all's single-file contract still resolves
writeFileSync(outPath, `// generated: ${objName}Protocol.scala, ${objName}Aggregate.scala, behaviors/${objName}Behaviors.scala\n`);

console.log(`aggregate-dsl: wrote ${objName}Protocol.scala, ${objName}Aggregate.scala, behaviors/${objName}Behaviors.scala`);
