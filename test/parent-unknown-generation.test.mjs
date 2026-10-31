import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readProductRequest} from '../lib/products/cli.mjs';
import {compileProductSet} from '../lib/products/compile.mjs';
import {generate} from '../generators/scala-cqrs-application/generate.mjs';
test('pipeline nonterminal result delivery keeps the same parent pending until a business terminal',()=>{
 const root=new URL('./fixtures/inventory-invocation-products/',import.meta.url);
 const compilation=compileProductSet(readProductRequest(new URL('files.json',root).pathname));
 const options=JSON.parse(readFileSync(new URL('options.json',root))),manifest=JSON.parse(readFileSync(new URL('../generators/scala-cqrs-application/generator.json',import.meta.url)));
 const result=generate({compilation,options,manifest});assert.deepEqual(result.diagnostics,[]);
 const host=result.plan.entries.find(e=>e.kind==='invocation-host').content;
 assert.match(host,/case "outcome-unknown" => Pending\("outcome-unknown"\)/);
 assert.match(host,/case "recovery-required" => Pending\("recovery-required"\)/);
 assert.match(host,/case "succeeded" => Completed\(/);
});
