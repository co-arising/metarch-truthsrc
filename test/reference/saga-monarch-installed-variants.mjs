import assert from 'node:assert/strict';
import { cpSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { register } from 'node:module';

/** Candidate author trees are explicit external test inputs; production imports are installed-only. */
export async function installedR2Variants(installed, destination, inputs) {
  const allowed = pathToFileURL(installed + '/').href;
  register('data:text/javascript,' + encodeURIComponent('export async function resolve(s,c,n){const r=await n(s,c);' +
    'if(r.url.startsWith("file:")&&!r.url.startsWith(' + JSON.stringify(allowed) + '))throw Error("checkout fallback");return r;}'), import.meta.url);
  const api = await import(pathToFileURL(join(installed, 'lib/project/cli.mjs')));
  const { verifyProject } = await import(pathToFileURL(join(installed, 'lib/project/verify.mjs')));
  const { queryProject } = await import(pathToFileURL(join(installed, 'lib/project/query.mjs')));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const inventory = (directory, root = directory) => readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? inventory(file, root) : [{ file: file.slice(root.length), sha256: hash(readFileSync(file)) }];
  });
  const results = [];
  for (const input of inputs) {
    assert(['retry', 'pure', 'carry'].includes(input.variant));
    const sample = join(destination, input.variant); mkdirSync(sample);
    for (const member of ['truth', 'bindings', 'implementations', 'truthsrc.project.json'])
      cpSync(join(input.author, member), join(sample, member), { recursive: true, force: false, errorOnExist: true });
    const before = inventory(join(sample, 'implementations'));
    const project = join(sample, 'truthsrc.project.json'), out = join(sample, 'generated');
    const captured = api.captureProject(project);
    assert.equal(captured.validation.hard.length, 0); assert.equal(captured.validation.roundtrip.ok, true);
    const planned = await api.projectCli('generate-project', ['--project', project, '--out', out, '--plan']);
    await api.projectCli('generate-project', ['--project', project, '--out', out]);
    assert.equal(verifyProject({ project, out }).passed, true);
    const scala = planned.plan.entries.filter(entry => entry.path.endsWith('.scala'));
    for (const entry of scala) {
      const bytes = readFileSync(join(out, entry.path)), mapping = entry.codeMappings[0];
      assert.equal(bytes.toString(), entry.content);
      assert.equal(bytes.subarray(mapping.span.start, mapping.span.end).toString(), mapping.span.text);
      const line = bytes.subarray(0, mapping.span.start).toString().split('\n').length;
      assert.equal(queryProject({ project, out, file: entry.path, line }).precision, 'span');
    }
    assert.deepEqual(inventory(join(sample, 'implementations')), before);
    const repeated = await api.projectCli('generate-project', ['--project', project, '--out', out, '--update']);
    assert.equal(repeated.result.written, 0);
    results.push({ variant: input.variant, project, out, generated: scala.length, handwritten: captured.implementations.members.length,
      inputAuthor: input.author, noCheckoutFallback: true, sourceVerified: true, runtimeVerified: false });
  }
  writeFileSync(join(destination, 'installed-variants-result.json'), JSON.stringify(results, null, 2) + '\n', { flag: 'wx' });
  return results;
}
