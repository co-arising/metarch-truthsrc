import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join, relative, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// External acceptance harness: every production import comes from the installed
// package argument, never a checkout-relative implementation or reference Scala.
export async function installedPersistenceConsumer(installed, destination) {
  const root = realpathSync(installed), loaded = [];
  const load = async name => {
    const path = realpathSync(join(root, name)), r = relative(root, path);
    assert(r !== '..' && !r.startsWith('..' + sep) && !isAbsolute(r));
    loaded.push(path);
    return import(pathToFileURL(path));
  };
  assert(!existsSync(destination));
  mkdirSync(destination);
  const author = join(destination, 'author');
  cpSync(join(root, 'scaffold/persistence-readside-project'), author, { recursive: true, force: false, errorOnExist: true });
  const project = join(author, 'truthsrc.project.json'), out = join(destination, 'generated');
  const { projectCli } = await load('lib/project/cli.mjs');
  const { statusProject, queryProject } = await load('lib/project/query.mjs');
  const { verifyProject } = await load('lib/project/verify.mjs');
  const { viewProject } = await load('lib/project/view.mjs');
  const compile = await projectCli('compile-project', ['--project', project]);
  assert.equal(compile.validation.hard.length, 0);
  assert.equal(compile.validation.roundtrip.ok, true);
  const args = ['--project', project, '--out', out];
  const plan = await projectCli('generate-project', [...args, '--plan']);
  assert.equal(plan.applied, false); assert(!existsSync(out));
  assert.equal((await projectCli('generate-project', args)).applied, true);
  assert.equal(verifyProject({ project, out }).passed, true);
  assert.equal(statusProject({ project, out }).synchronized, true);
  assert.equal((await projectCli('generate-project', [...args, '--update'])).result.written, 0);
  const mapping = plan.plan.entries.flatMap(e => (e.codeMappings ?? []).map(m => ({ entry: e, mapping: m })))
    .find(({ mapping: m }) => m.knowledgeKey.startsWith('source:persistence#/wire/registrations/'));
  assert(mapping);
  const forward = queryProject({ project, out, knowledge: mapping.mapping.knowledgeKey });
  assert(forward.result.some(r => r.locations.some(l => l.file === mapping.entry.path)));
  const view = viewProject({ project, out });
  assert(view, 'installed view is produced');
  const bindingPath = join(author, 'bindings/persistence.json'), b = JSON.parse(readFileSync(bindingPath));
  const pins = b.wire.registrations.map(r => r.layoutSha256);
  b.store.indexes[0].valueSize += 1;
  writeFileSync(bindingPath, JSON.stringify(b, null, 2) + '\n');
  assert.equal(statusProject({ project, out }).synchronized, false);
  assert.equal(verifyProject({ project, out }).passed, false);
  assert.equal((await projectCli('generate-project', [...args, '--update', '--plan'])).applied, false);
  await projectCli('generate-project', [...args, '--update']);
  assert.equal(verifyProject({ project, out }).passed, true);
  assert.deepEqual(JSON.parse(readFileSync(bindingPath)).wire.registrations.map(r => r.layoutSha256), pins);
  const members = (directory, prefix = '') => readdirSync(join(directory, prefix), { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? members(directory, join(prefix, e.name)) : [join(prefix, e.name)]);
  assert(members(out).some(p => p.endsWith('.sql')));
  assert(loaded.length >= 4);
  return { installed: true, checkoutFallback: false, validation: true, roundtrip: true,
    bindingStaleUpdate: true, wirePinsPreserved: true, runtimeVerified: false };
}
