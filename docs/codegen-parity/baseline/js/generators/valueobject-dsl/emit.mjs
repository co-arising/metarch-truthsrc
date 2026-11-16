#!/usr/bin/env node
// Legacy CLI delegates to the same pure renderer.
import {readFileSync,writeFileSync} from 'node:fs';
import {render} from './render.mjs';
const [specPath,outPath]=process.argv.slice(2);const spec=JSON.parse(readFileSync(specPath,'utf8'));
writeFileSync(outPath,render(spec));console.log("valueobject-dsl: wrote "+outPath);
