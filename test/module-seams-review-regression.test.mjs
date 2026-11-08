import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { authorFiles } from '../lib/author-tree.mjs';
import { compileAuthorEntries, emitAuthorDoc } from '../lib/author-surface.mjs';
import { parseDoc, slug } from '../lib/shared.mjs';
import { deriveModuleSeamsContract, CONTRACT_BINDING_SCHEMA } from '../lib/products/module-seams-contract.mjs';
import { compileModuleSeamsComposition } from '../lib/products/module-seams-composition.mjs';
import { lowerModuleSeamsTarget } from '../lib/products/module-seams-target.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { ProductError, validateRequest } from '../lib/products/request.mjs';

// Real scaffold author bytes are captured read-only. Every author counterexample
// is compiled from a detached, in-memory author tree, never a synthetic contract.
const project = fileURLToPath(new URL('../scaffold/module-seams-project/', import.meta.url));
const ref = id => ({ context: 'parcel', kind: 'type', owner: [], id });
const nominal = id => ({ form: 'nominal', ref: ref(id) });
const primitive = name => ({ form: 'primitive', name });
function fixture(edit = () => {}) {
  const config = JSON.parse(readFileSync(project + 'truthsrc.project.json', 'utf8'));
  const entries = authorFiles(project + config.tree).files.map(e => ({ ...e }));
  edit(entries);
  entries.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  const tree = compileAuthorEntries(entries, { rootName: 'module-seams' });
  const documents = config.documents.map(d => {
    const value = JSON.parse(readFileSync(project + d.file, 'utf8'));
    return { id: d.id, schemaVersion: value.schemaVersion, value };
  });
  return { config, tree, canonical: { id: config.canonicalId, schemaVersion: 'truthsrc/v1', value: tree.canonical }, documents, composition: documents[0] };
}
function rewrite(entries, predicate, edit) {
  const entry = entries.find(e => predicate(parseDoc(e.content, e.file)));
  assert.ok(entry, 'real author atom exists');
  const doc = parseDoc(entry.content, entry.file); edit(doc);
  entry.content = emitAuthorDoc(doc);
}
const valueEdit = (entries, name, edit) => rewrite(entries, d => d.kind === 'value-object' && d.name === name, d => edit(d.payload));
const contractEdit = (entries, edit) => rewrite(entries, d => d.family === 'module-seams-contract', d => edit(d.payload));
function addValue(entries, name) {
  entries.push({ file: 'contexts/parcel/value-objects/' + slug(name) + '.vo.yaml', content: emitAuthorDoc({ kind: 'value-object', name, payload: { name, fields: [{ name: 'value', dataType: 'String' }] } }) });
}
const rejects = (fn, code) => assert.throws(fn, e => e instanceof ProductError && (!code || e.diagnostic.code === code));
function lower(f, options = f.config.options) {
  return lowerModuleSeamsTarget(f.canonical, { id: 'review-contract', schemaVersion: CONTRACT_BINDING_SCHEMA, value: { schemaVersion: CONTRACT_BINDING_SCHEMA, contract: deriveModuleSeamsContract(f.canonical) } }, f.composition, options);
}
const loadType = f => deriveModuleSeamsContract(f.canonical).values.find(v => v.name === 'Load').fields[0].valueType;
function legacyFixture() {
  const f = fixture(), value = structuredClone(f.canonical.value);
  // Compatibility projection of the real author, with no new family or sum.
  delete value.authoring; delete value.moduleSeamsContracts;
  value.valueObjects = value.valueObjects.filter(v => !Object.hasOwn(v, 'variants'));
  const config = { ...f.config, products: [{ id: 'reference-layout', version: '1' }], roles: {}, documents: [] };
  return { value, config, request: deriveProjectRequest(value, config, []) };
}

test('control: real scaffold author compilation and full static product set execute', () => {
  const f = fixture(); assert.equal(f.tree.system.id, 'module-seams'); assert.equal(f.tree.context.id, 'parcel');
  assert.equal(deriveModuleSeamsContract(f.canonical).values.length, 8);
  const c = compileProductSet(deriveProjectRequest(f.tree.canonical, f.config, f.documents));
  assert.deepEqual(c.diagnostics, []); assert.equal(c.result.products.length, 2);
  assert.equal(lower(f).generatedFiles.length, 7);
});

for (const [spelling, expected] of [
  ['Int', nominal('Int')], ['Integer', nominal('Integer')],
  ['Option[Int]', { form: 'optional', element: nominal('Int') }],
  ['Map[Integer,Int]', { form: 'map', key: nominal('Integer'), value: nominal('Int') }],
  ['Either[Int,Integer]', { form: 'either', left: nominal('Int'), right: nominal('Integer') }],
  ['Map[String,Either[Option[Int],Vector[Integer]]]', { form: 'map', key: primitive('string'), value: { form: 'either', left: { form: 'optional', element: nominal('Int') }, right: { form: 'sequence', element: nominal('Integer') } } }],
]) test('R1 nominal spelling preserved: ' + spelling, () => {
  const f = fixture(entries => { addValue(entries, 'Int'); addValue(entries, 'Integer'); valueEdit(entries, 'Load', v => { v.fields[0].dataType = spelling; }); });
  assert.deepEqual(loadType(f), expected);
});
for (const spelling of ['Int', 'Integer', 'Decimal', 'Option[Integer]', 'List[Parcel]']) test('R1 undeclared alias still rejected: ' + spelling, () => {
  const f = fixture(entries => valueEdit(entries, 'Load', v => { v.fields[0].dataType = spelling; }));
  rejects(() => deriveModuleSeamsContract(f.canonical), 'MODULE_SEAMS_TYPE');
});
for (const [spelling, name] of [['String', 'string'], ['Boolean', 'boolean'], ['Long', 'integer']]) test('R1 explicit primitive wins unchanged: ' + spelling, () => {
  const f = fixture(entries => { addValue(entries, spelling); valueEdit(entries, 'Load', v => { v.fields[0].dataType = spelling; }); });
  assert.deepEqual(loadType(f), primitive(name));
});

for (const compatibility of [false, true]) test('R2 project context reconciles ' + (compatibility ? 'compatibility canonical' : 'regular author canonical'), () => {
  const f = fixture(), value = structuredClone(f.tree.canonical);
  if (compatibility) delete value.authoring;
  assert.doesNotThrow(() => deriveProjectRequest(value, f.config, f.documents));
  rejects(() => deriveProjectRequest(value, { ...f.config, context: 'foreign' }, f.documents), 'PROJECT_CONTEXT');
});

for (const family of ['valueObjects', 'types']) for (const metadata of [7, null, false, {}, ['opaque']]) test('R3 opaque legacy schemaVersion ' + family + ' ' + JSON.stringify(metadata), () => {
  const f = legacyFixture();
  if (family === 'types') f.value.types = [{ name: 'OpaqueLegacy', fields: [{ name: 'value', dataType: 'String' }], schemaVersion: metadata }];
  else f.value.valueObjects[0].schemaVersion = metadata;
  const request = deriveProjectRequest(f.value, f.config, []);
  assert.deepEqual(validateRequest(request), request);
  assert.deepEqual(compileProductSet(request).diagnostics, []);
});
for (const family of ['valueObjects', 'types']) for (const [label, bad] of [['null collection', null], ['object collection', {}], ['null member', [null]], ['array member', [[]]]]) {
  test('R3 derive diagnostic ' + family + ' ' + label, () => {
    const f = legacyFixture(); f.value[family] = bad;
    rejects(() => deriveProjectRequest(f.value, f.config, []), 'PRODUCT_SHAPE');
  });
  test('R3 request and full compile diagnostic ' + family + ' ' + label, () => {
    const f = legacyFixture(), request = structuredClone(f.request);
    request.documents.find(d => d.id === f.config.canonicalId).value[family] = bad;
    rejects(() => validateRequest(request), 'PRODUCT_SHAPE');
    const result = compileProductSet(request);
    assert.equal(result.result, null); assert.equal(result.diagnostics.length, 1); assert.equal(result.diagnostics[0].code, 'PRODUCT_SHAPE');
  });
}
for (const marker of ['truthsrc.signature-value/v1', 'truthsrc.signature-value/v2']) test('R3 string signature marker still rejected: ' + marker, () => {
  const f = legacyFixture(); f.value.valueObjects[0].schemaVersion = marker;
  rejects(() => deriveProjectRequest(f.value, f.config, []), 'MODULE_SEAMS_LEGACY_UNSUPPORTED');
  const request = structuredClone(f.request); request.documents.find(d => d.id === f.config.canonicalId).value.valueObjects[0].schemaVersion = marker;
  rejects(() => validateRequest(request), 'MODULE_SEAMS_LEGACY_UNSUPPORTED');
});
test('R3 malformed module-seams collection cannot bypass the legacy gate', () => {
  for (const bad of [null, {}, 7]) {
    const f = legacyFixture(); f.value.moduleSeamsContracts = bad;
    rejects(() => deriveProjectRequest(f.value, f.config, []), 'PRODUCT_SHAPE');
    const request = structuredClone(f.request); request.documents.find(d => d.id === f.config.canonicalId).value.moduleSeamsContracts = bad;
    rejects(() => validateRequest(request), 'PRODUCT_SHAPE');
  }
});

function roleFixture(kind) {
  const f = fixture(), b = f.composition.value;
  if (kind === 'adapter array') b.implementations[1].role = ['adapter'];
  else {
    b.bridges = []; b.implementations[0].implements = { context: 'parcel', kind: 'port', owner: [], id: 'CapacityPolicy' };
    b.root.bindings[0].target = { kind: 'implementation', id: 'capacity-rule' };
    b.implementations[0].role = ['pure-implementation'];
    if (kind === 'pure array with EC') { b.implementations[0].construction = 'class'; b.implementations[0].constructor = [structuredClone(b.implementations[2].constructor[1])]; }
  }
  return f;
}
for (const kind of ['adapter array', 'pure array', 'pure array with EC']) {
  test('R4 composition rejects ' + kind + ' before lowering', () => {
    const f = roleFixture(kind); rejects(() => compileModuleSeamsComposition(f.composition, f.canonical, deriveModuleSeamsContract(f.canonical)), 'MODULE_SEAMS_MODULE');
  });
  test('R4 full compile rejects ' + kind + ' without partial products', () => {
    const f = roleFixture(kind), c = compileProductSet(deriveProjectRequest(f.tree.canonical, f.config, f.documents));
    assert.equal(c.result, null); assert.equal(c.diagnostics.length, 1); assert.equal(c.diagnostics[0].code, 'MODULE_SEAMS_MODULE');
  });
}
test('R4 control: string pure role still enforces EC exclusion', () => {
  const f = roleFixture('pure array with EC'); f.composition.value.implementations[0].role = 'pure-implementation';
  rejects(() => compileModuleSeamsComposition(f.composition, f.canonical, deriveModuleSeamsContract(f.canonical)), 'MODULE_SEAMS_PURE');
});

const objectMembers = ['hashCode', 'toString', 'equals', 'clone', 'finalize'];
const caseMembers = ['copy', 'productArity', 'productElement', 'productElementName', 'productElementNames', 'productIterator', 'productPrefix', 'canEqual', ...objectMembers, 'companion'];
for (const variant of [false, true]) for (const name of caseMembers) test('R5 ' + (variant ? 'variant' : 'record') + ' field rejects final resolved ' + name + ' and admits safe binding', () => {
  const valueName = variant ? 'QuoteError' : 'Load';
  const f = fixture(entries => valueEdit(entries, valueName, v => { (variant ? v.variants[1].fields : v.fields)[0].name = name; }));
  rejects(() => lower(f), 'MODULE_SEAMS_ABI_NAME');
  const options = structuredClone(f.config.options);
  const selector = { value: ref(valueName), ...(variant ? { variant: 'InvalidCapacity' } : {}), field: name };
  options.names.push({ ref: selector, role: 'field', name: 'safeField' });
  const t = lower(f, options).target.values.find(v => v.ref.id === valueName);
  assert.equal((variant ? t.variants.find(v => v.id === 'InvalidCapacity').fields : t.fields)[0].name, 'safeField');
});
for (const name of objectMembers) test('R5 port ' + name + '():Long rejected; explicit safe method binding accepted', () => {
  const f = fixture(entries => contractEdit(entries, c => { const m = c.ports[0].methods[0]; m.name = name; m.parameters = []; m.result = { effect: 'pure', valueType: primitive('integer') }; }));
  rejects(() => lower(f), 'MODULE_SEAMS_ABI_NAME');
  const options = structuredClone(f.config.options), method = deriveModuleSeamsContract(f.canonical).ports[0].methods[0];
  options.names.push({ ref: method.ref, role: 'method', name: 'safeAssess' });
  assert.equal(lower(f, options).target.ports[0].methods[0].name, 'safeAssess');
});
for (const [role, name] of [['field', 'hashCode'], ['method', 'toString']]) test('R5 safe author cannot override a ' + role + ' to inherited ' + name, () => {
  const f = fixture(), c = deriveModuleSeamsContract(f.canonical), options = structuredClone(f.config.options);
  const selector = role === 'field' ? c.values.find(v => v.name === 'Load').fields[0].ref : c.ports[0].methods[0].ref;
  options.names.push({ ref: selector, role, name }); rejects(() => lower(f, options), 'MODULE_SEAMS_ABI_NAME');
});
for (const name of objectMembers) {
  test('R5 root factory rejects inherited ' + name, () => { const f = fixture(); f.composition.value.root.method = name; rejects(() => lower(f), 'MODULE_SEAMS_ABI_NAME'); });
  test('R5 bridge declaration rejects inherited delegate ' + name + '; safe explicit mapping remains valid', () => {
    const f = fixture(); f.composition.value.implementations[0].methods[0].delegateMember = name; f.composition.value.bridges[0].methods[0].delegateMember = name;
    rejects(() => lower(f), 'MODULE_SEAMS_ABI_NAME');
    f.composition.value.implementations[0].methods[0].delegateMember = 'safeAssess'; f.composition.value.bridges[0].methods[0].delegateMember = 'safeAssess';
    assert.equal(lower(f).composition.bridges[0].methods[0].delegateMember, 'safeAssess');
  });
}
for (const name of ['copy', ...objectMembers]) test('R5 ordinary method parameter and root local input may be named ' + name, () => {
  const f = fixture(entries => contractEdit(entries, c => { c.ports[0].methods[0].parameters[0].name = name; }));
  f.composition.value.root.parameterGroups[0].inputs[0].name = name;
  const t = lower(f); assert.equal(t.target.ports[0].methods[0].parameters[0].name, name); assert.equal(t.composition.root.parameterGroups[0].inputs[0].name, name);
});
test('R5 final-name admission follows centralized automatic normalization, not raw author spelling', () => {
  const f = fixture(entries => valueEdit(entries, 'Load', v => { v.fields[0].name = 'Hash Code'; }));
  rejects(() => lower(f), 'MODULE_SEAMS_ABI_NAME');
  const options = structuredClone(f.config.options); options.names.push({ ref: { value: ref('Load'), field: 'Hash Code' }, role: 'field', name: 'safeHash' });
  assert.equal(lower(f, options).target.values.find(v => v.ref.id === 'Load').fields[0].name, 'safeHash');
});
