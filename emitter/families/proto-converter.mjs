// Unified emitter family #30: proto-converter (Wave 1A curated converters).
// Emits headerless DomainConverters (and bounded DomainConvertersPartN traits
// when >55KB) with short imports, a single shared req[A]/fixed/readExact helper
// set (eliminating 378 .getOrElse(throw ...) copies and 5x helper duplication),
// and multi-line formatting for wide records. Fail-closed (PC_INPUT).
const SCHEMA = 'truthsrc.proto-converter-input/v1';
const NODE_KINDS = new Set(['nominal', 'exact', 'state', 'event', 'optional', 'sequence', 'map', 'map-entry']);
const CARRIER_FORMS = new Set(['node', 'string', 'boolean', 'integer', 'decimal']);
const CONTEXT_RE = /^[a-z][a-z0-9_-]*$/u;
const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/u;
const TYPE_NAME_RE = /^[A-Z][A-Za-z0-9_]*$/u;

const fail = message => { throw new Error('PC_INPUT: ' + message); };

function checkObject(value, what) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(what + ' must be an object');
  return value;
}

function checkNoExtraKeys(obj, allowed, what) {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) fail(what + ' has unexpected key: ' + key);
  }
}

function checkSource(source, what) {
  checkObject(source, what);
  checkNoExtraKeys(source, new Set(['document', 'pointer']), what);
  if (typeof source.document !== 'string' || !source.document) fail(what + '.document must be a non-empty string');
  if (typeof source.pointer !== 'string' || !source.pointer.startsWith('/')) fail(what + '.pointer must be a JSON pointer starting with /');
}

export function checkInput(input) {
  checkObject(input, 'input');
  checkNoExtraKeys(input, new Set(['schemaVersion', 'packages', 'contexts']), 'input');
  if (input.schemaVersion !== SCHEMA) fail('schemaVersion must be ' + SCHEMA);

  if (!Array.isArray(input.packages) || !input.packages.length) fail('packages must be a non-empty array');
  const packageByContext = new Map();
  for (let i = 0; i < input.packages.length; i++) {
    const p = checkObject(input.packages[i], 'packages[' + i + ']');
    checkNoExtraKeys(p, new Set(['context', 'package']), 'packages[' + i + ']');
    if (typeof p.context !== 'string' || !CONTEXT_RE.test(p.context)) fail('packages[' + i + '].context invalid');
    if (typeof p.package !== 'string' || !PACKAGE_RE.test(p.package)) fail('packages[' + i + '].package invalid');
    if (packageByContext.has(p.context)) fail('duplicate package context: ' + p.context);
    packageByContext.set(p.context, p.package);
  }

  if (!Array.isArray(input.contexts) || !input.contexts.length) fail('contexts must be a non-empty array');
  const seenCtx = new Set();
  for (let i = 0; i < input.contexts.length; i++) {
    const c = checkObject(input.contexts[i], 'contexts[' + i + ']');
    checkNoExtraKeys(c, new Set(['context', 'deps', 'nodes']), 'contexts[' + i + ']');
    if (typeof c.context !== 'string' || !packageByContext.has(c.context)) fail('contexts[' + i + '].context unbound');
    if (seenCtx.has(c.context)) fail('duplicate context: ' + c.context);
    seenCtx.add(c.context);
    if (!Array.isArray(c.deps) || c.deps.some(d => typeof d !== 'string' || !d)) fail('contexts[' + i + '].deps invalid');
    if (!Array.isArray(c.nodes) || !c.nodes.length) fail('contexts[' + i + '].nodes must be non-empty');
    const seenNodes = new Set();
    for (let j = 0; j < c.nodes.length; j++) {
      const n = checkObject(c.nodes[j], 'contexts[' + i + '].nodes[' + j + ']');
      checkNoExtraKeys(n, new Set(['name', 'kind', 'scalaType', 'fields', 'sources', 'exact']), 'contexts[' + i + '].nodes[' + j + ']');
      if (typeof n.name !== 'string' || !TYPE_NAME_RE.test(n.name)) fail('invalid node name: ' + JSON.stringify(n.name));
      if (seenNodes.has(n.name)) fail('duplicate node name: ' + n.name);
      seenNodes.add(n.name);
      if (typeof n.kind !== 'string' || !NODE_KINDS.has(n.kind)) fail('unsupported node kind: ' + JSON.stringify(n.kind));
      if (typeof n.scalaType !== 'string' || !n.scalaType) fail('invalid scalaType');
      if (!Array.isArray(n.sources) || !n.sources.length) fail('node sources must be non-empty');
      for (let s = 0; s < n.sources.length; s++) checkSource(n.sources[s], 'node.sources[' + s + ']');
      if (!Array.isArray(n.fields)) fail('node fields must be an array');
      for (let f = 0; f < n.fields.length; f++) {
        const fld = checkObject(n.fields[f], 'node.fields[' + f + ']');
        checkNoExtraKeys(fld, new Set(['name', 'carrierForm', 'carrierNode']), 'node.fields[' + f + ']');
        if (typeof fld.name !== 'string' || !fld.name) fail('invalid field name');
        if (typeof fld.carrierForm !== 'string' || !CARRIER_FORMS.has(fld.carrierForm)) fail('invalid carrierForm');
        if (fld.carrierForm === 'node' && (typeof fld.carrierNode !== 'string' || !TYPE_NAME_RE.test(fld.carrierNode)))
          fail('carrierNode required when carrierForm is node');
      }
      if (n.kind === 'exact') {
        const ex = checkObject(n.exact, 'node.exact');
        checkNoExtraKeys(ex, new Set(['domainName', 'scale', 'minor', 'amountField', 'unitField', 'representations']), 'node.exact');
        if (typeof ex.domainName !== 'string' || !TYPE_NAME_RE.test(ex.domainName)) fail('invalid exact.domainName');
        if (!Number.isInteger(ex.scale) || ex.scale < 0) fail('invalid exact.scale');
        if (typeof ex.minor !== 'boolean') fail('exact.minor must be boolean');
        if (typeof ex.amountField !== 'string' || !ex.amountField) fail('invalid exact.amountField');
        if (ex.unitField !== null && (typeof ex.unitField !== 'string' || !ex.unitField)) fail('invalid exact.unitField');
        if (!Array.isArray(ex.representations)) fail('exact.representations must be an array');
      } else if (n.exact !== undefined && n.exact !== null) {
        fail('exact metadata only allowed for exact nodes');
      }
    }
  }
}

const encodeExpr = (f, value) =>
  f.carrierForm === 'node'
    ? `encode${f.carrierNode}(${value})`
    : f.carrierForm === 'decimal'
      ? `${value}.bigDecimal.toPlainString`
      : value;

const decodeExpr = (f, value) =>
  f.carrierForm === 'node'
    ? `decode${f.carrierNode}(${value})`
    : f.carrierForm === 'decimal'
      ? `BigDecimal(${value})`
      : value;

const fieldEncodeExpr = (f, value) =>
  f.carrierForm === 'node' ? `Some(${encodeExpr(f, value)})` : encodeExpr(f, value);

const fieldDecodeExpr = (f, value) =>
  f.carrierForm === 'node' ? `decode${f.carrierNode}(req(${value}))` : decodeExpr(f, value);

function formatCall(head, args, close = ')') {
  if (args.length <= 3) return `${head}${args.join(', ')}${close}`;
  return `${head}\n    ${args.join(',\n    ')}\n  ${close}`;
}

function renderNodeMethods(n) {
  const t = n.scalaType;
  const target = n.name;
  const lines = [];
  let encoded;
  let decoded;

  if (n.kind === 'exact') {
    const ex = n.exact;
    const amount = `value.${ex.amountField}`;
    const unit = ex.unitField ? `value.${ex.unitField}` : null;
    const packed = ex.minor
      ? `${amount}.bigDecimal.setScale(${ex.scale}, java.math.RoundingMode.UNNECESSARY).unscaledValue.toString`
      : `fixed(${amount}, ${ex.scale})`;
    encoded = `${target}(${packed}${unit ? `, ${unit}` : ''})`;
    decoded = `${t}(readExact(value.f0, ${ex.scale}, ${ex.minor})${unit ? ', value.f1' : ''})`;
    for (const rep of ex.representations) {
      const record = rep.amountField ? `${rep.typeName}(encoded.f0, encoded.f1)` : `${rep.typeName}(encoded.f0)`;
      const fromArgs = rep.amountField ? `value.${rep.amountField}, value.${rep.unitField}` : 'value.value';
      lines.push(`  def ${ex.domainName}To${rep.capital}(value: ${t}): ${rep.typeName} = { val encoded = encode${target}(value); ${record} }`);
      lines.push(`  def ${ex.domainName}From${rep.capital}(value: ${rep.typeName}): ${t} = decode${target}(${target}(${fromArgs}))`);
    }
  } else if (n.kind === 'optional') {
    const f = n.fields[0];
    encoded = `value match { case None => ${target}(present = false); case Some(item) => ${target}(present = true, f0 = ${fieldEncodeExpr(f, 'item')}) }`;
    const empty = f.carrierForm === 'node' || f.carrierForm === 'string' || f.carrierForm === 'decimal'
      ? 'value.f0.isEmpty'
      : f.carrierForm === 'boolean'
        ? '!value.f0'
        : 'value.f0 == 0L';
    decoded = `if (!value.present) { require(${empty}, "absent optional contains a value"); None } else Some(${fieldDecodeExpr(f, 'value.f0')})`;
  } else if (n.kind === 'sequence') {
    const f = n.fields[0];
    encoded = `${target}(value.map(item => ${encodeExpr(f, 'item')}))`;
    decoded = `value.f0.map(item => ${decodeExpr(f, 'item')}).toVector`;
  } else if (n.kind === 'map') {
    const f = n.fields[0];
    encoded = `{ val rows = value.toVector.map(item => ${encodeExpr(f, 'item')}).sortBy(item => item.toByteArray.iterator.map(b => f"\${b & 0xff}%02x").mkString); ${target}(rows) }`;
    decoded = `{ val rows = value.f0.map(item => ${decodeExpr(f, 'item')}).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }`;
  } else {
    const encArgs = n.fields.map((f, i) =>
      fieldEncodeExpr(f, n.kind === 'map-entry' ? `value._${i + 1}` : `value.${f.name}`)
    );
    const decArgs = n.fields.map((f, i) => fieldDecodeExpr(f, `value.f${i}`));
    encoded = formatCall(`${target}(`, encArgs);
    decoded = n.kind === 'map-entry'
      ? formatCall('(', decArgs)
      : formatCall(`${t}(`, decArgs);
  }

  lines.push(`  def encode${target}(value: ${t}): ${target} = ${encoded}`);
  lines.push(`  def decode${target}(value: ${t.replace(/.*/, target)}): ${t} = ${decoded}`);
  return lines.join('\n') + '\n';
}

const HELPERS_BLOCK = [
  '  protected def req[A](value: Option[A]): A =',
  '    value.getOrElse(throw new IllegalArgumentException("required typed value missing"))',
  '',
  '  protected def fixed(value: BigDecimal, scale: Int): String =',
  '    value.bigDecimal.setScale(scale, java.math.RoundingMode.UNNECESSARY).toPlainString',
  '',
  '  protected def readExact(value: String, scale: Int, minor: Boolean): BigDecimal = {',
  '    require(value != null && value.length <= 80, "bounded exact text required")',
  '    val pattern = if (minor || scale == 0) "-?(0|[1-9][0-9]*)" else "-?(0|[1-9][0-9]*)\\\\.[0-9]{" + scale + "}"',
  '    require(value.matches(pattern) && !(value.startsWith("-") && BigDecimal(value) == 0), "noncanonical exact text")',
  '    if (minor) BigDecimal(new java.math.BigDecimal(new java.math.BigInteger(value), scale)) else BigDecimal(value)',
  '  }',
  '',
].join('\n');

const importsHeader = pkg => [
  `package ${pkg}.infrastructure.serialization`,
  '',
  `import ${pkg}.domain._`,
  `import ${pkg}.domain.values._`,
  `import ${pkg}.infrastructure.proto._`,
  '',
].join('\n');

export function renderProtoConverterFiles(input) {
  checkInput(input);
  const packageByContext = new Map(input.packages.map(p => [p.context, p.package]));
  const out = [];

  for (const ctx of input.contexts) {
    const pkg = packageByContext.get(ctx.context);
    const pkgRoot = pkg.replaceAll('.', '/');
    const groups = ctx.nodes.map(node => ({ node, content: renderNodeMethods(node) }));
    const allContent = groups.map(g => g.content).join('');
    const facadePath = 'app/' + pkgRoot + '/infrastructure/serialization/DomainConverters.scala';
    const allSources = ctx.nodes.flatMap(n => n.sources.map(s => ({ document: s.document, pointer: s.pointer })));

    if (allContent.length <= 55000) {
      out.push({
        path: facadePath,
        content: importsHeader(pkg) + 'object DomainConverters {\n' + HELPERS_BLOCK + allContent + '}\n',
        kind: 'converter',
        deps: [...ctx.deps],
        sources: allSources,
        codeMappings: [],
      });
      continue;
    }

    const parts = [];
    for (const g of groups) {
      if (!parts.length || parts.at(-1).content.length + g.content.length > 48000) {
        parts.push({ content: '', nodes: [] });
      }
      parts.at(-1).content += g.content;
      parts.at(-1).nodes.push(g.node);
    }
    const partNames = parts.map((_, i) => 'DomainConvertersPart' + i);
    const partPaths = partNames.map(name => 'app/' + pkgRoot + '/infrastructure/serialization/' + name + '.scala');

    out.push({
      path: facadePath,
      content: importsHeader(pkg) + `object DomainConverters extends ${partNames.join(' with ')} {\n` + HELPERS_BLOCK + '}\n',
      kind: 'converter',
      deps: [...new Set([...ctx.deps, ...partPaths])],
      sources: allSources,
      codeMappings: [],
    });

    parts.forEach((part, i) => {
      out.push({
        path: partPaths[i],
        content: importsHeader(pkg) + `trait ${partNames[i]} { self: DomainConverters.type =>\n` + part.content + '}\n',
        kind: 'converter',
        deps: [...ctx.deps],
        sources: part.nodes.flatMap(n => n.sources.map(s => ({ document: s.document, pointer: s.pointer }))),
        codeMappings: [],
      });
    });
  }
  return out;
}

export function renderAll(input) {
  return Object.fromEntries(renderProtoConverterFiles(input).map(f => [f.path, f.content]));
}

export function runNegatives(baseInput) {
  const clone = () => JSON.parse(JSON.stringify(baseInput));
  const cases = [
    ['non-object input', () => null],
    ['wrong schemaVersion', () => { const x = clone(); x.schemaVersion = 'wrong/v1'; return x; }],
    ['unexpected top-level key', () => { const x = clone(); x.extra = true; return x; }],
    ['empty packages', () => { const x = clone(); x.packages = []; return x; }],
    ['duplicate package context', () => { const x = clone(); x.packages.push({ ...x.packages[0] }); return x; }],
    ['empty contexts', () => { const x = clone(); x.contexts = []; return x; }],
    ['unbound context', () => { const x = clone(); x.contexts[0].context = 'unknown'; return x; }],
    ['duplicate context', () => { const x = clone(); x.contexts.push(clone().contexts[0]); return x; }],
    ['empty nodes', () => { const x = clone(); x.contexts[0].nodes = []; return x; }],
    ['invalid node name', () => { const x = clone(); x.contexts[0].nodes[0].name = 'lower'; return x; }],
    ['duplicate node name', () => { const x = clone(); x.contexts[0].nodes.push(clone().contexts[0].nodes[0]); return x; }],
    ['unsupported node kind', () => { const x = clone(); x.contexts[0].nodes[0].kind = 'unknown'; return x; }],
    ['empty scalaType', () => { const x = clone(); x.contexts[0].nodes[0].scalaType = ''; return x; }],
    ['empty node sources', () => { const x = clone(); x.contexts[0].nodes[0].sources = []; return x; }],
    ['invalid carrierForm', () => { const x = clone(); x.contexts[0].nodes[0].fields[0].carrierForm = 'float'; return x; }],
    ['exact metadata on non-exact node', () => {
      const x = clone();
      const nonExact = x.contexts[0].nodes.find(n => n.kind !== 'exact');
      nonExact.exact = { domainName: 'X', scale: 2, minor: true, amountField: 'value', unitField: null, representations: [] };
      return x;
    }],
  ];
  let rejected = 0;
  const failures = [];
  for (const [label, build] of cases) {
    try {
      checkInput(build());
      failures.push(label + ': unexpectedly accepted');
    } catch (err) {
      if (!String(err.message || '').startsWith('PC_INPUT:')) {
        failures.push(label + ': wrong error prefix (' + err.message + ')');
      } else {
        rejected++;
      }
    }
  }
  return { expected: cases.length, rejected, failures };
}

export const family = Object.freeze({
  id: 'proto-converter',
  familyNumber: 30,
  inputSchema: SCHEMA,
  provenance: 'handwritten-golden',
  toolsRef: null,
  goldenRoot: 'test/reference/curated/proto-converter/v1',
  fixtureDir: 'test/fixtures/proto-converter-v1',
  checkInput,
  renderAll,
  runNegatives,
});
