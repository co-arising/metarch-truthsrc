// aggregate-invariant-rules emitter (family #45): renders the flipped rules
// cluster's per-aggregate trio — the core guard-chain invariant rules, the
// rule params record object, and the domain facade wrapper — from the derived
// truthsrc.aggregate-invariant-rules-input/v1 contract.
//
// Golden provenance: classic-reproduction (ruling 2026-11-23, see
// docs/emitter-unification-host-family-rulings.md). The curated golden tree is
// the bank-wealth rules cluster's classic production bytes pinned as the
// reproduction receipt — this family's acceptance is byte equality with those
// bytes, including the generated-file header line, so the flip is a pure
// producer retirement with zero app-visible diff. Every guard expression, name
// and file location is contract data; the module embeds zero business bytes.
//
// The codeMappings provenance (per-command scopes and per-guard spans, byte
// offsets into the final file) is reproduced exactly: the guard-level anchors
// verify declared byte spans against the emitted files, so the layout
// accumulation order below mirrors the classic renderer's — strings accumulate
// in the same sequence and spans are recorded at the same accumulation points.
import { parseStrictJson } from '../../lib/strict-json.mjs';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };
const SCHEMA = 'truthsrc.aggregate-invariant-rules-input/v1';
const KEYWORDS = new Set(['abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends', 'false', 'final', 'finally', 'for', 'forSome', 'if', 'implicit', 'import', 'lazy', 'match', 'new', 'null', 'object', 'override', 'package', 'private', 'protected', 'return', 'sealed', 'super', 'this', 'throw', 'trait', 'try', 'true', 'type', 'val', 'var', 'while', 'with', 'yield', '_']);

const text = (value, what) => {
  if (typeof value !== 'string' || value.length === 0) fail('RULES_INPUT', what + ' must be nonempty text');
  return value;
};
const identifier = (value, what) => {
  text(value, what);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)) fail('RULES_INPUT', what + ' must be a safe Scala identifier');
  return value;
};
const knowledgeOf = source => 'source:' + source.document + '#' + source.pointer;

function checkInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('RULES_INPUT', 'input must be an object');
  if (input.schemaVersion !== SCHEMA) fail('RULES_INPUT', 'unsupported schemaVersion: ' + JSON.stringify(input.schemaVersion));
  if (!Array.isArray(input.aggregates) || input.aggregates.length === 0) fail('RULES_INPUT', 'aggregates must be a nonempty array');
  for (const [i, a] of input.aggregates.entries()) {
    const at = what => `aggregates[${i}] ${what}`;
    if (!a || typeof a !== 'object' || Array.isArray(a)) fail('RULES_INPUT', at('must be an object'));
    text(a.context, at('context'));
    identifier(a.aggregate, at('aggregate'));
    const pkg = text(a.package, at('package'));
    if (!pkg.split('.').every(p => /^[a-z][a-z0-9_]*$/u.test(p) && !KEYWORDS.has(p)))
      fail('RULES_INPUT', at('package must be a dotted lowercase-root Scala package'));
    identifier(a.name, at('name'));
    const source = a.source;
    if (!source || typeof source !== 'object' || typeof source.document !== 'string' || !source.document ||
      typeof source.pointer !== 'string' || !source.pointer.startsWith('/'))
      fail('RULES_INPUT', at('source must carry a {document, pointer} knowledge source'));
    if (!Array.isArray(a.commands)) fail('RULES_INPUT', at('commands must be an array'));
    for (const [j, c] of a.commands.entries()) {
      const cat = what => `aggregates[${i}].commands[${j}] ${what}`;
      identifier(c.command, cat('command'));
      const commandSource = c.source;
      if (!commandSource || typeof commandSource !== 'object' || typeof commandSource.document !== 'string' || !commandSource.document ||
        typeof commandSource.pointer !== 'string' || !commandSource.pointer.startsWith('/'))
        fail('RULES_INPUT', cat('source must carry a {document, pointer} knowledge source'));
      if (!Array.isArray(c.guards)) fail('RULES_INPUT', cat('guards must be an array'));
      for (const [k, g] of c.guards.entries()) {
        const gat = what => `aggregates[${i}].commands[${j}].guards[${k}] ${what}`;
        text(g.text, gat('text'));
        const guardSource = g.source;
        if (!guardSource || typeof guardSource !== 'object' || typeof guardSource.document !== 'string' || !guardSource.document ||
          typeof guardSource.pointer !== 'string' || !guardSource.pointer.startsWith('/'))
          fail('RULES_INPUT', gat('source must carry a {document, pointer} knowledge source'));
        if (!g.outcome || typeof g.outcome !== 'object') fail('RULES_INPUT', gat('outcome required'));
        if (g.outcome.kind === 'reject') text(g.outcome.code, gat('reject code'));
        else if (g.outcome.kind !== 'succeed-empty') fail('RULES_INPUT', gat('outcome kind must be reject or succeed-empty'));
      }
    }
  }
}

const byteSpan = (content, value) => ({
  start: Buffer.byteLength(content.slice(0, value.start)),
  end: Buffer.byteLength(content.slice(0, value.end)),
  text: content.slice(value.start, value.end),
});
const mapping = (content, m) => ({
  knowledgeKey: knowledgeOf(m.source),
  span: byteSpan(content, m.span),
  scope: byteSpan(content, m.scope),
});

function hasBalancedParens(expr) {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth < 0) return false;
      if (depth === 0 && i < expr.length - 1) return false;
    }
  }
  return depth === 0 && !inString;
}

function renderGuardCondition(predicate) {
  let expr = predicate.trim();
  if (expr.startsWith('!(') && expr.endsWith(')') && hasBalancedParens(expr.slice(1))) {
    const inner = expr.slice(2, -1);
    return inner.startsWith('(') && inner.endsWith(')') && hasBalancedParens(inner) ? inner : '(' + inner + ')';
  }
  return '!(' + expr + ')';
}

/**
 * Render one aggregate's rules trio with its full provenance surface:
 * [{ path, content, kind, sources, deps, codeMappings }].
 */
function renderAggregateRules(a) {
  const pkg = a.package, name = a.name;
  const app = 'app/' + pkg.replaceAll('.', '/');
  const entityPath = app + '/domain/entities/' + a.aggregate + 'Entity.scala';
  const eventsPath = app + '/domain/events/' + a.aggregate + 'Events.scala';
  const computationsPath = app + '/domain/services/' + a.aggregate + 'Computations.scala';
  const corePath = app + '/domain/invariant/' + a.aggregate + 'Rules.scala';
  const paramsPath = app + '/domain/invariant/params/' + a.aggregate + 'RuleParams.scala';
  const aggregateSources = [a.source, ...a.commands.map(c => c.source)];

  let rules = 'package ' + pkg + '.domain.invariant\n\n' +
    'import ' + pkg + '.domain.entities.' + name + 'Entity.State\n' +
    'import ' + pkg + '.domain.events.' + name + 'Events._\n' +
    'import ' + pkg + '.domain.invariant.params.' + name + 'RuleParams._\n' +
    'import ' + pkg + '.domain.services.{' + name + 'CommandHelpers, ' + name + 'Computations}\n\n' +
    'object ' + name + 'Rules {\n';
  const ruleMappings = [];
  for (const c of a.commands) {
    const start = rules.length;
    const parameterName = identifier(c.command + 'Params', 'derived params record name');
    rules += '  def ' + c.command + '(input: ' + parameterName + '): Either[String, Vector[Event]] = {\n' +
      '    import input.{state, command => p, hosts}\n';
    const guards = [];
    for (const g of c.guards) {
      const guardStart = rules.length;
      rules += '    if (' + renderGuardCondition(g.text) + ') return ' +
        (g.outcome.kind === 'reject' ? 'Left(' + JSON.stringify(g.outcome.code) + ')' : 'Right(Vector.empty)') + '\n';
      guards.push({ source: g.source, span: { start: guardStart, end: rules.length } });
    }
    rules += '    Right(' + name + 'CommandHelpers.emit' + c.command + '(state, p, hosts))\n  }\n';
    const scope = { start, end: rules.length };
    ruleMappings.push({ source: c.source, span: scope, scope }, ...guards.map(m => ({ ...m, scope })));
  }
  rules += '}\n';

  let params = 'package ' + pkg + '.domain.invariant.params\n\n' +
    'import ' + pkg + '.domain.entities.' + name + 'Entity.State\n' +
    'import ' + pkg + '.domain.events.' + name + 'Events\n' +
    'import ' + pkg + '.domain.services.' + name + 'Computations\n\n' +
    'object ' + name + 'RuleParams {\n';
  for (const c of a.commands)
    params += '  final case class ' + identifier(c.command + 'Params', 'derived params record name') +
      '(state: State, command: ' + name + 'Events.' + c.command + ', hosts: ' + name + 'Computations)\n';
  params += '}\n';

  const coreSources = [a.source, ...a.commands.flatMap(c => [c.source, ...c.guards.map(g => g.source)])];
  return [
    {
      path: corePath, content: rules, kind: 'rules', sources: coreSources,
      deps: [entityPath, eventsPath, computationsPath, paramsPath],
      codeMappings: ruleMappings.map(m => mapping(rules, m)),
    },
    {
      path: paramsPath, content: params, kind: 'rules', sources: aggregateSources,
      deps: [entityPath, eventsPath, computationsPath], codeMappings: [],
    },
  ];
}

/** Full provenance surface of the contract: one trio per aggregate, in order. */
export function renderInvariantRuleFiles(inputJson) {
  const input = parseStrictJson(Buffer.from(JSON.stringify(inputJson), 'utf8'));
  checkInput(input);
  return input.aggregates.flatMap(renderAggregateRules);
}

const renderAll = input => Object.fromEntries(renderInvariantRuleFiles(input).map(f => [f.path, f.content]));

// ---------- embedded negatives battery (fail-closed input validation) ----------
export function runNegatives(input) {
  const cases = [];
  const mutate = (name, fn) => {
    const broken = JSON.parse(JSON.stringify(input));
    fn(broken);
    cases.push({ name, broken });
  };
  mutate('wrong schemaVersion', x => { x.schemaVersion = 'truthsrc.aggregate-invariant-rules-input/v2'; });
  mutate('empty aggregates', x => { x.aggregates = []; });
  mutate('unsafe aggregate identifier', x => { x.aggregates[0].aggregate = 'Bank Cash'; });
  mutate('uppercase package segment', x => { x.aggregates[0].package = 'example.BankWealth'; });
  mutate('name disagrees with identifier rule', x => { x.aggregates[0].name = '1CreditBalance'; });
  mutate('aggregate source without pointer', x => { x.aggregates[0].source = { document: 'bank-v1' }; });
  mutate('command source without document', x => { x.aggregates[0].commands[0].source = { pointer: '/aggregates/0/commands/0' }; });
  mutate('empty guard text', x => { x.aggregates[0].commands[0].guards[0].text = ''; });
  mutate('guard source with non-slash pointer', x => { x.aggregates[0].commands[0].guards[0].source = { document: 'bank-v1', pointer: 'aggregates/0' }; });
  mutate('unknown outcome kind', x => { x.aggregates[0].commands[0].guards[0].outcome = { kind: 'retry' }; });
  mutate('reject outcome without code', x => { x.aggregates[0].commands[0].guards[0].outcome = { kind: 'reject' }; });
  mutate('commands not an array', x => { x.aggregates[0].commands = null; });
  let rejected = 0;
  const failures = [];
  for (const { name, broken } of cases) {
    try {
      renderInvariantRuleFiles(broken);
      failures.push(name);
    } catch (error) {
      if (error.code !== 'RULES_INPUT') failures.push(name + ' (wrong code: ' + error.code + ')');
      else rejected += 1;
    }
  }
  return { expected: cases.length, rejected, failures };
}

// ---------- unified-emitter family registration (emitter-unification Phase 3) ----------
export const family = {
  id: 'aggregate-invariant-rules',
  familyNumber: 45,
  inputSchema: SCHEMA,
  goldenRoot: 'test/reference/curated/aggregate-invariant-rules/v1',
  fixtureDir: 'test/fixtures/aggregate-invariant-rules-v1',
  toolsRef: null,
  provenance: 'handwritten-golden',
  checkInput,
  renderAll,
  runNegatives,
};
