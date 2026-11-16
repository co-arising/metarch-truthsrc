#!/usr/bin/env node
// === connector-dsl emitter — 1:1 restoration of old codegen ===
// Generates: <Name>Connector (trait) + <Name>ConnectorImpl
// Usage: node emit.mjs <spec.json> <out-dir>

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const [specPath, outDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const pkg = spec.package || "net.imadz.infrastructure.connectors";
const name = spec.name;
const ifaceName = `${name}Connector`;
const implName = `${name}ConnectorImpl`;

const methods = (spec.methods || []).map(m =>
  `  def ${m.name}(${m.params || ""}): ${m.returnType || "Future[Unit]"}`
).join("\n");

const implMethods = (spec.methods || []).map(m =>
  `  override def ${m.name}(${m.params || ""}): ${m.returnType || "Future[Unit]"} = {
    // ==== BEGIN MANUAL ====
    ???
    // ==== END MANUAL ====
  }`
).join("\n\n");

const iface = `package ${pkg}

import scala.concurrent.Future

/**
 * ${ifaceName}: External system connector interface
 */
trait ${ifaceName} {

${methods}

}
`;

const impl = `package ${pkg}

import javax.inject.Inject
import javax.inject.Singleton
import scala.concurrent.ExecutionContext
import scala.concurrent.Future

/**
 * ${implName}: ${ifaceName} implementation
 */
@Singleton
class ${implName} @Inject() ()(implicit ec: ExecutionContext) extends ${ifaceName} {

${implMethods}

}
`;

writeFileSync(join(outDir, `${ifaceName}.scala`), iface);
writeFileSync(join(outDir, `${implName}.scala`), impl);
console.log(`emitted ${ifaceName}.scala, ${implName}.scala`);
