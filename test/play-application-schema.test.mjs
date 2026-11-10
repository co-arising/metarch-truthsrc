import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileTreeWithSources } from '../lib/compile.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';

const root = fileURLToPath(new URL('../scaffold/play-application-project/', import.meta.url));
const schemas = ['api-contract-v1', 'application-composition-binding-v1'].map(name =>
  JSON.parse(fs.readFileSync(new URL('../schema/' + name + '.schema.json', import.meta.url))));
const keywords = new Set(['$schema', '$id', 'title', 'description', '$defs', '$ref', 'type', 'additionalProperties',
  'required', 'properties', 'const', 'enum', 'pattern', 'minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems', 'items', 'oneOf']);
// This test oracle covers the declared structural keyword subset, not reference resolution or cross-field semantics.
function schemaErrors(value, schema, rootSchema = schema, location = '') {
  for (const key of Object.keys(schema)) assert(keywords.has(key), 'unimplemented schema keyword: ' + key);
  if (schema.$ref) {
    assert(schema.$ref.startsWith('#/$defs/'));
    const selected = rootSchema.$defs[schema.$ref.slice(8)];
    assert(selected, 'unresolved local schema reference');
    return schemaErrors(value, selected, rootSchema, location);
  }
  const errors = [], reject = () => errors.push(location || '/');
  if (schema.oneOf && schema.oneOf.filter(s => schemaErrors(value, s, rootSchema, location).length === 0).length !== 1) reject();
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) reject();
  if (schema.enum && !schema.enum.includes(value)) reject();
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
  if (schema.type && ![schema.type].flat().includes(type)) return [location || '/'];
  if (type === 'object') {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(location + '/' + key);
    for (const [key, item] of Object.entries(value)) {
      if (schema.properties?.[key]) errors.push(...schemaErrors(item, schema.properties[key], rootSchema, location + '/' + key));
      else if (schema.additionalProperties === false) errors.push(location + '/' + key);
    }
  }
  if (type === 'array') {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) reject();
    if (schema.items) value.forEach((v, i) => errors.push(...schemaErrors(v, schema.items, rootSchema, location + '/' + i)));
  }
  if (type === 'string') {
    const length = [...value].length;
    if (length < (schema.minLength ?? 0) || length > (schema.maxLength ?? Infinity) || schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) reject();
  }
  if (type === 'integer' && (value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) reject();
  return errors;
}
function fixture(change = () => {}) {
  const config = JSON.parse(fs.readFileSync(root + 'truthsrc.project.json'));
  const canonical = structuredClone(compileTreeWithSources(root + config.tree).canonical);
  const documents = config.documents.map(d => {
    const value = JSON.parse(fs.readFileSync(root + d.file));
    return { id: d.id, schemaVersion: value.schemaVersion, value };
  });
  const binding = documents.find(d => d.id === 'application').value;
  change(canonical.apiContracts[0], binding);
  let compilation;
  try { compilation = compileProductSet(deriveProjectRequest(canonical, config, documents)); }
  catch (error) { assert(error.diagnostic, 'unexpected fixture failure'); compilation = { result: null, diagnostics: [error.diagnostic] }; }
  return { api: canonical.apiContracts[0], binding, compilation };
}
test('author declarations and technical bindings satisfy both published structural schemas', () => {
  for (const change of [() => {}, (a, b) => { a.page.title = 'Receipt history'; b.limits.askMillis = 50; },
    (a, b) => { b.resources[0].resourceId = '界'.repeat(85); }]) {
    const f = fixture(change);
    assert.deepEqual(f.compilation.diagnostics, []);
    assert.deepEqual(schemaErrors(f.api, schemas[0]), []);
    assert.deepEqual(schemaErrors(f.binding, schemas[1]), []);
  }
});
test('structural unknown missing and wrong-version mutations fail schema and compiler', () => {
  for (const [which, change] of [
    [0, a => { a.extra = true; }], [0, a => { delete a.page.title; }], [0, a => { a.version = 1; }],
    [0, a => { a.commands[0].method = 'GET'; }], [0, a => { a.commands[0].request[0].location = 'header'; }],
    [1, (a, b) => { b.extra = true; }], [1, (a, b) => { delete b.config.credentials; }],
    [1, (a, b) => { b.runtime.play = '2.8.20'; }], [1, (a, b) => { b.limits.closeMillis = 20000; }],
    [1, (a, b) => { b.root.ownership = 'caller'; }],
  ]) {
    const f = fixture(change);
    assert.equal(f.compilation.result, null);
    assert(schemaErrors(which ? f.binding : f.api, schemas[which]).length > 0);
  }
});
test('schema validity is not semantic qualification for references and UTF-8 byte limits', () => {
  for (const change of [(a, b) => { b.resources[1].persistenceId = b.resources[0].persistenceId; },
    (a, b) => { b.resources[0].resourceId = '界'.repeat(86); },
    a => { a.commands[1].path = a.commands[0].path; }]) {
    const f = fixture(change);
    assert.deepEqual(schemaErrors(f.api, schemas[0]), []);
    assert.deepEqual(schemaErrors(f.binding, schemas[1]), []);
    assert.equal(f.compilation.result, null);
  }
});
test('authority capture association is technical and creates no authored business port', () => {
  const f = fixture(), products = f.compilation.result.products;
  const application = products.find(p => p.id === 'application-composition').payload;
  const authority = application.implementations.find(i => i.role === 'authority');
  const captured = application.handwritten.find(i => i.id === authority.id);
  assert.equal(authority.port, null);
  assert.deepEqual(captured.source, authority.source);
  assert.equal(captured.source.document, 'application');
  assert.equal(captured.implements.id, f.api.id + '-authority');
  assert(!JSON.stringify(products.find(p => p.id === 'reference-layout').payload).includes('"id":"' + captured.implements.id + '"'));
});
