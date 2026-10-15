// models.mjs — rules-face builders (V4-3). Canonical (+ augment-rules-canonical slots) → pure model.
// All ordering/semantic decisions live here; templates/scala.mjs only renders text.
import { scalaSig, sigOf } from './datatype.mjs';
import { computeParamDefs, normalizeEmitWhen, scalaRef } from './rules.mjs';

// A command is a query fragment (no helper, no behaviors wiring) when it is readOnly. The canonical
// marks the synthesized Get<Name>State query readOnly; everything else is a write command.
const isQuery = (c) => c.readOnly === true;

// dataType (canonical) → Scala signature, mirroring the skeleton's scalaSig (DataTypeMapper):
// 'string (uuid)'|'uuid' → Id (the CommonTypes alias); else verbatim (List[Finding] etc. pass through).

// noteAnchor — patch_core.noteAnchor: `// @knowledge <noteId>` plus the `@<hash>` suffix when the
// elementHashes sidecar carries the entry; '' when noteId is null (un-anchored lines render bare).
function noteAnchor(noteId, elementHashes, indent = '') {
  if (!noteId) return '';
  const clean = String(noteId).replace(/["'\n\r]/g, '');
  const h = elementHashes?.[clean];
  return `${indent}// @knowledge ${clean}${h ? '@' + h : ''}\n`;
}

// commandHelpersModel — the glue trait: each write command projects its params into <Cmd>Params in
// paramDefs (union-discovered) order, with fixed failure/success replies. Query commands contribute
// to the import block (both <Cmd> and <Cmd>Reply) but get no helper object (rules_domain_gen lines
// 1922-1960).

// policyBoundOf — the command → policy-bound-fields supply map (rules_domain_gen's policyBoundParams
// prescan, consumed by computeParamDefs's policy-binding loop): for each policy targeting THIS
// aggregate, its `info.bindings` keys must be in the target command's Params VO (声明即权威).
function policyBoundOf(a) {
  const m = new Map();
  for (const p of a.policies ?? []) {
    const set = m.get(p.cmdName) || new Set();
    for (const k of Object.keys(p.bindings ?? {})) set.add(k);
    m.set(p.cmdName, set);
  }
  return m;
}

export function commandHelpersModel(a, env) {
  const commands = a.commands ?? [];
  const policyBound = policyBoundOf(a);
  const helpers = commands.filter((c) => !isQuery(c)).map((c) => {
    const params = c.parameters ?? [];
    const fields = computeParamDefs(c.name, params, c.preconditionRules, c.behaviorModel, policyBound.get(c.name));
    return {
      name: c.name,
      replyType: `${c.name}Reply`,
      paramsName: `${c.name}Params`,
      args: fields.map((f) => `command.${scalaRef(f)}`),
    };
  });
  return {
    header: env.header,
    pkg: a.pkg ?? 'net.imadz',
    ctx: a.ctxPackage,
    agg: a.name,
    commandNames: commands.map((c) => c.name), // import block iterates ALL commands, declared order
    helpers,
  };
}

// commandPortRefs — the ext-port members one command's behaviorModel references (rules_domain_gen
// lines 1560-1577). Scan shape mirrors the source: emitWhen conds deep-walk for `expr`-keyed
// strings (nested or/and), emission bindings scan `expr:`-prefixed values; a member hits when
// `<member>.` appears in the expr text (the port registry itself lives in canonical.ports).
function commandPortRefs(bm, ports) {
  const refs = new Set();
  const scanExpr = (s) => {
    for (const p of ports) if (String(s).includes(`${p.member}.`)) refs.add(p.member);
  };
  const walkNode = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walkNode); return; }
    if (typeof node.expr === 'string') scanExpr(node.expr);
    for (const v of Object.values(node)) walkNode(v);
  };
  const ew = normalizeEmitWhen(bm);
  for (const br of ew) {
    walkNode(br.cond);
    for (const em of br.events) {
      for (const v of Object.values(em.bindings || {})) {
        if (String(v).startsWith('expr:')) scanExpr(String(v).slice(5));
      }
    }
  }
  if (Array.isArray(bm.emissions)) {
    for (const em of bm.emissions) {
      for (const v of Object.values(em.bindings || {})) {
        if (String(v).startsWith('expr:')) scanExpr(String(v).slice(5));
      }
    }
  }
  return refs;
}

// behaviorsModel — the command-flow wiring (rules_domain_gen lines 1962-2029): per command a match
// case running runReplyingPolicy(rule, helper)(state, cmd) [+ withPost + replyWith]. Decisions:
//   • rule reference: `new <Agg>Rules.<Cmd>Rule(<members>)` when the command's behaviorModel
//     references a port member (class-form Rule, closure injection); bare object ref otherwise.
//   • `.withPost(<Agg>Rules.checkEventPostconditions)` only when the aggregate has event
//     postcondition rules (canonical.emitsEventPostconditionCheck).
//   • Get<X>State query → Effect.reply(state) mechanical body (S1 ruling); the anchor per write
//     case is the command's concept noteId + elementHashes hash.
export function behaviorsModel(a, env) {
  const commands = a.commands ?? [];
  const ports = (a.ports ?? [])
    .slice()
    .sort((x, y) => `${x.fqPkg}.${x.trait}`.localeCompare(`${y.fqPkg}.${y.trait}`)); // rulesPortTraits sorted by trait FQN
  const portRuleCmds = new Set(
    commands
      .filter((c) => !isQuery(c) && c.behaviorModel && commandPortRefs(c.behaviorModel, ports).size > 0)
      .map((c) => c.name),
  );
  const replyNames = new Set(commands.map((c) => c.reply?.name).filter(Boolean));
  const withPost = a.emitsEventPostconditionCheck === true;
  const cases = commands.map((c) => {
    if (isQuery(c)) {
      const stReply = `${c.name}Reply`;
      if (/^Get\w+State$/.test(c.name) && replyNames.has(stReply)) {
        return { kind: 'query-getstate', name: c.name, replyType: stReply };
      }
      return { kind: 'query-skip', name: c.name }; // [GEN-SKIP] non-Get*State query fragment
    }
    return {
      kind: 'write',
      name: c.name,
      anchor: noteAnchor(c.noteId, env.elementHashes, '    '),
      usePort: ports.length > 0 && portRuleCmds.has(c.name),
      withPost,
    };
  });
  return {
    header: env.header,
    pkg: a.pkg ?? 'net.imadz',
    ctx: a.ctxPackage,
    agg: a.name,
    portTraits: ports.map((p) => `${p.fqPkg}.${p.trait}`),
    portParams: ports.map((p) => ({ member: p.member, trait: p.trait })),
    cases,
  };
}

// ruleParamsModel — the command → rule-param projection VOs (rules_domain_gen lines 1426-1464):
// one `final case class <Cmd>Params(...)` per WRITE command, field set+order = paramDefs (the same
// union-discovery as CommandHelpers' toParam), types from the declared command parameters. Each
// class is preceded by (a) `@knowledge` anchor lines — the DEDUPED rule targetIds of the command's
// attached preconditionRules (all of a command's rules share its concept noteId, so one line — but
// the dedup is by value, not by count) and (b) a doc comment listing the rule IDs (` / `-joined,
// attached order) or `（无命令级规则）`. List-typed fields get ` = List.empty` (E101 extension-slot
// default). The three import bits are decided by regex over the RENDERED field lines, exactly as
// the source does (paramsNeedId/paramsNeedInstant/paramsNeedVO vs the voNames registry).
export function ruleParamsModel(a, env) {
  const voNames = new Set(a.voNames ?? env.voNames ?? []);
  const policyBound = policyBoundOf(a);
  const classes = [];
  const lines = []; // rendered `name: Type` fragments — the import bits regex over these
  for (const c of a.commands ?? []) {
    if (isQuery(c)) continue;
    const rules = c.preconditionRules ?? [];
    const fields = computeParamDefs(c.name, c.parameters ?? [], rules, c.behaviorModel, policyBound.get(c.name));
    // cmdTypes: declared params minus ActorRef-typed (source filter; canonical never carries them,
    // but the fallback for a missing entry is 'String' either way)
    const cmdTypes = Object.fromEntries(
      (c.parameters ?? []).filter((p) => !String(scalaSig(p.dataType)).startsWith('ActorRef[')).map((p) => [p.name, sigOf(p)]),
    );
    const fieldReprs = fields.map((f) => {
      const t = cmdTypes[f] || 'String';
      return `${scalaRef(f)}: ${t}${/^List\[/.test(t) ? ' = List.empty' : ''}`;
    });
    lines.push(...fieldReprs);
    classes.push({
      name: c.name,
      anchors: [...new Set(rules.map((r) => r.noteId).filter(Boolean))].map((rid) => noteAnchor(rid, env.elementHashes, '  ').trimEnd()),
      ruleIds: rules.map((r) => r.id),
      fields: fieldReprs,
    });
  }
  const joined = lines.join(', ');
  return {
    header: env.header,
    pkg: a.pkg ?? 'net.imadz',
    ctx: a.ctxPackage,
    agg: a.name,
    classes,
    needId: /: Id\b/.test(joined),
    needInstant: /: Instant\b/.test(joined),
    // paramsNeedVO: type token right after `: ` (optionally under List[) is a domain/values VO
    needVO: [...joined.matchAll(/: (List\[)?([A-Za-z]\w*)/g)].some((m) => voNames.has(m[2])),
  };
}
