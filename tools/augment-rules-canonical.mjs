#!/usr/bin/env node
// augment-rules-canonical.mjs — attach the rules-face semantic inputs (V4-3 / Fork A) to an
// already-extracted scala-cqrs-es canonical, in place. Porting/fixture aid, NOT shipped.
//
// The CodegenMain-skeleton canonical (from extract-metarch-canonical.mjs) is purely structural.
// The rules face (CommandHelpers / Behaviors / RuleParams / Rules) produced by rules_domain_gen is
// SEMANTICALLY derived: a command's `toParam` field ORDER is a seven-way union discovered over the
// rule machineSpec var-refs and the ④-layer behaviorModel bindings — NOT the declared param order
// (mechanical proof: live Protocol order ≠ CommandHelpers toParam order). Per Fork A the fixtures
// carry the RAW inputs and the generator ports the discovery, so this tool attaches, per write
// command:
//   • preconditionRules: [{expression, humanDescription}] — the single-command COMMAND_PRECONDITION
//     rules attributed to it (attribution mirrors rules_domain_gen: cases-driven, multi-command and
//     AGGREGATE_INVARIANT rules demote to aggregate level and are NOT attached here);
//   • behaviorModel: { emissions:[{event,forEach?,bindings}], emitWhen?:[...] } — the raw ④-layer
//     decision (binding insertion order preserved; the generator does the var-ref / binding scan).
//
// It also attaches, per aggregate (consumed by the Behaviors face, V4-3 inc7):
//   • ports: [{member, trait, fqPkg}] — the ext-port registry (rules_domain_gen's portByAccess:
//     functions.yaml callExpr matching `<FQ>.<X>Access.<member>.<method>({args})` + explicit
//     portTrait), restricted to members referenced by this aggregate's behaviorModel exprs; the
//     generator does the per-command `<member>.` scan to decide `new <Cmd>Rule(member)` injection.
//   • emitsEventPostconditionCheck: boolean — whether Rules.scala emits checkEventPostconditions
//     (any EVENT_POSTCONDITION rule whose var-ref targets an aggregate event); gates `.withPost(...)`.
//     The exact survivor filter (event-construction conflict guard) is a Rules-face (inc9) concern;
//     this bit is the conservative "event postconditions exist for this aggregate's events".
//
// Usage:
//   node tools/augment-rules-canonical.mjs --aggregate ModelCatalog \
//     --canonical  golden/scala-cqrs-es-metarch/model-catalog.canonical.json \
//     --rules      /path/to/generated_rules.json \
//     --cases      /path/to/executable_cases.json \
//     --behavior   /path/to/metarch-behaviormodel.json \  # { aggregates:[{name,decisions:[...]}] }
//     --functions  /path/to/functions.yaml                # ext-port registry source

import fs from 'node:fs';

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt;
}

const aggName = arg('aggregate');
const canonicalPath = arg('canonical');
const rulesPath = arg('rules');
const casesPath = arg('cases');
const behaviorPath = arg('behavior');
const functionsPath = arg('functions');

if (!aggName || !canonicalPath || !rulesPath || !casesPath || !behaviorPath || !functionsPath) {
  console.error('missing required args: --aggregate --canonical --rules --cases --behavior --functions');
  process.exit(2);
}

const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
const agg = (canonical.aggregates ?? []).find((a) => a.name === aggName);
if (!agg) { console.error(`aggregate ${aggName} not in canonical`); process.exit(2); }

const invRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8')).concepts.filter((c) => c.kind === 'INVARIANT_RULE');
const allCases = (JSON.parse(fs.readFileSync(casesPath, 'utf8')).cases ?? []).filter((c) => c.removedAt === undefined);
const bmAggs = JSON.parse(fs.readFileSync(behaviorPath, 'utf8')).aggregates ?? [];

const cmdNames = new Set((agg.commands ?? []).map((c) => c.name));
const aggCases = allCases.filter((c) => cmdNames.has(c.command));

// --- attribution: single-command COMMAND_PRECONDITION rules → owning command -----------------
// (mirrors rules_domain_gen.mjs lines 997-1025)
const cmdRules = new Map();
for (const rule of invRules) {
  const type = rule.metadata?.invariantType;
  const expr = rule.machineSpec?.expression;
  if (!expr || typeof expr === 'string') continue;
  if (type === 'EVENT_POSTCONDITION') continue;
  const caseCmds = new Set(aggCases.filter((c) => c.ruleId === rule.id).map((c) => c.command));
  const inAgg = [...caseCmds].filter((c) => cmdNames.has(c));
  if (caseCmds.size === 0 || inAgg.length === 0) continue;
  if (type === 'AGGREGATE_INVARIANT' || caseCmds.size > 1) continue; // aggregate-level — not per-command
  const owner = inAgg[0];
  if (!cmdRules.has(owner)) cmdRules.set(owner, []);
  cmdRules.get(owner).push({ expression: expr, humanDescription: rule.humanDescription ?? '' });
}

// --- behaviorModel decisions for this aggregate ----------------------------------------------
const bmAgg = bmAggs.find((a) => a.name === aggName);
const bmByCmd = new Map((bmAgg?.decisions ?? []).map((d) => [d.command, d]));

let attached = 0;
for (const cmd of agg.commands ?? []) {
  if (cmd.readOnly) continue;
  const rules = cmdRules.get(cmd.name);
  if (rules && rules.length) { cmd.preconditionRules = rules; attached++; }
  const d = bmByCmd.get(cmd.name);
  if (d) {
    const bm = {};
    if (Array.isArray(d.emissions)) bm.emissions = d.emissions;
    if (d.emitWhen !== undefined) bm.emitWhen = d.emitWhen;
    cmd.behaviorModel = bm;
  }
}

// --- ext-port registry (rules_domain_gen portByAccess): functions.yaml callExpr PORT_RX + portTrait
// Light line scan (truthsrc stays dependency-free; this is a porting aid, not shipped). PORT_RX
// mirrors rules_domain_gen line 324; portTrait is the explicit golden trait name (Access→trait
// strip is unreliable, per the source's own note).
const PORT_RX = /^([a-z][\w.]*?)\.([A-Z]\w*Access)\.([a-z]\w*)\.(\w+)\(\{args\}\)$/;
const fnLines = fs.readFileSync(functionsPath, 'utf8').split('\n');
const portByMember = new Map(); // member -> { member, trait, fqPkg }
for (let i = 0; i < fnLines.length; i++) {
  const cm = fnLines[i].match(/^\s*callExpr:\s*'([^']+)'/);
  if (!cm) continue;
  const m = cm[1].match(PORT_RX);
  if (!m) continue;
  const fqPkg = m[1], member = m[3];
  let trait = null;
  for (let j = i + 1; j < Math.min(i + 6, fnLines.length); j++) {
    const pm = fnLines[j].match(/^\s*portTrait:\s*(\S+)/);
    if (pm) { trait = pm[1].split('.').pop(); break; }
    if (/^\s*callExpr:/.test(fnLines[j])) break; // next function block
  }
  if (trait && !portByMember.has(member)) portByMember.set(member, { member, trait, fqPkg });
}

// members this aggregate's behaviorModel exprs reference (expr: bindings + emitWhen cond.expr)
const exprStrings = [];
const walkExpr = (node) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(walkExpr); return; }
  if (typeof node.expr === 'string') exprStrings.push(node.expr);
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string' && v.startsWith('expr:')) exprStrings.push(v.slice(5));
    else walkExpr(v);
  }
};
for (const cmd of agg.commands ?? []) if (cmd.behaviorModel) walkExpr(cmd.behaviorModel);
const referenced = [...portByMember.values()]
  .filter((p) => exprStrings.some((s) => s.includes(`${p.member}.`)))
  .sort((a, b) => a.member.localeCompare(b.member));
if (referenced.length) agg.ports = referenced;
else delete agg.ports;

// --- withPost bit: any EVENT_POSTCONDITION rule whose var-ref targets an aggregate event ---------
const aggEvents = new Set((agg.events ?? []).map((e) => e.name));
const varRefEvents = (expr) => {
  const out = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node.var === 'string') out.add(node.var.split('.')[0]);
    for (const v of Object.values(node)) walk(v);
  };
  walk(expr);
  return out;
};
const emitsEvtPost = invRules.some((r) => {
  if (r.metadata?.invariantType !== 'EVENT_POSTCONDITION') return false;
  const expr = r.machineSpec?.expression;
  if (!expr || typeof expr === 'string') return false;
  for (const ev of varRefEvents(expr)) if (aggEvents.has(ev)) return true;
  return false;
});
agg.emitsEventPostconditionCheck = emitsEvtPost;

fs.writeFileSync(canonicalPath, JSON.stringify(canonical, null, 2) + '\n');
console.log(`augmented ${canonicalPath}: ${attached} commands with preconditionRules, ${bmByCmd.size} with behaviorModel, ${referenced.length} port(s) [${referenced.map((p) => p.member).join(',')}], emitsEventPostconditionCheck=${emitsEvtPost}`);
