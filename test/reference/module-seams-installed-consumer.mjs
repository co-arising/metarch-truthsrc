import assert from 'node:assert/strict';
import { cpSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { register } from 'node:module';

// Run by the installation test with only the installed package admitted by the
// loader. This file is a test harness, not part of the distributed tool.
export async function installedConsumer(installed, sample, { evolve = true } = {}) {
assert(installed && sample);
const allowed = pathToFileURL(installed + '/').href;
register('data:text/javascript,' + encodeURIComponent('export async function resolve(s,c,n) { const r = await n(s,c); ' +
  'if (r.url.startsWith("file:") && !r.url.startsWith(' + JSON.stringify(allowed) + ')) throw Error("checkout fallback"); return r; }'), import.meta.url);
const api = await import(pathToFileURL(join(installed, 'lib/project/cli.mjs')));
const { inspectProject, verifyProject } = await import(pathToFileURL(join(installed, 'lib/project/verify.mjs')));
const { queryProject, statusProject } = await import(pathToFileURL(join(installed, 'lib/project/query.mjs')));
const { viewProject } = await import(pathToFileURL(join(installed, 'lib/project/view.mjs')));
const { emitAuthorDoc } = await import(pathToFileURL(join(installed, 'lib/author-surface.mjs')));
const { parseAuthorDoc } = await import(pathToFileURL(join(installed, 'lib/author-parse.mjs')));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inventory = root => readdirSync(root, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)).flatMap(entry => {
  const path = join(root, entry.name); return entry.isDirectory() ? inventory(path) : [{ path, sha256: sha(readFileSync(path)) }];
});
cpSync(join(installed, 'scaffold/module-seams-project'), sample, { recursive: true, force: false, errorOnExist: true });
const project = join(sample, 'truthsrc.project.json'), out = join(sample, 'generated'), f = { project, out };
const originalHandwritten = inventory(join(sample, 'handwritten'));
const args = ['--project', project, '--out', out];
const compiled = await api.projectCli('compile-project', ['--project', project]);
assert.equal(compiled.applied, false);
assert.deepEqual(compiled.validation.hard, []); assert(compiled.validation.roundtrip.ok);
const planned = await api.projectCli('generate-project', [...args, '--plan']); assert.equal(planned.applied, false);
const result = await api.projectCli('generate-project', args);
writeFileSync(join(sample, 'writer.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
assert.deepEqual(inventory(join(sample, 'handwritten')), originalHandwritten);
const view = viewProject(f);
assert.equal(view.verification.passed, true);
assert.equal(view.verification.runtimeVerified, false);
assert.equal(view.implementations.files, 3);
const h = queryProject({ ...f, implementation: 'repository' });
assert.equal(h.result[0].spanVerified, false); assert.equal(h.result[0].precision, 'file');
const inspected = inspectProject(f); assert.equal(inspected.result.passed, true);
const production = planned.plan.entries.filter(e => /src\/main\/scala/.test(e.path));
for (const [index, entry] of production.entries()) {
  const m = entry.codeMappings[0], bytes = readFileSync(join(out, entry.path));
  assert.equal(bytes.subarray(m.span.start, m.span.end).toString(), m.span.text);
  const reverse = inspected.query.reverse(entry.path);
  assert(reverse.some(row => row.knowledge === m.knowledgeKey && row.origins.every(origin => origin.file) &&
    row.location.span.start === m.span.start && row.location.span.end === m.span.end));
  if (index === 0) {
    const line = bytes.subarray(0, m.span.start).toString().split('\n').length;
    const q = queryProject({ ...f, file: entry.path, line });
    assert(q.result.some(row => row.knowledge === m.knowledgeKey && row.origins.every(origin => origin.file)));
  }
}
api.assertUnchanged(inspected.captured);
assert.equal((await api.projectCli('generate-project', [...args, '--update'])).result.written, 0);
const changed = [];
if (!evolve) return { installed: true, generated: 7, handwritten: 3, changed, checkoutFallback: false, runtimeVerified: false };
const refresh = async kind => {
  const status = statusProject(f);
  assert.equal(status.inputs.state, 'changed', JSON.stringify(status.inputs)); assert.equal(verifyProject(f).passed, false);
  const preview = await api.projectCli('generate-project', [...args, '--update', '--plan']);
  assert.deepEqual(preview.validation.hard, []); assert(preview.validation.roundtrip.ok);
  await api.projectCli('generate-project', [...args, '--update']);
  const verification = verifyProject(f);
  assert.equal(verification.passed, true); assert.equal(verification.runtimeVerified, false);
  assert.equal(statusProject(f).inputs.state, 'current'); changed.push(kind);
};
const handwritten = join(sample, 'handwritten/kernel/CapacityRule.scala');
writeFileSync(handwritten, readFileSync(handwritten, 'utf8') + '\n// installed consumer edit\n');
await refresh('handwritten');
const bindingFile = join(sample, 'bindings/module-seams.json');
const binding = JSON.parse(readFileSync(bindingFile));
binding.root.parameterGroups[0].inputs[0].name = 'availableRoutes';
writeFileSync(bindingFile, JSON.stringify(binding, null, 2) + '\n');
await refresh('composition');
const author = join(sample, 'truth/module-seams/contexts/parcel/value-objects/route.vo.yaml');
const doc = parseAuthorDoc(readFileSync(author, 'utf8'));
assert(doc.payload.fields && doc.payload.fields.length);
doc.payload.fields.push({ name: 'label', dataType: 'String' });
writeFileSync(author, emitAuthorDoc(doc));
await refresh('signature');
return { installed: true, generated: 7, handwritten: 3, changed, checkoutFallback: false, runtimeVerified: false };
}
