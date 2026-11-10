import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { createHash } from 'node:crypto';

export async function installedPlayConsumer(installed, output) {
  assert(path.isAbsolute(installed) && path.isAbsolute(output));
  assert.equal(fs.realpathSync(installed), installed);
  const allowed = pathToFileURL(installed + '/').href;
  register('data:text/javascript,' + encodeURIComponent('export async function resolve(s,c,n) { const r=await n(s,c); ' +
    'if(r.url.startsWith("file:")&&!r.url.startsWith(' + JSON.stringify(allowed) + ')) throw Error("checkout fallback"); return r; }'), import.meta.url);
  const api = await import(pathToFileURL(installed + '/lib/project/cli.mjs'));
  const { verifyProject } = await import(pathToFileURL(installed + '/lib/project/verify.mjs'));
  const { queryProject, statusProject } = await import(pathToFileURL(installed + '/lib/project/query.mjs'));
  const { parseDoc, emitDoc } = await import(pathToFileURL(installed + '/lib/shared.mjs'));
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  const inventory = directory => fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = path.join(directory, entry.name);
    assert(!entry.isSymbolicLink());
    return entry.isDirectory() ? inventory(file) : [{ file, sha256: digest(fs.readFileSync(file)) }];
  });
  const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  const results = [];
  for (const variant of ['main', 'renamed']) {
    const out = path.join(output, variant);
    fs.mkdirSync(out);
    const author = path.join(out, 'author'), generated = path.join(out, 'generated');
    fs.cpSync(installed + '/scaffold/play-application-project', author, { recursive: true, force: false, errorOnExist: true });
    const project = author + '/truthsrc.project.json';
    const oracleReplacements = [];
    if (variant === 'renamed') {
      const config = JSON.parse(fs.readFileSync(project));
      const bindingFile = author + '/bindings/application.json', binding = JSON.parse(fs.readFileSync(bindingFile));
      const packageName = 'sample.relocated';
      for (const entry of config.options.packages) entry.package = packageName;
      const apiFile = author + '/truth/play-application/contexts/inventory/formal-products/api-contract/warehouse-api.formal.yaml';
      const doc = parseDoc(fs.readFileSync(apiFile, 'utf8'));
      const apiContract = doc.payload;
      apiContract.commands[0].id = 'allocate'; apiContract.commands[1].id = 'confirm';
      apiContract.query.resourceParameter = 'class';
      apiContract.query.path = apiContract.query.path.replace(':warehouseId', ':class');
      apiContract.page.path = apiContract.page.path.replace(':warehouseId', ':class');
      const roles = [['application-root', 'WarehouseApplication', 'DepotApplication'], ['controller', 'WarehouseController', 'DepotController'],
        ['application-settings', 'WarehouseSettings', 'DepotSettings'], ['components', 'WarehouseComponents', 'DepotComponents'],
        ['loader', 'WarehouseLoader', 'DepotLoader'], ['resource-lifecycle', 'WarehouseResourceLifecycle', 'DepotResources'],
        ['commands-port', 'WarehouseCommands', 'DepotCommands'], ['queries-port', 'WarehouseQueries', 'DepotQueries'], ['http-codec', 'WarehouseHttpCodec', 'DepotHttpCodec']];
      for (const [role, before, name] of roles) { config.options.names.push({ role, ref: apiContract.aggregate, name }); oracleReplacements.push([before, name]); }
      const { payload, ...headers } = doc;
      fs.writeFileSync(apiFile, emitDoc({ scalars: Object.entries(headers), blocks: { payload } }));
      for (const implementation of binding.implementations) implementation.symbol = implementation.symbol.replace('example.inventory.', packageName + '.');
      for (const file of inventory(author + '/implementations')) fs.writeFileSync(file.file, fs.readFileSync(file.file, 'utf8').replaceAll('example.inventory.', packageName + '.'));
      fs.writeFileSync(project, JSON.stringify(config, null, 2) + '\n');
      fs.writeFileSync(bindingFile, JSON.stringify(binding, null, 2) + '\n');
      oracleReplacements.unshift(['example.inventory.', packageName + '.']);
    }
    const captured = api.captureProject(project);
    assert.equal(captured.validation.hard.length, 0); assert.equal(captured.validation.roundtrip.ok, true);
    assert.equal(captured.compilation.result.products.length, 10);
    const external = inventory(author + '/implementations');
    const args = ['--project', project, '--out', generated];
    const plan = await api.projectCli('generate-project', [...args, '--plan']);
    assert(!fs.existsSync(generated));
    const applied = await api.projectCli('generate-project', args);
    const verification = verifyProject({ project, out: generated });
    assert(verification.passed, JSON.stringify(verification.diagnostics));
    for (const entry of plan.plan.entries) assert.equal(fs.readFileSync(path.join(generated, entry.path), 'utf8'), entry.content);
    assert.deepEqual(inventory(author + '/implementations'), external);
    const before = inventory(generated);
    assert.equal((await api.projectCli('generate-project', [...args, '--update'])).result.written, 0);
    assert.deepEqual(inventory(generated), before);
    for (const entry of plan.plan.entries.filter(e => e.codeMappings?.length)) {
      const bytes = fs.readFileSync(path.join(generated, entry.path));
      for (const mapping of entry.codeMappings) assert.equal(bytes.subarray(mapping.span.start, mapping.span.end).toString(), mapping.span.text);
      if (entry.path === 'conf/routes' || entry.path.endsWith('.scala.html') || /(?:Warehouse|Depot)Controller\.scala$/.test(entry.path)) {
        const mapping = entry.codeMappings[0], line = bytes.subarray(0, mapping.span.start).toString().split('\n').length;
        assert(queryProject({ project, out: generated, file: entry.path, line }).result.some(r => r.knowledge === mapping.knowledgeKey && r.sourceState === 'mapped'));
      }
    }
    api.assertUnchanged(captured);
    const result = { passed: true, installed, variant, out, author, project, generated, plan, applied, verification, oracleReplacements,
      checkoutFallback: false, runtimeVerified: false };
    write(out + '/result.json', result);
    results.push({ variant, receipt: out + '/result.json', entries: plan.plan.entries.length, oracleReplacements });
  }
  write(output + '/consumer-result.json', { passed: true, installed, results, checkoutFallback: false, runtimeVerified: false });
  return results;
}
if (!process.env.NODE_TEST_CONTEXT && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await installedPlayConsumer(process.argv[2], process.argv[3])));
}
