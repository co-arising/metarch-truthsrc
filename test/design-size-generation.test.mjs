import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {largeDesignRequest} from './design-size-fixture.mjs';
import {compileProductSet} from '../lib/products/compile.mjs';
import {generate} from '../generators/product-design-review/generate.mjs';
const manifest=JSON.parse(readFileSync(new URL('../generators/product-design-review/generator.json',import.meta.url)));
test('large complete review keeps all sources in lossless compact JSON within the unchanged entry limit',()=>{
 const compilation=compileProductSet(largeDesignRequest());assert.deepEqual(compilation.diagnostics,[]);
 const result=generate({compilation,manifest,options:{}});assert.deepEqual(result.diagnostics,[]);
 const model=JSON.parse(result.plan.entries.find(e=>e.kind==='design-model').content);
 assert.deepEqual(model.designs,compilation.result.products.find(p=>p.id==='product-design').payload.designs);
 const json=result.plan.entries.filter(e=>e.path.endsWith('.json'));
 assert.ok(json.some(e=>JSON.stringify(JSON.parse(e.content),null,2).length>65536));
 assert.ok(json.every(e=>e.content.length<=65536));
 assert.deepEqual(generate({compilation,manifest,options:{}}),result);
});
test('oversize compact design still fails rather than truncating rows or increasing the limit',()=>{
 const compilation=compileProductSet(largeDesignRequest(12));assert.deepEqual(compilation.diagnostics,[]);
 const result=generate({compilation,manifest,options:{}});assert.equal(result.plan,null);assert.ok(result.diagnostics.length);
});
