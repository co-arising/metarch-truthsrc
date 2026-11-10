import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileTreeWithSources } from '../lib/compile.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { PROFILES } from '../lib/products/registry.mjs';
import { API_DEPENDENCIES } from '../lib/products/api-contract.mjs';
import { APPLICATION_DEPENDENCIES } from '../lib/products/application-composition.mjs';

const root = fileURLToPath(new URL('../scaffold/play-application-project/', import.meta.url));
function fixture(change = () => {}) {
  const config = JSON.parse(fs.readFileSync(root + 'truthsrc.project.json'));
  const canonical = structuredClone(compileTreeWithSources(root + config.tree).canonical);
  const documents = config.documents.map(d => { const value = JSON.parse(fs.readFileSync(root + d.file)); return { id: d.id, schemaVersion: value.schemaVersion, value }; });
  change(canonical, documents.find(d => d.id === 'application').value);
  return deriveProjectRequest(canonical, config, documents);
}
function rejects(change, code) {
  const result = compileProductSet(fixture(change));
  assert.equal(result.result, null);
  assert(result.diagnostics.some(d => d.code === code), JSON.stringify(result.diagnostics));
}
test('application API derives ten products from one author and separate technical bindings', () => {
  const result = compileProductSet(fixture());
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.result.products.length, 10);
  const api = result.result.products.find(p => p.id === 'api-contract').payload;
  assert.equal(api.commands.length, 2);
  assert.equal(api.query.query, 'by_resource');
  assert.equal(api.commands[0].request.find(f => f.field === 'quantity').primitive, 'integer');
  assert.deepEqual(API_DEPENDENCIES, PROFILES['api-contract'].requires);
  assert.deepEqual(APPLICATION_DEPENDENCIES, PROFILES['application-composition'].requires);
});
test('API refuses missing and duplicate parameter mappings', () => {
  rejects(c => c.apiContracts[0].commands[0].request.pop(), 'API_SIGNATURE');
  rejects(c => c.apiContracts[0].commands[0].request.push(c.apiContracts[0].commands[0].request[0]), 'API_FIELD');
});
test('API refuses weakened method role and CSRF', () => {
  for (const [key, value] of [['method', 'GET'], ['roles', ['reader']], ['csrf', false]])
    rejects(c => { c.apiContracts[0].commands[0][key] = value; }, 'API_AUTHORITY');
});
test('API uses exact nominal DTO and stable query references', () => {
  rejects(c => { c.apiContracts[0].commands[0].request[3].codec = 'number'; }, 'API_CODEC');
  rejects(c => { c.apiContracts[0].query.query = 'invented-query'; }, 'API_QUERY');
  rejects(c => { c.apiContracts[0].page.query = 'invented'; }, 'API_PAGE');
});
test('API refuses route collisions and unimplemented event shapes', () => {
  rejects(c => { c.apiContracts[0].commands[1].path = c.apiContracts[0].commands[0].path; }, 'API_ROUTE');
  rejects(c => { c.apiContracts[0].commands[0].result.empty = 'success'; }, 'API_RESULT');
});
test('application composition requires one-to-one resource and frozen runtime selection', () => {
  rejects((c, b) => { b.resources[1].persistenceId = b.resources[0].persistenceId; }, 'APPLICATION_IDENTITY');
  rejects((c, b) => { b.runtime.journal = 'inmemory'; }, 'APPLICATION_RUNTIME');
  rejects((c, b) => { b.runtime.play = '2.8.20'; }, 'APPLICATION_RUNTIME');
});
test('application rejects missing implementations and inverted lifecycle ownership', () => {
  rejects((c, b) => b.implementations.pop(), 'APPLICATION_IMPLEMENTATION');
  rejects((c, b) => { b.root.ownership = 'caller'; }, 'APPLICATION_OWNERSHIP');
  rejects((c, b) => { b.limits.closeMillis = 999999; }, 'APPLICATION_LIMITS');
});
test('application cannot trust an enriched product instead of its author declaration', () => {
  const request = structuredClone(fixture());
  request.documents.find(d => d.schemaVersion === 'truthsrc.api-binding/v1').value.contract.page.title = 'Uncaptured';
  const result = compileProductSet(request);
  assert.equal(result.result, null);
  assert(result.diagnostics.some(d => d.code === 'API_SOURCE'));
});
