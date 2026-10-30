import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { emitDoc, parseDoc } from '../lib/shared.mjs';
import { compileTree } from '../lib/compile.mjs';
import { decomposeCanonical } from '../lib/decompose.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { formalProductFile } from '../lib/formal-products-pure.mjs';
import { designRequest } from './product-design-fixtures.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { deriveProductDesigns } from '../lib/products/designs.mjs';
import { createSnapshot, compileSnapshot } from '../lib/compile-snapshot.mjs';

function write(root, file, doc) {
  const target = join(root, file); mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, emitDoc(doc));
}
function designTree(name) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'p24-design-residence-')));
  const r = designRequest(name), original = r.documents.find(d => d.id === 'domain').value;
  const base = { schemaVersion: 'truthsrc/v1', workshop: name + '-design-residence', sessions: ['eventStorming', 'commandStorming', 'aggregateDiscovery', 'subdomainExploration', 'contextMapping', 'refining', 'storyMapping'].map(session => ({ session, scopes: [] })),
    aggregates: original.aggregates.map(a => {
      // This residence fixture declares field signatures, not domain dataflow capability.
      const { eventResidence, ...fields } = a;
      return { ...fields, entity: a.name + 'Entity', events: a.events.map(e => ({ ...e, bindings: [], foldAssignments: [] })) };
    }), valueObjects: original.types.map(t => ({ ...t, fields: [] })), readModels: [], stories: [], domainServices: [] };
  decomposeCanonical(JSON.stringify(base), root);
  const d = structuredClone(original.productDesigns[0]);
  d.provenance = [{ document: 'domain', pointer: '/productDesigns/0' }];
  const decision = original.designDecisions[0];
  for (const [family, payload] of [['product-design', d], ...(decision ? [['product-design-decision', decision]] : [])]) {
    write(root, formalProductFile(family, payload.id), { scalars: [['kind', 'formal-product'], ['schemaVersion', 'truthsrc.formal-product/v1'], ['family', family], ['id', payload.id], ['version', payload.version], ['author', name + '-fixture-owner']], blocks: { payload } });
  }
  return { root, request: r, expected: d, decision };
}
test('explicit design and same-version authored decision roundtrip as complete independent formal roots', () => {
  for (const name of ['inventory', 'appointment']) {
    const { root, expected, decision } = designTree(name);
    const c = JSON.parse(compileTree(root));
    assert.deepEqual(c.productDesigns, [expected]);
    if (decision) assert.deepEqual(c.designDecisions, [decision]); else assert.ok(!Object.hasOwn(c, 'designDecisions'));
    assert.equal(c.productDesigns[0].status, name === 'inventory' ? 'proposal' : 'accepted');
    assert.deepEqual(validateTree(root).hard, []);
    const before = compileTree(root); assert.equal(roundtrip(root).ok, true); assert.equal(compileTree(root), before);
  }
});
test('tree-carried whole design feeds semantic compilation without lifting old notes or changing domain source contracts', () => {
  for (const name of ['inventory', 'appointment']) {
    const { root, request } = designTree(name);
    const tree = JSON.parse(compileTree(root));
    const canonical = request.documents.find(d => d.id === 'domain');
    const layout = request.documents.find(d => d.id === 'references').value.layout;
    layout.declarations.filter(d => d.ref.kind === 'type').forEach(d => {
      const index = tree.valueObjects.findIndex(t => t.context === d.ref.context && t.name === d.ref.id);
      assert.ok(index >= 0); d.source.pointer = '/valueObjects/' + index;
    });
    canonical.value = tree;
    request.documents.find(d => d.id === 'designs').value.designs = deriveProductDesigns(canonical, layout);
    const result = compileProductSet(request); assert.deepEqual(result.diagnostics, []);
    assert.equal(result.result.readiness.runnable, false);
  }
});
test('feature absent and historical design notes remain inert with no formal product roots', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'p24-design-absence-')));
  decomposeCanonical(JSON.stringify({ schemaVersion: 'truthsrc/v1', workshop: 'design-absence', sessions: ['refining'].map(session => ({ session, scopes: [] })), aggregates: [], valueObjects: [], readModels: [], stories: [], domainServices: [] }), root);
  write(root, 'inbox/refining/question-rf-old-design-0.yaml', { scalars: [['kind', 'note'], ['type', 'question'], ['name', 'OldDesign']], nested: { origin: { stage: 'refining', board: 'historical-design', seq: 0 } }, blocks: { payload: { type: 'question', name: 'OldDesign', info: { artifact: { id: 'old', status: 'accepted', page: 'not-lifted' } } } } });
  const c = JSON.parse(compileTree(root));
  assert.ok(!Object.hasOwn(c, 'productDesigns') && !Object.hasOwn(c, 'designDecisions'));
  assert.equal(existsSync(join(root, 'formal-products')), false);
  assert.equal(roundtrip(root).ok, true);
});
test('formal design headers cannot promote status or select a different identity/version', () => {
  const { root, expected } = designTree('inventory');
  const path = formalProductFile('product-design', expected.id);
  write(root, path, { scalars: [['kind', 'formal-product'], ['schemaVersion', 'truthsrc.formal-product/v1'], ['family', 'product-design'], ['id', expected.id], ['version', '2']], blocks: { payload: expected } });
  assert.throws(() => compileTree(root), /identity\/version/);
  assert.ok(validateTree(root).hard.some(e => e.startsWith('[FP1]')));
});
test('formal quoted numeric identity and version retain authored text while legacy numeric parsing stays unchanged', () => {
  const r = designRequest('inventory'), payload = structuredClone(r.documents[0].value.productDesigns[0]);
  payload.id = '123';
  const atom = emitDoc({ scalars: [['kind', 'formal-product'], ['schemaVersion', 'truthsrc.formal-product/v1'], ['family', 'product-design'], ['id', '123'], ['version', '1']], blocks: { payload } });
  const parsed = parseDoc(atom);
  assert.equal(parsed.id, '123'); assert.equal(parsed.version, '1');
  assert.equal(parseDoc('kind: note\nid: "123"\nversion: "1"\n').id, 123);
  assert.equal(parseDoc('kind: formal-product\nid: 123\nversion: 1\n').version, 1);
});

test('design-present pure snapshot initializes and projects with all effect APIs disabled', () => {
  const data = file => 'data:text/javascript;base64,' + Buffer.from(readFileSync(new URL('../lib/' + file, import.meta.url), 'utf8')).toString('base64');
  const shared = data('shared-pure.mjs'), helper = data('immutable-data.mjs');
  const formal = 'data:text/javascript;base64,' + Buffer.from(readFileSync(new URL('../lib/formal-products-pure.mjs', import.meta.url), 'utf8').replace("'./shared-pure.mjs'", JSON.stringify(shared))).toString('base64');
  const entry = 'data:text/javascript;base64,' + Buffer.from(readFileSync(new URL('../lib/compile-snapshot.mjs', import.meta.url), 'utf8')
    .replace("'./shared-pure.mjs'", JSON.stringify(shared)).replace("'./immutable-data.mjs'", JSON.stringify(helper)).replace("'./formal-products-pure.mjs'", JSON.stringify(formal))).toString('base64');
  const payload = designRequest('inventory').documents[0].value.productDesigns[0];
  const atoms = [{ file: 'workshop.yaml', doc: { schemaVersion: 'truthsrc/v1', workshop: 'isolated-design' } },
    { file: formalProductFile('product-design', payload.id), doc: { kind: 'formal-product', schemaVersion: 'truthsrc.formal-product/v1', family: 'product-design', id: payload.id, version: payload.version, payload } }];
  const script = `
    const fs=(await import('node:fs')).default, child=(await import('node:child_process')).default;
    const {syncBuiltinESMExports}=await import('node:module');
    const deny=()=>{throw new Error('forbidden effect');};
    for(const key of ['readFileSync','readdirSync','existsSync','writeFileSync','mkdirSync','rmSync','statSync','lstatSync'])fs[key]=deny;
    for(const key of ['execFileSync','execSync','spawn','spawnSync','exec','fork'])child[key]=deny;
    syncBuiltinESMExports();const finish=process.exit.bind(process);
    globalThis.process=new Proxy({},{get:deny});globalThis.Date=new Proxy(class {},{get:deny,construct:deny});globalThis.fetch=deny;Math.random=deny;
    const {createSnapshot,compileSnapshot}=await import(${JSON.stringify(entry)});
    const result=compileSnapshot(createSnapshot(${JSON.stringify(atoms)},{inboxDirs:[],aggregateDirs:[]}));
    if(result.canonical.productDesigns[0].status!=='proposal')throw new Error('wrong design source state');
    finish(0);
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
});

test('pure snapshot carries designs with no implicit I/O and rejects wrong residence', () => {
  const request = designRequest('inventory'), payload = request.documents[0].value.productDesigns[0];
  const doc = { kind: 'formal-product', schemaVersion: 'truthsrc.formal-product/v1', family: 'product-design', id: payload.id, version: payload.version, payload };
  const atoms = [{ file: 'workshop.yaml', doc: { schemaVersion: 'truthsrc/v1', workshop: 'pure-design' } }, { file: formalProductFile('product-design', payload.id), doc }];
  const snapshot = createSnapshot(atoms, { inboxDirs: [], aggregateDirs: [] });
  assert.deepEqual(JSON.parse(compileSnapshot(snapshot).text).productDesigns, [payload]);
  assert.throws(() => createSnapshot([{ file: 'wrong-design.yaml', doc }], { inboxDirs: [], aggregateDirs: [] }), /outside captured atom residence/);
});
