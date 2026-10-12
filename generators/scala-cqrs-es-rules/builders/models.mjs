// models.mjs — rules-face builders (V4-3). Canonical (+ augment-rules-canonical slots) → pure model.
// All ordering/semantic decisions live here; templates/scala.mjs only renders text.
import { computeParamDefs, normalizeEmitWhen, scalaRef } from './rules.mjs';

// A command is a query fragment (no helper, no behaviors wiring) when it is readOnly. The canonical
// marks the synthesized Get<Name>State query readOnly; everything else is a write command.
const isQuery = (c) => c.readOnly === true;

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
export function commandHelpersModel(a, env) {
  const commands = a.commands ?? [];
  const helpers = commands.filter((c) => !isQuery(c)).map((c) => {
    const params = c.parameters ?? [];
    const fields = computeParamDefs(c.name, params, c.preconditionRules, c.behaviorModel);
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
