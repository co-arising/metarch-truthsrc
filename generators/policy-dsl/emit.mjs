#!/usr/bin/env node
// === policy-dsl emitter — 1:1 restoration of old codegen ===
// Ported from: rules_domain_gen.mjs (JS, 204KB) — policy section
// Generates: <Agg>Policies.scala (GROUPED by aggregate, not per-policy)
// Pattern matches ingested-app golden (e.g., ConceptPolicies.scala):
//   - object <Agg>Policies { object PolicyOn<Cmd> { ... def on(e: Event): List<Params> = ... } }
//   - Policy bodies are REAL generated logic (filter/map over event fields), not ???
//   - Grouping: policies grouped by TARGET aggregate (the command's aggregate)
// Usage: node emit.mjs <spec.json> <out-dir>
//   spec.policies: [{ name, description, idempotencyKey, triggerEvent, eventAggregate,
//                     command, targetAggregate, bindings, fanOutOn, fanOutWhere }]

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const [specPath, outDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const pkg = spec.package || "net.imadz.metarch.domain.policy";
const basePkg = spec.basePkg || "net.imadz.metarch";

// ─── Helpers ───
const firstLower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// Translate a binding expression to Scala.
// bindings: { paramName: "event.field" | "event.items.field" | "literal:..." | ... }
// Returns Scala expression string.
function translateBinding(expr, params) {
  if (expr === "item") return "item";
  if (expr.startsWith("event.")) {
    // event.field → e.field ; event.items.field → item.field (in fanOut context)
    const rest = expr.slice(6);
    if (rest.startsWith("item.")) return rest; // already item-scoped
    return "e." + rest;
  }
  if (expr.startsWith("literal:")) {
    const lit = expr.slice(8);
    // Try to infer: quoted string stays, numbers stay, else as-is
    return lit;
  }
  if (expr.startsWith("Id.of(")) return expr; // already wrapped
  return expr;
}

// Build the on() method body from bindings.
// - Simple: List(CmdParams(e.a, e.b, ...))
// - Fan-out: e.items.map(item => CmdParams(...))
// - Fan-out with filter: e.items.filter(item => <cond>).map(item => CmdParams(...))
function buildOnBody(p) {
  const bindings = p.bindings || {};
  const paramNames = p.paramFields || Object.keys(bindings);

  // Build arg list: for each param, translate its binding expr
  const args = paramNames.map((pn) => {
    const expr = bindings[pn];
    if (expr === undefined) {
      // No binding — try event.<pn> convention, else MANUAL
      return `e.${pn}`;
    }
    return translateBinding(expr, paramNames);
  });

  const paramsCtor = (itemExpr) =>
    `${p.command}Params(${args.map((a) => (a === "item" ? itemExpr : a)).join(", ")})`;

  if (p.fanOutOn) {
    const fanField = p.fanOutOn.split(".").pop();
    // Id wrapping for item if the param type is Id
    let itemExpr = "item";
    // Simple heuristic: if any arg is Id.of(item), keep as-is (already wrapped)
    const fanChain = p.fanOutWhere
      ? `e.${fanField}.filter(item => ${translateFanOutWhere(p.fanOutWhere)})`
      : `e.${fanField}`;
    return `    ${fanChain}.map(item => ${paramsCtor(itemExpr)})`;
  }
  return `    List(${paramsCtor()})`;
}

// Translate fanOutWhere predicate to Scala.
// Supports: { eq: [{var: "item.field"}, value] }, { notEmpty: {var: "item.field"} },
//           { and: [...] }, { or: [...] }
function translateFanOutWhere(pred) {
  if (!pred || typeof pred !== "object") return "true";
  const [k, v] = Object.entries(pred)[0];
  if (k === "eq" && Array.isArray(v)) {
    const field = v[0].var.replace(/^item\./, "item.");
    const rhs = typeof v[1] === "string" ? `"${v[1]}"` : JSON.stringify(v[1]);
    // Option(item.field).contains(value) pattern from golden
    const fname = v[0].var.replace(/^item\./, "");
    return `(Option(item.${fname}).contains(${rhs}))`;
  }
  if (k === "notEmpty" && v && v.var) {
    const fname = v.var.replace(/^item\./, "");
    return `(Option(item.${fname}).exists(_.nonEmpty))`;
  }
  if (k === "and" && Array.isArray(v)) {
    return `(${v.map(translateFanOutWhere).join(" && ")})`;
  }
  if (k === "or" && Array.isArray(v)) {
    return `(${v.map(translateFanOutWhere).join(" || ")})`;
  }
  // Fallback: MANUAL block for untranslatable predicates
  return `??? /* MANUAL: translate fanOutWhere ${JSON.stringify(pred)} */`;
}

// ─── Group policies by target aggregate ───
const policies = spec.policies || [];
const byAgg = new Map();
for (const p of policies) {
  const agg = p.targetAggregate || "Unknown";
  if (!byAgg.has(agg)) byAgg.set(agg, []);
  byAgg.get(agg).push(p);
}

// ─── Emit one file per aggregate ───
for (const [agg, plist] of byAgg) {
  const evtImports = new Set();
  const paramsImports = new Set();
  paramsImports.add(`${basePkg}.domain.invariant.params.${agg}RuleParams._`);

  const objects = plist.map((p) => {
    const evtAgg = p.eventAggregate || agg;
    evtImports.add(`${basePkg}.domain.entities.${evtAgg}Entity.${p.triggerEvent}`);

    const body = buildOnBody(p);
    const desc = JSON.stringify(p.description || "");
    const idem = JSON.stringify(p.idempotencyKey || "command-level");

    return `
  /** ${p.name}：on(${p.triggerEvent}) => emit(${p.command})（真源 info.bindings·声明即权威） */
  object PolicyOn${p.command} {
    val policyName = "PolicyOn${p.command}"
    val description = ${desc}
    val idempotencyKey = ${idem}

    def on(e: ${p.triggerEvent}): List[${p.command}Params] =
${body}
  }
`;
  }).join("\n");

  const importLines = [
    `import ${basePkg}.common.Id`,
    ...[...evtImports].sort().map((i) => `import ${i}`),
    ...[...paramsImports].sort().map((i) => `import ${i}`),
  ].join("\n");

  const aggDesc = spec.aggDescriptions?.[agg] || `${agg} 聚合反应策略`;

  const source = `// @generated by rules_domain_gen:2026-09-05 (S2-44)
// @knowledge-release 1.0.0
package ${pkg}

${importLines}

/**
 * ${aggDesc}（policy-dsl 生成）。
 * Policy = event → command 的领域语义；纯 domain：零 akka / 零 application 依赖。
 * 与 domain/invariant 对偶：Rules 吃 (State, Params) 产 Events；Policy 吃 Event 产 Params。
 */
object ${agg}Policies {
${objects}
}
`;

  const fileName = `${agg}Policies.scala`;
  writeFileSync(join(outDir, fileName), source);
  console.log(`emitted ${fileName} (${plist.length} policies)`);
}
