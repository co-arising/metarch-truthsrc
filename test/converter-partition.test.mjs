import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileTree } from '../lib/compile.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { generate } from '../generators/scala-cqrs-domain-v2/generate.mjs';
const root = new URL('./fixtures/tickets-wide-converters-products/', import.meta.url);
const json = url => JSON.parse(readFileSync(url, 'utf8'));
test('wide nonbank records retain full converter methods within unchanged entry limits', () => {
  const tree = new URL('tree', root).pathname;
  assert.deepEqual(validateTree(tree).hard, []);
  assert.equal(roundtrip(tree).ok, true);
  assert.equal(compileTree(tree), readFileSync(new URL('domain.json', root), 'utf8'));
  const compilation = compileProductSet(readProductRequest(new URL('files.json', root).pathname));
  assert.deepEqual(compilation.diagnostics, []);
  const args = { compilation, manifest: json(new URL('../generators/scala-cqrs-domain-v2/generator.json', import.meta.url)), options: json(new URL('options.json', root)) };
  const first = generate(args);
  assert.deepEqual(first.diagnostics, []);
  assert.deepEqual(generate(args), first);
  const entries = first.plan.entries.filter(e => e.kind === 'converter');
  const facade = entries.find(e => e.path.endsWith('/DomainConverters.scala'));
  const parts = entries.filter(e => /DomainConvertersPart\d+\.scala$/.test(e.path));
  assert.ok(parts.length >= 2);
  assert.ok(entries.reduce((n, e) => n + e.content.length, 0) > 65536);
  assert.ok(entries.every(e => e.content.length <= 65536));
  for (const part of parts) {
    assert.ok(facade.deps.includes(part.path));
    assert.ok(part.content.includes('self: DomainConverters.type =>'));
    assert.ok(part.knowledgeIds.length);
  }
  const all = parts.map(e => e.content).join('\n');
  for (let i = 0; i < 40; i++) {
    assert.equal(all.split('def encodePassengerRecord' + i + 'PB(').length - 1, 1);
    assert.equal(all.split('def decodePassengerRecord' + i + 'PB(').length - 1, 1);
  }
  assert.ok(all.includes('value.`type`'));
  assert.ok(all.includes('readExact'));
});
