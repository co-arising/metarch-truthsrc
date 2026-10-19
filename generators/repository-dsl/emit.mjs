#!/usr/bin/env node
// ═══ repository-dsl emitter — 1:1 restoration of old codegen ═══
// Generates: <Name>Repository (trait) + <Name>RepositoryImpl (@Singleton)
// For aggregates: sharding-based EntityRef lookup
// For projections: MANUAL sections with scalikejdbc
// Usage: node emit.mjs <spec.json> <out-dir>

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const [specPath, outDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const pkg = spec.package || "net.imadz.infrastructure.repositories";
const name = spec.name; // e.g. "CreditBalance"
const kind = spec.kind || "aggregate"; // "aggregate" | "projection"

function emitAggregate() {
  const ifaceName = `${name}Repository`;
  const implName = `${name}RepositoryImpl`;
  const cmdFamily = `${name}CommandFamily`;
  const command = `${name}Command`;

  const iface = `package ${pkg}.aggregate

import akka.cluster.sharding.typed.scaladsl.EntityRef
import ${spec.aggregatePackage || "net.imadz.application.aggregates"}.${command}
import ${spec.aggregatePackage || "net.imadz.application.aggregates"}.${name}Protocol.${cmdFamily}
import net.imadz.common.CommonTypes.Id

/**
 * ${ifaceName}: Aggregate Repository Interface
 */
trait ${ifaceName} {

  def entityRef(id: String): EntityRef[${cmdFamily}]

${(spec.methods || []).map(m =>
  `  def ${m.name}(${m.params}): EntityRef[${m.returnType}]`).join("\n")}

}
`;

  const impl = `package ${pkg}.aggregate

import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import akka.cluster.sharding.typed.scaladsl.EntityRef
import javax.inject.Inject
import javax.inject.Singleton
import ${spec.aggregatePackage || "net.imadz.application.aggregates"}.${name}Aggregate
import ${spec.aggregatePackage || "net.imadz.application.aggregates"}.${command}
import ${spec.aggregatePackage || "net.imadz.application.aggregates"}.${name}Protocol.${cmdFamily}
import ${spec.repositoryPackage || "net.imadz.application.aggregates.repository"}.${ifaceName}
import net.imadz.common.CommonTypes.Id

/**
 * ${implName}: Aggregate Repository Implementation
 * Implementation of ${ifaceName} interface
 */
@Singleton
class ${implName} @Inject() (sharding: ClusterSharding) extends ${ifaceName} {

  override def entityRef(id: String): EntityRef[${cmdFamily}] =
    sharding.entityRefFor(${name}Aggregate.entityTypeKey, id.toString)

${(spec.methods || []).map(m =>
  `  override def ${m.name}(${m.params}): EntityRef[${m.returnType}] =
    sharding.entityRefFor(${name}Aggregate.entityTypeKey, ${m.idParam || "id"}.toString)`).join("\n\n")}

}
`;

  writeFileSync(join(outDir, `${ifaceName}.scala`), iface);
  writeFileSync(join(outDir, `${implName}.scala`), impl);
  console.log(`emitted ${ifaceName}.scala, ${implName}.scala`);
}

function emitProjection() {
  const ifaceName = `${name}Repository`;
  const implName = `${name}RepositoryImpl`;

  const methods = (spec.methods || []).map(m => {
    const params = m.params || "";
    const ret = m.returnType || "Unit";
    return `  override def ${m.name}(${params}): ${ret} = {
    // ==== BEGIN MANUAL ====
    ???
    // ==== END MANUAL ====
  }`;
  }).join("\n\n");

  const ifaceMethods = (spec.methods || []).map(m =>
    `  def ${m.name}(${m.params || ""}): ${m.returnType || "Unit"}`
  ).join("\n");

  const iface = `package ${pkg}.projection

/**
 * ${ifaceName}: Projection Repository Interface
 */
trait ${ifaceName} {

${ifaceMethods}

}
`;

  const impl = `package ${pkg}.projection

import javax.inject.Singleton
import ${spec.repositoryPackage || "net.imadz.application.projection.repository"}.${ifaceName}
import scala.concurrent.ExecutionContext
import scala.concurrent.Future
import scalikejdbc._

/**
 * ${implName}: Projection Repository Implementation
 */
@Singleton
class ${implName} extends ${ifaceName} {

${methods}

}
`;

  writeFileSync(join(outDir, `${ifaceName}.scala`), iface);
  writeFileSync(join(outDir, `${implName}.scala`), impl);
  console.log(`emitted ${ifaceName}.scala, ${implName}.scala`);
}

if (kind === "projection") emitProjection(); else emitAggregate();
