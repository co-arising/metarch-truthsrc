// Unified emitter family #30: proto-converter (curated PO converters aligned
// with playAkkaCQRS / ingested-app: real business field names, native proto3
// optional/repeated/map, oneof event unions, shared req[A]/fixed/readExact
// helpers, and pb.*PO alias to avoid domain.values.MoneyPO collision).
// Zero hardcoded business identifiers; fail-closed (PC_INPUT).
import { renderValueWildcardImports } from '../../lib/derivation/value-object-package.mjs';
import { scalaSubpackagePath } from '../../lib/layout/layout-strategy.mjs';

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
      if (rep.capital === 'PO') {
        lines.push(`  def ${ex.domainName}ToPO(value: ${vo.typeId}): pb.${vo.poName} = encode${vo.poName}(value)`);
        lines.push(`  def ${ex.domainName}FromPO(value: pb.${vo.poName}): ${vo.typeId} = decode${vo.poName}(value)`);
      } else {
        const record = rep.amountField
          ? `${rep.typeName}(encoded.${ex.amountField}, encoded.${ex.unitField})`
          : `${rep.typeName}(encoded.${ex.amountField})`;
        const fromArgs = rep.amountField
          ? `${ex.amountField} = value.${rep.amountField}, ${ex.unitField} = value.${rep.unitField}`
          : `${ex.amountField} = value.value`;
        lines.push(`  def ${ex.domainName}To${rep.capital}(value: ${vo.typeId}): ${rep.typeName} = { val encoded = encode${vo.poName}(value); ${record} }`);
        lines.push(`  def ${ex.domainName}From${rep.capital}(value: ${rep.typeName}): ${vo.typeId} = decode${vo.poName}(pb.${vo.poName}(${fromArgs}))`);
      }
    }
    const encArgs = `${ex.amountField} = ${packed}` + (unit ? `, ${ex.unitField} = ${unit}` : '');
    const decArgs = `readExact(value.${ex.amountField}, ${ex.scale}, ${ex.minor})` + (unit ? `, value.${ex.unitField}` : '');
    lines.push(`  def encode${vo.poName}(value: ${vo.typeId}): pb.${vo.poName} = pb.${vo.poName}(${encArgs})`);
    lines.push(`  def decode${vo.poName}(value: pb.${vo.poName}): ${vo.typeId} = ${vo.typeId}.create(${decArgs}).fold(err => throw new IllegalArgumentException(err.message), identity)`);
    return lines.join('\n') + '\n';
  }
  return renderFieldsCodec(vo.poName, vo.typeId, vo.fields);
}

function renderAggregateMethods(agg) {
  const lines = [];
  lines.push(renderFieldsCodec(agg.statePoName, `${agg.aggId}Entity.State`, agg.stateFields).trimEnd());
  for (const ev of agg.events) {
    lines.push(renderFieldsCodec(ev.poName, `${agg.aggId}Entity.${ev.eventId}`, ev.fields).trimEnd());
  }
  // Event union oneof encode/decode
  lines.push(`  def encode${agg.eventUnionPoName}(value: ${agg.aggId}Entity.Event): pb.${agg.eventUnionPoName} = value match {`);
  for (const ev of agg.events) {
    lines.push(`    case e: ${agg.aggId}Entity.${ev.eventId} => pb.${agg.eventUnionPoName}(pb.${agg.eventUnionPoName}.Event.${ev.eventId}(encode${ev.poName}(e)))`);
  }
  lines.push('  }');
  lines.push(`  def decode${agg.eventUnionPoName}(value: pb.${agg.eventUnionPoName}): ${agg.aggId}Entity.Event = value.event match {`);
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

const importsHeader = (pkg, valueObjects) => {
  const voNames = (valueObjects ?? []).map(vo => vo.typeId);
  const voImports = [...new Set([
    `import ${pkg}.domain.values._`,
    ...renderValueWildcardImports(pkg, voNames),
  ])].sort();
  return [
    `package ${pkg}.infrastructure.persistence.converters`,
    '',
    `import ${pkg}.domain.entities._`,
    ...voImports,
    `import ${pkg}.infrastructure.{proto => pb}`,
    'import net.imadz.common.serialization.PrimitiveConverter',
    '',
  ].join('\n');
};

export function renderProtoConverterFiles(input) {
  checkInput(input);
  const pkgMap = new Map(input.packages.map(p => [p.context, p.package]));
  const out = [];

  for (const ctx of input.contexts) {
    const pkg = pkgMap.get(ctx.context);
    const header = importsHeader(pkg, ctx.valueObjects);

    // 1. Shared value-object converters split into cohesive traits if needed, extending PrimitiveConverter.
    const voBlocks = ctx.valueObjects.map(vo => ({ content: renderValueObjectMethods(vo), sources: vo.sources }));
    const voChunks = [];
    for (const block of voBlocks) {
      if (!voChunks.length || voChunks.at(-1).content.length + block.content.length > 48000) {
        voChunks.push({ content: '', sources: [] });
      }
      voChunks.at(-1).content += block.content + '\n';
      voChunks.at(-1).sources.push(...block.sources);
    }
    const voTraitNames = [];
    const voTraitPaths = [];
    if (voChunks.length === 1) {
      const voPath = scalaSubpackagePath(pkg, 'infrastructure.persistence.converters', 'SharedValueProtoConverters.scala');
      voTraitNames.push('SharedValueProtoConverters');
      voTraitPaths.push(voPath);
      out.push({
        path: voPath,
        content: header + 'trait SharedValueProtoConverters extends PrimitiveConverter {\n' + HELPERS_BLOCK + voChunks[0].content + '}\n',
        kind: 'converter',
        deps: [...ctx.deps],
        sources: voChunks[0].sources,
        codeMappings: [],
      });
    } else {
      const subNames = voChunks.map((_, i) => `SharedValueGroup${i}ProtoConverters`);
      const subPaths = subNames.map(n => scalaSubpackagePath(pkg, 'infrastructure.persistence.converters', `${n}.scala`));
      const sharedPath = scalaSubpackagePath(pkg, 'infrastructure.persistence.converters', 'SharedValueProtoConverters.scala');
      voTraitNames.push('SharedValueProtoConverters');
      voTraitPaths.push(sharedPath);
      voChunks.forEach((chunk, i) => {
        out.push({
          path: subPaths[i],
          content: header + `trait ${subNames[i]} extends PrimitiveConverter {\n  self: SharedValueProtoConverters =>\n\n` + chunk.content + '}\n',
          kind: 'converter',
          deps: [...ctx.deps],
          sources: chunk.sources,
          codeMappings: [],
        });
      });
      out.push({
        path: sharedPath,
        content: header + `trait SharedValueProtoConverters extends PrimitiveConverter with ${subNames.join(' with ')} {\n` + HELPERS_BLOCK + '}\n',
        kind: 'converter',
        deps: [...new Set([...ctx.deps, ...subPaths])],
        sources: voChunks.flatMap(c => c.sources),
        codeMappings: [],
      });
    }

    // 2. Per-aggregate ProtoConverters trait extending SharedValueProtoConverters (transitively PrimitiveConverter).
    const aggTraitNames = [];
    const aggTraitPaths = [];
    for (const agg of ctx.aggregates) {
      const traitName = `${agg.aggId}ProtoConverters`;
      const traitPath = scalaSubpackagePath(pkg, 'infrastructure.persistence.converters', `${traitName}.scala`);
      aggTraitNames.push(traitName);
      aggTraitPaths.push(traitPath);
      out.push({
        path: traitPath,
        content: header + `trait ${traitName} extends PrimitiveConverter with SharedValueProtoConverters {\n` +
          renderAggregateMethods(agg) + '}\n',
        kind: 'converter',
        deps: [...new Set([...ctx.deps, ...voTraitPaths])],
        sources: [...agg.stateSources, ...agg.events.map(e => e.source)],
        codeMappings: [],
      });
    }

    // 3. Facade object DomainConverters mixing in all per-aggregate converter traits.
    const facadePath = scalaSubpackagePath(pkg, 'infrastructure.persistence.converters', 'DomainConverters.scala');
    const allTraits = [...voTraitNames, ...aggTraitNames];
    const allSources = [
      ...ctx.valueObjects.flatMap(vo => vo.sources),
      ...ctx.aggregates.flatMap(agg => [...agg.stateSources, ...agg.events.map(e => e.source)]),
    ];
    out.push({
      path: facadePath,
      content: header + `object DomainConverters extends ${allTraits.join(' with ')}\n`,
      kind: 'converter',
      deps: [...new Set([...ctx.deps, ...voTraitPaths, ...aggTraitPaths])],
      sources: allSources,
      codeMappings: [],
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
