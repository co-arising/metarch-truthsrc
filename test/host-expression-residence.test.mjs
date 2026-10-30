import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decomposeCanonical } from '../lib/decompose.mjs';
import { compileTree } from '../lib/compile.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';
const host=()=>({form:'host',id:{context:'inventory',kind:'port',owner:[],id:'ReservationIdentity'},version:'identity-v1'});
function tree(expr,fold=false){const root=mkdtempSync(join(tmpdir(),'host-expression-'));decomposeCanonical(JSON.stringify({schemaVersion:'truthsrc/v1',workshop:'typed-host-expression',sessions:['refining'].map(session=>({session,scopes:[]})),aggregates:[{name:'Stock',entity:'StockEntity',identifier:{name:'id',dataType:'String'},stateFields:[{name:'reservation',dataType:'String'}],commands:[{name:'Reserve',parameters:[{name:'quantity',dataType:'Int'}],produces:['Reserved']}],events:[{name:'Reserved',payloads:[{name:'reservation',dataType:'String'}],bindings:[{slot:'reservation',expr:fold?'param.quantity':expr}],foldAssignments:fold?[{slot:'reservation',expr}]:[]}]}],valueObjects:[],readModels:[],stories:[],domainServices:[]}),root);return root;}
test('exact typed host expression is binding-only source fidelity, never full semantic or runtime certification',()=>{const root=tree(host()),validation=validateTree(root);assert.deepEqual(validation.hard,[]);assert.ok(validation.notices.some(n=>n.startsWith('[V13H]')));const before=compileTree(root);assert.deepEqual(JSON.parse(before).aggregates[0].events[0].bindings[0].expr,host());assert.equal(roundtrip(root).ok,true);assert.equal(compileTree(root),before);});
test('unknown object expressions, missing qualified port or version and replay host calls remain hard failures',()=>{for(const expr of [{form:'auto'}, {...host(),extra:'unsafe'}, {...host(),version:''}, {...host(),id:{...host().id,kind:'command'}}, {...host(),id:{...host().id,owner:['Stock']}}])assert.ok(validateTree(tree(expr)).hard.some(n=>n.startsWith('[V13]')));assert.ok(validateTree(tree(host(),true)).hard.some(n=>n.startsWith('[V13]')));});
