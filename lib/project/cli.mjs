import { lstatSync, readdirSync, readFileSync, realpathSync, existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { compileTreeWithSources } from '../compile.mjs';
import { validateTree } from '../validate.mjs';
import { roundtrip } from '../roundtrip.mjs';
import { captureProductJson } from '../products/cli.mjs';
import { compileProductSet } from '../products/compile.mjs';
import { planCapturedProducts, registeredProductProducer } from '../products/generate-cli.mjs';
import { applyEntries, previewEntries } from '../../src/core/generate.mjs';
import { array, at, fail, object, text } from '../products/request.mjs';
import { copyImmutableData } from '../immutable-data.mjs';
import { MAX_JSON_BYTES } from '../strict-json.mjs';
import { deriveProjectRequest } from './derive.mjs';

const toolRoot = fileURLToPath(new URL('../../', import.meta.url));
const keys = ['schemaVersion', 'tree', 'canonicalId', 'context', 'products', 'exactTypes', 'exactCodecs', 'documents', 'assemblies', 'roles', 'generator', 'options'];
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value) + '\n';
const contains = (parent, child) => {
  const path = relative(parent, child);
  return path === '' || !isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep);
};
const overlaps = (a, b) => contains(a, b) || contains(b, a);

function physicalPath(path) {
  let ancestor = path;
  const suffix = [];
  while (true) {
    try { return join(realpathSync(ancestor), ...suffix); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      suffix.unshift(basename(ancestor));
      ancestor = dirname(ancestor);
    }
  }
}

export function localPath(base, input) {
  text(input, at('project'));
  if (input.includes('\0')) fail('PROJECT_PATH', 'NUL in path');
  const lexical = isAbsolute(input) ? input : base + sep + input;
  let current = parse(lexical).root;
  for (const part of lexical.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    let stat;
    try { stat = lstatSync(current); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (stat.isSymbolicLink()) fail('PROJECT_PATH', 'symlink path is not allowed: ' + current);
    if (!['.', '..'].includes(part)) {
      const matches = readdirSync(dirname(current)).filter(name => name.normalize('NFC').toLowerCase() === part.normalize('NFC').toLowerCase());
      if (matches.length !== 1 || matches[0] !== part) fail('PROJECT_PATH', 'case-fold filesystem alias: ' + current);
    }
  }
  return physicalPath(resolve(lexical));
}

function files(directory) {
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('PROJECT_PATH', 'regular directory required: ' + directory);
  return readdirSync(directory).sort().flatMap(name => {
    const file = join(directory, name), s = lstatSync(file);
    if (s.isDirectory()) return files(file);
    if (!s.isFile() || s.isSymbolicLink()) fail('PROJECT_PATH', 'regular input file required: ' + file);
    return [file];
  });
}

export function treeEvidence(tree) {
  let size = 0;
  return files(tree).map(file => {
    const stat = lstatSync(file);
    size += stat.size;
    if (size > MAX_JSON_BYTES) fail('PROJECT_INPUT', 'tree exceeds 8 MiB');
    const bytes = readFileSync(file);
    return { role: 'tree', file, bytes: bytes.length, sha256: hash(bytes) };
  });
}

export function toolEvidence() {
  const paths = ['lib', 'src', 'generators', 'schema', 'scaffold'].flatMap(dir => files(join(toolRoot, dir)))
    .concat([join(toolRoot, 'bin/truthsrc.js'), join(toolRoot, 'package.json')]);
  return { role: 'tool', root: toolRoot, sha256: hash(json(paths.sort().map(file => [file.slice(toolRoot.length), hash(readFileSync(file))]))) };
}

export function captureProject(projectFile, { roundtripCheck = true } = {}) {
  const file = localPath(process.cwd(), projectFile), captured = captureProductJson(file), config = structuredClone(captured.value);
  object(config, keys, at('project'));
  if (config.schemaVersion !== 'truthsrc.project/v1') fail('PROJECT_VERSION', 'unsupported project version');
  const base = dirname(file), tree = localPath(base, config.tree);
  if (!['workshop.yaml', 'system.yaml'].some(name => existsSync(join(tree, name)))) fail('PROJECT_TREE', 'system.yaml or explicit legacy workshop.yaml required');
  const before = treeEvidence(tree), checked = validateTree(tree);
  if (checked.hard.length) fail('PROJECT_TREE', JSON.stringify(checked.hard));
  const identity = roundtripCheck ? roundtrip(tree) : { checked: false };
  if (roundtripCheck && !identity.ok) fail('PROJECT_ROUNDTRIP', JSON.stringify(identity));
  const compiledTree = compileTreeWithSources(tree, { context: config.context }), canonical = compiledTree.canonical;
  if (compiledTree.context && compiledTree.context.id !== config.context) fail('PROJECT_CONTEXT', 'project context disagrees with author declaration');
  if (json(before) !== json(treeEvidence(tree))) fail('PROJECT_CHANGED', 'tree changed during compilation');
  const sources = [{ role: 'project', file, bytes: captured.bytes, sha256: captured.sha256 }, ...before];
  const documents = array(config.documents, at('project', '/documents')).map((doc, i) => {
    object(doc, ['id', 'file'], at('project', '/documents/' + i));
    text(doc.id, at('project', '/documents/' + i));
    const c = captureProductJson(localPath(base, doc.file));
    sources.push({ document: doc.id, file: c.file, bytes: c.bytes, sha256: c.sha256 });
    return { id: doc.id, schemaVersion: c.value.schemaVersion, value: c.value };
  });
  if (sources.reduce((n, s) => n + s.bytes, 0) > MAX_JSON_BYTES) fail('PROJECT_INPUT', 'project inputs exceed 8 MiB');
  text(config.generator, at('project', '/generator'));
  if (!/^[a-z][a-z0-9-]*$/.test(config.generator)) fail('PROJECT_GENERATOR', 'shipped generator directory name required');
  const generatorDir = join(toolRoot, 'generators', config.generator);
  registeredProductProducer(generatorDir);
  // Compilation checks option names; producer-specific value checks occur during generation.
  const manifest = captureProductJson(join(generatorDir, 'generator.json'));
  if (manifest.value.schemaVersion !== 'truthsrc.product-generator/v1') fail('PROJECT_GENERATOR', 'formal shipped producer required');
  object(config.options, manifest.value.options, at('project', '/options'));
  const repository = config.options.runtimeArtifact?.repository;
  if (typeof repository === 'string' && /^\.\.?\//.test(repository))
    config.options.runtimeArtifact.repository = pathToFileURL(localPath(base, repository)).href + '/';
  const roots = config.options.service?.externalSourceRoots;
  if (Array.isArray(roots)) config.options.service.externalSourceRoots = roots.map(root =>
    typeof root === 'string' && /^\.\.?\//.test(root) ? localPath(base, root) : root);
  const request = deriveProjectRequest(canonical, config, documents), compilation = compileProductSet(request);
  if (!compilation.result) fail('PRODUCT_COMPILATION', JSON.stringify(compilation.diagnostics));
  sources.push(toolEvidence());
  return { config, file, tree, generatorDir, canonical, request, compilation, sources, sourceIndex: compiledTree.sourceIndex,
    validation: { ...checked, roundtrip: identity } };
}

export function assertUnchanged(captured) {
  for (const source of captured.sources.filter(s => s.file)) {
    localPath(process.cwd(), source.file);
    if (hash(readFileSync(source.file)) !== source.sha256) fail('PROJECT_CHANGED', 'input changed before apply: ' + source.file);
  }
  if (json(treeEvidence(captured.tree)) !== json(captured.sources.filter(s => s.role === 'tree')))
    fail('PROJECT_CHANGED', 'tree file set changed before apply');
  if (json(toolEvidence()) !== json(captured.sources.find(s => s.role === 'tool')))
    fail('PROJECT_CHANGED', 'tool changed before apply');
}

export async function projectCli(command, args) {
  if (!['compile-project', 'generate-project'].includes(command)) fail('PROJECT_CLI', 'unknown project command');
  const flags = new Map(); let planOnly = false, update = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--plan' && command === 'generate-project' && !planOnly) { planOnly = true; continue; }
    if (flag === '--update' && command === 'generate-project' && !update) { update = true; continue; }
    if (!['--project', ...(command === 'generate-project' ? ['--out'] : [])].includes(flag) || flags.has(flag) || !args[i + 1] || args[i + 1].startsWith('--'))
      fail('PROJECT_CLI', 'unknown, duplicate or incomplete project flag');
    flags.set(flag, args[++i]);
  }
  if (!flags.has('--project') || command === 'generate-project' && !flags.has('--out')) fail('PROJECT_CLI', 'explicit --project and generation --out required');
  const captured = captureProject(flags.get('--project'));
  const common = { schemaVersion: 'truthsrc.project-result/v1', sources: captured.sources, validation: captured.validation };
  if (command === 'compile-project') {
    assertUnchanged(captured);
    return copyImmutableData({ ...common, applied: false, canonical: captured.canonical, request: captured.request, compilation: captured.compilation, sourceIndex: captured.sourceIndex });
  }
  const outDir = localPath(process.cwd(), flags.get('--out'));
  for (const input of [captured.tree, captured.file, ...captured.sources.filter(s => s.file).map(s => s.file), toolRoot])
    if (overlaps(outDir, input)) fail('PROJECT_OUTPUT', 'target must be disjoint from inputs and tool: ' + input);
  if (dirname(captured.file) === outDir || dirname(captured.file).startsWith(outDir + sep)) fail('PROJECT_OUTPUT', 'target cannot contain the project');
  const plan = projectPlan(captured, outDir);
  assertUnchanged(captured);
  const applyArgs = { entries: plan.entries, outDir, generator: plan.generator, anchorPolicy: 'written-only', ownership: { id: captured.file }, update };
  if (planOnly) {
    const preview = update ? previewEntries(applyArgs) : null;
    return copyImmutableData({ ...common, applied: false, plan, ...(preview ? { preview } : {}) });
  }
  const result = await applyEntries(applyArgs);
  return copyImmutableData({ ...common, applied: true, result });
}

export function projectPlan(captured, outDir) {
  const planned = planCapturedProducts({ request: captured.request, generatorDir: captured.generatorDir, options: captured.config.options, outDir });
  const evidence = [
    ['canonical', captured.canonical], ['request', captured.request], ['compiled', captured.compilation.result],
    ['inputs', { sources: captured.sources, validation: captured.validation, sourceIndex: captured.sourceIndex,
      generatedFiles: planned.plan.entries.map(e => e.path), canonicalId: captured.config.canonicalId }],
  ].map(([name, value]) => ({ path: '.truthsrc/' + name + '.json', content: json(value), kind: 'project-evidence', deps: [], knowledgeIds: [] }));
  if (planned.plan.entries.some(e => evidence.some(d => d.path === e.path))) fail('PROJECT_OUTPUT', 'producer collides with project evidence');
  return { ...planned.plan, schemaVersion: 'truthsrc.project-plan/v1', entries: [...planned.plan.entries, ...evidence] };
}
