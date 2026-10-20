#!/usr/bin/env node
// === service-dsl emitter — 1:1 restoration of old codegen ===
// Ported from:
//   - ApplicationServiceTemplate.scala (application services)
//   - QueryServiceTemplate.scala (query services)
//   - DomainServiceTemplate.scala (domain services)
// Generates: <Name>ApplicationService / <Name>QueryService / <Name>DomainService
// Pattern matches ingested-app golden output.
// Usage: node emit.mjs <spec.json> <out-dir>

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const [specPath, outDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const pkg = spec.package || "net.imadz.metarch.application";
const name = spec.name;
const kind = spec.kind || "application"; // application | query | domain

const firstLower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const scalaId = (s) => s; // simplified

// ─── Application Service ───
// Template: ApplicationServiceTemplate.scala
// - @Singleton class with @Inject() ctor
// - Dependencies filtered to Repository/Factory/Service/Query/Connector/ActorSystem
// - Methods with MANUAL blocks
function emitApplicationService() {
  const deps = (spec.dependencies || [])
    .filter(d => !["Inject", "Singleton", "ExecutionContext"].includes(d.name))
    .filter(d => !d.packageName.startsWith("scala") && !d.packageName.startsWith("java"))
    .filter(d => {
      const n = d.name;
      return n.endsWith("Repository") || n.endsWith("Factory") || n.endsWith("Service") ||
             n.endsWith("Query") || n.endsWith("Connector") || n === "ActorSystem";
    });

  const baseImports = (spec.dependencies || [])
    .map(d => d.fqn).filter(Boolean).sort()
    .filter(t => !["javax.inject.Inject", "javax.inject.Singleton", "scala.concurrent.ExecutionContext"].includes(t))
    .filter(t => !t.startsWith("scala") && !t.startsWith("java.lang"));
  const additionalImports = [
    "javax.inject.{Inject, Singleton}",
    "scala.concurrent.{ExecutionContext, Future}",
    "akka.actor.typed.scaladsl.adapter._",
  ];
  const allImports = [...new Set([...baseImports, ...additionalImports])].sort();
  const importDecl = allImports.map(i => `import ${i}`).join("\n");

  const ctorArgs = deps.map(d => {
    const pn = firstLower(d.name);
    if (d.name === "ActorSystem") return `classicSystem: akka.actor.ActorSystem`;
    return `${pn}: ${d.name}`;
  }).join(",\n    ");

  const methods = (spec.methods || []).map(m => {
    const params = (m.parameters || []).map(p => `${scalaId(p.name)}: ${p.typeRef}`).join(", ");
    return `  def ${m.name}(${params}): ${m.returnType} = {
    // ==== BEGIN MANUAL ====
    ???
    // ==== END MANUAL ====
  }`;
  }).join("\n\n");

  const extraFields = deps.some(d => d.name === "ActorSystem")
    ? "\n  private val system = classicSystem.toTyped\n" : "";

  return `package ${pkg}

${importDecl}

@Singleton
class ${name} @Inject() (
    ${ctorArgs}
) (implicit ec: ExecutionContext) {
${extraFields}
${methods}

}
`;
}

// ─── Query Service ───
// Template: QueryServiceTemplate.scala
// - class with @Inject() ctor (no @Singleton)
// - Companion object with DTO case classes
// - Methods with AI_PROMPT blocks
// - Timeout support
function emitQueryService() {
  const deps = (spec.dependencies || [])
    .filter(d => !["Inject", "Timeout", "ExecutionContext", "Singleton"].includes(d.name))
    .filter(d => !d.packageName.startsWith("scala") && !d.packageName.startsWith("java"))
    .filter(d => {
      const n = d.name;
      return n.endsWith("Repository") || n.endsWith("Factory") || n.endsWith("Service") || n.endsWith("Query");
    });

  const baseImports = (spec.dependencies || [])
    .map(d => d.fqn).filter(Boolean).sort()
    .filter(t => !["javax.inject.Inject", "scala.concurrent.ExecutionContext", "akka.util.Timeout"].includes(t))
    .filter(t => !t.startsWith("scala") && !t.startsWith("java.lang"));
  const additionalImports = [
    "javax.inject.Inject",
    "scala.concurrent.ExecutionContext",
    "scala.concurrent.Future",
    "akka.util.Timeout",
  ];
  const allImports = [...new Set([...baseImports, ...additionalImports])].sort();
  const importDecl = allImports.map(i => `import ${i}`).join("\n");

  const ctorArgs = deps.map(d => `${firstLower(d.name)}: ${d.name}`).join(",\n    ");
  const availableDeps = deps.map(d => firstLower(d.name)).join(", ");

  const structs = (spec.structs || []).map(s => {
    const fields = (s.fields || []).map(f => `${scalaId(f.name)}: ${f.typeRef}`).join(", ");
    const ext = (s.extendsReadModel ? " extends ReadModel" : "");
    return `  case class ${s.name}(${fields})${ext}`;
  }).join("\n\n");
  const companion = structs ? `object ${name} {\n${structs}\n}\n\n` : "";

  const methods = (spec.methods || []).map(m => {
    const params = (m.parameters || []).map(p => `${scalaId(p.name)}: ${p.typeRef}`).join(", ");
    const logicDesc = (m.bodyLogic || "").replace(/\n/g, " ").trim();
    return `
  /**
   * ${m.name}
   */
  def ${m.name}(${params}): ${m.returnType} = {
    /*
    >>> AI_PROMPT_START
    Context: Query Service (Read Side)
    Task: Implement query logic for '${m.name}'
    Description: ${logicDesc}
    Available Repos/Services: ${availableDeps}
    Input Params: ${params}
    Return: ${m.returnType}
    <<< AI_PROMPT_END
    */
    ???
  }
`;
  }).join("\n");

  const hasTimeout = (spec.dependencies || []).some(d => d.name === "Timeout");
  const timeoutDef = hasTimeout
    ? "\n  implicit val askTimeout: Timeout = Timeout(30 seconds)\n  import scala.concurrent.duration.DurationInt\n  import scala.language.postfixOps" : "";

  return `package ${pkg}

${importDecl}

${companion}/**
 * ${name}: Query Service
 */
class ${name} @Inject() (${ctorArgs}) (implicit val ec: ExecutionContext) {
${timeoutDef}

${methods}
}
`;
}

// ─── Domain Service ───
// Template: DomainServiceTemplate.scala
// - object (not class) extending superInterface
// - Methods with /* logicCode */ + ??? bodies
function emitDomainService() {
  const imports = (spec.dependencies || [])
    .map(d => d.fqn).filter(Boolean).sort()
    .filter(p => p && p !== pkg && !p.startsWith("java.lang"));
  const importDecl = imports.map(i => `import ${i}`).join("\n");

  const methods = (spec.methods || []).map(m => {
    const params = (m.parameters || []).map(p => `${scalaId(p.name)}: ${p.typeRef}`).join(", ");
    return `  def ${m.name}(${params}): ${m.returnType} = {
  /*
    ${m.logicCode || ""}
    */
    ???
  }`;
  }).join("\n\n");

  const extendsClause = spec.superInterface ? ` extends ${spec.superInterface}` : "";

  return `package ${pkg}

${importDecl}

object ${name}${extendsClause} {
${methods}
}
`;
}

// ─── Main ───
let output, fileName;
if (kind === "query") {
  output = emitQueryService();
  fileName = `${name}.scala`;
} else if (kind === "domain") {
  output = emitDomainService();
  fileName = `${name}.scala`;
} else {
  output = emitApplicationService();
  fileName = `${name}.scala`;
}

writeFileSync(join(outDir, fileName), output);
console.log(`emitted ${fileName} (${kind})`);
