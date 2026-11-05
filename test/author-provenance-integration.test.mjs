import test from 'node:test';
import assert from 'node:assert/strict';
import { compileAuthorEntries, emitAuthorDoc, restoreAuthorEntries } from '../lib/author-surface.mjs';
import { buildSourceIndex } from '../lib/source-index.mjs';

function entries() {
  const system = { kind: 'system', schemaVersion: 'truthsrc.author/v1', id: 'sample', name: 'Sample', workshop: 'Sample', sessionOrder: ['refining'], contexts: ['main'],
    provenance: { schemaVersion: 'truthsrc.provenance/v1', sessions: [
      { id: 'one', stage: 'refining', sites: [{ provider: 'miro', boardId: 'board-one' }] },
      { id: 'two', stage: 'refining', sites: [{ provider: 'miro', uri: 'https://boards.example.invalid/two' }] },
    ] } };
  const context = { kind: 'context', schemaVersion: 'truthsrc.context/v1', id: 'main', name: 'Main', responsibility: 'Own the sample' };
  return [{ file: 'system.yaml', content: emitAuthorDoc(system) }, { file: 'contexts/main/context.yaml', content: emitAuthorDoc(context) }];
}
for (const [file, doc, family] of [
  ['sagas/sample.saga.yaml', { kind: 'saga', id: 'sample', name: 'Sample', version: 1, payload: { kept: true } }, 'sagas'],
  ['pipelines/sample.pipeline.yaml', { kind: 'pipeline', id: 'sample', name: 'Sample', steps: [] }, 'pipelines'],
  ['scenarios/sample.scenario.yaml', { kind: 'scenario', name: 'Sample', description: 'Explicit sample', script: [] }, 'scenarios'],
]) test('author-only sources do not leak into whole-atom ' + family, () => {
  const sourceRefs = [{ sessionId: 'one', itemId: 'item-one' }, { sessionId: 'two' }];
  const files = [...entries(), { file: 'contexts/main/' + file, content: emitAuthorDoc({ ...doc, sourceRefs }) }];
  const compiled = compileAuthorEntries(files);
  assert.equal(Object.hasOwn(compiled.canonical[family][0], 'sourceRefs'), false);
  assert.equal(Object.hasOwn(compiled.snapshot.atoms.find(atom => atom.file === file).doc, 'sourceRefs'), false);
  assert.deepEqual(restoreAuthorEntries(compiled.canonical), files);
  const index = buildSourceIndex(compiled.snapshot, compiled.canonical, { system: 'sample', context: 'main', physicalFiles: compiled.physicalFiles,
    authorAtoms: compiled.authorAtoms, authorSystem: compiled.system });
  const row = index.records.find(row => row.pointer === '/' + family + '/0');
  assert.equal(row.sourceLocations.length, 2);
  assert.equal(row.sourceLocations[0].navigation, 'unavailable');
  assert.equal(row.sourceLocations[1].specificity, 'board');
});
