import { constants, copyFileSync, lstatSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTree } from '../validate.mjs';
import { roundtrip } from '../roundtrip.mjs';

const scaffold = fileURLToPath(new URL('../../scaffold/local-project/', import.meta.url));

function statIfPresent(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// Inspect lexical components too: resolve() alone would hide a symlink in a/../b.
function checkParents(absolute) {
  let current = parse(absolute).root;
  for (const part of absolute.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    const stat = statIfPresent(current);
    if (stat?.isSymbolicLink()) throw new Error(`init: symlink parent is not allowed: ${current}`);
    if (stat && !stat.isDirectory()) throw new Error(`init: parent is not a directory: ${current}`);
  }
}

function scaffoldEntries(directory, relative = '') {
  const stat = lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`init: invalid scaffold directory: ${directory}`);
  return readdirSync(directory).sort().flatMap(name => {
    const source = join(directory, name), path = join(relative, name), entry = lstatSync(source);
    if (entry.isDirectory()) return [{ path, directory: true }, ...scaffoldEntries(source, path)];
    if (!entry.isFile()) throw new Error(`init: scaffold must contain only regular files/directories: ${source}`);
    return [{ path, source }];
  });
}

export function initProject(args) {
  if (!Array.isArray(args) || args.length !== 1 || typeof args[0] !== 'string'
      || !args[0].trim() || args[0].startsWith('-') || args[0].includes('\0')) {
    throw new Error('init: expected exactly one new project directory (usage: truthsrc init <new-project-dir>)');
  }
  const input = isAbsolute(args[0]) ? args[0] : `${process.cwd()}${sep}${args[0]}`;
  const root = resolve(input), parent = dirname(root);
  // lstat, not existsSync: even a dangling symlink reserves the destination.
  if (statIfPresent(root)) throw new Error(`init: destination already exists: ${root}`);
  checkParents(dirname(input));
  checkParents(parent);
  const entries = scaffoldEntries(scaffold);
  for (const required of [join('tree', 'workshop.yaml'), 'truthsrc.project.json']) {
    if (!entries.some(entry => entry.path === required && !entry.directory))
      throw new Error(`init: scaffold file is missing: ${join(scaffold, required)}`);
  }

  mkdirSync(parent, { recursive: true });
  checkParents(parent);
  // Never use recursive mkdir for the project root or overwrite existing files.
  // Failure leaves the new directory in place; there is no cleanup of user data.
  mkdirSync(root);
  for (const entry of entries) {
    const target = join(root, entry.path);
    if (entry.directory) mkdirSync(target);
    else copyFileSync(entry.source, target, constants.COPYFILE_EXCL);
  }
  const tree = join(root, 'tree'), project = join(root, 'truthsrc.project.json');
  const checked = validateTree(tree);
  if (checked.hard.length) throw new Error(`init: validation failed:\n${checked.hard.join('\n')}`);
  const identity = roundtrip(tree);
  if (!identity.ok) throw new Error(`init: roundtrip failed (${identity.stage}): ${identity.msg}`);
  return { root, tree, project, validation: { ...checked, roundtrip: identity } };
}
