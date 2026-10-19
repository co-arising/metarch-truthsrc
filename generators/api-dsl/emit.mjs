#!/usr/bin/env node
// === api-dsl emitter — 1:1 restoration of old codegen ===
// Generates: <Name>ApiController + routes fragment
// Pattern: Play controller with deposit/query endpoints, OkReceipt responses
// Usage: node emit.mjs <spec.json> <out-dir>

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const [specPath, outDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const pkg = spec.package || "controllers";
const name = spec.name;
const ctrlName = `${name}ApiController`;
const basePath = spec.basePath || `/api/v1/${name.toLowerCase().replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "")}s`;

// Controller
const actions = (spec.actions || []).map(a => {
  return `  def ${a.name}(${a.params || ""}) = Action.async { implicit request =>
    // ==== BEGIN MANUAL ====
    ???
    // ==== END MANUAL ====
  }`;
}).join("\n\n");

const controller = `package ${pkg}

import javax.inject.Inject
import javax.inject.Singleton
import play.api.mvc.BaseController
import play.api.mvc.ControllerComponents
import scala.concurrent.ExecutionContext
import net.imadz.infrastructure.api.OkReceipt

/**
 * ${ctrlName}: Play API Controller for ${name}
 */
@Singleton
class ${ctrlName} @Inject() (
  val controllerComponents: ControllerComponents
)(implicit ec: ExecutionContext) extends BaseController {

${actions}

}
`;

// Routes fragment
const routes = (spec.actions || []).map(a => {
  const method = a.httpMethod || "POST";
  const path = `${basePath}/${a.routePath || a.name}`;
  const params = a.routeParams ? `(${a.routeParams})` : "";
  return `${method}     ${path}  ${pkg}.${ctrlName}.${a.name}${params}`;
}).join("\n");

const routesFragment = `# >>> codegen:controllers (do not edit inside; regenerated) >>>
${routes}
# <<< codegen:controllers <<<
`;

writeFileSync(join(outDir, `${ctrlName}.scala`), controller);
writeFileSync(join(outDir, "routes.fragment"), routesFragment);
console.log(`emitted ${ctrlName}.scala, routes.fragment`);
