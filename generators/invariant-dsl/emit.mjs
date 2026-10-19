#!/usr/bin/env node
// ═══ invariant-dsl emitter v2 — RuleSpec → Scala (old codegen 1:1) ═══
// Matches golden_master/net/imadz/domain/invariant/WithdrawRuleRule.scala:
//   object <Name>Rule extends InvariantRule[<Event>, <State>, <Param>] {
//     private val <ErrVal>: iMadzError = iMadzError("<code>", "<msg>")
//     def apply(<subject>: <State>, <param>: <Param>): Either[iMadzError, List[<Event>]] = {
//       /* >>> AI_PROMPT_START ... <<< AI_PROMPT_END */
//       // TODO: All conditions passed. Generate events.
//       ???
//     }
//   }
// Spec: {package, eventType, stateType, rules: [{name, paramType, paramName, subjectName, errors: [{valName, code, message}]}]}
//   rule.name = e.g. "WithdrawRule" → object "WithdrawRuleRule" (old convention: <RuleName>Rule)
// Usage: node emit.mjs <spec.json> <out-dir>
//   (writes one <Name>Rule.scala per rule into out-dir; out.scala placeholder for run-all compat)

import { readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
import { dirname, join } from "path";

const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const pkg = spec.package || "generated.invariant";
const eventType = spec.eventType || "DomainEvent";
const stateType = spec.stateType || "DomainState";
const rules = spec.rules ?? [];

// outPath may be a file (run-all) or dir — resolve to a directory
let outDir;
try {
  outDir = statSync(outPath).isDirectory() ? outPath : dirname(outPath);
} catch {
  outDir = outPath.endsWith(".scala") ? dirname(outPath) : outPath;
}
mkdirSync(outDir, { recursive: true });

for (const r of rules) {
  const ruleName = r.name; // e.g. "WithdrawRule"
  const objName = `${ruleName}Rule`; // e.g. "WithdrawRuleRule" (old convention)
  const paramType = r.paramType || "Unit";
  const paramName = r.paramName || "param";
  const subjectName = r.subjectName || stateType.charAt(0).toLowerCase() + stateType.slice(1);
  const errors = r.errors ?? [];

  const errorVals = errors
    .map((e) => `  private val ${e.valName}: iMadzError = iMadzError("${e.code}", "${e.message}")`)
    .join("\n");
  const definedConditions = errors.map((e) => e.valName).join(", ");

  const out = `package ${pkg}

import net.imadz.common.CommonTypes.InvariantRule
import net.imadz.common.CommonTypes.iMadzError

object ${objName} extends InvariantRule[${eventType}, ${stateType}, ${paramType}] {
${errorVals ? errorVals + "\n" : ""}
  def apply(${subjectName}: ${stateType}, ${paramName}: ${paramType}): Either[iMadzError, List[${eventType}]] = {
    /*
    >>> AI_PROMPT_START
    Context: Invariant Rule Execution
    Task: Validate conditions and generate events
    Subject: ${subjectName}
    Trigger: ${paramName}
    Defined Conditions: ${definedConditions}
    Goal: If all validations pass (logic below), return Right(List(events...)).
    <<< AI_PROMPT_END
    */

    // Result
    {
      // TODO: All conditions passed. Generate events.
      ???
    }
  }
}
`;

  writeFileSync(join(outDir, `${objName}.scala`), out);
  console.log(`invariant-dsl: wrote ${objName}.scala`);
}

// placeholder for run-all single-file contract
if (outPath.endsWith(".scala")) {
  writeFileSync(outPath, `// generated: ${rules.map((r) => `${r.name}Rule.scala`).join(", ")}\n`);
}
