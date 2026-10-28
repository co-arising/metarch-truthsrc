#!/usr/bin/env node
// Legacy CLI delegates to the same pure renderer.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {render} from './render.mjs';
const [specPath,outPath]=process.argv.slice(2); const spec=JSON.parse(readFileSync(specPath,'utf8'));
const outDir=outPath.endsWith('.scala')?dirname(outPath):outPath; const result=render(spec);
for(const file of result.files){ const entity=file.path.startsWith('entities/'); const target=entity?join(spec.entityDir,file.path.slice(9)):join(outDir,file.path); mkdirSync(dirname(target),{recursive:true}); writeFileSync(target,file.content); }
for(const notice of result.notices)process.stderr.write(notice);
console.log(`aggregate-dsl: wrote ${result.objectName}Protocol.scala, ${result.objectName}Aggregate.scala, behaviors/${result.objectName}Behaviors.scala, factories/${result.objectName}AggregateFactory.scala`+(spec.entityDir?`, entities/${result.objectName}Entity.scala, entities/behaviors/${result.objectName}EventHandler.scala`:''));
