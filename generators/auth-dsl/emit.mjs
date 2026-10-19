#!/usr/bin/env node
// ═══ auth-dsl emitter — AuthSpec → Scala (auth-core 0.2) ═══
// Emits a declarative role policy: endpoint → required roles.
// Uses auth-core Roles vocabulary.
import { readFileSync, writeFileSync } from "fs";
const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const entries = (spec.endpoints || []).map(e =>
  '    "' + e.method + ' ' + e.path + '" -> Set(' + e.roles.map(r => 'Roles.' + r).join(", ") + ')'
).join(",\n");
const out = "package " + spec.package + "\n\n" +
"import net.imadz.common.auth.Roles\n\n" +
"/** Role policy: " + spec.name + " */\n" +
"object " + spec.objectName + " {\n" +
"  val policy: Map[String, Set[String]] = Map(\n" + entries + "\n  )\n" +
"  def requires(path: String): Set[String] = policy.getOrElse(path, Set(Roles.User))\n" +
"}\n";
writeFileSync(outPath, out);
console.log("emitted " + outPath);
