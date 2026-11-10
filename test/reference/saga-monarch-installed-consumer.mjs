import assert from 'node:assert/strict';
import { cpSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { register } from 'node:module';

/** External test harness; every tool import after the loader guard is installed-only. */
export async function installedSagaMonarchConsumer(installed, sample, { evolve = true } = {}) {
  const allowed = pathToFileURL(installed + '/').href;
  register('data:text/javascript,' + encodeURIComponent('export async function resolve(s,c,n) { const r = await n(s,c); ' +
    'if (r.url.startsWith("file:") && !r.url.startsWith(' + JSON.stringify(allowed) + ')) throw Error("checkout fallback"); return r; }'), import.meta.url);
  const module = file => import(pathToFileURL(join(installed, file)));
  const api = await module('lib/project/cli.mjs');
  const { verifyProject } = await module('lib/project/verify.mjs');
  const { queryProject, statusProject } = await module('lib/project/query.mjs');
  const { emitAuthorDoc } = await module('lib/author-surface.mjs');
  const { parseAuthorDoc } = await module('lib/author-parse.mjs');
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const inventory = directory => readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? inventory(file) : [{ file, sha256: sha(readFileSync(file)) }];
  });
  cpSync(join(installed, 'scaffold/saga-monarch-project'), sample, { recursive: true, force: false, errorOnExist: true });
  const project = join(sample, 'truthsrc.project.json'), out = join(sample, 'generated'), f = { project, out };
  const original = inventory(join(sample, 'implementations'));
  const captured = api.captureProject(project);
  assert.equal(captured.compilation.result.products.length, 8);
  assert.equal(captured.validation.hard.length, 0); assert.equal(captured.validation.roundtrip.ok, true);
  const args = ['--project', project, '--out', out];
  const planned = await api.projectCli('generate-project', [...args, '--plan']);
  const applied = await api.projectCli('generate-project', args);
  assert.equal(applied.applied, true);
  const production = planned.plan.entries.filter(entry => entry.path.endsWith('.scala'));
  assert.equal(production.length, 6);
  assert.deepEqual(inventory(join(sample, 'implementations')), original);
  assert.equal(verifyProject(f).passed, true);
  const query = queryProject({ ...f, implementation: 'inventory-files' });
  assert.equal(query.state, 'mapped'); assert.equal(query.result[0].spanVerified, false);
  for (const entry of production) {
    const mapping = entry.codeMappings[0], bytes = readFileSync(join(out, entry.path));
    assert.equal(bytes.subarray(mapping.span.start, mapping.span.end).toString(), mapping.span.text);
    const line = bytes.subarray(0, mapping.span.start).toString().split('\n').length;
    const reverse = queryProject({ ...f, file: entry.path, line });
    assert(reverse.result.some(row => row.knowledge === mapping.knowledgeKey && row.origins.every(origin => origin.file)));
  }
  const initial = inventory(out);
  const stats = production.map(e => { const s = statSync(join(out, e.path), { bigint: true }); return [e.path, String(s.mtimeNs), String(s.ctimeNs), String(s.ino)]; });
  assert.equal((await api.projectCli('generate-project', [...args, '--update'])).result.written, 0);
  assert.deepEqual(inventory(out), initial);
  assert.deepEqual(production.map(e => { const s = statSync(join(out, e.path), { bigint: true }); return [e.path, String(s.mtimeNs), String(s.ctimeNs), String(s.ino)]; }), stats);
  const changed = [];
  if (evolve) {
    const refresh = async kind => {
      assert.equal(statusProject(f).inputs.state, 'changed');
      assert.equal(verifyProject(f).passed, false);
      const current = api.captureProject(project);
      assert.equal(current.validation.hard.length, 0); assert.equal(current.validation.roundtrip.ok, true);
      await api.projectCli('generate-project', [...args, '--update', '--plan']);
      await api.projectCli('generate-project', [...args, '--update']);
      assert.equal(verifyProject(f).passed, true); assert.equal(statusProject(f).inputs.state, 'current'); changed.push(kind);
    };
    const impl = join(sample, 'implementations/FileInventoryPorts.scala');
    writeFileSync(impl, readFileSync(impl, 'utf8') + '\n// installed consumer annotation\n');
    await refresh('implementation');
    const bindingFile = join(sample, 'bindings/composition.json'), binding = JSON.parse(readFileSync(bindingFile, 'utf8'));
    binding.settings.maxJobs = 3; writeFileSync(bindingFile, JSON.stringify(binding, null, 2) + '\n');
    await refresh('binding');
    const author = join(sample, 'truth/saga-monarch/contexts/inventory/formal-products/workflow/inventory-job.formal.yaml');
    const doc = parseAuthorDoc(readFileSync(author, 'utf8'));
    doc.payload.areas[0].batch.maxWaitMillis = 125; writeFileSync(author, emitAuthorDoc(doc));
    await refresh('author');
  }
  const result = { installed: true, generated: 6, handwritten: 1, changed, checkoutFallback: false,
    runtimeVerified: false, project, out, sourceVerification: verifyProject(f).passed };
  writeFileSync(join(sample, 'installed-consumer-result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}
