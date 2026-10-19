#!/usr/bin/env node
// === bootstrap-dsl emitter — 1:1 restoration of old codegen ===
// Generates: <Name>Bootstrap (trait) + ApplicationBootstrap (@Singleton)
// Usage: node emit.mjs <spec.json> <out-dir>

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const [specPath, outDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const pkg = spec.package || "net.imadz.infrastructure.bootstrap";
const name = spec.name;

// Individual bootstrap trait (e.g. CreditBalanceBootstrap)
const traitName = `${name}Bootstrap`;
const initMethods = (spec.initMethods || []).map(m =>
  `  def ${m.name}(${m.params || ""}): Unit = {
    // ==== BEGIN MANUAL ====
    ???
    // ==== END MANUAL ====
  }`
).join("\n\n");

const trait = `package ${pkg}

/**
 * ${traitName}: ${name} 引导组件
 */
trait ${traitName} {

${initMethods}

}
`;

// ApplicationBootstrap - wires everything together
const mixins = (spec.bootstraps || []).map(b => `with ${b}Bootstrap`).join(" ");
const injections = (spec.injections || []).map(i => `  ${i.name}: ${i.type}`).join(",\n");
const initCalls = (spec.initCalls || []).map(c => `  ${c}`).join("\n");

const app = `package ${pkg}

import akka.actor.ActorSystem
import akka.actor.typed.{ActorSystem => TypedActorSystem}
import akka.actor.typed.scaladsl.adapter._
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import javax.inject.Inject
import javax.inject.Singleton
import scala.concurrent.ExecutionContext

/**
 * ApplicationBootstrap: 应用引导类，负责初始化所有CQRS组件
 */
@Singleton
class ApplicationBootstrap @Inject()(
  classicSystem: ActorSystem,
  sharding: ClusterSharding,
${injections}
) extends ${mixins} {

  // 隐式转换环境
  private implicit val system: TypedActorSystem[Nothing] = classicSystem.toTyped
  private implicit val ec: ExecutionContext = system.executionContext

  // Initializations
${initCalls}

}
`;

writeFileSync(join(outDir, `${traitName}.scala`), trait);
writeFileSync(join(outDir, `ApplicationBootstrap.scala`), app);
console.log(`emitted ${traitName}.scala, ApplicationBootstrap.scala`);
