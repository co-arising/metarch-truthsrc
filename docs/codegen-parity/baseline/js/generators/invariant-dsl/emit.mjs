#!/usr/bin/env node
// Legacy CLI delegates to the same pure renderer.
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {render} from './render.mjs';
const [specPath,outPath]=process.argv.slice(2); const spec=JSON.parse(readFileSync(specPath,'utf8'));
let outDir;try{outDir=statSync(outPath).isDirectory()?outPath:dirname(outPath);}catch{outDir=outPath.endsWith('.scala')?dirname(outPath):outPath;}
const result=render(spec);for(const file of result.files){const target=join(outDir,file.path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,file.content);console.log('invariant-dsl: wrote '+file.path);}
if(outPath.endsWith('.scala'))writeFileSync(outPath,'// generated: '+result.containerName+'.scala\n');
