#!/usr/bin/env node
// ═══ api-dsl emitter — ApiSpec → Play routes + controller ═══
import { readFileSync, writeFileSync, mkdirSync } from "fs";
const [specPath, outDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, {recursive: true});
// routes
const routes = (spec.endpoints || []).map(e => e.method + "  " + e.path + "  " + spec.controllerName + "." + e.handler).join("\n");
writeFileSync(outDir + "/routes", routes + "\n");
// controller
const actions = (spec.endpoints || []).map(e =>
  "  def " + e.handler + " = Action { Ok(\"" + e.handler + "\") } // TODO: wire to " + e.aggregate
).join("\n");
const ctrl = "package " + spec.package + "\n\nimport play.api.mvc._\n\nclass " + spec.controllerName + " extends BaseController {\n" + actions + "\n}\n";
writeFileSync(outDir + "/" + spec.controllerName + ".scala", ctrl);
console.log("emitted api to " + outDir);
