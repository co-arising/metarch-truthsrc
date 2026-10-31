import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { generate } from '../generators/scala-cqrs-application/generate.mjs';

test('installed phase callbacks carry identity-bound absence without treating ordinary failures as absence', () => {
  const root = new URL('./fixtures/inventory-invocation-products/', import.meta.url);
  const compilation = compileProductSet(readProductRequest(new URL('files.json', root).pathname));
  assert.deepEqual(compilation.diagnostics, []);
  const options = JSON.parse(readFileSync(new URL('options.json', root)));
  const manifest = JSON.parse(readFileSync(new URL('../generators/scala-cqrs-application/generator.json', import.meta.url)));
  const result = generate({ compilation, options, manifest });
  assert.deepEqual(result.diagnostics, []);
  const definition = result.plan.entries.find(e => e.kind === 'saga-definition').content;
  const ports = result.plan.entries.find(e => e.path.endsWith('TechnicalPorts.scala')).content;
  assert.match(ports, /final case class OperationNotExecuted\(identity: OperationIdentity, evidence: String, safeToRetry: Boolean\)/);
  assert.equal((definition.match(/case ex: inventory_allocation_hostTechnicalPorts.OperationNotExecuted if ex.identity == request.identity && ex.evidence != null && ex.evidence.nonEmpty/g) ?? []).length, 18);
  assert.equal((definition.match(/NotExecuted\(request.identity, ex.evidence, ex.safeToRetry\)/g) ?? []).length, 18);
  assert.match(definition, /case ex => Unknown\(request.identity, "technical execute failed:/);
  assert.match(definition, /case None => Unknown\(request.identity, "typed query returned no authoritative evidence"\)/);
});
