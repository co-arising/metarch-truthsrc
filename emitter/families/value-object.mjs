// value-object emitter (family #1): renders the per-context value-object
// package — primitive wrappers, record case classes and exact-value types —
// from the derived truthsrc.value-object-input/v1 contract.
//
// Golden provenance: handwritten-golden (rulings 2026-11-23,
// docs/emitter-unification-host-family-rulings.md §4/§10/§13, Q1 手写
// curated). The curated golden tree is the style specification, not a
// reproduction receipt: against classic production the curated style makes
// exactly two deviations — no generated-file header (L1, face-family house
// style) and same-package short names for nominal references (N1); names,
// field order, the primitive wrapper's `value` field (N2), the one-line
// case-class layout (L2) and the exact-value semantics (T2) are preserved.
// Cross-context nominal references render as the full
// `<package>.domain.values.<Name>` path (N1, contract-supported generality).
//
// The module embeds zero business bytes: every name, field, unit set, scale
// and precision is contract data. Files carry no codeMappings — the classic
// renderer never produced any, so the ledger entries themselves are the
// provenance.
import { parseStrictJson } from '../../lib/strict-json.mjs';
import { isAllowedValueObjectSubpackage, valueObjectSubpackage } from '../../lib/derivation/value-object-package.mjs';
import { scalaSubpackagePath } from '../../lib/layout/layout-strategy.mjs';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };
const SCHEMA = 'truthsrc.value-object-input/v1';
const KEYWORDS = new Set(['abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends', 'false', 'final', 'finally', 'for', 'forSome', 'if', 'implicit', 'import', 'lazy', 'match', 'new', 'null', 'object', 'override', 'private', 'protected', 'return', 'sealed', 'super', 'this', 'throw', 'trait', 'try', 'true', 'type', 'val', 'var', 'while', 'with', 'yield', '_']);
const PRIMITIVES = new Map([['string', 'String'], ['integer', 'Long'], ['boolean', 'Boolean'], ['decimal', 'BigDecimal']]);
const EXACT_SCALING = 'java.math.RoundingMode.UNNECESSARY';

const text = (value, what) => {
  if (typeof value !== 'string' || value.length === 0) fail('VO_INPUT', what + ' must be nonempty text');
  return value;
};
const identifier = (value, what) => {
  text(value, what);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(value) || KEYWORDS.has(value)) fail('VO_INPUT', what + ' must be a safe Scala identifier');
  return value;
};
const boundedInteger = (value, what) => {
  if (!Number.isInteger(value) || value <= 0) fail('VO_INPUT', what + ' must be a positive integer');
  return value;
};
const knowledgeOf = source => 'source:' + source.document + '#' + source.pointer;

function checkTypeTree(type, what, packages) {
  if (!type || typeof type !== 'object' || Array.isArray(type)) fail('VO_INPUT', what + ' must be a type tree');
  if (type.form === 'primitive') {
    if (!PRIMITIVES.has(type.name)) fail('VO_INPUT', what + ' has unsupported primitive name: ' + JSON.stringify(type.name));
    return;
  }
  if (type.form === 'nominal') {
    text(type.context, what + ' nominal context');
    identifier(type.name, what + ' nominal name');
    if (!packages.some(p => p.context === type.context)) fail('VO_INPUT', what + ' nominal context ' + type.context + ' has no package binding');
    return;
  }
  if (type.form === 'optional' || type.form === 'sequence') {
    checkTypeTree(type.element, what + ' element', packages);
    return;
  }
  if (type.form === 'map') {
    checkTypeTree(type.key, what + ' map key', packages);
    checkTypeTree(type.value, what + ' map value', packages);
    return;
  }
  fail('VO_INPUT', what + ' has unsupported form: ' + JSON.stringify(type.form));
}

function checkShape(shape, what, packages) {
  if (!shape || typeof shape !== 'object' || Array.isArray(shape)) fail('VO_INPUT', what + ' must be a shape object');
  if (shape.kind === 'primitive') {
    if (shape.member !== 'value') fail('VO_INPUT', what + ' primitive wrapper member must be the frozen layout constant value');
    checkTypeTree(shape.type, what + ' wrapper type', packages);
    return;
  }
  if (shape.kind === 'exact') {
    identifier(shape.amountMember, what + ' amount member');
    boundedInteger(shape.scale, what + ' scale');
    boundedInteger(shape.precision, what + ' precision');
    const hasUnit = shape.unitMember !== undefined;
    const hasUnits = Array.isArray(shape.units) && shape.units.length > 0;
    if (hasUnit !== hasUnits) fail('VO_INPUT', what + ' unit member and unit set must be declared together');
    if (hasUnit) {
      identifier(shape.unitMember, what + ' unit member');
      for (const [i, unit] of shape.units.entries()) text(unit, what + ' units[' + i + ']');
    }
    return;
  }
  if (shape.kind === 'record') {
    if (!Array.isArray(shape.members) || shape.members.length === 0) fail('VO_INPUT', what + ' record must declare at least one member');
    const names = new Set();
    for (const [i, member] of shape.members.entries()) {
      const mat = what + ' members[' + i + ']';
      if (!member || typeof member !== 'object') fail('VO_INPUT', mat + ' must be an object');
      const name = identifier(member.name, mat + ' name');
      if (names.has(name)) fail('VO_INPUT', what + ' declares member ' + name + ' twice');
      names.add(name);
      checkTypeTree(member.type, mat + ' type', packages);
    }
    return;
  }
  fail('VO_INPUT', what + ' has unsupported kind: ' + JSON.stringify(shape.kind));
}

function checkInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('VO_INPUT', 'input must be an object');
  if (input.schemaVersion !== SCHEMA) fail('VO_INPUT', 'unsupported schemaVersion: ' + JSON.stringify(input.schemaVersion));
  if (!Array.isArray(input.packages) || input.packages.length === 0) fail('VO_INPUT', 'packages must be a nonempty array');
  const boundContexts = new Set();
  for (const [i, binding] of input.packages.entries()) {
    const bt = what => 'packages[' + i + '] ' + what;
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) fail('VO_INPUT', bt('must be an object'));
    const context = text(binding.context, bt('context'));
    if (boundContexts.has(context)) fail('VO_INPUT', bt('context ' + context + ' is bound twice'));
    boundContexts.add(context);
    const pkg = text(binding.package, bt('package'));
    if (!pkg.split('.').every(p => /^[a-z][a-z0-9_]*$/u.test(p) && !KEYWORDS.has(p)))
      fail('VO_INPUT', bt('package must be a dotted lowercase-root Scala package'));
  }
  if (!Array.isArray(input.values) || input.values.length === 0) fail('VO_INPUT', 'values must be a nonempty array');
  const names = new Set();
  for (const [i, value] of input.values.entries()) {
    const vt = what => 'values[' + i + '] ' + what;
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('VO_INPUT', vt('must be an object'));
    const context = text(value.context, vt('context'));
    if (!boundContexts.has(context)) fail('VO_INPUT', vt('context ' + context + ' has no package binding'));
    const name = identifier(value.name, vt('name'));
    const key = context + '/' + name;
    if (names.has(key)) fail('VO_INPUT', vt('value ' + name + ' is declared twice in context ' + context));
    names.add(key);
    if (value.subpackage !== undefined && !isAllowedValueObjectSubpackage(value.subpackage)) {
      fail('VO_INPUT', vt('subpackage must be a sanctioned three-layer subpackage: ' + JSON.stringify(value.subpackage)));
    }
    const source = value.source;
    if (!source || typeof source !== 'object' || typeof source.document !== 'string' || !source.document ||
      typeof source.pointer !== 'string' || !source.pointer.startsWith('/'))
      fail('VO_INPUT', vt('source must carry a {document, pointer} knowledge source'));
    checkShape(value.shape, vt('shape'), input.packages);
  }
}

const targetSubpkg = (context, name, subpackageByKey) =>
  subpackageByKey.get(context + '/' + name) ?? valueObjectSubpackage(name);

const collectCrossSubpackageImports = (type, ownContext, ownSubpkg, subpackageByKey, out) => {
  if (type.form === 'nominal') {
    if (type.context === ownContext) {
      const target = targetSubpkg(type.context, type.name, subpackageByKey);
      if (target !== ownSubpkg) {
        if (!out.has(target)) out.set(target, new Set());
        out.get(target).add(type.name);
      }
    }
    return;
  }
  if (type.form === 'optional' || type.form === 'sequence') {
    collectCrossSubpackageImports(type.element, ownContext, ownSubpkg, subpackageByKey, out);
    return;
  }
  if (type.form === 'map') {
    collectCrossSubpackageImports(type.key, ownContext, ownSubpkg, subpackageByKey, out);
    collectCrossSubpackageImports(type.value, ownContext, ownSubpkg, subpackageByKey, out);
  }
};

const scalaType = (type, ownContext, packages, subpackageByKey) => {
  if (type.form === 'primitive') return PRIMITIVES.get(type.name);
  if (type.form === 'nominal') {
    if (type.context === ownContext) return type.name;
    const binding = packages.find(p => p.context === type.context);
    return binding.package + '.' + targetSubpkg(type.context, type.name, subpackageByKey) + '.' + type.name;
  }
  if (type.form === 'optional') return 'Option[' + scalaType(type.element, ownContext, packages, subpackageByKey) + ']';
  if (type.form === 'sequence') return 'Vector[' + scalaType(type.element, ownContext, packages, subpackageByKey) + ']';
  return 'Map[' + scalaType(type.key, ownContext, packages, subpackageByKey) + ', ' + scalaType(type.value, ownContext, packages, subpackageByKey) + ']';
};

/**
 * Render one value object file in the curated style: `package <pkg>.<subpkg>`,
 * optional grouped cross-subpackage imports, a blank line, and the shape body
 * (exact record-plus-companion, one-line/multi-line record, or primitive
 * wrapper). No header; same-context nominal references stay short (N1/L1).
 */
function renderValue(value, packages, subpackageByKey) {
  const pkg = packages.find(p => p.context === value.context).package;
  const subpkg = value.subpackage ?? 'domain.values';
  const name = value.name;
  const shape = value.shape;
  const crossImports = new Map();
  let body;
  if (shape.kind === 'exact') {
    const amount = shape.amountMember;
    const unit = shape.unitMember;
    const fields = amount + ': BigDecimal' + (unit ? ', ' + unit + ': String' : '');
    const unitCheck = unit ? '\n  require(' + JSON.stringify(shape.units).replace('[', 'Set(').replace(']', ')') + '.contains(' + unit + '), "unsupported exact unit")' : '';
    const same = unit ? 'require(' + unit + ' == other.' + unit + ', "exact units differ"); ' : '';
    const create = expr => name + '(' + name + '.checkedAmount(' + expr + ')' + (unit ? ', ' + unit : '') + ')';
    const normalized = name + '.checkedAmount(' + amount + ')';
    const otherAmount = name + '.checkedAmount(other.' + amount + ')';
    body = 'final case class ' + name + '(' + fields + ') {\n  ' + name + '.checkedAmount(' + amount + ')' + unitCheck + '\n' +
      '  def isPositive: Boolean = ' + amount + ' > 0\n' +
      '  def compareSameUnit(other: ' + name + '): Int = { ' + same + amount + '.compare(other.' + amount + ') }\n' +
      '  def plus(other: ' + name + '): ' + name + ' = { ' + same + create(normalized + ' + ' + otherAmount) + ' }\n' +
      '  def minus(other: ' + name + '): ' + name + ' = { ' + same + create(normalized + ' - ' + otherAmount) + ' }\n' +
      '}\nobject ' + name + ' {\n  def checkedAmount(value: BigDecimal): BigDecimal = {\n' +
      '    require(value != null, "exact amount is required")\n' +
      '    val scaled = value.bigDecimal.setScale(' + shape.scale + ', ' + EXACT_SCALING + ')\n' +
      '    require(scaled.precision <= ' + shape.precision + ', "exact precision exceeded")\n' +
      '    new scala.math.BigDecimal(scaled, java.math.MathContext.UNLIMITED)\n  }\n}\n';
  } else if (shape.kind === 'record') {
    for (const member of shape.members) {
      collectCrossSubpackageImports(member.type, value.context, subpkg, subpackageByKey, crossImports);
    }
    const fields = shape.members.map(member => member.name + ': ' + scalaType(member.type, value.context, packages, subpackageByKey));
    const oneLine = 'final case class ' + name + '(' + fields.join(', ') + ')';
    body = fields.length > 4 || oneLine.length > 100
      ? 'final case class ' + name + '(\n  ' + fields.join(',\n  ') + '\n)\n'
      : oneLine + '\n';
  } else {
    collectCrossSubpackageImports(shape.type, value.context, subpkg, subpackageByKey, crossImports);
    body = 'final case class ' + name + '(value: ' + scalaType(shape.type, value.context, packages, subpackageByKey) + ')\n';
  }
  const importLines = [...crossImports.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sub, set]) => {
      const sorted = [...set].sort();
      return sorted.length === 1
        ? `import ${pkg}.${sub}.${sorted[0]}`
        : `import ${pkg}.${sub}.{${sorted.join(', ')}}`;
    });
  const importBlock = importLines.length ? importLines.join('\n') + '\n\n' : '';
  const path = scalaSubpackagePath(pkg, subpkg, name + '.scala');
  return {
    path,
    content: 'package ' + pkg + '.' + subpkg + '\n\n' + importBlock + body,
    kind: 'value-object',
    sources: [value.source],
    deps: [],
    codeMappings: [],
  };
}

/** Full provenance surface of the contract: one file per value, in order. */
export function renderValueObjectFiles(inputJson) {
  const input = parseStrictJson(Buffer.from(JSON.stringify(inputJson), 'utf8'));
  checkInput(input);
  const subpackageByKey = new Map(input.values.map(v => [v.context + '/' + v.name, v.subpackage ?? 'domain.values']));
  return input.values.map(value => renderValue(value, input.packages, subpackageByKey));
}

const renderAll = input => Object.fromEntries(renderValueObjectFiles(input).map(f => [f.path, f.content]));

// ---------- embedded negatives battery (fail-closed input validation) ----------
export function runNegatives(input) {
  const cases = [];
  const mutate = (name, fn) => {
    const broken = JSON.parse(JSON.stringify(input));
    fn(broken);
    cases.push({ name, broken });
  };
  mutate('wrong schemaVersion', x => { x.schemaVersion = 'truthsrc.value-object-input/v2'; });
  mutate('empty packages', x => { x.packages = []; });
  mutate('package bound twice', x => { x.packages.push({ context: 'bankwealth', package: 'example.bankwealth' }); });
  mutate('uppercase package segment', x => { x.packages[0].package = 'example.BankWealth'; });
  mutate('keyword package segment', x => { x.packages[0].package = 'example.match'; });
  mutate('empty values', x => { x.values = []; });
  mutate('value context without package binding', x => { x.values[0].context = 'other'; });
  mutate('duplicate value declaration', x => { x.values.push(JSON.parse(JSON.stringify(x.values[0]))); });
  mutate('unsafe value identifier', x => { x.values[0].name = 'Bank Cash'; });
  mutate('source without pointer', x => { x.values[0].source = { document: 'bank-v1' }; });
  mutate('source with non-slash pointer', x => { x.values[0].source.pointer = 'valueObjects/0'; });
  mutate('unknown shape kind', x => { x.values[0].shape.kind = 'union'; });
  mutate('nominal reference without package binding', x => {
    x.packages.push({ context: 'elsewhere', package: 'example.elsewhere' });
    const value = x.values.find(v => v.shape.kind === 'record');
    value.shape.members[0].type = { form: 'nominal', context: 'unbound', name: 'Widget' };
  });
  mutate('primitive wrapper member renamed', x => {
    const value = x.values.find(v => v.shape.kind === 'primitive');
    value.shape.member = 'id';
  });
  mutate('unsupported primitive name', x => {
    const value = x.values.find(v => v.shape.kind === 'primitive');
    value.shape.type.name = 'float';
  });
  mutate('exact without scale', x => {
    const value = x.values.find(v => v.shape.kind === 'exact');
    delete value.shape.scale;
  });
  mutate('exact units without unit member', x => {
    const value = x.values.find(v => v.shape.kind === 'exact' && v.shape.unitMember);
    delete value.shape.unitMember;
  });
  mutate('empty record members', x => {
    const value = x.values.find(v => v.shape.kind === 'record');
    value.shape.members = [];
  });
  mutate('duplicate record member name', x => {
    const value = x.values.find(v => v.shape.kind === 'record' && v.shape.members.length >= 2);
    value.shape.members[1].name = value.shape.members[0].name;
  });
  mutate('unsupported member form', x => {
    const value = x.values.find(v => v.shape.kind === 'record');
    value.shape.members[0].type.form = 'union';
  });
  mutate('unsanctioned value subpackage', x => {
    x.values[0].subpackage = 'service.dtos';
  });
  let rejected = 0;
  const failures = [];
  for (const { name, broken } of cases) {
    try {
      renderValueObjectFiles(broken);
      failures.push(name);
    } catch (error) {
      if (error.code !== 'VO_INPUT') failures.push(name + ' (wrong code: ' + error.code + ')');
      else rejected += 1;
    }
  }
  return { expected: cases.length, rejected, failures };
}

// ---------- unified-emitter family registration (emitter-unification Phase 3) ----------
export const family = {
  id: 'value-object',
  familyNumber: 1,
  inputSchema: SCHEMA,
  goldenRoot: 'test/reference/curated/value-object/v1',
  fixtureDir: 'test/fixtures/value-object-v1',
  toolsRef: null,
  provenance: 'handwritten-golden',
  checkInput,
  renderAll,
  runNegatives,
};
