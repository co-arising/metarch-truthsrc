import { readFileSync, writeFileSync, existsSync, lstatSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { parseDoc } from '../shared.mjs';
import { compileTree } from '../compile.mjs';
import { validateTree } from '../validate.mjs';
import { compileExecution } from './compile.mjs';

// CLI boundary only; semantic compilation stays pure and cannot write artifacts.
export function compileContractArgs(args) {
  const values = new Map();
  const flags = new Set(['--tree', '--in', '--binding', '--out']);
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (!flags.has(flag)) throw new Error(`Unknown compilation option: ${flag}`);
    if (values.has(flag)) throw new Error(`Repeated compilation option: ${flag}`);
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a path`);
    values.set(flag, resolve(value));
  }
  if (values.has('--tree') === values.has('--in')) {
    throw new Error('Specify exactly one of --tree or --in');
  }
  if (!values.has('--out')) throw new Error('--out requires an explicit artifact path');
  return Object.fromEntries(values);
}

// Resolve authored products to their real files; do not invent atom line numbers.
function treeSourceMap(tree, kind) {
  const family = kind === 'execution' ? 'pipelines' : 'sagas';
  const suffix = kind === 'execution' ? '.pipeline.yaml' : '.saga.yaml';
  const directory = join(tree, family);
  if (!existsSync(directory)) return { canonical: { '': { file: join(tree, 'workshop.yaml'), path: '' } } };
  const atoms = readdirSync(directory).filter((file) => file.endsWith(suffix)).sort().map((file) => {
    const path = join(directory, file);
    return { path, doc: parseDoc(readFileSync(path, 'utf8'), path) };
  });
  if (kind === 'saga' && atoms.length && atoms.every(({ doc }) => doc.seq !== undefined && doc.seq !== null)) {
    atoms.sort((a, b) => Number(a.doc.seq) - Number(b.doc.seq));
  }
  return { canonical: Object.fromEntries([
    ['', { file: join(tree, 'workshop.yaml'), path: '' }],
    ...atoms.map(({ path, doc }, index) => [`/${family}/${index}`, { file: path, atom: String(doc.id), path: '' }]),
  ]) };
}

export async function compileContractCli(kind, args) {
  const options = compileContractArgs(args);
  let canonical;
  if (options['--tree']) {
    const rootFile = join(options['--tree'], 'workshop.yaml');
    const root = parseDoc(readFileSync(rootFile, 'utf8'), rootFile);
    if (root.schemaVersion !== 'truthsrc/v1') {
      throw new Error(`Unsupported truth tree schemaVersion: ${root.schemaVersion ?? '(missing)'}`);
    }
    const result = validateTree(options['--tree']);
    if (result.hard.length) throw new Error(`Tree validation failed:\n${result.hard.join('\n')}`);
    canonical = JSON.parse(compileTree(options['--tree']));
  } else canonical = JSON.parse(readFileSync(options['--in'], 'utf8'));
  const binding = options['--binding']
    ? JSON.parse(readFileSync(options['--binding'], 'utf8')) : undefined;
  const compiler = kind === 'execution' ? compileExecution
    : (await import('../saga/compile.mjs')).compileSagas;
  const result = compiler(canonical, binding);
  const authored = options['--tree'] ? { ...treeSourceMap(options['--tree'], kind).canonical,
    ...(kind === 'execution' ? treeSourceMap(options['--tree'], 'saga').canonical : {}) } : null;
  const treeSource = (source) => {
    if (!authored || source.document !== 'canonical') return source;
    let ancestor = source.pointer;
    while (!Object.hasOwn(authored, ancestor) && ancestor) ancestor = ancestor.slice(0, ancestor.lastIndexOf('/'));
    const hint = authored[ancestor];
    return hint ? { ...source, file: hint.file, atom: hint.atom ?? null,
      path: source.pointer.slice(ancestor.length), location: null } : source;
  };
  if (result.ir === null) {
    throw new Error(result.diagnostics.map((entry) => {
      const source = entry.source ? treeSource(entry.source) : null;
      const location = source ? `${source.file ?? source.document}${source.path}` : entry.pointer ?? '';
      return `${entry.code} ${location}: ${entry.message}`;
    }).join('\n'));
  }
  if (authored) {
    for (const [pointer, source] of Object.entries(result.ir.sourceMap)) result.ir.sourceMap[pointer] = treeSource(source);
  }
  const output = options['--out'];
  if (options['--tree'] && (output === options['--tree'] || output.startsWith(options['--tree'] + '/'))) {
    throw new Error('Compilation artifacts must be outside the truth tree');
  }
  if ([options['--in'], options['--binding']].includes(output)) {
    throw new Error('Compilation output cannot overwrite its input');
  }
  for (let path = output; ; path = dirname(path)) {
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
      throw new Error(`Compilation output crosses a symbolic link: ${path}`);
    }
    if (dirname(path) === path) break;
  }
  const bytes = JSON.stringify(result.ir, null, 2) + '\n';
  if (existsSync(output)) {
    if (!lstatSync(output).isFile()) throw new Error(`Compilation output is not a file: ${output}`);
    if (readFileSync(output, 'utf8') !== bytes) {
      throw new Error(`Compilation output already exists with different content: ${output}`);
    }
  } else writeFileSync(output, bytes, { flag: 'wx' });
  return { output, diagnostics: result.diagnostics };
}
