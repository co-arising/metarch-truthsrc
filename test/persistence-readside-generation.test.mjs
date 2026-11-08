import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { aggregateCoreFixture } from './aggregate-core-fixture.mjs';
import { generate } from '../generators/scala-cqrs-persistence-readside-v1/generate.mjs';
import { validateCodeMappings } from '../src/core/code-mappings.mjs';

const project = fileURLToPath(new URL('../scaffold/persistence-readside-project/truthsrc.project.json', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../generators/scala-cqrs-persistence-readside-v1/generator.json', import.meta.url)));

test('finite persistence plan emits all responsibilities in a deterministic dependency-closed plan', () => {
  const f = aggregateCoreFixture(project), result = generate({ compilation: f.compilation, manifest, options: f.config.options });
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.plan);
  const entries = result.plan.entries, paths = new Set(entries.map(e => e.path));
  for (const kind of ['persistence-runtime', 'event-adapter', 'snapshot-adapter', 'serializer', 'projection-schema', 'projection-repository', 'projection-handler', 'projection-runner', 'event-source', 'serialization-config'])
    assert.ok(entries.some(e => e.kind === kind && e.codeMappings.length), kind);
  for (const entry of entries) {
    assert.ok(entry.deps.every(d => paths.has(d)), entry.path);
    validateCodeMappings(entry);
    const bytes = Buffer.from(entry.content);
    for (const mapping of entry.codeMappings) assert.equal(bytes.subarray(mapping.span.start, mapping.span.end).toString(), mapping.span.text);
  }
  assert.deepEqual(generate({ compilation: f.compilation, manifest, options: f.config.options }).plan, result.plan);
  assert.equal(entries.filter(e => e.path.endsWith('.proto')).length, 2);
  const config = entries.find(e => e.kind === 'serialization-config').content;
  assert.match(config, /example\.inventory\.persistence\.protobuf\.Frame/);
  assert.doesNotMatch(config, /AnyRef|GeneratedMessage|journal\.plugin/);
  assert.match(entries.find(e => e.path.endsWith('.sql')).content, /^-- @generated/);
  assert.match(entries.find(e => e.path === 'build.sbt').content, /"h2" % "2\.2\.224"/);
});

test('public plan replays complete products and refuses fabricated success or unknown profile', () => {
  const f = aggregateCoreFixture(project), input = { compilation: f.compilation, manifest, options: f.config.options };
  assert.throws(() => generate({ ...input, manifest: { ...manifest, targetProfile: 'scala-cqrs-aggregate-core@1' } }));
  const fake = structuredClone(f.compilation);
  fake.result.products.find(p => p.id === 'persistence-readside-contract').payload.wire.serializerId++;
  assert.equal(generate({ ...input, compilation: fake }).plan, null);
});
