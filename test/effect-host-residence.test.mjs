import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { emitDoc } from '../lib/shared.mjs';
import { formalProductFile } from '../lib/formal-products-pure.mjs';
import { decomposeCanonical } from '../lib/decompose.mjs';
import { compileTree } from '../lib/compile.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
import { createSnapshot, compileSnapshot } from '../lib/compile-snapshot.mjs';
const payload=JSON.parse(readFileSync(new URL('./fixtures/inventory-effect-products/domain.json',import.meta.url))).effectHosts[0];
test('explicit authored effect-host is a full formal source root with exact roundtrip and no runtime promotion',()=>{
 const root=mkdtempSync(join(tmpdir(),'effect-residence-'));
 decomposeCanonical(JSON.stringify({schemaVersion:'truthsrc/v1',workshop:'effect-residence',sessions:['eventStorming','commandStorming','aggregateDiscovery','subdomainExploration','contextMapping','refining','storyMapping'].map(session=>({session,scopes:[]})),aggregates:[],valueObjects:[],readModels:[],stories:[],domainServices:[]}),root);
 const file=formalProductFile('effect-host',payload.id),path=join(root,file);mkdirSync(dirname(path),{recursive:true});
 writeFileSync(path,emitDoc({scalars:[['kind','formal-product'],['schemaVersion','truthsrc.formal-product/v1'],['family','effect-host'],['id',payload.id],['version',payload.version],['author','independent-effect-author']],blocks:{payload}}));
 const before=compileTree(root);assert.deepEqual(JSON.parse(before).effectHosts,[payload]);assert.deepEqual(validateTree(root).hard,[]);assert.equal(roundtrip(root).ok,true);assert.equal(compileTree(root),before);
});
test('effect-present pure snapshot carries only authored source and rejects wrong residence or version',()=>{
 const doc={kind:'formal-product',schemaVersion:'truthsrc.formal-product/v1',family:'effect-host',id:payload.id,version:payload.version,payload};
 const atoms=[{file:'workshop.yaml',doc:{schemaVersion:'truthsrc/v1',workshop:'effect-snapshot'}},{file:formalProductFile('effect-host',payload.id),doc}];
 const canonical=compileSnapshot(createSnapshot(atoms,{inboxDirs:[],aggregateDirs:[]})).canonical;
 assert.deepEqual(canonical.effectHosts,[payload]);assert.ok(!Object.hasOwn(canonical,'readiness'));
 assert.throws(()=>createSnapshot([{file:'elsewhere.yaml',doc}],{inboxDirs:[],aggregateDirs:[]}),/outside captured/);
 assert.throws(()=>createSnapshot([{file:formalProductFile('effect-host',payload.id),doc:{...doc,version:'wrong'}}],{inboxDirs:[],aggregateDirs:[]}),/identity\/version/);
});
