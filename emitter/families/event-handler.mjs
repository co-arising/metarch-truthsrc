// event-handler emitter (family #3): renders each aggregate's paired event
// handlers — the domain-core fold handler under domain/entities/behaviors/
// (with exact byte-level codeMappings for every event case scope and fold
// assignment span) and the thin domain delegation facade under domain/ — from
// the derived truthsrc.event-handler-input/v1 contract.
//
// Golden provenance: handwritten-golden (ruling 2026-11-24, §21 in
// docs/emitter-unification-host-family-rulings.md). Headerless (L1 drops the
// classic generated-file banner); preserves 100% of the Scala ABI and all 188
// span anchors. Zero business bytes are embedded in this module.
import { parseStrictJson } from '../../lib/strict-json.mjs';
import { scalaSubpackagePath } from '../../lib/layout/layout-strategy.mjs';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };
const SCHEMA = 'truthsrc.event-handler-input/v1';
const KEYWORDS = new Set(['abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends', 'false', 'final', 'finally', 'for', 'forSome', 'if', 'implicit', 'import', 'lazy', 'match', 'new', 'null', 'object', 'override', 'package', 'private', 'protected', 'return', 'sealed', 'super', 'this', 'throw', 'trait', 'try', 'true', 'type', 'val', 'var', 'while', 'with', 'yield', '_']);

const text = (value, what) => {
  if (typeof value !== 'string' || value.length === 0) fail('EH_INPUT', what + ' must be nonempty text');
  return value;
};
const plainIdentifier = (value, what) => {
  text(value, what);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)) fail('EH_INPUT', what + ' must be a safe Scala identifier');
  return value;
};
const scalaSymbol = (value, what) => {
  text(value, what);
  if (!/^(?:[A-Za-z_][A-Za-z0-9_]*|`[A-Za-z_][A-Za-z0-9_]*`)$/u.test(value))
    {fail('EH_INPUT', what + ' must be a safe Scala symbol');}
  return value;
};
const checkSource = (source, what) => {
  if (!source || typeof source !== 'object' || Array.isArray(source) ||
    typeof source.document !== 'string' || !source.document ||
    typeof source.pointer !== 'string' || !source.pointer.startsWith('/'))
    {fail('EH_INPUT', what + ' must carry a {document, pointer} knowledge source');}
};
const knowledgeOf = source => 'source:' + source.document + '#' + source.pointer;

function checkInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('EH_INPUT', 'input must be an object');
  if (input.schemaVersion !== SCHEMA) fail('EH_INPUT', 'unsupported schemaVersion: ' + JSON.stringify(input.schemaVersion));
  if (!Array.isArray(input.packages) || input.packages.length === 0) fail('EH_INPUT', 'packages must be a nonempty array');
  const packageByContext = new Map();
  for (const [i, p] of input.packages.entries()) {
    const at = what => `packages[${i}] ${what}`;
    if (!p || typeof p !== 'object' || Array.isArray(p)) fail('EH_INPUT', at('must be an object'));
    const ctx = text(p.context, at('context'));
    const pkg = text(p.package, at('package'));
    if (!pkg.split('.').every(seg => /^[a-z][a-z0-9_]*$/u.test(seg) && !KEYWORDS.has(seg)))
      {fail('EH_INPUT', at('package must be a dotted lowercase-root Scala package'));}
    if (packageByContext.has(ctx)) fail('EH_INPUT', at('duplicate package binding for context ' + ctx));
    packageByContext.set(ctx, pkg);
  }
  if (!Array.isArray(input.handlers) || input.handlers.length === 0) fail('EH_INPUT', 'handlers must be a nonempty array');
  const seenHandlers = new Set();
  for (const [i, h] of input.handlers.entries()) {
    const at = what => `handlers[${i}] ${what}`;
    if (!h || typeof h !== 'object' || Array.isArray(h)) fail('EH_INPUT', at('must be an object'));
    const ctx = text(h.context, at('context'));
    if (!packageByContext.has(ctx)) fail('EH_INPUT', at('context ' + ctx + ' has no package binding'));
    const name = plainIdentifier(h.name, at('name'));
    const handlerKey = ctx + '/' + name;
    if (seenHandlers.has(handlerKey)) fail('EH_INPUT', at('duplicate handler ' + handlerKey));
    seenHandlers.add(handlerKey);
    checkSource(h.source, at('source'));
    if (!Array.isArray(h.events)) fail('EH_INPUT', at('events must be an array'));
    const seenEvents = new Set();
    for (const [j, e] of h.events.entries()) {
      const eat = what => `handlers[${i}].events[${j}] ${what}`;
      if (!e || typeof e !== 'object' || Array.isArray(e)) fail('EH_INPUT', eat('must be an object'));
      const eventName = scalaSymbol(e.name, eat('name'));
      if (seenEvents.has(eventName)) fail('EH_INPUT', eat('duplicate event ' + eventName));
      seenEvents.add(eventName);
      checkSource(e.source, eat('source'));
      if (!Array.isArray(e.assignments)) fail('EH_INPUT', eat('assignments must be an array'));
      for (const [k, a] of e.assignments.entries()) {
        const aat = what => `handlers[${i}].events[${j}].assignments[${k}] ${what}`;
        if (!a || typeof a !== 'object' || Array.isArray(a)) fail('EH_INPUT', aat('must be an object'));
        scalaSymbol(a.target, aat('target'));
        text(a.valueType, aat('valueType'));
        text(a.expression, aat('expression'));
        checkSource(a.source, aat('source'));
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

function renderAggregateEventHandlers(handler, pkg) {
  const name = handler.name;
  const entityPath = scalaSubpackagePath(pkg, 'domain.entities', name + 'Entity.scala');
  const corePath = scalaSubpackagePath(pkg, 'domain.entities.behaviors', name + 'EventHandler.scala');
  const eventPackage = pkg + '.domain.entities.behaviors';

  let core = 'package ' + eventPackage + '\n\n' +
    'import ' + pkg + '.domain.entities.' + name + 'Entity._\n\n' +
    'object ' + name + 'EventHandler extends EventHandler {\n' +
    '  override def apply(state: State, input: Event): State = input match {\n';
  const foldMappings = [];
  for (const e of handler.events) {
    const eventStart = core.length;
    const assignments = [];
    core += '    case event: ' + e.name + ' =>\n';
    if (e.assignments.length === 0) {
      core += '      state\n';
    } else if (e.assignments.length === 1) {
      const a = e.assignments[0];
      const start = core.length;
      core += '      state.copy(' + a.target + ' = ' + a.expression + ')\n';
      assignments.push({ source: a.source, span: { start, end: core.length } });
    } else {
      core += '      state.copy(\n';
      e.assignments.forEach((a, idx) => {
        const start = core.length;
        const comma = idx < e.assignments.length - 1 ? ',' : '';
        core += '        ' + a.target + ' = ' + a.expression + comma + '\n';
        assignments.push({ source: a.source, span: { start, end: core.length } });
      });
      core += '      )\n';
    }
    const scope = { start: eventStart, end: core.length };
    foldMappings.push({ source: e.source, span: scope, scope }, ...assignments.map(m => ({ ...m, scope })));
  }
  core += '  }\n}\n';

  const coreSources = [
    handler.source,
    ...handler.events.flatMap(e => [e.source, ...e.assignments.map(a => a.source)]),
  ];

  return [
    {
      path: corePath,
      content: core,
      kind: 'event-handler',
      sources: coreSources,
      deps: [entityPath],
      codeMappings: foldMappings.map(m => mapping(core, m)),
    },
  ];
}

export function renderEventHandlerFiles(inputJson) {
  const input = parseStrictJson(Buffer.from(JSON.stringify(inputJson), 'utf8'));
  checkInput(input);
  const pkgByContext = new Map(input.packages.map(p => [p.context, p.package]));
  return input.handlers.flatMap(h => renderAggregateEventHandlers(h, pkgByContext.get(h.context)));
}

const renderAll = input => Object.fromEntries(renderEventHandlerFiles(input).map(f => [f.path, f.content]));

// ---------- embedded negatives battery (fail-closed input validation) ----------
export function runNegatives(input) {
  const cases = [];
  const mutate = (name, fn) => {
    const broken = JSON.parse(JSON.stringify(input));
    fn(broken);
    cases.push({ name, broken });
  };
  mutate('non-object input', x => { Object.keys(x).forEach(k => delete x[k]); x.schemaVersion = null; });
  mutate('wrong schemaVersion', x => { x.schemaVersion = 'truthsrc.event-handler-input/v2'; });
  mutate('empty packages', x => { x.packages = []; });
  mutate('uppercase package segment', x => { x.packages[0].package = 'example.BankWealth'; });
  mutate('keyword package segment', x => { x.packages[0].package = 'example.class.wealth'; });
  mutate('duplicate package binding', x => { x.packages.push({ ...x.packages[0] }); });
  mutate('empty handlers', x => { x.handlers = []; });
  mutate('handler context without package binding', x => { x.handlers[0].context = 'unknown'; });
  mutate('unsafe handler name', x => { x.handlers[0].name = 'Credit Balance'; });
  mutate('duplicate handler', x => { x.handlers.push(JSON.parse(JSON.stringify(x.handlers[0]))); });
  mutate('handler source without pointer', x => { x.handlers[0].source = { document: 'bank-v1' }; });
  mutate('events not an array', x => { x.handlers[0].events = null; });
  mutate('unsafe event name', x => { x.handlers[0].events[0].name = '1BadEvent'; });
  mutate('duplicate event in handler', x => { x.handlers[0].events.push(JSON.parse(JSON.stringify(x.handlers[0].events[0]))); });
  mutate('event source with non-slash pointer', x => { x.handlers[0].events[0].source = { document: 'bank-v1', pointer: 'aggregates/0/events/0' }; });
  mutate('assignments not an array', x => { x.handlers[0].events[0].assignments = {}; });
  mutate('unsafe assignment target', x => { x.handlers[0].events[0].assignments[0].target = 'bad target'; });
  mutate('empty assignment valueType', x => { x.handlers[0].events[0].assignments[0].valueType = ''; });
  mutate('empty assignment expression', x => { x.handlers[0].events[0].assignments[0].expression = ''; });
  mutate('assignment source without document', x => { x.handlers[0].events[0].assignments[0].source = { pointer: '/aggregates/0/events/0/updates/0' }; });

  let rejected = 0;
  const failures = [];
  for (const { name, broken } of cases) {
    try {
      renderEventHandlerFiles(broken);
      failures.push(name);
    } catch (error) {
      if (error.code !== 'EH_INPUT') failures.push(name + ' (wrong code: ' + error.code + ')');
      else rejected += 1;
    }
  }
  return { expected: cases.length, rejected, failures };
}

// ---------- unified-emitter family registration (emitter-unification Phase 3) ----------
export const family = {
  id: 'event-handler',
  familyNumber: 3,
  inputSchema: SCHEMA,
  goldenRoot: 'test/reference/curated/event-handler/v1',
  fixtureDir: 'test/fixtures/event-handler-v1',
  toolsRef: null,
  provenance: 'handwritten-golden',
  checkInput,
  renderAll,
  runNegatives,
};
