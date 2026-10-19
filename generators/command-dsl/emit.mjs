#!/usr/bin/env node
// ═══ command-dsl emitter v2 — HelpersSpec → Scala (old codegen 1:1) ═══
// Matches golden_master/.../behaviors/CreditBalanceCommandHelpers.scala:
//   trait <Name>CommandHelpers {
//     implicit object <Cmd>Helper extends CommandHelper[<Cmd>, <State>, <Param>, <Confirmation>] {
//       override def toParam(...) = { // ==== BEGIN MANUAL ==== ... ??? ... // ==== END MANUAL ==== }
//       override def createFailureReply(...) = { // ==== BEGIN MANUAL ==== ... ??? ... // ==== END MANUAL ==== }
//       override def createSuccessReply(...) = { // ==== BEGIN MANUAL ==== ... ??? ... // ==== END MANUAL ==== }
//     }
//   }
// Spec: {package, objectName, stateType, commands: [{name, fields, paramType, confirmationType, paramHint}]}
// Usage: node emit.mjs <spec.json> <out.scala>

import { readFileSync, writeFileSync } from "fs";

const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const scalaType = (t) =>
  ({ string: "String", number: "BigDecimal", integer: "Int", long: "Long", boolean: "Boolean", timestamp: "Long" })[t] ?? "String";

const objName = spec.objectName || "Aggregate";
const pkg = spec.package || "generated.aggregate";
const stateType = spec.stateType || `${objName}State`;
const commands = spec.commands ?? [];

const helperFor = (c) => {
  const paramType = c.paramType || "Unit";
  const confirmationType = c.confirmationType || `${objName}Confirmation`;
  const paramHint = c.paramHint || (c.fields ?? []).map((f) => `command.${f.name}`).join(", ") || "";
  const hintBlock = paramHint ? `      ${paramHint}\n    ` : `      \n    `;

  return `
  implicit object ${c.name}Helper extends CommandHelper[${c.name}, ${stateType}, ${paramType}, ${confirmationType}] {
    override def toParam(state: ${stateType}, command: ${c.name}): ${paramType} = {
    // ==== BEGIN MANUAL ====
    /*
${hintBlock}*/
    ???
    // ==== END MANUAL ====
    }

    override def createFailureReply(param: ${paramType})(error: iMadzError): ${confirmationType} = {
      // ==== BEGIN MANUAL ====
      /*
      ???
      */
      ???
      // ==== END MANUAL ====
    }

    override def createSuccessReply(param: ${paramType})(state: ${stateType}): ${confirmationType} = {
      // ==== BEGIN MANUAL ====
      /*
      ???
      */
      ???
      // ==== END MANUAL ====
    }
  }
`;
};

const commandImports = commands.map((c) => `import ${pkg}.${c.name}`).join("\n");

const out = `package ${pkg}.behaviors

${commandImports}
import ${pkg}.${objName}Protocol._
import net.imadz.common.CommonTypes.iMadzError
import net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper


/**
 * 胶水代码库：负责将 Command 转换为 Policy 参数，并将结果包装为 Reply。
 * 这里是 AI 填空的主要战场。
 */

trait ${objName}CommandHelpers {
${commands.map(helperFor).join("\n")}
}
`;

writeFileSync(outPath, out);
console.log(`command-dsl: wrote ${objName}CommandHelpers (${commands.length} helpers) → ${outPath}`);
