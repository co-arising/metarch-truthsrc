// Unified emitter family #30: proto-converter (curated PO converters aligned
// with playAkkaCQRS / ingested-app: real business field names, native proto3
// optional/repeated/map, oneof event unions, shared req[A]/fixed/readExact
// helpers, and pb.*PO alias to avoid domain.values.MoneyPO collision).
// Zero hardcoded business identifiers; fail-closed (PC_INPUT).
const SCHEMA = 'truthsrc.proto-converter-input/v1';
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
  if (typeof source.document !== 'string' || !source.document) fail(what + '.document invalid');
  if (typeof source.pointer !== 'string' || !source.pointer.startsWith('/')) fail(what + '.pointer invalid');
}

export function checkInput(input) {
  checkObject(input, 'input');
  checkNoExtraKeys(input, new Set(['schemaVersion', 'packages', 'contexts']), 'input');
  if (input.schemaVersion !== SCHEMA) fail('schemaVersion must be ' + SCHEMA);
  if (!Array.isArray(input.packages) || !input.packages.length) fail('packages must be non-empty');
  const pkgMap = new Map();
  for (let i = 0; i < input.packages.length; i++) {
    const p = checkObject(input.packages[i], 'packages[' + i + ']');
    checkNoExtraKeys(p, new Set(['context', 'package']), 'packages[' + i + ']');
    if (typeof p.context !== 'string' || !CONTEXT_RE.test(p.context)) fail('invalid package context');
    if (typeof p.package !== 'string' || !PACKAGE_RE.test(p.package)) fail('invalid package');
    if (pkgMap.has(p.context)) fail('duplicate package context');
    pkgMap.set(p.context, p.package);
  }
  if (!Array.isArray(input.contexts) || !input.contexts.length) fail('contexts must be non-empty');
  const seenCtx = new Set();
  for (let i = 0; i < input.contexts.length; i++) {
    const c = checkObject(input.contexts[i], 'contexts[' + i + ']');
    checkNoExtraKeys(c, new Set(['context', 'deps', 'valueObjects', 'aggregates']), 'contexts[' + i + ']');
    if (typeof c.context !== 'string' || !pkgMap.has(c.context)) fail('unbound context');
    if (seenCtx.has(c.context)) fail('duplicate context');
    seenCtx.add(c.context);
    if (!Array.isArray(c.deps)) fail('deps must be array');
    if (!Array.isArray(c.valueObjects) || !c.valueObjects.length) fail('valueObjects must be non-empty');
    if (!Array.isArray(c.aggregates) || !c.aggregates.length) fail('aggregates must be non-empty');
    const seenPo = new Set();
    for (const vo of c.valueObjects) {
      checkObject(vo, 'valueObject');
      if (typeof vo.poName !== 'string' || !TYPE_NAME_RE.test(vo.poName)) fail('invalid vo poName');
      if (seenPo.has(vo.poName)) fail('duplicate poName: ' + vo.poName);
      seenPo.add(vo.poName);
      if (!Array.isArray(vo.sources) || !vo.sources.length) fail('vo sources must be non-empty');
      for (const s of vo.sources) checkSource(s, 'vo.source');
    }
    for (const agg of c.aggregates) {
      checkObject(agg, 'aggregate');
      if (typeof agg.aggId !== 'string' || !TYPE_NAME_RE.test(agg.aggId)) fail('invalid aggId');
      if (!Array.isArray(agg.events) || !agg.events.length) fail('aggregate events must be non-empty');
      if (!Array.isArray(agg.stateSources) || !agg.stateSources.length) fail('aggregate stateSources must be non-empty');
      for (const s of agg.stateSources) checkSource(s, 'agg.stateSource');
    }
  }
}

function encodeScalar(primitive, expr) {
  return primitive === 'decimal' ? `${expr}.bigDecimal.toPlainString` : expr;
}

function decodeScalar(primitive, expr) {
  return primitive === 'decimal' ? `BigDecimal(${expr})` : expr;
}

function encodeField(f, expr) {
  const ti = f.typeInfo;
  switch (ti.kind) {
    case 'primitive': return encodeScalar(ti.primitive, expr);
    case 'nominal': return `Some(encode${ti.poName}(${expr}))`;
    case 'optional-primitive': return ti.primitive === 'decimal' ? `${expr}.map(_.bigDecimal.toPlainString)` : expr;
    case 'optional-nominal': return `${expr}.map(encode${ti.poName})`;
    case 'repeated-primitive': return ti.primitive === 'decimal' ? `${expr}.map(_.bigDecimal.toPlainString)` : expr;
    case 'repeated-nominal': return `${expr}.map(encode${ti.poName})`;
    case 'map': {
      const kEnc = ti.keyInfo.kind === 'nominal-string' ? 'k.value' : 'k';
      const vEnc = ti.valueInfo.kind === 'nominal'
        ? `encode${ti.valueInfo.poName}(v)`
        : encodeScalar(ti.valueInfo.primitive, 'v');
      if (kEnc === 'k' && vEnc === 'v') return expr;
      return `${expr}.map { case (k, v) => ${kEnc} -> ${vEnc} }`;
    }
    default: fail('unsupported field kind: ' + ti.kind);
  }
}

function decodeField(f, expr) {
  const ti = f.typeInfo;
  switch (ti.kind) {
    case 'primitive': return decodeScalar(ti.primitive, expr);
    case 'nominal': return `decode${ti.poName}(req(${expr}))`;
    case 'optional-primitive': return ti.primitive === 'decimal' ? `${expr}.map(BigDecimal(_))` : expr;
    case 'optional-nominal': return `${expr}.map(decode${ti.poName})`;
    case 'repeated-primitive': return ti.primitive === 'decimal' ? `${expr}.map(BigDecimal(_)).toVector` : `${expr}.toVector`;
    case 'repeated-nominal': return `${expr}.map(decode${ti.poName}).toVector`;
    case 'map': {
      const kDec = ti.keyInfo.kind === 'nominal-string' ? `${ti.keyInfo.typeId}(k)` : 'k';
      const vDec = ti.valueInfo.kind === 'nominal'
        ? `decode${ti.valueInfo.poName}(v)`
        : decodeScalar(ti.valueInfo.primitive, 'v');
      if (kDec === 'k' && vDec === 'v') return expr;
      return `${expr}.map { case (k, v) => ${kDec} -> ${vDec} }`;
    }
    default: fail('unsupported field kind: ' + ti.kind);
  }
}

function formatCall(head, args, close = ')') {
  if (args.length <= 3) return `${head}${args.join(', ')}${close}`;
  return `${head}\n    ${args.join(',\n    ')}\n  ${close}`;
}

function renderFieldsCodec(poName, scalaType, fields) {
  const encArgs = fields.map(f => `${f.name} = ${encodeField(f, `value.${f.name}`)}`);
  const decArgs = fields.map(f => `${f.name} = ${decodeField(f, `value.${f.name}`)}`);
  return [
    `  def encode${poName}(value: ${scalaType}): pb.${poName} = ${formatCall(`pb.${poName}(`, encArgs)}`,
    `  def decode${poName}(value: pb.${poName}): ${scalaType} = ${formatCall(`${scalaType}(`, decArgs)}`,
  ].join('\n') + '\n';
}

function renderValueObjectMethods(vo) {
  if (vo.kind === 'exact') {
    const ex = vo.exact;
    const amount = `value.${ex.amountField}`;
    const unit = ex.unitField ? `value.${ex.unitField}` : null;
    const packed = ex.minor
      ? `${amount}.bigDecimal.setScale(${ex.scale}, java.math.RoundingMode.UNNECESSARY).unscaledValue.toString`
      : `fixed(${amount}, ${ex.scale})`;
    const lines = [];
    for (const rep of ex.representations) {
      const record = rep.amountField
        ? `${rep.typeName}(encoded.${ex.amountField}, encoded.${ex.unitField})`
        : `${rep.typeName}(encoded.${ex.amountField})`;
      const fromArgs = rep.amountField
        ? `${ex.amountField} = value.${rep.amountField}, ${ex.unitField} = value.${rep.unitField}`
        : `${ex.amountField} = value.value`;
      lines.push(`  def ${ex.domainName}To${rep.capital}(value: ${vo.typeId}): ${rep.typeName} = { val encoded = encode${vo.poName}(value); ${record} }`);
      lines.push(`  def ${ex.domainName}From${rep.capital}(value: ${rep.typeName}): ${vo.typeId} = decode${vo.poName}(pb.${vo.poName}(${fromArgs}))`);
    }
    const encArgs = `${ex.amountField} = ${packed}` + (unit ? `, ${ex.unitField} = ${unit}` : '');
    const decArgs = `readExact(value.${ex.amountField}, ${ex.scale}, ${ex.minor})` + (unit ? `, value.${ex.unitField}` : '');
    lines.push(`  def encode${vo.poName}(value: ${vo.typeId}): pb.${vo.poName} = pb.${vo.poName}(${encArgs})`);
    lines.push(`  def decode${vo.poName}(value: pb.${vo.poName}): ${vo.typeId} = ${vo.typeId}(${decArgs})`);
    return lines.join('\n') + '\n';
  }
  return renderFieldsCodec(vo.poName, vo.typeId, vo.fields);
}

function renderAggregateMethods(agg) {
  const lines = [];
  lines.push(renderFieldsCodec(agg.statePoName, `${agg.aggId}State`, agg.stateFields).trimEnd());
  for (const ev of agg.events) {
    lines.push(renderFieldsCodec(ev.poName, `${agg.aggId}Protocol.${ev.eventId}`, ev.fields).trimEnd());
  }
  // Event union oneof encode/decode
  lines.push(`  def encode${agg.eventUnionPoName}(value: ${agg.aggId}Protocol.Event): pb.${agg.eventUnionPoName} = value match {`);
  for (const ev of agg.events) {
    lines.push(`    case e: ${agg.aggId}Protocol.${ev.eventId} => pb.${agg.eventUnionPoName}(pb.${agg.eventUnionPoName}.Event.${ev.eventId}(encode${ev.poName}(e)))`);
  }
  lines.push('  }');
  lines.push(`  def decode${agg.eventUnionPoName}(value: pb.${agg.eventUnionPoName}): ${agg.aggId}Protocol.Event = value.event match {`);
  for (const ev of agg.events) {
    lines.push(`    case pb.${agg.eventUnionPoName}.Event.${ev.eventId}(e) => decode${ev.poName}(e)`);
  }
  lines.push(`    case pb.${agg.eventUnionPoName}.Event.Empty => throw new IllegalArgumentException("empty ${agg.eventUnionPoName} event")`);
  lines.push('  }');
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
  `import ${pkg}.infrastructure.{proto => pb}`,
  '',
].join('\n');

export function renderProtoConverterFiles(input) {
  checkInput(input);
  const pkgMap = new Map(input.packages.map(p => [p.context, p.package]));
  const out = [];

  for (const ctx of input.contexts) {
    const pkg = pkgMap.get(ctx.context);
    const pkgRoot = pkg.replaceAll('.', '/');
    const groups = [
      ...ctx.valueObjects.map(vo => ({ content: renderValueObjectMethods(vo), sources: vo.sources })),
      ...ctx.aggregates.map(agg => ({
        content: renderAggregateMethods(agg),
        sources: [...agg.stateSources, ...agg.events.map(e => e.source)],
      })),
    ];
    const allContent = groups.map(g => g.content).join('\n');
    const allSources = groups.flatMap(g => g.sources);
    const facadePath = 'app/' + pkgRoot + '/infrastructure/serialization/DomainConverters.scala';

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
        parts.push({ content: '', sources: [] });
      }
      parts.at(-1).content += g.content + '\n';
      parts.at(-1).sources.push(...g.sources);
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
        sources: part.sources,
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
    ['empty valueObjects', () => { const x = clone(); x.contexts[0].valueObjects = []; return x; }],
    ['duplicate vo poName', () => { const x = clone(); x.contexts[0].valueObjects.push(clone().contexts[0].valueObjects[0]); return x; }],
    ['invalid vo poName', () => { const x = clone(); x.contexts[0].valueObjects[0].poName = 'lower'; return x; }],
    ['empty vo sources', () => { const x = clone(); x.contexts[0].valueObjects[0].sources = []; return x; }],
    ['empty aggregates', () => { const x = clone(); x.contexts[0].aggregates = []; return x; }],
    ['invalid aggId', () => { const x = clone(); x.contexts[0].aggregates[0].aggId = 'lower'; return x; }],
    ['empty aggregate events', () => { const x = clone(); x.contexts[0].aggregates[0].events = []; return x; }],
    ['empty aggregate stateSources', () => { const x = clone(); x.contexts[0].aggregates[0].stateSources = []; return x; }],
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
