import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileTreeWithSources } from '../lib/compile.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { buildModels, productIds } from '../generators/scala-cqrs-play-application-v1/build-models.mjs';
import { render } from '../generators/scala-cqrs-play-application-v1/render.mjs';

const root = fileURLToPath(new URL('../scaffold/play-application-project/', import.meta.url));
function model(change = () => {}) {
  const config = JSON.parse(fs.readFileSync(root + 'truthsrc.project.json'));
  const canonical = structuredClone(compileTreeWithSources(root + config.tree).canonical);
  const documents = config.documents.map(d => { const value = JSON.parse(fs.readFileSync(root + d.file)); return { id: d.id, schemaVersion: value.schemaVersion, value }; });
  change(canonical.apiContracts[0], config, documents.find(d => d.id === 'application').value);
  const compilation = compileProductSet(deriveProjectRequest(canonical, config, documents));
  if (!compilation.result) throw Object.assign(new Error(JSON.stringify(compilation.diagnostics)), { diagnostic: compilation.diagnostics[0] });
  return buildModels({ products: Object.fromEntries(compilation.result.products.map(p => [p.id, p.payload])), options: config.options });
}
function entries(m) {
  const versions = { 'domain-decision': '4', 'domain-dependencies': '6', 'domain-folds': '6', 'domain-external-events': '2' };
  return render(m, [{ id: 'external-0', module: 'ext', absolutePath: '/explicit/implementation-root' }], productIds.map(id => ({ id, version: versions[id] ?? '1' })));
}
test('API local route arguments are separate from authored wire parameter names', () => {
  const m = model(api => {
    api.query.resourceParameter = 'secured';
    api.query.path = api.query.path.replace(':warehouseId', ':secured');
    api.page.path = api.page.path.replace(':warehouseId', ':secured');
  });
  const plan = entries(m), controller = plan.find(e => e.path.endsWith('WarehouseController.scala')).content;
  assert.match(controller, /def query\(resourceValue: String\)/);
  assert.doesNotMatch(controller, /def query\(secured:/);
  assert.match(plan.find(e => e.path === 'conf/routes').content, /:resourceValue\/receipts .*query\(resourceValue: String\)/);
});
test('DTO inherited final names and framework type collisions fail closed', () => {
  for (const key of ['wait', 'notify', 'getClass', 'productArity']) assert.throws(() => model(api => { api.query.output.key = key; }), /reserved inherited/);
  assert.throws(() => model((api, config) => config.options.names.push({ ref: api.aggregate, role: 'controller', name: 'Action' })), /framework\/helper/);
});
test('path and output scalar length obligations are rendered rather than silently ignored', () => {
  const m = model(api => { api.commands[0].request.find(f => f.location === 'path').maxLength = 1; api.commands[0].result.fields[0].maxLength = 8; });
  const codec = entries(m).find(e => e.path.endsWith('WarehouseHttpCodec.scala')).content;
  assert.match(codec, /require\(scalar\(resource\.value, 1\)\)/);
  assert.match(codec, /require\(scalar\(event\.reservationId\.value, 8\)/);
});
test('resource compilation uses the same UTF-8 bound as HTTP', () => {
  assert.throws(() => model((api, config, binding) => { binding.resources[0].resourceId = '界'.repeat(86); }), /APPLICATION_IDENTITY/);
  assert.doesNotThrow(() => model((api, config, binding) => { binding.resources[0].resourceId = '界'.repeat(85); }));
});
test('application owns every acquired resource and preserves close failures', () => {
  const plan = entries(model()), application = plan.find(e => e.path.endsWith('WarehouseApplication.scala'));
  const lifecycle = plan.find(e => e.path.endsWith('WarehouseResourceLifecycle.scala'));
  assert(application.deps.includes(lifecycle.path));
  for (const name of ['executor', 'readside-pool', 'actors', 'repository', 'source', 'readside', 'requests'])
    assert(application.content.includes('resources.register("' + name + '")'));
  assert.match(application.content, /report\.failure\.isEmpty/);
  assert.match(application.content, /val result = resources\.close\(\)/);
  assert.doesNotMatch(application.content, /awaitTermination/);
  assert.match(lifecycle.content, /actions\.reverse/);
  assert.match(lifecycle.content, /10000\.millis\.fromNow/);
  assert.match(plan.find(e => e.path.endsWith('WarehouseComponents.scala')).content, /cleanup\(actorSystem\.terminate\(\)\)/);
});
test('application model and full output are deterministic with no runtime execution', () => {
  const m = model(); assert(Object.isFrozen(m));
  assert.deepEqual(entries(m), entries(model()));
  assert(entries(m).every(e => e.codeMappings.length > 0 && !e.content.includes('???')));
});
