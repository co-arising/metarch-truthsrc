#!/usr/bin/env node
// === service-dsl emitter — 1:1 restoration of old codegen ===
// Generates: <Name>DomainService + <Name>ApplicationService
// Usage: node emit.mjs <spec.json> <out-dir>

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const [specPath, outDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const pkg = spec.package || "net.imadz.application.services";
const name = spec.name;

// DomainService - pure domain logic
const domainMethods = (spec.domainMethods || []).map(m =>
  `  def ${m.name}(${m.params || ""}): ${m.returnType || "Unit"} = {
    // ==== BEGIN MANUAL ====
    ???
    // ==== END MANUAL ====
  }`
).join("\n\n");

const domainService = `package ${pkg}.domain

/**
 * ${name}DomainService: Pure domain logic, no infrastructure.
 */
trait ${name}DomainService {

${(spec.domainMethods || []).map(m => `  def ${m.name}(${m.params || ""}): ${m.returnType || "Unit"}`).join("\n")}

}

class ${name}DomainServiceImpl extends ${name}DomainService {

${domainMethods}

}
`;

// ApplicationService - orchestrates, uses repositories
const appMethods = (spec.appMethods || []).map(m =>
  `  override def ${m.name}(${m.params || ""}): ${m.returnType || "Future[Unit]"} = {
    // ==== BEGIN MANUAL ====
    ???
    // ==== END MANUAL ====
  }`
).join("\n\n");

const appService = `package ${pkg}.application

import javax.inject.Inject
import javax.inject.Singleton
import scala.concurrent.ExecutionContext
import scala.concurrent.Future

/**
 * ${name}ApplicationService: Application service, orchestrates domain + infrastructure.
 */
trait ${name}ApplicationService {

${(spec.appMethods || []).map(m => `  def ${m.name}(${m.params || ""}): ${m.returnType || "Future[Unit]"}`).join("\n")}

}

@Singleton
class ${name}ApplicationServiceImpl @Inject() ()(implicit ec: ExecutionContext) extends ${name}ApplicationService {

${appMethods}

}
`;

writeFileSync(join(outDir, `${name}DomainService.scala`), domainService);
writeFileSync(join(outDir, `${name}ApplicationService.scala`), appService);
console.log(`emitted ${name}DomainService.scala, ${name}ApplicationService.scala`);
