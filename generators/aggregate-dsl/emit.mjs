#!/usr/bin/env node
// ═══ aggregate-dsl emitter — AggregateSpec → Scala (Akka ES) ═══
// Emits a complete aggregate: state + commands + events + EventSourcedBehavior.
// Commands/events are defined inline (they belong to the aggregate in DDD).
// Usage: node emit.mjs <spec.json> <out.scala>

import { readFileSync, writeFileSync } from "fs";

const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const scalaType = (t) =>
  ({ string: "String", number: "BigDecimal", integer: "Int", long: "Long", boolean: "Boolean", timestamp: "Long" })[t] ?? "String";

const fieldsOf = (fields) => fields.map((f) => `${f.name}: ${scalaType(f.dataType)}`).join(", ");

const stateFields = fieldsOf(spec.stateFields);

const commandDefs = (spec.commands ?? [])
  .map((c) => `final case class ${c.name}(${fieldsOf(c.fields ?? [])}) extends ${spec.commandType}`)
  .join("\n");

const eventDefs = (spec.events ?? [])
  .map((e) => `final case class ${e.name}(${fieldsOf(e.fields ?? [])}) extends ${spec.eventType}`)
  .join("\n");

const pascal = (s) => s.split(/[-_]/).map((w) => w[0].toUpperCase() + w.slice(1)).join("");

function emitEventHandler() {
  const eventNames = new Set((spec.events ?? []).map((e) => e.name));
  const cases = Object.entries(spec.statusTransitions ?? {})
    .map(([key, status]) => [pascal(key), status])
    .filter(([event, _]) => eventNames.has(event))
    .map(([event, status]) => `      case _: ${event} => state.copy(terminalState = "${status}")`);
  return `  private def applyEvent(state: ${spec.stateType}, event: ${spec.eventType}): ${spec.stateType} =
    event match {
${cases.join("\n")}
      case _ => state
    }`;
}

function emitCommandHandler() {
  const cases = (spec.commandHandlers ?? []).map(
    (h) => `      case cmd: ${h.command} =>\n        ${h.logic}`
  );
  return `  private def handleCommand(state: ${spec.stateType}, cmd: ${spec.commandType}): Effect[${spec.eventType}, ${spec.stateType}] =
    cmd match {
${cases.join("\n")}
      case _ => Effect.unhandled
    }`;
}

const out = `package ${spec.package}

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class ${spec.stateType}(${stateFields}) extends CborSerializable

sealed trait ${spec.commandType} extends CborSerializable
${commandDefs}

sealed trait ${spec.eventType} extends CborSerializable
${eventDefs}

object ${spec.objectName} {
  def behavior(persistenceId: PersistenceId): Behavior[${spec.commandType}] =
    EventSourcedBehavior[${spec.commandType}, ${spec.eventType}, ${spec.stateType}](
      persistenceId = persistenceId,
      emptyState = ${spec.emptyState},
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

${emitCommandHandler()}

${emitEventHandler()}
}
`;

writeFileSync(outPath, out);
console.log(`emitted ${outPath}`);
