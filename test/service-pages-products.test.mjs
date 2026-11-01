import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { ProductError } from '../lib/products/request.mjs';
import { validateServiceDeployment } from '../lib/products/service-deployment.mjs';
import { serviceApplicationFixture } from './service-application-fixture.mjs';
import { servicePagesFixture } from './service-pages-fixture.mjs';

const domain = request => request.documents.find(d => d.id === 'domain').value;
const artifact = (request, options) => domain(request).artifactContracts.find(a => a.id === options.service.artifact);
const synchronize = request => {
  request.documents.find(d => d.id === 'artifacts').value.artifacts.artifacts = domain(request).artifactContracts.map((a, i) => ({
    ...structuredClone(a), source: { document: 'domain', pointer: '/artifactContracts/' + i }
  }));
};
const validate = ({ request, options }) => {
  const row = artifact(request, options);
  return validateServiceDeployment(row.deployment.service, row,
    request.documents.find(d => d.id === 'references').value.layout,
    { document: 'domain', pointer: '/artifactContracts/' + domain(request).artifactContracts.indexOf(row) });
};

test('pages structural schema is optional and closes every nested declaration', () => {
  const schema = JSON.parse(readFileSync(new URL('../schema/play-service-v1.schema.json', import.meta.url), 'utf8'));
  assert.ok(!schema.$defs.service.required.includes('pages'));
  assert.deepEqual(schema.$defs.service.properties.pages, { $ref: '#/$defs/pages' });
  const pages = schema.$defs.pages;
  for (const row of [pages, pages.properties.renderer, pages.properties.aliases.items]) {
    assert.equal(row.additionalProperties, false);
    assert.deepEqual([...row.required].sort(), Object.keys(row.properties).sort());
  }
  assert.equal(pages.properties.schemaVersion.const, 'truthsrc.service-pages/v1');
  assert.equal(pages.properties.aliases.minItems, 1);
  assert.equal(pages.properties.aliases.maxItems, 256);
  const staticPath = new RegExp(schema.$defs.staticPagePath.pattern, 'u');
  const aliasPath = new RegExp(pages.properties.aliases.items.properties.path.pattern, 'u');
  assert.ok(staticPath.test('/inventory/v1/client-script'));
  assert.ok(aliasPath.test('/inventory/v1/allocations/:id'));
  for (const path of ['/inventory//v1', '/inventory/../v1', '/inventory/%69d', '/inventory/v1?x=1', '/inventory/v1#x', '/inventory/*id', '/inventory/v1/', ...[10, 13, 0x2028].map(c => '/inventory/v1' + String.fromCodePoint(c))]) {
    assert.ok(!staticPath.test(path), path);
    assert.ok(!aliasPath.test(path), path);
  }
  assert.ok(!staticPath.test('/inventory/:id'));
  const renderer = pages.properties.renderer.properties;
  assert.ok(new RegExp(renderer.id.pattern, 'u').test('example.inventory.InventoryPages'));
  assert.ok(!new RegExp(renderer.id.pattern, 'u').test('InventoryPages'));
  assert.ok(!new RegExp(renderer.version.pattern, 'u').test('   '));
});

test('full inventory pages fixture compiles canonical and artifact binding unchanged', () => {
  const fixture = servicePagesFixture(), before = structuredClone(fixture);
  const compiled = compileProductSet(fixture.request);
  assert.deepEqual(compiled.diagnostics, []);
  assert.ok(compiled.result);
  assert.deepEqual(fixture, before);
  assert.deepEqual(compiled, compileProductSet(fixture.request));
  const actual = compiled.result.products.find(p => p.id === 'artifact-contract').payload.artifacts.find(a => a.id === fixture.options.service.artifact);
  assert.deepEqual(actual.deployment.service.pages, artifact(fixture.request, fixture.options).deployment.service.pages);
  assert.equal(actual.deployment.service.endpoints[0].id, 'allocation-query');
  assert.equal(actual.deployment.service.endpoints[0].path, '/api/v1/allocations/:id');
  assert.equal(actual.deployment.service.endpoints[1].id, 'allocation-record');
  assert.equal(actual.deployment.service.endpoints[1].path, '/api/v1/allocations');
  assert.equal(compiled.result.readiness.runnable, false);
  assert.equal(validate(fixture), artifact(fixture.request, fixture.options).deployment.service);
});

// Every case reaches the independent service validator as well as the full
// compiler. No structural-schema acceptance is treated as semantic approval.
for (const [name, mutate] of [
  ['null pages', s => { s.pages = null; }],
  ['unknown page field', s => { s.pages.extraRouter = 'example.Router'; }],
  ['missing page field', s => { delete s.pages.scriptPath; }],
  ['wrong pages schema', s => { s.pages.schemaVersion = 'truthsrc.service-pages/v2'; }],
  ['missing renderer', s => { delete s.pages.renderer; }],
  ['null renderer', s => { s.pages.renderer = null; }],
  ['missing renderer version pin', s => { delete s.pages.renderer.version; }],
  ['blank renderer version', s => { s.pages.renderer.version = '   '; }],
  ['overlong renderer version', s => { s.pages.renderer.version = 'v'.repeat(129); }],
  ['non-text renderer version', s => { s.pages.renderer.version = 1; }],
  ['unqualified renderer', s => { s.pages.renderer.id = 'InventoryPages'; }],
  ['line terminator renderer', s => { s.pages.renderer.id += String.fromCodePoint(10); }],
  ['overlong renderer identity', s => { s.pages.renderer.id = 'example.' + 'P'.repeat(513); }],
  ['injected renderer text', s => { s.pages.renderer.id = 'example.Pages; arbitrary()'; }],
  ['unknown renderer field', s => { s.pages.renderer.loader = 'reflection'; }],
  ['empty aliases', s => { s.pages.aliases = []; }],
  ['null aliases', s => { s.pages.aliases = null; }],
  ['overfull aliases', s => { s.pages.aliases = Array.from({ length: 257 }, () => ({ ...s.pages.aliases[0] })); }],
  ['null alias', s => { s.pages.aliases[0] = null; }],
  ['missing alias endpoint', s => { delete s.pages.aliases[0].endpointId; }],
  ['unknown endpoint', s => { s.pages.aliases[0].endpointId = 'not-an-endpoint'; }],
  ['duplicate endpoint aliases', s => { s.pages.aliases.push({ endpointId: 'allocation-record', path: '/inventory/v1/other-record' }); }],
  ['method override', s => { s.pages.aliases[0].method = 'POST'; }],
  ['audience override', s => { s.pages.aliases[0].audience = 'public'; }],
  ['CSRF override', s => { s.pages.aliases[1].csrf = false; }],
  ['port override', s => { s.pages.aliases[0].port = s.bootstrap; }],
  ['DTO override', s => { s.pages.aliases[0].outputType = s.endpoints[0].outputType; }],
  ['wildcard shell', s => { s.pages.shellPath = '/inventory/*path'; }],
  ['parameter shell', s => { s.pages.shellPath = '/inventory/:id'; }],
  ['parameter script', s => { s.pages.scriptPath = '/inventory/:script'; }],
  ['traversal alias', s => { s.pages.aliases[0].path = '/inventory/../allocations/:id'; }],
  ['encoded alias', s => { s.pages.aliases[0].path = '/inventory/v1/allocations/%3Aid'; }],
  ['query alias', s => { s.pages.aliases[0].path = '/inventory/v1/allocations/:id?x=1'; }],
  ['fragment script', s => { s.pages.scriptPath += '#script'; }],
  ['relative shell', s => { s.pages.shellPath = 'inventory/v1'; }],
  ['line terminator shell', s => { s.pages.shellPath += String.fromCodePoint(10); }],
  ['line terminator alias', s => { s.pages.aliases[0].path += String.fromCodePoint(13); }],
  ['Unicode line terminator script', s => { s.pages.scriptPath += String.fromCodePoint(0x2028); }],
  ['empty segment alias', s => { s.pages.aliases[0].path = '/inventory//allocations/:id'; }],
  ['trailing slash shell', s => { s.pages.shellPath += '/'; }],
  ['overlong shell', s => { s.pages.shellPath = '/' + 'x'.repeat(1024); }],
  ['renamed alias parameter', s => { s.pages.aliases[0].path = '/inventory/v1/allocations/:other'; }],
  ['missing alias parameter', s => { s.pages.aliases[0].path = '/inventory/v1/allocations'; }],
  ['extra alias parameter', s => { s.pages.aliases[0].path += '/:other'; }],
  ['duplicate alias parameter', s => { s.pages.aliases[0].path += '/:id'; }],
  ['reordered alias parameters', s => {
    s.endpoints[0].path += '/:slot';
    s.pages.aliases[0].path = '/inventory/v1/allocations/:slot/:id';
  }],
  ['shell script duplicate', s => { s.pages.scriptPath = s.pages.shellPath; }],
  ['shell overlaps API wildcard', s => { s.pages.shellPath = '/api/v1/allocations/current'; }],
  ['script overlaps API wildcard', s => { s.pages.scriptPath = '/api/v1/allocations/current'; }],
  ['alias duplicates API', s => { s.pages.aliases[0].path = s.endpoints[0].path; }],
  ['alias overlaps shell', s => { s.pages.shellPath = '/inventory/v1/allocations/current'; }],
  ['alias overlaps script', s => { s.pages.scriptPath = '/inventory/v1/allocations/current'; }],
  ['GET alias overlaps GET alias', s => {
    s.endpoints[1].method = 'GET'; s.endpoints[1].operation = 'query'; s.endpoints[1].csrf = false;
    s.pages.aliases[1].path = '/inventory/v1/allocations/current';
  }]
]) test('pages reject ' + name + ' through independent and formal validation', () => {
  const fixture = servicePagesFixture();
  mutate(artifact(fixture.request, fixture.options).deployment.service);
  synchronize(fixture.request);
  const before = structuredClone(fixture);
  assert.throws(() => validate(fixture), error => error instanceof ProductError && error.diagnostic.code.startsWith('SERVICE_'));
  const rejected = compileProductSet(fixture.request);
  assert.equal(rejected.result, null);
  assert.ok(rejected.diagnostics.some(d => d.code.startsWith('SERVICE_')), JSON.stringify(rejected.diagnostics));
  assert.deepEqual(fixture, before);
});

test('method-aware overlap permits POST alias on a public GET path', () => {
  const fixture = servicePagesFixture();
  const service = artifact(fixture.request, fixture.options).deployment.service;
  service.pages.aliases[1].path = service.pages.shellPath;
  synchronize(fixture.request);
  assert.equal(validate(fixture), service);
  assert.deepEqual(compileProductSet(fixture.request).diagnostics, []);
});

test('all alias parameters are accepted only in the existing endpoint order', () => {
  const fixture = servicePagesFixture();
  const service = artifact(fixture.request, fixture.options).deployment.service;
  service.endpoints[0].path += '/:slot';
  service.pages.aliases[0].path += '/:slot';
  synchronize(fixture.request);
  assert.equal(validate(fixture), service);
  assert.deepEqual(compileProductSet(fixture.request).diagnostics, []);
});

for (const side of ['canonical', 'binding']) test('pages reject ' + side + '-only source change without fallback', () => {
  const { request, options } = servicePagesFixture();
  const row = side === 'canonical' ? artifact(request, options) : request.documents.find(d => d.id === 'artifacts').value.artifacts.artifacts.find(a => a.id === options.service.artifact);
  row.deployment.service.pages.renderer.version = '2';
  const rejected = compileProductSet(request);
  assert.equal(rejected.result, null);
  assert.ok(rejected.diagnostics.some(d => d.code === 'PRODUCT_PAYLOAD_MISMATCH'), JSON.stringify(rejected.diagnostics));
});

for (const side of ['canonical', 'binding']) test('pages absence must agree in ' + side + ' and binding source', () => {
  const { request, options } = servicePagesFixture();
  const row = side === 'canonical' ? artifact(request, options) : request.documents.find(d => d.id === 'artifacts').value.artifacts.artifacts.find(a => a.id === options.service.artifact);
  delete row.deployment.service.pages;
  const rejected = compileProductSet(request);
  assert.equal(rejected.result, null);
  assert.ok(rejected.diagnostics.some(d => d.code === 'PRODUCT_PAYLOAD_MISMATCH'), JSON.stringify(rejected.diagnostics));
});

test('absent pages preserve the original complete request and compilation shape', () => {
  const old = serviceApplicationFixture(), restored = servicePagesFixture();
  delete artifact(restored.request, restored.options).deployment.service.pages;
  synchronize(restored.request);
  assert.deepEqual(restored, old);
  const compiled = compileProductSet(restored.request);
  assert.deepEqual(compiled.diagnostics, []);
  assert.deepEqual(compiled, compileProductSet(old.request));
  const selected = compiled.result.products.find(p => p.id === 'artifact-contract').payload.artifacts.find(a => a.id === old.options.service.artifact);
  assert.ok(!Object.hasOwn(selected.deployment.service, 'pages'));
});
