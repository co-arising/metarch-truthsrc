#!/usr/bin/env node
// ═══ aggregate-dsl emitter v4 — ingested-app 1:1 ═══
// Matches ingested-app / golden scala-cqrs-es-metarch pattern:
//
//   application/aggregates/<Name>Protocol.scala
//     — imports State/Event from domain.entities.<Name>Entity
//     — sealed trait <Name>CommandFamily + per-command case classes (replyTo: ActorRef[<Cmd>Reply])
//     — per-command <Cmd>Reply case classes
//     — type <Name>CommandHandlerFamily
//   application/aggregates/<Name>Aggregate.scala
//     — object with entityTypeKey + tags + commandHandler wiring
//   application/aggregates/behaviors/<Name>Behaviors.scala
//   application/aggregates/factories/<Name>AggregateFactory.scala
//   domain/entities/<Name>Entity.scala            (NEW v4)
//     — object <Name>Entity { case class <Name>State; def empty; sealed trait <Name>Event; event case classes; type <Name>EventHandler }
//   domain/entities/behaviors/<Name>EventHandler.scala  (NEW v4)
//     — object <Name>EventHandler { def apply ... event match ... }
//
// Spec: {package, name, objectName, stateType, eventType, stateFields,
//        commands: [{name, fields}], events: [{name, fields}],
//        commandHandlers: [{command}],
//        entityDir (abs path for domain/entities), entityPackage,
//        invariantPackage (for Behaviors rule import)}
// Usage: node emit.mjs <spec.json> <out-dir>
//   (out-dir = application/aggregates dir; entity files go to spec.entityDir)

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

const [specPath, outPathArg] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
// outPath may be a marker file (run-all dir mode) — resolve to its directory
const outDir = outPathArg.endsWith(".scala") ? dirname(outPathArg) : outPathArg;

const scalaType = (t) =>
  ({ string: "String", number: "BigDecimal", integer: "Int", long: "Long", boolean: "Boolean", timestamp: "Long" })[t] ?? "String";

const fieldsOf = (fields) =>
  (fields ?? []).map((f) => `${f.name}: ${scalaType(f.dataType)}`).join(", ");

const pascal = (s) =>
  String(s).split(/[-_ ]/).map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : "")).join("");

const objName = spec.objectName || pascal(spec.name || "Aggregate");
const pkg = spec.package || "generated.aggregate";
const entityPkg = spec.entityPackage || pkg.replace(/\.application\.aggregates$/, ".domain.entities");
const stateType = spec.stateType || `${objName}State`;
const eventType = spec.eventType || `${objName}Event`;
const commandFamily = `${objName}CommandFamily`;
const handlerFamily = `${objName}CommandHandlerFamily`;

const handled = new Set((spec.commandHandlers ?? []).map((h) => h.command));
const commands = spec.commands ?? [];
const events = spec.events ?? [];

// ═══ 1. Entity (domain/entities/<Name>Entity.scala) ═══
// Canonical home of State + Events. Protocol imports from here.
const entityStateDef = `  case class ${stateType}(${fieldsOf(spec.stateFields)})`;

const entityEventDefs = events
  .map((e) => `  case class ${e.name}(${fieldsOf(e.fields)}) extends ${eventType}`)
  .join("\n");

const entity = `package ${entityPkg}

import net.imadz.common.CborSerializable

object ${objName}Entity {

${entityStateDef}

  // ==== BEGIN MANUAL ====
  // empty(): construct the initial state. Intent: field defaults filled by human/agent.
  def empty: ${stateType} = {
    ???
  }
  // ==== END MANUAL ====

  sealed trait ${eventType} extends CborSerializable
${entityEventDefs}

  type ${objName}EventHandler = (${stateType}, ${eventType}) => ${stateType}

}
`;

// ═══ 2. EventHandler (domain/entities/behaviors/<Name>EventHandler.scala) ═══
const handlerCases = events
  .map(
    (e) => `    case event: ${e.name} =>
      /*
      >>> AI_PROMPT_START
      Context: Event Handler (state fold)
      Task: Fold event '${e.name}' into state
      State: ${stateType}
      Expected Result: Return updated state via state.copy(...)
      <<< AI_PROMPT_END
      */
      // ==== BEGIN MANUAL ====
      ???
      // ==== END MANUAL ====
`
  )
  .join("\n");

const eventHandler = `package ${entityPkg}.behaviors

import ${entityPkg}.${objName}Entity._
import ${entityPkg}.${objName}Entity.${eventType}
import ${entityPkg}.${objName}Entity.${objName}EventHandler
import ${entityPkg}.${objName}Entity.${stateType}

object ${objName}EventHandler {
  def apply: ${objName}EventHandler = (state, event) => event match {
${handlerCases}
    case _ => state
  }
}
`;

// ═══ 3. Protocol (application/aggregates/<Name>Protocol.scala) ═══
// Commands + per-command Replies. State/Event imported from Entity.
const commandDefs = commands
  .map((c) => {
    const fields = fieldsOf(c.fields);
    const allFields = fields ? `${fields}, replyTo: ActorRef[${c.name}Reply]` : `replyTo: ActorRef[${c.name}Reply]`;
    return `  case class ${c.name}(${allFields}) extends ${commandFamily}`;
  })
  .join("\n");

const replyDefs = commands
  .map((c) => `  case class ${c.name}Reply(error: Option[iMadzError]) extends CborSerializable`)
  .join("\n");

const protocol = `package ${pkg}

import akka.actor.typed.ActorRef
import net.imadz.common.CborSerializable
import net.imadz.common.CommonTypes.iMadzError
import ${entityPkg}.${objName}Entity.${eventType}
import ${entityPkg}.${objName}Entity.${stateType}

object ${objName}Protocol {

  // Commands
  sealed trait ${commandFamily} extends CborSerializable
${commandDefs}

  // Replies
${replyDefs}

  // CommandHandler type alias (moved from Aggregate to break circular dependency)
  type ${handlerFamily} = (${stateType}, ${commandFamily}) => akka.persistence.typed.scaladsl.Effect[${eventType}, ${stateType}]

}
`;

// ═══ 4. Aggregate ═══
const kebab = objName.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
const aggregate = `package ${pkg}

import akka.cluster.sharding.typed.scaladsl.EntityTypeKey
import akka.persistence.typed.scaladsl.Effect
import ${entityPkg}.${objName}Entity.${eventType}
import ${entityPkg}.${objName}Entity.${stateType}
import ${pkg}.${commandFamily}
import ${pkg}.behaviors.${objName}Behaviors

object ${objName}Aggregate {

  def commandHandler: ${pkg}.${handlerFamily} = ${objName}Behaviors.apply

  val entityTypeKey: EntityTypeKey[${commandFamily}] = EntityTypeKey("${objName}")
  val tags: Vector[String] = Vector.tabulate(5)(i => s"${kebab}-$i")

}
`;

// ═══ 5. Behaviors ═══
const invariantPkg = spec.invariantPackage || `${pkg}.invariant`;
const hasHandled = commands.some((c) => handled.has(c.name));
const ruleImport = hasHandled ? `import ${invariantPkg}.${objName}Rules` : "";

const behaviorCases = commands
  .map((c) => {
    if (handled.has(c.name)) {
      const rule = `${objName}Rules.${c.name}Rule`;
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
import ${entityPkg}.${objName}Entity.${eventType}
import ${entityPkg}.${objName}Entity.${stateType}
import ${pkg}.${commandFamily}
import ${pkg}.${objName}Protocol
import ${pkg}.${objName}Protocol._
${ruleImport}
import net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy
import scala.concurrent.duration._

object ${objName}Behaviors extends ${objName}CommandHelpers {

  type ${objName}AggregateCommandHandler = (${stateType}, ${commandFamily}) => Effect[${eventType}, ${stateType}]
  def apply: ${objName}AggregateCommandHandler = (state, command) => defaultBehaviors(state).apply(command)

  private def defaultBehaviors(state: ${stateType}): PartialFunction[${commandFamily}, Effect[${eventType}, ${stateType}]] = {
${behaviorCases}
  }

}
`;

// ═══ 6. Factory ═══
const factoryMethods = commands
  .map(
    (c) => `  def create${objName}For${c.name}(id: String): EntityRef[${commandFamily}] = {
    clusterSharding.entityRefFor(${objName}Aggregate.entityTypeKey, id)
  }`
  )
  .join("\n\n");

const factory = `package ${pkg}.factories

import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import akka.cluster.sharding.typed.scaladsl.EntityRef
import akka.util.Timeout
import javax.inject.Inject
import ${pkg}.${objName}Aggregate
import ${pkg}.${commandFamily}
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._

/**
 * ${objName}AggregateFactory: creates ${objName} aggregate instances via cluster sharding
 */
class ${objName}AggregateFactory @Inject() (clusterSharding: ClusterSharding)(implicit ec: ExecutionContext) {
  implicit val askTimeout: Timeout = Timeout(10.seconds)

${factoryMethods}

}
`;

// ═══ Write ═══
const behaviorsDir = join(outDir, "behaviors");
const factoriesDir = join(outDir, "factories");
mkdirSync(behaviorsDir, { recursive: true });
mkdirSync(factoriesDir, { recursive: true });

writeFileSync(join(outDir, `${objName}Protocol.scala`), protocol);
writeFileSync(join(outDir, `${objName}Aggregate.scala`), aggregate);
writeFileSync(join(behaviorsDir, `${objName}Behaviors.scala`), behaviors);
writeFileSync(join(factoriesDir, `${objName}AggregateFactory.scala`), factory);

// Entity files go to spec.entityDir (domain/entities tree)
if (spec.entityDir) {
  const entityBehDir = join(spec.entityDir, "behaviors");
  mkdirSync(spec.entityDir, { recursive: true });
  mkdirSync(entityBehDir, { recursive: true });
  writeFileSync(join(spec.entityDir, `${objName}Entity.scala`), entity);
  writeFileSync(join(entityBehDir, `${objName}EventHandler.scala`), eventHandler);
}

console.log(
  `aggregate-dsl: wrote ${objName}Protocol.scala, ${objName}Aggregate.scala, behaviors/${objName}Behaviors.scala, factories/${objName}AggregateFactory.scala` +
    (spec.entityDir ? `, entities/${objName}Entity.scala, entities/behaviors/${objName}EventHandler.scala` : "")
);
