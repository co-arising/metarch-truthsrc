import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileTreeWithSources } from '../lib/compile.mjs';
import { deriveProjectRequest } from '../lib/project/derive.mjs';

function request() {
  const root = fileURLToPath(new URL('../scaffold/play-application-project/', import.meta.url));
  const config = JSON.parse(fs.readFileSync(root + 'truthsrc.project.json'));
  const canonical = compileTreeWithSources(root + config.tree).canonical;
  const documents = config.documents.map(d => {
    const value = JSON.parse(fs.readFileSync(root + d.file));
    return { id: d.id, schemaVersion: value.schemaVersion, value };
  });
  return deriveProjectRequest(canonical, config, documents);
}
test('ten-product initialization and lowering need no filesystem process clock or network effects', () => {
  const modules = new Map();
  function bundle(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const text = fs.readFileSync(url, 'utf8').replace(/from '(\.[^']+)'/gu, (_, relative) => `from ${JSON.stringify(bundle(new URL(relative, url)))}`);
    const result = 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
    modules.set(url.href, result); return result;
  }
  const module = bundle(new URL('../lib/products/compile.mjs', import.meta.url));
  const script = `
    const fs = (await import('node:fs')).default, child = (await import('node:child_process')).default;
    const { syncBuiltinESMExports } = await import('node:module');
    const deny = () => { throw Error('forbidden effect'); };
    for (const key of ['readFileSync','readdirSync','existsSync','writeFileSync','mkdirSync','rmSync','statSync','lstatSync','openSync']) fs[key] = deny;
    for (const key of ['readFile','writeFile','readdir','stat','open','access']) fs.promises[key] = deny;
    for (const key of ['execFileSync','execSync','spawn','spawnSync','exec','fork']) child[key] = deny;
    syncBuiltinESMExports(); const finish = process.exit.bind(process);
    globalThis.process = new Proxy({}, { get: deny }); globalThis.Date = new Proxy(class {}, { get: deny, construct: deny });
    globalThis.fetch = deny; globalThis.setTimeout = deny; Math.random = deny;
    const { compileProductSet } = await import(${JSON.stringify(module)});
    const original = ${JSON.stringify(request())};
    const result = compileProductSet(original);
    if (result.result?.products.length !== 10) throw Error('ten-product pure compile failed');
    const badApi = structuredClone(original);
    badApi.documents.find(d => d.schemaVersion === 'truthsrc.api-binding/v1').value.contract.commands[0].csrf = false;
    if (compileProductSet(badApi).result !== null) throw Error('changed authority admitted');
    const badComposition = structuredClone(original);
    badComposition.documents.find(d => d.schemaVersion === 'truthsrc.application-composition-binding/v1').value.runtime.play = '2.8.20';
    if (compileProductSet(badComposition).result !== null) throw Error('wrong runtime admitted');
    finish(0);
  `;
  assert.doesNotThrow(() => execFileSync(process.execPath, ['--input-type=module'], { input: script, encoding: 'utf8', timeout: 20000, maxBuffer: 2 * 1024 * 1024 }));
});
