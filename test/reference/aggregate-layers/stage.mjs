import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileProductSet } from '../../../lib/products/compile.mjs';
import { generate } from '../../../generators/scala-cqrs-play-service/generate.mjs';
import { serviceApplicationFixture } from '../../service-application-fixture.mjs';

const referenceRoot = new URL('./warehouse/', import.meta.url);
const runtimeRoot = new URL('./runtime/', import.meta.url);
const referenceFiles = [
  'domain/WarehouseState.scala',
  'domain/entities/WarehouseEntity.scala',
  'application/aggregates/WarehouseProtocol.scala',
  'application/aggregates/WarehouseAggregate.scala',
  'application/aggregates/WarehouseAggregateFactory.scala',
  'application/aggregates/behaviors/WarehouseBehaviors.scala',
  'infrastructure/bootstrap/WarehouseBootstrap.scala'
].map(file => 'app/example/inventory/' + file);

export function referenceSources() {
  const { request, options } = serviceApplicationFixture();
  const compilation = compileProductSet(request);
  assert.deepEqual(compilation.diagnostics, []);
  const manifest = JSON.parse(readFileSync(new URL('../../../generators/scala-cqrs-play-service/generator.json', import.meta.url), 'utf8'));
  const result = generate({ compilation, manifest, options });
  assert.deepEqual(result.diagnostics, []);
  const entries = result.plan.entries.filter(entry => entry.path.endsWith('.scala') &&
    (entry.path.startsWith('app/example/inventory/domain/') ||
     entry.path.startsWith('app/example/inventory/application/aggregates/') ||
     /\/infrastructure\/bootstrap\/(Warehouse|AllocationOrder)Bootstrap\.scala$/.test(entry.path)));
  const generated = entries.map(({ path, content }) => ({ path, content, origin: 'generated' }));
  const references = generated.map(entry => referenceFiles.includes(entry.path)
    ? { ...entry, content: readFileSync(new URL(entry.path, referenceRoot), 'utf8'), origin: 'independent-reference' }
    : entry);
  const tests = readdirSync(runtimeRoot).filter(file => file.endsWith('.scala')).sort().map(file => ({
    path: (file === 'IdentityAdapters.scala' ? 'app/example/inventory/infrastructure/serialization/' : 'src/test/scala/') + file,
    content: readFileSync(new URL(file, runtimeRoot), 'utf8'), origin: 'independent-test'
  }));
  assert.equal(referenceFiles.length, references.filter(entry => entry.origin === 'independent-reference').length);
  return { generated: [...generated, ...tests], reference: [...references, ...tests] };
}

export function stageReference(root) {
  assert.equal(resolve(root), root, 'absolute output required');
  const sources = referenceSources();
  mkdirSync(root);
  for (const [variant, entries] of Object.entries(sources)) {
    for (const entry of entries) {
      const file = join(root, variant, entry.path);
      mkdirSync(resolve(file, '..'), { recursive: true });
      writeFileSync(file, entry.content, { flag: 'wx' });
    }
    writeFileSync(join(root, variant, 'build.sbt'), readFileSync(new URL('./build.sbt', import.meta.url)), { flag: 'wx' });
    mkdirSync(join(root, variant, 'project'));
    writeFileSync(join(root, variant, 'project/build.properties'), 'sbt.version=1.11.7\n', { flag: 'wx' });
  }
  writeFileSync(join(root, 'sources.json'), JSON.stringify(Object.fromEntries(Object.entries(sources)
    .map(([variant, entries]) => [variant, entries.map(({ path, origin }) => ({ path, origin }))])), null, 2) + '\n', { flag: 'wx' });
  return { root, variants: Object.fromEntries(Object.entries(sources).map(([key, entries]) => [key, entries.length])) };
}

if (!process.env.NODE_TEST_CONTEXT && process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 3, 'usage: node test/reference/aggregate-layers/stage.mjs /absolute/new-directory');
  console.log(JSON.stringify(stageReference(process.argv[2])));
}
