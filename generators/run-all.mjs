#!/usr/bin/env node
// ═══ run-all.mjs v3 — toolchain-driven pipeline → complete sbt project ═══
// Uses lib/compile.mjs (compileTree) — NEVER hand-glob directories.
// The toolchain knows the canonical layout; we consume its output.
//
// Pipeline: tree → compileTree → canonical JSON → generators → sbt project
//
// Usage: node run-all.mjs <tree-dir> <out-dir> [--binding <dir>] [--package <pkg>]
//   --package  base package for generated code (default: net.imadz.metarch)
//
// Output is a complete, compilable single-module Play/sbt project:
//   build.sbt, project/{build.properties,plugins.sbt}, conf/{application.conf,routes},
//   .gitignore, app/<base package path>/... (ingested-app single-module layout)

import { execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync, mkdtempSync, renameSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { compileTree } from "../lib/compile.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const [treeDir, outDir, ...rest] = process.argv.slice(2);
const flagVal = (f, dflt) =>
  rest.includes(f) ? rest[rest.indexOf(f) + 1] : dflt;
const bindingDir = flagVal("--binding", join(__dirname, "bindings"));
const basePkg = flagVal("--package", "net.imadz.metarch");

if (!treeDir || !outDir) {
  console.error(
    "usage: node run-all.mjs <tree-dir> <out-dir> [--binding <dir>] [--package <pkg>]"
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
// spec scratch lives outside the project — no tool artifacts in the output
const specDir = mkdtempSync(join(tmpdir(), "run-all-spec-"));

// ── Step 1: compile tree via toolchain ──
console.log("compiling tree via lib/compile.mjs...");
const canonicalJson = compileTree(treeDir);
const canonical = JSON.parse(canonicalJson);
console.log(`  schema: ${canonical.schemaVersion}, workshop: ${canonical.workshop}`);

// ── Step 2: extract atoms by kind from canonical ──
const notes = [];
for (const session of canonical.sessions || []) {
  for (const scope of session.scopes || []) {
    for (const note of scope.notes || []) {
      notes.push(note);
    }
  }
}
console.log(`  total notes: ${notes.length}`);

const byType = (t) => notes.filter((n) => n.type === t);
const events = byType("event");
const commands = byType("command");
const aggregates = canonical.aggregates || [];
const policies = byType("policy");
const readModels = canonical.readModels || [];
const valueObjects = canonical.valueObjects || [];
const pipelines = canonical.pipelines || [];
console.log(`  events: ${events.length}, commands: ${commands.length}`);
console.log(`  aggregates: ${aggregates.length}`);
console.log(`  policies: ${policies.length}`);
console.log(`  readModels: ${readModels.length}`);
console.log(`  valueObjects: ${valueObjects.length}`);
console.log(`  pipelines: ${pipelines.length}`);

// ── Step 3: run generators into package directories ──
const results = [];

const pascal = (s) =>
  String(s).split(/[-_ ]/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join("");
// normalize canonical dataType → emitter type key (emitter maps key → Scala type)
const normType = (t) =>
  ({ string: "string", number: "number", integer: "integer", long: "long", boolean: "boolean", timestamp: "long" })[t] || "string";
const normFields = (fields) =>
  (fields || []).map((f) => ({ name: f.name, dataType: normType(f.dataType) }));

const pkgDir = (pkg) => join(outDir, "app", ...pkg.split("."));

/**
 * mode "single": emitter writes exactly outPath (full target path, we choose the name)
 * mode "dir":     emitter writes multiple files into dirname(outPath); we pass a
 *                marker file path in the right package dir and delete the marker after
 *                (opts.noMarker: emitter takes <spec> <out-dir> directly — pass the
 *                package dir itself, no marker)
 */
function runGen(gen, items, pkg, toSpec, opts = {}) {
  const mode = opts.mode || "single";
  const genDir = join(__dirname, gen);
  const emitJs = join(genDir, "emit.mjs");
  if (!existsSync(emitJs)) {
    results.push({ gen, status: "skip", reason: "no emit.mjs" });
    return;
  }
  const targetPkgDir = pkgDir(pkg);
  mkdirSync(targetPkgDir, { recursive: true });
  let count = 0;
  let firstError = null;
  items.forEach((item, i) => {
    if (firstError) return;
    try {
      const spec = toSpec(item);
      const specPath = join(specDir, `${gen}-${i}.json`);
      writeFileSync(specPath, JSON.stringify(spec, null, 2));
      const outPath =
        mode === "single"
          ? join(targetPkgDir, opts.fileName(item, spec))
          : opts.noMarker
            ? targetPkgDir
            : join(targetPkgDir, ".emit-marker.scala");
      execSync(`node "${emitJs}" "${specPath}" "${outPath}"`, { stdio: "pipe" });
      if (mode === "dir" && !opts.noMarker && existsSync(outPath)) rmSync(outPath);
      count++;
    } catch (e) {
      firstError = e.message.slice(0, 300);
    }
  });
  results.push(
    firstError
      ? { gen, status: "error", error: firstError }
      : { gen, status: "ok", count }
  );
}

const objNameOf = (a) => pascal(a.name);

// NOTE: event-dsl is intentionally NOT wired. Events are defined inside
// domain/entities/<Name>Entity.scala (generated by aggregate-dsl v4) and
// imported by Protocol. Standalone domain/event/ files do not exist in ingested-app.

// event-dsl REMOVED (v4): events live in domain/entities/<Name>Entity.scala,
// generated by aggregate-dsl. No standalone domain/event/ files (ingested-app 1:1).

runGen(
  "command-dsl",
  aggregates,
  `${basePkg}.application.aggregates`,
  (a) => {
    const objName = objNameOf(a);
    return {
      // emitter declares `package ${pkg}.behaviors`; outPath lands in behaviors/ dir
      package: `${basePkg}.application.aggregates`,
      objectName: objName,
      stateType: `${objName}State`,
      commands: (a.commands || []).map((c) => ({
        name: c.name,
        fields: normFields(c.parameters),
        paramType: "Unit",
        confirmationType: `${c.name}Reply`,
      })),
    };
  },
  {
    fileName: (a) => `${objNameOf(a)}CommandHelpers.scala`,
  }
);
// command-dsl output goes to the behaviors/ package dir, not the aggregate root
// (handled by re-routing below — see note)

runGen(
  "aggregate-dsl",
  aggregates,
  `${basePkg}.application.aggregates`,
  (a) => {
    const objName = objNameOf(a);
    return {
      package: `${basePkg}.application.aggregates`,
      name: a.name,
      objectName: objName,
      stateType: `${objName}State`,
      eventType: `${objName}Event`,
      stateFields: normFields(a.stateFields),
      // Entity files go to the domain.entities package tree (ingested-app 1:1)
      entityDir: pkgDir(`${basePkg}.domain.entities`),
      entityPackage: `${basePkg}.domain.entities`,
      invariantPackage: `${basePkg}.domain.invariant`,
      commands: (a.commands || []).map((c) => ({
        name: c.name,
        fields: normFields(c.parameters),
      })),
      events: (a.events || []).map((e) => ({
        name: e.name,
        fields: normFields(e.payloads),
      })),
      statusTransitions: a.statusTransitions || {},
      commandHandlers: (a.commands || [])
        .filter((c) => (c.guards || []).some((g) => g.kind === "invariantRef"))
        .map((c) => ({ command: c.name })),
    };
  },
  { mode: "dir" }
);

runGen(
  "invariant-dsl",
  aggregates,
  `${basePkg}.domain.invariant`,
  (a) => {
    const objName = objNameOf(a);
    const seen = new Set();
    const rules = [];
    for (const c of a.commands || []) {
      for (const g of c.guards || []) {
        if (g.kind === "invariantRef" && !seen.has(c.name)) {
          seen.add(c.name);
          rules.push({ commandName: c.name, fields: normFields(c.parameters) });
        }
      }
    }
    return {
      package: `${basePkg}.domain.invariant`,
      aggregateName: objName,
      eventType: `${objName}Event`,
      stateType: `${objName}State`,
      rules,
    };
  },
  { mode: "dir" }
);

runGen("policy-dsl", policies, `${basePkg}.domain.policy`, (n) => ({
  package: `${basePkg}.domain.policy`,
  name: n.name,
  objectName: pascal(n.id || n.name) + "Policy",
  description: n.description || "",
  triggers: [],
  invokes: [],
  rules: [],
}), { fileName: (n) => `${pascal(n.id || n.name)}Policy.scala` });

runGen("readmodel-dsl", readModels, `${basePkg}.application.projection`, (r) => ({
  package: `${basePkg}.application.projection`,
  name: r.name,
  viewType: pascal(r.id || r.name),
  objectName: pascal(r.id || r.name) + "View",
  servedBy: r.served_by || "",
  sources: r.sources || [],
  fields: (r.fields || []).slice(0, 10).map((f) => ({
    name: String(f.name).replace(/\./g, "_"),
    dataType: normType(f.dataType),
  })),
}), { fileName: (r) => `${pascal(r.id || r.name)}View.scala` });

runGen("valueobject-dsl", valueObjects, `${basePkg}.domain.values`, (v) => ({
  package: `${basePkg}.domain.values`,
  name: pascal(v.name),
  description: v.description || "",
  fields: normFields(v.fields),
}), { fileName: (v) => `${pascal(v.name)}.scala` });

runGen(
  "repository-dsl",
  aggregates,
  `${basePkg}.infrastructure.repositories`,
  (a) => {
    const objName = objNameOf(a);
    return {
      package: `${basePkg}.infrastructure.repositories`,
      name: objName,
      kind: "aggregate",
      aggregatePackage: `${basePkg}.application.aggregates`,
      // DDD layering (ingested-app 1:1): trait in application, impl in infrastructure
      traitPackage: `${basePkg}.application.aggregates.repository`,
      implPackage: `${basePkg}.infrastructure.repositories.aggregate`,
      projectRoot: join(outDir, "app"),
      methods: [],
    };
  },
  { mode: "dir", noMarker: true }
);

runGen("monarch-dsl", pipelines, `${basePkg}.application.pipeline`, (p) => ({
  ...p,
  package: `${basePkg}.application.pipeline`,
}), { fileName: (p) => `${p.objectName || pascal(p.name || "Pipeline")}.scala` });

// ═══ Task 1: wire previously-missing generators (ingested-app 1:1) ═══

const snake = (s) =>
  String(s).replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

// proto-dsl → app/protobuf/<snake>.proto (NOT under package dir)
{
  const protoDir = join(outDir, "app", "protobuf");
  mkdirSync(protoDir, { recursive: true });
  let protoOk = 0, protoErr = null;
  aggregates.forEach((a, i) => {
    if (protoErr) return;
    try {
      const objName = objNameOf(a);
      const spec = {
        protoPackage: `${basePkg}.infrastructure.proto`,
        aggregateName: objName,
        stateFields: (a.stateFields || []).map((f) => ({ name: f.name, dataType: f.dataType })),
        events: (a.events || []).map((e) => ({
          name: e.name,
          fields: (e.payloads || []).map((f) => ({ name: f.name, dataType: f.dataType })),
        })),
      };
      const specPath = join(specDir, `proto-dsl-${i}.json`);
      writeFileSync(specPath, JSON.stringify(spec, null, 2));
      execSync(
        `node "${join(__dirname, "proto-dsl", "emit.mjs")}" "${specPath}" "${join(protoDir, snake(objName) + ".proto")}"`,
        { stdio: "pipe" }
      );
      protoOk++;
    } catch (e) {
      protoErr = e.message.slice(0, 300);
    }
  });
  results.push(protoErr ? { gen: "proto-dsl", status: "error", error: protoErr } : { gen: "proto-dsl", status: "ok", count: protoOk });
}

// api-dsl → app/controllers/<Name>ApiController.scala
{
  const ctrlDir = join(outDir, "app", "controllers");
  mkdirSync(ctrlDir, { recursive: true });
  const routesFrags = [];
  let apiOk = 0, apiErr = null;
  aggregates.forEach((a, i) => {
    if (apiErr) return;
    try {
      const objName = objNameOf(a);
      const spec = {
        package: "controllers",
        name: objName,
        actions: (a.commands || []).map((c) => ({
          name: c.name[0].toLowerCase() + c.name.slice(1),
          httpMethod: "POST",
          routePath: snake(c.name),
        })),
      };
      const specPath = join(specDir, `api-dsl-${i}.json`);
      writeFileSync(specPath, JSON.stringify(spec, null, 2));
      execSync(
        `node "${join(__dirname, "api-dsl", "emit.mjs")}" "${specPath}" "${ctrlDir}"`,
        { stdio: "pipe" }
      );
      // collect routes fragment
      const fragPath = join(ctrlDir, "routes.fragment");
      if (existsSync(fragPath)) {
        routesFrags.push(readFileSync(fragPath, "utf8"));
        rmSync(fragPath);
      }
      apiOk++;
    } catch (e) {
      apiErr = e.message.slice(0, 300);
    }
  });
  // append generated routes to conf/routes (ensure conf/ exists — scaffold step runs later)
  if (routesFrags.length) {
    mkdirSync(join(outDir, "conf"), { recursive: true });
    const routesPath = join(outDir, "conf", "routes");
    const existing = existsSync(routesPath) ? readFileSync(routesPath, "utf8") : "";
    writeFileSync(routesPath, existing + "\n" + routesFrags.join("\n"));
  }
  results.push(apiErr ? { gen: "api-dsl", status: "error", error: apiErr } : { gen: "api-dsl", status: "ok", count: apiOk });
}

// adapter-dsl → infrastructure/persistence/*EventAdapter.scala + *SnapshotAdapter.scala
runGen(
  "adapter-dsl",
  aggregates,
  `${basePkg}.infrastructure.persistence`,
  (a) => {
    const objName = objNameOf(a);
    return {
      package: `${basePkg}.infrastructure.persistence`,
      name: objName,
      stateType: `${objName}State`,
      eventType: `${objName}Event`,
      events: (a.events || []).map((e) => ({ name: e.name })),
      entityPackage: `${basePkg}.domain.entities`,
      convertersPackage: `${basePkg}.infrastructure.persistence.converters`,
      protoPackage: `${basePkg}.infrastructure.proto`,
    };
  },
  { mode: "dir", noMarker: true }
);

// converter-dsl → infrastructure/persistence/converters/*ProtoConverters.scala
runGen(
  "converter-dsl",
  aggregates,
  `${basePkg}.infrastructure.persistence.converters`,
  (a) => {
    const objName = objNameOf(a);
    const fieldMap = (fields, toProto) =>
      (fields || []).map((f) => {
        const rhs = toProto ? `d.${f.name}` : `p.${f.name}`;
        return `${f.name} = ${rhs}`;
      });
    const converters = [
      {
        name: `${objName}State`,
        domainType: `${objName}State`,
        protoType: `${objName}StatePO`,
        toProtoFields: fieldMap(a.stateFields, true),
        fromProtoFields: fieldMap(a.stateFields, false),
      },
      ...(a.events || []).map((e) => ({
        name: e.name,
        domainType: e.name,
        protoType: `${e.name}PO`,
        toProtoFields: fieldMap(e.payloads, true),
        fromProtoFields: fieldMap(e.payloads, false),
      })),
    ];
    return {
      package: `${basePkg}.infrastructure.persistence.converters`,
      name: objName,
      domainImports: [
        `import ${basePkg}.domain.entities.${objName}Entity.${objName}State`,
        `import ${basePkg}.domain.entities.${objName}Entity._`,
      ],
      protoImports: [`import ${basePkg}.infrastructure.proto._`],
      converters,
    };
  },
  { fileName: (a) => `${objNameOf(a)}ProtoConverters.scala` }
);

// bootstrap-dsl → infrastructure/bootstrap/
// per-aggregate traits first (skipApp), then a final ApplicationBootstrap wiring them all
{
  const bootDir = pkgDir(`${basePkg}.infrastructure.bootstrap`);
  mkdirSync(bootDir, { recursive: true });
  let bootOk = 0, bootErr = null;
  const bootNames = [];
  aggregates.forEach((a, i) => {
    if (bootErr) return;
    try {
      const objName = objNameOf(a);
      bootNames.push(`${objName}Bootstrap`);
      const spec = {
        package: `${basePkg}.infrastructure.bootstrap`,
        name: objName,
        skipApp: true,
        initMethods: [
          { name: `init${objName}Sharding`, params: "" },
          { name: `init${objName}Projections`, params: "" },
        ],
      };
      const specPath = join(specDir, `bootstrap-dsl-${i}.json`);
      writeFileSync(specPath, JSON.stringify(spec, null, 2));
      execSync(
        `node "${join(__dirname, "bootstrap-dsl", "emit.mjs")}" "${specPath}" "${bootDir}"`,
        { stdio: "pipe" }
      );
      bootOk++;
    } catch (e) {
      bootErr = e.message.slice(0, 300);
    }
  });
  // final ApplicationBootstrap wiring all traits
  if (!bootErr) {
    try {
      const appSpec = {
        package: `${basePkg}.infrastructure.bootstrap`,
        name: "Application",
        skipTrait: true,
        bootstraps: bootNames.map((b) => b.replace(/Bootstrap$/, "")),
        injections: [],
        initCalls: bootNames.map((b) => `  // ${b} wiring — see trait`),
      };
      const specPath = join(specDir, `bootstrap-dsl-app.json`);
      writeFileSync(specPath, JSON.stringify(appSpec, null, 2));
      execSync(
        `node "${join(__dirname, "bootstrap-dsl", "emit.mjs")}" "${specPath}" "${bootDir}"`,
        { stdio: "pipe" }
      );
      bootOk++;
    } catch (e) {
      bootErr = e.message.slice(0, 300);
    }
  }
  results.push(bootErr ? { gen: "bootstrap-dsl", status: "error", error: bootErr } : { gen: "bootstrap-dsl", status: "ok", count: bootOk });
}

// ── Step 4: move command-dsl helpers into behaviors/ package dir ──
// command-dsl declares `package ${pkg}.behaviors` but runGen placed it at the
// aggregate root; relocate to match the declared package.
{
  const aggDir = pkgDir(`${basePkg}.application.aggregates`);
  const behDir = pkgDir(`${basePkg}.application.aggregates.behaviors`);
  mkdirSync(behDir, { recursive: true });
  for (const a of aggregates) {
    const f = `${objNameOf(a)}CommandHelpers.scala`;
    const src = join(aggDir, f);
    const dst = join(behDir, f);
    if (existsSync(src)) {
      renameSync(src, dst);
    }
  }
}

console.log("\n═══ run-all v3 results (toolchain-driven → sbt project) ═══");
for (const r of results) {
  console.log(`  ${r.gen}: ${r.status}${r.count !== undefined ? ` (${r.count} files)` : ""}${r.reason ? ` — ${r.reason}` : ""}`);
}
const ok = results.filter((r) => r.status === "ok").length;
console.log(`\n${ok}/${results.length} generators ok`);

// ── Step 5: sbt project scaffold ──
const appName = `${String(canonical.workshop || "generated").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-generated`;

writeFileSync(join(outDir, "build.sbt"), `name := "${appName}"
organization := "net.imadz"
version := "1.0-SNAPSHOT"

scalaVersion := "2.13.14"

val akkaVersion = "2.6.20"
val imadzVersion = "0.2"

lazy val root = (project in file(".")).enablePlugins(PlayScala)

Compile / scalacOptions ++= Seq(
  "-target:11",
  "-deprecation",
  "-feature",
  "-unchecked",
  "-Xlog-reflective-calls",
  "-Xlint")
Compile / javacOptions ++= Seq("-Xlint:unchecked", "-Xlint:deprecation")

resolvers ++= Seq(
  "Aliyun" at "https://maven.aliyun.com/repository/public/"
)

libraryDependencies += guice
libraryDependencies += jdbc
libraryDependencies += clusterSharding
libraryDependencies ++= Seq(
  // net.imadz 0.2 engine libraries (lockstep)
  "net.imadz" %% "common-core" % imadzVersion,
  "net.imadz" %% "monarch-core" % imadzVersion,
  "net.imadz" %% "saga-core" % imadzVersion,
  "net.imadz" %% "auth-core" % imadzVersion,
  "net.imadz" %% "monarch-persistence" % imadzVersion,

  // Akka
  "com.typesafe.akka" %% "akka-cluster-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-cluster-sharding-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-stream" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence-typed" % akkaVersion,
  "com.typesafe.akka" %% "akka-persistence-query" % akkaVersion,
  "com.typesafe.akka" %% "akka-serialization-jackson" % akkaVersion,
  "com.typesafe.akka" %% "akka-slf4j" % akkaVersion,

  // Projections
  "com.lightbend.akka" %% "akka-projection-eventsourced" % "1.2.5",
  "com.lightbend.akka" %% "akka-projection-jdbc" % "1.2.5",
  "org.scalikejdbc" %% "scalikejdbc" % "3.5.0",
  "org.scalikejdbc" %% "scalikejdbc-config" % "3.5.0",
  "org.scalikejdbc" %% "scalikejdbc-play-initializer" % "2.8.0-scalikejdbc-3.5",

  // Logging / test
  "ch.qos.logback" % "logback-classic" % "1.4.5",
  "org.scalatest" %% "scalatest" % "3.2.15" % Test,
  "org.scalatestplus.play" %% "scalatestplus-play" % "5.0.0" % Test,
  "com.typesafe.akka" %% "akka-actor-testkit-typed" % akkaVersion % Test,
  "com.typesafe.akka" %% "akka-stream-testkit" % akkaVersion % Test,
  "com.typesafe.akka" %% "akka-persistence-testkit" % akkaVersion % Test
)
`);

mkdirSync(join(outDir, "project"), { recursive: true });
writeFileSync(join(outDir, "project", "build.properties"), "sbt.version=1.4.9\n");
writeFileSync(
  join(outDir, "project", "plugins.sbt"),
  `addSbtPlugin("com.typesafe.play" % "sbt-plugin" % "2.8.18")\n`
);

mkdirSync(join(outDir, "conf"), { recursive: true });
writeFileSync(
  join(outDir, "conf", "application.conf"),
  `# Generated by truthsrc run-all v3 — fill in environment specifics.
play.http.secret.key = "changeme-in-production"

# Akka cluster (single-node dev default)
akka {
  actor.provider = "cluster"
  remote.artery.canonical.port = 2551
  cluster.seed-nodes = ["akka://application@127.0.0.1:2551"]
}

# Persistence / projections: wire your journal + read journal here.
# Generated repositories reference these via application.conf.
`
);
writeFileSync(
  join(outDir, "conf", "routes"),
  `# Generated by truthsrc run-all v3 — api-dsl appends generated routes below.
# Routes
# ~~~~
`
);

writeFileSync(
  join(outDir, ".gitignore"),
  `target/
project/target/
project/project/
.bsp/
.metals/
.idea/
*.class
*.log
`
);

console.log(`\nsbt project scaffold written to ${outDir}`);
console.log(`  app/ package root: ${basePkg}`);
