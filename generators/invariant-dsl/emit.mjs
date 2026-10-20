#!/usr/bin/env node
// ═══ invariant-dsl emitter v3 — per-aggregate Rules file (ingested-app 1:1) ═══
// Matches ingested-app app/net/imadz/metarch/domain/invariant/ConceptRules.scala:
//   object <Aggregate>Rules {
//     private def err / notNull / checkAggregate   — shared helpers (checkAggregate body is intent → MANUAL/???)
//     object <Cmd>Rule extends InvariantRule[<Event>, <State>, <Cmd>Params] {
//       def apply(<subject>: <State>, <param>: <Param>): Either[iMadzError, List[<Event>]] =
//         checkAggregate(<subject>, "<Cmd>").getOrElse {
//           /* >>> AI_PROMPT_START ... <<< AI_PROMPT_END */
//           // ==== BEGIN MANUAL ==== ??? ==== END MANUAL ====
//         }
//     }
//     def checkEventPostconditions(...)            — intent → MANUAL/???
//   }
// One file per aggregate: <AggregateName>Rules.scala
// Spec: {package, aggregateName, eventType, stateType, rules: [{commandName?, name, paramType?, paramName?, subjectName?, errors?}]}
// Usage: node emit.mjs <spec.json> <out-dir>
//   (writes <AggregateName>Rules.scala into out-dir; out.scala placeholder for run-all compat)

import { readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
import { dirname, join } from "path";

const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const pascal = (s) =>
  String(s).split(/[-_ ]/).map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : "")).join("");

const pkg = spec.package || "generated.invariant";
const eventType = spec.eventType || "DomainEvent";
const stateType = spec.stateType || "DomainState";
const rules = spec.rules ?? [];

// aggregate name: explicit > objectName > derive from stateType ("XxxState" -> "Xxx")
let aggName = spec.aggregateName;
if (!aggName && spec.objectName) {
  aggName = String(spec.objectName).replace(/(Invariants|Rules|Rule)$/, "") || spec.objectName;
}
if (!aggName) {
  aggName = stateType.endsWith("State") ? stateType.slice(0, -5) : "Aggregate";
}
aggName = pascal(aggName);
const containerName = `${aggName}Rules`;

const ruleObjects = rules
  .map((r) => {
    const cmdBase = r.commandName || r.name || "Command";
    const cmdName = pascal(String(cmdBase).replace(/Rule$/, ""));
    const objName = `${cmdName}Rule`;
    const paramType = r.paramType || `${cmdName}Params`;
    const paramName = r.paramName || "p";
    const subjectName = r.subjectName || "state";

    return `  object ${objName} extends InvariantRule[${eventType}, ${stateType}, ${paramType}] {
    def apply(${subjectName}: ${stateType}, ${paramName}: ${paramType}): Either[iMadzError, List[${eventType}]] =
      checkAggregate(${subjectName}, "${cmdName}").getOrElse {
      /*
      >>> AI_PROMPT_START
      Context: Invariant Rule Execution
      Task: Validate conditions and generate events
      Subject: ${subjectName}
      Trigger: ${paramName}
      Goal: If all validations pass (logic below), return Right(List(events...)).
      <<< AI_PROMPT_END
      */

      // ==== BEGIN MANUAL ====
      ???
      // ==== END MANUAL ====
      }
  }`;
  })
  .join("\n\n");

const out = `package ${pkg}

import net.imadz.common.CommonTypes.InvariantRule
import net.imadz.common.CommonTypes.iMadzError

object ${containerName} {
  private def err(code: String, msg: String): Left[iMadzError, List[${eventType}]] =
    Left(iMadzError(code, msg))

  private def notNull(v: String): Boolean = Option(v).exists(_.nonEmpty)

  // ==== BEGIN MANUAL ====
  // Aggregate-level invariant checks, run before command-level rules.
  // Intent: concrete aggregate-level conditions live here, filled by human/agent.
  private def checkAggregate(state: ${stateType}, cmd: String): Option[Left[iMadzError, List[${eventType}]]] = {
    ???
  }
  // ==== END MANUAL ====

${ruleObjects}

  // ==== BEGIN MANUAL ====
  // Event postcondition checks: events produced by a command must satisfy these.
  // Intent: per-event checks filled by human/agent.
  def checkEventPostconditions(events: List[${eventType}]): Option[iMadzError] = {
    ???
  }
  // ==== END MANUAL ====
}
`;

// outPath may be a file (run-all) or dir — resolve to a directory
let outDir;
try {
  outDir = statSync(outPath).isDirectory() ? outPath : dirname(outPath);
} catch {
  outDir = outPath.endsWith(".scala") ? dirname(outPath) : outPath;
}
mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, `${containerName}.scala`), out);

// ── params/<Aggregate>RuleParams.scala ──
// Per-command parameter case classes, referenced as <Cmd>Params by rule objects.
// Uses allCommands (all aggregate commands) not just rules — ingested-app has 27/27 params files.
const scalaTypeOf = (t) =>
  ({ string: "String", number: "BigDecimal", integer: "Int", long: "Long", boolean: "Boolean", timestamp: "Long" })[t] ?? "String";
const paramsSource = spec.allCommands ?? rules;
const paramObjects = paramsSource
  .map((r) => {
    const cmdBase = r.commandName || r.name || "Command";
    const cmdName = pascal(String(cmdBase).replace(/Rule$/, ""));
    const pfields = (r.fields || []).map((f) => `${f.name}: ${scalaTypeOf(f.dataType)}`).join(", ");
    return `  case class ${cmdName}Params(${pfields})`;
  })
  .join("\n");

if (paramObjects) {
  const paramsDir = join(outDir, "params");
  mkdirSync(paramsDir, { recursive: true });
  const paramsOut = `package ${pkg}.params

object ${containerName}Params {
${paramObjects}
}
`;
  writeFileSync(join(paramsDir, `${aggName}RuleParams.scala`), paramsOut);
  console.log(`invariant-dsl: wrote params/${aggName}RuleParams.scala`);
}

console.log(`invariant-dsl: wrote ${containerName}.scala`);

// placeholder for run-all single-file contract
if (outPath.endsWith(".scala")) {
  writeFileSync(outPath, `// generated: ${containerName}.scala\n`);
}
