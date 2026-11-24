// aggregate-state-controller generator (family #34).
//
// Emits the single family artifact: the shared write-side aggregate state query
// controller, byte-identical to the approved golden
// test/reference/curated/aggregate-state-controller/v1/app/controllers/AggregateStateApiController.scala.
// The eleven other production files are supplies and are never emitted
// (registered in input.supplied with their real sha256).
//
// Contract highlights (2026-11-20 rulings, see the golden technical-input.json):
// - R-D: stateType is REQUIRED (raw None→replyType fallback unreachable);
//   gate and builder compose from the de-suffixed base name (Get${base}State on
//   both sides); a stateFields registry miss is rejected (no silent Nil); the
//   raw noteId slot is dropped (unknown input keys rejected).
// - R-F: ALL serialization writers are private implicit val (raw non-implicit
//   T8 is a raw defect fixed here); writers are emitted once per DISTINCT state
//   type in first-reference order (dedup dissolves the same-type implicit
//   ambiguity), and the emission order is the topological order of the
//   serialization type dependency graph: shared Writes → state writers →
//   reply writers → endpoint methods (the B8 collectAllDependencies discipline
//   applied to the writer face).
// - D4/R-F: shared field writers fire on EXACT nominal signature membership
//   (java.time.Instant / net.imadz.common.CommonTypes.Id); any other signature
//   must be a play-json builtin or the input is rejected fail-closed — the raw
//   substring heuristic and the silent String/Any fallback are unreachable.
// - C2/D-LAYOUT-100: fixed multi-line templates; the only length-conditional
//   emission is the endpoint Left branch (single line when it fits 100 columns,
//   otherwise the judged two-line wrap).

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { scalaSourcePath } from '../../lib/layout/layout-strategy.mjs';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };

const text = (value, what) => {
  if (typeof value !== 'string' || value.length === 0) fail('FORMAL_INPUT', `${what} must be nonempty text`);
  return value;
};
const fieldsOf = (record, names, what) => {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) fail('FORMAL_INPUT', `${what} must be an object`);
  const missing = names.filter(name => !(name in record));
  if (missing.length) fail('FORMAL_INPUT', `${what} missing fields: ${missing.join(', ')}`);
};
const bannedField = (record, name, what, why) => {
  if (name in record) fail('FORMAL_INPUT', `${what}.${name} is a raw-only slot and is not a target form (${why})`);
};
// DP08-1: strict schema — unknown keys reject at every declared object level.
// The registered guard already claimed this; the generic scan makes it true.
// Named raw-only slots keep their sharper bannedField diagnostics (checked first).
const strictKeys = (record, names, what) => {
  const extra = Object.keys(record).filter(name => !names.includes(name));
  if (extra.length) fail('FORMAL_INPUT', `${what} carries unknown schema key(s): ${extra.join(', ')} (strict schema, D-P08)`);
};
// DP08-2: raw-debt tokens (the D-P08 fail-closed family). The raw tree carries
// placeholder debt (`???`) and raw-degraded faces; neither may enter the
// curated input in ANY string slot, rejected at the input boundary regardless
// of whether the slot reaches emission bytes. Case-insensitive on the degraded
// marker. The set is deliberately minimal: `net.imadz.metarch` is a legitimate
// import prefix in THIS family, so the #26 kernel token list does not transfer.
const BANNED_INPUT_TOKENS = ['???', 'degraded'];
const walkDebtTokens = (node, what) => {
  if (typeof node === 'string') {
    const hit = BANNED_INPUT_TOKENS.find(token => node.toLowerCase().includes(token));
    if (hit) fail('FORMAL_INPUT', `${what} carries the raw-debt token ${JSON.stringify(hit)}; raw placeholder/degraded input shapes are rejected fail-closed (D-P08)`);
  } else if (Array.isArray(node)) node.forEach((item, index) => walkDebtTokens(item, `${what}[${index}]`));
  else if (node !== null && typeof node === 'object') for (const key of Object.keys(node)) walkDebtTokens(node[key], `${what}.${key}`);
};
const pascal = (value, what) => {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(value)) fail('FORMAL_INPUT', `${what} must be PascalCase`);
  return value;
};
const dotted = (value, what) => {
  if (!/^[a-z][a-z0-9_]*(\.[A-Za-z0-9_]+)+$/.test(value)) fail('FORMAL_INPUT', `${what} must be a dotted name`);
  return value;
};
const ident = (value, what) => {
  if (!/^[a-z][A-Za-z0-9]*$/.test(value)) fail('FORMAL_INPUT', `${what} must be a camelCase identifier`);
  return value;
};

// BC Naming B1/B2 composition rules.
const camel = base => base.charAt(0).toLowerCase() + base.slice(1);
const kebab = base => base.replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const simpleName = fqn => fqn.split('.').pop();
const stripAggregateSuffix = name => name.replace(/Aggregate$/, '');

// The judged serialization writer coverage (exact nominal match, no substring
// heuristic, no silent String/Any fallback): play-json builtins plus the fixed
// shared-writer library of the S1 controller face.
const PLAY_JSON_BUILTINS = new Set(['String', 'Int', 'Long', 'Boolean', 'Double', 'BigDecimal']);
const SHARED_WRITER_LIBRARY = new Set(['java.time.Instant', 'net.imadz.common.CommonTypes.Id']);
const FIELD_SIGNATURES = new Set([...PLAY_JSON_BUILTINS, ...SHARED_WRITER_LIBRARY]);

const KEYWORDS = new Set(['type', 'match', 'class', 'def', 'val', 'var', 'object', 'case']);
const col = name => (KEYWORDS.has(name) ? '`' + name + '`' : name);

function checkInput(input) {
  fieldsOf(input, ['schemaVersion', 'controllerPackage', 'controllerName', 'routeBase', 'aggregates', 'supplied'], 'input');
  if (input.schemaVersion !== 'truthsrc.aggregate-state-controller-input/v1')
    fail('FORMAL_INPUT', 'unsupported schemaVersion');
  walkDebtTokens(input, 'input');
  ident(input.controllerPackage, 'input.controllerPackage');
  pascal(input.controllerName, 'input.controllerName');
  text(input.routeBase, 'input.routeBase');
  bannedField(input, 'noteId', 'input', 'the raw model carries an unconsumed noteId slot (R-D: dropped from the curated model)');
  bannedField(input, 'entries', 'input', 'the raw builder name; the curated schema composes from aggregates (R-D)');
  strictKeys(input, ['schemaVersion', 'controllerPackage', 'controllerName', 'routeBase', 'aggregates', 'supplied'], 'input');
  if (!Array.isArray(input.aggregates)) fail('FORMAL_INPUT', 'input.aggregates must be an array (empty = the suppressed N=0 variant)');
  if (!Array.isArray(input.supplied)) fail('FORMAL_INPUT', 'input.supplied must be an array');

  const seenMethod = new Map(), seenRoute = new Map();
  for (const [index, aggregate] of input.aggregates.entries()) {
    const what = `input.aggregates[${index}]`;
    fieldsOf(aggregate, ['aggregateName', 'repositoryName', 'repositoryType', 'commandType', 'replyType', 'stateType', 'idParam', 'stateFields'], what);
    bannedField(aggregate, 'noteId', what, 'the raw model carries an unconsumed noteId slot (R-D: dropped from the curated model)');
    bannedField(aggregate, 'stateFieldsDefaulted', what, 'the raw registry-miss→Nil debt is unreachable (R-D: a miss is rejected, not defaulted)');
    strictKeys(aggregate, ['aggregateName', 'repositoryName', 'repositoryType', 'commandType', 'replyType', 'stateType', 'idParam', 'stateFields'], what);
    pascal(aggregate.aggregateName, `${what}.aggregateName`);
    ident(aggregate.repositoryName, `${what}.repositoryName`);
    dotted(aggregate.repositoryType, `${what}.repositoryType`);
    dotted(aggregate.commandType, `${what}.commandType`);
    dotted(aggregate.replyType, `${what}.replyType`);
    // R-D stateTypeRequired: the raw None→replyType fallback is unreachable by construction.
    dotted(aggregate.stateType, `${what}.stateType (R-D: stateType is required; the raw None→replyType fallback is a raw defect)`);
    ident(aggregate.idParam, `${what}.idParam`);
    const base = stripAggregateSuffix(aggregate.aggregateName);
    // R-D consistentBaseName: gate and builder compose Get${base}State from the
    // de-suffixed base on both sides (suffixed aggregates can no longer pass the
    // gate and resolve a different command).
    if (simpleName(aggregate.commandType) !== `Get${base}State`)
      fail('FORMAL_INPUT', `${what}.commandType must compose as Get${base}State from the de-suffixed base (R-D consistentBaseName)`);
    if (simpleName(aggregate.replyType) !== `Get${base}StateReply`)
      fail('FORMAL_INPUT', `${what}.replyType must compose as Get${base}StateReply from the de-suffixed base`);
    if (aggregate.repositoryName !== camel(simpleName(aggregate.repositoryType)))
      fail('FORMAL_INPUT', `${what}.repositoryName must be the camelCase of the repository type name (BC B7)`);
    if (!Array.isArray(aggregate.stateFields) || aggregate.stateFields.length === 0)
      fail('FORMAL_INPUT', `${what}.stateFields must be a nonempty array (R-D: a registry miss is rejected, never silently Nil)`);
    const seenFields = new Set();
    for (const [fieldIndex, field] of aggregate.stateFields.entries()) {
      fieldsOf(field, ['name', 'signature'], `${what}.stateFields[${fieldIndex}]`);
      strictKeys(field, ['name', 'signature'], `${what}.stateFields[${fieldIndex}]`);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.name))
        fail('FORMAL_INPUT', `${what}.stateFields[${fieldIndex}].name must be a bare identifier`);
      if (seenFields.has(field.name)) fail('FORMAL_INPUT', `${what} repeats the field name ${field.name}`);
      seenFields.add(field.name);
      if (!FIELD_SIGNATURES.has(field.signature))
        fail('FORMAL_INPUT', `${what}.stateFields[${fieldIndex}] signature ${JSON.stringify(field.signature)} has no judged writer (play-json builtin or the shared Instant/Id library); the raw substring heuristic and the silent String/Any fallback are rejected fail-closed`);
    }
    const methodName = camel(base), routeSegment = kebab(base);
    if (seenMethod.has(methodName)) fail('FORMAL_INPUT', `duplicate controller method name ${methodName} (E1 collision)`);
    if (seenRoute.has(routeSegment)) fail('FORMAL_INPUT', `duplicate route segment ${routeSegment} (E2: a URL is not a freely renamable identifier)`);
    seenMethod.set(methodName, index);
    seenRoute.set(routeSegment, index);
  }
  const seenSupply = new Set();
  for (const [index, supply] of input.supplied.entries()) {
    fieldsOf(supply, ['role', 'path', 'owner', 'sha256'], `input.supplied[${index}]`);
    strictKeys(supply, ['role', 'path', 'owner', 'sha256'], `input.supplied[${index}]`);
    if (seenSupply.has(supply.path)) fail('FORMAL_INPUT', `duplicate supplied path ${supply.path}`);
    seenSupply.add(supply.path);
    if (!/^[0-9a-f]{64}$/.test(supply.sha256)) fail('FORMAL_INPUT', `input.supplied[${index}].sha256 must be a hex sha256`);
  }
}

// ---------- renderers ----------

const FIXED_IMPORTS = [
  'javax.inject.Inject',
  'javax.inject.Singleton',
  'net.imadz.common.CommonTypes.Id',
  'net.imadz.common.auth.ApiError',
  'net.imadz.common.auth.Endpoint',
  'net.imadz.metarch.infrastructure.api.IdGuard',
  'play.api.libs.json.{Json, OWrites, Writes}',
  'play.api.mvc._',
  'scala.concurrent.ExecutionContext',
  'scala.concurrent.duration._',
];

function composeEntries(input) {
  return input.aggregates.map(aggregate => {
    const base = stripAggregateSuffix(aggregate.aggregateName);
    return {
      aggregate,
      base,
      methodName: camel(base),
      routeSegment: kebab(base),
      commandName: `Get${base}State`,
      replyName: `Get${base}StateReply`,
      stateName: simpleName(aggregate.stateType),
      cidVar: `${aggregate.idParam}Cid`,
    };
  });
}

// R-F dependency order: shared Writes for the field types actually present,
// then one state writer per DISTINCT state type in first-reference order,
// then the reply writers, then the endpoint methods.
function serializationOrder(entries) {
  const anyInstant = entries.some(entry => entry.aggregate.stateFields.some(field => field.signature === 'java.time.Instant'));
  const anyId = entries.some(entry => entry.aggregate.stateFields.some(field => field.signature === 'net.imadz.common.CommonTypes.Id'));
  const stateWriters = [];
  const byStateType = new Map();
  for (const entry of entries) {
    const key = entry.aggregate.stateType;
    if (!byStateType.has(key)) {
      const writer = { stateType: key, stateName: entry.stateName, fields: entry.aggregate.stateFields };
      byStateType.set(key, writer);
      stateWriters.push(writer);
    }
  }
  return { anyInstant, anyId, stateWriters };
}

function renderController(input) {
  const entries = composeEntries(input);
  const { anyInstant, anyId, stateWriters } = serializationOrder(entries);
  const dynamicImports = [...new Set(entries.flatMap(entry => [
    entry.aggregate.commandType, entry.aggregate.replyType,
    entry.aggregate.repositoryType, entry.aggregate.stateType,
  ]))].sort();
  const importedNames = new Set([...dynamicImports, ...FIXED_IMPORTS]);
  // Imported faces render by their bound simple name; unimported faces stay
  // fully-qualified (the sanctioned zero-import form for java.* faces).
  const displayOf = fqn => (importedNames.has(fqn) ? simpleName(fqn) : fqn);
  const importLines = [...dynamicImports, ...FIXED_IMPORTS].map(fqn => `import ${fqn}`).join('\n');

  const ctorRepos = entries.map(entry => `    ${entry.aggregate.repositoryName}: ${displayOf(entry.aggregate.repositoryType)},`).join('\n');

  const sharedWriters = [
    ...(anyInstant ? [
      '  // Instant → ISO-8601 串（用户裁决：序列化收 controller 层——不进 domain）',
      '  // null-safe：empty 状态的 Instant 中性值是 null（生成器 empty 工厂），写 JsNull 不炸',
      '  private implicit val s1InstantWrites: Writes[java.time.Instant] =',
      '    (i: java.time.Instant) => Json.toJson(Option(i).map(_.toString))',
    ] : []),
    ...(anyId ? [
      '  // Id(UUID) → 串（同上·controller 层私有·null-safe）',
      '  private implicit val s1IdWrites: Writes[Id] =',
      '    (i: Id) => Json.toJson(Option(i).map(_.toString))',
    ] : []),
  ].join('\n');

  const stateWriterBlocks = stateWriters.map(writer => {
    const pairs = writer.fields
      .map(field => `      "${field.name}" -> Json.toJson[${displayOf(field.signature)}](st.${col(field.name)})`)
      .join(',\n');
    return [
      `  /** S1 聚合面：${writer.stateName} → JSON（逐字段手写·无字段数上限） */`,
      `  private implicit val writes${writer.stateName}: OWrites[${writer.stateName}] =`,
      `    (st: ${writer.stateName}) => Json.obj(`,
      `${pairs})`,
    ].join('\n');
  }).join('\n\n');

  const replyWriterBlocks = entries.map(entry => [
    `  /** S1 聚合面：${entry.replyName} 信封（state 字段平铺）——implicit 供 DSL apply[T] 隐参取用 */`,
    `  private implicit val writes${entry.replyName}: OWrites[${entry.replyName}] =`,
    `    (r: ${entry.replyName}) =>`,
    `      (writes${entry.stateName}: OWrites[${entry.stateName}]).writes(r.state)`,
  ].join('\n')).join('\n\n');

  const methodBlocks = entries.map(entry => {
    // C2/D-LAYOUT-100: single line when it fits, otherwise the judged two-line wrap.
    const singleLine = `            scala.concurrent.Future.successful(Left(err): Either[ApiError, ${entry.replyName}])`;
    const leftBlock = singleLine.length <= 100
      ? singleLine
      : `            scala.concurrent.Future.successful(\n              Left(err): Either[ApiError, ${entry.replyName}])`;
    return [
      `  /** S1 聚合面：${entry.routeSegment} 写侧状态强一致查询（Get<X>State → Reply·不产事件） */`,
      `  def ${entry.methodName}(id: String): Action[AnyContent] =`,
      `    api.global.read().apply[${entry.replyName}] {`,
      `      _ => {`,
      `        IdGuard.parse("${entry.aggregate.idParam}" -> id) match {`,
      `          case Right(Seq(${entry.cidVar})) =>`,
      `            ${entry.aggregate.repositoryName}.entityRef(id).ask {`,
      `              (replyTo: akka.actor.typed.ActorRef[${entry.replyName}]) =>`,
      `                ${entry.commandName}(${entry.cidVar}, replyTo)`,
      `            }.map(reply => Right(reply): Either[ApiError, ${entry.replyName}])`,
      `          case Left(err) =>`,
      leftBlock,
      `        }`,
      `      }`,
      `    }`,
    ].join('\n');
  }).join('\n\n');

  const sections = [
    `package ${input.controllerPackage}`,
    '',
    importLines,
    '',
    `/** ${input.controllerName}: S1 聚合面写侧强一致状态查询（每聚合 Get<X>State 直读·2026-09-27 生成范式）`,
    '  * 序列化收在 controller 层（用户裁决：domain/application 不引入 play-json）。 */',
    '@Singleton',
    `class ${input.controllerName} @Inject() (`,
    '    api: Endpoint,',
    ctorRepos,
    '    val cc: ControllerComponents)(implicit ec: ExecutionContext) extends BaseController {',
    '',
    '  override def controllerComponents: ControllerComponents = cc',
    '  private implicit val timeout: akka.util.Timeout = akka.util.Timeout(5.seconds)',
    ...(sharedWriters === '' ? [] : ['', sharedWriters]),
    '',
    stateWriterBlocks,
    '',
    replyWriterBlocks,
    '',
    methodBlocks,
    '}',
  ];
  return sections.join('\n') + '\n';
}

function renderAll(input) {
  const outputs = {};
  if (input.aggregates.length > 0) {
    outputs[scalaSourcePath(input.controllerPackage, `${input.controllerName}.scala`)] = renderController(input);
  }
  return outputs;
}

// ---------- D-P08 negatives battery (DP08-4) ----------
//
// Twelve directed negatives: each mutates the input and must be rejected with
// a FORMAL_INPUT error whose message carries the expected substring. The two
// collision negatives reshape aggregates[1] to satisfy the earlier R-D checks
// so the targeted check is the one that fires (the #42 battery calibration
// discipline). Entries that cannot apply to a given input shape are skipped.
const NEGATIVES = [
  { name: 'missing stateType (R-D stateTypeRequired)', expect: 'missing fields: stateType',
    mutate: i => { delete i.aggregates[0].stateType; } },
  { name: 'command composition mismatch (R-D consistentBaseName)', expect: 'must compose as GetStockState',
    mutate: i => { i.aggregates[1].commandType = i.aggregates[1].commandType.replace('GetStockState', 'GetStockAggregateState'); } },
  { name: 'empty stateFields (registry miss)', expect: 'nonempty array',
    mutate: i => { i.aggregates[0].stateFields = []; } },
  { name: 'raw noteId slot', expect: 'raw-only slot',
    mutate: i => { i.aggregates[0].noteId = 'raw'; } },
  { name: 'base-collision duplicate method', expect: 'duplicate controller method name',
    mutate: i => { i.aggregates[1].aggregateName = 'ReservationAggregate';
      i.aggregates[1].commandType = i.aggregates[0].commandType;
      i.aggregates[1].replyType = i.aggregates[0].replyType; } },
  { name: 'duplicate-method (exact collision)', expect: 'duplicate controller method name',
    mutate: i => { i.aggregates[1] = JSON.parse(JSON.stringify(i.aggregates[0])); } },
  { name: 'uncovered signature (Money)', expect: 'has no judged writer',
    mutate: i => { i.aggregates[0].stateFields.push({ name: 'money', signature: 'Money' }); } },
  { name: 'unknown schema key (raw entries name)', expect: 'raw-only slot',
    mutate: i => { i.entries = []; } },
  { name: 'unknown top-level schema key (generic scan)', expect: 'unknown schema key',
    mutate: i => { i.someUnknownTopKey = 'x'; } },
  { name: 'unknown aggregate-level schema key (generic scan)', expect: 'unknown schema key',
    mutate: i => { i.aggregates[0].rawUnknownSlot = 'x'; } },
  { name: 'routeBase carries the ??? placeholder', expect: 'raw-debt token "???"',
    mutate: i => { i.routeBase = '/???'; } },
  { name: 'degraded marker in a value', expect: 'raw-debt token "degraded"',
    mutate: i => { i.routeBase = '/api/degraded-state'; } },
];

function runNegatives(input) {
  const failures = [];
  let applied = 0;
  for (const negative of NEGATIVES) {
    let candidate;
    try {
      candidate = JSON.parse(JSON.stringify(input));
      negative.mutate(candidate);
    } catch { continue; }
    applied += 1;
    try {
      checkInput(candidate);
      renderAll(candidate);
      failures.push(`${negative.name}: ACCEPTED (expected rejection)`);
    } catch (error) {
      if (!(error && typeof error.message === 'string' && error.message.includes(negative.expect)))
        failures.push(`${negative.name}: rejected with an unexpected message — got ${JSON.stringify(String(error.message).slice(0, 160))}, expected substring ${JSON.stringify(negative.expect)}`);
    }
  }
  return { expected: applied, rejected: applied - failures.length, failures };
}

export function generateAggregateStateController(inputJson) {
  const input = JSON.parse(JSON.stringify(inputJson));
  checkInput(input);
  return renderAll(input);
}

// ---------- unified-emitter family registration (emitter-unification Phase 1) ----------
// Ported verbatim from tools/gen-aggregate-state-controller.mjs, the
// byte-parity reference. This module is the family-interface shape template of
// the unified emitter: checkInput (fail-closed) → renderAll (byte-deterministic
// map) → NEGATIVES battery, already in the uniform shape ({expected, rejected,
// failures}) — the reference CLI block and its local strict-JSON parser were
// the only removals.

export const family = {
  id: 'aggregate-state-controller',
  familyNumber: 34,
  inputSchema: 'truthsrc.aggregate-state-controller-input/v1',
  goldenRoot: 'test/reference/curated/aggregate-state-controller/v1',
  fixtureDir: 'test/fixtures/aggregate-state-controller-v1',
  toolsRef: 'tools/gen-aggregate-state-controller.mjs',
  toolsExport: 'generateAggregateStateController',
  checkInput,
  renderAll,
  runNegatives,
};
