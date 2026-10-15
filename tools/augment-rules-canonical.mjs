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
//   • preconditionRules: [{id, noteId, expression, humanDescription}] — the single-command
//     COMMAND_PRECONDITION rules attributed to it (attribution mirrors rules_domain_gen:
//     cases-driven, multi-command and AGGREGATE_INVARIANT rules demote to aggregate level and are
//     NOT attached here). `id` feeds the RuleParams doc-comment rule-id list; `noteId` (=
//     definedIn.targetId, usually the command's own concept noteId) feeds the per-class
//     `@knowledge` anchor lines;
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
// It also attaches canonical-level (consumed by the RuleParams face, V4-3 inc8):
//   • voNames: [String] — the domain/values case-class name registry (rules_domain_gen's voByName:
//     scan of the target repo's domain/values/*.scala `final case class X(` signatures), driving
//     the `import <pkg>.domain.values._` line in <Agg>RuleParams.scala. Membership-tested only.
//   • valueObjectSigs: [{name, params:[{name,type}]}] — the SAME scan with full signatures
//     (inc9): exprToScala's event-scope type derivation (e.patchSet.appliedAt → Instant walks
//     the VO signature), literalFor's object-value rendering and defaultLiteral's VO recursion
//     all need ordered params, not just names.
//
// inc9 extensions (the Rules/RulesSpec face, V4-3 inc9) — all RAW per Fork A:
//   • behaviorModel becomes the WHOLE ④-layer decision ({command, guards, emissions, emitWhen,
//     idempotentOn?, noCommandRules?}) — inc6/7/8 carried only {emissions, emitWhen}; the Rules
//     checks chain is guards-ordered (④-layer path, rules_domain_gen cmdFailChecks) so guards
//     must travel with the fixture.
//   • per rule: errorCode (raw machineSpec.errorCode — the heuristic path's errCode source).
//   • aggregateRules: [{id, noteId, expression, errorCode, humanDescription}] — the
//     AGGREGATE_INVARIANT / multi-command rules attributed to THIS aggregate (same cases-driven
//     attribution as the per-command demotion, deduped by id).
//   • eventPostconditions: same shape — EVENT_POSTCONDITION rules whose var-ref hosts hit this
//     aggregate's event names (rules_domain_gen's evHost ∈ eventByName filter).
//   • executableCases: the raw case rows (grouped by the case's own `aggregate` field, mirroring
//     rules_domain_gen's byAgg) driving RulesSpec generation.
//
// inc10 extensions (the Policies face, V4-3 inc10) — RAW per Fork A, attributed here (target-agg
// resolution is discovery, mirroring rules_domain_gen's cmdHostAgg):
//   • policies: [{noteId, name, description, idempotencyKey, cmdName, evtName, bindings,
//     fanOutOn, fanOutWhere, evtHostAgg, evtPayloads}] — the policy notes whose target resolves to
//     THIS aggregate (info.targetAggregate || command host), generate=false excluded (rules_domain_gen
//     skips them). `bindings`/`fanOutOn`/`fanOutWhere` travel raw (声明即权威); `evtPayloads` is the
//     ②-layer event payload list in declaration order with RAW dataType strings (the Spec's evLit
//     regexes judge the raw form, e.g. `String (UUID)` → /UUID/ → Id.of sentinel) — the generator
//     derives the actual Entity event signature (elemVoName / Id-vs-String wrapping) by its own
//     normalize+scalaSig mapping, which is the same mapping its skeleton generator renders the
//     Entity from (self-consistent: derived sig ≡ generated sig).
//
// V4-6 extensions (the rules-face supply-leg closure) — derived slots, mirroring the source's
// load-time derivations:
//   • payloads[].lineageHint — ④-layer emissions bindings (param.*/expr:p.* forms, constant AND
//     emitWhen legs, first-wins per payload; rules_domain_gen kn-export switch lines 444-462).
//     Consumed by the generator's lineage supply loop (source lines 1131-1152).
//   • ruleAnchor: {cmd, evt, agg, ids} — the library-wide noteIds registration slice
//     (rules_domain_gen lines 89-106): buckets keyed by definedIn.target (bare names,
//     cross-aggregate-faithful) + the ruleId→targetId map. Asymmetric with cases-driven
//     attribution: rules that never render a check (untranslatable / case-less but ④层-guard
//     referenced) still anchor — the RulesSpec header (paramsNoteIds) and inline guard anchors
//     consume this slice.
//
// Usage:
//   node tools/augment-rules-canonical.mjs --aggregate ModelCatalog \
//     --canonical  golden/scala-cqrs-es-metarch/model-catalog.canonical.json \
//     --rules      /path/to/generated_rules.json \
//     --cases      /path/to/executable_cases.json \
//     --behavior   /path/to/metarch-behaviormodel.json \  # { aggregates:[{name,decisions:[...]}] }
//     --functions  /path/to/functions.yaml \              # ext-port registry source
//     --values     /path/to/ingested-app/app/net/imadz/metarch/domain/values \  # VO registry source
//     --metarch    /path/to/metarch.json                  # policy notes + ②-layer event payloads

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
const valuesPath = arg('values');
const metarchPath = arg('metarch');

if (!aggName || !canonicalPath || !rulesPath || !casesPath || !behaviorPath || !functionsPath || !valuesPath || !metarchPath) {
  console.error('missing required args: --aggregate --canonical --rules --cases --behavior --functions --values --metarch');
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
  cmdRules.get(owner).push({
    id: rule.id,
    noteId: rule.definedIn?.targetId ?? null, // rules_domain_gen ruleTargetId — anchor line source
    expression: expr,
    errorCode: rule.machineSpec?.errorCode ?? null,
    humanDescription: rule.humanDescription ?? '',
  });
}

// --- aggregate-level rules (AGGREGATE_INVARIANT or shared by >1 command of this aggregate) -----
// Same cases-driven attribution as above (rules_domain_gen lines 997-1025), deduped by id.
const aggLevelRules = [];
{
  const seen = new Set();
  for (const rule of invRules) {
    const type = rule.metadata?.invariantType;
    const expr = rule.machineSpec?.expression;
    if (!expr || typeof expr === 'string') continue;
    if (type === 'EVENT_POSTCONDITION') continue;
    const caseCmds = new Set(aggCases.filter((c) => c.ruleId === rule.id).map((c) => c.command));
    const inAgg = [...caseCmds].filter((c) => cmdNames.has(c));
    if (caseCmds.size === 0 || inAgg.length === 0) continue;
    if (!(type === 'AGGREGATE_INVARIANT' || caseCmds.size > 1)) continue;
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    aggLevelRules.push({
      id: rule.id,
      noteId: rule.definedIn?.targetId ?? null,
      expression: expr,
      errorCode: rule.machineSpec?.errorCode ?? null,
      humanDescription: rule.humanDescription ?? '',
    });
  }
}
if (aggLevelRules.length) agg.aggregateRules = aggLevelRules;
else delete agg.aggregateRules;

// --- behaviorModel decisions for this aggregate ----------------------------------------------
const bmAgg = bmAggs.find((a) => a.name === aggName);
const bmByCmd = new Map((bmAgg?.decisions ?? []).map((d) => [d.command, d]));

let attached = 0;
for (const cmd of agg.commands ?? []) {
  if (cmd.readOnly) continue;
  const rules = cmdRules.get(cmd.name);
  if (rules && rules.length) { cmd.preconditionRules = rules; attached++; }
  const d = bmByCmd.get(cmd.name);
  if (d) cmd.behaviorModel = d; // RAW ④-layer decision — guards/idempotentOn included (inc9)
}

// --- payload lineageHint derivation (rules_domain_gen kn-export switch, lines 444-462 verbatim) --
// ④ payload→param 血缘 ← ④层 emissions bindings（param.*/expr:p.* 词法），恒定腿＋emitWhen 条件腿
// 同源同补；每载荷先到先得（tgt.lineageHint 守卫）。事件同名/血缘两条 Params 补给环的血缘腿消费
// `Cmd.field` 形提示（supplyLineage）。
for (const ev of agg.events ?? []) {
  const payloads = ev.payloads ?? [];
  for (const d of bmByCmd.values()) { // decisions declaration order (Map insertion order)
    const allEmissions = [...(d.emissions ?? []), ...((d.emitWhen ?? []).flatMap((b) => b.events ?? []))];
    for (const em of allEmissions) {
      if (em.event !== ev.name) continue;
      for (const [pf, src] of Object.entries(em.bindings ?? {})) {
        const tgt = payloads.find((p) => p.name === pf);
        if (!tgt || tgt.lineageHint) continue;
        const m = String(src).match(/^(?:param\.|expr:p\.)([A-Za-z]\w*)/);
        if (m) tgt.lineageHint = `${d.command}.${m[1]}`;
      }
    }
  }
}

// --- rule-anchor buckets (rules_domain_gen lines 89-106 verbatim) --------------------------------
// The RulesSpec header noteIds registration scans the WHOLE invariant library bucketed by
// definedIn.target — bare names, cross-aggregate-faithful (registration is asymmetric with the
// cases-driven attribution above: untranslated / case-less rules never render a check line yet DO
// contribute their targetId to the spec header — CemEdge's two AGGREGATE_INVARIANT rules are the
// pinned case). Sliced to THIS aggregate's command/event/aggregate names; the generator re-filters
// the evt bucket by its own event-name face (rules_domain_gen line 1436).
{
  const buckets = { cmd: new Map(), evt: new Map(), agg: new Map() };
  for (const c of invRules) {
    const t = c.metadata?.invariantType;
    const target = c.definedIn?.target;
    const id = c.definedIn?.targetId ?? null;
    if (!target || !id) continue;
    const k = t === 'COMMAND_PRECONDITION' ? buckets.cmd
      : t === 'EVENT_POSTCONDITION' ? buckets.evt
      : t === 'AGGREGATE_INVARIANT' ? buckets.agg : null;
    if (!k) continue;
    if (!k.has(target)) k.set(target, []);
    k.get(target).push(id);
  }
  const evtNames = new Set((agg.events ?? []).map((e) => e.name));
  const cmdSlice = {};
  for (const name of cmdNames) if (buckets.cmd.has(name)) cmdSlice[name] = buckets.cmd.get(name);
  const evtSlice = {};
  for (const name of evtNames) if (buckets.evt.has(name)) evtSlice[name] = buckets.evt.get(name);
  const aggSlice = buckets.agg.get(aggName) ?? [];
  // ruleTargetIds: ruleId → targetId over the same slice face — the live ruleTargetId registration
  // is library-wide (line 99) while rendering attribution is cases-driven; a rule rendered via a
  // ④层 guard ref but WITHOUT cases (IR-USER-CMD-002) still carries its inline anchor live.
  const idSlice = {};
  for (const c of invRules) {
    const target = c.definedIn?.target;
    const id = c.definedIn?.targetId ?? null;
    if (!target || !id) continue;
    if (!(cmdNames.has(target) || evtNames.has(target) || target === aggName)) continue;
    idSlice[c.id] = id;
  }
  if (Object.keys(cmdSlice).length || Object.keys(evtSlice).length || aggSlice.length || Object.keys(idSlice).length) {
    agg.ruleAnchor = { cmd: cmdSlice, evt: evtSlice, agg: aggSlice, ids: idSlice };
  } else delete agg.ruleAnchor;
}

// --- event postcondition rules (EVENT_POSTCONDITION over this aggregate's events) --------------
// Attribution mirrors rules_domain_gen's per-aggregate evt loop: keep the rule when any var-ref
// host names one of THIS aggregate's events (evHost ∈ eventByName); translation happens in the
// generator (inc9), the fixture only carries the raw rule.
const aggEvents = new Set((agg.events ?? []).map((e) => e.name));
// Var-ref walk mirrors patch_core.collectVarRefs exactly (`var` singular / `vars` array /
// `target` dotted) — a lossy walk mis-attributes rules and shifts the evtByEvent key-insertion
// order the dispatch renders in (IR-USER-EVT-003 anyNotNull.vars 判例: missed → UserProfileUpdated
// key inserted late → UserRules dispatch order diverged from the live chain).
const varRefEvents = (expr) => {
  const out = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node.var === 'string') out.add(node.var.split('.')[0]);
    if (Array.isArray(node.vars)) for (const x of node.vars) if (typeof x === 'string') out.add(x.split('.')[0]);
    if (typeof node.target === 'string' && node.target.includes('.')) out.add(node.target.split('.')[0]);
    for (const v of Object.values(node)) walk(v);
  };
  walk(expr);
  return out;
};
const evtRules = invRules
  .filter((r) => {
    if (r.metadata?.invariantType !== 'EVENT_POSTCONDITION') return false;
    const expr = r.machineSpec?.expression;
    if (!expr || typeof expr === 'string') return false;
    for (const ev of varRefEvents(expr)) if (aggEvents.has(ev)) return true;
    return false;
  })
  .map((r) => ({
    id: r.id,
    noteId: r.definedIn?.targetId ?? null,
    target: r.definedIn?.target ?? null, // definedIn.target (event name) — paramsNoteIds filter key
    expression: r.machineSpec.expression,
    errorCode: r.machineSpec?.errorCode ?? null,
    humanDescription: r.humanDescription ?? '',
  }));
if (evtRules.length) agg.eventPostconditions = evtRules;
else delete agg.eventPostconditions;

// --- executable cases (raw, grouped by the case's own `aggregate` field like byAgg) ------------
const casesForAgg = allCases.filter((c) => c.aggregate === aggName);
if (casesForAgg.length) agg.executableCases = casesForAgg;
else delete agg.executableCases;

// --- ext-port registry (rules_domain_gen portByAccess): functions.yaml callExpr PORT_RX + portTrait
// Light line scan (truthsrc stays dependency-free; this is a porting aid, not shipped). PORT_RX
// mirrors rules_domain_gen line 324; portTrait is the explicit golden trait name (Access→trait
// strip is unreliable, per the source's own note).
const PORT_RX = /^([a-z][\w.]*?)\.([A-Z]\w*Access)\.([a-z]\w*)\.(\w+)\(\{args\}\)$/;
const fnLines = fs.readFileSync(functionsPath, 'utf8').split('\n');
const portByMember = new Map(); // member -> { member, trait, fqPkg, implFq, implKind }
for (let i = 0; i < fnLines.length; i++) {
  const cm = fnLines[i].match(/^\s*callExpr:\s*'([^']+)'/);
  if (!cm) continue;
  const m = cm[1].match(PORT_RX);
  if (!m) continue;
  const fqPkg = m[1], member = m[3];
  let trait = null, implFq = null, implKind = null;
  for (let j = i + 1; j < Math.min(i + 8, fnLines.length); j++) {
    const pm = fnLines[j].match(/^\s*portTrait:\s*(\S+)/);
    if (pm && !trait) trait = pm[1].split('.').pop();
    const sm = fnLines[j].match(/^\s*scalaImpl:\s*(\S+)/);
    if (sm && !implFq) implFq = sm[1];
    const km = fnLines[j].match(/^\s*implKind:\s*(\S+)/);
    if (km && !implKind) implKind = km[1];
    if (trait && /^\s*callExpr:/.test(fnLines[j])) break; // next function block
  }
  if (trait && !portByMember.has(member)) portByMember.set(member, { member, trait, fqPkg, implFq, implKind });
}

// ports: declaration section — per trait FQ the method signatures and bridge fq (rules_domain_gen's
// portDecls; consumed by the Spec's portImplVal anonymous-class delegation / direct-val split).
const portDecls = [];
{
  let cur = null, inBridge = false, inPorts = false;
  for (const line of fnLines) {
    if (/^ports:\s*$/.test(line)) { inPorts = true; continue; }
    if (!inPorts) continue;
    if (/^\S/.test(line)) break; // next top-level key — section over
    let m;
    if ((m = line.match(/^\s*-\s+fq:\s*(\S+)/))) { cur = { fq: m[1], methods: [], bridgeFq: null }; inBridge = false; portDecls.push(cur); continue; }
    if (!cur) continue;
    if (/^\s*bridge:\s*$/.test(line)) { inBridge = true; continue; }
    if ((m = line.match(/^\s*-\s+sig:\s*'([^']+)'/))) { cur.methods.push({ sig: m[1] }); continue; }
    if (inBridge && (m = line.match(/^\s+fq:\s*(\S+)/)) && cur.bridgeFq === null) { cur.bridgeFq = m[1]; continue; }
  }
}
const declByFq = new Map(portDecls.map((d) => [d.fq, d]));

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
  .map((p) => {
    const decl = declByFq.get(`${p.fqPkg}.${p.trait}`);
    return { ...p, ...(decl ? { methods: decl.methods, bridgeFq: decl.bridgeFq } : {}) };
  })
  .sort((a, b) => a.member.localeCompare(b.member));
if (referenced.length) agg.ports = referenced;
else delete agg.ports;

// --- aggregate folds + fold-face ports (rules_domain_gen EventHandler fn: verbs, inc9) ---------
// The ④-layer aggregate carries `folds` (event → state assignments). A `fn:<id>` assignment
// resolves against functions.yaml; when its callExpr is the Access-gate form the port trait joins
// the aggregate's PORT-IMPORT face (aggPortTraits) even though no Rule class constructor takes it
// (rulesPortTraits stays expression-driven). This is why live ModelCatalogRules imports
// ContentFingerprintPort with only adjudicator injected — the Rules import face is the UNION.
{
  const bmAgg0 = bmAggs.find((a) => a.name === aggName);
  if (bmAgg0?.folds?.length) agg.folds = bmAgg0.folds;
  else delete agg.folds;
  // fn id → {callExpr, portTrait} line scan (same dependency-free shape as the port registry scan)
  const fnById = new Map();
  let curId = null;
  for (let i = 0; i < fnLines.length; i++) {
    const im = fnLines[i].match(/^\s*-\s+id:\s*(\S+)/);
    if (im) { curId = im[1]; fnById.set(curId, {}); continue; }
    if (!curId) continue;
    const cm2 = fnLines[i].match(/^\s*callExpr:\s*'([^']+)'/);
    if (cm2) fnById.get(curId).callExpr = cm2[1];
    const tm2 = fnLines[i].match(/^\s*portTrait:\s*(\S+)/);
    if (tm2 && !fnById.get(curId).portTrait) fnById.get(curId).portTrait = tm2[1];
    if (/^\S/.test(fnLines[i])) curId = null; // left the functions: list
  }
  const foldTraits = new Set();
  for (const f of agg.folds ?? []) {
    for (const s of Object.values(f.assignments ?? {})) {
      const m = String(s).match(/^fn:(\S+)/);
      if (!m) continue;
      const spec = fnById.get(m[1]);
      if (!spec?.callExpr || !spec?.portTrait) continue;
      if (!spec.callExpr.match(PORT_RX)) continue; // static form — not port-ified (source discipline)
      foldTraits.add(spec.portTrait);
    }
  }
  const foldPorts = [...foldTraits].sort().map((fq) => {
    const segs = fq.split('.');
    const trait = segs.pop();
    const fqPkg = segs.join('.');
    const decl = declByFq.get(fq);
    let implFq = null, implKind = null;
    let cur2 = null;
    for (let i = 0; i < fnLines.length; i++) {
      const im = fnLines[i].match(/^\s*-\s+id:\s*(\S+)/);
      if (im) { cur2 = im[1]; continue; }
      if (cur2 === null) continue;
      const t2 = fnLines[i].match(/^\s*portTrait:\s*(\S+)/);
      if (t2 && t2[1] === fq) {
        for (let j = i + 1; j < Math.min(i + 4, fnLines.length); j++) {
          const sm2 = fnLines[j].match(/^\s*scalaImpl:\s*(\S+)/);
          if (sm2) { implFq = sm2[1]; break; }
        }
        for (let j = i + 1; j < Math.min(i + 4, fnLines.length); j++) {
          const km2 = fnLines[j].match(/^\s*implKind:\s*(\S+)/);
          if (km2) { implKind = km2[1]; break; }
        }
        break;
      }
    }
    return { member: null, trait, fqPkg, implFq, implKind, ...(decl ? { methods: decl.methods, bridgeFq: decl.bridgeFq } : {}) };
  });
  if (foldPorts.length) agg.foldPorts = foldPorts;
  else delete agg.foldPorts;
}

// --- policies (rules_domain_gen Policy 发射段 S2-44, inc10) -------------------------------------
// Policy notes attributed to THIS aggregate: target = info.targetAggregate || command host
// (②-layer fieldModel command scan — the --no-kn-export fallback shape; fieldTree is derived from
// the same ②-layer so the two agree). generate=false notes are excluded (source skips them).
// evtPayloads: RAW ②-layer payload rows in declaration order — see header note for the raw-vs-
// canonical split (evLit judges the raw form; the generator derives the Entity sig itself).
const policies = [];
{
  const metarch = JSON.parse(fs.readFileSync(metarchPath, 'utf8'));
  const fieldAggs = [];
  for (const s of metarch.sessions ?? []) {
    for (const scp of s.scopes ?? []) {
      if (scp.fieldModel?.aggregates) fieldAggs.push(...scp.fieldModel.aggregates);
    }
  }
  const cmdHost = new Map(); // command name → aggregate name
  const evtHost = new Map(); // event name → aggregate name
  const evtPayloads = new Map(); // event name → [[name, rawDataType], ...]
  for (const fa of fieldAggs) {
    for (const c of fa.commands ?? []) if (!cmdHost.has(c.name)) cmdHost.set(c.name, fa.name);
    for (const e of fa.events ?? []) {
      if (!evtHost.has(e.name)) evtHost.set(e.name, fa.name);
      if (!evtPayloads.has(e.name)) evtPayloads.set(e.name, (e.payloads ?? []).map((p) => [p.name, p.dataType]));
    }
  }
  for (const s of metarch.sessions ?? []) {
    for (const scp of s.scopes ?? []) {
      for (const n of scp.notes ?? []) {
        if (n.type !== 'policy' || (n.info && n.info.generate === false)) continue;
        const info = n.info ?? {};
        const cmdRef = (n.links ?? []).find((l) => l.startsWith('command:'));
        const evtRef = (n.links ?? []).find((l) => l.startsWith('event:'));
        if (!cmdRef || !evtRef || !info.bindings) continue; // 宁缺勿造 — never generated
        const cmdName = cmdRef.slice(8);
        const evtName = evtRef.slice(6);
        const targetAgg = info.targetAggregate || cmdHost.get(cmdName);
        if (targetAgg !== aggName) continue;
        policies.push({
          noteId: n.noteId ?? null,
          name: n.name,
          description: n.description ?? '',
          idempotencyKey: info.idempotencyKey ?? null, // null → generator default 'command-level'
          cmdName,
          evtName,
          bindings: info.bindings,
          fanOutOn: info.fanOutOn ?? null,
          fanOutWhere: info.fanOutWhere ?? null,
          evtHostAgg: evtHost.get(evtName) ?? null, // null → generator skip (事件签名未解析)
          evtPayloads: evtPayloads.get(evtName) ?? null,
        });
      }
    }
  }
}
if (policies.length) agg.policies = policies;
else delete agg.policies;

// --- withPost bit (conservative): any attached EVENT_POSTCONDITION rule exists at all ----------
// The exact survivor filter (event-construction conflict guard) is the inc9 generator's job; this
// bit only answers "would checkEventPostconditions exist" for the Behaviors `.withPost(...)` face.
agg.emitsEventPostconditionCheck = (agg.eventPostconditions ?? []).length > 0;

// --- voNames + valueObjectSigs (rules_domain_gen voByName): case-class registry AND signatures
// from the target repo's domain/values/*.scala. Names drive the values._ import membership test;
// signatures drive event-scope type derivation and literal rendering (inc9).
const voNames = new Set();
const valueObjectSigs = [];
for (const f of fs.readdirSync(valuesPath)) {
  if (!f.endsWith('.scala')) continue;
  const src = fs.readFileSync(`${valuesPath}/${f}`, 'utf8');
  for (const m of src.matchAll(/^\s*(?:final\s+)?case\s+class\s+([A-Za-z]\w*)\s*\(/gm)) {
    voNames.add(m[1]);
    // balanced-paren capture (signatures may be long; params never contain `case class`)
    const open = src.indexOf('(', m.index + m[0].length - 1);
    let depth = 0, end = open;
    for (; end < src.length; end++) {
      if (src[end] === '(') depth++;
      else if (src[end] === ')') { depth--; if (depth === 0) break; }
    }
    const inner = src.slice(open + 1, end);
    const parts = [];
    let d2 = 0, cur = '';
    for (const ch of inner) {
      if (ch === '[' || ch === '(') d2++;
      else if (ch === ']' || ch === ')') d2--;
      if (ch === ',' && d2 === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    const params = [];
    for (const p of parts) {
      const pm = p.trim().match(/^([A-Za-z]\w*):\s*(.+?)(?:\s*=\s*.+)?$/);
      if (pm) params.push({ name: pm[1], type: pm[2].trim() });
    }
    valueObjectSigs.push({ name: m[1], params });
  }
}
canonical.voNames = [...voNames].sort();
canonical.valueObjectSigs = valueObjectSigs.sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(canonicalPath, JSON.stringify(canonical, null, 2) + '\n');
console.log(`augmented ${canonicalPath}: ${attached} commands with preconditionRules, ${bmByCmd.size} with behaviorModel(raw decision), ${referenced.length} port(s) [${referenced.map((p) => p.member).join(',')}], aggregateRules=${aggLevelRules.length}, eventPostconditions=${evtRules.length}, executableCases=${casesForAgg.length}, policies=${policies.length}, voNames=${canonical.voNames.length}`);
