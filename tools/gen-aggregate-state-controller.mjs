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
  ident(input.controllerPackage, 'input.controllerPackage');
  pascal(input.controllerName, 'input.controllerName');
  text(input.routeBase, 'input.routeBase');
  bannedField(input, 'noteId', 'input', 'the raw model carries an unconsumed noteId slot (R-D: dropped from the curated model)');
  bannedField(input, 'entries', 'input', 'the raw builder name; the curated schema composes from aggregates (R-D)');
  if (!Array.isArray(input.aggregates)) fail('FORMAL_INPUT', 'input.aggregates must be an array (empty = the suppressed N=0 variant)');
  if (!Array.isArray(input.supplied)) fail('FORMAL_INPUT', 'input.supplied must be an array');

  const seenMethod = new Map(), seenRoute = new Map();
  for (const [index, aggregate] of input.aggregates.entries()) {
    const what = `input.aggregates[${index}]`;
    fieldsOf(aggregate, ['aggregateName', 'repositoryName', 'repositoryType', 'commandType', 'replyType', 'stateType', 'idParam', 'stateFields'], what);
    bannedField(aggregate, 'noteId', what, 'the raw model carries an unconsumed noteId slot (R-D: dropped from the curated model)');
    bannedField(aggregate, 'stateFieldsDefaulted', what, 'the raw registry-miss→Nil debt is unreachable (R-D: a miss is rejected, not defaulted)');
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
    outputs[`app/${input.controllerPackage}/${input.controllerName}.scala`] = renderController(input);
  }
  return outputs;
}

export function generateAggregateStateController(inputJson) {
  const input = JSON.parse(JSON.stringify(inputJson));
  checkInput(input);
  return renderAll(input);
}

function parseStrictJson(raw) {
  return JSON.parse(raw.toString('utf8'));
}

// Public CLI:
//   node tools/gen-aggregate-state-controller.mjs <input.json> <output-dir>
//   node tools/gen-aggregate-state-controller.mjs verify <input.json> <golden-file>
if (process.argv[1] && process.argv[1].endsWith('gen-aggregate-state-controller.mjs')) {
  const args = process.argv.slice(2);
  const mode = args[0] === 'verify' ? 'verify' : 'generate';
  const [inputPath, target] = mode === 'verify' ? args.slice(1) : args;
  if (!inputPath || !target) fail('FORMAL_USAGE',
    'usage: gen-aggregate-state-controller.mjs <input.json> <output-dir> | verify <input.json> <golden-file>');
  const input = parseStrictJson(fs.readFileSync(inputPath));
  checkInput(input);
  const outputs = renderAll(input);
  if (mode === 'verify') {
    const golden = fs.readFileSync(target);
    if (Object.keys(outputs).length !== 1) fail('FORMAL_VERIFY', `expected exactly one emitted artifact, got ${Object.keys(outputs).length}`);
    const produced = Buffer.from(Object.values(outputs)[0], 'utf8');
    const producedSha = createHash('sha256').update(produced).digest('hex');
    const goldenSha = createHash('sha256').update(golden).digest('hex');
    const rerendered = createHash('sha256').update(Buffer.from(renderAll(input)[Object.keys(outputs)[0]], 'utf8')).digest('hex');
    process.stdout.write(JSON.stringify({ producedSha, goldenSha, byteParity: producedSha === goldenSha, deterministic: rerendered === producedSha }) + '\n');
    if (producedSha !== goldenSha || rerendered !== producedSha) process.exitCode = 1;
  } else {
    fs.mkdirSync(target, { recursive: true });
    const produced = [];
    for (const [relative, content] of Object.entries(outputs)) {
      const file = path.join(target, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
      produced.push({ path: relative, bytes: Buffer.byteLength(content), sha256: createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex') });
    }
    process.stdout.write(JSON.stringify({ produced }) + '\n');
  }
}
